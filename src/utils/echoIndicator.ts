/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * LuxAlgo - Echo Forecast (ECHO mpro)
 * Exact mathematical and algorithmic port from Pine Script v5 (LuxAlgo)
 * 
 * // This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)
 * // © LuxAlgo
 */

import { Candle } from '../types';

export interface EchoAreaBox {
  leftIndex: number;
  rightIndex: number;
  top: number;
  btm: number;
}

export interface EchoForecastSegment {
  x1Index: number;
  x1Time: number;
  y1Price: number;
  x2Index: number;
  x2Time: number;
  y2Price: number;
}

export interface EchoMproResult {
  bestCorrelation: number;
  bestOffset: number; // k
  top: number;
  btm: number;
  forecastSegments: EchoForecastSegment[];
  forecastPoints: { index: number; time: number; price: number }[];
  evalWindow: EchoAreaBox;
  refWindow: EchoAreaBox;
  corrWindow: EchoAreaBox;
  lastClose: number;
  endForecastPrice: number;
  forecastChangePercent: number;
}

export interface EchoOptions {
  length?: number; // Evaluation Window (default 50)
  fcast?: number;  // Forecast Window (default 50)
  fmode?: 'Similarity' | 'Dissimilarity'; // Forecast Mode
  cmode?: 'Cumulative' | 'Mean' | 'Linreg'; // Forecast Construction
  src?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
}

function getSourceValue(c: Candle, src: string = 'close'): number {
  switch (src) {
    case 'open':
      return c.open;
    case 'high':
      return c.high;
    case 'low':
      return c.low;
    case 'hl2':
      return (c.high + c.low) / 2;
    case 'hlc3':
      return (c.high + c.low + c.close) / 3;
    case 'ohlc4':
      return (c.open + c.high + c.low + c.close) / 4;
    case 'close':
    default:
      return c.close;
  }
}

/**
 * Pearson Covariance of two equal-length arrays
 */
function covariance(a: number[], b: number[]): number {
  const n = a.length;
  if (n <= 1) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const avgA = sumA / n;
  const avgB = sumB / n;

  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - avgA) * (b[i] - avgB);
  }
  return cov / n;
}

/**
 * Standard deviation of an array
 */
function stdev(a: number[]): number {
  const n = a.length;
  if (n <= 1) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i];
  const avg = sum / n;

  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += (a[i] - avg) ** 2;
  }
  return Math.sqrt(variance / n);
}

/**
 * Variance of an array
 */
function variance(a: number[]): number {
  const n = a.length;
  if (n <= 1) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i];
  const avg = sum / n;

  let v = 0;
  for (let i = 0; i < n; i++) {
    v += (a[i] - avg) ** 2;
  }
  return v / n;
}

/**
 * Calculates LuxAlgo Echo Forecast (ECHO mpro)
 */
