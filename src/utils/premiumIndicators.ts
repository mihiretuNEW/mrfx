/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, TimeframeId, SMCInstanceConfig } from '../types';

export interface TWBResult {
  upperLine: (number | null)[]; // Values of the resistance trendline for each candle
  lowerLine: (number | null)[]; // Values of the support trendline for each candle
  buyBreaks: boolean[];         // True on bars with a Bullish Breakout
  sellBreaks: boolean[];        // True on bars with a Bearish Breakout
}

export interface SMCLine {
  id: string;
  type: 'BOS' | 'CHoCH';
  isBullish: boolean;
  level: number;
  startIndex: number;
  endIndex: number;
}

export interface SMCOrderBlock {
  id: string;
  isBullish: boolean;
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number | null; // null if still active / unmitigated
  isStrong?: boolean;
  typeLabel?: string;
}

export interface SMCResult {
  bosChochLines: SMCLine[];
  orderBlocks: SMCOrderBlock[];
  swingHighs: (number | null)[];
  swingLows: (number | null)[];
}

/**
 * Calculates ATR (Average True Range)
 */
export function calculateATR(candles: Candle[], period: number): number[] {
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
 * Calculates Pivot Highs & Pivot Lows
 * A pivot high is a peak that is the maximum in [i - length, i + length]
 */
export function calculatePivots(
  candles: Candle[],
  length: number
): { pivotHighs: (number | null)[]; pivotLows: (number | null)[] } {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return { pivotHighs: [], pivotLows: [] };
  }
  const pivotHighs: (number | null)[] = new Array(candles.length).fill(null);
  const pivotLows: (number | null)[] = new Array(candles.length).fill(null);

  if (candles.length < length * 2 + 1) {
    return { pivotHighs, pivotLows };
  }

  for (let i = length; i < candles.length - length; i++) {
    const targetHigh = candles[i].high;
    const targetLow = candles[i].low;
    let isHigh = true;
    let isLow = true;

    for (let j = i - length; j <= i + length; j++) {
      if (j === i) continue;
      if (candles[j].high > targetHigh) isHigh = false;
      if (candles[j].low < targetLow) isLow = false;
    }

    if (isHigh) pivotHighs[i] = targetHigh;
    if (isLow) pivotLows[i] = targetLow;
  }

  return { pivotHighs, pivotLows };
}

/**
 * Trendlines with Breaks
 * LuxAlgo Official Logic:
 * Pivot points are evaluated.
 * Upper trendline is drawn connecting/extending from pivot highs, sloping down.
 * Lower trendline is drawn extending from pivot lows, sloping up.
 * Breaks are triggered when close crosses these lines.
 */
export function calculateTrendlinesWithBreaks(
  candles: Candle[],
  length = 14,
  slopeMultiplier = 1.6,
  slopeMethod: 'atr' | 'manual' = 'atr'
): TWBResult {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return { upperLine: [], lowerLine: [], buyBreaks: [], sellBreaks: [] };
  }
  const size = candles.length;
  const upperLine: (number | null)[] = new Array(size).fill(null);
  const lowerLine: (number | null)[] = new Array(size).fill(null);
  const buyBreaks: boolean[] = new Array(size).fill(false);
  const sellBreaks: boolean[] = new Array(size).fill(false);

  if (size < length * 2 + 1) {
    return { upperLine, lowerLine, buyBreaks, sellBreaks };
  }

  const { pivotHighs, pivotLows } = calculatePivots(candles, length);
  const atr = calculateATR(candles, length);

  // States for active lines
  let activeUpperStartIdx: number | null = null;
  let activeUpperStartPrice: number | null = null;
  let activeUpperSlope = 0;

  let activeLowerStartIdx: number | null = null;
  let activeLowerStartPrice: number | null = null;
  let activeLowerSlope = 0;

  for (let i = 0; i < size; i++) {
    const c = candles[i];
    
    // Check if we confirmed a pivot high at bar (i - length)
    const phIdx = i - length;
    if (phIdx >= 0 && pivotHighs[phIdx] !== null) {
      activeUpperStartIdx = phIdx;
      activeUpperStartPrice = pivotHighs[phIdx];
      // Calculate slope
      const rawSlope = slopeMethod === 'atr' ? (atr[i] || (c.high - c.low)) : 1.0;
      // Slopes are down for upper line, let's keep it positive as decline rate
      activeUpperSlope = (rawSlope / length) * slopeMultiplier;
    }

    // Check if we confirmed a pivot low at bar (i - length)
    const plIdx = i - length;
    if (plIdx >= 0 && pivotLows[plIdx] !== null) {
      activeLowerStartIdx = plIdx;
      activeLowerStartPrice = pivotLows[plIdx];
      // Slopes are up for lower line
      const rawSlope = slopeMethod === 'atr' ? (atr[i] || (c.high - c.low)) : 1.0;
      activeLowerSlope = (rawSlope / length) * slopeMultiplier;
    }

    // Calculate current line values
    if (activeUpperStartIdx !== null && activeUpperStartPrice !== null) {
      const barsElapsed = i - activeUpperStartIdx;
      const val = activeUpperStartPrice - activeUpperSlope * barsElapsed;
      upperLine[i] = val;

      // Check break: close crosses above resistance line
      if (c.close > val && i > activeUpperStartIdx) {
        buyBreaks[i] = true;
        // Reset the active line so we don't spam breaks until next pivot
        activeUpperStartIdx = null;
        activeUpperStartPrice = null;
      }
    }

    if (activeLowerStartIdx !== null && activeLowerStartPrice !== null) {
      const barsElapsed = i - activeLowerStartIdx;
      const val = activeLowerStartPrice + activeLowerSlope * barsElapsed;
      lowerLine[i] = val;

      // Check break: close crosses below support line
      if (c.close < val && i > activeLowerStartIdx) {
        sellBreaks[i] = true;
        // Reset active line
        activeLowerStartIdx = null;
        activeLowerStartPrice = null;
      }
    }
  }

  return { upperLine, lowerLine, buyBreaks, sellBreaks };
}

/**
 * Smart Money Concepts (SMC)
 * Market Structure (BOS, CHoCH) and Order Blocks (OB)
 */
