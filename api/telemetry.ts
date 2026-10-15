import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { verifyToken } from './_auth';

export interface DeviceRecordServer {
  id: string;
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
}

const FILE_PATH = path.join(process.cwd(), '.device_telemetry_db.json');

// In-memory devices cache
let devicesStore: Map<string, DeviceRecordServer> = new Map();

// Load initially from file if exists
try {
  if (fs.existsSync(FILE_PATH)) {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const parsed: DeviceRecordServer[] = JSON.parse(raw);
    parsed.forEach((d) => devicesStore.set(d.id, d));
  }
} catch (e) {
  console.error('Failed to load device telemetry file:', e);
}

function saveStoreToFile() {
  try {
    const arr = Array.from(devicesStore.values());
    fs.writeFileSync(FILE_PATH, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error('Failed to write device telemetry file:', e);
  }
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkUserPassedAuthCookie(req: Request): boolean {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (verifyToken(token)) return true;
    }

    const xToken = req.headers['x-site-auth-token'];
    if (typeof xToken === 'string' && verifyToken(xToken)) {
      return true;
    }

    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return false;
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['mihiretu_auth_token'];
    return verifyToken(token);
  } catch {
    return false;
  }
}

export function handleHeartbeat(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const devId = body.id;
    if (!devId) {
      return res.status(400).json({ error: 'Missing device id' });
    }

    const ip = extractIp(req);
    const now = Date.now();
    const hasAuthCookie = checkUserPassedAuthCookie(req);

    const existing = devicesStore.get(devId);
    const isPassPassed = Boolean(body.passPassed || hasAuthCookie || existing?.passPassed);

    const updatedRecord: DeviceRecordServer = {
      id: devId,
      deviceCategory: body.deviceCategory || 'Desktop',
      deviceName: body.deviceName || 'Web Device',
      os: body.os || 'Unknown OS',
      browser: body.browser || 'Browser',
      ip: ip || existing?.ip || '127.0.0.1',
      location: body.location || existing?.location,
      screenResolution: body.screenResolution || '1920x1080',
      language: body.language || 'en-US',
      userAgent: body.userAgent || req.headers['user-agent'] || '',
      firstSeen: existing ? existing.firstSeen : now,
      lastActive: now,
      passPassed: isPassPassed,
    };

    devicesStore.set(devId, updatedRecord);
    saveStoreToFile();

    return res.json({ success: true, record: updatedRecord });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export function handleGetDevices(req: Request, res: Response) {
  try {
    const devices = Array.from(devicesStore.values());
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const onlineThreshold = now - 2 * 60 * 1000; // 2 mins

    const todayActive = devices.filter((d) => d.lastActive >= twentyFourHoursAgo);
    const passedPassword = devices.filter((d) => d.passPassed);
    const onlineNow = devices.filter((d) => d.lastActive >= onlineThreshold);

    return res.json({
      totalDevicesCount: devices.length,
      todayActiveCount: todayActive.length,
      passedPasswordCount: passedPassword.length,
      currentlyOnlineCount: onlineNow.length,
      devices: devices.sort((a, b) => b.lastActive - a.lastActive),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
