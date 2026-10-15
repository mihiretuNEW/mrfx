/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { DrawingType, ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';
import { 
  MousePointer, 
  TrendingUp, 
  Minus, 
  Percent, 
  Trash2, 
  Magnet, 
  Paintbrush,
  Square,
  ArrowRight,
  Route,
  ChevronRight,
  BarChart2
} from 'lucide-react';

interface LeftToolbarProps {
  activeTool: DrawingType;
  setActiveTool: (tool: DrawingType) => void;
  onClearDrawings: () => void;
  drawingsCount: number;
  isMagnetActive?: boolean;
  onToggleMagnet?: () => void;
  onOpenRiskRewardModal?: () => void;
  theme?: ChartThemeId;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activeTool,
  setActiveTool,
  onClearDrawings,
  drawingsCount,
  isMagnetActive = true,
  onToggleMagnet,
  onOpenRiskRewardModal,
  theme,
}) => {
  const isDark = isDarkTheme(theme);
  const preset = getThemePreset(theme);
  const [isBrushMenuOpen, setIsBrushMenuOpen] = useState(false);
  const [isRrMenuOpen, setIsRrMenuOpen] = useState(false);
  const brushMenuRef = useRef<HTMLDivElement>(null);
  const rrMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brushMenuRef.current && !brushMenuRef.current.contains(e.target as Node)) {
        setIsBrushMenuOpen(false);
      }
      if (rrMenuRef.current && !rrMenuRef.current.contains(e.target as Node)) {
        setIsRrMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const brushSubTools = [
    { id: 'brush' as DrawingType, label: 'Brush (Freehand)', icon: Paintbrush, color: 'text-amber-400' },
    { id: 'rectangle' as DrawingType, label: 'Rectangle', icon: Square, color: 'text-indigo-400' },
    { id: 'arrow' as DrawingType, label: 'Arrow', icon: ArrowRight, color: 'text-emerald-400' },
    { id: 'path' as DrawingType, label: 'Path (Polyline)', icon: Route, color: 'text-cyan-400' },
    { id: 'fixed_range_volume_profile' as DrawingType, label: 'Fixed Range Volume Profile', icon: BarChart2, color: 'text-orange-400' },
  ];

  const isBrushGroupActive = 
    activeTool === 'brush' || 
    activeTool === 'rectangle' || 
    activeTool === 'arrow' || 
    activeTool === 'path' || 
    activeTool === 'fixed_range_volume_profile';
  const currentBrushTool = brushSubTools.find(t => t.id === activeTool) || brushSubTools[0];
  const CurrentBrushIcon = currentBrushTool.icon;

  const mainTools = [
    { id: 'cursor' as DrawingType, label: 'Cursor (Drag/Edit)', icon: MousePointer, color: 'text-gray-400 hover:text-white' },
    { id: 'trend' as DrawingType, label: 'Trend Line', icon: TrendingUp, color: 'text-blue-400 hover:text-blue-300' },
    { id: 'horizontal' as DrawingType, label: 'Horizontal Line', icon: Minus, color: 'text-purple-400 hover:text-purple-300' },
  ];

  return (
    <div 
      id="left-toolbar" 
      className={`w-14 border-r flex flex-col items-center py-4 justify-between select-none z-10 transition-colors ${
        isDark ? 'bg-black border-neutral-800' : 'bg-white border-neutral-200 shadow-xs'
      }`}
      style={{
        backgroundColor: isDark ? preset.surfaceColor || '#000000' : '#ffffff',
        borderColor: isDark ? preset.borderColor : '#e2e8f0',
      }}
    >
      {/* Upper tools collection */}
      <div className="flex flex-col items-center gap-3 w-full">
        {mainTools.map((t) => {
          const isActive = activeTool === t.id;
          const Icon = t.icon;

          return (
            <button
              id={`tool-${t.id}`}
              key={t.id}
              onClick={() => {
                setIsBrushMenuOpen(false);
                setActiveTool(t.id);
              }}
              title={t.label}
              className={`p-2.5 rounded-lg transition-all relative group flex items-center justify-center ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg scale-105' 
                  : isDark 
                    ? 'text-gray-400 hover:bg-neutral-900 hover:text-white' 
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip bubble */}
              <div className={`absolute left-16 px-2.5 py-1.5 border text-xs font-medium rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 ${
                isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-slate-800 shadow-lg'
              }`}>
                {t.label}
              </div>
            </button>
          );
        })}

        {/* BRUSH TOOL WITH ARROW & PATH FLYOUT */}
        <div className="relative" ref={brushMenuRef}>
          <div className="relative group">
            <button
              id="tool-brush-main"
              onClick={() => {
                if (isBrushGroupActive) {
                  setIsBrushMenuOpen((prev) => !prev);
                } else {
                  setActiveTool(currentBrushTool.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsBrushMenuOpen(true);
              }}
              title={`${currentBrushTool.label} (Click to select, Right-click or arrow for Rectangle, Arrow & Path)`}
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center relative ${
                isBrushGroupActive 
                  ? 'bg-blue-600 text-white shadow-lg scale-105' 
                  : isDark 
                    ? 'text-gray-400 hover:bg-neutral-900 hover:text-white' 
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-slate-900'
              }`}
            >
              <CurrentBrushIcon className="w-5 h-5" />
              {/* Tiny triangle indicator for sub-tools */}
              <span className="absolute bottom-1 right-1 text-[8px] opacity-70 leading-none">▾</span>
            </button>

            {/* Quick Open Arrow Trigger Button on Hover */}
            <button
              id="tool-brush-expander"
              onClick={(e) => {
                e.stopPropagation();
                setIsBrushMenuOpen((prev) => !prev);
              }}
              title="Open Drawing Tools (Brush, Rectangle, Arrow, Path, Volume Profile)"
              className={`absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 rounded p-0.5 transition-opacity ${
                isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-gray-300' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
              }`}
            >
              <ChevronRight className="w-3 h-3" />
            </button>

            {/* Main Tooltip */}
            {!isBrushMenuOpen && (
              <div className={`absolute left-16 top-1 px-2.5 py-1.5 border text-xs font-medium rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 ${
                isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-slate-800 shadow-lg'
              }`}>
                {currentBrushTool.label} (Brush, Rectangle, Arrow, Path, FRVP)
              </div>
            )}
          </div>

          {/* FLYOUT SUB-MENU FOR BRUSH, ARROW, PATH & FRVP */}
          {isBrushMenuOpen && (
            <div 
              id="brush-sub-tools-menu" 
              className={`absolute left-16 top-0 border rounded-xl p-1.5 shadow-2xl z-50 w-52 flex flex-col gap-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-slate-800 shadow-xl'
              }`}
            >
              <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border-b ${
                isDark ? 'text-gray-500 border-neutral-800' : 'text-neutral-400 border-neutral-100'
              }`}>
                Drawing Tools
              </div>
              {brushSubTools.map((sub) => {
                const isSelected = activeTool === sub.id;
                const SubIcon = sub.icon;
                return (
                  <button
                    key={sub.id}
                    id={`subtool-${sub.id}`}
                    onClick={() => {
                      setActiveTool(sub.id);
                      setIsBrushMenuOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      isSelected 
                        ? 'bg-blue-600/90 text-white font-semibold' 
                        : isDark 
                          ? 'text-gray-300 hover:bg-neutral-900 hover:text-white' 
                          : 'text-slate-700 hover:bg-neutral-100 hover:text-slate-900'
                    }`}
                  >
                    <SubIcon className={`w-4 h-4 ${sub.color}`} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Risk/Reward Tool with Options Flyout */}
        <div className="relative" ref={rrMenuRef}>
          <div className="relative group">
            <button
              id="tool-risk_reward"
              onClick={() => {
                setIsBrushMenuOpen(false);
                if (activeTool === 'risk_reward') {
                  setIsRrMenuOpen((prev) => !prev);
                } else {
                  setActiveTool('risk_reward');
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsRrMenuOpen(true);
              }}
              title="Risk/Reward Tool (Click to draw, arrow for Write Options / Calculator)"
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center relative ${
                activeTool === 'risk_reward' 
                  ? 'bg-blue-600 text-white shadow-lg scale-105' 
                  : isDark 
                    ? 'text-gray-400 hover:bg-neutral-900 hover:text-white' 
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-slate-900'
              }`}
            >
              <Percent className="w-5 h-5" />
              {/* Triangle indicator */}
              <span className="absolute bottom-1 right-1 text-[8px] opacity-70 leading-none">▾</span>
            </button>

            {/* Expander Arrow */}
            <button
              id="tool-rr-expander"
              onClick={(e) => {
                e.stopPropagation();
                setIsRrMenuOpen((prev) => !prev);
              }}
              title="Open Risk/Reward Write Options & Calculator (Deriv MT5 Standard)"
              className={`absolute -right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 shadow transition-all border flex items-center justify-center z-10 ${
                isDark ? 'bg-neutral-800 hover:bg-blue-600 text-gray-300 hover:text-white border-neutral-700' : 'bg-neutral-100 hover:bg-blue-600 text-neutral-600 hover:text-white border-neutral-300'
              }`}
            >
              <ChevronRight className="w-2.5 h-2.5" />
            </button>

            {/* Tooltip */}
            {!isRrMenuOpen && (
              <div className={`absolute left-16 top-1 px-2.5 py-1.5 border text-xs font-medium rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 ${
                isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-slate-800 shadow-lg'
              }`}>
                Risk/Reward (Draw on chart or Write Options)
              </div>
            )}
          </div>

          {/* FLYOUT SUB-MENU FOR RISK/REWARD */}
          {isRrMenuOpen && (
            <div 
              id="rr-sub-tools-menu" 
              className={`absolute left-16 top-0 border rounded-xl p-1.5 shadow-2xl z-50 w-60 flex flex-col gap-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-slate-800 shadow-xl'
              }`}
            >
              <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border-b flex items-center justify-between ${
                isDark ? 'text-gray-400 border-neutral-800' : 'text-neutral-400 border-neutral-100'
              }`}>
                <span>Risk / Reward Tool</span>
                <span className="text-[9px] text-amber-500 font-mono">Deriv MT5</span>
              </div>

              <button
                id="subtool-rr-draw"
                onClick={() => {
                  setActiveTool('risk_reward');
                  setIsRrMenuOpen(false);
                }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeTool === 'risk_reward'
                    ? 'bg-blue-600/90 text-white font-semibold'
                    : isDark 
                      ? 'text-gray-300 hover:bg-neutral-900 hover:text-white' 
                      : 'text-slate-700 hover:bg-neutral-100 hover:text-slate-900'
                }`}
              >
                <Percent className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <div className="font-semibold">Interactive Draw (In Hand)</div>
                  <div className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-neutral-500'}`}>Click &amp; drag directly on chart</div>
                </div>
              </button>

              <button
                id="subtool-rr-write-options"
                onClick={() => {
                  setIsRrMenuOpen(false);
                  if (onOpenRiskRewardModal) {
                    onOpenRiskRewardModal();
                  }
                }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left border ${
                  isDark 
                    ? 'bg-neutral-900/60 hover:bg-neutral-850 text-amber-300 hover:text-amber-200 border-amber-500/20 hover:border-amber-500/40' 
                    : 'bg-amber-50/60 hover:bg-amber-100 text-amber-700 border-amber-300 hover:border-amber-400'
                }`}
              >
                <span className="w-5 h-5 flex items-center justify-center font-bold text-xs bg-amber-500/20 rounded border border-amber-500/40 shrink-0">
                  ✍️
                </span>
                <div>
                  <div className={`font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span>Write SL &amp; TP Options</span>
                  </div>
                  <div className="text-[10px] text-amber-500">Auto-calculate &amp; Draw (Deriv MT5)</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Separator line */}
        <div className={`w-8 h-px my-2 ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

        {/* Info label about active mode */}
        <div className={`text-[10px] font-medium text-center uppercase tracking-wider leading-none ${isDark ? 'text-gray-500' : 'text-neutral-400'}`}>
          {activeTool === 'cursor' ? 'Select' : 'Draw'}
        </div>
      </div>

      {/* Clear/Trash drawings controls at the bottom */}
      <div className="flex flex-col items-center gap-3 w-full">
        <button
          id="btn-clear-drawings"
          onClick={() => {
            if (drawingsCount === 0) return;
            onClearDrawings();
          }}
          disabled={drawingsCount === 0}
          title="Delete All Drawings"
          className={`p-2.5 rounded-lg transition-all relative group flex items-center justify-center ${
            drawingsCount > 0
              ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600'
              : isDark ? 'text-gray-600 cursor-not-allowed' : 'text-neutral-300 cursor-not-allowed'
          }`}
        >
          <Trash2 className="w-5 h-5" />
          {/* Badge counter */}
          {drawingsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1 rounded-full border border-black min-w-4 text-center">
              {drawingsCount}
            </span>
          )}
          <div className={`absolute left-16 px-2.5 py-1.5 border text-xs font-medium rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-slate-800 shadow-lg'
          }`}>
            Clear all drawings
          </div>
        </button>

        {/* Interactive Magnet Mode (Snap to OHLC) */}
        <button
          id="btn-toggle-magnet"
          onClick={onToggleMagnet}
          title={isMagnetActive ? "Magnet Mode: ACTIVE (Snapping to candle OHLC)" : "Magnet Mode: OFF (Click to snap to High/Low/Open/Close)"}
          className={`p-2 rounded-lg transition-all relative group flex flex-col items-center justify-center ${
            isMagnetActive 
              ? 'bg-blue-600/30 text-cyan-400 border border-cyan-500/50 shadow-md shadow-cyan-500/20' 
              : isDark 
                ? 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300 border border-transparent' 
                : 'text-neutral-400 hover:bg-neutral-100 hover:text-slate-800 border border-transparent'
          }`}
        >
          <Magnet className={`w-4 h-4 ${isMagnetActive ? 'text-cyan-500 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)] animate-pulse' : isDark ? 'text-neutral-500' : 'text-neutral-400'}`} />
          <span className={`text-[8px] font-mono mt-0.5 font-bold ${isMagnetActive ? 'text-cyan-500' : isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
            {isMagnetActive ? 'ON' : 'OFF'}
          </span>
          <div className={`absolute left-16 px-2.5 py-1.5 border text-xs font-medium rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-slate-800 shadow-lg'
          }`}>
            {isMagnetActive ? "Magnet Mode: ON (Snaps to High, Low, Open, Close)" : "Magnet Mode: OFF (Freehand)"}
          </div>
        </button>
      </div>
    </div>
  );
};
