/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../types';

export interface GTATrendResult {
  colorState: 0 | 1 | 2; // 0: Bullish (Green), 1: Bearish (Red), 2: Neutral (Yellow)
  buyArrow: number | null;
  sellArrow: number | null;
  emaShort: number;
  emaMid: number;
  emaLong: number;
}

/**
 * Calculates the EMA for a given price array.
 */
function calculateEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = 0;

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      sum += prices[i];
      ema.push(i === period - 1 ? sum / period : NaN);
    } else {
      ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
  }
  return ema;
}

/**
 * Main Grand Trend Alignment Filter Algorithm
 */
export function calculateGTATrend(
  data: Candle[], 
  longPeriod = 21, 
  midPeriod = 13, 
  shortPeriod = 6,
  arrowOffset = 0.1
): GTATrendResult[] {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  const closePrices = data.map(d => d.close);
  const emaLong = calculateEMA(closePrices, longPeriod);
  const emaMid = calculateEMA(closePrices, midPeriod);
  const emaShort = calculateEMA(closePrices, shortPeriod);

  const results: GTATrendResult[] = [];

  for (let i = 0; i < data.length; i++) {
    // 1. Check for insufficient historical warm-up data
    if (isNaN(emaLong[i]) || isNaN(emaMid[i]) || isNaN(emaShort[i])) {
      results.push({ 
        colorState: 2, 
        sellArrow: null, 
        buyArrow: null,
        emaShort: NaN,
        emaMid: NaN,
        emaLong: NaN
      });
      continue;
    }

    const eS = emaShort[i];
    const eM = emaMid[i];
    const eL = emaLong[i];

    // 2. Classify Alignment State
    let state: 0 | 1 | 2 = 2; // Default to Neutral (Yellow)
    if (eS > eM && eM > eL) {
      state = 0; // Bullish (Green)
    } else if (eS < eM && eM < eL) {
      state = 1; // Bearish (Red)
    }

    // 3. Process State Transitions to Trigger Signal Arrows
    let buyArrow: number | null = null;
    let sellArrow: number | null = null;

    if (i > 0) {
      const prevResult = results[i - 1];
      const candleRange = data[i].high - data[i].low;
      const padding = candleRange > 0 ? candleRange * arrowOffset : data[i].close * 0.001;

      if (state === 0 && prevResult.colorState !== 0) {
        // Transitioned from non-bullish (1 or 2) into bullish (0)
        buyArrow = data[i].low - padding;
      } else if (state === 1 && prevResult.colorState !== 1) {
        // Transitioned from non-bearish (0 or 2) into bearish (1)
        sellArrow = data[i].high + padding;
      }
    }

    results.push({ 
      colorState: state, 
      buyArrow, 
      sellArrow,
      emaShort: eS,
      emaMid: eM,
      emaLong: eL
    });
  }

  return results;
}
