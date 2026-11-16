/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, TimeframeId } from '../types';

export interface ChannelSegment {
  id: string;
  startIndex: number;
  endIndex: number;
  lockedFromIndex: number;
  startTime: number;
  endTime: number;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  slope: number;
  slopePercentage: number;
  upperIntercept: number;
  lowerIntercept: number;
  upperStartPrice: number;
  upperEndPrice: number;
  lowerStartPrice: number;
  lowerEndPrice: number;
  hasBreakout: boolean;
  breakoutType: 'BULLISH' | 'BEARISH' | null;
  breakoutIndex: number | null;
  breakoutPrice: number | null;
  falseBreakoutsCount?: number;
}

export interface PriceChannelSignal {
  index: number;
  time: number;
  type: 'BUY' | 'SELL';
  price: number;
  high: number;
  low: number;
  reason: 'TOUCH' | 'BOUNCE';
  ltfTimeframe: TimeframeId;
  htfTimeframe: TimeframeId;
  ltfLinePrice: number;
  htfLinePrice: number;
  isLive: boolean;
}

export interface PriceChannelsResult {
  timeframe: TimeframeId;
  htfTimeframe: TimeframeId | null;
  channels: ChannelSegment[];
  upperLine: (number | null)[];
  lowerLine: (number | null)[];
  breakouts: {
    index: number;
    time: number;
    type: 'BULLISH' | 'BEARISH';
    price: number;
  }[];
  signals: PriceChannelSignal[];
}

export type PriceChannels4HResult = PriceChannelsResult;

const SUPPORTED_CHANNEL_TIMEFRAMES = new Set<TimeframeId>(['5M', '15M', '30M', '1H', '4H']);

const HTF_PAIR_MAP: Partial<Record<TimeframeId, { tf: TimeframeId; seconds: number }>> = {
  '5M': { tf: '15M', seconds: 900 },
  '15M': { tf: '1H', seconds: 3600 },
  '30M': { tf: '1H', seconds: 3600 },
  '1H': { tf: '4H', seconds: 14400 },
};

const ANCHOR_BARS = 28;

function calculateATR(candles: Candle[], period = 14): number[] {
  const atr: number[] = [];
  if (!candles || candles.length === 0) return atr;

  let trSum = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      const tr = c.high - c.low;
      trSum += tr;
      atr.push(tr);
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
        atr.push((atr[i - 1] * (period - 1) + tr) / period);
      }
    }
  }
  return atr;
}

/**
 * Fits regression channel parameters strictly over [startIdx .. startIdx + ANCHOR_BARS - 1].
 * Once fitted from those 32 closed candles, parameters are LOCKED and NEVER repainted.
 */
function fitAnchoredChannel(candles: Candle[], startIdx: number) {
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let k = 0; k < ANCHOR_BARS; k++) {
    const c = candles[startIdx + k];
    const x = k;
    const y = (c.high + c.low) / 2;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denom = ANCHOR_BARS * sumXX - sumX * sumX || 1;
  const slope = (ANCHOR_BARS * sumXY - sumX * sumY) / denom;

  let priceSum = 0;
  const upperDiffs: number[] = [];
  const lowerDiffs: number[] = [];
  for (let k = 0; k < ANCHOR_BARS; k++) {
    const c = candles[startIdx + k];
    priceSum += c.close;
    const expectedY = slope * k;
    upperDiffs.push(c.high - expectedY);
    lowerDiffs.push(c.low - expectedY);
  }

  const avgPrice = priceSum / ANCHOR_BARS || 1;
  const totalMovePct = ((slope * ANCHOR_BARS) / avgPrice) * 100;
  const trend: 'UP' | 'DOWN' | 'SIDEWAYS' =
    totalMovePct > 0.8 ? 'UP' : totalMovePct < -0.8 ? 'DOWN' : 'SIDEWAYS';

  upperDiffs.sort((a, b) => a - b);
  lowerDiffs.sort((a, b) => a - b);

  const uIdx = Math.floor(upperDiffs.length * 0.92);
  const lIdx = Math.floor(lowerDiffs.length * 0.08);
  const upperIntercept = upperDiffs[uIdx] ?? upperDiffs[upperDiffs.length - 1];
  const lowerIntercept = lowerDiffs[lIdx] ?? lowerDiffs[0];

  return {
    slope,
    totalMovePct,
    trend,
    upperIntercept,
    lowerIntercept,
  };
}