export function calculateSmartMoneyConcepts(
  candles: Candle[],
  swingLookback = 5,
  obLimit = 5,
  obMode: 'strong' | 'all' = 'strong'
): SMCResult {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return { bosChochLines: [], orderBlocks: [], swingHighs: [], swingLows: [] };
  }
  const size = candles.length;
  const swingHighs: (number | null)[] = new Array(size).fill(null);
  const swingLows: (number | null)[] = new Array(size).fill(null);

  const bosChochLines: SMCLine[] = [];
  const orderBlocks: SMCOrderBlock[] = [];

  // Support user's lookback: 720 (Monthly), 168 (Weekly), 24 (Daily), 5 (Intraday) or any custom period.
  // Instead of a rigid symmetrical window that requires hundreds of future candles and causes 0 OBs on high lookbacks,
  // we use an intelligent adaptive macro swing radius:
  // - Small lookbacks (<= 15): exact symmetrical pivot detection (e.g. 5 bars).
  // - Macro lookbacks (24, 168, 720, etc.): scaled swing radius that captures macro institutional turning points
  //   without noise while confirming cleanly on available live candles.
  const requestedLookback = Math.max(2, Math.floor(swingLookback || 5));
  let leftBars: number;
  let rightBars: number;

  if (requestedLookback <= 15) {
    leftBars = Math.min(requestedLookback, Math.max(2, Math.floor((size - 1) / 3)));
    rightBars = leftBars;
  } else {
    // Macro lookback: scales smoothly so 24 gives ~14, 168 gives ~35, 720 gives ~65-80 (capped by available history)
    const maxLookbackAvailable = Math.max(4, Math.floor((size - 1) / 4));
    const scaledRadius = Math.round(Math.pow(requestedLookback, 0.62) * 1.5);
    leftBars = Math.min(requestedLookback, Math.min(maxLookbackAvailable, scaledRadius));
    rightBars = Math.min(leftBars, Math.max(3, Math.min(10, Math.floor(Math.sqrt(leftBars) * 1.2))));
  }

  if (size < leftBars + rightBars + 1) {
    return { bosChochLines, orderBlocks, swingHighs, swingLows };
  }

  // 1. Calculate Swing Pivots
  for (let i = leftBars; i < size - rightBars; i++) {
    const targetHigh = candles[i].high;
    const targetLow = candles[i].low;
    let isHigh = true;
    let isLow = true;

    for (let j = Math.max(0, i - leftBars); j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].high > targetHigh) isHigh = false;
      if (candles[j].low < targetLow) isLow = false;
    }

    if (isHigh) swingHighs[i] = targetHigh;
    if (isLow) swingLows[i] = targetLow;
  }

  // 2. Track structure & breaks
  let currentTrend: 'bullish' | 'bearish' | 'none' = 'none';
  let lastSwingHighVal: number | null = null;
  let lastSwingHighIdx: number | null = null;
  let lastSwingLowVal: number | null = null;
  let lastSwingLowIdx: number | null = null;

  for (let i = 0; i < size; i++) {
    const c = candles[i];

    // Confirmation point: a pivot at (i - rightBars) is now confirmed
    const confirmedIdx = i - rightBars;
    if (confirmedIdx >= 0) {
      if (swingHighs[confirmedIdx] !== null) {
        lastSwingHighVal = swingHighs[confirmedIdx];
        lastSwingHighIdx = confirmedIdx;
      }
      if (swingLows[confirmedIdx] !== null) {
        lastSwingLowVal = swingLows[confirmedIdx];
        lastSwingLowIdx = confirmedIdx;
      }
    }

    // Check mitigation of active order blocks:
    // "price ካለፈ በኃላ አይወጣም" - once price penetrates / violates the OB, it is marked mitigated
    orderBlocks.forEach((ob) => {
      if (ob.endIndex === null && i > ob.startIndex) {
        if (ob.isBullish) {
          // Mitigated if candle price penetrates below OB bottom
          if (c.close < ob.bottom || c.low < ob.bottom) {
            ob.endIndex = i;
          }
        } else {
          // Mitigated if candle price penetrates above OB top
          if (c.close > ob.top || c.high > ob.top) {
            ob.endIndex = i;
          }
        }
      }
    });

    // Structure breakout above confirmed Swing High
    if (lastSwingHighVal !== null && lastSwingHighIdx !== null && i > lastSwingHighIdx) {
      if (c.close > lastSwingHighVal) {
        const isChoch = currentTrend === 'bearish';
        const type = isChoch ? 'CHoCH' : 'BOS';

        bosChochLines.push({
          id: `smc-line-h-${i}`,
          type,
          isBullish: true,
          level: lastSwingHighVal,
          startIndex: lastSwingHighIdx,
          endIndex: i,
        });

        // Form Bullish Order Block (Demand zone at the base of the breakout)
        let obCandleIdx = lastSwingLowIdx !== null ? lastSwingLowIdx : Math.max(0, i - 3);
        const searchStart = Math.max(0, obCandleIdx - 2);
        const searchEnd = Math.min(size - 1, i - 1);
        let bestObIdx = obCandleIdx;
        let lowestPrice = Infinity;

        for (let s = searchStart; s <= searchEnd; s++) {
          if (candles[s].low < lowestPrice) {
            lowestPrice = candles[s].low;
            bestObIdx = s;
          }
        }

        const obCandle = candles[bestObIdx];
        const rawTop = Math.max(obCandle.open, obCandle.close);
        const rawBottom = obCandle.low;
        const minHeight = Math.max(0.01, (obCandle.high - obCandle.low) * 0.4);
        const top = Math.max(rawTop, rawBottom + minHeight);
        const bottom = rawBottom;

        const isObStrong = isChoch || (i - bestObIdx <= 10) || orderBlocks.length === 0;
        orderBlocks.push({
          id: `ob-bullish-${i}`,
          isBullish: true,
          top,
          bottom,
          startIndex: bestObIdx,
          endIndex: null,
          isStrong: isObStrong,
          typeLabel: isObStrong ? '+OB (Demand)' : '+OB',
        });

        currentTrend = 'bullish';
        lastSwingHighVal = null;
        lastSwingHighIdx = null;
      }
    }

    // Structure breakout below confirmed Swing Low
    if (lastSwingLowVal !== null && lastSwingLowIdx !== null && i > lastSwingLowIdx) {
      if (c.close < lastSwingLowVal) {
        const isChoch = currentTrend === 'bullish';
        const type = isChoch ? 'CHoCH' : 'BOS';

        bosChochLines.push({
          id: `smc-line-l-${i}`,
          type,
          isBullish: false,
          level: lastSwingLowVal,
          startIndex: lastSwingLowIdx,
          endIndex: i,
        });

        // Form Bearish Order Block (Supply zone at the top of the breakdown)
        let obCandleIdx = lastSwingHighIdx !== null ? lastSwingHighIdx : Math.max(0, i - 3);
        const searchStart = Math.max(0, obCandleIdx - 2);
        const searchEnd = Math.min(size - 1, i - 1);
        let bestObIdx = obCandleIdx;
        let highestPrice = -Infinity;

        for (let s = searchStart; s <= searchEnd; s++) {
          if (candles[s].high > highestPrice) {
            highestPrice = candles[s].high;
            bestObIdx = s;
          }
        }

        const obCandle = candles[bestObIdx];
        const rawTop = obCandle.high;
        const rawBottom = Math.min(obCandle.open, obCandle.close);
        const minHeight = Math.max(0.01, (obCandle.high - obCandle.low) * 0.4);
        const top = rawTop;
        const bottom = Math.min(rawBottom, rawTop - minHeight);

        const isObStrong = isChoch || (i - bestObIdx <= 10) || orderBlocks.length === 0;
        orderBlocks.push({
          id: `ob-bearish-${i}`,
          isBullish: false,
          top,
          bottom,
          startIndex: bestObIdx,
          endIndex: null,
          isStrong: isObStrong,
          typeLabel: isObStrong ? '-OB (Supply)' : '-OB',
        });

        currentTrend = 'bearish';
        lastSwingLowVal = null;
        lastSwingLowIdx = null;
      }
    }
  }

  // Filter Order Blocks:
  // "price ካለፈ በኃላ አይወጣም" - strictly active unmitigated blocks where price hasn't violated/passed through!
  const unmitigatedBlocks = orderBlocks.filter((ob) => ob.endIndex === null);

  let filteredBlocks = unmitigatedBlocks;
  if (obMode === 'strong') {
    const strongOnly = unmitigatedBlocks.filter((ob) => ob.isStrong);
    filteredBlocks = strongOnly.length > 0 ? strongOnly : unmitigatedBlocks;
  }

  // Graceful fallback for high candle lookbacks: if all earlier historical blocks were penetrated over a long horizon,
  // ensure the most recent valid institutional Order Blocks remain visible rather than leaving the chart empty.
  if (filteredBlocks.length === 0 && orderBlocks.length > 0) {
    const candidateBlocks = obMode === 'strong' ? orderBlocks.filter((ob) => ob.isStrong) : orderBlocks;
    filteredBlocks = (candidateBlocks.length > 0 ? candidateBlocks : orderBlocks).slice(-Math.min(2, obLimit || 2));
  }

  // Sort newest first and limit to obLimit
  filteredBlocks.sort((a, b) => b.startIndex - a.startIndex);
  if (obLimit && obLimit > 0) {
    filteredBlocks = filteredBlocks.slice(0, obLimit);
  }

  return {
    bosChochLines,
    orderBlocks: filteredBlocks,
    swingHighs,
    swingLows,
  };
}

/**
 * Helper to aggregate candles into Higher Timeframe (HTF) bars for SMC
 */
export function aggregateCandlesForSMC(candles: Candle[], targetTf: string, currentTf: TimeframeId = '1M'): Candle[] {
  if (!candles || candles.length === 0) return [];
  if (!targetTf || targetTf === '' || targetTf.toLowerCase() === 'chart') return candles;

  const tfSecondsMap: Record<string, number> = {
    '1M': 60,
    '2M': 120,
    '5M': 300,
    '15M': 900,
    '30M': 1800,
    '1H': 3600,
    '4H': 14400,
    'D': 86400,
    '1D': 86400,
    'W': 604800,
    '1W': 604800,
    'M': 2592000,
    '1MO': 2592000,
    'MO': 2592000,
  };

  const targetSec = tfSecondsMap[targetTf.toUpperCase()] || 86400;
  const currentSec = tfSecondsMap[currentTf] || 60;

  if (targetSec <= currentSec) {
    return candles;
  }

  const aggregated: Candle[] = [];
  let currentGroup: Candle[] = [];
  let currentGroupStartTime = 0;

  for (const c of candles) {
    const bucketTime = Math.floor(c.time / targetSec) * targetSec;

    if (currentGroup.length === 0) {
      currentGroupStartTime = bucketTime;
      currentGroup.push(c);
    } else if (bucketTime === currentGroupStartTime) {
      currentGroup.push(c);
    } else {
      aggregated.push({
        time: currentGroupStartTime,
        open: currentGroup[0].open,
        high: Math.max(...currentGroup.map((x) => x.high)),
        low: Math.min(...currentGroup.map((x) => x.low)),
        close: currentGroup[currentGroup.length - 1].close,
      });
      currentGroup = [c];
      currentGroupStartTime = bucketTime;
    }
  }

  if (currentGroup.length > 0) {
    aggregated.push({
      time: currentGroupStartTime,
      open: currentGroup[0].open,
      high: Math.max(...currentGroup.map((x) => x.high)),
      low: Math.min(...currentGroup.map((x) => x.low)),
      close: currentGroup[currentGroup.length - 1].close,
    });
  }

  return aggregated;
}

/**
 * Multi-Instance SMC Calculation
 * Supports history candle limits (e.g. 720 candles) and Higher Timeframe aggregation (e.g. Weekly, Daily, 4H).
 */
