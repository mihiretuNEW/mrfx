/**
 * Risk/Reward Interactive Placement & Calculation Modal
 * Allows traders to explicitly write Entry, SL, TP (by price or by dollar risk/reward),
 * and calculates exact Deriv MT5 standard rewards (e.g. Jump 10: 0.01 lot, 200 pts = $2.00, 714 pts = $7.14).
 * Spawns and updates the Risk/Reward tool directly on the chart canvas.
 */

import React, { useState, useEffect } from 'react';
import { ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';
import { SymbolSpec, calculateProfitLoss, calculateStopPriceFromRisk, calculateTargetPriceFromReward } from '../utils/symbolSpecs';
import { X, Percent, ArrowUpRight, RotateCcw, Check, Sparkles, Target, Shield, HelpCircle } from 'lucide-react';

interface RiskRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrice: number;
  symbolSpec: SymbolSpec;
  symbolName: string;
  initialValues?: {
    isLong: boolean;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    lotSize: number;
  } | null;
  onApplySetup: (setup: {
    isLong: boolean;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    lotSize: number;
  }) => void;
  theme?: ChartThemeId;
}

export const RiskRewardModal: React.FC<RiskRewardModalProps> = ({
  isOpen,
  onClose,
  currentPrice,
  symbolSpec,
  symbolName,
  initialValues,
  onApplySetup,
  theme,
}) => {
  const isDark = isDarkTheme(theme);
  const preset = getThemePreset(theme);
  const decimals = symbolSpec.pointSize < 0.01 ? 4 : 2;

  const [isLong, setIsLong] = useState<boolean>(true);
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice || 96371.56);
  const [stopPrice, setStopPrice] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [lotSize, setLotSize] = useState<number>(symbolSpec.minLot || 0.01);

  // Pip conversion factor: 1 pip in price units
  const pipUnit = symbolSpec.pipSize > 0 ? symbolSpec.pipSize : (symbolSpec.pointSize || 0.01);

  // String buffers for smooth numerical editing
  const [entryInput, setEntryInput] = useState<string>('');
  const [stopInput, setStopInput] = useState<string>('');
  const [targetInput, setTargetInput] = useState<string>('');
  const [slPipsInput, setSlPipsInput] = useState<string>('200');
  const [tpPipsInput, setTpPipsInput] = useState<string>('600');
  const [riskDollarInput, setRiskDollarInput] = useState<string>('');
  const [rewardDollarInput, setRewardDollarInput] = useState<string>('');
  const [lotInput, setLotInput] = useState<string>('');

  // Synchronize initial state when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      const activeLot = initialValues?.lotSize || symbolSpec.minLot || 0.01;
      const longMode = initialValues ? initialValues.isLong : true;
      const initialEntry = initialValues?.entryPrice || currentPrice || 96371.56;

      let initialStop: number;
      let initialTarget: number;

      if (initialValues) {
        initialStop = initialValues.stopPrice;
        initialTarget = initialValues.targetPrice;
      } else {
        const cleanUpper = (symbolSpec.cleanCode || symbolSpec.symbol || '').toUpperCase();
        const isVol75 = cleanUpper.includes('75') || symbolSpec.displayName.includes('75');
        const isJump10 = cleanUpper.includes('JD10') || cleanUpper.includes('JUMP10') || symbolSpec.displayName.includes('Jump 10');

        if (isVol75) {
          // Standard Volatility 75: 200 pips SL, 600 pips TP (1:3 ratio)
          const slDist = 200 * pipUnit;
          const tpDist = 600 * pipUnit;
          initialStop = longMode ? initialEntry - slDist : initialEntry + slDist;
          initialTarget = longMode ? initialEntry + tpDist : initialEntry - tpDist;
        } else if (isJump10) {
          // Exact Deriv Jump 10 Standard: 0.01 min lot, 200 pts SL ($2.00) & 713.51 pts TP ($7.14)
          const defaultDiff = 200;
          const defaultTpDiff = 713.51;
          initialStop = longMode ? initialEntry - defaultDiff : initialEntry + defaultDiff;
          initialTarget = longMode ? initialEntry + defaultTpDiff : initialEntry - defaultTpDiff;
        } else {
          // Default 1:3 R:R setup based on symbol volatility or 200 points default
          const defaultDiff = initialEntry > 1000 ? 200 : initialEntry * 0.005;
          initialStop = longMode ? initialEntry - defaultDiff : initialEntry + defaultDiff;
          initialTarget = longMode ? initialEntry + defaultDiff * 3 : initialEntry - defaultDiff * 3;
        }
      }

      setIsLong(longMode);
      setEntryPrice(initialEntry);
      setStopPrice(initialStop);
      setTargetPrice(initialTarget);
      setLotSize(activeLot);

      setEntryInput(initialEntry.toFixed(decimals));
      setStopInput(initialStop.toFixed(decimals));
      setTargetInput(initialTarget.toFixed(decimals));
      setLotInput(activeLot.toFixed(symbolSpec.minLot < 0.01 ? 3 : 2));

      const slDist = Math.abs(initialEntry - initialStop);
      const tpDist = Math.abs(initialTarget - initialEntry);
      setSlPipsInput(Math.round(slDist / pipUnit).toString());
      setTpPipsInput(Math.round(tpDist / pipUnit).toString());

      // Calculate Dollar rewards
      const slPnl = calculateProfitLoss(initialEntry, initialStop, activeLot, longMode, symbolSpec, currentPrice);
      const tpPnl = calculateProfitLoss(initialEntry, initialTarget, activeLot, longMode, symbolSpec, currentPrice);
      setRiskDollarInput(slPnl !== null ? Math.abs(slPnl).toFixed(2) : '2.00');
      setRewardDollarInput(tpPnl !== null ? Math.abs(tpPnl).toFixed(2) : '6.00');
    }
  }, [isOpen, initialValues, currentPrice, symbolSpec, pipUnit, decimals]);

  if (!isOpen) return null;

  // Handle updates when Entry changes
  const handleEntryChange = (valStr: string) => {
    setEntryInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setEntryPrice(parsed);
      const slPips = parseFloat(slPipsInput) || 200;
      const tpPips = parseFloat(tpPipsInput) || 600;
      const slDist = slPips * pipUnit;
      const tpDist = tpPips * pipUnit;
      const newStop = isLong ? parsed - slDist : parsed + slDist;
      const newTarget = isLong ? parsed + tpDist : parsed - tpDist;
      setStopPrice(newStop);
      setTargetPrice(newTarget);
      setStopInput(newStop.toFixed(decimals));
      setTargetInput(newTarget.toFixed(decimals));
      const slPnl = calculateProfitLoss(parsed, newStop, lotSize, isLong, symbolSpec, currentPrice);
      const tpPnl = calculateProfitLoss(parsed, newTarget, lotSize, isLong, symbolSpec, currentPrice);
      if (slPnl !== null) setRiskDollarInput(Math.abs(slPnl).toFixed(2));
      if (tpPnl !== null) setRewardDollarInput(Math.abs(tpPnl).toFixed(2));
    }
  };

  // Handle updates when SL Pips changes directly
  const handleSlPipsChange = (pipsStr: string) => {
    setSlPipsInput(pipsStr);
    const pips = parseFloat(pipsStr);
    if (!isNaN(pips) && pips > 0) {
      const dist = pips * pipUnit;
      const newStop = isLong ? entryPrice - dist : entryPrice + dist;
      setStopPrice(newStop);
      setStopInput(newStop.toFixed(decimals));
      const pnl = calculateProfitLoss(entryPrice, newStop, lotSize, isLong, symbolSpec, currentPrice);
      if (pnl !== null) {
        setRiskDollarInput(Math.abs(pnl).toFixed(2));
      }
    }
  };

  // Handle updates when TP Pips changes directly
  const handleTpPipsChange = (pipsStr: string) => {
    setTpPipsInput(pipsStr);
    const pips = parseFloat(pipsStr);
    if (!isNaN(pips) && pips > 0) {
      const dist = pips * pipUnit;
      const newTarget = isLong ? entryPrice + dist : entryPrice - dist;
      setTargetPrice(newTarget);
      setTargetInput(newTarget.toFixed(decimals));
      const pnl = calculateProfitLoss(entryPrice, newTarget, lotSize, isLong, symbolSpec, currentPrice);
      if (pnl !== null) {
        setRewardDollarInput(Math.abs(pnl).toFixed(2));
      }
    }
  };

  // Handle updates when SL price changes
  const handleStopPriceChange = (valStr: string) => {
    setStopInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setStopPrice(parsed);
      const dist = Math.abs(entryPrice - parsed);
      setSlPipsInput(Math.round(dist / pipUnit).toString());
      const pnl = calculateProfitLoss(entryPrice, parsed, lotSize, isLong, symbolSpec, currentPrice);
      if (pnl !== null) {
        setRiskDollarInput(Math.abs(pnl).toFixed(2));
      }
    }
  };

  // Handle updates when Risk Dollar ($) changes
  const handleRiskDollarChange = (valStr: string) => {
    setRiskDollarInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      const newStop = calculateStopPriceFromRisk(entryPrice, parsed, lotSize, isLong, symbolSpec, currentPrice);
      setStopPrice(newStop);
      setStopInput(newStop.toFixed(decimals));
      const dist = Math.abs(entryPrice - newStop);
      setSlPipsInput(Math.round(dist / pipUnit).toString());
    }
  };

  // Handle updates when TP price changes
  const handleTargetPriceChange = (valStr: string) => {
    setTargetInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setTargetPrice(parsed);
      const dist = Math.abs(parsed - entryPrice);
      setTpPipsInput(Math.round(dist / pipUnit).toString());
      const pnl = calculateProfitLoss(entryPrice, parsed, lotSize, isLong, symbolSpec, currentPrice);
      if (pnl !== null) {
        setRewardDollarInput(Math.abs(pnl).toFixed(2));
      }
    }
  };

  // Handle updates when Reward Dollar ($) changes
  const handleRewardDollarChange = (valStr: string) => {
    setRewardDollarInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      const newTarget = calculateTargetPriceFromReward(entryPrice, parsed, lotSize, isLong, symbolSpec, currentPrice);
      setTargetPrice(newTarget);
      setTargetInput(newTarget.toFixed(decimals));
      const dist = Math.abs(newTarget - entryPrice);
      setTpPipsInput(Math.round(dist / pipUnit).toString());
    }
  };

  // Handle updates when Lot Size changes
  const handleLotChange = (valStr: string) => {
    setLotInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.max(symbolSpec.minLot, Number(parsed.toFixed(symbolSpec.minLot < 0.01 ? 3 : 2)));
      setLotSize(clamped);
      // Recalculate dollar amounts with existing prices
      const slPnl = calculateProfitLoss(entryPrice, stopPrice, clamped, isLong, symbolSpec, currentPrice);
      const tpPnl = calculateProfitLoss(entryPrice, targetPrice, clamped, isLong, symbolSpec, currentPrice);
      if (slPnl !== null) setRiskDollarInput(Math.abs(slPnl).toFixed(2));
      if (tpPnl !== null) setRewardDollarInput(Math.abs(tpPnl).toFixed(2));
    }
  };

  // Toggle Long <-> Short
  const handleToggleDirection = () => {
    const nextIsLong = !isLong;
    setIsLong(nextIsLong);
    const riskDist = Math.abs(entryPrice - stopPrice);
    const rewardDist = Math.abs(targetPrice - entryPrice);
    const newStop = nextIsLong ? entryPrice - riskDist : entryPrice + riskDist;
    const newTarget = nextIsLong ? entryPrice + rewardDist : entryPrice - rewardDist;
    setStopPrice(newStop);
    setTargetPrice(newTarget);
    setStopInput(newStop.toFixed(decimals));
    setTargetInput(newTarget.toFixed(decimals));
  };

  // Set Current Market Price as Entry
  const handleSetCurrentMarketPrice = () => {
    if (currentPrice > 0) {
      handleEntryChange(currentPrice.toFixed(decimals));
    }
  };

  // Dedicated Volatility 75 (My Pair) Quick Setup
  const handleLoadVol75Preset = (ratio: number = 3) => {
    const defaultSlPips = 200;
    const defaultTpPips = Math.round(defaultSlPips * ratio);
    const volLot = symbolSpec.minLot || 0.001;
    const activeEntry = currentPrice > 0 ? currentPrice : entryPrice;
    const slDist = defaultSlPips * pipUnit;
    const tpDist = defaultTpPips * pipUnit;
    const newStop = isLong ? activeEntry - slDist : activeEntry + slDist;
    const newTarget = isLong ? activeEntry + tpDist : activeEntry - tpDist;

    setEntryPrice(activeEntry);
    setStopPrice(newStop);
    setTargetPrice(newTarget);
    setLotSize(volLot);

    setEntryInput(activeEntry.toFixed(decimals));
    setStopInput(newStop.toFixed(decimals));
    setTargetInput(newTarget.toFixed(decimals));
    setLotInput(volLot.toFixed(symbolSpec.minLot < 0.01 ? 3 : 2));
    setSlPipsInput(defaultSlPips.toString());
    setTpPipsInput(defaultTpPips.toString());

    const slPnl = calculateProfitLoss(activeEntry, newStop, volLot, isLong, symbolSpec, activeEntry);
    const tpPnl = calculateProfitLoss(activeEntry, newTarget, volLot, isLong, symbolSpec, activeEntry);
    if (slPnl !== null) setRiskDollarInput(Math.abs(slPnl).toFixed(2));
    if (tpPnl !== null) setRewardDollarInput(Math.abs(tpPnl).toFixed(2));
  };

  // Quick Preset for exact Deriv Jump 10 Standard
  const handleLoadJump10Standard = () => {
    const jumpEntry = 96371.56;
    const jumpStop = 96171.56;
    const jumpTarget = 97085.07;
    const jumpLot = 0.01;

    setIsLong(true);
    setEntryPrice(jumpEntry);
    setStopPrice(jumpStop);
    setTargetPrice(jumpTarget);
    setLotSize(jumpLot);

    setEntryInput(jumpEntry.toFixed(2));
    setStopInput(jumpStop.toFixed(2));
    setTargetInput(jumpTarget.toFixed(2));
    setLotInput(jumpLot.toFixed(2));
    setSlPipsInput('200');
    setTpPipsInput('714');
    setRiskDollarInput('2.00');
    setRewardDollarInput('7.14');
  };

  // Quick R:R Multiplier Buttons (1:1, 1:1.5, 1:2, 1:3, 1:4, 1:5)
  const handleApplyRatio = (ratio: number) => {
    const slPips = parseFloat(slPipsInput) || Math.round(Math.abs(entryPrice - stopPrice) / pipUnit) || 200;
    const newTpPips = Math.round(slPips * ratio);
    setTpPipsInput(newTpPips.toString());
    const newRewardDist = newTpPips * pipUnit;
    const newTarget = isLong ? entryPrice + newRewardDist : entryPrice - newRewardDist;
    setTargetPrice(newTarget);
    setTargetInput(newTarget.toFixed(decimals));
    const pnl = calculateProfitLoss(entryPrice, newTarget, lotSize, isLong, symbolSpec, currentPrice);
    if (pnl !== null) {
      setRewardDollarInput(Math.abs(pnl).toFixed(2));
    }
  };

  // Submit and apply to chart
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplySetup({
      isLong,
      entryPrice,
      targetPrice,
      stopPrice,
      lotSize,
    });
    onClose();
  };

  // Calculations for preview badge
  const riskDist = Math.abs(entryPrice - stopPrice);
  const rewardDist = Math.abs(targetPrice - entryPrice);
  const actualRatio = riskDist > 0 ? (rewardDist / riskDist).toFixed(2) : '0.00';
  const slPnl = calculateProfitLoss(entryPrice, stopPrice, lotSize, isLong, symbolSpec, currentPrice);
  const tpPnl = calculateProfitLoss(entryPrice, targetPrice, lotSize, isLong, symbolSpec, currentPrice);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150 ${
      isDark ? 'bg-black/80' : 'bg-slate-900/40'
    }`}>
      <div 
        className={`border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans transition-colors ${
          isDark 
            ? 'bg-neutral-950 border-neutral-800 text-white' 
            : 'bg-white border-neutral-200 text-slate-900'
        }`}
        style={{
          backgroundColor: isDark ? preset.surfaceColor || '#0c0c0e' : '#ffffff',
          borderColor: isDark ? preset.borderColor : '#e2e8f0',
          color: isDark ? preset.textColor : '#0f172a',
        }}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Risk / Reward Setup</h3>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${
                  isDark ? 'bg-neutral-800 text-amber-400 border-neutral-700' : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {symbolName}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                Write SL, TP &amp; Position Size (Deriv MT5 Standard)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-slate-400 hover:text-slate-900 hover:bg-neutral-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Volatility 75 & Market Presets Banner */}
        <div className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDark ? 'bg-neutral-900/60 border-neutral-800/80' : 'bg-neutral-100/60 border-neutral-200'
        }`}>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Volatility 75 (My Pair):</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleLoadVol75Preset(3)}
              className="px-2 py-0.8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold font-mono transition-colors flex items-center gap-1 shadow-sm"
              title="Apply Volatility 75 setup with 200 SL pips and 600 TP pips (1:3 ratio)"
            >
              <span>1:3 Ratio (200 / 600 pips)</span>
            </button>
            <button
              type="button"
              onClick={() => handleLoadVol75Preset(4)}
              className="px-2 py-0.8 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[10px] font-bold font-mono transition-colors flex items-center gap-1 shadow-sm"
              title="Apply Volatility 75 setup with 200 SL pips and 800 TP pips (1:4 ratio)"
            >
              <span>1:4 Ratio (200 / 800 pips)</span>
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Direction & Position Size Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Direction Selector */}
            <div className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">Direction</span>
              <button
                type="button"
                onClick={handleToggleDirection}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 ${
                  isLong
                    ? 'bg-emerald-600 text-white shadow-emerald-950/60 hover:bg-emerald-500'
                    : 'bg-rose-600 text-white shadow-rose-950/60 hover:bg-rose-500'
                }`}
              >
                <span>{isLong ? 'LONG 🟢' : 'SHORT 🔴'}</span>
                <RotateCcw className="w-3 h-3 opacity-80" />
              </button>
            </div>

            {/* Position Size (Lot) */}
            <div className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-neutral-400 font-semibold">Position Size</div>
                <div className="text-[9px] text-neutral-500 font-mono">Min: {symbolSpec.minLot} Lot</div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={symbolSpec.lotStep || 0.01}
                  min={symbolSpec.minLot || 0.01}
                  value={lotInput}
                  onChange={(e) => handleLotChange(e.target.value)}
                  className="w-20 px-2 py-1 bg-black border border-neutral-700 rounded-lg text-center text-xs font-bold text-amber-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Entry Price Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-neutral-300">Entry Price Level</label>
              <button
                type="button"
                onClick={handleSetCurrentMarketPrice}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline font-mono cursor-pointer"
              >
                Use Current Market: {currentPrice.toFixed(decimals)}
              </button>
            </div>
            <input
              type="number"
              step="any"
              value={entryInput}
              onChange={(e) => handleEntryChange(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-neutral-800 rounded-xl text-sm font-bold text-white font-mono focus:outline-none focus:border-blue-500 shadow-inner"
              placeholder="e.g. 96371.56"
              required
            />
          </div>

          {/* Stop Loss (SL) Options Grid: Pips, Price Level, Dollar Amount */}
          <div className="p-3.5 bg-rose-950/20 border border-rose-800/40 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Stop Loss (SL)
              </span>
              <span className="text-[10px] font-mono text-rose-300">
                {slPipsInput ? `${slPipsInput} pips` : `${riskDist.toFixed(decimals)} pts`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 font-medium block mb-1">
                  SL (Pips)
                </label>
                <input
                  type="number"
                  step="any"
                  value={slPipsInput}
                  onChange={(e) => handleSlPipsChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black border border-neutral-800 rounded-lg text-xs font-bold text-amber-300 font-mono focus:outline-none focus:border-rose-500"
                  placeholder="200"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 font-medium block mb-1">
                  SL Price Level
                </label>
                <input
                  type="number"
                  step="any"
                  value={stopInput}
                  onChange={(e) => handleStopPriceChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black border border-neutral-800 rounded-lg text-xs font-bold text-rose-300 font-mono focus:outline-none focus:border-rose-500"
                  placeholder="Price"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 font-medium block mb-1">
                  Risk Amount ($)
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-[10px] font-mono font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={riskDollarInput}
                    onChange={(e) => handleRiskDollarChange(e.target.value)}
                    className="w-full pl-5 pr-2 py-1.5 bg-black border border-neutral-800 rounded-lg text-xs font-bold text-rose-400 font-mono focus:outline-none focus:border-rose-500"
                    placeholder="2.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Take Profit (TP) Options Grid: Pips, Price Level, Dollar Amount */}
          <div className="p-3.5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Take Profit (TP)
              </span>
              <span className="text-[10px] font-mono text-emerald-300">
                {tpPipsInput ? `${tpPipsInput} pips` : `${rewardDist.toFixed(decimals)} pts`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 font-medium block mb-1">
                  TP (Pips)
                </label>
                <input
                  type="number"
                  step="any"
                  value={tpPipsInput}
                  onChange={(e) => handleTpPipsChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black border border-neutral-800 rounded-lg text-xs font-bold text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
                  placeholder="600"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 font-medium block mb-1">
                  TP Price Level
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetInput}
                  onChange={(e) => handleTargetPriceChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black border border-neutral-800 rounded-lg text-xs font-bold text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                  placeholder="Price"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 font-medium block mb-1">
                  Reward Amount ($)
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-[10px] font-mono font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={rewardDollarInput}
                    onChange={(e) => handleRewardDollarChange(e.target.value)}
                    className="w-full pl-5 pr-2 py-1.5 bg-black border border-neutral-800 rounded-lg text-xs font-bold text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="6.00"
                  />
                </div>
              </div>
            </div>

            {/* Quick R:R Multiplier Buttons */}
            <div className="pt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-neutral-400 font-medium mr-0.5">Quick R:R:</span>
              {[1.0, 1.5, 2.0, 3.0, 4.0, 5.0].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => handleApplyRatio(ratio)}
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition-colors ${
                    ratio === 3.0 || ratio === 4.0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white'
                  }`}
                >
                  1:{ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Live Outcome Calculation Card */}
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400">Target Risk : Reward:</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                1 : {actualRatio} R:R
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-neutral-800">
              <div className="text-rose-400 flex items-center justify-between">
                <span>Loss (SL):</span>
                <span className="font-bold">-${parseFloat(riskDollarInput || '0').toFixed(2)}</span>
              </div>
              <div className="text-emerald-400 flex items-center justify-between">
                <span>Reward (TP):</span>
                <span className="font-bold">+${parseFloat(rewardDollarInput || '0').toFixed(2)}</span>
              </div>
            </div>

            <div className="text-[10px] text-neutral-500 text-center font-mono">
              Deriv Standard: {lotSize} Lot × 1 Contract size × Price Diff
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-950/60 flex items-center justify-center gap-1.5"
            >
              <Target className="w-4 h-4" />
              <span>Draw R:R on Chart Now</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