export function calculateEchoMpro(
  candles: Candle[],
  options: EchoOptions = {}
): EchoMproResult | null {
  const length = Math.max(1, Math.min(200, options.length ?? 50));
  const fcast = Math.max(1, Math.min(200, options.fcast ?? 50));
  const fmode = options.fmode ?? 'Similarity';
  const cmode = options.cmode ?? 'Cumulative';
  const srcChoice = options.src ?? 'close';

  const minRequiredBars = fcast * 2 + length + 2;
  if (!candles || candles.length < minRequiredBars) {
    return null;
  }

  const N = candles.length;
  const n = N - 1; // Current bar index (barstate.islast)

  // Extract source price series
  const srcSeries: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    srcSeries[i] = getSourceValue(candles[i], srcChoice);
  }

  // Delta series d = src - src[1]
  // In chronological order: dChron[i] = srcSeries[i] - srcSeries[i - 1] for i >= 1
  const dChron: number[] = new Array(N);
  dChron[0] = 0;
  for (let i = 1; i < N; i++) {
    dChron[i] = srcSeries[i] - srcSeries[i - 1];
  }

  // In Pine Script:
  // d[m] = delta at m bars ago = src[m] - src[m+1] = srcSeries[n - m] - srcSeries[n - m - 1] = dChron[n - m]
  const getDeltaAtBarsAgo = (barsAgo: number): number => {
    const idx = n - barsAgo;
    if (idx >= 1 && idx < N) {
      return dChron[idx];
    }
    return 0;
  };

  // Get range maximum / minimum: top = ta.highest(src, length + fcast * 2), btm = ta.lowest(src, length + fcast * 2)
  const rangeLookback = length + fcast * 2;
  let top = -Infinity;
  let btm = Infinity;
  const rangeStartIdx = Math.max(0, N - rangeLookback);
  for (let i = rangeStartIdx; i < N; i++) {
    const val = srcSeries[i];
    if (val > top) top = val;
    if (val < btm) btm = val;
  }

  // Populate calculation window A and independent variable X
  // In Pine Script:
  // for i = 0 to fcast*2+length
  //     A.push(src[i])
  //     if cmode == 'Linreg': X.push(n[i])
  const maxWindow = fcast * 2 + length;
  const A: number[] = [];
  const X: number[] = [];

  for (let i = 0; i <= maxWindow; i++) {
    const barIdx = n - i;
    if (barIdx >= 0 && barIdx < N) {
      A.push(srcSeries[barIdx]);
      X.push(barIdx);
    }
  }

  if (A.length < fcast * 2 + length) {
    return null;
  }

  // Reference window: a = A.slice(0, fcast - 1)
  // In Pine Script, A.slice(0, fcast - 1) creates array of length fcast - 1
  const aSlice = A.slice(0, fcast - 1);
  const stdA = stdev(aSlice);

  // Find historical window b that maximizes (Similarity) or minimizes (Dissimilarity) Pearson correlation r
  let k = 0;
  let bestVal: number | null = null;

  for (let i = 0; i < length; i++) {
    const bSlice = A.slice(fcast + i, fcast * 2 + i - 1);
    const stdB = stdev(bSlice);

    let r = 0;
    if (stdA > 0 && stdB > 0) {
      r = covariance(aSlice, bSlice) / (stdA * stdB);
    }

    if (fmode === 'Similarity') {
      if (bestVal === null || r >= bestVal) {
        bestVal = r;
        k = i;
      }
    } else {
      if (bestVal === null || r <= bestVal) {
        bestVal = r;
        k = i;
      }
    }
  }

  // Set ECHO Forecast Path
  const currentSrc = srcSeries[n];
  let prev = currentSrc;
  let current = currentSrc;

  const avgCandleSec = N > 1 ? Math.max(1, candles[N - 1].time - candles[N - 2].time) : 60;
  const lastTime = candles[n].time;

  const forecastSegments: EchoForecastSegment[] = [];
  const forecastPoints: { index: number; time: number; price: number }[] = [
    { index: n, time: lastTime, price: currentSrc }
  ];

  // For Linear Regression construction mode
  let alpha = 0;
  let beta = 0;
  if (cmode === 'Linreg') {
    const aLinreg = A.slice(0, fcast);
    const xLinreg = X.slice(0, fcast);
    const varX = variance(xLinreg);
    if (varX > 0) {
      alpha = covariance(aLinreg, xLinreg) / varX;
      let sumA = 0;
      let sumX = 0;
      for (let i = 0; i < fcast; i++) {
        sumA += aLinreg[i];
        sumX += xLinreg[i];
      }
      beta = (sumA / fcast) - alpha * (sumX / fcast);
    }
  }

  // Mean mode reference average
  let avgA = 0;
  if (cmode === 'Mean') {
    let sumA = 0;
    for (let i = 0; i < aSlice.length; i++) sumA += aSlice[i];
    avgA = aSlice.length > 0 ? sumA / aSlice.length : currentSrc;
  }

  for (let i = 0; i < fcast; i++) {
    // e = d[fcast + k + (fcast - i - 1)]
    const barsAgo = fcast + k + (fcast - i - 1);
    const e = getDeltaAtBarsAgo(barsAgo);

    if (cmode === 'Mean') {
      current = avgA + e;
    } else if (cmode === 'Linreg') {
      current = alpha * (n + i + 1) + beta + e;
    } else {
      // 'Cumulative'
      current += e;
    }

    const x1Idx = n + i;
    const x1Time = lastTime + i * avgCandleSec;
    const y1 = prev;

    const x2Idx = n + i + 1;
    const x2Time = lastTime + (i + 1) * avgCandleSec;
    const y2 = current;

    forecastSegments.push({
      x1Index: x1Idx,
      x1Time,
      y1Price: y1,
      x2Index: x2Idx,
      x2Time,
      y2Price: y2,
    });

    forecastPoints.push({
      index: x2Idx,
      time: x2Time,
      price: y2,
    });

    prev = current;
  }

  // Set Area Boxes (Pine Script logic):
  // 1. Evaluation window:
  //    eval_window.set_lefttop(n - length - fcast * 2 + 1, top)
  //    eval_window.set_rightbottom(n - fcast + 1, btm)
  const evalWindow: EchoAreaBox = {
    leftIndex: n - length - fcast * 2 + 1,
    rightIndex: n - fcast + 1,
    top,
    btm,
  };

  // 2. Reference window:
  //    ref_window.set_lefttop(n - fcast + 1, top)
  //    ref_window.set_rightbottom(n, btm)
  const refWindow: EchoAreaBox = {
    leftIndex: n - fcast + 1,
    rightIndex: n,
    top,
    btm,
  };

  // 3. Correlation window:
  //    corr_window.set_lefttop(n - k - fcast * 2 + 1, top)
  //    corr_window.set_rightbottom(n - k - fcast, btm)
  const corrWindow: EchoAreaBox = {
    leftIndex: n - k - fcast * 2 + 1,
    rightIndex: n - k - fcast,
    top,
    btm,
  };

  const endForecastPrice = current;
  const forecastChangePercent = currentSrc !== 0 ? ((endForecastPrice - currentSrc) / currentSrc) * 100 : 0;

  return {
    bestCorrelation: bestVal ?? 0,
    bestOffset: k,
    top,
    btm,
    forecastSegments,
    forecastPoints,
    evalWindow,
    refWindow,
    corrWindow,
    lastClose: currentSrc,
    endForecastPrice,
    forecastChangePercent,
  };
}