export function calculateSmartMoneyConceptsForInstance(
  candles: Candle[],
  config: SMCInstanceConfig,
  currentTf: TimeframeId = '1M'
): SMCResult {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return { bosChochLines: [], orderBlocks: [], swingHighs: [], swingLows: [] };
  }

  // 1. History candles limit (e.g. 720 candles)
  let workingCandles = candles;
  let historyOffset = 0;
  if (config.historyCandlesLimit && config.historyCandlesLimit > 0 && config.historyCandlesLimit < candles.length) {
    workingCandles = candles.slice(-config.historyCandlesLimit);
    historyOffset = candles.length - workingCandles.length;
  }

  const isHTF = Boolean(config.timeframe && config.timeframe !== 'chart' && config.timeframe !== currentTf);

  if (isHTF) {
    const htfCandles = aggregateCandlesForSMC(workingCandles, config.timeframe!, currentTf);
    if (htfCandles.length >= 5) {
      const htfResult = calculateSmartMoneyConcepts(
        htfCandles,
        Math.max(2, Math.min(config.swingLookback || 5, Math.floor(htfCandles.length / 4))),
        config.obLimit || 5,
        config.obMode || 'strong'
      );

      // Binary search / find nearest candle index by timestamp
      const findCandleIndex = (timestamp: number): number => {
        let low = 0;
        let high = workingCandles.length - 1;
        let best = high;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (workingCandles[mid].time >= timestamp) {
            best = mid;
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
        return best + historyOffset;
      };

      const tag = config.tagBadge || (config.timeframe && config.timeframe !== 'chart' ? config.timeframe : '');

      const mappedOrderBlocks = htfResult.orderBlocks.map((ob, idx) => {
        const htfStart = htfCandles[ob.startIndex];
        const startIdx = htfStart ? findCandleIndex(htfStart.time) : 0;
        let endIdx: number | null = null;
        if (ob.endIndex !== null && htfCandles[ob.endIndex]) {
          endIdx = findCandleIndex(htfCandles[ob.endIndex].time);
        }
        return {
          ...ob,
          id: `${config.id}-ob-${idx}`,
          startIndex: startIdx,
          endIndex: endIdx,
          typeLabel: tag ? `${ob.typeLabel} [${tag}]` : ob.typeLabel,
        };
      });

      const mappedLines = htfResult.bosChochLines.map((line, idx) => {
        const htfStart = htfCandles[line.startIndex];
        const htfEnd = htfCandles[line.endIndex];
        const startIdx = htfStart ? findCandleIndex(htfStart.time) : 0;
        const endIdx = htfEnd ? findCandleIndex(htfEnd.time) : workingCandles.length - 1 + historyOffset;
        return {
          ...line,
          id: `${config.id}-line-${idx}`,
          startIndex: startIdx,
          endIndex: endIdx,
        };
      });

      return {
        bosChochLines: mappedLines,
        orderBlocks: mappedOrderBlocks,
        swingHighs: [],
        swingLows: [],
      };
    }
  }

  // Non-HTF calculation on workingCandles with historyOffset applied
  const rawResult = calculateSmartMoneyConcepts(
    workingCandles,
    config.swingLookback || 5,
    config.obLimit || 5,
    config.obMode || 'strong'
  );

  const tag = config.tagBadge || (config.historyCandlesLimit ? `${config.historyCandlesLimit}` : '');

  const adjustedLines = rawResult.bosChochLines.map((line) => ({
    ...line,
    id: `${config.id}-${line.id}`,
    startIndex: line.startIndex + historyOffset,
    endIndex: line.endIndex + historyOffset,
  }));

  const adjustedOBs = rawResult.orderBlocks.map((ob) => ({
    ...ob,
    id: `${config.id}-${ob.id}`,
    startIndex: ob.startIndex + historyOffset,
    endIndex: ob.endIndex !== null ? ob.endIndex + historyOffset : null,
    typeLabel: tag ? `${ob.typeLabel} [${tag}]` : ob.typeLabel,
  }));

  return {
    bosChochLines: adjustedLines,
    orderBlocks: adjustedOBs,
    swingHighs: rawResult.swingHighs,
    swingLows: rawResult.swingLows,
  };
}

export interface SOConfirmationSignal {
  type: 'buy' | 'sell' | 'strong_buy' | 'strong_sell';
  index: number;
}

export interface SOExitSignal {
  type: 'exit_buy' | 'exit_sell';
  index: number;
}

export interface SOResult {
  fastFilter: number[];
  slowFilter: number[];
  signals: SOConfirmationSignal[];
  exits: SOExitSignal[];
}

/**
 * LuxAlgo Signals & Overlays
 * Real-time high-fidelity trend tracker range filter and confirmation/contrarian signals.
 */
export function calculateSignalsAndOverlays(
  candles: Candle[],
  sensitivity = 12,
  mode: 'confirmation' | 'contrarian' = 'confirmation'
): SOResult {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return { fastFilter: [], slowFilter: [], signals: [], exits: [] };
  }
  const size = candles.length;
  const fastFilter: number[] = new Array(size).fill(0);
  const slowFilter: number[] = new Array(size).fill(0);
  const signals: SOConfirmationSignal[] = [];
  const exits: SOExitSignal[] = [];

  if (size === 0) {
    return { fastFilter, slowFilter, signals, exits };
  }

  const atr = calculateATR(candles, 14);

  // Multipliers based on sensitivity setting (standard is 12)
  const fastMultiplier = sensitivity / 8;
  const slowMultiplier = (sensitivity * 1.85) / 8;

  // Initialize filters
  let fastFilterVal = candles[0].close;
  let slowFilterVal = candles[0].close;
  fastFilter[0] = fastFilterVal;
  slowFilter[0] = slowFilterVal;

  // Calculate Fast Filter
  for (let i = 1; i < size; i++) {
    const c = candles[i];
    const rSize = (atr[i] || (c.high - c.low)) * fastMultiplier;
    if (c.close > fastFilterVal + rSize) {
      fastFilterVal = c.close - rSize;
    } else if (c.close < fastFilterVal - rSize) {
      fastFilterVal = c.close + rSize;
    }
    fastFilter[i] = fastFilterVal;
  }

  // Calculate Slow Filter
  for (let i = 1; i < size; i++) {
    const c = candles[i];
    const rSize = (atr[i] || (c.high - c.low)) * slowMultiplier;
    if (c.close > slowFilterVal + rSize) {
      slowFilterVal = c.close - rSize;
    } else if (c.close < slowFilterVal - rSize) {
      slowFilterVal = c.close + rSize;
    }
    slowFilter[i] = slowFilterVal;
  }

  // Fast Exit Tracker
  const exitFilter: number[] = new Array(size).fill(0);
  let exitFilterVal = candles[0].close;
  exitFilter[0] = exitFilterVal;
  const exitMultiplier = fastMultiplier * 0.45;
  for (let i = 1; i < size; i++) {
    const c = candles[i];
    const rSize = (atr[i] || (c.high - c.low)) * exitMultiplier;
    if (c.close > exitFilterVal + rSize) {
      exitFilterVal = c.close - rSize;
    } else if (c.close < exitFilterVal - rSize) {
      exitFilterVal = c.close + rSize;
    }
    exitFilter[i] = exitFilterVal;
  }

  // Signals State Machine
  let activePosition: 'long' | 'short' | 'none' = 'none';
  let hasExitForCurrentTrend = false;

  for (let i = 2; i < size; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];

    const fastUp = fastFilter[i] > fastFilter[i - 1];
    const fastDown = fastFilter[i] < fastFilter[i - 1];
    const prevFastUp = fastFilter[i - 1] > fastFilter[i - 2];
    const prevFastDown = fastFilter[i - 1] < fastFilter[i - 2];

    const slowUp = slowFilter[i] >= slowFilter[i - 1];
    const slowDown = slowFilter[i] <= slowFilter[i - 1];

    if (mode === 'confirmation') {
      // 1. Buy Signal: Fast filter turns up (or price crosses above it)
      if (fastUp && !prevFastUp) {
        const isStrong = slowUp;
        const type = isStrong ? 'strong_buy' : 'buy';
        signals.push({ type, index: i });
        activePosition = 'long';
        hasExitForCurrentTrend = false;
      }
      // 2. Sell Signal: Fast filter turns down
      else if (fastDown && !prevFastDown) {
        const isStrong = slowDown;
        const type = isStrong ? 'strong_sell' : 'sell';
        signals.push({ type, index: i });
        activePosition = 'short';
        hasExitForCurrentTrend = false;
      }
    } else {
      // Contrarian Mode: Reversal based on overextended bands
      const upperBand = slowFilter[i] + slowMultiplier * (atr[i] || (c.high - c.low)) * 0.85;
      const lowerBand = slowFilter[i] - slowMultiplier * (atr[i] || (c.high - c.low)) * 0.85;

      const crossedAboveUpper = prevC.high >= upperBand && c.close < prevC.close;
      const crossedBelowLower = prevC.low <= lowerBand && c.close > prevC.close;

      if (crossedBelowLower && activePosition !== 'long') {
        const isStrong = slowUp;
        signals.push({ type: isStrong ? 'strong_buy' : 'buy', index: i });
        activePosition = 'long';
        hasExitForCurrentTrend = false;
      } else if (crossedAboveUpper && activePosition !== 'short') {
        const isStrong = slowDown;
        signals.push({ type: isStrong ? 'strong_sell' : 'sell', index: i });
        activePosition = 'short';
        hasExitForCurrentTrend = false;
      }
    }

    // Exit Signals Generation
    if (activePosition === 'long' && !hasExitForCurrentTrend) {
      const exitFilterDown = exitFilter[i] < exitFilter[i - 1] && exitFilter[i - 1] >= exitFilter[i - 2];
      if (exitFilterDown || c.close < fastFilter[i]) {
        exits.push({ type: 'exit_buy', index: i });
        hasExitForCurrentTrend = true;
      }
    } else if (activePosition === 'short' && !hasExitForCurrentTrend) {
      const exitFilterUp = exitFilter[i] > exitFilter[i - 1] && exitFilter[i - 1] <= exitFilter[i - 2];
      if (exitFilterUp || c.close > fastFilter[i]) {
        exits.push({ type: 'exit_sell', index: i });
        hasExitForCurrentTrend = true;
      }
    }
  }

  return { fastFilter, slowFilter, signals, exits };
}

