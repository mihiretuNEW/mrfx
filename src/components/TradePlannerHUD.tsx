/**
 * Trade Planner Buy Sell Signals, Stop Loss, TP & Lot Size [LunqFX]
 * Interactive Floating Table HUD
 * 100% exact styling and palette of TradingView Pine Script v6 by LunqFX
 */

import React, { useState } from 'react';
import { TradePlannerHud, RecentTradeAudit, LUNQ_PALETTE } from '../utils/tradePlannerLunqFX';
import { ChevronDown, ChevronUp, X, Crosshair } from 'lucide-react';

interface TradePlannerHUDProps {
  hud: TradePlannerHud | null;
  visible?: boolean;
  position?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left' | 'Middle Right';
  size?: 'Small' | 'Normal' | 'Large';
  onClose?: () => void;
  onSelectTrade?: (trade: RecentTradeAudit) => void;
  selectedTradeId?: number | null;
}

export const TradePlannerHUD: React.FC<TradePlannerHUDProps> = ({
  hud,
  visible = true,
  position = 'Top Right',
  size = 'Normal',
  onClose,
  onSelectTrade,
  selectedTradeId,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  if (!visible || !hud) return null;

  // Determine positioning classes
  let posClasses = 'top-12 right-16';
  switch (position) {
    case 'Top Left':
      posClasses = 'top-12 left-4';
      break;
    case 'Bottom Right':
      posClasses = 'bottom-8 right-16';
      break;
    case 'Bottom Left':
      posClasses = 'bottom-8 left-4';
      break;
    case 'Middle Right':
      posClasses = 'top-1/2 -translate-y-1/2 right-16';
      break;
    case 'Top Right':
    default:
      posClasses = 'top-12 right-16';
      break;
  }

  // Size scaling
  const textScale = size === 'Small' ? 'text-[10px]' : size === 'Large' ? 'text-xs' : 'text-[11px]';
  const headerScale = size === 'Small' ? 'text-xs' : size === 'Large' ? 'text-sm' : 'text-xs';
  const widthClass = size === 'Small' ? 'w-64' : size === 'Large' ? 'w-80' : 'w-72';

  return (
    <div
      id="trade-planner-hud"
      className={`absolute ${posClasses} z-20 ${widthClass} border rounded-lg shadow-2xl backdrop-blur-md select-none transition-all duration-150 overflow-hidden font-mono`}
      style={{
        backgroundColor: LUNQ_PALETTE.CARD,
        borderColor: '#263346',
        color: LUNQ_PALETTE.TXT,
      }}
    >
      {/* Top Header Row (bgcolor = HEAD #0E141D, text_color = GOLD #FFD250) */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ backgroundColor: LUNQ_PALETTE.HEAD, borderColor: '#263346' }}
      >
        <div className="flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5" style={{ color: LUNQ_PALETTE.GOLD }} />
          <span className={`font-bold tracking-wider ${headerScale}`} style={{ color: LUNQ_PALETTE.GOLD }}>
            {hud.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold" style={{ color: LUNQ_PALETTE.MUTE }}>
            {hud.riskPctText}
          </span>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-0.5 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-0.5 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
              title="Close Trade Planner Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status Banner Row (hTx, bgcolor = hBg, text_color = TXT) */}
      <div
        className="px-3 py-1.5 flex items-center justify-between border-b text-xs font-semibold"
        style={{
          backgroundColor: hud.statusBg,
          borderColor: '#263346',
          color: LUNQ_PALETTE.TXT,
        }}
      >
        <span className="truncate">{hud.statusText}</span>
        {hud.active && (
          <span className="font-bold text-xs" style={{ color: hud.nowCol }}>
            {hud.nowStr}
          </span>
        )}
      </div>

      {/* Metric Rows */}
      {!isMinimized && (
        <div className={`p-2.5 space-y-1 ${textScale}`}>
          {/* Performance Scorecard (KeepN Trades Analytics) */}
          {hud.stats && hud.stats.totalTrades > 0 && (
            <div className="mb-2 p-2 rounded border border-cyan-500/30 bg-neutral-950/70 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold pb-1 border-b border-neutral-800">
                <span className="text-cyan-300 flex items-center gap-1">
                  <span>📊</span> TRACK RECORD ({hud.stats.totalTrades} TRADES)
                </span>
                <span className="text-amber-400 font-mono text-[9.5px]">
                  TARGET: {hud.stats.targetName}
                  {!hud.stats.targetName.includes('$') && !hud.stats.targetName.includes('pips')
                    ? ` (${hud.stats.targetR.toFixed(1)}R)`
                    : ''}{' '}
                  · SL: {hud.slSizeStr || (hud.stats.slSize ? `${hud.stats.slSize.toFixed(1)}x` : '1.0x')}
                </span>
              </div>

              {/* 3 Key Scorecard Cards */}
              <div className="grid grid-cols-3 gap-1 text-center font-mono pt-0.5">
                <div className="p-1 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="text-[9px] text-gray-400 uppercase">Win Rate</div>
                  <div
                    className={`font-bold text-xs ${
                      hud.stats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {hud.stats.winRate.toFixed(1)}%
                  </div>
                </div>

                <div className="p-1 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="text-[9px] text-gray-400 uppercase">Won / Lost</div>
                  <div className="font-bold text-xs text-white">
                    <span className="text-emerald-400">{hud.stats.wins}W</span>
                    <span className="text-gray-500 mx-0.5">/</span>
                    <span className="text-rose-400">{hud.stats.losses}L</span>
                  </div>
                </div>

                <div className="p-1 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="text-[9px] text-gray-400 uppercase">Max Streaks</div>
                  <div className="font-bold text-[10px] flex items-center justify-center gap-1.5">
                    <span className="text-emerald-400" title="Max Consecutive Wins">
                      🔥{hud.stats.maxConsecWins}
                    </span>
                    <span className="text-rose-400" title="Max Consecutive Losses">
                      ⚠️{hud.stats.maxConsecLosses}
                    </span>
                  </div>
                </div>
              </div>

              {/* Milestone TP Hits Row */}
              <div className="flex items-center justify-between text-[9px] px-1 text-gray-400 font-mono pt-0.5 border-t border-neutral-850">
                <span>Milestones Hit:</span>
                <span className="text-gray-300">
                  TP1: <span className="text-amber-300 font-bold">{hud.stats.tp1Hits}</span> · TP2:{' '}
                  <span className="text-emerald-300 font-bold">{hud.stats.tp2Hits}</span> · TP3:{' '}
                  <span className="text-cyan-300 font-bold">{hud.stats.tp3Hits}</span>
                </span>
              </div>
            </div>
          )}

          {hud.active ? (
            <>
              {/* Active Plan Metrics */}
              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Active Entry</span>
                <span className="font-bold text-white">{hud.entryStr}</span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.RISK }}>Stop Loss</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.RISK }}>
                  {hud.stopStr}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.UP }}>TP1 Target</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.UP }}>
                  {hud.tp1Str}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.UP }}>TP2 Target</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.UP }}>
                  {hud.tp2Str}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.UP }}>TP3 Target</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.UP }}>
                  {hud.tp3Str}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded border-t"
                style={{ borderColor: '#263346', backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Position Size</span>
                <span className="font-bold text-amber-300">{hud.posStr}</span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Max Risk $</span>
                <span className="font-bold text-white">{hud.riskStr}</span>
              </div>
            </>
          ) : (
            <>
              {/* Standby Setup Metrics - Shows Last Closed Trade Details so user is never left guessing */}
              {hud.lastCompletedTrade ? (
                <div className="p-2 rounded border border-neutral-750 bg-neutral-900/60 space-y-1">
                  <div className="flex items-center justify-between text-[10px] pb-1 border-b border-neutral-800">
                    <span className="text-gray-400 font-semibold">LAST CLOSED TRADE</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        hud.lastCompletedTrade.isWin
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {hud.lastCompletedTrade.isWin ? '✓ WIN' : '✗ LOSS'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">
                      {hud.lastCompletedTrade.dir === 'BUY' ? (
                        <span className="text-emerald-400 font-bold">▲ BUY</span>
                      ) : (
                        <span className="text-rose-400 font-bold">▼ SELL</span>
                      )}{' '}
                      Entry:
                    </span>
                    <span className="text-white font-mono">{hud.lastCompletedTrade.entryPrice.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Result:</span>
                    <span
                      className="font-semibold"
                      style={{
                        color: hud.lastCompletedTrade.isWin ? LUNQ_PALETTE.UP : LUNQ_PALETTE.RISK,
                      }}
                    >
                      {hud.lastCompletedTrade.pnlText} ({hud.lastCompletedTrade.pipsText})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-gray-500 pt-0.5 border-t border-neutral-800/60">
                    <span>Exit Reason:</span>
                    <span className="text-gray-400 capitalize">{hud.lastCompletedTrade.exitReason}</span>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center justify-between px-2 py-1 rounded"
                  style={{ backgroundColor: LUNQ_PALETTE.CARD }}
                >
                  <span style={{ color: LUNQ_PALETTE.MUTE }}>Last Plan</span>
                  <span className="font-medium text-gray-300">{hud.lastPlanStr}</span>
                </div>
              )}

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Setup State</span>
                <span className="font-medium text-cyan-300 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  Waiting for Pullback
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Next Allocation</span>
                <span className="font-bold text-amber-300">{hud.riskStr}</span>
              </div>
            </>
          )}

          {hud.brokerInfo && (
            <div
              className="flex items-center justify-between px-2 py-0.5 rounded text-[9.5px] border-t border-neutral-800/80"
              style={{ backgroundColor: LUNQ_PALETTE.CARD }}
            >
              <span style={{ color: LUNQ_PALETTE.MUTE }}>Broker Engine</span>
              <span className="text-cyan-300 truncate font-mono text-[9px]">{hud.brokerInfo}</span>
            </div>
          )}

          {/* Trade Audit Log Toggle Button */}
          {hud.recentTrades && hud.recentTrades.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowAuditLog(!showAuditLog)}
                className="w-full flex items-center justify-between px-2 py-1 rounded text-[10px] font-semibold bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-cyan-300 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span>📋</span> Trade Audit Log ({hud.recentTrades.length})
                </span>
                <span className="text-gray-400">{showAuditLog ? '▴ Hide' : '▾ View List'}</span>
              </button>

              {/* Expandable Audit Log Table */}
              {showAuditLog && (
                <div className="mt-1.5 max-h-48 overflow-y-auto rounded border border-neutral-800 bg-neutral-950/90 p-1.5 space-y-1 text-[9.5px]">
                  <div className="flex items-center justify-between text-gray-500 font-bold px-1 pb-1 border-b border-neutral-800 text-[8.5px]">
                    <span className="uppercase"># / Side</span>
                    <span className="uppercase">Entry</span>
                    <span className="uppercase">Result</span>
                    <span className="text-right uppercase">Outcome</span>
                  </div>

                  <div className="text-[8px] text-cyan-400/80 px-1 italic">
                    💡 Click any trade to jump & inspect on chart
                  </div>

                  {hud.recentTrades.map((t, idx) => {
                    const isSelected = selectedTradeId === t.id;
                    return (
                      <div
                        key={t.id || idx}
                        onClick={() => onSelectTrade?.(t)}
                        className={`grid grid-cols-4 items-center px-1.5 py-1 rounded cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 ring-1 ring-cyan-400 shadow-md'
                            : 'bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-850 hover:border-neutral-700'
                        } border`}
                        title={`Click to jump to Trade #${t.id} on chart (${t.exitReason})`}
                      >
                        <span className="font-bold flex items-center gap-0.5">
                          <span className={isSelected ? 'text-cyan-300 font-black' : 'text-gray-500'}>#{t.id}</span>
                          <span className={t.dir === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                            {t.dir === 'BUY' ? '▲BUY' : '▼SELL'}
                          </span>
                        </span>
                        <span className="text-gray-300 font-mono">{t.entryPrice.toFixed(1)}</span>
                        <span
                          className={`font-semibold ${t.isWin ? 'text-emerald-400' : 'text-rose-400'}`}
                          title={t.exitReason}
                        >
                          {t.pnlText}
                        </span>
                        <span className="text-right">
                          <span
                            className={`px-1 py-0.2 rounded font-bold text-[8.5px] ${
                              t.isWin
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {t.isWin ? 'WIN' : 'LOSS'}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
