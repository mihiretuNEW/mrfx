/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, TimeframeId } from '../types';

const TIMEFRAME_SECONDS: Record<TimeframeId, number> = {
  '1M': 60,
  '2M': 120,
  '5M': 300,
  '15M': 900,
  '30M': 1800,
  '1H': 3600,
  '4H': 14400,
  '1D': 86400,
};

/**
 * Computes the nominal candle interval in seconds for the active timeframe.
 */
export function getCandleStepSeconds(candles: Candle[], timeframe: TimeframeId): number {
  const mapped = TIMEFRAME_SECONDS[timeframe];
  if (mapped) return mapped;

  if (candles.length > 1) {
    const diffs: number[] = [];
    const startIdx = Math.max(1, candles.length - 10);
    for (let i = startIdx; i < candles.length; i++) {
      const diff = candles[i].time - candles[i - 1].time;
      if (diff > 0) diffs.push(diff);
    }
    if (diffs.length > 0) {
      diffs.sort((a, b) => a - b);
      return diffs[Math.floor(diffs.length / 2)];
    }
  }
  return 60;
}

/**
 * Converts a continuous (potentially fractional) candle index into an exact
 * real-world Unix timestamp (seconds), invariant across panning and zooming.
 */
export function continuousIndexToTime(
  exactIndex: number,
  candles: Candle[],
  candleStepSec: number
): number {
  const n = candles.length;
  if (n === 0) return Date.now() / 1000;

  if (exactIndex <= 0) {
    return candles[0].time + exactIndex * candleStepSec;
  }
  if (exactIndex >= n - 1) {
    return candles[n - 1].time + (exactIndex - (n - 1)) * candleStepSec;
  }

  const i0 = Math.floor(exactIndex);
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = exactIndex - i0;
  const t0 = candles[i0].time;
  const t1 = candles[i1].time;
  return t0 + frac * (t1 - t0);
}

/**
 * Converts a real-world Unix timestamp (seconds) back into a continuous
 * (potentially fractional) candle index on ANY timeframe via O(log N) binary search
 * + linear interpolation inside [t0, t1], or clean extrapolation beyond edges.
 */
export function timeToContinuousIndex(
  time: number,
  candles: Candle[],
  candleStepSec: number
): number {
  const n = candles.length;
  if (n === 0) return 0;

  const step = candleStepSec > 0 ? candleStepSec : 60;

  if (time <= candles[0].time) {
    return -(candles[0].time - time) / step;
  }
  if (time >= candles[n - 1].time) {
    return (n - 1) + (time - candles[n - 1].time) / step;
  }

  // Binary search for largest lo such that candles[lo].time <= time < candles[hi].time
  let lo = 0;
  let hi = n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= time) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const t0 = candles[lo].time;
  const t1 = candles[lo + 1].time;
  const span = t1 - t0;
  if (span <= 0) return lo;
  return lo + (time - t0) / span;
}