// ==========================================
// Confluence FVG Finder | ProjectSyndicate
// ==========================================

export interface FVGZone {
  top: number;
  bot: number;
  bullish: boolean;
  session: string;
  formTime: number; // Unix timestamp in seconds
  strength: number;
  confluenceCount: number;
  isMitigated: boolean;
  mitigatedAtTime: number | null;
  ageBars: number; // bars since formed in baseline candles
  pips: number;
  distancePips: number;
}

export interface FVGResult {
  bullZones: FVGZone[];
  bearZones: FVGZone[];
}

interface SingleFvg {
  top: number;
  bot: number;
  bullish: boolean;
  strength: number;
  session: string;
  time: number; // Unix timestamp in seconds
}

function getSession(timeSec: number): string {
  const date = new Date(timeSec * 1000);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const t = hour * 60 + minute;
  if (t >= 480 && t < 1020) return 'London';
  if (t >= 780 && t < 1320) return 'NY';
  if (t >= 0 && t < 540) return 'Asian';
  return 'Other';
}

function calculateFvgStrength(gapSize: number, atrValue: number, enableStrengthRating: boolean): number {
  if (!enableStrengthRating) return 5.0;
  if (atrValue <= 0) return 3.0;
  const gapRatio = gapSize / atrValue;
  if (gapRatio >= 1.5) return 8.0;
  if (gapRatio >= 1.0) return 6.0;
  if (gapRatio >= 0.75) return 4.5;
  if (gapRatio >= 0.5) return 3.0;
  return 1.5;
}

function normalizeZone(
  originalTop: number,
  originalBottom: number,
  atrVal: number,
  priceVal: number,
  useNormalized: boolean,
  method: 'ATR Based' | 'Fixed Percentage',
  atrMult: number,
  percent: number
): [number, number] {
  if (useNormalized) {
    const targetHeight = method === 'ATR Based' ? atrVal * atrMult : priceVal * (percent / 100.0);
    const originalMid = (originalTop + originalBottom) / 2.0;
    return [originalMid + targetHeight / 2.0, originalMid - targetHeight / 2.0];
  }
  return [originalTop, originalBottom];
}

export function aggregateCandles(candles: Candle[], targetTfId: TimeframeId, currentTfId: TimeframeId): Candle[] {
  const tfSeconds: Record<TimeframeId, number> = {
    '1M': 60,
    '2M': 120,
    '5M': 300,
    '15M': 900,
    '30M': 1800,
    '1H': 3600,
    '4H': 14400,
    '1D': 86400,
  };
  
  const targetSec = tfSeconds[targetTfId];
  const currentSec = tfSeconds[currentTfId];
  
  if (targetSec <= currentSec) {
    return candles;
  }
  
  const aggregated: Candle[] = [];
  let currentGroup: Candle[] = [];
  let currentGroupStartTime = 0;
  
  for (const c of candles) {
    const bucketTime = Math.floor(c.time / targetSec) * targetSec;
    
    if (currentGroup.length === 0) {
      currentGroupStartTime = bucketTime;
      currentGroup.push(c);
    } else if (bucketTime === currentGroupStartTime) {
      currentGroup.push(c);
    } else {
      const aggregatedCandle: Candle = {
        time: currentGroupStartTime,
        open: currentGroup[0].open,
        high: Math.max(...currentGroup.map(x => x.high)),
        low: Math.min(...currentGroup.map(x => x.low)),
        close: currentGroup[currentGroup.length - 1].close,
      };
      aggregated.push(aggregatedCandle);
      
      currentGroup = [c];
      currentGroupStartTime = bucketTime;
    }
  }
  
  if (currentGroup.length > 0) {
    const aggregatedCandle: Candle = {
      time: currentGroupStartTime,
      open: currentGroup[0].open,
      high: Math.max(...currentGroup.map(x => x.high)),
      low: Math.min(...currentGroup.map(x => x.low)),
      close: currentGroup[currentGroup.length - 1].close,
    };
    aggregated.push(aggregatedCandle);
  }
  
  return aggregated;
}

export function detectFvgForCandles(
  candles: Candle[],
  atrLength: number,
  useATRFilter: boolean,
  atrMultiplier: number,
  minGapSize: number,
  enableStrengthRating: boolean
): SingleFvg[] {
  const fvgs: SingleFvg[] = [];
  if (candles.length < 4) return fvgs;

  const atr = calculateATR(candles, atrLength);

  for (let i = 3; i < candles.length; i++) {
    const c1 = candles[i - 1];
    const c3 = candles[i - 3];
    
    const atrv = atr[i - 2] || (candles[i - 2].high - candles[i - 2].low);

    // 1. Bullish FVG
    if (c1.low > c3.high) {
      const gtop = c1.low;
      const gbot = c3.high;
      const gap = gtop - gbot;
      const minGap = useATRFilter ? atrv * atrMultiplier : minGapSize;
      if (gap >= minGap) {
        fvgs.push({
          top: gtop,
          bot: gbot,
          bullish: true,
          strength: calculateFvgStrength(gap, atrv, enableStrengthRating),
          session: getSession(c1.time),
          time: c1.time,
        });
      }
    }

    // 2. Bearish FVG
    if (c1.high < c3.low) {
      const gtop = c3.low;
      const gbot = c1.high;
      const gap = gtop - gbot;
      const minGap = useATRFilter ? atrv * atrMultiplier : minGapSize;
      if (gap >= minGap) {
        fvgs.push({
          top: gtop,
          bot: gbot,
          bullish: false,
          strength: calculateFvgStrength(gap, atrv, enableStrengthRating),
          session: getSession(c1.time),
          time: c1.time,
        });
      }
    }
  }

  return fvgs;
}

