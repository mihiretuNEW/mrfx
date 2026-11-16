/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ChevronsLeft,
  X,
  Calendar,
  Scissors,
} from 'lucide-react';
import { Candle, ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';

export type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10;

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
  onJumpToStart: () => void;
  onSeek: (index: number) => void;
  onBarsBack: (bars: number) => void;
  speed: ReplaySpeed;
  onChangeSpeed: (speed: ReplaySpeed) => void;
  isPickingStartBar?: boolean;
  onTogglePickStartBar?: () => void;
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
  onJumpToStart,
  onSeek,
  onBarsBack,
  speed,
  onChangeSpeed,
  isPickingStartBar = false,
  onTogglePickStartBar,
  theme,
}) => {
  // Keyboard shortcuts during active Replay Mode (Space = Play/Pause, ArrowLeft/Right = Step)
  useEffect(() => {
    if (!isReplayMode) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onStepForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onStepBack();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isReplayMode, onTogglePlay, onStepForward, onStepBack]);

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
      hour12: false,
    });
  };

  const hiddenCandlesCount = Math.max(0, totalCandles - 1 - replayIndex);
  const minReplayIdx = Math.min(5, Math.max(0, totalCandles - 1));

  const barsBackOptions = [25, 50, 100, 250, 500, 1000, 2000, 5000];
  const formatBarsLabel = (n: number) => (n >= 1000 ? `${n / 1000}K` : `${n}`);

  return (
    <div
      id="bar-replay-toolbar"
      className={`h-10 border-b border-sky-500/35 px-3 flex items-center justify-between gap-2 sm:gap-3 select-none z-30 shadow-md transition-colors overflow-x-auto overflow-y-hidden scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x ${
        isDark ? 'bg-neutral-950 text-white' : 'bg-white text-slate-800'
      }`}
      style={{
        backgroundColor: isDark ? preset.surfaceColor || '#0a0a0a' : '#ffffff',
      }}
    >
      {/* Left: Replay Status Badge, Candle Timestamp & Pick Bar Scissors */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-400 text-[11px] font-mono font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
          <span>REPLAY</span>
        </div>

        {/* Select / Cut Bar Directly on Chart */}
        {onTogglePickStartBar && (
          <button
            id="btn-replay-pick-bar"
            type="button"
            onClick={onTogglePickStartBar}
            title={
              isPickingStartBar
                ? 'Click any candle on the chart to start Replay from there (Click to cancel)'
                : 'Jump to Bar: Click any candle on the chart to cut history & start Replay there'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
              isPickingStartBar
                ? 'bg-amber-500 text-black border-amber-400 shadow animate-pulse'
                : isDark
                  ? 'bg-neutral-900 hover:bg-neutral-800 text-amber-300 border-amber-500/40 hover:border-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 shrink-0" />
            <span>{isPickingStartBar ? 'Scroll & Tap Bar...' : 'Jump to'}</span>
          </button>
        )}

        <div className={`hidden sm:flex items-center gap-1.5 text-xs font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <Calendar className="w-3.5 h-3.5 text-sky-400" />
          <span className={isDark ? 'text-neutral-200' : 'text-slate-800 font-medium'}>{formatDate(currentCandle?.time)}</span>
          <span className="opacity-40">•</span>
          <span>Bar {replayIndex + 1}/{totalCandles}</span>
          {hiddenCandlesCount > 0 && (
            <span
              className={`hidden xl:inline text-[10px] px-1.5 py-0.5 rounded border ${
                isDark ? 'text-sky-300/90 bg-neutral-900 border-neutral-800' : 'text-sky-700 bg-sky-50 border-sky-200'
              }`}
            >
              {hiddenCandlesCount} hidden
            </span>
          )}
        </div>
      </div>

      {/* Center: Playback Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <button
          id="btn-replay-jump-start"
          type="button"
          onClick={onJumpToStart}
          disabled={replayIndex <= minReplayIdx}
          title="Jump to Earliest Candle"
          className={`p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          id="btn-replay-step-back"
          type="button"
          onClick={onStepBack}
          disabled={replayIndex <= minReplayIdx}
          title="Step Back 1 Candle (Left Arrow)"
          className={`p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          id="btn-replay-play-pause"
          type="button"
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause Replay (Space)' : 'Play Candles Step-by-Step (Space)'}
          className={`px-3 py-1 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20'
              : 'bg-sky-600 text-white hover:bg-sky-500 shadow-sky-600/20'
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

        <button
          id="btn-replay-step-forward"
          type="button"
          onClick={onStepForward}
          disabled={replayIndex >= totalCandles - 1}
          title="Step Forward 1 Candle (Right Arrow)"
          className={`p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          id="btn-replay-jump-end"
          type="button"
          onClick={onJumpToEnd}
          disabled={replayIndex >= totalCandles - 1}
          title="Jump to Latest Candle"
          className={`p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>

        <div className={`w-px h-4 mx-1 hidden sm:block ${isDark ? 'bg-neutral-800' : 'bg-neutral-300'}`} />

        {/* Speed Switchers (0.5x, 1x, 2x, 5x, 10x) */}
        <div
          className={`flex items-center p-0.5 rounded border text-[11px] font-mono ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'
          }`}
        >
          {([0.5, 1, 2, 5, 10] as const).map((s) => (
            <button
              key={s}
              id={`btn-replay-speed-${s}x`}
              type="button"
              onClick={() => onChangeSpeed(s)}
              title={`Playback Speed: ${s}x`}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                speed === s
                  ? 'bg-sky-600 text-white shadow'
                  : isDark
                    ? 'text-neutral-400 hover:text-neutral-200'
                    : 'text-neutral-600 hover:text-slate-900'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Bars Back Selector */}
        <div className="flex items-center gap-1 ml-1">
          <span className={`hidden xl:inline text-[10px] font-mono font-semibold uppercase ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Back
          </span>
          <select
            id="select-replay-bars-back"
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) onBarsBack(val);
              e.target.selectedIndex = 0;
            }}
            defaultValue=""
            title="Jump replay position back by N bars"
            className={`text-[11px] font-mono font-bold rounded border px-1.5 py-0.5 cursor-pointer transition-colors outline-none ${
              isDark
                ? 'bg-neutral-900 border-neutral-800 text-sky-400 hover:border-sky-600/50'
                : 'bg-neutral-100 border-neutral-200 text-sky-700 hover:border-sky-400'
            }`}
          >
            <option value="" disabled>
              -Bars
            </option>
            {barsBackOptions.map((n) => (
              <option key={n} value={n}>
                -{formatBarsLabel(n)}
              </option>
            ))}
          </select>
        </div>

        {/* Scrubber slider */}
        <div className="hidden lg:flex items-center gap-2 ml-2 w-32 xl:w-44">
          <input
            type="range"
            min={minReplayIdx}
            max={Math.max(minReplayIdx + 1, totalCandles - 1)}
            value={Math.min(Math.max(minReplayIdx, replayIndex), Math.max(minReplayIdx, totalCandles - 1))}
            onChange={(e) => onSeek(parseInt(e.target.value, 10))}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-sky-500 ${
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
          type="button"
          onClick={onToggleReplayMode}
          title="Exit Bar Replay and return to Live Market Feed"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors border cursor-pointer ${
            isDark
              ? 'bg-neutral-900 hover:bg-red-950/40 text-neutral-300 hover:text-red-300 border-neutral-800 hover:border-red-900/50'
              : 'bg-neutral-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border-neutral-200 hover:border-red-300'
          }`}
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Live</span>
        </button>
      </div>
    </div>
  );
};
