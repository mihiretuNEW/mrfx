/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsRight, 
  RotateCcw, 
  X,
  FastForward,
  Calendar
} from 'lucide-react';
import { Candle, ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';

interface BarReplayControlsProps {
  isReplayMode: boolean;
  onToggleReplayMode: () => void;
  replayIndex: number;
  totalCandles: number;
  currentCandle: Candle | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onJumpToEnd: () => void;
  onSeek: (index: number) => void;
  speed: 1 | 2 | 5;
  onChangeSpeed: (speed: 1 | 2 | 5) => void;
  theme?: ChartThemeId;
}

export const BarReplayControls: React.FC<BarReplayControlsProps> = ({
  isReplayMode,
  onToggleReplayMode,
  replayIndex,
  totalCandles,
  currentCandle,
  isPlaying,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onJumpToEnd,
  onSeek,
  speed,
  onChangeSpeed,
  theme,
}) => {
  if (!isReplayMode) return null;

  const isDark = isDarkTheme(theme);
  const preset = getThemePreset(theme);

  const formatDate = (epoch?: number) => {
    if (!epoch) return '--:--';
    const d = new Date(epoch * 1000);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const hiddenCandlesCount = Math.max(0, totalCandles - 1 - replayIndex);

  return (
    <div 
      id="bar-replay-toolbar" 
      className={`h-10 border-b border-amber-500/30 px-3 flex items-center justify-between gap-2 sm:gap-4 select-none z-30 shadow-md transition-colors ${
        isDark ? 'bg-neutral-950 text-white' : 'bg-white text-slate-800'
      }`}
      style={{
        backgroundColor: isDark ? preset.surfaceColor || '#0a0a0a' : '#ffffff',
      }}
    >
      {/* Left: Replay Status Badge & Candle Info */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-500 text-[11px] font-mono font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span>REPLAY</span>
        </div>

        <div className={`hidden md:flex items-center gap-1.5 text-xs font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <Calendar className="w-3.5 h-3.5 text-amber-500" />
          <span className={isDark ? 'text-neutral-200' : 'text-slate-800 font-medium'}>{formatDate(currentCandle?.time)}</span>
          <span className="opacity-40">•</span>
          <span>Bar {replayIndex + 1}/{totalCandles}</span>
          {hiddenCandlesCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
              isDark ? 'text-amber-400/80 bg-neutral-900 border-neutral-800' : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {hiddenCandlesCount} hidden for backtest
            </span>
          )}
        </div>
      </div>

      {/* Center: Playback Controls (◀ ▶ ▶▶ 1x 2x 5x) */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Step Back ◀ */}
        <button
          id="btn-replay-step-back"
          onClick={onStepBack}
          disabled={replayIndex <= 5}
          title="Step Back 1 Candle (◀)"
          className={`p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Play / Pause ▶ / ⏸ */}
        <button
          id="btn-replay-play-pause"
          onClick={onTogglePlay}
          title={isPlaying ? "Pause Replay" : "Play Candles Auto-Step (▶)"}
          className={`px-3 py-1 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
            isPlaying 
              ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20' 
              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>PLAY</span>
            </>
          )}
        </button>

        {/* Step Forward ▶ */}
        <button
          id="btn-replay-step-forward"
          onClick={onStepForward}
          disabled={replayIndex >= totalCandles - 1}
          title="Step Forward 1 Candle (▶)"
          className={`p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Jump to End ▶▶ */}
        <button
          id="btn-replay-jump-end"
          onClick={onJumpToEnd}
          disabled={replayIndex >= totalCandles - 1}
          title="Jump to Latest Candle (▶▶)"
          className={`p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>

        {/* Separator */}
        <div className={`w-px h-4 mx-1 hidden sm:block ${isDark ? 'bg-neutral-800' : 'bg-neutral-300'}`} />

        {/* Speed Switchers (1x, 2x, 5x) */}
        <div className={`flex items-center p-0.5 rounded border text-[11px] font-mono ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'
        }`}>
          {([1, 2, 5] as const).map((s) => (
            <button
              key={s}
              id={`btn-replay-speed-${s}x`}
              onClick={() => onChangeSpeed(s)}
              title={`Playback Speed: ${s}x`}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                speed === s 
                  ? 'bg-blue-600 text-white shadow' 
                  : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-slate-900'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Scrubber slider */}
        <div className="hidden lg:flex items-center gap-2 ml-2 w-36 xl:w-48">
          <input
            type="range"
            min={5}
            max={Math.max(6, totalCandles - 1)}
            value={replayIndex}
            onChange={(e) => onSeek(parseInt(e.target.value, 10))}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 ${
              isDark ? 'bg-neutral-800' : 'bg-neutral-200'
            }`}
            title="Scrub replay bar position"
          />
        </div>
      </div>

      {/* Right: Exit Replay / Return to LIVE */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          id="btn-exit-replay"
          onClick={onToggleReplayMode}
          title="Exit Bar Replay and return to Live Market Feed"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors border ${
            isDark 
              ? 'bg-neutral-900 hover:bg-red-950/40 text-neutral-300 hover:text-red-300 border-neutral-800 hover:border-red-900/50' 
              : 'bg-neutral-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border-neutral-200 hover:border-red-300'
          }`}
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exit Replay (LIVE)</span>
        </button>
      </div>
    </div>
  );
};
