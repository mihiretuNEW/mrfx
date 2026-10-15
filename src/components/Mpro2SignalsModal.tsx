import React, { useState } from 'react';
import { ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';
import { 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  CheckCircle2, 
  Key, 
  Send, 
  X, 
  ArrowRight, 
  TrendingUp, 
  ShieldAlert,
  HelpCircle,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';

interface Mpro2SignalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateDemo: () => void;
  onVerifyKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  isPro: boolean;
  accessMode: 'free' | 'demo' | 'pro';
  isEnabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  showCenterLine?: boolean;
  onToggleCenterLine?: (show: boolean) => void;
  displayMode?: 'lines' | 'shadow' | 'both';
  onChangeDisplayMode?: (mode: 'lines' | 'shadow' | 'both') => void;
  theme?: ChartThemeId;
}

export const Mpro2SignalsModal: React.FC<Mpro2SignalsModalProps> = ({
  isOpen,
  onClose,
  onActivateDemo,
  onVerifyKey,
  isPro,
  accessMode,
  isEnabled = true,
  onToggleEnabled,
  showCenterLine = true,
  onToggleCenterLine,
  displayMode = 'lines',
  onChangeDisplayMode,
  theme,
}) => {
  const isDark = isDarkTheme(theme);
  const preset = getThemePreset(theme);
  const DEFAULT_PRO_CODE = 'Mcharts-Mihiretu-Jump10-2019';
  const [view, setView] = useState<'main' | 'purchase' | 'key'>('main');
  const [accessKeyInput, setAccessKeyInput] = useState(DEFAULT_PRO_CODE);
  const [telegramInput, setTelegramInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleVerifyKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = accessKeyInput.trim();
    if (!cleanKey) {
      setErrorMsg('Please enter your license key.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsVerifying(true);

    try {
      const res = await onVerifyKey(cleanKey);
      if (res.success) {
        setSuccessMsg('✓ PRO ACCESS ACTIVE: Mpro2 Signal fully unlocked!');
        setTimeout(() => {
          onClose();
          setView('main');
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Invalid or unauthorized license key.');
      }
    } catch {
      setErrorMsg('Invalid or expired license key.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTryDemo = () => {
    onActivateDemo();
    onClose();
  };

  const handleContactTelegram = () => {
    const url = telegramInput.trim() 
      ? `https://t.me/miihiretu?text=Hi%20Mihiretu,%20I%20want%20to%20unlock%20Mpro2%20Signal%20PRO%20($20).%20My%20Telegram%20is%20${encodeURIComponent(telegramInput.trim())}`
      : 'https://t.me/miihiretu';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in ${
      isDark ? 'bg-black/80' : 'bg-slate-900/40'
    }`}>
      <div 
        id="mpro2-signals-access-modal"
        className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative select-none border transition-colors ${
          isDark 
            ? 'bg-neutral-900 border-neutral-800 text-neutral-100' 
            : 'bg-white border-neutral-200 text-slate-900'
        }`}
        style={{
          backgroundColor: isDark ? preset.surfaceColor || '#171717' : '#ffffff',
          borderColor: isDark ? preset.borderColor : '#e2e8f0',
          color: isDark ? preset.textColor : '#0f172a',
        }}
      >
        {/* Header */}
        <div className={`relative px-6 pt-6 pb-4 border-b ${
          isDark ? 'border-neutral-800/80 bg-neutral-900' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <button
            onClick={onClose}
            className={`absolute top-5 right-5 p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-slate-400 hover:text-slate-900 hover:bg-neutral-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-amber-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Mpro2 Signal</h3>
                {isPro ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full font-mono">
                    PRO ACTIVE ✓
                  </span>
                ) : accessMode === 'demo' ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-mono">
                    DEMO MODE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full font-mono">
                    PRO REQUIRED
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">Macro Reversal Signals &amp; Key Levels</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {view === 'main' && (
            <div className="space-y-4">
              {/* Quick On / Off Master Visibility & Center Line Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Master Indicator ON / OFF */}
                <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>
                      {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Mpro2 Signals</span>
                        <span className={`px-1.5 py-0.2 text-[9px] rounded font-mono font-bold ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400'}`}>
                          {isEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-neutral-400">Master chart visibility</p>
                    </div>
                  </div>
                  <button
                    id="btn-modal-toggle-mpro2-enabled"
                    type="button"
                    onClick={() => onToggleEnabled?.(!isEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-blue-600' : 'bg-neutral-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Center White Line (0.500 Midpoint) ON / OFF */}
                <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${showCenterLine ? 'bg-blue-500/10 text-white border border-blue-500/20' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>
                      0.5
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Center Line (0.500)</span>
                        <span className={`px-1.5 py-0.2 text-[9px] rounded font-mono font-bold ${showCenterLine ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-neutral-800 text-neutral-400'}`}>
                          {showCenterLine ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-neutral-400">Midpoint equilibrium line</p>
                    </div>
                  </div>
                  <button
                    id="btn-modal-toggle-mpro2-center-line"
                    type="button"
                    onClick={() => onToggleCenterLine?.(!showCenterLine)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showCenterLine ? 'bg-blue-600' : 'bg-neutral-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        showCenterLine ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 3. Visual Mode: Lines vs Rectangle Shadow */}
                <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-center justify-between sm:col-span-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      ▢
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Visual Mode (አቀራረብ)</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold">
                          {displayMode === 'shadow' ? 'Rectangle Shadow' : displayMode === 'both' ? 'Both (Lines + Shadow)' : 'Crisp Lines'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-neutral-400">Switch Mpro2 between sharp lines and soft Rectangle Shadow zones</p>
                    </div>
                  </div>
                  <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[11px] font-medium">
                    <button
                      id="btn-mpro2-mode-lines"
                      type="button"
                      onClick={() => onChangeDisplayMode?.('lines')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${displayMode === 'lines' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Lines
                    </button>
                    <button
                      id="btn-mpro2-mode-shadow"
                      type="button"
                      onClick={() => onChangeDisplayMode?.('shadow')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${displayMode === 'shadow' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Shadow
                    </button>
                    <button
                      id="btn-mpro2-mode-both"
                      type="button"
                      onClick={() => onChangeDisplayMode?.('both')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${displayMode === 'both' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Both
                    </button>
                  </div>
                </div>
              </div>

              {/* Introduction Card */}
              <div className="p-4 bg-neutral-950/70 border border-neutral-850 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>PRO ACCESS</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Mpro2 Signal is a high-accuracy technical suite featuring All-Chart macro swings, Golden Pocket zones (0.618 - 0.65), multi-swing confluences, and live support/resistance touch buy/sell triggers.
                </p>

                <div className="p-2.5 bg-neutral-900/80 border border-amber-500/20 rounded-lg text-[11px] text-amber-200/90 flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">Demo vs PRO Mode:</span> Demo mode allows you to explore levels and test historical signals on past charts (last 300+ candles are locked). Real-time live market signals and instant touch triggers on current candles require PRO activation.
                  </div>
                </div>
                
                <div className="pt-2 border-t border-neutral-850 grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>All-Chart Macro Anchors</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Golden Pocket (0.618-0.65)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Multi-Swing Confluence</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Instant Touch Buy/Sell</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {/* 1. TRY DEMO */}
                <button
                  id="btn-mpro2-try-demo"
                  onClick={handleTryDemo}
                  className="w-full flex items-center justify-between p-3.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 rounded-xl text-left transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        ACTIVATE DEMO (PAST CHARTS ONLY)
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Explore Fibonacci levels and test historical signals
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 2. UNLOCK PRO — $20 */}
                <button
                  id="btn-mpro2-unlock-pro"
                  onClick={() => setView('purchase')}
                  className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/40 rounded-xl text-left transition-all duration-150 shadow-lg shadow-blue-950/40 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        UNLOCK PRO — $20
                      </div>
                      <div className="text-[11px] text-blue-100/90">
                        Full real-time live signals &amp; macro confluence
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-white/20 text-white rounded text-[11px] font-bold font-mono">
                    $20
                  </span>
                </button>

                {/* 3. I HAVE ACCESS */}
                <button
                  id="btn-mpro2-have-access"
                  onClick={() => {
                    setView('key');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-left transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-neutral-300 group-hover:text-white transition-colors">
                        I HAVE ACCESS KEY
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Enter your existing license key to activate
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* View 2: Purchase & Unlock Screen */}
          {view === 'purchase' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-950/50 via-neutral-950 to-neutral-950 border border-blue-500/30 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider">Lifetime License</span>
                  <h4 className="text-base font-bold text-white">Mpro2 Signal PRO</h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-blue-400 font-mono">$20</div>
                  <div className="text-[10px] text-neutral-400">One-time payment</div>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-850 space-y-2 text-xs">
                <div className="font-semibold text-neutral-300 text-[11px] uppercase tracking-wider mb-1">Includes:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Real-time Mpro2 Signals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>All Chart Macro High/Low</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Golden Pocket Zone (0.618-0.65)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Multi-Swing Confluence (★)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Instant Support/Resistance Alerts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Status HUD Table &amp; Time Zones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>PRO Updates &amp; Key Activation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Instant License Key Delivery</span>
                  </div>
                </div>
              </div>

              {/* Telegram Username Input & Direct Order */}
              <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-850 space-y-2.5">
                <label className="block text-[11px] font-medium text-neutral-400">
                  Telegram Username (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="input-mpro2-telegram"
                    type="text"
                    placeholder="@username"
                    value={telegramInput}
                    onChange={(e) => setTelegramInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    id="btn-telegram-direct-mpro2"
                    onClick={handleContactTelegram}
                    className="px-4 py-2 bg-[#229ED9] hover:bg-[#1e8ec3] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Order via Telegram</span>
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Contact <span className="text-blue-400 font-mono">@miihiretu</span> on Telegram to receive your instant access key.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setView('main')}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  ← Back to options
                </button>
                <button
                  onClick={() => setView('key')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
                >
                  <Key className="w-3 h-3" />
                  <span>Already got a key? Enter Key</span>
                </button>
              </div>
            </div>
          )}

          {/* View 3: Enter Access Key */}
          {view === 'key' && (
            <form onSubmit={handleVerifyKey} className="space-y-4 animate-fade-in">
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-850 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Enter Mpro2 Signal Key
                  </h4>
                </div>
                <p className="text-xs text-neutral-400">
                  Enter your unique access key provided upon purchase or authorization.
                </p>

                <input
                  id="input-mpro2-access-key"
                  type="text"
                  placeholder="Enter your license key..."
                  value={accessKeyInput}
                  onChange={(e) => {
                    setAccessKeyInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                  autoFocus
                />

                {errorMsg && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-800/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-blue-950/40 border border-blue-800/40 rounded-lg text-xs text-blue-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setView('main')}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>
                <button
                  id="btn-mpro2-verify-key-submit"
                  type="submit"
                  disabled={isVerifying}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-950/50 flex items-center gap-2"
                >
                  {isVerifying ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <span>VERIFY ACCESS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
