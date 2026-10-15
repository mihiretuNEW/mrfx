/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { TimeframeId, SymbolInfo, ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';
import { TIMEFRAMES } from '../hooks/useDerivWS';
import { Settings, TrendingUp, Sun, Moon, LogOut, Camera, Star, ChevronDown, Check, RotateCcw, LayoutGrid, Square, Grid2X2, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TopToolbarProps {
  selectedSymbol: string;
  symbols: SymbolInfo[];
  selectedTimeframe: TimeframeId;
  onSelectTimeframe: (id: TimeframeId) => void;
  onOpenSymbolModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenIndicators?: () => void;
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
  onCaptureChart,
  isConnected,
  onReconnect,
  theme,
  onToggleTheme,
  favorites = [],
  onToggleFavorite,
  isReplayMode = false,
  onToggleReplayMode,
  layoutCount = 1,
  onChangeLayout,
  isChartOnly = false,
  onToggleChartOnly,
}) => {
  const symbolInfo = symbols.find((s) => s.symbol === selectedSymbol);
  const { logout } = useAuth();
  const isCurrentFavorite = favorites.includes(selectedSymbol);

  const [isTfDropdownOpen, setIsTfDropdownOpen] = useState(false);
  const tfDropdownRef = useRef<HTMLDivElement>(null);

  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const layoutDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tfDropdownRef.current && !tfDropdownRef.current.contains(event.target as Node)) {
        setIsTfDropdownOpen(false);
      }
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target as Node)) {
        setIsLayoutDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      className={`relative z-50 h-11 border-b flex items-center justify-between px-2.5 sm:px-3 select-none gap-2 shrink-0 transition-colors ${
        isDark 
          ? 'bg-black border-neutral-850 text-white' 
          : 'bg-white border-neutral-200 text-slate-800 shadow-xs'
      }`}
      style={{
        backgroundColor: isDark ? preset.surfaceColor || '#000000' : '#ffffff',
        borderColor: isDark ? preset.borderColor : '#e2e8f0',
      }}
    >
      {/* Left section: Brand, Pair Selector, Timeframe Dropdown (Vertical only), Indicators */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Mcharts Brand */}
        <div className="flex items-center gap-1 select-none pr-1">
          <span className={`font-sans font-black text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            M<span className="text-blue-500 font-semibold">charts</span>
          </span>
        </div>

        {/* Separator */}
        <div className={`w-px h-5 hidden sm:block ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

        {/* Dynamic symbol selector dropdown button */}
        <div className="flex items-center gap-1">
          <button
            id="btn-trigger-symbol-modal"
            onClick={onOpenSymbolModal}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold font-mono transition-all border ${
              isDark
                ? 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-800 hover:border-neutral-700'
                : 'bg-neutral-100 hover:bg-neutral-200 text-slate-900 border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>{selectedSymbol}</span>
            <span className={`text-[10px] font-normal truncate max-w-[90px] hidden md:inline ${isDark ? 'text-gray-400' : 'text-neutral-500'}`}>
              {symbolInfo ? `(${symbolInfo.display_name})` : ''}
            </span>
          </button>

          {/* Quick star button for active symbol */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(selectedSymbol)}
              className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
              title={isCurrentFavorite ? "Remove active symbol from favorites" : "Add active symbol to favorites"}
            >
              <Star className={`w-3.5 h-3.5 ${isCurrentFavorite ? 'text-amber-400 fill-amber-400' : isDark ? 'text-neutral-500 hover:text-amber-300' : 'text-neutral-400 hover:text-amber-500'}`} />
            </button>
          )}
        </div>

        {/* Timeframe Dropdown (Directly next to Pair on the left) */}
        <div className="relative" ref={tfDropdownRef}>
          <button
            id="btn-trigger-timeframe-dropdown"
            onClick={() => setIsTfDropdownOpen(!isTfDropdownOpen)}
            title="Timeframe Interval (Click to view vertical options)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold font-mono transition-all border ${
              isTfDropdownOpen
                ? isDark
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                  : 'bg-blue-50 text-blue-600 border-blue-400'
                : isDark
                  ? 'bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border-neutral-800 hover:border-neutral-700'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-slate-800 border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <span>{activeTfOption.label}</span>
            <ChevronDown 
              className={`w-3 h-3 transition-transform duration-150 ${
                isTfDropdownOpen ? 'rotate-180 text-blue-500' : isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`} 
            />
          </button>

          {/* TradingView-Style Vertical Dropdown */}
          {isTfDropdownOpen && (
            <div 
              id="dropdown-timeframes-vertical"
              className={`absolute left-0 top-full mt-1.5 w-52 rounded-lg shadow-2xl py-1 z-[100] border ${
                isDark 
                  ? 'bg-neutral-900/98 backdrop-blur-md border-neutral-800 divide-y divide-neutral-800/60' 
                  : 'bg-white border-neutral-200 divide-y divide-neutral-100'
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
                        onClick={() => {
                          onSelectTimeframe(item.id);
                          setIsTfDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors text-left ${
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
            </div>
          )}
        </div>

        {/* Separator */}
        <div className={`w-px h-5 hidden sm:block ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

        {/* Indicators Trigger - TradingView authentic fx style right next to timeframe */}
        <button
          id="btn-indicators-placeholder"
          onClick={handleIndicatorClick}
          title="Indicators, Metrics & Strategies"
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-all group border border-transparent ${
            isDark
              ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700/50'
              : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900 hover:border-neutral-300'
          }`}
        >
          <span className="font-serif italic font-extrabold text-[14px] leading-none text-blue-500 select-none">
            ƒx
          </span>
          <span className="hidden md:inline font-sans text-xs">Indicators</span>
        </button>

        {/* Separator */}
        <div className={`w-px h-5 hidden sm:block ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

        {/* Bar Replay Tool Button (LIVE ↔ REPLAY) */}
        <button
          id="btn-bar-replay-toggle"
          onClick={onToggleReplayMode}
          title={isReplayMode ? "Bar Replay Mode ACTIVE (Click to return to LIVE)" : "Bar Replay Tool: Backtest with step-by-step candles (LIVE → REPLAY)"}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all border ${
            isReplayMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/20'
              : isDark
                ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800 hover:border-neutral-700'
                : 'bg-neutral-100 hover:bg-neutral-200 text-slate-800 hover:text-slate-900 border-neutral-300 hover:border-neutral-400'
          }`}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isReplayMode ? 'text-amber-400 animate-spin-reverse' : isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />
          <span className="hidden sm:inline">Replay</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black tracking-wider ${
            isReplayMode 
              ? 'bg-amber-400 text-black shadow-sm' 
              : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
          }`}>
            {isReplayMode ? 'REPLAY' : 'LIVE'}
          </span>
        </button>
      </div>

      {/* Right utilities & configuration controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Multi-Chart Layout Grid Dropdown (1, 2, 4, 6 charts) */}
        <div className="relative" ref={layoutDropdownRef}>
          <button
            id="btn-trigger-layout-dropdown"
            onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
            title={`Multi-Chart Grid Layout (${layoutCount} ${layoutCount === 1 ? 'Chart' : 'Charts'})`}
            className={`flex items-center gap-1 p-1.5 rounded transition-colors text-xs font-bold border ${
              isLayoutDropdownOpen || layoutCount > 1
                ? 'bg-blue-600/25 text-blue-400 border-blue-500/50'
                : isDark
                  ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white border-transparent'
                  : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900 border-transparent'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            {layoutCount > 1 && (
              <span className={`text-[10px] font-mono font-bold px-1 rounded border ${
                isDark ? 'text-blue-400 bg-blue-950 border-blue-800' : 'text-blue-600 bg-blue-50 border-blue-300'
              }`}>
                {layoutCount}
              </span>
            )}
          </button>

          {/* Layout Switcher Dropdown */}
          {isLayoutDropdownOpen && (
            <div
              id="dropdown-layout-grid"
              className={`absolute right-0 top-full mt-1.5 w-48 rounded-lg shadow-2xl py-1.5 z-[110] border ${
                isDark
                  ? 'bg-neutral-900 border-neutral-800 divide-y divide-neutral-800/60'
                  : 'bg-white border-neutral-200 divide-y divide-neutral-100 text-slate-800'
              }`}
            >
              <div className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Multi-Chart Layout
              </div>
              <div className="p-1 space-y-0.5">
                {[
                  { count: 1 as const, label: 'Single Chart', desc: '1 Chart (Default full screen)' },
                  { count: 2 as const, label: '2 Charts (Split)', desc: 'Side-by-side Multi-Timeframe' },
                  { count: 4 as const, label: '4 Charts (2×2)', desc: 'Quad Multi-Timeframe grid' },
                  { count: 6 as const, label: '6 Charts (3×2)', desc: '6 Charts Multi-Timeframe' },
                ].map((item) => (
                  <button
                    key={item.count}
                    id={`btn-layout-${item.count}`}
                    onClick={() => {
                      if (onChangeLayout) onChangeLayout(item.count);
                      setIsLayoutDropdownOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between text-left text-xs transition-colors ${
                      layoutCount === item.count
                        ? isDark
                          ? 'bg-blue-600/20 text-blue-400 font-bold'
                          : 'bg-blue-50 text-blue-600 font-bold'
                        : isDark
                          ? 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                          : 'text-slate-700 hover:bg-neutral-100 hover:text-slate-900'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      <div className={`text-[10px] font-normal ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{item.desc}</div>
                    </div>
                    {layoutCount === item.count && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Capture screenshot button */}
        <button
          id="btn-capture-chart"
          onClick={onCaptureChart}
          title="Capture Chart Screenshot (PNG Download)"
          className={`p-1.5 rounded transition-colors flex items-center justify-center ${
            isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-slate-900'
          }`}
        >
          <Camera className="w-4 h-4 text-blue-500" />
        </button>

        {/* TradingView-style Fullscreen / Chart-Only Mode [] icon */}
        <button
          id="btn-toggle-chart-only"
          onClick={onToggleChartOnly}
          title={isChartOnly ? "Exit Fullscreen / Normal screen (Esc)" : "Fullscreen mode / Chart only [ ]"}
          aria-label={isChartOnly ? "Normal Screen" : "Chart Only Mode"}
          className={`p-1.5 rounded transition-colors flex items-center justify-center border border-transparent ${
            isChartOnly
              ? 'bg-blue-600/20 text-blue-400 font-bold border-blue-500/30'
              : isDark
                ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white'
                : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900'
          }`}
        >
          {isChartOnly ? (
            /* Minimize / Return to normal screen icon ][ */
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3v3H3M12 3v3h3M6 15v-3H3M12 15v-3h3" />
            </svg>
          ) : (
            /* TradingView classic [] expand icon */
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6V3h3M15 6V3h-3M3 12v3h3M15 12v3h-3" />
            </svg>
          )}
        </button>

        {/* Quick theme toggler */}
        <button
          id="btn-quick-theme"
          onClick={onToggleTheme}
          title={isDark ? "Switch to Off-Light White theme (Eye Comfort)" : "Switch to Dark theme"}
          className={`p-1.5 rounded transition-colors ${
            isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-slate-900'
          }`}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-blue-500" />
          )}
        </button>

        {/* Top PRO / FREE Suite button (Mpro2 · Master · Nexus) */}
        <button
          id="btn-top-toolbar-pro-suite"
          onClick={onOpenIndicators || onOpenSettingsModal}
          title="Mcharts PRO Suite: Mpro2 · Master · Nexus"
          className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-500 rounded text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>PRO</span>
        </button>

        {/* Settings modal trigger - TradingView style gear icon */}
        <button
          id="btn-trigger-settings-modal"
          onClick={onOpenSettingsModal}
          title="Chart Settings"
          className={`p-1.5 rounded transition-colors flex items-center justify-center border border-transparent ${
            isDark 
              ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700/50' 
              : 'hover:bg-neutral-100 text-slate-700 hover:text-slate-900 hover:border-neutral-300'
          }`}
        >
          <Settings className={`w-4 h-4 ${isDark ? 'text-neutral-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} strokeWidth={1.8} />
        </button>

        {/* Logout trigger */}
        <button
          id="btn-trigger-logout"
          onClick={logout}
          title="Log Out"
          className={`p-1.5 rounded transition-colors flex items-center justify-center ${
            isDark ? 'hover:bg-red-950/30 text-neutral-400 hover:text-red-400' : 'hover:bg-red-50 text-neutral-500 hover:text-red-500'
          }`}
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Separator */}
        <div className={`w-px h-4 hidden sm:block ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

        {/* Deriv WS connection indicator */}
        <button 
          onClick={onReconnect}
          title={isConnected ? "WebSocket Connected (Click to reconnect)" : "Connecting... (Click to retry)"}
          className={`flex items-center p-1 rounded transition-colors cursor-pointer ${isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}
        >
          <span className={`w-2 h-2 rounded-full shadow ${
            isConnected 
              ? 'bg-green-500 shadow-green-500/50' 
              : 'bg-red-500 shadow-red-500/50 animate-pulse'
          }`} />
        </button>
      </div>
    </div>
  );
};
