/**
 * VIP Market Scanner™ (VIP Algos) - Single Pair HUD Matrix
 * Displays real-time multi-timeframe trend, momentum, volatility & confluence matrix.
 * Strictly adheres to: No top or bottom promotional/watermark signatures.
 */

import React, { useState } from 'react';
import { VipScannerResult } from '../utils/vipMarketScanner';
import { ChevronDown, ChevronUp, Shield, Activity, BarChart2, Zap, X } from 'lucide-react';

interface VipMarketScannerHUDProps {
  scannerResult: VipScannerResult | null;
  visible?: boolean;
  onClose?: () => void;
}

export const VipMarketScannerHUD: React.FC<VipMarketScannerHUDProps> = ({
  scannerResult,
  visible = true,
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!visible || !scannerResult) return null;

  const {
    symbol,
    chartTimeframe,
    rows,
    confluenceBullishPct,
    confluenceBearishPct,
    masterVerdict,
    masterVerdictColor,
    alignmentAlert,
  } = scannerResult;

  const isBull = masterVerdict === 'STRONG BUY' || masterVerdict === 'BUY';
  const isBear = masterVerdict === 'STRONG SELL' || masterVerdict === 'SELL';

  return (
    <div
      id="vip-market-scanner-hud"
      className="absolute top-12 left-4 z-20 w-80 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-md text-white select-none transition-all animate-in fade-in slide-in-from-left-2 duration-200 overflow-hidden font-sans"
    >
      {/* Top Header Bar - Clean without promotional signatures */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-900/90 border-b border-neutral-800/90">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs tracking-wider text-gray-100">VIP MARKET SCANNER</span>
            <span className="text-[10px] text-sky-400 font-mono font-semibold">({symbol})</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
            title={isMinimized ? 'Expand Scanner' : 'Minimize Scanner'}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
              title="Close Scanner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scanner Body */}
      {!isMinimized && (
        <div className="p-3 space-y-2.5">
          {/* Verdict Banner */}
          <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-neutral-400 font-medium">Scanner Verdict</div>
              <div
                className="text-sm font-extrabold tracking-wide font-mono flex items-center gap-1.5"
                style={{ color: masterVerdictColor }}
              >
                <span>{masterVerdict}</span>
                <span>{isBull ? '▲' : isBear ? '▼' : '◆'}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-neutral-400 font-medium">Matrix Confluence</div>
              <div className="text-xs font-mono font-bold flex items-center gap-2 justify-end">
                <span className="text-emerald-400">{confluenceBullishPct}% Bull</span>
                <span className="text-neutral-600">|</span>
                <span className="text-rose-400">{confluenceBearishPct}% Bear</span>
              </div>
            </div>
          </div>

          {/* Alignment Alert Banner */}
          {alignmentAlert && (
            <div className="px-2.5 py-1.5 rounded-md bg-sky-950/40 border border-sky-500/30 text-[10px] font-semibold text-sky-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>{alignmentAlert}</span>
            </div>
          )}

          {/* Timeframe Matrix Table */}
          <div className="border border-neutral-850 rounded-lg overflow-hidden bg-neutral-950/60 text-[11px] font-mono">
            <div className="grid grid-cols-5 gap-1 px-2 py-1.5 bg-neutral-900/80 text-[9px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-850">
              <div className="text-left">TF</div>
              <div className="text-left">Trend</div>
              <div className="text-center">RSI</div>
              <div className="text-center">Volatility</div>
              <div className="text-right">Signal</div>
            </div>

            <div className="divide-y divide-neutral-900/60">
              {rows.map((row) => (
                <div
                  key={row.timeframe}
                  className="grid grid-cols-5 gap-1 px-2 py-1.5 items-center hover:bg-neutral-900/40 transition-colors"
                >
                  {/* TF */}
                  <div className="text-left font-bold text-white flex items-center gap-1">
                    <span>{row.timeframe}</span>
                    {row.timeframe === chartTimeframe && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Active Chart TF" />
                    )}
                  </div>

                  {/* Trend */}
                  <div className="text-left font-semibold text-[10px]" style={{ color: row.trendColor }}>
                    {row.trendText}
                  </div>

                  {/* RSI */}
                  <div className="text-center font-bold" style={{ color: row.rsiColor }}>
                    {row.rsi}
                  </div>

                  {/* Volatility */}
                  <div className="text-center text-[10px]" style={{ color: row.volatilityColor }}>
                    {row.volatility === 'EXPANDING' ? 'EXP ⚡' : row.volatility === 'SQUEEZE' ? 'SQZ 🔒' : 'NORM'}
                  </div>

                  {/* Signal */}
                  <div className="text-right font-bold text-[10px]" style={{ color: row.signalColor }}>
                    {row.signal.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
