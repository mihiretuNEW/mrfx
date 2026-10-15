/**
 * Premium Signals with Dynamic TP & SL Optimization - Real-Time Tracking Table HUD
 * Quick view of current trade operation status, dynamic TP1/TP2/TP3 levels,
 * and 50% volatility-adaptive Stop Loss.
 * Clean design without top/bottom signature watermarks.
 */

import React, { useState } from 'react';
import { DynamicSignalOperation } from '../utils/premiumDynamicTpSlSignals';
import { ChevronDown, ChevronUp, Target, Shield, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface DynamicTpSlTableHUDProps {
  operation: DynamicSignalOperation | null;
  currentPrice: number;
  decimals?: number;
  visible?: boolean;
  onClose?: () => void;
}

export const DynamicTpSlTableHUD: React.FC<DynamicTpSlTableHUDProps> = ({
  operation,
  currentPrice,
  decimals = 2,
  visible = true,
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!visible || !operation) return null;

  const isBuy = operation.type === 'BUY';
  const entry = operation.entryPrice;
  const pnlPips = isBuy ? currentPrice - entry : entry - currentPrice;
  const isProfitable = pnlPips >= 0;

  const statusBadge = () => {
    switch (operation.status) {
      case 'TARGET_REACHED':
        return { text: 'TARGET TP3 HIT 🎯', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' };
      case 'TP2_HIT':
        return { text: 'TP2 HIT ✨', color: '#34d399', bg: 'rgba(52, 211, 153, 0.2)' };
      case 'TP1_HIT':
        return { text: 'TP1 HIT ✓', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' };
      case 'STOPPED_OUT':
        return { text: 'STOPPED OUT ✕', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' };
      case 'ACTIVE':
      default:
        return { text: 'ACTIVE IN PROGRESS ⏳', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' };
    }
  };

  const badge = statusBadge();

  return (
    <div
      id="dynamic-tpsl-tracking-hud"
      className="absolute top-12 right-4 z-20 w-80 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-md text-white select-none transition-all animate-in fade-in slide-in-from-right-2 duration-200 overflow-hidden font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-900/90 border-b border-neutral-800/90">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isBuy ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`}
          />
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs tracking-wider text-gray-100">
              PREMIUM SIGNALS TRACKER
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                isBuy ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {operation.type}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
            title={isMinimized ? 'Expand Tracker' : 'Minimize Tracker'}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
              title="Close Tracker"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="p-3 space-y-2.5">
          {/* Status & PnL Card */}
          <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-neutral-400 font-medium">Operation Status</div>
              <div
                className="text-xs font-bold font-mono px-2 py-0.5 rounded inline-block mt-0.5"
                style={{ color: badge.color, backgroundColor: badge.bg }}
              >
                {badge.text}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-neutral-400 font-medium">Current P&L</div>
              <div
                className={`text-xs font-mono font-bold ${
                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isProfitable ? '+' : ''}
                {pnlPips.toFixed(decimals)} pts
              </div>
            </div>
          </div>

          {/* TP & SL Matrix Table */}
          <div className="space-y-1.5 text-xs font-mono">
            {/* Take Profit 3 (Full Target) */}
            <div
              className={`p-2 rounded-lg border flex items-center justify-between ${
                operation.tp3HitIndex
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-bold'
                  : 'bg-neutral-900/60 border-neutral-850 text-emerald-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold">TP3 (Full Target)</span>
                {operation.tp3HitIndex && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="font-bold">{operation.tp3Price.toFixed(decimals)}</span>
            </div>

            {/* Take Profit 2 */}
            <div
              className={`p-2 rounded-lg border flex items-center justify-between ${
                operation.tp2HitIndex
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 font-bold'
                  : 'bg-neutral-900/60 border-neutral-850 text-emerald-400/90'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 text-center text-emerald-400 font-bold">2</span>
                <span className="font-semibold">TP2 (Medium)</span>
                {operation.tp2HitIndex && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="font-bold">{operation.tp2Price.toFixed(decimals)}</span>
            </div>

            {/* Take Profit 1 */}
            <div
              className={`p-2 rounded-lg border flex items-center justify-between ${
                operation.tp1HitIndex
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 font-bold'
                  : 'bg-neutral-900/60 border-neutral-850 text-emerald-400/80'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 text-center text-emerald-400 font-bold">1</span>
                <span className="font-semibold">TP1 (Quick Exit)</span>
                {operation.tp1HitIndex && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="font-bold">{operation.tp1Price.toFixed(decimals)}</span>
            </div>

            {/* Entry Price */}
            <div className="p-2 bg-neutral-900/80 border border-neutral-800 rounded-lg flex items-center justify-between text-neutral-300">
              <span className="text-neutral-400 font-semibold">Entry Level</span>
              <span className="text-white font-bold">{operation.entryPrice.toFixed(decimals)}</span>
            </div>

            {/* Dynamic Stop Loss (50% TP3) */}
            <div
              className={`p-2 rounded-lg border flex items-center justify-between ${
                operation.slHitIndex
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 font-bold'
                  : 'bg-neutral-900/60 border-neutral-850 text-rose-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="font-semibold">Stop Loss (50% TP3)</span>
                {operation.slHitIndex && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
              </div>
              <span className="font-bold">{operation.slPrice.toFixed(decimals)}</span>
            </div>
          </div>

          {/* R:R Footer */}
          <div className="pt-2 flex items-center justify-between text-[11px] font-mono border-t border-neutral-800/80 text-neutral-400">
            <span>Dynamic Risk / Reward:</span>
            <span className="px-2 py-0.5 bg-neutral-800 text-amber-400 font-bold rounded border border-neutral-700">
              1 : {operation.riskRewardRatio} R:R
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
