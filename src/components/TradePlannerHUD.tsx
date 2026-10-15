/**
 * Trade Planner Buy Sell Signals, Stop Loss, TP & Lot Size [LunqFX]
 * Interactive Floating Table HUD
 * 100% exact styling and palette of TradingView Pine Script v6 by LunqFX
 */

import React, { useState } from 'react';
import { TradePlannerHud, LUNQ_PALETTE } from '../utils/tradePlannerLunqFX';
import { ChevronDown, ChevronUp, X, Crosshair } from 'lucide-react';

interface TradePlannerHUDProps {
  hud: TradePlannerHud | null;
  visible?: boolean;
  position?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left' | 'Middle Right';
  size?: 'Small' | 'Normal' | 'Large';
  onClose?: () => void;
}

export const TradePlannerHUD: React.FC<TradePlannerHUDProps> = ({
  hud,
  visible = true,
  position = 'Top Right',
  size = 'Normal',
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!visible || !hud) return null;

  // Determine positioning classes
  let posClasses = 'top-12 right-16';
  switch (position) {
    case 'Top Left':
      posClasses = 'top-12 left-4';
      break;
    case 'Bottom Right':
      posClasses = 'bottom-8 right-16';
      break;
    case 'Bottom Left':
      posClasses = 'bottom-8 left-4';
      break;
    case 'Middle Right':
      posClasses = 'top-1/2 -translate-y-1/2 right-16';
      break;
    case 'Top Right':
    default:
      posClasses = 'top-12 right-16';
      break;
  }

  // Size scaling
  const textScale = size === 'Small' ? 'text-[10px]' : size === 'Large' ? 'text-xs' : 'text-[11px]';
  const headerScale = size === 'Small' ? 'text-xs' : size === 'Large' ? 'text-sm' : 'text-xs';
  const widthClass = size === 'Small' ? 'w-64' : size === 'Large' ? 'w-80' : 'w-72';

  return (
    <div
      id="trade-planner-hud"
      className={`absolute ${posClasses} z-20 ${widthClass} border rounded-lg shadow-2xl backdrop-blur-md select-none transition-all duration-150 overflow-hidden font-mono`}
      style={{
        backgroundColor: LUNQ_PALETTE.CARD,
        borderColor: '#263346',
        color: LUNQ_PALETTE.TXT,
      }}
    >
      {/* Top Header Row (bgcolor = HEAD #0E141D, text_color = GOLD #FFD250) */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ backgroundColor: LUNQ_PALETTE.HEAD, borderColor: '#263346' }}
      >
        <div className="flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5" style={{ color: LUNQ_PALETTE.GOLD }} />
          <span className={`font-bold tracking-wider ${headerScale}`} style={{ color: LUNQ_PALETTE.GOLD }}>
            {hud.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold" style={{ color: LUNQ_PALETTE.MUTE }}>
            {hud.riskPctText}
          </span>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-0.5 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-0.5 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
              title="Close Trade Planner Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status Banner Row (hTx, bgcolor = hBg, text_color = TXT) */}
      <div
        className="px-3 py-1.5 flex items-center justify-between border-b text-xs font-semibold"
        style={{
          backgroundColor: hud.statusBg,
          borderColor: '#263346',
          color: LUNQ_PALETTE.TXT,
        }}
      >
        <span className="truncate">{hud.statusText}</span>
        {hud.active && (
          <span className="font-bold text-xs" style={{ color: hud.nowCol }}>
            {hud.nowStr}
          </span>
        )}
      </div>

      {/* Metric Rows */}
      {!isMinimized && (
        <div className={`p-2.5 space-y-1 ${textScale}`}>
          {hud.active ? (
            <>
              {/* Active Plan Metrics */}
              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Entry</span>
                <span className="font-bold text-white">{hud.entryStr}</span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.RISK }}>Stop Loss</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.RISK }}>
                  {hud.stopStr}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.UP }}>TP1 Target</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.UP }}>
                  {hud.tp1Str}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.UP }}>TP2 Target</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.UP }}>
                  {hud.tp2Str}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.UP }}>TP3 Target</span>
                <span className="font-bold" style={{ color: LUNQ_PALETTE.UP }}>
                  {hud.tp3Str}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded border-t"
                style={{ borderColor: '#263346', backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Position Size</span>
                <span className="font-bold text-amber-300">{hud.posStr}</span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Max Risk $</span>
                <span className="font-bold text-white">{hud.riskStr}</span>
              </div>
            </>
          ) : (
            <>
              {/* Standby Setup Metrics */}
              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Setup State</span>
                <span className="font-medium text-gray-200">Awaiting Trigger</span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Last Plan Result</span>
                <span
                  className="font-medium"
                  style={{
                    color: hud.lastPlanStr.includes('TP')
                      ? LUNQ_PALETTE.UP
                      : hud.lastPlanStr.includes('stopped')
                      ? LUNQ_PALETTE.RISK
                      : LUNQ_PALETTE.MUTE,
                  }}
                >
                  {hud.lastPlanStr}
                </span>
              </div>

              <div
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: LUNQ_PALETTE.CARD2 }}
              >
                <span style={{ color: LUNQ_PALETTE.MUTE }}>Risk Allocation</span>
                <span className="font-bold text-white">{hud.riskStr}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
