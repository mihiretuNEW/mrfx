/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TimeframeId, SymbolInfo, ChartThemeId, DrawingType } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';
import { TIMEFRAMES } from '../hooks/useDerivWS';
import { getSymbolSpec, getDefaultRrLot, getRrPointUnit } from '../utils/symbolSpecs';
import {
  Settings,
  Sun,
  Moon,
  LogOut,
  Star,
  ChevronDown,
  Check,
  RotateCcw,
  Target,
  SlidersHorizontal,
  BarChart3,
  Clock,
  Maximize2,
  Paintbrush,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TopToolbarProps {
  selectedSymbol: string;
  symbols: SymbolInfo[];
  selectedTimeframe: TimeframeId;
  onSelectTimeframe: (id: TimeframeId) => void;
  onOpenSymbolModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenIndicators?: () => void;
  onOpenRiskRewardModal?: () => void;
  onStartRRPlacement?: (config: { isLong: boolean; slPips: number; ratio: number; lotSize?: number; pickRatioOnChart?: boolean }) => void;
  isPlacingRR?: boolean;
  onCancelRRPlacement?: () => void;
  onCaptureChart?: () => void;
  isConnected: boolean;
  onReconnect?: () => void;
  theme: ChartThemeId;
  onToggleTheme: () => void;
  favorites?: string[];
  onToggleFavorite?: (symbol: string) => void;
  onSelectSymbol?: (symbol: string) => void;
  isReplayMode?: boolean;
  onToggleReplayMode?: () => void;
  layoutCount?: 1 | 2 | 4 | 6;
  onChangeLayout?: (count: 1 | 2 | 4 | 6) => void;
  isChartOnly?: boolean;
  onToggleChartOnly?: () => void;
  activeTool?: DrawingType;
  onToggleBrush?: () => void;
}

interface TimeframeOption {
  id: TimeframeId;
  label: string;
  name: string;
}

const TIMEFRAME_GROUPS: { category: string; items: TimeframeOption[] }[] = [
  {
    category: 'MINUTES',
    items: [
      { id: '1M', label: '1m', name: '1 minute' },
      { id: '2M', label: '2m', name: '2 minutes' },
      { id: '5M', label: '5m', name: '5 minutes' },
      { id: '15M', label: '15m', name: '15 minutes' },
      { id: '30M', label: '30m', name: '30 minutes' },
    ],
  },
  {
    category: 'HOURS',
    items: [
      { id: '1H', label: '1h', name: '1 hour' },
      { id: '4H', label: '4h', name: '4 hours' },
    ],
  },
  {
    category: 'DAYS',
    items: [
      { id: '1D', label: '1d', name: '1 day' },
    ],
  },
];

export const TopToolbar: React.FC<TopToolbarProps> = ({
  selectedSymbol,
  symbols,
  selectedTimeframe,
  onSelectTimeframe,
  onOpenSymbolModal,
  onOpenSettingsModal,
  onOpenIndicators,
  onOpenRiskRewardModal,
  onStartRRPlacement,
  isPlacingRR = false,
  onCancelRRPlacement,
  isConnected,
  onReconnect,
  theme,
  onToggleTheme,
  favorites = [],
  onToggleFavorite,
  isReplayMode = false,
  onToggleReplayMode,
  isChartOnly = false,
  onToggleChartOnly,
  activeTool = 'cursor',
  onToggleBrush,
}) => {
  const symbolInfo = symbols.find((s) => s.symbol === selectedSymbol);
  const { logout } = useAuth();
  const isCurrentFavorite = favorites.includes(selectedSymbol);

  const [isTfDropdownOpen, setIsTfDropdownOpen] = useState(false);
  const tfDropdownRef = useRef<HTMLDivElement>(null);
  const [tfCoords, setTfCoords] = useState<{ top: number; left: number } | null>(null);

  // Quick Risk/Reward Horizontal Bar State
  const [isQuickRrOpen, setIsQuickRrOpen] = useState(false);
  const quickRrRef = useRef<HTMLDivElement>(null);
  const [quickRrCoords, setQuickRrCoords] = useState<{ top: number; left: number } | null>(null);

  const [isLong, setIsLong] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mihiretu_rr_is_long');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [slPips, setSlPips] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('mihiretu_rr_sl_points_v2');
      return saved ? Number(saved) || 100 : 100;
    } catch {
      return 100;
    }
  });

  const activeSpec = getSymbolSpec(selectedSymbol, symbolInfo);
  const rrLot = getDefaultRrLot(activeSpec);
  const pointUnit = getRrPointUnit(activeSpec);
  const slDollarEstimate = (slPips * pointUnit * rrLot * (activeSpec.contractSize || 1));

  const updateTfCoords = useCallback(() => {
    if (tfDropdownRef.current) {
      const rect = tfDropdownRef.current.getBoundingClientRect();
      const dropdownWidth = 208;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - dropdownWidth - 8));
      const top = rect.bottom + 4;
      setTfCoords({ top, left });
    }
  }, []);

  const updateQuickRrCoords = useCallback(() => {
    if (quickRrRef.current) {
      const rect = quickRrRef.current.getBoundingClientRect();
      const top = rect.bottom + 4;
      const left = Math.max(8, Math.min(rect.left, Math.max(8, window.innerWidth - 360)));
      setQuickRrCoords({ top, left });
    }
  }, []);

  const handleToggleTf = () => {
    if (!isTfDropdownOpen) {
      updateTfCoords();
      setIsTfDropdownOpen(true);
    } else {
      setIsTfDropdownOpen(false);
    }
  };

  const handleToggleQuickRr = () => {
    if (!isQuickRrOpen) {
      updateQuickRrCoords();
      setIsQuickRrOpen(true);
    } else {
      setIsQuickRrOpen(false);
    }
  };

  useEffect(() => {
    if (!isTfDropdownOpen && !isQuickRrOpen) return;
    const handleReposition = () => {
      if (isTfDropdownOpen) updateTfCoords();
      if (isQuickRrOpen) updateQuickRrCoords();
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isTfDropdownOpen, isQuickRrOpen, updateTfCoords, updateQuickRrCoords]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        tfDropdownRef.current && 
        !tfDropdownRef.current.contains(target) &&
        !document.getElementById('dropdown-timeframes-vertical')?.contains(target)
      ) {
        setIsTfDropdownOpen(false);
      }
      if (
        quickRrRef.current && 
        !quickRrRef.current.contains(target) &&
        !document.getElementById('quick-rr-horizontal-bar')?.contains(target)
      ) {
        setIsQuickRrOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectRatio = (ratio: number) => {
    setIsQuickRrOpen(false);
    if (onStartRRPlacement) {
      onStartRRPlacement({ isLong, slPips, ratio, lotSize: rrLot, pickRatioOnChart: false });
    } else if (onOpenRiskRewardModal) {
      onOpenRiskRewardModal();
    }
  };

  const handleStartTapAndPickRatio = () => {
    setIsQuickRrOpen(false);
    if (onStartRRPlacement) {
      onStartRRPlacement({ isLong, slPips, ratio: 3, lotSize: rrLot, pickRatioOnChart: true });
    }
  };

  const handleIndicatorClick = () => {
    if (onOpenIndicators) {
      onOpenIndicators();
    }
  };

  const activeTfOption = TIMEFRAMES.find((t) => t.id === selectedTimeframe) || {
    id: selectedTimeframe,
    label: selectedTimeframe,
  };

  const isDark = isDarkTheme(theme);
  const preset = getThemePreset(theme);

  return (
    <div 
      id="top-toolbar" 
      className={`relative z-40 border-b select-none shrink-0 transition-colors ${
        isDark 
          ? 'bg-[#12131c] border-neutral-800 text-white' 
          : 'bg-white border-neutral-200 text-slate-800 shadow-xs'
      }`}
      style={{
        backgroundColor: isDark ? preset.surfaceColor || '#12131c' : '#ffffff',
        borderColor: isDark ? preset.borderColor : '#e2e8f0',
      }}
    >
      {/* 1. TOP ROW: Horizontally scrollable icons & tools so TF, Settings, Logout are never hidden on mobile */}
      <div
        className="w-full h-10 border-b border-neutral-800/40 overflow-x-auto overflow-y-hidden scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex items-center justify-between min-w-max w-full h-full px-2 sm:px-3 gap-3 whitespace-nowrap">
          {/* Left: fx (Indicators), R:R Tool, Hand Brush, Replay */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Indicators Trigger - Authentic fx serif style */}
          <button
            id="btn-indicators-placeholder"
            onClick={handleIndicatorClick}
            title="Indicators, Metrics & Strategies (fx)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              isDark
                ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white'
                : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
            }`}
          >
            <span className="font-serif italic font-extrabold text-[15px] leading-none text-sky-400 select-none">
              ƒx
            </span>
            <span className="hidden md:inline font-sans text-xs">Indicators</span>
          </button>

          {/* Risk / Reward Interactive Tool Selector */}
          {(onStartRRPlacement || onOpenRiskRewardModal) && (
            <div className="relative" ref={quickRrRef}>
              <button
                id="btn-top-toolbar-risk-reward"
                type="button"
                onClick={() => {
                  if (isPlacingRR && onCancelRRPlacement) {
                    onCancelRRPlacement();
                  } else {
                    handleToggleQuickRr();
                  }
                }}
                title={isPlacingRR ? "Click to cancel placement" : "Risk / Reward Tool: Choose 1:2, 1:3, 1:4"}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold font-mono transition-all border cursor-pointer ${
                  isPlacingRR
                    ? 'bg-amber-500 text-black border-amber-400 animate-pulse shadow-md'
                    : isQuickRrOpen
                      ? isDark
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                        : 'bg-blue-600 text-white border-blue-700 shadow-md'
                      : isDark
                        ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/40 hover:border-blue-500/70 shadow-xs'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 hover:border-blue-400 shadow-xs'
                }`}
              >
                <span>{isPlacingRR ? '🎯 Tap Chart...' : 'R:R Tool'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isQuickRrOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {/* Hand Brush Freehand Drawing Tool Button on Dashboard */}
          {onToggleBrush && (
            <button
              id="btn-top-toolbar-brush"
              type="button"
              onClick={onToggleBrush}
              title={activeTool === 'brush' ? 'Hand Brush ON — Write on candles/chart (Click or Esc for Cursor)' : 'Hand Brush — Draw or write freely on candles (stays locked across timeframes)'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all border cursor-pointer ${
                activeTool === 'brush'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30 ring-1 ring-amber-300'
                  : isDark
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/35 hover:border-amber-400/70'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300 hover:border-amber-400'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5 shrink-0" />
              <span>{activeTool === 'brush' ? 'Brush ON' : 'Brush'}</span>
            </button>
          )}

          {/* Bar Replay Tool Toggle (LIVE ↔ REPLAY) — visible across all viewports */}
          {onToggleReplayMode && (
            <button
              id="btn-bar-replay-toggle"
              type="button"
              onClick={onToggleReplayMode}
              title={isReplayMode ? "Bar Replay Mode ACTIVE — Click to exit back to LIVE" : "Start Bar Replay Mode (Backtest candle-by-candle)"}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all border cursor-pointer ${
                isReplayMode
                  ? 'bg-sky-500 text-black border-sky-400 shadow-md shadow-sky-500/30 ring-1 ring-sky-300'
                  : isDark
                    ? 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/35 hover:border-sky-400/70'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-300 hover:border-sky-400'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${isReplayMode ? 'animate-spin-reverse' : ''}`} />
              <span>{isReplayMode ? 'Replay ON' : 'Replay'}</span>
            </button>
          )}
        </div>

        {/* Right side icons: BarChart (|||), Clock, Maximize2, Sun, Settings, LogOut, Dot */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Chart Style / Indicators BarChart icon (|||) */}
          <button
            type="button"
            onClick={handleIndicatorClick}
            title="Chart Display & Indicators (|||)"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          {/* Timeframe Clock icon + active TF trigger */}
          <div className="relative" ref={tfDropdownRef}>
            <button
              id="btn-trigger-timeframe-dropdown"
              type="button"
              onClick={handleToggleTf}
              title={`Timeframe Interval (${activeTfOption.label}) - Click to select`}
              className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors cursor-pointer ${
                isTfDropdownOpen
                  ? 'bg-blue-600/20 text-blue-400'
                  : isDark
                    ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white'
                    : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-mono font-bold">{activeTfOption.label}</span>
            </button>
          </div>

          {/* Fullscreen [ ] toggle */}
          <button
            id="btn-toggle-chart-only"
            onClick={onToggleChartOnly}
            title={isChartOnly ? "Exit Fullscreen" : "Fullscreen mode [ ]"}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Sun / Theme toggle */}
          <button
            id="btn-quick-theme"
            onClick={onToggleTheme}
            title={isDark ? "Switch theme" : "Switch to Dark theme"}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-slate-900'
            }`}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-500" />
            )}
          </button>

          {/* Settings gear */}
          <button
            id="btn-trigger-settings-modal"
            onClick={onOpenSettingsModal}
            title="Chart Settings"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* LogOut */}
          <button
            id="btn-trigger-logout"
            onClick={logout}
            title="Log Out"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:bg-red-950/30 text-neutral-400 hover:text-red-400' : 'hover:bg-red-50 text-neutral-500 hover:text-red-500'
            }`}
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Deriv WS connection indicator dot */}
          <button 
            onClick={onReconnect}
            title={isConnected ? "WebSocket Connected (Click to reconnect)" : "Connecting... (Click to retry)"}
            className="p-1 rounded cursor-pointer"
          >
            <span className={`w-2.5 h-2.5 rounded-full inline-block shadow ${
              isConnected 
                ? 'bg-emerald-500 shadow-emerald-500/60' 
                : 'bg-red-500 shadow-red-500/60 animate-pulse'
            }`} />
          </button>
        </div>
        </div>
      </div>

      {/* 2. SUB-ROW: Favorite Star, Pair Symbol, LIVE badge, and Expand icon */}
      <div
        className="w-full h-8 text-xs bg-neutral-950/30 overflow-x-auto overflow-y-hidden scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex items-center justify-between min-w-max w-full h-full px-2 sm:px-3 gap-2 whitespace-nowrap">
          <div className="flex items-center gap-2 shrink-0">
          {/* Favorite Star Button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(selectedSymbol)}
              className="p-0.5 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
              title={isCurrentFavorite ? "Remove favorite" : "Add to favorites"}
            >
              <Star className={`w-4 h-4 ${isCurrentFavorite ? 'text-amber-400 fill-amber-400' : 'text-neutral-400 hover:text-amber-400'}`} />
            </button>
          )}

          {/* Symbol + Display Name Button (opens symbol modal) */}
          <button
            onClick={onOpenSymbolModal}
            className="flex items-center gap-2 font-bold tracking-wide text-neutral-200 hover:text-white transition-colors cursor-pointer"
            title="Click to search other symbols/pairs"
          >
            <span className="font-mono text-xs text-sky-400 font-extrabold">{selectedSymbol}</span>
            <span className="text-[11px] text-gray-300 font-sans uppercase">
              {symbolInfo?.display_name ? symbolInfo.display_name.toUpperCase() : 'VOLATILITY 75 INDEX'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* • LIVE badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </div>

          {/* Quick Expand [ ] */}
          <button
            onClick={onToggleChartOnly}
            title="Fullscreen / Chart Only"
            className="text-neutral-400 hover:text-white transition-colors p-0.5 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
        </div>
      </div>

      {/* TradingView-Style Vertical Dropdown via Portal */}
      {isTfDropdownOpen && tfCoords && createPortal(
        <div 
          id="dropdown-timeframes-vertical"
          style={{
            position: 'fixed',
            top: `${tfCoords.top}px`,
            left: `${tfCoords.left}px`,
            zIndex: 99999,
          }}
          className={`w-52 rounded-lg shadow-2xl py-1 border animate-in fade-in zoom-in-95 duration-100 max-h-[85vh] overflow-y-auto select-none ${
            isDark 
              ? 'bg-neutral-900/98 backdrop-blur-md border-neutral-700 divide-y divide-neutral-800/60 shadow-black/90' 
              : 'bg-white border-neutral-200 divide-y divide-neutral-100 shadow-xl'
          }`}
        >
          {TIMEFRAME_GROUPS.map((group) => (
            <div key={group.category} className="py-1">
              <div className={`px-3 py-1 text-[9px] font-bold tracking-wider uppercase ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {group.category}
              </div>
              {group.items.map((item) => {
                const isSelected = selectedTimeframe === item.id;
                return (
                  <button
                    key={item.id}
                    id={`tf-option-${item.id}`}
                    type="button"
                    onClick={() => {
                      onSelectTimeframe(item.id);
                      setIsTfDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors text-left cursor-pointer ${
                      isSelected 
                        ? isDark
                          ? 'bg-blue-600/20 text-blue-400 font-bold'
                          : 'bg-blue-50 text-blue-600 font-bold' 
                        : isDark
                          ? 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                          : 'text-slate-700 hover:bg-neutral-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold w-7">{item.label}</span>
                      <span className={`text-[11px] font-normal ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{item.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Horizontal Quick R:R Bar via Portal */}
      {isQuickRrOpen && quickRrCoords && createPortal(
        <div
          id="quick-rr-horizontal-bar"
          style={{
            position: 'fixed',
            top: `${quickRrCoords.top}px`,
            left: `${quickRrCoords.left}px`,
            zIndex: 99999,
          }}
          className={`py-1 px-2 rounded-lg shadow-2xl border flex items-center gap-2 text-xs font-mono select-none backdrop-blur-md whitespace-nowrap max-w-[calc(100vw-16px)] overflow-x-auto scrollbar-none animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? 'bg-neutral-900/98 border-neutral-700 text-white shadow-black/90'
              : 'bg-white/98 border-neutral-300 text-slate-900 shadow-xl'
          }`}
        >
          {/* 1. Long / Short Direction Toggle */}
          <div className="flex items-center rounded p-0.5 bg-black/20 border border-neutral-700/40">
            <button
              type="button"
              id="btn-rr-dir-long"
              onClick={() => {
                setIsLong(true);
                try { localStorage.setItem('mihiretu_rr_is_long', 'true'); } catch (e) {}
              }}
              title="Target Long / Buy Setup"
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                isLong
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              LONG
            </button>
            <button
              type="button"
              id="btn-rr-dir-short"
              onClick={() => {
                setIsLong(false);
                try { localStorage.setItem('mihiretu_rr_is_long', 'false'); } catch (e) {}
              }}
              title="Target Short / Sell Setup"
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                !isLong
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              SHORT
            </button>
          </div>

          {/* 2. SL Points (Pips) quick input + live $ preview (100 pts = $1, 1000 pts = $10) */}
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>SL:</span>
            <input
              type="number"
              id="input-quick-rr-sl-pips"
              min={1}
              value={slPips}
              onChange={(e) => {
                const val = Math.max(1, Number(e.target.value) || 100);
                setSlPips(val);
                try { localStorage.setItem('mihiretu_rr_sl_points_v2', String(val)); } catch (err) {}
              }}
              className={`w-14 px-1.5 py-0.5 rounded text-center text-xs font-bold border transition-colors ${
                isDark
                  ? 'bg-black/40 border-neutral-700 text-white focus:border-blue-500'
                  : 'bg-neutral-100 border-neutral-300 text-slate-900 focus:border-blue-500'
              }`}
            />
            <span className={`text-[10px] font-bold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
              pts (-${slDollarEstimate.toFixed(2)})
            </span>
          </div>

          {/* Quick SL Point Presets: 100 ($1), 200 ($2), 500 ($5), 1000 ($10) */}
          <div className="flex items-center gap-1">
            {[100, 200, 500, 1000].map((pts) => (
              <button
                key={pts}
                type="button"
                onClick={() => {
                  setSlPips(pts);
                  try { localStorage.setItem('mihiretu_rr_sl_points_v2', String(pts)); } catch (err) {}
                }}
                title={`${pts} points = $${(pts * pointUnit * rrLot * (activeSpec.contractSize || 1)).toFixed(2)} risk at ${rrLot} lot`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  slPips === pts
                    ? 'bg-rose-600/30 text-rose-300 border-rose-500/60'
                    : isDark
                      ? 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-slate-700 border-neutral-300'
                }`}
              >
                {pts}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className={`w-px h-5 ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

          {/* 3. Quick Ratio Pickers (1:1, 1:1.5, 1:2, 1:3, 1:4, 1:5) */}
          <div className="flex items-center gap-1">
            {[1, 1.5, 2, 3, 4, 5].map((ratio) => (
              <button
                key={ratio}
                type="button"
                id={`btn-rr-ratio-1-${String(ratio).replace('.', '_')}`}
                onClick={() => handleSelectRatio(ratio)}
                title={`Select 1:${ratio} Ratio (TP: ${Math.round(slPips * ratio)} pts = +$${(slDollarEstimate * ratio).toFixed(2)}) — Tap chart to draw`}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800 hover:bg-blue-600/40 text-neutral-200 hover:text-white border-neutral-700 hover:border-blue-500'
                    : 'bg-neutral-100 hover:bg-blue-100 text-slate-800 border-neutral-300 hover:border-blue-400'
                }`}
              >
                1:{ratio}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className={`w-px h-5 ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

          {/* Tap Chart First & Pick Ratio on Chart */}
          {onStartRRPlacement && (
            <button
              type="button"
              id="btn-rr-tap-pick-on-chart"
              onClick={handleStartTapAndPickRatio}
              title="Tap anywhere on chart first, then choose R:R ratio right on the chart"
              className="px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-500/50 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Target className="w-3 h-3" />
              <span>Tap &amp; Pick Ratio</span>
            </button>
          )}

          {/* 4. Advanced Full Modal Trigger */}
          {onOpenRiskRewardModal && (
            <button
              type="button"
              onClick={() => {
                setIsQuickRrOpen(false);
                onOpenRiskRewardModal();
              }}
              title="Open Full Deriv MT5 Lot & Dollar Calculator Modal"
              className={`p-1 rounded transition-colors cursor-pointer ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