/**
 * Strictly Causal & Non-Repainting Channel Builder:
 * - Waits ANCHOR_BARS (32) closed candles before locking slope & upper/lower intercepts.
 * - Never updates slope/intercepts retroactively when new candles arrive.
 * - Breakouts are evaluated strictly on CLOSED candles (i < candles.length - 1) with ZERO i+1 lookahead.
 */
function buildCausalChannels(candles: Candle[]) {
  const atrValues = calculateATR(candles, 14);
  const upperLine: (number | null)[] = new Array(candles.length).fill(null);
  const lowerLine: (number | null)[] = new Array(candles.length).fill(null);
  const segmentForBar: (ChannelSegment | null)[] = new Array(candles.length).fill(null);
  const breakouts: PriceChannelsResult['breakouts'] = [];
  const channels: ChannelSegment[] = [];

  let currentStart = 0;
  // Require currentStart + ANCHOR_BARS < candles.length so anchor bars [currentStart .. currentStart + ANCHOR_BARS - 1] are closed
  while (currentStart + ANCHOR_BARS < candles.length) {
    const fit = fitAnchoredChannel(candles, currentStart);
    const lockedFromIndex = currentStart + ANCHOR_BARS;

    let hasBreakout = false;
    let breakoutType: 'BULLISH' | 'BEARISH' | null = null;
    let breakoutIndex: number | null = null;
    let breakoutPrice: number | null = null;
    let consecutiveBull = 0;
    let consecutiveBear = 0;
    let falseBreakoutsCount = 0;
    let evalIndex = candles.length - 1;

    // Populate line values on all locked bars [lockedFromIndex .. end], and draw segment from currentStart
    for (let i = lockedFromIndex; i < candles.length; i++) {
      const x = i - currentStart;
      const uVal = fit.slope * x + fit.upperIntercept;
      const lVal = fit.slope * x + fit.lowerIntercept;

      upperLine[i] = uVal;
      lowerLine[i] = lVal;

      const c = candles[i];
      const atr = atrValues[i] || Math.abs(uVal - lVal) * 0.1;
      const channelWidth = Math.abs(uVal - lVal);
      const decisiveMargin = Math.max(0.65 * atr, 0.20 * channelWidth);
      const mildMargin = Math.max(0.30 * atr, 0.10 * channelWidth);

      const isClosedBar = i < candles.length - 1;
      if (isClosedBar) {
        if (c.close > uVal + mildMargin) {
          consecutiveBull += 1;
          consecutiveBear = 0;
          if (c.close > uVal + decisiveMargin || consecutiveBull >= 2) {
            hasBreakout = true;
            breakoutType = 'BULLISH';
            breakoutIndex = i;
            breakoutPrice = c.close;
            evalIndex = i;
            breakouts.push({ index: i, time: c.time, type: 'BULLISH', price: c.close });
            break;
          } else {
            falseBreakoutsCount += 1;
          }
        } else if (c.close < lVal - mildMargin) {
          consecutiveBear += 1;
          consecutiveBull = 0;
          if (c.close < lVal - decisiveMargin || consecutiveBear >= 2) {
            hasBreakout = true;
            breakoutType = 'BEARISH';
            breakoutIndex = i;
            breakoutPrice = c.close;
            evalIndex = i;
            breakouts.push({ index: i, time: c.time, type: 'BEARISH', price: c.close });
            break;
          } else {
            falseBreakoutsCount += 1;
          }
        } else {
          consecutiveBull = 0;
          consecutiveBear = 0;
        }
      }
      evalIndex = i;
    }

    const seg: ChannelSegment = {
      id: `channel_${currentStart}_${evalIndex}`,
      startIndex: currentStart,
      endIndex: evalIndex,
      lockedFromIndex,
      startTime: candles[currentStart].time,
      endTime: candles[evalIndex].time,
      trend: fit.trend,
      slope: fit.slope,
      slopePercentage: Math.abs(fit.totalMovePct),
      upperIntercept: fit.upperIntercept,
      lowerIntercept: fit.lowerIntercept,
      upperStartPrice: fit.upperIntercept,
      upperEndPrice: fit.slope * (evalIndex - currentStart) + fit.upperIntercept,
      lowerStartPrice: fit.lowerIntercept,
      lowerEndPrice: fit.slope * (evalIndex - currentStart) + fit.lowerIntercept,
      hasBreakout,
      breakoutType,
      breakoutIndex,
      breakoutPrice,
      falseBreakoutsCount,
    };

    channels.push(seg);
    for (let i = lockedFromIndex; i <= evalIndex; i++) {
      segmentForBar[i] = seg;
    }

    if (hasBreakout && breakoutIndex !== null) {
      currentStart = breakoutIndex;
    } else {
      break;
    }
  }

  return { channels, upperLine, lowerLine, breakouts, segmentForBar, atrValues };
}

