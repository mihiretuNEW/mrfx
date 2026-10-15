/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MasterTradeLoggerModal: 1-Click Pre-Trade Context Freeze & 1:3 Execution Logger
 */

import React, { useState, useEffect } from 'react';
import { PreTradeContext, LoggedTrade, saveLoggedTrade } from '../utils/masterSystem';
import { X, ShieldCheck, ArrowUpRight, ArrowDownRight, Check, AlertCircle, Sparkles } from 'lucide-react';

interface MasterTradeLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: PreTradeContext | null;
  currentSymbol: string;
  currentTimeframe: string;
  currentPrice: number;
  onTradeSaved: () => void;
}

export const MasterTradeLoggerModal: React.FC<MasterTradeLoggerModalProps> = ({
  isOpen,
  onClose,
  context,
  currentSymbol,
  currentTimeframe,
  currentPrice,
  onTradeSaved,
}) => {
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice || 0);
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [takeProfit, setTakeProfit] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Auto-populate prices when modal opens or context updates
  useEffect(() => {
    if (!isOpen) {
      setSavedSuccess(false);
      return;
    }

    const defaultPrice = context?.currentPrice || currentPrice || 1000;
    const dir = context?.signalDirection || 'BUY';
    setDirection(dir);
    setEntryPrice(defaultPrice);

    if (context?.microTrigger) {
      setStopLoss(context.microTrigger.tightStopLoss);
      setTakeProfit(context.microTrigger.tp3RPrice);
    } else if (context?.targetRoom) {
      setStopLoss(context.targetRoom.stopLossPrice);
      setTakeProfit(context.targetRoom.takeProfitPrice);
    } else {
      // Default 1:3 calculation
      const riskPips = defaultPrice * 0.005; // 0.5% default risk
      if (dir === 'BUY') {
        const sl = Number((defaultPrice - riskPips).toFixed(3));
        const tp = Number((defaultPrice + riskPips * 3.0).toFixed(3));
        setStopLoss(sl);
        setTakeProfit(tp);
      } else {
        const sl = Number((defaultPrice + riskPips).toFixed(3));
        const tp = Number((defaultPrice - riskPips * 3.0).toFixed(3));
        setStopLoss(sl);
        setTakeProfit(tp);
      }
    }
  }, [isOpen, context, currentPrice]);

  if (!isOpen) return null;

  // Calculate dynamic Risk-Reward Ratio
  const risk = direction === 'BUY' ? Math.max(0.0001, entryPrice - stopLoss) : Math.max(0.0001, stopLoss - entryPrice);
  const reward = direction === 'BUY' ? Math.max(0, takeProfit - entryPrice) : Math.max(0, entryPrice - takeProfit);
  const dynamicRR = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;
  const isTargetAtLeast1To3 = dynamicRR >= 2.95;

  const handleSave = () => {
    const defaultSnapshot: PreTradeContext = context || {
      signalSource: direction === 'BUY' ? 'MPRO_LOWER_BUY' : 'MPRO_UPPER_SELL',
      signalDirection: direction,
      barIndex: 0,
      candleTime: Math.floor(Date.now() / 1000),
      currentPrice: entryPrice,
      slope: {
        mproSlopeDegrees: 0,
        mpro2DirectionDown: false,
        regime: 'RANGE_BOUND',
        isSlopeAligned: true,
        isRunawayHostile: false,
        slopeText: 'Manual Logged',
      },
      targetRoom: {
        entryPrice,
        stopLossPrice: stopLoss,
        takeProfitPrice: takeProfit,
        riskAmount: risk,
        rewardAmount: reward,
        riskRewardRatio: dynamicRR,
        opposingBarrierPrice: takeProfit,
        distanceToOpposingBarrier: reward,
        hasRoomFor3R: isTargetAtLeast1To3,
        clearanceRatio: dynamicRR / 3.0,
        clearanceText: `${dynamicRR.toFixed(1)}:1 R:R`,
      },
      rejection: {
        wickRatio: 0.4,
        bodyRatio: 0.5,
        closePositionRatio: direction === 'BUY' ? 0.8 : 0.2,
        isCleanRejection: true,
        touchPattern: 'FIRST_TOUCH',
        rejectionText: 'Manual Logged',
      },
      microTrigger: {
        status: 'CONFIRMED',
        triggerPrice: entryPrice,
        timeElapsedInCandleSeconds: 1800,
        isEarlyTrapWindow: false,
        breakConfirmed: true,
        tightStopLoss: stopLoss,
        tightRisk: risk,
        breakEvenPrice: direction === 'BUY' ? entryPrice + risk : entryPrice - risk,
        tp1RPrice: direction === 'BUY' ? entryPrice + risk : entryPrice - risk,
        tp3RPrice: takeProfit,
        statusText: 'Manual Logged 1:3 Setup',
      },
      decision: context?.decision || 'TAKE',
      confidenceScore: context?.confidenceScore || 75,
      decisionReasons: context?.decisionReasons || ['Manually logged trade with 1:3 R:R parameters.'],
    };

    const newTrade: LoggedTrade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Math.floor(Date.now() / 1000),
      symbol: currentSymbol,
      timeframe: currentTimeframe,
      source: defaultSnapshot.signalSource,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      riskRewardRatio: dynamicRR,
      decisionAtEntry: context?.decision || 'TAKE',
      preTradeSnapshot: defaultSnapshot,
      status: 'OPEN',
      notes: notes.trim() || undefined,
    };

    saveLoggedTrade(newTrade);
    setSavedSuccess(true);
    onTradeSaved();

    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div 
      id="master-trade-logger-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl p-5 text-neutral-200 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                LOG MASTER SETUP
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                  {currentSymbol} • {currentTimeframe}
                </span>
              </h3>
              <p className="text-xs text-neutral-400">Freezes exact pre-trade context for empirical tracking</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-bounce">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Trade Successfully Logged!</h4>
            <p className="text-xs text-neutral-400 max-w-xs">
              Pre-trade market context has been frozen in Local Storage. Live candles will automatically track whether TP or SL is hit.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Direction Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  direction === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>BUY SETUP</span>
              </button>

              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  direction === 'SELL'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-950'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>SELL SETUP</span>
              </button>
            </div>

            {/* Price Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Entry Price
                </label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-rose-400 mb-1 flex items-center justify-between">
                    <span>Stop Loss (SL)</span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      -{risk.toFixed(2)}
                    </span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-rose-900/40 text-rose-200 font-mono text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1 flex items-center justify-between">
                    <span>Take Profit (TP)</span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      +{reward.toFixed(2)}
                    </span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-emerald-900/40 text-emerald-200 font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* R:R Ratio Badge & Warning */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              isTargetAtLeast1To3
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            }`}>
              <div className="flex items-center gap-2 text-xs">
                {isTargetAtLeast1To3 ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span>
                  Calculated R:R = <strong className="font-mono">1 : {dynamicRR}</strong>
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {isTargetAtLeast1To3 ? 'Valid 1:3 Setup' : 'Sub-1:3 Target'}
              </span>
            </div>

            {/* Frozen Context Preview */}
            {context && (
              <div className="p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] space-y-1.5 text-neutral-300">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                  Frozen Pre-Trade Context:
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Master Verdict:</span>
                  <span className={`font-bold ${
                    context.decision === 'TAKE' ? 'text-emerald-400' :
                    context.decision === 'WAIT' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {context.decision} ({context.confidenceScore}/100)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Slope & Regime:</span>
                  <span className="font-mono">{context.slope.slopeText}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Rejection Quality:</span>
                  <span className="font-mono">{context.rejection.rejectionText}</span>
                </div>
              </div>
            )}

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">
                Trade Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                placeholder="e.g., Retest bounce off 1H lower band after liquidity sweep"
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-600"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-950 transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Save Trade to Journal</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
