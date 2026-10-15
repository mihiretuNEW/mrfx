/**
 * Premium Signals with Dynamic TP & SL Optimization
 * Dual Channel Moving Average & Volatility Range Algorithm
 * Strict 2-Candle Confirmation, Multi-Level Dynamic TP (TP1, TP2, TP3),
 * and Volatility-Based Stop Loss (50% of TP3) with Real-Time Operation Tracking.
 */

import { Candle } from '../types';

export type PriceSourceType = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

export interface DynamicChannelPoint {
  index: number;
  time: number;
  ma1: number;
  upper1: number;
  lower1: number;
  ma2: number;
  upper2: number;
  lower2: number;
}

export interface DynamicSignalOperation {
  id: string;
  type: 'BUY' | 'SELL';
  startIndex: number; // Index of the 2nd confirmation candle
  startTime: number;
  entryPrice: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  slPrice: number;
  rangeAmplitude: number;
  status: 'ACTIVE' | 'TP1_HIT' | 'TP2_HIT' | 'TARGET_REACHED' | 'STOPPED_OUT';
  tp1HitIndex?: number;
  tp2HitIndex?: number;
  tp3HitIndex?: number;
  slHitIndex?: number;
  endIndex?: number;
  riskRewardRatio: number;
}

export interface DynamicTpSlOptions {
  enabled?: boolean;
  period1?: number; // Channel 1 Period (short-term, default: 14)
  multiplier1?: number; // Channel 1 Multiplier (default: 1.5)
  period2?: number; // Channel 2 Period (long-term, default: 34)
  multiplier2?: number; // Channel 2 Multiplier (default: 2.5)
  priceSource?: PriceSourceType; // Price Source (default: 'close')
  tp1Factor?: number; // TP1 Multiplier factor (default: 1.0)
  tp2Factor?: number; // TP2 Multiplier factor (default: 2.0)
  tp3Factor?: number; // TP3 Multiplier factor (default: 3.0)
  slRatio?: number; // Stop Loss ratio of TP3 (default: 0.50 = 50%)
  rangeLookback?: number; // Bars lookback for recent range amplitude (default: 10)
  showChannels?: boolean; // Show channel lines (default: true)
  showChannelFill?: boolean; // Show subtle channel fill (default: true)
  showSignals?: boolean; // Show BUY/SELL arrows & badges (default: true)
  showTpSlLines?: boolean; // Show dynamic TP/SL brackets on chart (default: true)
  showTable?: boolean; // Show Real-Time Tracking Information Table (default: true)
  tablePosition?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left';
  ch1Color?: string; // Channel 1 line color (default: '#38bdf8')
  ch2Color?: string; // Channel 2 line color (default: '#818cf8')
  buyColor?: string; // Buy signal & TP color (default: '#10b981')
  sellColor?: string; // Sell signal & SL color (default: '#ef4444')
}

export interface DynamicTpSlResults {
  channels: DynamicChannelPoint[];
  operations: DynamicSignalOperation[];
  activeOperation: DynamicSignalOperation | null;
  lastAlert: string | null;
}

function getSourceValue(candle: Candle, source: PriceSourceType): number {
  switch (source) {
    case 'open':
      return candle.open;
    case 'high':
      return candle.high;
    case 'low':
      return candle.low;
    case 'hl2':
      return (candle.high + candle.low) / 2;
    case 'hlc3':
      return (candle.high + candle.low + candle.close) / 3;
    case 'ohlc4':
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    case 'close':
    default:
      return candle.close;
  }
}