/**
 * Incremental strictly causal tracker for the background Higher Timeframe (HTF) channel.
 * Guarantees that when evaluating LTF candle `i`, the background HTF candle only knows
 * LTF price action up to and including candle `i` (ZERO intra-HTF lookahead!).
 */
class IncrementalCausalHtfChannelTracker {
  public closedBars: Candle[] = [];
  private atrValues: number[] = [];
  private trSum = 0;

  private currentStart = 0;
  private isLocked = false;
  private slope = 0;
  private upperIntercept = 0;
  private lowerIntercept = 0;
  private consecBull = 0;
  private consecBear = 0;

  public prevClosedBar: Candle | null = null;
  public prevClosedUpper: number | null = null;
  public prevClosedLower: number | null = null;

  public pushClosedBar(bar: Candle) {
    const idx = this.closedBars.length;
    this.closedBars.push(bar);

    const tr =
      idx === 0
        ? bar.high - bar.low
        : Math.max(
            bar.high - bar.low,
            Math.abs(bar.high - this.closedBars[idx - 1].close),
            Math.abs(bar.low - this.closedBars[idx - 1].close)
          );
    if (idx === 0) {
      this.trSum += tr;
      this.atrValues.push(tr);
    } else if (idx < 14) {
      this.trSum += tr;
      this.atrValues.push(this.trSum / (idx + 1));
    } else {
      this.atrValues.push((this.atrValues[idx - 1] * 13 + tr) / 14);
    }

    let barUpper: number | null = null;
    let barLower: number | null = null;

    if (!this.isLocked) {
      if (this.closedBars.length - this.currentStart >= ANCHOR_BARS) {
        const fit = fitAnchoredChannel(this.closedBars, this.currentStart);
        this.slope = fit.slope;
        this.upperIntercept = fit.upperIntercept;
        this.lowerIntercept = fit.lowerIntercept;
        this.isLocked = true;
        this.consecBull = 0;
        this.consecBear = 0;
      }
    } else {
      const x = idx - this.currentStart;
      barUpper = this.slope * x + this.upperIntercept;
      barLower = this.slope * x + this.lowerIntercept;

      const atr = this.atrValues[idx] || Math.abs(barUpper - barLower) * 0.1;
      const width = Math.abs(barUpper - barLower);
      const decisiveMargin = Math.max(0.65 * atr, 0.20 * width);
      const mildMargin = Math.max(0.30 * atr, 0.10 * width);

      if (bar.close > barUpper + mildMargin) {
        this.consecBull += 1;
        this.consecBear = 0;
        if (bar.close > barUpper + decisiveMargin || this.consecBull >= 2) {
          this.currentStart = idx;
          this.isLocked = false;
          this.consecBull = 0;
        }
      } else if (bar.close < barLower - mildMargin) {
        this.consecBear += 1;
        this.consecBull = 0;
        if (bar.close < barLower - decisiveMargin || this.consecBear >= 2) {
          this.currentStart = idx;
          this.isLocked = false;
          this.consecBear = 0;
        }
      } else {
        this.consecBull = 0;
        this.consecBear = 0;
      }
    }

    this.prevClosedBar = bar;
    this.prevClosedUpper = barUpper;
    this.prevClosedLower = barLower;
  }

  public getLiveBounds(): { upper: number | null; lower: number | null; atr: number } {
    if (!this.isLocked) {
      return { upper: null, lower: null, atr: this.atrValues[this.atrValues.length - 1] || 0 };
    }
    const hIdx = this.closedBars.length;
    const x = hIdx - this.currentStart;
    return {
      upper: this.slope * x + this.upperIntercept,
      lower: this.slope * x + this.lowerIntercept,
      atr: this.atrValues[this.atrValues.length - 1] || 0,
    };
  }
}

/**
 * Multi-Timeframe Non-Repainting Auto Price Channels + Golden Rule Touch/Bounce Signals:
 * - Draws channels for active TF (`5M`, `15M`, `30M`, `1H`, `4H`).
 * - Runs paired HTF (`5M->15M`, `15M->1H`, `30M->1H`, `1H->4H`) purely in the background.
 * - Fires LIVE `BUY` (Lower touch/bounce) & `SELL` (Upper touch/bounce) only after lines exist & lock.
 */