export function calculateConfluenceFVG(
  candles: Candle[],
  currentTfId: TimeframeId,
  settings: {
    fvgTf1: TimeframeId;
    fvgTf2: TimeframeId;
    fvgTf3: TimeframeId;
    fvgUseNormalizedZones: boolean;
    fvgZoneHeightMethod: 'ATR Based' | 'Fixed Percentage';
    fvgZoneHeightAtrMult: number;
    fvgZoneHeightPercent: number;
    fvgShowBullish: boolean;
    fvgShowBearish: boolean;
    fvgMaxZones: number;
    fvgMinConfluence: number;
    fvgProximityAtrMult: number;
    fvgEnableStrengthRating: boolean;
    fvgMinStrengthFilter: number;
    fvgConfluenceBonus: number;
    fvgMitigationType: 'Touch' | 'Full Fill' | '50% Fill';
    fvgShowMitigated: boolean;
    fvgMinGapSize: number;
    fvgUseATRFilter: boolean;
    fvgAtrMultiplier: number;
    fvgAtrLength: number;
    [key: string]: any;
  }
): FVGResult {
  if (!candles || !Array.isArray(candles) || candles.length < 5) {
    return { bullZones: [], bearZones: [] };
  }

  // 1. Calculate baseline ATR and values
  const baselineAtr = calculateATR(candles, settings.fvgAtrLength);
  const latestAtr = baselineAtr[baselineAtr.length - 1] || 0.1;
  const latestClose = candles[candles.length - 1].close;

  // 2. Aggregate candles for each timeframe
  const candlesTf1 = aggregateCandles(candles, settings.fvgTf1, currentTfId);
  const candlesTf2 = aggregateCandles(candles, settings.fvgTf2, currentTfId);
  const candlesTf3 = aggregateCandles(candles, settings.fvgTf3, currentTfId);

  // 3. Detect raw FVGs for each timeframe
  const rawTf1 = settings.fvgShowBullish || settings.fvgShowBearish ? detectFvgForCandles(candlesTf1, settings.fvgAtrLength, settings.fvgUseATRFilter, settings.fvgAtrMultiplier, settings.fvgMinGapSize, settings.fvgEnableStrengthRating) : [];
  const rawTf2 = settings.fvgShowBullish || settings.fvgShowBearish ? detectFvgForCandles(candlesTf2, settings.fvgAtrLength, settings.fvgUseATRFilter, settings.fvgAtrMultiplier, settings.fvgMinGapSize, settings.fvgEnableStrengthRating) : [];
  const rawTf3 = settings.fvgShowBullish || settings.fvgShowBearish ? detectFvgForCandles(candlesTf3, settings.fvgAtrLength, settings.fvgUseATRFilter, settings.fvgAtrMultiplier, settings.fvgMinGapSize, settings.fvgEnableStrengthRating) : [];

  // Group into direction lists
  const allRawBull = [
    ...rawTf1.filter(f => f.bullish).map(f => ({ fvg: f, tf: 1 })),
    ...rawTf2.filter(f => f.bullish).map(f => ({ fvg: f, tf: 2 })),
    ...rawTf3.filter(f => f.bullish).map(f => ({ fvg: f, tf: 3 })),
  ];

  const allRawBear = [
    ...rawTf1.filter(f => !f.bullish).map(f => ({ fvg: f, tf: 1 })),
    ...rawTf2.filter(f => !f.bullish).map(f => ({ fvg: f, tf: 2 })),
    ...rawTf3.filter(f => !f.bullish).map(f => ({ fvg: f, tf: 3 })),
  ];

  // Helper to resolve baseline ATR at a specific timestamp
  const getAtrAtTime = (timeSec: number): number => {
    let closestIndex = candles.length - 1;
    let minDiff = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const diff = Math.abs(candles[i].time - timeSec);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    return baselineAtr[closestIndex] || latestAtr;
  };

  const getCloseAtTime = (timeSec: number): number => {
    let closestIndex = candles.length - 1;
    let minDiff = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const diff = Math.abs(candles[i].time - timeSec);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    return candles[closestIndex].close;
  };

  // Helper to merge and filter zones
  const mergeZones = (rawList: { fvg: SingleFvg; tf: number }[], isBullish: boolean): FVGZone[] => {
    const merged: FVGZone[] = [];

    // Sort oldest to newest
    rawList.sort((a, b) => a.fvg.time - b.fvg.time);

    for (const item of rawList) {
      const rawFvg = item.fvg;
      const tfVal = item.tf;
      const localAtr = getAtrAtTime(rawFvg.time);
      const localPrice = getCloseAtTime(rawFvg.time);

      // Normalize FVG height using input parameters
      const [normTop, normBot] = normalizeZone(
        rawFvg.top,
        rawFvg.bot,
        localAtr,
        localPrice,
        settings.fvgUseNormalizedZones,
        settings.fvgZoneHeightMethod,
        settings.fvgZoneHeightAtrMult,
        settings.fvgZoneHeightPercent
      );

      // Look for an existing cluster that is confluent
      let clusterFound = false;
      const proximityTolerance = localAtr * settings.fvgProximityAtrMult;

      for (const m of merged) {
        const midM = (m.top + m.bot) / 2.0;
        const midItem = (normTop + normBot) / 2.0;

        if (Math.abs(midM - midItem) <= proximityTolerance) {
          // Merge!
          m.top = Math.max(m.top, normTop);
          m.bot = Math.min(m.bot, normBot);
          m.strength = Math.max(m.strength, rawFvg.strength);
          m.confluenceCount = m.confluenceCount + 1; // Increment for matching additional TF
          m.formTime = Math.min(m.formTime, rawFvg.time); // Kept earliest form time
          clusterFound = true;
          break;
        }
      }

      if (!clusterFound) {
        merged.push({
          top: normTop,
          bot: normBot,
          bullish: isBullish,
          session: rawFvg.session,
          formTime: rawFvg.time,
          strength: rawFvg.strength,
          confluenceCount: 1,
          isMitigated: false,
          mitigatedAtTime: null,
          ageBars: 0,
          pips: 0,
          distancePips: 0,
        });
      }
    }

    // Apply the min_confluence and strength rating filters, plus calculate mitigation
    const finalZones: FVGZone[] = [];

    for (const z of merged) {
      // Calculate final strength score including confluence bonus
      const bonus = Math.max(z.confluenceCount - 1, 0) * settings.fvgConfluenceBonus;
      z.strength = Math.min(z.strength + bonus, 10.0);

      if (z.confluenceCount < settings.fvgMinConfluence) continue;
      if (z.strength < settings.fvgMinStrengthFilter) continue;

      // Find mitigation details by iterating through subsequent baseline candles
      let mitigated = false;
      let mitTime: number | null = null;
      let firstSubsequentIdx = 0;

      // Find the first index in baseline candles after z.formTime
      for (let j = 0; j < candles.length; j++) {
        if (candles[j].time >= z.formTime) {
          firstSubsequentIdx = j + 1;
          break;
        }
      }

      const mid = (z.top + z.bot) / 2.0;

      for (let j = firstSubsequentIdx; j < candles.length; j++) {
        const c = candles[j];
        if (z.bullish) {
          const checkPrice = settings.fvgMitigationType === 'Touch' ? c.low : settings.fvgMitigationType === 'Full Fill' ? c.low : c.low; // touch = low <= top, full fill = low <= bot, 50% fill = low <= mid
          const limitPrice = settings.fvgMitigationType === 'Touch' ? z.top : settings.fvgMitigationType === 'Full Fill' ? z.bot : mid;
          if (c.low <= limitPrice) {
            mitigated = true;
            mitTime = c.time;
            break;
          }
        } else {
          const limitPrice = settings.fvgMitigationType === 'Touch' ? z.bot : settings.fvgMitigationType === 'Full Fill' ? z.top : mid;
          if (c.high >= limitPrice) {
            mitigated = true;
            mitTime = c.time;
            break;
          }
        }
      }

      z.isMitigated = mitigated;
      z.mitigatedAtTime = mitTime;

      // Calculate age in bars from baseline series
      let formedIdx = candles.length - 1;
      for (let j = 0; j < candles.length; j++) {
        if (candles[j].time >= z.formTime) {
          formedIdx = j;
          break;
        }
      }
      z.ageBars = Math.max(0, candles.length - 1 - formedIdx);

      // Pips calculations
      const isGold = true; // Let's use standard pip-scaling for our assets
      const pipSize = isGold ? 0.01 : 0.0001; // Scale appropriately
      z.pips = Math.round(Math.abs(z.top - z.bot) / pipSize);
      z.distancePips = Math.round(Math.abs(latestClose - mid) / pipSize);

      if (mitigated && !settings.fvgShowMitigated) {
        continue;
      }

      finalZones.push(z);
    }

    // Limit size to maxZones per side
    finalZones.sort((a, b) => b.formTime - a.formTime); // sorted newest first
    return finalZones.slice(0, settings.fvgMaxZones);
  };

  const bullZones = settings.fvgShowBullish ? mergeZones(allRawBull, true) : [];
  const bearZones = settings.fvgShowBearish ? mergeZones(allRawBear, false) : [];

  return { bullZones, bearZones };
}

// ==========================================
// ICT Concepts (LuxAlgo) | ProjectSyndicate
// ==========================================

export interface IctMarketStructure {
  id: string;
  type: 'MSS' | 'BOS';
  isBullish: boolean;
  price: number;
  time: number;       // time of swing point
  breakTime: number;  // time of break
}

export interface IctOrderBlock {
  id: string;
  isBullish: boolean;
  top: number;
  bottom: number;
  time: number;
  endTime: number | null; // mitigated time
  isStrong?: boolean;
  typeLabel?: string;
}

export interface IctLiquidityZone {
  id: string;
  isBuyside: boolean; // true = Buyside, false = Sellside
  price: number;
  time: number;
  endTime: number | null; // swept time
  isStrong?: boolean;
  typeLabel?: string;
  touches?: number;
}

export interface IctVolumeImbalance {
  id: string;
  isBullish: boolean;
  top: number;
  bottom: number;
  time: number;
  endTime: number | null; // filled/mitigated time
}

export interface IctFvgZone {
  id: string;
  isBullish: boolean;
  isInverted: boolean;
  isBpr: boolean; // Balanced Price Range
  top: number;
  bottom: number;
  time: number;
  endTime: number | null; // mitigated time
}

export interface IctConceptsResult {
  marketStructures: IctMarketStructure[];
  orderBlocks: IctOrderBlock[];
  liquidityZones: IctLiquidityZone[];
  volumeImbalances: IctVolumeImbalance[];
  fvgs: IctFvgZone[];
  displacements: number[]; // timestamps of displacement candles
}