export function calculatePremiumDynamicTpSlSignals(
  candles: Candle[],
  options: DynamicTpSlOptions = {}
): DynamicTpSlResults | null {
  if (!candles || candles.length < 20) return null;

  const period1 = Math.max(3, options.period1 ?? 14);
  const multiplier1 = Math.max(0.1, options.multiplier1 ?? 1.5);
  const period2 = Math.max(5, options.period2 ?? 34);
  const multiplier2 = Math.max(0.1, options.multiplier2 ?? 2.5);
  const priceSource = options.priceSource ?? 'close';
  const tp1Factor = Math.max(0.1, options.tp1Factor ?? 1.0);
  const tp2Factor = Math.max(0.2, options.tp2Factor ?? 2.0);
  const tp3Factor = Math.max(0.3, options.tp3Factor ?? 3.0);
  const slRatio = Math.max(0.1, Math.min(2.0, options.slRatio ?? 0.50)); // Default 50% of TP3
  const rangeLookback = Math.max(3, options.rangeLookback ?? 10);

  const n = candles.length;
  const sourceValues: number[] = new Array(n);
  const trueRanges: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    sourceValues[i] = getSourceValue(candles[i], priceSource);
    if (i === 0) {
      trueRanges[i] = candles[i].high - candles[i].low;
    } else {
      const tr1 = candles[i].high - candles[i].low;
      const tr2 = Math.abs(candles[i].high - candles[i - 1].close);
      const tr3 = Math.abs(candles[i].low - candles[i - 1].close);
      trueRanges[i] = Math.max(tr1, tr2, tr3);
    }
  }

  // Pre-calculate rolling SMA & ATR for both channels
  const channels: DynamicChannelPoint[] = new Array(n);

  for (let i = 0; i < n; i++) {
    // Channel 1 (Short-term)
    const start1 = Math.max(0, i - period1 + 1);
    const count1 = i - start1 + 1;
    let sum1 = 0;
    let trSum1 = 0;
    for (let j = start1; j <= i; j++) {
      sum1 += sourceValues[j];
      trSum1 += trueRanges[j];
    }
    const ma1 = sum1 / count1;
    const atr1 = trSum1 / count1;
    const upper1 = ma1 + multiplier1 * atr1;
    const lower1 = ma1 - multiplier1 * atr1;

    // Channel 2 (Long-term confirmation)
    const start2 = Math.max(0, i - period2 + 1);
    const count2 = i - start2 + 1;
    let sum2 = 0;
    let trSum2 = 0;
    for (let j = start2; j <= i; j++) {
      sum2 += sourceValues[j];
      trSum2 += trueRanges[j];
    }
    const ma2 = sum2 / count2;
    const atr2 = trSum2 / count2;
    const upper2 = ma2 + multiplier2 * atr2;
    const lower2 = ma2 - multiplier2 * atr2;

    channels[i] = {
      index: i,
      time: candles[i].time,
      ma1,
      upper1,
      lower1,
      ma2,
      upper2,
      lower2,
    };
  }

  // Signal Detection with Strict 2-Candle Confirmation
  // • Buy Signal: Price closes above upper limits of both channels in at least two confirmed candles
  // • Sell Signal: Price closes below lower limits of both channels in at least two confirmed candles
  const operations: DynamicSignalOperation[] = [];
  let currentActiveOp: DynamicSignalOperation | null = null;
  let lastSignalType: 'BUY' | 'SELL' | null = null;
  let lastAlert: string | null = null;

  const minIndex = Math.max(period1, period2);

  for (let i = minIndex; i < n; i++) {
    const cPrev = candles[i - 1];
    const cCurr = candles[i];
    const chPrev = channels[i - 1];
    const chCurr = channels[i];

    // Check if previous bar closed above both upper channels
    const prevAboveBoth = cPrev.close > Math.max(chPrev.upper1, chPrev.upper2);
    // Check if current bar also closed above both upper channels (2nd confirmed candle)
    const currAboveBoth = cCurr.close > Math.max(chCurr.upper1, chCurr.upper2);

    // Check if previous bar closed below both lower channels
    const prevBelowBoth = cPrev.close < Math.min(chPrev.lower1, chPrev.lower2);
    // Check if current bar also closed below both lower channels (2nd confirmed candle)
    const currBelowBoth = cCurr.close < Math.min(chCurr.lower1, chCurr.lower2);

    let isNewBuy = false;
    let isNewSell = false;

    if (prevAboveBoth && currAboveBoth && lastSignalType !== 'BUY') {
      // Confirmed Buy Signal on the 2nd candle!
      isNewBuy = true;
    } else if (prevBelowBoth && currBelowBoth && lastSignalType !== 'SELL') {
      // Confirmed Sell Signal on the 2nd candle!
      isNewSell = true;
    }

    if (isNewBuy || isNewSell) {
      const type: 'BUY' | 'SELL' = isNewBuy ? 'BUY' : 'SELL';
      const entryPrice = cCurr.close;

      // Calculate recent price range amplitude over recent bars lookback
      const lbStart = Math.max(0, i - rangeLookback);
      let minLow = Infinity;
      let maxHigh = -Infinity;
      for (let k = lbStart; k <= i; k++) {
        if (candles[k].low < minLow) minLow = candles[k].low;
        if (candles[k].high > maxHigh) maxHigh = candles[k].high;
      }

      const atrCurrent = (channels[i].upper1 - channels[i].lower1) / (2 * multiplier1);
      const rawAmplitude = type === 'BUY' ? entryPrice - minLow : maxHigh - entryPrice;
      const amplitude = Math.max(atrCurrent * 0.8, Math.max(cCurr.high - cCurr.low, rawAmplitude));

      // 1. Take Profit Levels (TP1, TP2, TP3)
      const dir = type === 'BUY' ? 1 : -1;
      const tp1Price = entryPrice + dir * amplitude * tp1Factor;
      const tp2Price = entryPrice + dir * amplitude * tp2Factor;
      const tp3Price = entryPrice + dir * amplitude * tp3Factor;

      // 2. Volatility-Based Stop Loss:
      // "The SL level is dynamically calculated based on market volatility, adjusting as a percentage of the third Take Profit (TP3) level.
      // By default, SL is set at 50% of the value of TP3."
      const distTP3 = Math.abs(tp3Price - entryPrice);
      const slDist = distTP3 * slRatio;
      const slPrice = type === 'BUY' ? entryPrice - slDist : entryPrice + slDist;

      const riskRewardRatio = slDist > 0 ? Number((distTP3 / slDist).toFixed(2)) : 2.0;

      // Close previous active operation if still running
      if (currentActiveOp && currentActiveOp.status === 'ACTIVE') {
        currentActiveOp.endIndex = i;
      }

      const op: DynamicSignalOperation = {
        id: `dyn-op-${i}-${type}`,
        type,
        startIndex: i,
        startTime: cCurr.time,
        entryPrice,
        tp1Price,
        tp2Price,
        tp3Price,
        slPrice,
        rangeAmplitude: amplitude,
        status: 'ACTIVE',
        riskRewardRatio,
      };

      operations.push(op);
      currentActiveOp = op;
      lastSignalType = type;
      lastAlert = `🔔 ${type} SIGNAL CONFIRMED @ ${entryPrice.toFixed(2)} | SL: ${slPrice.toFixed(2)} | TP3: ${tp3Price.toFixed(2)}`;
    }

    // Forward check active operations against subsequent price action
    if (currentActiveOp && currentActiveOp.startIndex < i && currentActiveOp.status !== 'TARGET_REACHED' && currentActiveOp.status !== 'STOPPED_OUT') {
      const isBuy = currentActiveOp.type === 'BUY';

      // Check Stop Loss hit
      const isSlHit = isBuy ? cCurr.low <= currentActiveOp.slPrice : cCurr.high >= currentActiveOp.slPrice;
      if (isSlHit) {
        currentActiveOp.status = 'STOPPED_OUT';
        currentActiveOp.slHitIndex = i;
        currentActiveOp.endIndex = i;
        lastAlert = `❌ SL HIT on ${currentActiveOp.type} @ ${currentActiveOp.slPrice.toFixed(2)}`;
        continue;
      }

      // Check TP3 hit (Full target)
      const isTp3Hit = isBuy ? cCurr.high >= currentActiveOp.tp3Price : cCurr.low <= currentActiveOp.tp3Price;
      if (isTp3Hit) {
        currentActiveOp.status = 'TARGET_REACHED';
        currentActiveOp.tp3HitIndex = i;
        currentActiveOp.endIndex = i;
        lastAlert = `🎯 TP3 FULL TARGET REACHED on ${currentActiveOp.type} @ ${currentActiveOp.tp3Price.toFixed(2)}!`;
        continue;
      }

      // Check TP2 hit
      const isTp2Hit = isBuy ? cCurr.high >= currentActiveOp.tp2Price : cCurr.low <= currentActiveOp.tp2Price;
      if (isTp2Hit && !currentActiveOp.tp2HitIndex) {
        currentActiveOp.status = 'TP2_HIT';
        currentActiveOp.tp2HitIndex = i;
        lastAlert = `✨ TP2 HIT on ${currentActiveOp.type} @ ${currentActiveOp.tp2Price.toFixed(2)}`;
      }

      // Check TP1 hit
      const isTp1Hit = isBuy ? cCurr.high >= currentActiveOp.tp1Price : cCurr.low <= currentActiveOp.tp1Price;
      if (isTp1Hit && !currentActiveOp.tp1HitIndex) {
        if (currentActiveOp.status === 'ACTIVE') {
          currentActiveOp.status = 'TP1_HIT';
        }
        currentActiveOp.tp1HitIndex = i;
        lastAlert = `✨ TP1 HIT on ${currentActiveOp.type} @ ${currentActiveOp.tp1Price.toFixed(2)}`;
      }
    }
  }

  // Active operation is the latest running operation or most recent trade
  const activeOperation = operations.length > 0 ? operations[operations.length - 1] : null;

  return {
    channels,
    operations,
    activeOperation,
    lastAlert,
  };
}