export function calculateAutoPriceChannels4H(
  candles: Candle[],
  timeframe: TimeframeId,
  options?: {
    lineColor?: string;
    showSignals?: boolean;
  }
): PriceChannelsResult | null {
  if (!SUPPORTED_CHANNEL_TIMEFRAMES.has(timeframe)) {
    return null;
  }
  if (!candles || candles.length < ANCHOR_BARS + 2) {
    return null;
  }

  const { channels, upperLine, lowerLine, breakouts, segmentForBar, atrValues } = buildCausalChannels(candles);
  const htfPair = HTF_PAIR_MAP[timeframe] || null;
  const signals: PriceChannelSignal[] = [];

  if (htfPair && (options?.showSignals ?? true)) {
    const htfSec = htfPair.seconds;
    const tracker = new IncrementalCausalHtfChannelTracker();
    let formingHtf: Candle | null = null;

    let lastLtfLowTouchIdx = -999;
    let lastLtfHighTouchIdx = -999;
    let lastLtfSegmentId = '';

    let lastBuyIdx = -999;
    let lastSellIdx = -999;
    let buyResetReady = true;
    let sellResetReady = true;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const bucketTime = Math.floor(c.time / htfSec) * htfSec;

      if (!formingHtf) {
        formingHtf = { time: bucketTime, open: c.open, high: c.high, low: c.low, close: c.close };
      } else if (bucketTime !== formingHtf.time) {
        tracker.pushClosedBar(formingHtf);
        formingHtf = { time: bucketTime, open: c.open, high: c.high, low: c.low, close: c.close };
      } else {
        formingHtf.high = Math.max(formingHtf.high, c.high);
        formingHtf.low = Math.min(formingHtf.low, c.low);
        formingHtf.close = c.close;
      }

      const ltfU = upperLine[i];
      const ltfL = lowerLine[i];
      const ltfSeg = segmentForBar[i];
      const htfBounds = tracker.getLiveBounds();

      if (!ltfSeg || ltfU === null || ltfL === null || htfBounds.upper === null || htfBounds.lower === null) {
        continue;
      }

      if (ltfSeg.id !== lastLtfSegmentId) {
        lastLtfSegmentId = ltfSeg.id;
        lastLtfLowTouchIdx = -999;
        lastLtfHighTouchIdx = -999;
        buyResetReady = true;
        sellResetReady = true;
      }

      const ltfWidth = Math.max(1e-9, ltfU - ltfL);
      const ltfAtr = atrValues[i] || ltfWidth * 0.1;
      const ltfTol = ltfWidth * 0.035;
      const ltfMaxPierce = Math.max(ltfAtr * 0.55, ltfWidth * 0.18);

      const htfU = htfBounds.upper;
      const htfL = htfBounds.lower;
      const htfWidth = Math.max(1e-9, htfU - htfL);
      const htfAtr = htfBounds.atr || htfWidth * 0.1;
      const htfTol = htfWidth * 0.035;
      const htfMaxPierce = Math.max(htfAtr * 0.55, htfWidth * 0.18);

      // Update reset state once price leaves immediate zone so separate visits re-arm cleanly
      if (c.low > ltfL + ltfWidth * 0.10) {
        buyResetReady = true;
      }
      if (c.high < ltfU - ltfWidth * 0.10) {
        sellResetReady = true;
      }

      // 1. LTF Touch & Bounce State
      const ltfTouchLowNow = c.low <= ltfL + ltfTol && c.close >= ltfL - ltfMaxPierce;
      const ltfTouchHighNow = c.high >= ltfU - ltfTol && c.close <= ltfU + ltfMaxPierce;

      if (ltfTouchLowNow) lastLtfLowTouchIdx = i;
      if (ltfTouchHighNow) lastLtfHighTouchIdx = i;

      const prevClose = i > 0 ? candles[i - 1].close : c.open;
      const ltfReturningUp =
        !ltfTouchLowNow &&
        i - lastLtfLowTouchIdx <= 2 &&
        c.close > c.open &&
        c.close >= prevClose &&
        c.close >= ltfL &&
        c.close < ltfL + ltfWidth * 0.55;

      const ltfReturningDown =
        !ltfTouchHighNow &&
        i - lastLtfHighTouchIdx <= 2 &&
        c.close < c.open &&
        c.close <= prevClose &&
        c.close <= ltfU &&
        c.close > ltfU - ltfWidth * 0.55;

      // 2. Causal Background HTF Touch & Bounce State
      const htfCur = formingHtf;
      const prevHtf = tracker.prevClosedBar;
      const prevHtfL = tracker.prevClosedLower;
      const prevHtfU = tracker.prevClosedUpper;

      const htfTouchLowNow = htfCur.low <= htfL + htfTol && htfCur.close >= htfL - htfMaxPierce;
      const htfTouchHighNow = htfCur.high >= htfU - htfTol && htfCur.close <= htfU + htfMaxPierce;

      const prevHtfTouchedLow =
        prevHtf !== null && prevHtfL !== null && prevHtf.low <= prevHtfL + htfTol && prevHtf.close >= prevHtfL - htfMaxPierce;
      const prevHtfTouchedHigh =
        prevHtf !== null && prevHtfU !== null && prevHtf.high >= prevHtfU - htfTol && prevHtf.close <= prevHtfU + htfMaxPierce;

      const htfRange = Math.max(1e-9, htfCur.high - htfCur.low);
      const htfReturningUp =
        (htfTouchLowNow || prevHtfTouchedLow) &&
        htfCur.close < htfU - htfWidth * 0.25 &&
        (htfCur.close > htfCur.open || (htfCur.close - htfCur.low) / htfRange >= 0.45) &&
        htfCur.close >= htfL;

      const htfReturningDown =
        (htfTouchHighNow || prevHtfTouchedHigh) &&
        htfCur.close > htfL + htfWidth * 0.25 &&
        (htfCur.close < htfCur.open || (htfCur.high - htfCur.close) / htfRange >= 0.45) &&
        htfCur.close <= htfU;

      // 3. Golden Rule Evaluation
      const buyViaTouch = ltfTouchLowNow && (htfTouchLowNow || htfReturningUp);
      const buyViaBounce = ltfReturningUp && htfReturningUp;
      const sellViaTouch = ltfTouchHighNow && (htfTouchHighNow || htfReturningDown);
      const sellViaBounce = ltfReturningDown && htfReturningDown;

      let chosen: 'BUY' | 'SELL' | null = null;
      let reason: 'TOUCH' | 'BOUNCE' = 'TOUCH';

      if ((buyViaTouch || buyViaBounce) && (sellViaTouch || sellViaBounce)) {
        if (c.close >= c.open) {
          chosen = 'BUY';
          reason = buyViaTouch ? 'TOUCH' : 'BOUNCE';
        } else {
          chosen = 'SELL';
          reason = sellViaTouch ? 'TOUCH' : 'BOUNCE';
        }
      } else if (buyViaTouch || buyViaBounce) {
        chosen = 'BUY';
        reason = buyViaTouch ? 'TOUCH' : 'BOUNCE';
      } else if (sellViaTouch || sellViaBounce) {
        chosen = 'SELL';
        reason = sellViaTouch ? 'TOUCH' : 'BOUNCE';
      }

      if (chosen === 'BUY' && (buyResetReady || i - lastBuyIdx >= 4)) {
        signals.push({
          index: i,
          time: c.time,
          type: 'BUY',
          price: c.close,
          high: c.high,
          low: c.low,
          reason,
          ltfTimeframe: timeframe,
          htfTimeframe: htfPair.tf,
          ltfLinePrice: ltfL,
          htfLinePrice: htfL,
          isLive: i === candles.length - 1,
        });
        lastBuyIdx = i;
        buyResetReady = false;
        sellResetReady = true;
      } else if (chosen === 'SELL' && (sellResetReady || i - lastSellIdx >= 4)) {
        signals.push({
          index: i,
          time: c.time,
          type: 'SELL',
          price: c.close,
          high: c.high,
          low: c.low,
          reason,
          ltfTimeframe: timeframe,
          htfTimeframe: htfPair.tf,
          ltfLinePrice: ltfU,
          htfLinePrice: htfU,
          isLive: i === candles.length - 1,
        });
        lastSellIdx = i;
        sellResetReady = false;
        buyResetReady = true;
      }
    }
  }

  return {
    timeframe,
    htfTimeframe: htfPair ? htfPair.tf : null,
    channels,
    upperLine,
    lowerLine,
    breakouts,
    signals,
  };
}

export const calculateAutoPriceChannels = calculateAutoPriceChannels4H;
