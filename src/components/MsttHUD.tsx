import React, { useState } from 'react';
import { MsttDashboard, MsttTradeStats } from '../utils/marketStructureTargetTracker';
import { ChartSettings } from '../types';
import { Minimize2, Maximize2, X, ArrowLeftRight, ListFilter, Activity, Trophy, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface MsttHUDProps {
  dashboard: MsttDashboard;
  stats?: MsttTradeStats;
  settings: ChartSettings;
  onUpdateSetting?: (key: string, value: any) => void;
  visible?: boolean;
  onClose?: () => void;
}

export const MsttHUD: React.FC<MsttHUDProps> = ({
  dashboard,
  stats,
  settings,
  onUpdateSetting,
  visible = true,
  onClose,
}) => {
  const currentHudSize = settings.indicators.msttHudSize ?? 'Small';
  const isSmall = currentHudSize === 'Small';
  const [showTradeLog, setShowTradeLog] = useState(true);
  const [hudPosition, setHudPosition] = useState<'left' | 'right'>(() => {
    try {
      const saved = localStorage.getItem('mstt_hud_position');
      if (saved === 'left' || saved === 'right') return saved;
      return (settings.indicators.msttHudPosition as 'left' | 'right') || 'right';
    } catch {
      return 'right';
    }
  });

  const handleTogglePosition = () => {
    const nextPos = hudPosition === 'right' ? 'left' : 'right';
    setHudPosition(nextPos);
    try {
      localStorage.setItem('mstt_hud_position', nextPos);
    } catch {}
    if (onUpdateSetting) {
      onUpdateSetting('msttHudPosition', nextPos);
    }
  };

  if (!visible || !dashboard) return null;

  const currentStats = stats || dashboard.stats || {
    totalTrades: 0,
    totalAllTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    consecWins: 0,
    consecLosses: 0,
    tp1Hits: 0,
    tp2Hits: 0,
    tp3Hits: 0,
    recentTrades: [],
  };

  const handleToggleSize = () => {
    const nextSize = isSmall ? 'Normal' : 'Small';
    if (onUpdateSetting) {
      onUpdateSetting('msttHudSize', nextSize);
    }
  };

  // Small / Compact Mini HUD Mode
  if (isSmall) {
    const winRateVal = currentStats.totalTrades > 0 ? currentStats.winRate : 0;
    const isGoodWr = winRateVal >= 50;

    return (
      <aside
        id="mstt-hud-mini"
        aria-label="MSTT Performance Mini HUD"
        className={`absolute top-12 ${
          hudPosition === 'left' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
        } z-20 w-72 max-w-[calc(100vw-1.5rem)] bg-[#13141f]/95 border border-[#c87d65]/70 rounded-xl shadow-[0_8px_32px_rgba(200,125,101,0.22)] backdrop-blur-md text-white select-none transition-all duration-200 overflow-hidden font-mono`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#191a27]/95 border-b border-[#c87d65]/30">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-gray-200 tracking-wide">MSTT PERF</span>
            <span className="text-[9px] font-extrabold text-[#26a69a] tracking-tight">
              [MINI]
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleTogglePosition}
              title={hudPosition === 'right' ? 'Move HUD to Left' : 'Move HUD to Right'}
              className="p-1 text-gray-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleSize}
              title="Expand to Full HUD"
              className="p-1 text-gray-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close HUD"
                className="p-1 text-gray-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Stats View (Left to Right rows, matching screenshot) */}
        <div className="p-2.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#1c1d2c]/80 border border-neutral-800/40">
            <span className="text-gray-400 text-[11px] font-medium tracking-tight">TOTAL TRADES:</span>
            <span className="font-bold text-gray-200 font-mono tracking-wide">{currentStats.totalTrades} TRADES</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#1c1d2c]/80 border border-neutral-800/40">
            <span className="text-gray-400 text-[11px] font-medium tracking-tight">WIN RATE:</span>
            <span className="font-bold font-mono text-amber-300 tracking-wide text-[11.5px]">
              {winRateVal.toFixed(1)}% WIN RATE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-600/50">
              <span className="text-emerald-400 text-[11px] uppercase font-bold tracking-tight">WINS:</span>
              <span className="font-black text-emerald-300 font-mono text-xs">{currentStats.wins}</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-950/50 border border-rose-800/50">
              <span className="text-rose-400 text-[11px] uppercase font-bold tracking-tight">LOSSES:</span>
              <span className="font-black text-rose-300 font-mono text-xs">{currentStats.losses}</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#1c1d2c]/80 border border-neutral-800/40 text-[11px]">
            <span className="text-gray-400 font-medium tracking-tight">Consec W/L:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {currentStats.consecWins}W · <span className="text-rose-400">{currentStats.consecLosses}L</span>
            </span>
          </div>

          {/* Deriv Multiplier Auto-Trading Status in Mini HUD */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#1c1d2c]/90 border border-neutral-800 text-[10.5px] mt-0.5">
            <span className="text-gray-300 flex items-center gap-1 font-semibold">
              <span className="text-amber-400">⚡</span> DERIV MULTIPLIER:
            </span>
            <button
              type="button"
              onClick={() => {
                const nextVal = !settings.indicators.derivAutoTradeEnabled;
                if (onUpdateSetting) onUpdateSetting('derivAutoTradeEnabled', nextVal);
                fetch('/api/cloud-alert-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    options: { derivAutoTradeEnabled: nextVal },
                  }),
                }).catch(() => {});
              }}
              title="Click to toggle Deriv Auto-Trading on/off"
              className={`px-2 py-0.5 rounded-full font-bold font-mono transition-colors text-[9.5px] flex items-center gap-1 ${
                settings.indicators.derivAutoTradeEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/50 hover:bg-rose-500/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${settings.indicators.derivAutoTradeEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {settings.indicators.derivAutoTradeEnabled ? 'ACTIVE' : 'PAUSED'}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Normal / Full Dashboard Mode
  const recentTrades = currentStats.recentTrades || [];

  return (
    <aside
      id="mstt-hud-full"
      aria-label="MSTT Full Performance and Trade Audit HUD"
      className={`absolute top-12 ${
        hudPosition === 'left' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
      } z-20 w-80 max-w-[calc(100vw-1rem)] bg-[#13141f]/95 border border-[#c87d65]/70 rounded-xl shadow-[0_8px_32px_rgba(200,125,101,0.22)] backdrop-blur-md text-white select-none transition-all duration-200 overflow-hidden font-mono`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#191a27]/95 border-b border-[#c87d65]/30">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-100">{dashboard.ticker || 'MSTT TRACKER'}</span>
            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-neutral-800 text-cyan-300 rounded border border-neutral-700">
              {dashboard.tag || 'BOS'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleTogglePosition}
            title={hudPosition === 'right' ? 'Move HUD to Left' : 'Move HUD to Right'}
            className="p-1 text-gray-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleSize}
            title="Switch to Compact Mini HUD (only Win Rate & Wins/Losses)"
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/80 rounded transition-colors"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Mini</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close HUD"
              className="p-1 text-gray-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Stats Table */}
      <div className="p-2 space-y-1 text-[11px] max-h-72 overflow-y-auto scrollbar-thin">
        {/* Trend & HTF Direction */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850">
            <span className="text-gray-400 text-[10px]">Trend</span>
            <span className="font-bold" style={{ color: dashboard.trendCol || '#34d399' }}>
              {dashboard.trendStr}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850">
            <span className="text-gray-400 text-[10px]">HTF Dir</span>
            <span className="font-bold" style={{ color: dashboard.htfDirCol || '#38bdf8' }}>
              {dashboard.htfStr}
            </span>
          </div>
        </div>

        {/* HTF RSI & Structure */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850">
            <span className="text-gray-400 text-[10px]">HTF RSI</span>
            <span className="font-bold" style={{ color: dashboard.htfBarCol || '#e2e8f0' }}>
              {dashboard.htfBarStr}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850">
            <span className="text-gray-400 text-[10px]">Structure</span>
            <span className="font-bold" style={{ color: dashboard.structCol || '#facc15' }}>
              {dashboard.structStr}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850 text-[10.5px]">
          <span className="text-gray-400 text-[10px]">Filters</span>
          <span className="font-semibold text-gray-200 truncate max-w-[170px]" title={dashboard.filterStr}>
            {dashboard.filterStr || 'OFF'}
          </span>
        </div>

        {/* BOS & Target */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850">
            <span className="text-gray-400 text-[10px]">BOS Lvl</span>
            <span className="font-bold text-amber-300">{dashboard.bosLvlStr}</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850">
            <span className="text-gray-400 text-[10px]">Target</span>
            <span className="font-bold text-amber-300">{dashboard.tgtLvlStr}</span>
          </div>
        </div>

        {/* Target Status */}
        <div className="flex items-center justify-between px-2 py-1 bg-neutral-900/80 rounded border border-neutral-850">
          <span className="text-gray-400 text-[10px]">Tgt Status</span>
          <span className="font-bold" style={{ color: dashboard.tgtHitCol || '#a78bfa' }}>
            {dashboard.tgtHitStr}
          </span>
        </div>

        {/* Entry / SL / TP Levels */}
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="p-1 bg-neutral-900/90 rounded border border-neutral-850 text-center">
            <span className="text-sky-400 block font-bold">► Entry</span>
            <span className="font-mono text-gray-200">{dashboard.entryStr}</span>
          </div>
          {dashboard.showSl && (
            <div className="p-1 bg-neutral-900/90 rounded border border-neutral-850 text-center">
              <span className="text-rose-400 block font-bold">✕ SL</span>
              <span className="font-mono text-gray-200">{dashboard.slStr}</span>
            </div>
          )}
          {dashboard.showTp1 && (
            <div className="p-1 bg-neutral-900/90 rounded border border-neutral-850 text-center">
              <span className="text-emerald-400 block font-bold">● TP1</span>
              <span className="font-mono text-gray-200">{dashboard.tp1Str}</span>
            </div>
          )}
          {dashboard.showTp2 && (
            <div className="p-1 bg-neutral-900/90 rounded border border-neutral-850 text-center">
              <span className="text-teal-400 block font-bold">★ TP2</span>
              <span className="font-mono text-gray-200">{dashboard.tp2Str}</span>
            </div>
          )}
        </div>

        {/* Performance Scorecard */}
        <div className="mt-1 pt-1 border-t border-neutral-800">
          <div className="flex items-center justify-between px-2 py-1 bg-sky-950/40 border border-sky-800/40 rounded">
            <span className="text-sky-300 font-bold text-[10.5px]">PERF (LAST {dashboard.keepN})</span>
            <span className="text-sky-300 font-bold font-mono">{dashboard.totalTradesStr}</span>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-1 text-[10.5px]">
            <div className="p-1 bg-neutral-900/90 rounded border border-neutral-850 text-center">
              <span className="text-gray-400 block text-[9.5px]">Win / Loss</span>
              <span className="font-bold text-emerald-400">{dashboard.winLossStr}</span>
            </div>
            <div className="p-1 bg-neutral-900/90 rounded border border-neutral-850 text-center">
              <span className="text-gray-400 block text-[9.5px]">Win Rate</span>
              <span className="font-bold" style={{ color: dashboard.winRateCol || '#34d399' }}>
                {dashboard.winRateStr}
              </span>
            </div>
            <div className="p-1 bg-neutral-900/90 rounded border border-neutral-850 text-center">
              <span className="text-gray-400 block text-[9.5px]">Consec W/L</span>
              <span className="font-bold text-gray-200">{dashboard.consecStr}</span>
            </div>
          </div>

          {/* Deriv Multiplier Auto-Trading Status & Toggle */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-neutral-900/90 border border-neutral-800 rounded mt-1 text-[10.5px]">
            <div className="flex items-center gap-1.5 font-semibold text-gray-300">
              <span>⚡</span>
              <span>Deriv {(settings.indicators.derivMode || 'demo').toUpperCase()}:</span>
              <span className="text-[9.5px] font-mono text-cyan-400">
                ({settings.indicators.derivMultiplier ?? 200}x · ${settings.indicators.derivStake ?? 2})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextVal = !settings.indicators.derivAutoTradeEnabled;
                if (onUpdateSetting) onUpdateSetting('derivAutoTradeEnabled', nextVal);
                fetch('/api/cloud-alert-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    options: { derivAutoTradeEnabled: nextVal },
                  }),
                }).catch(() => {});
              }}
              title="Click to toggle Deriv Auto-Trading on/off"
              className={`px-2 py-0.5 rounded font-bold font-mono transition-colors text-[10px] ${
                settings.indicators.derivAutoTradeEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/50 hover:bg-rose-500/30'
              }`}
            >
              {settings.indicators.derivAutoTradeEnabled ? '🟢 ACTIVE' : '🔴 PAUSED'}
            </button>
          </div>

          {/* Quick Demo Signal Trigger */}
          <div className="flex items-center justify-between pt-1 mt-1 border-t border-neutral-800/60 text-[10px]">
            <span className="text-gray-400 font-semibold flex items-center gap-1">
              <span>🧪</span> Demo Signal:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  fetch('/api/demo-signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'BUY',
                      symbol: settings.indicators.msttTgSymbol || 'R_75',
                      tf: settings.indicators.msttTgTimeframe || '30M',
                      slPips: Number(settings.indicators.msttPointsSl ?? settings.indicators.pointsSl ?? settings.indicators.tpPipsSl ?? 220),
                      tp1Pips: Number(settings.indicators.msttPointsTp1 ?? settings.indicators.pointsTp1 ?? settings.indicators.tpPipsTp1 ?? 450),
                      botToken: (settings.indicators.msttTgBotToken || '').trim(),
                      chatId: (settings.indicators.msttTgChatId || '').trim(),
                      stake: settings.indicators.derivStake ?? 2.0,
                      multiplier: settings.indicators.derivMultiplier ?? 200,
                      takeProfitUsd: settings.indicators.derivTakeProfitUsd ?? 6.68,
                      stopLossUsd: settings.indicators.derivStopLossUsd ?? 2.0,
                    }),
                  }).catch(() => {});
                }}
                className="px-1.5 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold font-mono transition-colors"
                title="Send simulated BUY signal to Telegram and Deriv Demo"
              >
                + BUY
              </button>
              <button
                type="button"
                onClick={() => {
                  fetch('/api/demo-signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'SELL',
                      symbol: settings.indicators.msttTgSymbol || 'R_75',
                      tf: settings.indicators.msttTgTimeframe || '30M',
                      slPips: Number(settings.indicators.msttPointsSl ?? settings.indicators.pointsSl ?? settings.indicators.tpPipsSl ?? 220),
                      tp1Pips: Number(settings.indicators.msttPointsTp1 ?? settings.indicators.pointsTp1 ?? settings.indicators.tpPipsTp1 ?? 450),
                      botToken: (settings.indicators.msttTgBotToken || '').trim(),
                      chatId: (settings.indicators.msttTgChatId || '').trim(),
                      stake: settings.indicators.derivStake ?? 2.0,
                      multiplier: settings.indicators.derivMultiplier ?? 200,
                      takeProfitUsd: settings.indicators.derivTakeProfitUsd ?? 6.68,
                      stopLossUsd: settings.indicators.derivStopLossUsd ?? 2.0,
                    }),
                  }).catch(() => {});
                }}
                className="px-1.5 py-0.5 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-[9.5px] font-bold font-mono transition-colors"
                title="Send simulated SELL signal to Telegram and Deriv Demo"
              >
                - SELL
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TRADE AUDIT LOG (SCROLLABLE DOWNWARD) */}
      {recentTrades.length > 0 && (
        <div className="border-t border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={() => setShowTradeLog(!showTradeLog)}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-neutral-900/90 hover:bg-neutral-850 transition-colors text-[11px] font-bold text-amber-300"
          >
            <div className="flex items-center gap-1.5">
              <span>📋</span>
              <span>TRADE LOG (LAST {Math.min(recentTrades.length, dashboard.keepN || 10)})</span>
            </div>
            <span className="text-[10px] text-gray-400">
              {showTradeLog ? '▴ Collapse' : '▾ Scroll Down & View'}
            </span>
          </button>

          {showTradeLog && (
            <div className="p-2 space-y-1 max-h-56 overflow-y-auto scrollbar-thin touch-pan-y">
              <div className="text-[9px] text-gray-500 uppercase flex items-center justify-between px-1.5 pb-0.5 border-b border-neutral-850">
                <span># / Direction</span>
                <span>Outcome</span>
              </div>

              {recentTrades.map((tr, i) => {
                const isBull = tr.dir === 'BULL';
                const outcomeText = tr.isWin
                  ? `✓ WIN (${tr.exitReason.includes('TP3') ? 'TP3' : tr.exitReason.includes('TP2') ? 'TP2' : 'TP1'})`
                  : '✕ LOSS';
                const outcomeCol = tr.isWin ? 'text-emerald-400' : 'text-rose-400';
                const bgTint = tr.isWin ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-rose-950/20 border-rose-900/40';

                return (
                  <div
                    key={tr.id ?? i}
                    className={`flex items-center justify-between px-2 py-1 rounded border ${bgTint} text-[10px] font-mono`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 text-[9px]">#{i + 1}</span>
                      <span className={`font-bold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isBull ? '▲ BULL' : '▼ BEAR'}
                      </span>
                      <span className="text-[9px] text-gray-400">@{tr.entryPrice.toFixed(1)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {tr.pipsText && (
                        <span className="text-[9px] text-gray-400">{tr.pipsText}</span>
                      )}
                      <span className={`font-bold ${outcomeCol}`}>
                        {outcomeText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
