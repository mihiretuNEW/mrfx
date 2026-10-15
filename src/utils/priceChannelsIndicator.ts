/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, TimeframeId } from '../types';

export interface ChannelSegment {
  id: string;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  // Slopes and intercepts for upper and lower trendlines
  slope: number;
  slopePercentage: number; // Total % change across the channel span
  upperIntercept: number;
  lowerIntercept: number;
  // Specific start and end prices for drawing
  upperStartPrice: number;
  upperEndPrice: number;
  lowerStartPrice: number;
  lowerEndPrice: number;
  // Breakout details
  hasBreakout: boolean;
  breakoutType: 'BULLISH' | 'BEARISH' | null;
  breakoutIndex: number | null;
  breakoutPrice: number | null;
  falseBreakoutsCount?: number;
}

export interface PriceChannels4HResult {
  channels: ChannelSegment[];
  upperLine: (number | null)[];
  lowerLine: (number | null)[];
  breakouts: {
    index: number;
    time: number;
    type: 'BULLISH' | 'BEARISH';
    price: number;
  }[];
}

/**
 * Calculates Average True Range (ATR)
 */
function calculateATR(candles: Candle[], period = 14): number[] {
  const atr: number[] = [];
  if (!candles || !Array.isArray(candles) || candles.length === 0) return atr;

  let trSum = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      trSum += c.high - c.low;
      atr.push(c.high - c.low);
    } else {
      const prev = candles[i - 1];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      );
      if (i < period) {
        trSum += tr;
        atr.push(trSum / (i + 1));
      } else {
        const prevAtr = atr[i - 1];
        const val = (prevAtr * (period - 1) + tr) / period;
        atr.push(val);
      }
    }
  }
  return atr;
}

/**
 * STRICT TIMEFRAME ENFORCEMENT & MAJOR 4H LONG-TERM PRICE CHANNELS:
 *
 * 1. Timeframe Enforcement:
 *    - MUST ONLY execute and display if current active timeframe is strictly set to "4H" (240m).
 *    - Returns null immediately for any other timeframe to clear rendering on chart.
 *
 * 2. Long-Term Trend Detection for ALL Trends (Uptrends, Downtrends & Horizontal Ranges):
 *    - Fits extended channels across long time spans (30 to 100+ 4H bars = 5 to 16+ days).
 *    - Captures major macro moves as well as key consolidation price channels.
 *
 * 3. Anti-False Breakout Engine:
 *    - Utilizes multi-bar confirmation and ATR margin buffer to strictly eliminate false wicks.
 */
