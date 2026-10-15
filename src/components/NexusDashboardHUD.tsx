import React, { useState } from 'react';
import { NexusResults } from '../types';
import { Activity, Power, ChevronDown, ChevronUp, ShieldCheck, Zap } from 'lucide-react';

interface NexusDashboardHUDProps {
  results: NexusResults | null;
  visible?: boolean;
  showMarketNarrative?: boolean;
  onToggleMaster?: () => void;
}

export const NexusDashboardHUD: React.FC<NexusDashboardHUDProps> = ({
  results,
  visible = true,
  showMarketNarrative = true,
  onToggleMaster,
}) => {
  const [minimized, setMinimized] = useState<boolean>(false);

  if (!visible || !results) return null;

  const {
    trend,
    bias,
    currentZone,
    activeSessionName,
    hasVolume,
    mtf,
    temporalMemory,
    pulse,
    activeTrade,
    narrative,
  } = results;

  const isBull = trend === 'BULLISH';
  const isBear = trend === 'BEARISH';

  // Sequence percentage
  let seqPercent = 10;
  if (temporalMemory.sequenceStatus === 'EARLY') seqPercent = 35;
  if (temporalMemory.sequenceStatus === 'BUILDING') seqPercent = 70;
  if (temporalMemory.sequenceStatus === 'READY') seqPercent = 100;

  // Pulse bar percentage (-100 to +100 mapped to 0 to 100%)
  const pulsePercent = Math.max(0, Math.min(100, (pulse.compositeScore + 100) / 2));

  return (
    <>
      {/* 1. TOP-RIGHT NEXUS ENGINE [BullByte] HUD */}
      <div
        id="nexus-engine-hud"
        className="absolute top-14 right-3 z-30 w-72 md:w-80 select-none rounded-xl border border-slate-700/80 bg-slate-950/85 backdrop-blur-md shadow-2xl text-slate-100 overflow-hidden font-sans transition-all duration-200"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900/90 to-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1.5 font-bold tracking-wider text-xs md:text-sm">
              <span className="text-white">NEXUS ENGINE</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-semibold border border-blue-500/30">
                BullByte
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            {onToggleMaster && (
              <button
                onClick={onToggleMaster}
                title="Toggle Nexus Suite"
                className="p-1 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setMinimized(!minimized)}
              title={minimized ? 'Expand HUD' : 'Minimize HUD'}
              className="p-1 hover:text-white hover:bg-slate-800 rounded transition"
            >
              {minimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!minimized && (
          <div className="p-3 space-y-2.5 text-xs">
            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {/* Trend */}
              <div className="flex items-center justify-between bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 font-medium text-[11px]">TREND</span>
                <span
                  className={`font-bold tracking-wide text-[11px] ${
                    isBull ? 'text-emerald-400' : isBear ? 'text-red-400' : 'text-slate-300'
                  }`}
                >
                  {trend}
                </span>
              </div>

              {/* Bias */}
              <div className="flex items-center justify-between bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 font-medium text-[11px]">BIAS</span>
                <span
                  className={`font-bold tracking-wide text-[11px] ${
                    bias === 'LONG' ? 'text-emerald-400' : bias === 'SHORT' ? 'text-red-400' : 'text-slate-300'
                  }`}
                >
                  {bias}
                </span>
              </div>

              {/* Zone */}
              <div className="flex items-center justify-between bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 font-medium text-[11px]">ZONE</span>
                <span
                  className={`font-bold text-[11px] ${
                    currentZone === 'DISCOUNT'
                      ? 'text-emerald-400'
                      : currentZone === 'PREMIUM'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                >
                  {currentZone}
                </span>
              </div>

              {/* Session */}
              <div className="flex items-center justify-between bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 font-medium text-[11px]">SESSION</span>
                <span className="font-semibold text-sky-400 text-[11px] truncate max-w-[90px]">
                  {activeSessionName}
                </span>
              </div>
            </div>

            {/* MTF Confluence Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                <span>MTF CONFLUENCE</span>
                <span className="text-slate-400 font-mono lowercase">{mtf.consensus}</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono font-semibold text-center">
                <div
                  className={`py-1 rounded border ${
                    mtf.tf15.dir === 'up'
                      ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                      : mtf.tf15.dir === 'down'
                      ? 'bg-red-950/40 border-red-600/40 text-red-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[9px] text-slate-500 font-sans">TF 15</div>
                  <div>{mtf.tf15.text}</div>
                </div>

                <div
                  className={`py-1 rounded border ${
                    mtf.tf60.dir === 'up'
                      ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                      : mtf.tf60.dir === 'down'
                      ? 'bg-red-950/40 border-red-600/40 text-red-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[9px] text-slate-500 font-sans">TF 60</div>
                  <div>{mtf.tf60.text}</div>
                </div>

                <div
                  className={`py-1 rounded border ${
                    mtf.tf240.dir === 'up'
                      ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                      : mtf.tf240.dir === 'down'
                      ? 'bg-red-950/40 border-red-600/40 text-red-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[9px] text-slate-500 font-sans">TF 240</div>
                  <div>{mtf.tf240.text}</div>
                </div>

                <div
                  className={`py-1 rounded border ${
                    mtf.tfd.dir === 'up'
                      ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                      : mtf.tfd.dir === 'down'
                      ? 'bg-red-950/40 border-red-600/40 text-red-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[9px] text-slate-500 font-sans">TF D</div>
                  <div>{mtf.tfd.text}</div>
                </div>
              </div>
            </div>

            {/* Setup Sequence Tracker */}
            <div className="space-y-1 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  SETUP SEQUENCE
                </span>
                <span
                  className={`font-bold text-[10px] ${
                    temporalMemory.sequenceStatus === 'READY'
                      ? 'text-emerald-400'
                      : temporalMemory.sequenceStatus === 'BUILDING'
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {temporalMemory.sequenceStatus}
                </span>
              </div>

              {/* Steps pills */}
              <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center pt-0.5">
                <div
                  className={`py-0.5 rounded border ${
                    temporalMemory.sweep.active
                      ? 'bg-purple-950/50 border-purple-500/50 text-purple-300 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-500'
                  }`}
                >
                  SWEEP
                  <div className="text-[8px] font-sans">
                    {temporalMemory.sweep.active ? 'CONFIRMED' : 'waiting'}
                  </div>
                </div>

                <div
                  className={`py-0.5 rounded border ${
                    temporalMemory.zone.active
                      ? 'bg-blue-950/50 border-blue-500/50 text-blue-300 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-500'
                  }`}
                >
                  ZONE
                  <div className="text-[8px] font-sans">
                    {temporalMemory.zone.active ? temporalMemory.zone.quality : 'waiting'}
                  </div>
                </div>

                <div
                  className={`py-0.5 rounded border ${
                    temporalMemory.displacement.active
                      ? 'bg-amber-950/50 border-amber-500/50 text-amber-300 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-500'
                  }`}
                >
                  DISP
                  <div className="text-[8px] font-sans">
                    {temporalMemory.displacement.active ? 'CONFIRMED' : 'waiting'}
                  </div>
                </div>

                <div
                  className={`py-0.5 rounded border ${
                    temporalMemory.structureBreak.active
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-500'
                  }`}
                >
                  BREAK
                  <div className="text-[8px] font-sans">
                    {temporalMemory.structureBreak.active ? temporalMemory.structureBreak.type : 'awaiting'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden mt-1 border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    temporalMemory.sequenceStatus === 'READY'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : temporalMemory.sequenceStatus === 'BUILDING'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${seqPercent}%` }}
                />
              </div>
            </div>

            {/* Nexus Pulse Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-sky-400" />
                  PULSE
                </span>
                <span
                  className={`font-mono font-bold text-[10px] ${
                    pulse.compositeScore > 0 ? 'text-emerald-400' : pulse.compositeScore < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}
                >
                  {pulse.compositeScore > 0 ? `+${pulse.compositeScore}` : pulse.compositeScore}{' '}
                  <span className="text-[9px] font-sans font-normal uppercase text-slate-300">
                    {pulse.stateDescription}
                  </span>
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800 relative">
                {/* Center marker */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 z-10" />
                <div
                  className={`h-full transition-all duration-300 ${
                    pulse.compositeScore >= 0 ? 'bg-emerald-500 ml-auto' : 'bg-red-500 mr-auto'
                  }`}
                  style={{ width: `${Math.abs(pulse.compositeScore) / 2}%` }}
                />
              </div>
            </div>

            {/* Trade Status Box */}
            <div className="pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-semibold text-[10px] tracking-wider uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  TRADE
                </span>
                {activeTrade ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-bold font-mono text-[11px] ${
                        activeTrade.type === 'LONG' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {activeTrade.type} {activeTrade.grade} [{activeTrade.score}]
                    </span>
                    <span className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-mono">
                      {activeTrade.statusText}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 font-mono text-[10px]">NO POSITION</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. BOTTOM-RIGHT MARKET NARRATIVE BOX */}
      {showMarketNarrative && (
        <div
          id="nexus-market-narrative"
          className="absolute bottom-6 right-3 z-30 w-64 md:w-72 select-none rounded-xl border border-slate-800/90 bg-slate-950/85 backdrop-blur-md shadow-2xl text-slate-200 p-3 space-y-2 font-sans"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              MARKET NARRATIVE
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          </div>

          <div className="space-y-1 text-xs text-slate-300 leading-relaxed font-medium">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{narrative.structureText}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{narrative.zoneText}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{narrative.sessionText}</span>
            </div>
          </div>

          {/* Directional Summary Pill */}
          <div className="pt-1">
            <div
              className={`w-full py-1 px-2.5 rounded-lg text-center font-bold text-[11px] tracking-wide border ${
                narrative.summaryPillType === 'bullish'
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400'
                  : narrative.summaryPillType === 'bearish'
                  ? 'bg-red-950/50 border-red-500/50 text-red-400'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              {narrative.summaryPillText}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
