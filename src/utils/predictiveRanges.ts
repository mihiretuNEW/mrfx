/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * LuxAlgo - Predictive Ranges
 * Exact mathematical port from PineScript v5 (LuxAlgo)
 */

import { Candle } from '../types';

export interface PredictiveRangesShelf {
  startIndex: number;
  endIndex: number;
  pru2: number;
  pru1: number;
  avg: number;
  prs1: number;
  prs2: number;
  holdAtr: number;
  isCurrent: boolean;
}

export interface PredictiveRangeSignal {
  index: number;
  type: 'r2_rejection' | 'r2_breakout' | 's2_rejection' | 's2_breakout';
  price: number;
  levelPrice: number;
  label: string;
}

export interface PredictiveRangesResult {
  pru2: (number | null)[];
  pru1: (number | null)[];
  avg: (number | null)[];
  prs1: (number | null)[];
  prs2: (number | null)[];
  regimeChanges: boolean[];
  shelves: PredictiveRangesShelf[];
  signals: PredictiveRangeSignal[];
  isLiveR2Touch: boolean;
  isLiveS2Touch: boolean;
  currentRange: {
    pru2: number;
    pru1: number;
    avg: number;
    prs1: number;
    prs2: number;
    holdAtr: number;
  } | null;
}

/**
 * Calculates Predictive Ranges using LuxAlgo's exact PineScript formula:
 * 
 * atr = nz(ta.atr(length)) * mult
 * avg := src - avg > atr ? avg + atr : avg - src > atr ? avg - atr : avg
 * hold_atr := avg != avg[1] ? atr / 2 : hold_atr
 * [avg + hold_atr * 2, avg + hold_atr, avg, avg - hold_atr, avg - hold_atr * 2]
 */