export function calculateAutoPriceChannels4H(
  candles: Candle[],
  timeframe: TimeframeId,
  options?: {
    lineColor?: string;
  }
): PriceChannels4HResult | null {
  // 1. STRICT TIMEFRAME ENFORCEMENT: ONLY execute on 4H
  if (timeframe !== '4H') {
    return null;
  }

  if (!candles || candles.length < 25) {
    return null;
  }

  const atrValues = calculateATR(candles, 14);
  const upperLine: (number | null)[] = new Array(candles.length).fill(null);
  const lowerLine: (number | null)[] = new Array(candles.length).fill(null);
  const breakouts: PriceChannels4HResult['breakouts'] = [];
  const channels: ChannelSegment[] = [];

  // Minimum trend span for long-term 4H macro analysis (30 bars = 120 hours ~ 5+ days)
  const minSegmentBars = 28;

  let currentStart = 0;

  while (currentStart < candles.length - minSegmentBars) {
    // Extended lookback window for fitting long trends (30 to 100 candles on 4H)
    const fitWindow = Math.min(100, candles.length - currentStart);
    if (fitWindow < minSegmentBars) break;

    // Linear regression over macro lookback window
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let k = 0; k < fitWindow; k++) {
      const idx = currentStart + k;
      const x = k;
      const y = (candles[idx].high + candles[idx].low) / 2;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const rawSlope = (fitWindow * sumXY - sumX * sumY) / (fitWindow * sumXX - sumX * sumX || 1);

    // Calculate average price & ATR over segment to evaluate normalized trend slope %
    let segmentPriceSum = 0;
    for (let k = 0; k < fitWindow; k++) {
      segmentPriceSum += candles[currentStart + k].close;
    }
    const avgPrice = segmentPriceSum / fitWindow;

    // Total % price change driven by slope over the channel span
    const totalMove = rawSlope * fitWindow;
    const totalMovePct = (totalMove / avgPrice) * 100;

    // Determine Trend Direction
    let trendDir: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    if (totalMovePct > 0.8) {
      trendDir = 'UP';
    } else if (totalMovePct < -0.8) {
      trendDir = 'DOWN';
    } else {
      trendDir = 'SIDEWAYS';
    }

    // Compute upper and lower intercepts using 92nd and 8th percentiles to avoid extreme outlier wicks
    const upperDiffs: number[] = [];
    const lowerDiffs: number[] = [];

    for (let k = 0; k < fitWindow; k++) {
      const idx = currentStart + k;
      const x = k;
      const expectedY = rawSlope * x;
      upperDiffs.push(candles[idx].high - expectedY);
      lowerDiffs.push(candles[idx].low - expectedY);
    }

    upperDiffs.sort((a, b) => a - b);
    lowerDiffs.sort((a, b) => a - b);

    const uIdx = Math.floor(upperDiffs.length * 0.92);
    const lIdx = Math.floor(lowerDiffs.length * 0.08);

    const upperIntercept = upperDiffs[uIdx] ?? Math.max(...upperDiffs);
    const lowerIntercept = lowerDiffs[lIdx] ?? Math.min(...lowerDiffs);

    // Scan forward to trace channel extension and detect TRUE structural breakouts
    let hasBreakout = false;
    let breakoutType: 'BULLISH' | 'BEARISH' | null = null;
    let breakoutIndex: number | null = null;
    let breakoutPrice: number | null = null;
    let falseBreakoutsCount = 0;

    let evalIndex = currentStart;

    for (let i = currentStart; i < candles.length; i++) {
      evalIndex = i;
      const x = i - currentStart;
      const uVal = rawSlope * x + upperIntercept;
      const lVal = rawSlope * x + lowerIntercept;

      upperLine[i] = uVal;
      lowerLine[i] = lVal;

      const c = candles[i];
      const atr = atrValues[i] || (uVal - lVal) * 0.1;
      const channelWidth = Math.abs(uVal - lVal);

      // Strong breakout margin buffer (0.35 * ATR or 15% channel width)
      const breakoutMargin = Math.max(0.35 * atr, 0.15 * channelWidth);

      // Check Bullish Breakout
      if (c.close > uVal + breakoutMargin && i >= currentStart + minSegmentBars) {
        const nextCandle = i + 1 < candles.length ? candles[i + 1] : null;
        const nextX = (i + 1) - currentStart;
        const nextUVal = rawSlope * nextX + upperIntercept;

        const isDecisiveClose = c.close > uVal + 0.65 * atr;
        const isNextConfirmed = nextCandle ? nextCandle.close > nextUVal + 0.2 * atr : true;

        if (isDecisiveClose || isNextConfirmed) {
          hasBreakout = true;
          breakoutType = 'BULLISH';
          breakoutIndex = i;
          breakoutPrice = c.close;
          breakouts.push({
            index: i,
            time: c.time,
            type: 'BULLISH',
            price: c.close,
          });
          break;
        } else {
          falseBreakoutsCount++;
        }
      }

      // Check Bearish Breakout
      if (c.close < lVal - breakoutMargin && i >= currentStart + minSegmentBars) {
        const nextCandle = i + 1 < candles.length ? candles[i + 1] : null;
        const nextX = (i + 1) - currentStart;
        const nextLVal = rawSlope * nextX + lowerIntercept;

        const isDecisiveClose = c.close < lVal - 0.65 * atr;
        const isNextConfirmed = nextCandle ? nextCandle.close < nextLVal - 0.2 * atr : true;

        if (isDecisiveClose || isNextConfirmed) {
          hasBreakout = true;
          breakoutType = 'BEARISH';
          breakoutIndex = i;
          breakoutPrice = c.close;
          breakouts.push({
            index: i,
            time: c.time,
            type: 'BEARISH',
            price: c.close,
          });
          break;
        } else {
          falseBreakoutsCount++;
        }
      }
    }

    const finalEnd = evalIndex;
    const startX = 0;
    const endX = finalEnd - currentStart;

    channels.push({
      id: `channel_${currentStart}_${finalEnd}`,
      startIndex: currentStart,
      endIndex: finalEnd,
      startTime: candles[currentStart].time,
      endTime: candles[finalEnd].time,
      trend: trendDir,
      slope: rawSlope,
      slopePercentage: Math.abs(totalMovePct),
      upperIntercept,
      lowerIntercept,
      upperStartPrice: rawSlope * startX + upperIntercept,
      upperEndPrice: rawSlope * endX + upperIntercept,
      lowerStartPrice: rawSlope * startX + lowerIntercept,
      lowerEndPrice: rawSlope * endX + lowerIntercept,
      hasBreakout,
      breakoutType,
      breakoutIndex,
      breakoutPrice,
      falseBreakoutsCount,
    });

    // Advance to next segment starting point
    if (hasBreakout && breakoutIndex !== null) {
      currentStart = breakoutIndex;
    } else {
      break;
    }
  }

  return {
    channels,
    upperLine,
    lowerLine,
    breakouts,
  };
}