export function calculateIctConcepts(
  candles: Candle[],
  settings: {
    ictMode: 'Present' | 'Historical';
    ictShowMarketStructure: boolean;
    ictMsLength: number;
    ictShowMSS: boolean;
    ictShowBOS: boolean;
    ictShowDisplacement: boolean;
    ictShowVolumeImbalance: boolean;
    ictViMaxBoxes: number;
    ictShowOrderBlocks: boolean;
    ictObLookback: number;
    ictObMaxCount: number;
    ictShowLiquidity: boolean;
    ictLiqSensitivity: number;
    ictLiqMaxBoxes: number;
    ictFvgOption: 'FVG' | 'IFVG' | 'NONE';
    ictFvgShowBullish?: boolean;
    ictFvgShowBearish?: boolean;
    ictFvgMaxCount: number;
    ictFvgBalancePriceRange: boolean;
    [key: string]: any;
  }
): IctConceptsResult {
  const result: IctConceptsResult = {
    marketStructures: [],
    orderBlocks: [],
    liquidityZones: [],
    volumeImbalances: [],
    fvgs: [],
    displacements: [],
  };

  if (!candles || !Array.isArray(candles) || candles.length < 10) return result;

  // Handle Present mode (last 500 bars)
  let workingCandles = candles;
  let offsetIndex = 0;
  if (settings.ictMode === 'Present') {
    const presentLimit = 500;
    if (candles.length > presentLimit) {
      offsetIndex = candles.length - presentLimit;
      workingCandles = candles.slice(offsetIndex);
    }
  }

  const n = workingCandles.length;
  const atr = calculateATR(workingCandles, 14);

  // 1. Calculate Swing Highs / Swing Lows for Market Structure
  const msLength = settings.ictMsLength;
  const isSwingHigh = (idx: number): boolean => {
    if (idx < msLength || idx >= n - msLength) return false;
    const h = workingCandles[idx].high;
    for (let j = idx - msLength; j <= idx + msLength; j++) {
      if (j !== idx && workingCandles[j].high >= h) return false;
    }
    return true;
  };

  const isSwingLow = (idx: number): boolean => {
    if (idx < msLength || idx >= n - msLength) return false;
    const l = workingCandles[idx].low;
    for (let j = idx - msLength; j <= idx + msLength; j++) {
      if (j !== idx && workingCandles[j].low <= l) return false;
    }
    return true;
  };

  // 2. Track Market Structure (MSS & BOS)
  // Let's sweep left-to-right to find structure breaks.
  let lastStructureDirection: 'bullish' | 'bearish' | null = null;
  const activeSwingHighs: { price: number; time: number; idx: number }[] = [];
  const activeSwingLows: { price: number; time: number; idx: number }[] = [];

  for (let i = 0; i < n; i++) {
    const c = workingCandles[i];

    // Check if current candle is a swing point
    if (isSwingHigh(i)) {
      activeSwingHighs.push({ price: c.high, time: c.time, idx: i });
    }
    if (isSwingLow(i)) {
      activeSwingLows.push({ price: c.low, time: c.time, idx: i });
    }

    // Check for breaks of active swing highs
    if (settings.ictShowMarketStructure) {
      for (let sIdx = activeSwingHighs.length - 1; sIdx >= 0; sIdx--) {
        const sh = activeSwingHighs[sIdx];
        if (i > sh.idx && c.close > sh.price) {
          // Bullish Break!
          const type = (lastStructureDirection === 'bearish' || lastStructureDirection === null) ? 'MSS' : 'BOS';
          const shouldAdd = type === 'MSS' ? settings.ictShowMSS : settings.ictShowBOS;
          
          if (shouldAdd) {
            result.marketStructures.push({
              id: `ms-bull-${sh.time}-${i}`,
              type,
              isBullish: true,
              price: sh.price,
              time: sh.time,
              breakTime: c.time,
            });

            // 3. Create Order Block (+OB) upon break of structure
            if (settings.ictShowOrderBlocks) {
              // Find the lowest down-close candle within the consolidation block preceding the swing point
              let obTop = 0;
              let obBot = 0;
              let obTime = 0;
              let foundOb = false;

              // Scan back starting from swing high index (sh.idx)
              const lookbackLimit = Math.max(0, sh.idx - settings.ictObLookback);
              let lowestPrice = Infinity;
              for (let k = sh.idx; k >= lookbackLimit; k--) {
                const candleK = workingCandles[k];
                if (candleK.close < candleK.open) { // Down-close
                  if (candleK.low < lowestPrice) {
                    lowestPrice = candleK.low;
                    obTop = Math.max(candleK.open, candleK.close);
                    obBot = Math.min(candleK.open, candleK.close);
                    obTime = candleK.time;
                    foundOb = true;
                  }
                }
              }

              if (foundOb) {
                const isObStrong = type === 'MSS' || (i - sh.idx <= 6);
                result.orderBlocks.push({
                  id: `ob-bull-${obTime}`,
                  isBullish: true,
                  top: obTop,
                  bottom: obBot,
                  time: obTime,
                  endTime: null,
                  isStrong: isObStrong,
                  typeLabel: isObStrong ? '+OB (Strong)' : '+OB',
                });
              }
            }
          }

          lastStructureDirection = 'bullish';
          // Remove from active list as it is broken
          activeSwingHighs.splice(sIdx, 1);
        }
      }

      // Check for breaks of active swing lows
      for (let sIdx = activeSwingLows.length - 1; sIdx >= 0; sIdx--) {
        const sl = activeSwingLows[sIdx];
        if (i > sl.idx && c.close < sl.price) {
          // Bearish Break!
          const type = (lastStructureDirection === 'bullish' || lastStructureDirection === null) ? 'MSS' : 'BOS';
          const shouldAdd = type === 'MSS' ? settings.ictShowMSS : settings.ictShowBOS;

          if (shouldAdd) {
            result.marketStructures.push({
              id: `ms-bear-${sl.time}-${i}`,
              type,
              isBullish: false,
              price: sl.price,
              time: sl.time,
              breakTime: c.time,
            });

            // Create Order Block (-OB) upon break of structure
            if (settings.ictShowOrderBlocks) {
              // Find highest up-close candle preceding swing low sl.idx
              let obTop = 0;
              let obBot = 0;
              let obTime = 0;
              let foundOb = false;

              const lookbackLimit = Math.max(0, sl.idx - settings.ictObLookback);
              let highestPrice = -Infinity;
              for (let k = sl.idx; k >= lookbackLimit; k--) {
                const candleK = workingCandles[k];
                if (candleK.close > candleK.open) { // Up-close
                  if (candleK.high > highestPrice) {
                    highestPrice = candleK.high;
                    obTop = Math.max(candleK.open, candleK.close);
                    obBot = Math.min(candleK.open, candleK.close);
                    obTime = candleK.time;
                    foundOb = true;
                  }
                }
              }

              if (foundOb) {
                const isObStrong = type === 'MSS' || (i - sl.idx <= 6);
                result.orderBlocks.push({
                  id: `ob-bear-${obTime}`,
                  isBullish: false,
                  top: obTop,
                  bottom: obBot,
                  time: obTime,
                  endTime: null,
                  isStrong: isObStrong,
                  typeLabel: isObStrong ? '-OB (Strong)' : '-OB',
                });
              }
            }
          }

          lastStructureDirection = 'bearish';
          // Remove from active list
          activeSwingLows.splice(sIdx, 1);
        }
      }
    }
  }

  // Filter Order Blocks if Strong mode is set
  const obFilterMode = settings.ictObMode ?? 'strong';
  if (obFilterMode === 'strong') {
    result.orderBlocks = result.orderBlocks.filter((ob) => ob.isStrong);
  }

  // Calculate Mitigations of active Order Blocks
  result.orderBlocks.forEach(ob => {
    // Find index of the OB candle to begin scanning mitigation from there to the end
    let obIdx = workingCandles.findIndex(x => x.time === ob.time);
    if (obIdx === -1) return;

    for (let k = obIdx + 1; k < n; k++) {
      const c = workingCandles[k];
      if (ob.isBullish) {
        // Bullish OB mitigation: price breaches the bottom of the order block
        if (c.low < ob.bottom) {
          ob.endTime = c.time;
          break;
        }
      } else {
        // Bearish OB mitigation: price breaches the top of the order block
        if (c.high > ob.top) {
          ob.endTime = c.time;
          break;
        }
      }
    }
  });

  // Sort and cap Order Blocks count
  result.orderBlocks = result.orderBlocks
    .sort((a, b) => b.time - a.time)
    .slice(0, settings.ictObMaxCount);

  // 4. Calculate Displacement Candles
  if (settings.ictShowDisplacement) {
    let bodySum = 0;
    for (let i = 0; i < n; i++) {
      bodySum += Math.abs(workingCandles[i].close - workingCandles[i].open);
    }
    const avgBody = bodySum / (n || 1);

    for (let i = 1; i < n; i++) {
      const c = workingCandles[i];
      const body = Math.abs(c.close - c.open);
      const atrv = atr[i] || avgBody;
      // High body relative to recent range and ATR
      if (body > 1.8 * avgBody && body > 1.2 * atrv) {
        result.displacements.push(c.time);
      }
    }
  }

  // 5. Calculate Volume Imbalances (VI)
  if (settings.ictShowVolumeImbalance) {
    for (let i = 1; i < n; i++) {
      const c1 = workingCandles[i - 1];
      const c = workingCandles[i];

      const c1MaxBody = Math.max(c1.open, c1.close);
      const c1MinBody = Math.min(c1.open, c1.close);
      const cMaxBody = Math.max(c.open, c.close);
      const cMinBody = Math.min(c.open, c.close);

      // Bullish VI: gap between c1 close/body top and c open/body bottom
      if (cMinBody > c1MaxBody && c.open > c1.close) {
        result.volumeImbalances.push({
          id: `vi-bull-${c.time}`,
          isBullish: true,
          top: cMinBody,
          bottom: c1MaxBody,
          time: c.time,
          endTime: null,
        });
      }
      // Bearish VI: gap between c1 body bottom and c body top
      else if (cMaxBody < c1MinBody && c.open < c1.close) {
        result.volumeImbalances.push({
          id: `vi-bear-${c.time}`,
          isBullish: false,
          top: c1MinBody,
          bottom: cMaxBody,
          time: c.time,
          endTime: null,
        });
      }
    }

    // Process mitigations of Volume Imbalances
    result.volumeImbalances.forEach(vi => {
      const viIdx = workingCandles.findIndex(x => x.time === vi.time);
      if (viIdx === -1) return;

      for (let k = viIdx + 1; k < n; k++) {
        const c = workingCandles[k];
        if (vi.isBullish) {
          // If subsequent price fills or crosses below the bottom of the gap
          if (c.low <= vi.bottom) {
            vi.endTime = c.time;
            break;
          }
        } else {
          // If subsequent price fills or crosses above the top of the gap
          if (c.high >= vi.top) {
            vi.endTime = c.time;
            break;
          }
        }
      }
    });

    // Cap volume imbalances
    result.volumeImbalances = result.volumeImbalances
      .sort((a, b) => b.time - a.time)
      .slice(0, settings.ictViMaxBoxes);
  }

  // 6. Calculate Buyside / Sellside Liquidity (BSL & SSL)
  if (settings.ictShowLiquidity) {
    // We use swing points with lookback based on sensitivity
    const liqLookback = Math.max(5, Math.round(settings.ictLiqSensitivity * 5));
    const majorLookback = Math.round(liqLookback * 2.2);
    const liqFilterMode = settings.ictLiqMode ?? 'strong';

    const isLiqHigh = (idx: number, lb: number): boolean => {
      if (idx < lb || idx >= n - lb) return false;
      const h = workingCandles[idx].high;
      for (let j = idx - lb; j <= idx + lb; j++) {
        if (j !== idx && workingCandles[j].high >= h) return false;
      }
      return true;
    };

    const isLiqLow = (idx: number, lb: number): boolean => {
      if (idx < lb || idx >= n - lb) return false;
      const l = workingCandles[idx].low;
      for (let j = idx - lb; j <= idx + lb; j++) {
        if (j !== idx && workingCandles[j].low <= l) return false;
      }
      return true;
    };

    const rawHighs: { idx: number; price: number; time: number; isMajor: boolean }[] = [];
    const rawLows: { idx: number; price: number; time: number; isMajor: boolean }[] = [];

    for (let i = 0; i < n; i++) {
      if (isLiqHigh(i, liqLookback)) {
        rawHighs.push({
          idx: i,
          price: workingCandles[i].high,
          time: workingCandles[i].time,
          isMajor: isLiqHigh(i, majorLookback),
        });
      }
      if (isLiqLow(i, liqLookback)) {
        rawLows.push({
          idx: i,
          price: workingCandles[i].low,
          time: workingCandles[i].time,
          isMajor: isLiqLow(i, majorLookback),
        });
      }
    }

    // Identify Equal Highs (EQH) and Equal Lows (EQL)
    rawHighs.forEach((h1) => {
      const atrVal = atr[h1.idx] || h1.price * 0.001;
      const eqThreshold = Math.max(h1.price * 0.0012, atrVal * 0.35);

      let eqMatches = 0;
      rawHighs.forEach((h2) => {
        if (h1.idx !== h2.idx && Math.abs(h1.price - h2.price) <= eqThreshold) {
          eqMatches++;
        }
      });

      const isEqh = eqMatches >= 1;
      const isStrong = h1.isMajor || isEqh;
      let label = 'BSL';
      if (isEqh) label = 'EQH BSL';
      else if (h1.isMajor) label = 'Major BSL';

      result.liquidityZones.push({
        id: `liq-bsl-${h1.time}`,
        isBuyside: true,
        price: h1.price,
        time: h1.time,
        endTime: null,
        isStrong,
        typeLabel: label,
        touches: eqMatches + 1,
      });
    });

    rawLows.forEach((l1) => {
      const atrVal = atr[l1.idx] || l1.price * 0.001;
      const eqThreshold = Math.max(l1.price * 0.0012, atrVal * 0.35);

      let eqMatches = 0;
      rawLows.forEach((l2) => {
        if (l1.idx !== l2.idx && Math.abs(l1.price - l2.price) <= eqThreshold) {
          eqMatches++;
        }
      });

      const isEql = eqMatches >= 1;
      const isStrong = l1.isMajor || isEql;
      let label = 'SSL';
      if (isEql) label = 'EQL SSL';
      else if (l1.isMajor) label = 'Major SSL';

      result.liquidityZones.push({
        id: `liq-ssl-${l1.time}`,
        isBuyside: false,
        price: l1.price,
        time: l1.time,
        endTime: null,
        isStrong,
        typeLabel: label,
        touches: eqMatches + 1,
      });
    });

    // Filter by Strong mode if enabled
    if (liqFilterMode === 'strong') {
      result.liquidityZones = result.liquidityZones.filter((lz) => lz.isStrong);
    }

    // Determine sweep times (mitigation)
    result.liquidityZones.forEach(lz => {
      const lzIdx = workingCandles.findIndex(x => x.time === lz.time);
      if (lzIdx === -1) return;

      for (let k = lzIdx + 1; k < n; k++) {
        const c = workingCandles[k];
        if (lz.isBuyside) {
          if (c.high > lz.price) {
            lz.endTime = c.time;
            break;
          }
        } else {
          if (c.low < lz.price) {
            lz.endTime = c.time;
            break;
          }
        }
      }
    });

    // Cap liquidity zones count
    result.liquidityZones = result.liquidityZones
      .sort((a, b) => b.time - a.time)
      .slice(0, settings.ictLiqMaxBoxes);
  }

  // 7. Calculate Fair Value Gaps (FVG), Inverted FVGs (IFVGs) & Balance Price Ranges (BPR)
  if (settings.ictFvgOption !== 'NONE') {
    const rawFvgs: IctFvgZone[] = [];

    for (let i = 3; i < n; i++) {
      const c1 = workingCandles[i - 1];
      const c3 = workingCandles[i - 3];

      // Bullish FVG
      if (c1.low > c3.high && settings.ictFvgShowBullish !== false) {
        rawFvgs.push({
          id: `fvg-bull-${workingCandles[i - 1].time}`,
          isBullish: true,
          isInverted: false,
          isBpr: false,
          top: c1.low,
          bottom: c3.high,
          time: c1.time,
          endTime: null,
        });
      }

      // Bearish FVG
      if (c1.high < c3.low && settings.ictFvgShowBearish !== false) {
        rawFvgs.push({
          id: `fvg-bear-${workingCandles[i - 1].time}`,
          isBullish: false,
          isInverted: false,
          isBpr: false,
          top: c3.low,
          bottom: c1.high,
          time: c1.time,
          endTime: null,
        });
      }
    }

    // Check mitigation & Inversion
    rawFvgs.forEach(f => {
      const fIdx = workingCandles.findIndex(x => x.time === f.time);
      if (fIdx === -1) return;

      for (let k = fIdx + 1; k < n; k++) {
        const c = workingCandles[k];
        if (f.isBullish) {
          // Standard mitigation: price drops below FVG top (or 50% fill/bottom)
          // For LuxAlgo ICT, standard FVG mitigation is typically Touch/Fill of the opposite side (bottom)
          // If we support IFVG option: when a Bullish FVG is CLOSED below its bottom, it becomes an Inverted FVG!
          if (c.close < f.bottom) {
            if (settings.ictFvgOption === 'IFVG') {
              f.isInverted = true;
              f.isBullish = false; // turns bearish inverted FVG
              // Check if inverted FVG gets mitigated by crossing above the original top
              let invMitigated = false;
              for (let m = k + 1; m < n; m++) {
                if (workingCandles[m].close > f.top) {
                  f.endTime = workingCandles[m].time;
                  invMitigated = true;
                  break;
                }
              }
              if (!invMitigated) {
                f.endTime = null; // stays active as IFVG
              }
            } else {
              f.endTime = c.time;
            }
            break;
          }
        } else {
          // Bearish FVG: price closes above its top
          if (c.close > f.top) {
            if (settings.ictFvgOption === 'IFVG') {
              f.isInverted = true;
              f.isBullish = true; // turns bullish inverted FVG
              let invMitigated = false;
              for (let m = k + 1; m < n; m++) {
                if (workingCandles[m].close < f.bottom) {
                  f.endTime = workingCandles[m].time;
                  invMitigated = true;
                  break;
                }
              }
              if (!invMitigated) {
                f.endTime = null; // stays active as IFVG
              }
            } else {
              f.endTime = c.time;
            }
            break;
          }
        }
      }
    });

    // Detect Balance Price Range (BPR)
    // Overlapping of bullish and bearish FVGs
    if (settings.ictFvgBalancePriceRange) {
      const bprs: IctFvgZone[] = [];
      const bulls = rawFvgs.filter(f => f.isBullish && !f.isInverted);
      const bears = rawFvgs.filter(f => !f.isBullish && !f.isInverted);

      bulls.forEach(b => {
        bears.forEach(br => {
          // Check overlapping of [b.bottom, b.top] and [br.bottom, br.top]
          const overlapMin = Math.max(b.bottom, br.bottom);
          const overlapMax = Math.min(b.top, br.top);

          if (overlapMin < overlapMax && Math.abs(b.time - br.time) < 18000) { // overlap exists and formed relatively near each other
            bprs.push({
              id: `bpr-${b.time}-${br.time}`,
              isBullish: b.time > br.time ? b.isBullish : br.isBullish,
              isInverted: false,
              isBpr: true,
              top: overlapMax,
              bottom: overlapMin,
              time: Math.max(b.time, br.time),
              endTime: b.endTime || br.endTime,
            });
          }
        });
      });

      // Filter out overlapping FVGs from main list if we are highlighting BPRs, or keep them
      result.fvgs.push(...bprs);
    }

    result.fvgs.push(...rawFvgs);

    // Filter and cap
    result.fvgs = result.fvgs
      .sort((a, b) => b.time - a.time)
      .slice(0, settings.ictFvgMaxCount);
  }

  return result;
}

