import React, { useState } from 'react';
import { ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';
import { 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink, 
  Key, 
  Send, 
  X, 
  ArrowRight, 
  TrendingUp, 
  ShieldAlert,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface MproSignalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateDemo: () => void;
  onVerifyKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  isPro: boolean;
  accessMode: 'free' | 'demo' | 'pro';
  isEnabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  theme?: ChartThemeId;
}

export const MproSignalsModal: React.FC<MproSignalsModalProps> = ({
  isOpen,
  onClose,
  onActivateDemo,
  onVerifyKey,
  isPro,
  accessMode,
  isEnabled = true,
  onToggleEnabled,
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
    if (!accessKeyInput.trim()) {
      setErrorMsg('Please enter your Mpro Signals access key.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsVerifying(true);

    try {
      const res = await onVerifyKey(accessKeyInput.trim());
      if (res.success) {
        setSuccessMsg('✓ PRO ACCESS ACTIVE: Mpro Signals fully unlocked!');
        setTimeout(() => {
          onClose();
          setView('main');
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Invalid or expired access key.');
      }
    } catch {
      setErrorMsg('Invalid or expired access key.');
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
      ? `https://t.me/miihiretu?text=Hi%20Mihiretu,%20I%20want%20to%20unlock%20Mpro%20Signals%20PRO%20($20).%20My%20Telegram%20is%20${encodeURIComponent(telegramInput.trim())}`
      : 'https://t.me/miihiretu';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in ${
      isDark ? 'bg-black/80' : 'bg-slate-900/40'
    }`}>
      <div 
        id="mpro-signals-access-modal"
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-blue-500/20 to-purple-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Mpro Signals</h3>
                {isPro ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full font-mono">
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
              <p className="text-xs text-neutral-400 mt-0.5">Professional Market Structure & Signal Indicator</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {view === 'main' && (
            <div className="space-y-4">
              {/* Quick On / Off Master Visibility */}
              <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>
                    {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Mpro Signals</span>
                      <span className={`px-1.5 py-0.2 text-[9px] rounded font-mono font-bold ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400'}`}>
                        {isEnabled ? 'ON (VISIBLE)' : 'OFF (HIDDEN)'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-neutral-400">Master support/resistance classification visibility</p>
                  </div>
                </div>
                <button
                  id="btn-modal-toggle-mpro-enabled"
                  type="button"
                  onClick={() => onToggleEnabled?.(!isEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? 'bg-emerald-600' : 'bg-neutral-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Introduction Card */}
              <div className="p-4 bg-neutral-950/70 border border-neutral-850 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>PRO ACCESS SUITE</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Mpro Signals is an advanced technical signal and market structure system featuring dynamic support & resistance classification, extreme zone buy/sell triggers, and automated 1:1.5 Risk/Reward analysis.
                </p>

                <div className="p-2.5 bg-neutral-900/80 border border-amber-500/20 rounded-lg text-[11px] text-amber-200/90 flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">Demo vs PRO Mode:</span> Demo mode allows you to backtest on historical market data (older charts). Real-time live signals, dynamic zones, and forward market analysis for the latest 300+ candles require PRO access.
                  </div>
                </div>
                
                <div className="pt-2 border-t border-neutral-850 grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Extreme Zone Reversals</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>1:1.5 Risk/Reward Framework</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Multi-Timeframe Confluence</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Live Real-Time Execution</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {/* 1. TRY DEMO */}
                <button
                  id="btn-mpro-try-demo"
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
                        Backtest historical signals with interactive 1:1.5 R:R analysis
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 2. UNLOCK PRO — $20 */}
                <button
                  id="btn-mpro-unlock-pro"
                  onClick={() => setView('purchase')}
                  className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/40 rounded-xl text-left transition-all duration-150 shadow-lg shadow-emerald-950/40 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        UNLOCK PRO — $20
                      </div>
                      <div className="text-[11px] text-emerald-100/90">
                        Full real-time live signals & future market analysis
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-white/20 text-white rounded text-[11px] font-bold font-mono">
                    $20
                  </span>
                </button>

                {/* 3. I HAVE ACCESS */}
                <button
                  id="btn-mpro-have-access"
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
                        I HAVE ACCESS
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
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-950/50 via-neutral-950 to-neutral-950 border border-emerald-500/30 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Lifetime License</span>
                  <h4 className="text-base font-bold text-white">Mpro Signals PRO</h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-emerald-400 font-mono">$20</div>
                  <div className="text-[10px] text-neutral-400">One-time payment</div>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-850 space-y-2 text-xs">
                <div className="font-semibold text-neutral-300 text-[11px] uppercase tracking-wider mb-1">Includes:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Real-time Mpro Signals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Full indicator access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Live chart signals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Historical signals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Risk/Reward visualization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>1:1.5 default R:R</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>PRO updates & support</span>
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
                    id="input-mpro-telegram"
                    type="text"
                    placeholder="@username"
                    value={telegramInput}
                    onChange={(e) => setTelegramInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    id="btn-telegram-direct"
                    onClick={handleContactTelegram}
                    className="px-4 py-2 bg-[#229ED9] hover:bg-[#1e8ec3] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Order via Telegram</span>
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Contact <span className="text-emerald-400 font-mono">@miihiretu</span> on Telegram to receive your instant access key.
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
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors flex items-center gap-1"
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
                  <Key className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Enter Mpro Signals Access Key
                  </h4>
                </div>
                <p className="text-xs text-neutral-400">
                  Enter your unique access key provided upon purchase or authorization.
                </p>

                <input
                  id="input-mpro-access-key"
                  type="text"
                  placeholder="Enter your license key..."
                  value={accessKeyInput}
                  onChange={(e) => {
                    setAccessKeyInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />

                {errorMsg && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-800/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
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
                  id="btn-mpro-verify-key-submit"
                  type="submit"
                  disabled={isVerifying}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2"
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
