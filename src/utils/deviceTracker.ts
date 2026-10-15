/**
 * Device Telemetry & Real-Time Tracking Utility
 * Keeps accurate, real-time records of devices accessing the platform.
 * Communicates with backend Express server (/api/telemetry) for global multi-device tracking.
 */

export interface DeviceRecord {
  id: string;
  isCurrentDevice?: boolean;
  deviceCategory: 'Desktop' | 'Mobile' | 'Tablet';
  deviceName: string;
  os: string;
  browser: string;
  ip: string;
  location?: string;
  screenResolution: string;
  language: string;
  userAgent: string;
  firstSeen: number;
  lastActive: number;
  passPassed: boolean;
  loginAttempts?: number;
}

const STORAGE_KEY = 'mihiretu_device_telemetry_db_v2';
const CURRENT_DEV_ID_KEY = 'mihiretu_current_device_id';

export function getDeviceId(): string {
  let devId = localStorage.getItem(CURRENT_DEV_ID_KEY);
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem(CURRENT_DEV_ID_KEY, devId);
  }
  return devId;
}

function detectOS(ua: string): string {
  if (/windows nt 10/i.test(ua)) return 'Windows 10 / 11';
  if (/windows nt 6.3/i.test(ua)) return 'Windows 8.1';
  if (/windows nt 6.1/i.test(ua)) return 'Windows 7';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function detectBrowser(ua: string): string {
  if (/edg/i.test(ua)) return 'Microsoft Edge';
  if (/opr|opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua)) return 'Google Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Mozilla Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Apple Safari';
  return 'Web Browser';
}

function detectCategory(ua: string): 'Desktop' | 'Mobile' | 'Tablet' {
  if (/ipad|tablet/i.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/i.test(ua))) {
    return 'Tablet';
  }
  if (/mobile|iphone|ipod|android|blackBerry|opera mini|iemobile/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

function detectDeviceName(ua: string): string {
  const os = detectOS(ua);
  const category = detectCategory(ua);
  if (/iphone/i.test(ua)) return 'Apple iPhone';
  if (/ipad/i.test(ua)) return 'Apple iPad';
  if (/macintosh/i.test(ua)) return 'Apple Mac';
  if (/android/i.test(ua)) return 'Android Device';
  if (/windows/i.test(ua)) return 'Windows Workstation';
  if (/linux/i.test(ua)) return 'Linux PC';
  return `${os} ${category}`;
}

export function getStoredDevices(): DeviceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read device telemetry:', e);
  }
  return [];
}

function saveDevices(devices: DeviceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Failed to save device telemetry:', e);
  }
}

let ipCache: { ip: string; location?: string } | null = null;

async function fetchIPInfo(): Promise<{ ip: string; location?: string }> {
  if (ipCache) return ipCache;
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      ipCache = {
        ip: data.ip || '127.0.0.1',
        location: [data.city, data.country_name].filter(Boolean).join(', ') || undefined,
      };
      return ipCache;
    }
  } catch {
    // fallback to ipify
    try {
      const res2 = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
      if (res2.ok) {
        const data2 = await res2.json();
        ipCache = { ip: data2.ip || '127.0.0.1' };
        return ipCache;
      }
    } catch {
      // ignore
    }
  }
  return { ip: 'Client Network' };
}