export interface MStatZone {
  id: string;
  top: number;
  bottom: number;
  height: number;
  isSupply: boolean;
  startTime: number;
  endTime: number | null;
  greenLengthRatio: number;
  redLengthRatio: number;
}

export interface MStatResult {
  zones: MStatZone[];
}

/**
 * Zeiierman - Market Structure & Price Action Toolkit
 * (Focused exclusively on Zeiierman Real-Time Fractal Order Block & Support/Resistance Grid Zones)
 */
export function calculateMarketStructureToolkit(
  candles: Candle[],
  settings: {
    mstatPivotLength?: number;
    mstatMaxZones?: number;
  }
): MStatResult {
  const result: MStatResult = {
    zones: [],
  };

  if (!candles || !Array.isArray(candles) || candles.length < 10) return result;

  const n = candles.length;

  const swingLen = settings.mstatPivotLength ?? 8;
  const swingPivots = calculatePivots(candles, swingLen);

  for (let i = swingLen; i < n - swingLen; i++) {
    // Check Swing High -> Form Zeiierman Supply / Resistance / Bearish OB Zone
    if (swingPivots.pivotHighs[i] !== null) {
      const ph = swingPivots.pivotHighs[i]!;

      // Find lowest low / open boundary in pivot window to establish zone height
      let minVal = ph;
      const startIdx = Math.max(0, i - swingLen);
      const endIdx = Math.min(n - 1, i + swingLen);
      for (let k = startIdx; k <= endIdx; k++) {
        const bodyLow = Math.min(candles[k].open, candles[k].close);
        if (bodyLow < minVal && bodyLow > ph * 0.95) {
          minVal = bodyLow;
        }
      }

      const top = ph;
      const rawDiff = Math.abs(top - minVal);
      const bottom = rawDiff > 0 ? minVal : ph * 0.988;
      const height = Math.round(Math.abs(top - bottom));

      result.zones.push({
        id: `z-sup-${candles[i].time}`,
        top,
        bottom,
        height: height > 0 ? height : 100,
        isSupply: true,
        startTime: candles[i].time,
        endTime: null,
        greenLengthRatio: 0.6,
        redLengthRatio: 0.4,
      });
    }

    // Check Swing Low -> Form Zeiierman Demand / Support / Bullish OB Zone
    if (swingPivots.pivotLows[i] !== null) {
      const pl = swingPivots.pivotLows[i]!;

      // Find highest high / open boundary in pivot window
      let maxVal = pl;
      const startIdx = Math.max(0, i - swingLen);
      const endIdx = Math.min(n - 1, i + swingLen);
      for (let k = startIdx; k <= endIdx; k++) {
        const bodyHigh = Math.max(candles[k].open, candles[k].close);
        if (bodyHigh > maxVal && bodyHigh < pl * 1.05) {
          maxVal = bodyHigh;
        }
      }

      const bottom = pl;
      const rawDiff = Math.abs(maxVal - bottom);
      const top = rawDiff > 0 ? maxVal : pl * 1.012;
      const height = Math.round(Math.abs(top - bottom));

      result.zones.push({
        id: `z-dem-${candles[i].time}`,
        top,
        bottom,
        height: height > 0 ? height : 100,
        isSupply: false,
        startTime: candles[i].time,
        endTime: null,
        greenLengthRatio: 0.5,
        redLengthRatio: 0.5,
      });
    }
  }

  // Determine mitigation (if broken through)
  result.zones.forEach((z) => {
    const zIdx = candles.findIndex((x) => x.time === z.startTime);
    if (zIdx === -1) return;
    for (let k = zIdx + 1; k < n; k++) {
      const c = candles[k];
      if (z.isSupply) {
        if (c.close > z.top) {
          z.endTime = c.time;
          break;
        }
      } else {
        if (c.close < z.bottom) {
          z.endTime = c.time;
          break;
        }
      }
    }
  });

  // Keep active zones & recent unmitigated ones, capped by mstatMaxZones
  const maxZ = settings.mstatMaxZones ?? 6;
  result.zones = result.zones
    .filter((z) => z.endTime === null || candles.findIndex((x) => x.time === z.endTime) > n - 40)
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, maxZ);

  return result;
}

