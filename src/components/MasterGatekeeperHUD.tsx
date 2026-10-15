/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MasterGatekeeperHUD: Professional Gatekeeper HUD & Real-time Diagnostic Bar
 * For Pro Users trading Jump 10 (1H) with Mpro + Mpro2
 */

import React, { useState } from 'react';
import { PreTradeContext, LoggedTrade, closeTradeManually, updateTradeStopLoss } from '../utils/masterSystem';
import { WeeklyAnchorState } from '../utils/weeklyAnchorEngine';
import { 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Compass, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  Sparkles,
  BarChart3,
  Target,
  Activity,
  CheckCircle2,
  Lock,
  Power
} from 'lucide-react';

interface MasterGatekeeperHUDProps {
  context: PreTradeContext | null;
  currentSymbol: string;
  currentTimeframe: string;
  currentPrice?: number;
  loggedTrades: LoggedTrade[];
  onOpenTradeLogger: () => void;
  onOpenJournal: () => void;
  onTradesUpdated?: () => void;
  isPro: boolean;
  onUpgradePro: () => void;
  weeklyAnchor?: WeeklyAnchorState | null;
  onTogglePower?: () => void;
}

export const MasterGatekeeperHUD: React.FC<MasterGatekeeperHUDProps> = ({
  context,
  currentSymbol,
  currentTimeframe,
  currentPrice,
  loggedTrades,
  onOpenTradeLogger,
  onOpenJournal,
  onTradesUpdated,
  isPro,
  onUpgradePro,
  weeklyAnchor,
  onTogglePower,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  // Calculate quick summary metrics from logged trades
  const completed = loggedTrades.filter((t) => t.status === 'WIN_TP' || t.status === 'LOSS_SL');
  const wins = completed.filter((t) => t.status === 'WIN_TP').length;
  const losses = completed.filter((t) => t.status === 'LOSS_SL').length;
  const openTrades = loggedTrades.filter((t) => t.status === 'OPEN');
  const openCount = openTrades.length;
  const netR = completed.reduce((acc, t) => acc + (t.actualR ?? 0), 0);

  // Active / Running Trade for the current symbol (or overall latest open trade)
  const activeTrade = openTrades.find((t) => t.symbol === currentSymbol) || (openTrades.length > 0 ? openTrades[openTrades.length - 1] : null);

  // Real-time floating R calculation for active trade
  let liveR = 0;
  let distToTP = 0;
  let distToSL = 0;
  let progressPct = 0;

  if (activeTrade && currentPrice && currentPrice > 0) {
    const risk = Math.abs(activeTrade.entryPrice - activeTrade.stopLoss);
    const reward = Math.abs(activeTrade.takeProfit - activeTrade.entryPrice);
    if (risk > 0) {
      if (activeTrade.direction === 'BUY') {
        const diff = currentPrice - activeTrade.entryPrice;
        liveR = Number((diff / risk).toFixed(2));
        distToTP = activeTrade.takeProfit - currentPrice;
        distToSL = currentPrice - activeTrade.stopLoss;
        const totalSpan = activeTrade.takeProfit - activeTrade.stopLoss;
        if (totalSpan > 0) {
          progressPct = Math.min(100, Math.max(0, ((currentPrice - activeTrade.stopLoss) / totalSpan) * 100));
        }
      } else {
        const diff = activeTrade.entryPrice - currentPrice;
        liveR = Number((diff / risk).toFixed(2));
        distToTP = currentPrice - activeTrade.takeProfit;
        distToSL = activeTrade.stopLoss - currentPrice;
        const totalSpan = activeTrade.stopLoss - activeTrade.takeProfit;
        if (totalSpan > 0) {
          progressPct = Math.min(100, Math.max(0, ((activeTrade.stopLoss - currentPrice) / totalSpan) * 100));
        }
      }
    }
  }

  const handleManualClose = (tradeId: string, outcome: 'WIN_TP' | 'LOSS_SL' | 'MANUAL_CLOSED') => {
    closeTradeManually(tradeId, outcome, currentPrice);
    if (onTradesUpdated) onTradesUpdated();
  };

  const handleMoveSLToBreakEven = (tradeId: string, entryPrice: number) => {
    updateTradeStopLoss(tradeId, entryPrice, 'SL moved to Break-Even (Entry)');
    if (onTradesUpdated) onTradesUpdated();
  };

  // If not PRO, render a subtle lock badge inviting the user to unlock the Master Gatekeeper
  if (!isPro) {
    return (
      <div 
        id="master-gatekeeper-pro-teaser"
        className="absolute top-3 left-16 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-amber-500/30 text-xs shadow-xl text-neutral-300 pointer-events-auto select-none"
      >
        <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="font-semibold text-amber-300">MASTER SYSTEM</span>
        <span className="text-neutral-400 hidden sm:inline">| Jump 10 Filter & Trade Audit</span>
        <button
          type="button"
          onClick={onUpgradePro}
          className="ml-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Unlock Pro
        </button>
        {onTogglePower && (
          <button
            type="button"
            onClick={onTogglePower}
            className="p-1 hover:bg-rose-500/20 rounded text-neutral-400 hover:text-rose-400 transition-colors ml-0.5"
            title="Turn Off Master Dashboard"
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div 
        id="master-gatekeeper-hud-minimized"
        className="absolute top-3 left-16 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950/90 backdrop-blur-md border border-neutral-800 text-xs text-neutral-300 shadow-xl pointer-events-auto"
      >
        {activeTrade ? (
          <div className="flex items-center gap-1.5 font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-emerald-400 font-mono text-[11px]">
              RUNNING {activeTrade.direction}:
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
              liveR >= 0 ? 'text-emerald-300 bg-emerald-950/50' : 'text-rose-300 bg-rose-950/50'
            }`}>
              {liveR >= 0 ? `+${liveR.toFixed(1)}` : liveR.toFixed(1)}R
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 font-bold">
            {context?.decision === 'TAKE' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            ) : context?.decision === 'WAIT' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            ) : context?.decision === 'SKIP' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            )}
            <span className="text-blue-400 font-mono">MASTER</span>
            {context ? (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                context.decision === 'TAKE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                context.decision === 'WAIT' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {context.decision}
              </span>
            ) : (
              <span className="text-neutral-400 text-[11px]">STANDBY</span>
            )}
          </div>
        )}

        <div className="h-3 w-px bg-neutral-800" />

        <button
          type="button"
          onClick={onOpenJournal}
          className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
          title="Open Master Strategy Journal"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{wins}W-{losses}L ({netR >= 0 ? `+${netR.toFixed(1)}` : netR.toFixed(1)}R)</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
          title="Expand Master HUD"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {onTogglePower && (
          <button
            type="button"
            onClick={onTogglePower}
            className="p-1 hover:bg-rose-500/20 rounded text-neutral-400 hover:text-rose-400 transition-colors"
            title="Turn Off Master Dashboard (ማጥፊያ - በSettings > Indicators ውስጥ መልሰው ማብራት ይችላሉ)"
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Full Expanded HUD
  return (
    <div
      id="master-gatekeeper-hud-expanded"
      className="absolute top-3 left-16 z-20 max-w-xl w-[calc(100%-80px)] sm:w-auto rounded-2xl bg-neutral-950/92 backdrop-blur-xl border border-neutral-800/80 shadow-2xl p-3.5 text-xs text-neutral-200 pointer-events-auto transition-all"
    >
      {/* Top Title & Controls */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800/70 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs tracking-wide text-white">MASTER GATEKEEPER</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PRO
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 flex items-center gap-1.5">
              <span>{currentSymbol} • {currentTimeframe}</span>
              <span>•</span>
              <span className="text-neutral-300 font-mono">1:3 RR Filter</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenJournal}
            className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] flex items-center gap-1 transition-colors"
            title="View Strategy Journal & Factor Attribution"
          >
            <BarChart3 className="w-3 h-3 text-blue-400" />
            <span className="font-mono font-bold text-white">{wins}W-{losses}L</span>
            <span className={`text-[10px] ${netR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({netR >= 0 ? `+${netR.toFixed(1)}` : netR.toFixed(1)}R)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-neutral-900 rounded text-neutral-400 hover:text-neutral-200"
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          {onTogglePower && (
            <button
              type="button"
              onClick={onTogglePower}
              className="p-1 hover:bg-rose-500/20 rounded text-neutral-400 hover:text-rose-400 transition-colors"
              title="Turn Off Master Dashboard (ማጥፊያ - በSettings > Indicators ውስጥ መልሰው ማብራት ይችላሉ)"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* WEEKLY ANCHOR & CONFIRMED SWING LOCK STATUS */}
      {weeklyAnchor && (
        <div 
          id="master-weekly-anchor-badge"
          className="mb-2.5 px-3 py-2 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[11px]"
        >
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3 text-blue-400" />
              <span>Weekly Anchor:</span>
            </span>
            <span className="font-mono text-gray-200 font-bold">
              PWH {weeklyAnchor.pwh.toFixed(2)} · PWL {weeklyAnchor.pwl.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
              weeklyAnchor.currentStage === 'RETEST_ACTIVE'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : weeklyAnchor.currentStage === 'BREAKOUT_PENDING' || weeklyAnchor.currentStage === 'HOLDING_BREAK'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : weeklyAnchor.currentStage === 'SWEEP_REJECTED'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
            }`}>
              {weeklyAnchor.stageTitle}
            </span>
          </div>
        </div>
      )}

      {/* ACTIVE TRADE IN-PROGRESS CARD */}
      {activeTrade && (
        <div 
          id="active-trade-in-progress-card"
          className="mb-2.5 p-3 rounded-xl bg-gradient-to-r from-blue-950/40 via-neutral-900/90 to-blue-950/20 border border-blue-500/40 shadow-lg space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="font-black text-xs tracking-wider text-emerald-400">
                ACTIVE POSITION IN PROGRESS
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                activeTrade.direction === 'BUY'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {activeTrade.direction}
              </span>
            </div>

            {currentPrice !== undefined && currentPrice > 0 && (
              <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-lg border border-neutral-800">
                <span className="text-[10px] text-neutral-400">Floating:</span>
                <span className={`font-mono font-bold text-xs ${liveR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {liveR >= 0 ? `+${liveR.toFixed(2)}` : liveR.toFixed(2)}R
                </span>
              </div>
            )}
          </div>

          {/* Execution Specs */}
          <div className="grid grid-cols-3 gap-2 text-center bg-black/50 p-2 rounded-lg border border-neutral-800/80 font-mono text-[11px]">
            <div>
              <span className="text-[9px] text-neutral-400 block font-sans">ENTRY</span>
              <span className="font-semibold text-white">{activeTrade.entryPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[9px] text-rose-400 block font-sans">STOP LOSS (-1R)</span>
              <span className="font-semibold text-rose-300">{activeTrade.stopLoss.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[9px] text-emerald-400 block font-sans">TAKE PROFIT (+3R)</span>
              <span className="font-semibold text-emerald-300">{activeTrade.takeProfit.toFixed(2)}</span>
            </div>
          </div>

          {/* Real-time Target Distance & Progress Gauge */}
          {currentPrice !== undefined && currentPrice > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>Current Price: <span className="text-white font-mono font-bold">{currentPrice.toFixed(2)}</span></span>
                <span className={distToTP <= 0 ? 'text-emerald-400 font-bold' : 'text-neutral-300'}>
                  {distToTP <= 0 
                    ? '🎯 1:3 TP REACHED!' 
                    : `${distToTP.toFixed(2)} pts to TP (${progressPct.toFixed(0)}% reached)`}
                </span>
              </div>
              {/* Visual Progress Bar: SL (0%) -> Entry -> TP (100%) */}
              <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden flex border border-neutral-800">
                <div 
                  className={`h-full transition-all duration-300 ${liveR >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
                />
              </div>
            </div>
          )}

          {/* Manual Control Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-800/80">
            <div className="text-[10px] text-neutral-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-neutral-500" />
              <span>Logged at {new Date(activeTrade.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {activeTrade.stopLoss !== activeTrade.entryPrice && (
                <button
                  type="button"
                  onClick={() => handleMoveSLToBreakEven(activeTrade.id, activeTrade.entryPrice)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 border ${
                    liveR >= 1.0
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-md shadow-emerald-950/50 animate-pulse'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                  }`}
                  title={`Move Stop Loss to Entry (${activeTrade.entryPrice.toFixed(2)}) for Zero Risk`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{liveR >= 1.0 ? '🛡️ +1R: Lock BE' : 'Move SL to BE'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleManualClose(activeTrade.id, 'WIN_TP')}
                className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-all flex items-center gap-1"
                title="Mark trade as won at 1:3 Take Profit (+3R)"
              >
                <Target className="w-3 h-3" />
                <span>Mark TP (+3R)</span>
              </button>

              <button
                type="button"
                onClick={() => handleManualClose(activeTrade.id, 'LOSS_SL')}
                className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all flex items-center gap-1"
                title="Mark trade as stopped out (-1R)"
              >
                <XCircle className="w-3 h-3" />
                <span>Mark SL (-1R)</span>
              </button>

              <button
                type="button"
                onClick={() => handleManualClose(activeTrade.id, 'MANUAL_CLOSED')}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium transition-all"
                title="Close position manually at market"
              >
                Close Early
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Verdict & Diagnostic Section */}
      {context ? (
        <div className="space-y-2.5">
          {/* Verdict Banner */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
            context.decision === 'TAKE'
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : context.decision === 'WAIT'
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {context.decision === 'TAKE' ? (
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              ) : context.decision === 'WAIT' ? (
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <XCircle className="w-5 h-5" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm tracking-wider">
                    VERDICT: {context.decision}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 font-mono font-bold">
                    Score: {context.confidenceScore}/100
                  </span>
                </div>
                <div className="text-[11px] font-medium opacity-90 truncate max-w-[280px] sm:max-w-sm">
                  {context.signalSource.replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenTradeLogger}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                context.decision === 'TAKE'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-900/30'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Trade</span>
            </button>
          </div>

          {/* Micro-Trigger & 15-Minute Trap Avoidance Bar */}
          {context.microTrigger && (
            <div className={`p-2 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              context.microTrigger.status === 'CONFIRMED'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : context.microTrigger.status === 'EARLY_TRAP_WINDOW'
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-blue-950/30 border-blue-500/30 text-blue-200'
            }`}>
              <div className="flex items-start sm:items-center gap-2">
                {context.microTrigger.status === 'CONFIRMED' ? (
                  <span className="p-1 rounded bg-emerald-500/20 text-emerald-400 mt-0.5 sm:mt-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                ) : context.microTrigger.status === 'EARLY_TRAP_WINDOW' ? (
                  <span className="p-1 rounded bg-amber-500/20 text-amber-400 mt-0.5 sm:mt-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400 mt-0.5 sm:mt-0">
                    <Clock className="w-3.5 h-3.5" />
                  </span>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-[11px] uppercase tracking-wider">
                      {context.microTrigger.status === 'CONFIRMED'
                        ? '🎯 5M/15M Micro-CHoCH Confirmed'
                        : context.microTrigger.status === 'EARLY_TRAP_WINDOW'
                        ? '⚠️ 15-Min Trap Avoidance Active'
                        : '⏳ Awaiting 5M/15M Structure Break'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-white/10 font-bold">
                      Trigger: {context.signalDirection === 'SELL' ? '≤' : '≥'} {context.microTrigger.triggerPrice.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-85 mt-0.5 leading-tight">
                    {context.microTrigger.statusText}
                  </p>
                </div>
              </div>

              {/* Tight 1:3 RR Levels */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-[10px] bg-black/50 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-rose-400">SL: {context.microTrigger.tightStopLoss.toFixed(2)}</span>
                <span className="text-neutral-500">|</span>
                <span className="text-amber-300">1:1 BE: {context.microTrigger.breakEvenPrice.toFixed(2)}</span>
                <span className="text-neutral-500">|</span>
                <span className="text-emerald-400">1:3 TP: {context.microTrigger.tp3RPrice.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* 5 Pillars of Filter Inspection */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {/* 1. Slope & Trend */}
            <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-[10px] text-neutral-400 font-semibold">1. SLOPE / REGIME</span>
              <div className="flex items-center gap-1 mt-0.5">
                {context.slope.mproSlopeDegrees >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-400" />
                )}
                <span className={`text-xs font-bold font-mono ${
                  context.slope.isRunawayHostile ? 'text-rose-400' : 'text-neutral-200'
                }`}>
                  {context.slope.mproSlopeDegrees > 0 ? '+' : ''}{context.slope.mproSlopeDegrees}°
                </span>
              </div>
              <span className="text-[9px] text-neutral-400 truncate mt-0.5">
                {context.slope.isRunawayHostile ? 'Hostile Trend' : context.slope.regime.replace('_', ' ')}
              </span>
            </div>

            {/* 2. Room to 1:3 Target */}
            <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-[10px] text-neutral-400 font-semibold">2. 1:3 TARGET ROOM</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs font-bold font-mono ${
                  context.targetRoom.hasRoomFor3R ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {context.targetRoom.clearanceRatio.toFixed(2)}x
                </span>
              </div>
              <span className="text-[9px] text-neutral-400 truncate mt-0.5">
                {context.targetRoom.hasRoomFor3R ? 'Clear Airway' : 'Blocked by Band'}
              </span>
            </div>

            {/* 3. Rejection Wick */}
            <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-[10px] text-neutral-400 font-semibold">3. REJECTION WICK</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs font-bold font-mono ${
                  context.rejection.isCleanRejection ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {(context.rejection.wickRatio * 100).toFixed(0)}%
                </span>
              </div>
              <span className="text-[9px] text-neutral-400 truncate mt-0.5">
                {context.rejection.isCleanRejection ? 'Strong Absorption' : 'Weak Wick'}
              </span>
            </div>

            {/* 4. Touch Pattern */}
            <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-[10px] text-neutral-400 font-semibold">4. TOUCH TYPE</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs font-bold truncate ${
                  context.rejection.touchPattern === 'RETEST_DOUBLE_TOUCH' 
                    ? 'text-emerald-400' 
                    : context.rejection.touchPattern === 'MIDLINE_BOUNCE'
                    ? 'text-amber-300'
                    : 'text-neutral-300'
                }`}>
                  {context.rejection.touchPattern === 'RETEST_DOUBLE_TOUCH' ? '2nd Retest' : 
                   context.rejection.touchPattern === 'MIDLINE_BOUNCE' ? 'Midline' : '1st Touch'}
                </span>
              </div>
              <span className="text-[9px] text-neutral-400 truncate mt-0.5">
                {context.rejection.touchPattern === 'RETEST_DOUBLE_TOUCH' ? 'High Probability' : 'Normal'}
              </span>
            </div>

            {/* 5. 5M/15M Micro-Trigger */}
            <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 flex flex-col col-span-2 sm:col-span-1">
              <span className="text-[10px] text-neutral-400 font-semibold">5. MICRO TRIGGER</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs font-bold truncate ${
                  context.microTrigger?.status === 'CONFIRMED'
                    ? 'text-emerald-400'
                    : context.microTrigger?.status === 'EARLY_TRAP_WINDOW'
                    ? 'text-amber-400'
                    : 'text-blue-300'
                }`}>
                  {context.microTrigger?.status === 'CONFIRMED'
                    ? 'Confirmed'
                    : context.microTrigger?.status === 'EARLY_TRAP_WINDOW'
                    ? 'Trap Window'
                    : 'Waiting'}
                </span>
              </div>
              <span className="text-[9px] text-neutral-400 truncate mt-0.5">
                {context.microTrigger?.status === 'CONFIRMED'
                  ? '1:3 Active'
                  : `Break ${context.signalDirection === 'SELL' ? 'Low' : 'High'}`}
              </span>
            </div>
          </div>

          {/* Bulleted Rationale */}
          {context.decisionReasons && context.decisionReasons.length > 0 && (
            <div className="p-2 rounded-lg bg-neutral-900/50 border border-neutral-800/60 text-[11px] text-neutral-300 space-y-1">
              {context.decisionReasons.slice(0, 2).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-1.5 leading-tight">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Standby state when no immediate signal is touching right now */
        <div className="py-2 px-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px]">
              Monitoring 1H Mpro2 boundaries (Higher/Lower) + Weekly Anchor + Golden Pocket for 1:3 entries (Mpro disabled).
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenTradeLogger}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-[11px] font-semibold whitespace-nowrap transition-colors"
          >
            Log Setup
          </button>
        </div>
      )}
    </div>
  );
};
