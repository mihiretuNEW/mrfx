import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Activity, 
  Users, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Globe, 
  LogOut, 
  Search,
  ShieldAlert,
  Wifi
} from 'lucide-react';
import { 
  getTelemetryStats, 
  fetchServerTelemetryStats,
  markCurrentDevicePasswordPassed, 
  registerOrUpdateCurrentDevice, 
  DeviceRecord 
} from '../utils/deviceTracker';

export const AdminPanel: React.FC = () => {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('mihiretu_admin_session_unlocked') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState(getTelemetryStats());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'PASSED' | 'TODAY' | 'ONLINE'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize and periodically refresh telemetry from server
  useEffect(() => {
    const refreshData = async () => {
      await registerOrUpdateCurrentDevice();
      const updated = await fetchServerTelemetryStats();
      if (updated) setStats(updated);
    };

    refreshData();
    const interval = setInterval(refreshData, 3000); // Poll server every 3 seconds for real-time live devices

    const handleStorageChange = async () => {
      const updated = await fetchServerTelemetryStats();
      if (updated) setStats(updated);
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const targetPass = "Mihiretu@0962862284";
    const cleanedInput = passwordInput.trim();

    // Check if entered password matches exact string or trimmed
    if (cleanedInput === targetPass || passwordInput === " Mihiretu@0962862284 " || passwordInput === targetPass) {
      setIsAdminUnlocked(true);
      localStorage.setItem('mihiretu_admin_session_unlocked', 'true');
      const updated = await fetchServerTelemetryStats();
      if (updated) setStats(updated);
    } else {
      setErrorMsg('Incorrect Password! Access Denied.');
    }
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    localStorage.removeItem('mihiretu_admin_session_unlocked');
    setPasswordInput('');
    setErrorMsg('');
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await registerOrUpdateCurrentDevice();
    const updated = await fetchServerTelemetryStats();
    if (updated) setStats(updated);
    setIsRefreshing(false);
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    return `${diffDays}d ago`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Filter devices list
  const filteredDevices = stats.devices.filter((dev) => {
    const matchesSearch = 
      dev.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.os.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.browser.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dev.location && dev.location.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterCategory === 'PASSED') return dev.passPassed;
    if (filterCategory === 'TODAY') return Date.now() - dev.lastActive < 24 * 60 * 60 * 1000;
    if (filterCategory === 'ONLINE') return dev.isOnline;

    return true;
  });

  // Render Password Gate if locked
  if (!isAdminUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 space-y-6 text-center select-none">
        <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-950/20">
          <ShieldCheck className="w-8 h-8 text-amber-400" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">System Admin Panel</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm">
            Enter the authorized administrator password to unlock real-time device telemetry & user session diagnostics.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Admin Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="w-4 h-4 text-neutral-500" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password..."
                className="w-full pl-9 pr-10 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 rounded-xl outline-none text-sm font-mono text-white placeholder-neutral-600 transition-all"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold text-xs rounded-xl shadow-lg shadow-amber-950/40 transition-all uppercase tracking-wider"
          >
            Authenticate & Unlock
          </button>
        </form>
      </div>
    );
  }

  // Render Admin Dashboard when authenticated
  return (
    <div className="space-y-5 text-neutral-200">
      {/* Top Banner & Control Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-neutral-900/80 border border-neutral-800 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block animate-ping absolute inset-0" />
            <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block relative" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Real-Time Device Telemetry</span>
              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-mono rounded font-semibold border border-emerald-500/30">
                LIVE
              </span>
            </div>
            <div className="text-[11px] text-neutral-400">
              Tracking real sessions, device types & password verification states
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh device state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleLockAdmin}
            className="px-2.5 py-1.5 bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Lock Panel
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Total Devices */}
        <div 
          onClick={() => setFilterCategory('ALL')}
          className={`p-3 bg-neutral-900 border rounded-xl cursor-pointer transition-all ${
            filterCategory === 'ALL' ? 'border-blue-500/70 bg-blue-950/20' : 'border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">{stats.totalDevicesCount}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">All recorded devices</div>
        </div>

        {/* Metric 2: Today Active Users (24h) */}
        <div 
          onClick={() => setFilterCategory('TODAY')}
          className={`p-3 bg-neutral-900 border rounded-xl cursor-pointer transition-all ${
            filterCategory === 'TODAY' ? 'border-amber-500/70 bg-amber-950/20' : 'border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Today</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-400 font-mono">{stats.todayActiveCount}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Opened in last 24h</div>
        </div>

        {/* Metric 3: Passed Site Login Password */}
        <div 
          onClick={() => setFilterCategory('PASSED')}
          className={`p-3 bg-neutral-900 border rounded-xl cursor-pointer transition-all ${
            filterCategory === 'PASSED' ? 'border-emerald-500/70 bg-emerald-950/20' : 'border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Passed Site Login</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono">{stats.passedPasswordCount}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Logged-in site users</div>
        </div>

        {/* Metric 4: Currently Online */}
        <div 
          onClick={() => setFilterCategory('ONLINE')}
          className={`p-3 bg-neutral-900 border rounded-xl cursor-pointer transition-all ${
            filterCategory === 'ONLINE' ? 'border-indigo-500/70 bg-indigo-950/20' : 'border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Online Now</span>
            <Wifi className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-extrabold text-indigo-400 font-mono">{stats.currentlyOnlineCount}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Active in last 2m</div>
        </div>
      </div>

      {/* Filter Tabs & Search input */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterCategory === 'ALL' ? 'bg-neutral-800 text-white border border-neutral-700' : 'text-neutral-400 hover:text-white'
            }`}
          >
            All Devices ({stats.totalDevicesCount})
          </button>
          <button
            onClick={() => setFilterCategory('PASSED')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterCategory === 'PASSED' ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/60' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Passed Site Login ({stats.passedPasswordCount})
          </button>
          <button
            onClick={() => setFilterCategory('TODAY')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterCategory === 'TODAY' ? 'bg-amber-950/50 text-amber-300 border border-amber-800/60' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Active Today ({stats.todayActiveCount})
          </button>
          <button
            onClick={() => setFilterCategory('ONLINE')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filterCategory === 'ONLINE' ? 'bg-indigo-950/50 text-indigo-300 border border-indigo-800/60' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Online Now ({stats.currentlyOnlineCount})
          </button>
        </div>

        <div className="relative w-full sm:w-48">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search OS, IP, device..."
            className="w-full pl-8 pr-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>

      {/* Device List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
        {filteredDevices.length === 0 ? (
          <div className="p-8 text-center bg-neutral-950/40 rounded-xl border border-neutral-900 text-neutral-500 text-xs">
            No device records match your criteria.
          </div>
        ) : (
          filteredDevices.map((dev) => (
            <div
              key={dev.id}
              className={`p-3 bg-neutral-900/90 border rounded-xl transition-all space-y-2 ${
                dev.isCurrentDevice
                  ? 'border-amber-500/50 shadow-sm shadow-amber-950/20 bg-neutral-900'
                  : 'border-neutral-800/80 hover:border-neutral-700'
              }`}
            >
              {/* Row 1: Header - Device Name, Status Badges */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-amber-400 shrink-0">
                    {dev.deviceCategory === 'Mobile' ? (
                      <Smartphone className="w-4 h-4" />
                    ) : dev.deviceCategory === 'Tablet' ? (
                      <Tablet className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{dev.deviceName}</span>
                      {dev.isCurrentDevice && (
                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] font-semibold uppercase rounded border border-amber-500/40">
                          THIS DEVICE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono">
                      {dev.os} • {dev.browser}
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2">
                  {/* Password Verification Badge */}
                  {dev.passPassed ? (
                    <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Passed Site Login
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded-full text-[10px] font-medium">
                      Pending Site Login
                    </span>
                  )}

                  {/* Online / Offline Indicator */}
                  {dev.isOnline ? (
                    <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded-full text-[10px] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full text-[10px]">
                      Offline
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Detailed Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-neutral-800/60 text-[11px]">
                <div>
                  <span className="text-neutral-500 text-[10px] block uppercase">Network IP</span>
                  <span className="font-mono text-neutral-200 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-neutral-500" />
                    {dev.ip}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 text-[10px] block uppercase">Location / Specs</span>
                  <span className="text-neutral-300 truncate block">
                    {dev.location ? dev.location : dev.screenResolution}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 text-[10px] block uppercase">First Seen</span>
                  <span className="text-neutral-300 block font-mono">
                    {formatDate(dev.firstSeen)}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 text-[10px] block uppercase">Last Active</span>
                  <span className="text-amber-300/90 font-semibold block font-mono">
                    {formatRelativeTime(dev.lastActive)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