// ============================================================================
// Pure Price Action Liquidity Sweeps [LuxAlgo]
// ============================================================================

export interface PureLiquiditySweepItem {
  id: string;
  isBullish: boolean; // true = bullish sweep (swept low level), false = bearish sweep (swept high level)
  level: number;       // get.prc
  pivotIndex: number;  // get.bix
  sweepIndex: number;  // n (bar_index of sweep)
  boxHigh: number;     // for bearish sweep: candle.high; for bullish sweep: level
  boxLow: number;      // for bearish sweep: level; for bullish sweep: candle.low
  isMitigated: boolean;
}

export interface PureLiquidityActiveLevelItem {
  id: string;
  isBullish: boolean;
  level: number;
  pivotIndex: number;
}

export interface PureLiquiditySweepsResult {
  sweeps: PureLiquiditySweepItem[];
  activeLevels: PureLiquidityActiveLevelItem[];
}

export function calculatePureLiquiditySweeps(
  candles: Candle[],
  options?: {
    detectionMode?: 'Short Term' | 'Intermediate Term' | 'Long Term';
  }
): PureLiquiditySweepsResult {
  if (!candles || candles.length < 5) {
    return { sweeps: [], activeLevels: [] };
  }

  const mode = options?.detectionMode ?? 'Long Term';
  const depth = mode === 'Short Term' ? 1 : mode === 'Intermediate Term' ? 2 : 3;

  interface Swing {
    y: number;
    x: number;
  }

  type Vector = Swing[];

  const fh: Vector[] = [];
  const fl: Vector[] = [];
  for (let d = 0; d < depth; d++) {
    fh.push([]);
    fl.push([]);
  }

  function detect(id: Vector[], swingMode: 'bull' | 'bear', depthVal: number): Swing {
    let swingLevel: Swing = { y: NaN, x: NaN };
    for (let i = 0; i < depthVal; i++) {
      const get_v = id[i];
      if (get_v.length === 3) {
        const pivot = swingMode === 'bull'
          ? Math.max(get_v[0].y, get_v[1].y, get_v[2].y)
          : Math.min(get_v[0].y, get_v[1].y, get_v[2].y);

        if (pivot === get_v[1].y) {
          if (i < depthVal - 1) {
            id[i + 1].unshift(get_v[1]);
            if (id[i + 1].length > 3) {
              id[i + 1].pop();
            }
          } else {
            swingLevel = { y: get_v[1].y, x: get_v[1].x };
          }
          get_v.pop();
          get_v.pop();
        }
      }
    }
    return swingLevel;
  }

  interface Piv {
    prc: number;
    bix: number;
    mit: boolean;
    wic: boolean;
    sweepIndex?: number;
    sweepBoxHigh?: number;
    sweepBoxLow?: number;
  }

  const aPivH: Piv[] = [];
  const aPivL: Piv[] = [];

  const completedSweeps: PureLiquiditySweepItem[] = [];

  let lastPh = NaN;
  let lastPl = NaN;

  for (let n = 0; n < candles.length; n++) {
    const candle = candles[n];

    fh[0].unshift({ y: candle.high, x: n });
    fl[0].unshift({ y: candle.low, x: n });

    if (fh[0].length > 3) fh[0].pop();
    if (fl[0].length > 3) fl[0].pop();

    const top = detect(fh, 'bull', depth);
    const btm = detect(fl, 'bear', depth);

    const ph = top.y;
    const pl = btm.y;

    if (!isNaN(ph) && ph > 0 && ph !== lastPh) {
      aPivH.unshift({ prc: ph, bix: top.x, mit: false, wic: false });
      lastPh = ph;
    }

    if (!isNaN(pl) && pl > 0 && pl !== lastPl) {
      aPivL.unshift({ prc: pl, bix: btm.x, mit: false, wic: false });
      lastPl = pl;
    }

    // Process Pivot Highs (Bearish sweeps)
    for (let i = aPivH.length - 1; i >= 0; i--) {
      const get = aPivH[i];
      if (!get.mit) {
        if (candle.close > get.prc) {
          get.mit = true;
        } else if (!get.wic) {
          if (candle.high > get.prc && candle.close < get.prc) {
            get.wic = true;
            get.sweepIndex = n;
            get.sweepBoxHigh = candle.high;
            get.sweepBoxLow = get.prc;

            completedSweeps.push({
              id: `bear_sw_${get.bix}_${n}`,
              isBullish: false,
              level: get.prc,
              pivotIndex: get.bix,
              sweepIndex: n,
              boxHigh: candle.high,
              boxLow: get.prc,
              isMitigated: false,
            });
          }
        }
      }

      if (n - get.bix > 2000 || get.mit) {
        if (get.wic && get.mit) {
          const found = completedSweeps.find((s) => s.pivotIndex === get.bix && !s.isBullish);
          if (found) found.isMitigated = true;
        }
        aPivH.splice(i, 1);
      }
    }

    // Process Pivot Lows (Bullish sweeps)
    for (let i = aPivL.length - 1; i >= 0; i--) {
      const get = aPivL[i];
      if (!get.mit) {
        if (candle.close < get.prc) {
          get.mit = true;
        } else if (!get.wic) {
          if (candle.low < get.prc && candle.close > get.prc) {
            get.wic = true;
            get.sweepIndex = n;
            get.sweepBoxHigh = get.prc;
            get.sweepBoxLow = candle.low;

            completedSweeps.push({
              id: `bull_sw_${get.bix}_${n}`,
              isBullish: true,
              level: get.prc,
              pivotIndex: get.bix,
              sweepIndex: n,
              boxHigh: get.prc,
              boxLow: candle.low,
              isMitigated: false,
            });
          }
        }
      }

      if (n - get.bix > 2000 || get.mit) {
        if (get.wic && get.mit) {
          const found = completedSweeps.find((s) => s.pivotIndex === get.bix && s.isBullish);
          if (found) found.isMitigated = true;
        }
        aPivL.splice(i, 1);
      }
    }
  }

  // Collect active unswept & unmitigated level lines
  const activeLevels: PureLiquidityActiveLevelItem[] = [];
  for (const p of aPivH) {
    if (!p.mit && !p.wic) {
      activeLevels.push({
        id: `act_h_${p.bix}`,
        isBullish: false,
        level: p.prc,
        pivotIndex: p.bix,
      });
    }
  }
  for (const p of aPivL) {
    if (!p.mit && !p.wic) {
      activeLevels.push({
        id: `act_l_${p.bix}`,
        isBullish: true,
        level: p.prc,
        pivotIndex: p.bix,
      });
    }
  }

  return { sweeps: completedSweeps, activeLevels };
}


