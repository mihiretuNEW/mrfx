/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TimeframeId, DrawingType, ChartSettings, Drawing, ChartThemeId } from '../types';
import { useDerivWS, TIMEFRAMES } from '../hooks/useDerivWS';
import { MihiretuViewChart } from './MihiretuViewChart';
import { Activity } from 'lucide-react';
import { isDarkTheme } from '../utils/themePresets';

interface MultiChartPaneProps {
  id: string;
  paneNumber: number;
  symbol: string;
  defaultTimeframe: TimeframeId;
  activeTool: DrawingType;
  setActiveTool: (tool: DrawingType) => void;
  settings: ChartSettings;
  isMagnetActive: boolean;
  isMproPro?: boolean;
  mproAccessMode?: 'free' | 'demo' | 'pro';
  onOpenMproModal?: () => void;
  isMpro2Pro?: boolean;
  mpro2AccessMode?: 'free' | 'demo' | 'pro';
  onOpenMpro2Modal?: () => void;
  onOpenSettingsModal?: (tab?: string) => void;
  theme?: ChartThemeId;
}

export const MultiChartPane: React.FC<MultiChartPaneProps> = ({
  id,
  paneNumber,
  symbol,
  defaultTimeframe,
  activeTool,
  setActiveTool,
  settings,
  isMagnetActive,
  isMproPro = false,
  mproAccessMode = 'demo',
  onOpenMproModal,
  isMpro2Pro = false,
  mpro2AccessMode = 'demo',
  onOpenMpro2Modal,
  onOpenSettingsModal,
  theme,
}) => {
  const currentTheme = theme || settings.theme;
  const isDark = isDarkTheme(currentTheme);
  const [timeframe, setTimeframe] = useState<TimeframeId>(defaultTimeframe);
  const [paneDrawings, setPaneDrawings] = useState<Drawing[]>([]);

  const { candles, isLoading, isConnected, isMarketClosed, reconnect } = useDerivWS(
    symbol,
    timeframe,
    settings.connection
  );

  return (
    <div 
      id={id} 
      className={`flex flex-col h-full w-full border rounded-md overflow-hidden relative transition-colors ${
        isDark ? 'bg-black border-neutral-850' : 'bg-white border-neutral-300'
      }`}
    >
      {/* Mini Pane Top Header */}
      <div className={`h-7 border-b px-2.5 flex items-center justify-between select-none shrink-0 text-xs transition-colors ${
        isDark ? 'bg-neutral-950 border-neutral-850 text-white' : 'bg-neutral-50 border-neutral-200 text-slate-800'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
            isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-slate-700'
          }`}>
            #{paneNumber}
          </span>
          <span className={`font-bold font-mono text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {symbol}
          </span>
          <span className="text-neutral-500 text-[11px]">•</span>
          {/* Quick timeframe selector */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.slice(0, 6).map((tf) => (
              <button
                key={tf.id}
                id={`btn-pane-${paneNumber}-tf-${tf.id}`}
                onClick={() => setTimeframe(tf.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  timeframe === tf.id
                    ? 'bg-blue-600 text-white font-bold'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isMarketClosed ? (
            <span className="text-[9px] text-neutral-500 font-mono uppercase">Closed</span>
          ) : (isLoading || !isConnected) ? (
            <div className="flex items-center gap-1 text-[10px] text-sky-400 font-mono">
              <div className="w-2.5 h-2.5 rounded-full border border-sky-400 border-t-transparent animate-spin shrink-0" />
              <span>Loading Live Market</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-grow w-full h-full min-h-0 relative">
        <MihiretuViewChart
          candles={candles}
          symbolName={symbol}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          drawings={paneDrawings}
          setDrawings={setPaneDrawings}
          settings={settings}
          timeframe={timeframe}
          isMagnetActive={isMagnetActive}
          isMproPro={isMproPro}
          mproAccessMode={mproAccessMode}
          onOpenMproModal={onOpenMproModal}
          isMpro2Pro={isMpro2Pro}
          mpro2AccessMode={mpro2AccessMode}
          onOpenMpro2Modal={onOpenMpro2Modal}
          onOpenSettingsModal={onOpenSettingsModal}
        />

        {/* Minimalist loader while loading live market - stays until chart is visible */}
        {(isLoading || candles.length === 0) && (
          <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center z-30 p-4 text-center select-none">
            <div className="relative w-9 h-9 mb-2.5">
              <div className="absolute inset-0 rounded-full border-2 border-sky-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
              <span>Loading Live Market...</span>
            </div>
            <button
              onClick={() => reconnect()}
              className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium rounded border border-neutral-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