export function calculatePredictiveRanges(
  candles: Candle[],
  options: {
    length?: number;
    mult?: number;
  } = {}
): PredictiveRangesResult {
  const emptyResult: PredictiveRangesResult = {
    pru2: [],
    pru1: [],
    avg: [],
    prs1: [],
    prs2: [],
    regimeChanges: [],
    shelves: [],
    signals: [],
    isLiveR2Touch: false,
    isLiveS2Touch: false,
    currentRange: null,
  };

  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return emptyResult;
  }

  const length = Math.max(2, options.length ?? 200);
  const mult = Math.max(0.1, options.mult ?? 6.0);

  const n = candles.length;
  if (n === 0) {
    return emptyResult;
  }

  // 1. Calculate Wilder's ATR (RMA of True Range)
  const atrValues: number[] = new Array(n).fill(0);
  let trSum = 0;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    let tr = c.high - c.low;
    if (i > 0) {
      const prev = candles[i - 1];
      tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      );
    }

    if (i < length) {
      trSum += tr;
      atrValues[i] = trSum / (i + 1);
    } else {
      atrValues[i] = (atrValues[i - 1] * (length - 1) + tr) / length;
    }
  }

  const pru2: (number | null)[] = new Array(n).fill(null);
  const pru1: (number | null)[] = new Array(n).fill(null);
  const avgArr: (number | null)[] = new Array(n).fill(null);
  const prs1: (number | null)[] = new Array(n).fill(null);
  const prs2: (number | null)[] = new Array(n).fill(null);
  const regimeChanges: boolean[] = new Array(n).fill(false);

  // 2. Sequential simulation matching PineScript 'var' variables
  let runningAvg = candles[0].close;
  let holdAtr = (atrValues[0] * mult) / 2;

  let currentShelfStart = 0;
  const shelves: PredictiveRangesShelf[] = [];

  for (let i = 0; i < n; i++) {
    const src = candles[i].close;
    const atr = (atrValues[i] || 0) * mult;
    const prevAvg = runningAvg;

    if (src - prevAvg > atr) {
      runningAvg = prevAvg + atr;
    } else if (prevAvg - src > atr) {
      runningAvg = prevAvg - atr;
    } else {
      runningAvg = prevAvg;
    }

    const changed = runningAvg !== prevAvg && i > 0;
    regimeChanges[i] = changed;

    if (changed) {
      // Save previous completed shelf
      if (i - 1 >= currentShelfStart) {
        shelves.push({
          startIndex: currentShelfStart,
          endIndex: i - 1,
          pru2: prevAvg + holdAtr * 2,
          pru1: prevAvg + holdAtr,
          avg: prevAvg,
          prs1: prevAvg - holdAtr,
          prs2: prevAvg - holdAtr * 2,
          holdAtr,
          isCurrent: false,
        });
      }
      currentShelfStart = i;
      holdAtr = atr / 2;
    }

    pru2[i] = runningAvg + holdAtr * 2;
    pru1[i] = runningAvg + holdAtr;
    avgArr[i] = runningAvg;
    prs1[i] = runningAvg - holdAtr;
    prs2[i] = runningAvg - holdAtr * 2;
  }

  // Save the latest active shelf
  if (n > 0 && currentShelfStart < n) {
    shelves.push({
      startIndex: currentShelfStart,
      endIndex: n - 1,
      pru2: runningAvg + holdAtr * 2,
      pru1: runningAvg + holdAtr,
      avg: runningAvg,
      prs1: runningAvg - holdAtr,
      prs2: runningAvg - holdAtr * 2,
      holdAtr,
      isCurrent: true,
    });
  }

  // Identify Touch, Rejection, and Breakout Signals
  const signals: PredictiveRangeSignal[] = [];
  let lastRejectionType: string | null = null;
  let lastRejectionIdx = -999;
  let lastBreakoutType: string | null = null;
  let lastBreakoutIdx = -999;

  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const u2 = pru2[i];
    const s2 = prs2[i];
    const prevU2 = pru2[i - 1] ?? u2;
    const prevS2 = prs2[i - 1] ?? s2;
    if (u2 === null || s2 === null) continue;

    // 1. Check R2 Breakout (Bullish close strictly above R2)
    if (c.close > u2 && prevC && prevC.close <= prevU2) {
      if (i - lastBreakoutIdx >= 2 || lastBreakoutType !== 'r2_breakout') {
        signals.push({
          index: i,
          type: 'r2_breakout',
          price: c.close,
          levelPrice: u2,
          label: 'B',
        });
        lastBreakoutType = 'r2_breakout';
        lastBreakoutIdx = i;
      }
    }
    // 2. Check S2 Breakout (Bearish close strictly below S2)
    else if (c.close < s2 && prevC && prevC.close >= prevS2) {
      if (i - lastBreakoutIdx >= 2 || lastBreakoutType !== 's2_breakout') {
        signals.push({
          index: i,
          type: 's2_breakout',
          price: c.close,
          levelPrice: s2,
          label: 'B',
        });
        lastBreakoutType = 's2_breakout';
        lastBreakoutIdx = i;
      }
    }
    // 3. Check R2 Rejection (Wick sweep >= u2 and close < u2)
    else if (c.high >= u2 && c.close < u2) {
      // Avoid consecutive duplicate spamming on adjacent bars
      if (i - lastRejectionIdx >= 2 || lastRejectionType !== 'r2_rejection') {
        signals.push({
          index: i,
          type: 'r2_rejection',
          price: c.high,
          levelPrice: u2,
          label: 'R2 Rejection',
        });
        lastRejectionType = 'r2_rejection';
        lastRejectionIdx = i;
      }
    }
    // 4. Check S2 Rejection (Wick sweep <= s2 and close > s2)
    else if (c.low <= s2 && c.close > s2) {
      if (i - lastRejectionIdx >= 2 || lastRejectionType !== 's2_rejection') {
        signals.push({
          index: i,
          type: 's2_rejection',
          price: c.low,
          levelPrice: s2,
          label: 'S2 Rejection',
        });
        lastRejectionType = 's2_rejection';
        lastRejectionIdx = i;
      }
    }
  }

  const currentRange = n > 0 ? {
    pru2: pru2[n - 1]!,
    pru1: pru1[n - 1]!,
    avg: avgArr[n - 1]!,
    prs1: prs1[n - 1]!,
    prs2: prs2[n - 1]!,
    holdAtr,
  } : null;

  const isLiveR2Touch = currentRange ? (candles[n - 1]?.high >= currentRange.pru2) : false;
  const isLiveS2Touch = currentRange ? (candles[n - 1]?.low <= currentRange.prs2) : false;

  return {
    pru2,
    pru1,
    avg: avgArr,
    prs1,
    prs2,
    regimeChanges,
    shelves,
    signals,
    isLiveR2Touch,
    isLiveS2Touch,
    currentRange,
  };
}