export async function registerOrUpdateCurrentDevice(passwordPassed: boolean = false): Promise<DeviceRecord> {
  const currentId = getDeviceId();
  const ua = navigator.userAgent;
  const os = detectOS(ua);
  const browser = detectBrowser(ua);
  const category = detectCategory(ua);
  const deviceName = detectDeviceName(ua);
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const language = navigator.language || 'en-US';

  const ipInfo = await fetchIPInfo();
  const devices = getStoredDevices();
  const existingIndex = devices.findIndex((d) => d.id === currentId);

  const now = Date.now();

  let currentRecord: DeviceRecord;

  const hasLocalSiteToken = Boolean(localStorage.getItem('site_auth_token'));
  const isPassedPassword = passwordPassed || hasLocalSiteToken || (existingIndex !== -1 && devices[existingIndex].passPassed);

  if (existingIndex !== -1) {
    currentRecord = {
      ...devices[existingIndex],
      lastActive: now,
      os,
      browser,
      deviceCategory: category,
      deviceName,
      screenResolution,
      language,
      userAgent: ua,
      ip: ipInfo.ip || devices[existingIndex].ip,
      location: ipInfo.location || devices[existingIndex].location,
      passPassed: isPassedPassword,
    };
    devices[existingIndex] = currentRecord;
  } else {
    currentRecord = {
      id: currentId,
      deviceCategory: category,
      deviceName,
      os,
      browser,
      ip: ipInfo.ip,
      location: ipInfo.location,
      screenResolution,
      language,
      userAgent: ua,
      firstSeen: now,
      lastActive: now,
      passPassed: isPassedPassword,
    };
    devices.unshift(currentRecord);
  }

  saveDevices(devices);

  // Send heartbeat to backend Express server so all devices are aggregated globally!
  try {
    const localToken = localStorage.getItem('site_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (localToken) {
      headers['Authorization'] = `Bearer ${localToken}`;
    }

    await fetch('/api/telemetry/heartbeat', {
      method: 'POST',
      headers,
      body: JSON.stringify(currentRecord),
    });
  } catch (err) {
    // Ignore offline network errors
  }

  return currentRecord;
}

export function markCurrentDevicePasswordPassed(): void {
  const currentId = getDeviceId();
  const devices = getStoredDevices();
  const idx = devices.findIndex((d) => d.id === currentId);
  const now = Date.now();

  if (idx !== -1) {
    devices[idx].passPassed = true;
    devices[idx].lastActive = now;
    saveDevices(devices);
  }
  
  // Post heartbeat immediately
  registerOrUpdateCurrentDevice(true);
}

export async function fetchServerTelemetryStats() {
  try {
    const res = await fetch('/api/telemetry/devices');
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && Array.isArray(serverData.devices)) {
        // Merge with local devices
        const localDevs = getStoredDevices();
        const currentId = getDeviceId();
        const serverDevs: DeviceRecord[] = serverData.devices;

        const mergedMap = new Map<string, DeviceRecord>();
        serverDevs.forEach((d) => mergedMap.set(d.id, d));
        localDevs.forEach((d) => {
          if (!mergedMap.has(d.id)) {
            mergedMap.set(d.id, d);
          } else {
            const existing = mergedMap.get(d.id)!;
            if (d.passPassed) existing.passPassed = true;
            if (d.lastActive > existing.lastActive) existing.lastActive = d.lastActive;
          }
        });

        const mergedList = Array.from(mergedMap.values()).sort((a, b) => b.lastActive - a.lastActive);
        saveDevices(mergedList);

        const now = Date.now();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
        const onlineThreshold = now - 2 * 60 * 1000;

        return {
          totalDevicesCount: mergedList.length,
          todayActiveCount: mergedList.filter((d) => d.lastActive >= twentyFourHoursAgo).length,
          passedPasswordCount: mergedList.filter((d) => d.passPassed).length,
          currentlyOnlineCount: mergedList.filter((d) => d.lastActive >= onlineThreshold).length,
          devices: mergedList.map((d) => ({
            ...d,
            isCurrentDevice: d.id === currentId,
            isOnline: d.lastActive >= onlineThreshold,
          })),
        };
      }
    }
  } catch (err) {
    console.error('Failed to fetch server telemetry stats:', err);
  }

  return getTelemetryStats();
}

export function getTelemetryStats() {
  const devices = getStoredDevices();
  const currentId = getDeviceId();
  const now = Date.now();

  // Active in current 24 hours
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const todayActiveDevices = devices.filter((d) => d.lastActive >= twentyFourHoursAgo);

  // Devices that passed password step
  const passedPasswordDevices = devices.filter((d) => d.passPassed);

  // Online right now (active within 2 minutes)
  const onlineThreshold = now - 2 * 60 * 1000;
  const currentlyOnlineDevices = devices.filter((d) => d.lastActive >= onlineThreshold);

  return {
    totalDevicesCount: devices.length,
    todayActiveCount: todayActiveDevices.length,
    passedPasswordCount: passedPasswordDevices.length,
    currentlyOnlineCount: currentlyOnlineDevices.length,
    devices: devices.map((d) => ({
      ...d,
      isCurrentDevice: d.id === currentId,
      isOnline: d.lastActive >= onlineThreshold,
    })),
  };
}
