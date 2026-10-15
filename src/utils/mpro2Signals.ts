/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Mpro2 Signal - Advanced Reversal & Macro Key Level Suite
 * Exact mathematical port from PineScript v6 (© AxeAlgo)
 */

import { Candle } from '../types';
import { WeeklyAnchorState, computeWeeklyAnchor } from './weeklyAnchorEngine';

export interface Mpro2FibLevel {
  ratio: number;
  price: number;
  isBaseLine: boolean;
  isShown: boolean;
  confluent: boolean;
  touchCount: number;
  color: string;
  style: 'Solid' | 'Dotted' | 'Dashed';
  width: number;
  labelText: string;
}

export interface Mpro2SignalArrow {
  index: number;
  time: number;
  type: 'BUY' | 'SELL';
  subType?: 'REVERSAL_BUY' | 'REVERSAL_SELL' | 'RETEST_CONTINUATION_BUY' | 'RETEST_CONTINUATION_SELL';
  price: number;
  levelPrice: number;
  levelRatio: number;
  message: string;
}

export interface Mpro2TimeZone {
  barIndex: number;
  offset: number;
  color: string;
  isFinal: boolean;
}

export interface Mpro2StatusData {
  trend: 'Bullish' | 'Bearish';
  swingHigh: number;
  swingLow: number;
  swingRange: number;
  nearestLevelRatio: number | null;
  nearestLevelPrice: number | null;
  strongestLevelRatio: number | null;
  strongestLevelPrice: number | null;
  strongestTouchCount: number;
  periodUsed: number;
  isPro?: boolean;
  accessMode?: 'free' | 'demo' | 'pro' | string;
}

export interface Mpro2Results {
  levels: Mpro2FibLevel[];
  goldenPocket: {
    topPrice: number;
    bottomPrice: number;
    high: number;
    low: number;
    touched: boolean;
  } | null;
  signals: Mpro2SignalArrow[];
  statusData: Mpro2StatusData;
  timeZones: Mpro2TimeZone[];
  lineStartBarIndex: number;
  swingHigh: number;
  swingLow: number;
  directionIsDown: boolean;
  weeklyAnchor?: WeeklyAnchorState;
}

export interface Mpro2Config {
  isPro?: boolean;
  accessMode?: 'free' | 'demo' | 'pro' | string;
  rangeMode?: 'WeeklyAnchor' | 'AllChart' | 'Lookback'; // default 'WeeklyAnchor' (Fixed Weekly High & Low with Confirmed Swing Lock)
  lookbackPeriod?: number; // default 200 (used when rangeMode is 'Lookback')
  delayBars?: number; // default 5
  lineExtensionMode?: 'None' | 'Left' | 'Right' | 'Both' | 'FullChart'; // default 'FullChart'
  reverseDirection?: boolean; // default false
  
  // Base Lines
  showBaseLine0000?: boolean; // default true
  showBaseLine1000?: boolean; // default true
  baseLineColor?: string; // default #2962FF
  baseLineStyle?: 'Solid' | 'Dotted' | 'Dashed'; // default Solid
  baseLineWidth?: number; // default 2
  
  // Extension Lines
  showDottedLines?: boolean; // Center & extension dotted lines on/off (default false)
  showExtLine1?: boolean; // 0.236 default false
  extLineRatio1?: number; // 0.236
  showExtLine2?: boolean; // 0.382 default false
  extLineRatio2?: number; // 0.382
  showExtLine3?: boolean; // 0.500 default false
  extLineRatio3?: number; // 0.500
  showExtLine4?: boolean; // 0.618 default false
  extLineRatio4?: number; // 0.618
  showExtLine5?: boolean; // 0.786 default false
  extLineRatio5?: number; // 0.786
  showExtLine6?: boolean; // 1.272 default false
  extLineRatio6?: number; // 1.272
  showExtLine7?: boolean; // 1.414 default false
  extLineRatio7?: number; // 1.414
  showExtLine8?: boolean; // 1.618 default false
  extLineRatio8?: number; // 1.618
  showExtLine9?: boolean; // 2.000 default false
  extLineRatio9?: number; // 2.000
  extLineColor?: string; // default #787B86
  extLineStyle?: 'Solid' | 'Dotted' | 'Dashed'; // default Dotted
  extLineWidth?: number; // default 1

  // Golden Pocket
  showGoldenPocket?: boolean; // default true
  goldenPocketColor?: string; // default rgba(255, 176, 32, 0.2)

  // Level Strength & Labels
  showTouchCounts?: boolean; // default true
  showScreenTexts?: boolean; // default true (on/off setting for screen texts)
  showLevelLabels?: boolean; // default true

  // Multi-Swing Confluence
  showConfluence?: boolean; // default true
  priorSwingCount?: number; // default 2
  confluenceTolerancePct?: number; // default 0.15
  confluenceWidthBoost?: number; // default 2
  confluenceMarker?: string; // default ★

  // Adaptive Sensitivity
  useAdaptiveDetection?: boolean; // default false
  atrLength?: number; // default 14
  atrBaselineLength?: number; // default 100

  // Time Zones
  showTimeZones?: boolean; // default false
  timeZoneCount?: number; // default 5
  timeZoneColor?: string; // default #D4AF37
  useMultiColorZones?: boolean; // default true
  showTimeZoneLabels?: boolean; // default false

  // Status Table
  showStatusTable?: boolean; // default true
  tablePosition?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left'; // default Top Right
  bullColor?: string; // default #26A69A
  bearColor?: string; // default #EF5350

  // Buy/Sell Touch Arrows
  showTouchArrows?: boolean; // default true
}

export function calculateMpro2Signals(
  candles: Candle[],
  config: Mpro2Config = {}
): Mpro2Results | null {
  const n = candles.length;
  if (n < 15) return null;

  const rangeMode = config.rangeMode ?? 'AllChart';
  const lookbackPeriod = config.lookbackPeriod ?? 200;
  const delayBars = Math.max(1, Math.min(lookbackPeriod - 1, config.delayBars ?? 5));
  const reverseDirection = config.reverseDirection ?? false;

  // 1. Adaptive Sensitivity (ATR calculation)
  let effectivePeriod = rangeMode === 'AllChart' ? n : lookbackPeriod;
  if (config.useAdaptiveDetection && rangeMode !== 'AllChart') {
    const atrLen = config.atrLength ?? 14;
    const baseLen = config.atrBaselineLength ?? 100;
    
    // Calculate True Range & ATR
    const trArray: number[] = new Array(n);
    trArray[0] = candles[0].high - candles[0].low;
    for (let i = 1; i < n; i++) {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      trArray[i] = Math.max(hl, hc, lc);
    }

    // Exponential or SMA ATR
    const atrArray: number[] = new Array(n);
    let sumTR = 0;
    for (let i = 0; i < n; i++) {
      sumTR += trArray[i];
      if (i >= atrLen) sumTR -= trArray[i - atrLen];
      atrArray[i] = sumTR / Math.min(i + 1, atrLen);
    }

    // ATR Baseline SMA
    let sumAtr = 0;
    const lastAtr = atrArray[n - 1] || 1;
    for (let i = Math.max(0, n - baseLen); i < n; i++) {
      sumAtr += atrArray[i];
    }
    const atrBaseline = sumAtr / Math.min(n, baseLen) || 1;
    const volatilityRatio = atrBaseline === 0 ? 1.0 : lastAtr / atrBaseline;
    const adaptivePeriodRaw = lookbackPeriod / volatilityRatio;
    effectivePeriod = Math.max(delayBars + 5, Math.min(lookbackPeriod * 3, Math.round(adaptivePeriodRaw)));
  }

  // 2. Williams 5-bar Fractal High & Low detection across history
  const fractalHighs: (number | null)[] = new Array(n).fill(null);
  const fractalLows: (number | null)[] = new Array(n).fill(null);

  let curFractalHigh = candles[0].high;
  let curFractalLow = candles[0].low;

  for (let i = 2; i < n - 2; i++) {
    const h2 = candles[i].high;
    if (
      h2 > candles[i - 2].high &&
      h2 > candles[i - 1].high &&
      h2 > candles[i + 1].high &&
      h2 > candles[i + 2].high
    ) {
      curFractalHigh = h2;
    }
    fractalHighs[i] = curFractalHigh;

    const l2 = candles[i].low;
    if (
      l2 < candles[i - 2].low &&
      l2 < candles[i - 1].low &&
      l2 < candles[i + 1].low &&
      l2 < candles[i + 2].low
    ) {
      curFractalLow = l2;
    }
    fractalLows[i] = curFractalLow;
  }

  // Fill remaining bars with latest confirmed fractals
  for (let i = 0; i < n; i++) {
    if (fractalHighs[i] === null) {
      fractalHighs[i] = i > 0 ? (fractalHighs[i - 1] ?? candles[i].high) : candles[i].high;
    }
    if (fractalLows[i] === null) {
      fractalLows[i] = i > 0 ? (fractalLows[i - 1] ?? candles[i].low) : candles[i].low;
    }
  }

  // 3. Swing High / Low over Weekly Anchor (or All Chart / Lookback Window)
  const weeklyAnchorState = computeWeeklyAnchor(candles);
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let swingHighBar = 0;
  let swingLowBar = 0;

  if (rangeMode === 'WeeklyAnchor') {
    // Option 1 + Option 3: Weekly Anchor with Confirmed Swing Lock
    // PWH & PWL are fixed anchors at the start of the week.
    // When price breaks, lines DO NOT immediately jump to new high/low!
    // Break -> Hold/Reject -> Retest -> Confirmation -> Update
    swingHigh = weeklyAnchorState.anchorHigh;
    swingLow = weeklyAnchorState.anchorLow;
    swingHighBar = Math.max(0, weeklyAnchorState.activeWeekStartIndex);
    swingLowBar = Math.max(0, weeklyAnchorState.activeWeekStartIndex);
  } else if (rangeMode === 'AllChart') {
    // True macro High & Low spanning all candles of the active timeframe chart
    for (let i = 0; i < n; i++) {
      if (candles[i].high >= swingHigh) {
        swingHigh = candles[i].high;
        swingHighBar = i;
      }
      if (candles[i].low <= swingLow) {
        swingLow = candles[i].low;
        swingLowBar = i;
      }
    }
  } else {
    // Lookback window (delayed by delayBars)
    const delayedIndex = Math.max(0, n - 1 - delayBars);
    const windowStart = Math.max(0, delayedIndex - (effectivePeriod - delayBars));

    for (let i = windowStart; i <= delayedIndex; i++) {
      const fh = fractalHighs[i] ?? candles[i].high;
      const fl = fractalLows[i] ?? candles[i].low;

      if (fh >= swingHigh) {
        swingHigh = fh;
        swingHighBar = i;
      }
      if (fl <= swingLow) {
        swingLow = fl;
        swingLowBar = i;
      }
    }

    if (swingHigh === -Infinity || swingLow === Infinity || swingHigh <= swingLow) {
      for (let i = windowStart; i <= delayedIndex; i++) {
        if (candles[i].high > swingHigh) {
          swingHigh = candles[i].high;
          swingHighBar = i;
        }
        if (candles[i].low < swingLow) {
          swingLow = candles[i].low;
          swingLowBar = i;
        }
      }
    }
  }

  const swingRange = Math.max(0.00001, swingHigh - swingLow);

  // 4. Trend Direction & Multi-Swing Historical Snapshots
  const priorSwingHighs: number[] = [];
  const priorSwingLows: number[] = [];
  const priorCount = config.priorSwingCount ?? 2;

  let trendIsDown = false;
  const delayedIndex = rangeMode === 'AllChart' ? n - 1 : Math.max(0, n - 1 - delayBars);

  if (rangeMode === 'WeeklyAnchor') {
    trendIsDown = weeklyAnchorState.breakDirection === 'BEARISH' ||
      (weeklyAnchorState.breakDirection === null && candles[n - 1].close < weeklyAnchorState.pwm);
  } else if (rangeMode === 'AllChart') {
    // If High occurred before Low, market moved downwards to Low (Bearish)
    // If Low occurred before High, market moved upwards to High (Bullish)
    trendIsDown = swingHighBar < swingLowBar;
  } else {
    // Walk through history to detect trend flips and record prior swings
    let prevHigh = fractalHighs[0] ?? candles[0].high;
    let prevLow = fractalLows[0] ?? candles[0].low;

    for (let i = 1; i <= delayedIndex; i++) {
      const fh = fractalHighs[i] ?? candles[i].high;
      const fl = fractalLows[i] ?? candles[i].low;
      const wasDown = trendIsDown;

      if (fh > prevHigh) {
        trendIsDown = false;
        prevHigh = fh;
      } else if (fl < prevLow) {
        trendIsDown = true;
        prevLow = fl;
      }

      if (trendIsDown !== wasDown) {
        priorSwingHighs.unshift(prevHigh);
        priorSwingLows.unshift(prevLow);
        if (priorSwingHighs.length > priorCount) {
          priorSwingHighs.pop();
          priorSwingLows.pop();
        }
      }
    }
  }

  const directionIsDown = reverseDirection ? !trendIsDown : trendIsDown;
  const swingStartBar = directionIsDown ? swingLowBar : swingHighBar;
  const lineStartBarIndex = rangeMode === 'AllChart' ? 0 : Math.max(0, n - 1 - (effectivePeriod + delayBars));

  // 5. Configured Fibonacci Levels Definition
  const baseLineColor = config.baseLineColor ?? '#2962FF';
  const baseLineStyle = config.baseLineStyle ?? 'Solid';
  const baseLineWidth = config.baseLineWidth ?? 2;

  const extLineColor = config.extLineColor ?? '#787B86';
  const extLineStyle = config.extLineStyle ?? 'Dotted';
  const extLineWidth = config.extLineWidth ?? 1;
  const allowDotted = config.showDottedLines ?? false;

  const rawRatios = [
    { ratio: 0.000, isBase: true, show: config.showBaseLine0000 ?? true },
    { ratio: 1.000, isBase: true, show: config.showBaseLine1000 ?? true },
    { ratio: config.extLineRatio1 ?? 0.236, isBase: false, show: allowDotted && (config.showExtLine1 ?? false) },
    { ratio: config.extLineRatio2 ?? 0.382, isBase: false, show: allowDotted && (config.showExtLine2 ?? false) },
    { ratio: config.extLineRatio3 ?? 0.500, isBase: false, show: allowDotted && (config.showExtLine3 ?? false) },
    { ratio: config.extLineRatio4 ?? 0.618, isBase: false, show: allowDotted && (config.showExtLine4 ?? false) },
    { ratio: config.extLineRatio5 ?? 0.786, isBase: false, show: allowDotted && (config.showExtLine5 ?? false) },
    { ratio: config.extLineRatio6 ?? 1.272, isBase: false, show: allowDotted && (config.showExtLine6 ?? false) },
    { ratio: config.extLineRatio7 ?? 1.414, isBase: false, show: allowDotted && (config.showExtLine7 ?? false) },
    { ratio: config.extLineRatio8 ?? 1.618, isBase: false, show: allowDotted && (config.showExtLine8 ?? false) },
    { ratio: config.extLineRatio9 ?? 2.000, isBase: false, show: allowDotted && (config.showExtLine9 ?? false) },
  ];

  // Helper: check confluence with prior swings
  const confluenceTol = (swingRange * (config.confluenceTolerancePct ?? 0.15)) / 100;
  const isConfluent = (priceToCheck: number): boolean => {
    if (priorSwingHighs.length === 0) return false;
    for (let j = 0; j < priorSwingHighs.length; j++) {
      const pHigh = priorSwingHighs[j];
      const pLow = priorSwingLows[j];
      const pRange = pHigh - pLow;
      if (pRange <= 0) continue;
      for (const r of rawRatios) {
        const p1 = pLow + pRange * r.ratio;
        const p2 = pHigh - pRange * r.ratio;
        if (Math.abs(priceToCheck - p1) <= confluenceTol || Math.abs(priceToCheck - p2) <= confluenceTol) {
          return true;
        }
      }
    }
    return false;
  };

  // 6. Compute Prices, Touch Counts, Confluence, and Labels
  const levels: Mpro2FibLevel[] = [];
  let nearestLevelDist = Infinity;
  let nearestLevelRatio: number | null = null;
  let nearestLevelPrice: number | null = null;

  let strongestTouchCount = -1;
  let strongestLevelRatio: number | null = null;
  let strongestLevelPrice: number | null = null;

  const lastClose = candles[n - 1].close;
  const showTouchCounts = config.showTouchCounts ?? true;
  const showConfluence = config.showConfluence ?? true;
  const confluenceMarker = config.confluenceMarker ?? '★';
  const confluenceWidthBoost = config.confluenceWidthBoost ?? 2;

  // Decimal formatting based on price scale
  const decimals = swingHigh > 1000 ? 2 : swingHigh > 10 ? 3 : 5;

  rawRatios.forEach((r) => {
    if (!r.show) return;

    const fibPrice = directionIsDown
      ? swingLow + swingRange * r.ratio
      : swingHigh - swingRange * r.ratio;

    const confluent = showConfluence && !r.isBase && isConfluent(fibPrice);

    // Count touches since swing high/low formed (within lookback window)
    let touchCount = 0;
    for (let i = Math.max(0, n - 1 - effectivePeriod); i < n; i++) {
      if (candles[i].high >= fibPrice && candles[i].low <= fibPrice) {
        touchCount++;
      }
    }

    const resolvedColor = r.isBase ? baseLineColor : extLineColor;
    const resolvedStyle = r.isBase ? baseLineStyle : extLineStyle;
    const resolvedWidth = r.isBase ? baseLineWidth : extLineWidth + (confluent ? confluenceWidthBoost : 0);

    const touchText = showTouchCounts ? `  ·  ${touchCount}x` : '';
    const confText = confluent ? `  ${confluenceMarker}` : '';
    const labelText = `${r.ratio.toFixed(3)}  ·  ${fibPrice.toFixed(decimals)}${touchText}${confText}`;

    levels.push({
      ratio: r.ratio,
      price: fibPrice,
      isBaseLine: r.isBase,
      isShown: true,
      confluent,
      touchCount,
      color: resolvedColor,
      style: resolvedStyle,
      width: resolvedWidth,
      labelText,
    });

    // Track nearest level
    const dist = Math.abs(lastClose - fibPrice);
    if (dist < nearestLevelDist) {
      nearestLevelDist = dist;
      nearestLevelRatio = r.ratio;
      nearestLevelPrice = fibPrice;
    }

    // Track strongest level (most touches on extension lines)
    if (!r.isBase && touchCount > strongestTouchCount) {
      strongestTouchCount = touchCount;
      strongestLevelRatio = r.ratio;
      strongestLevelPrice = fibPrice;
    }
  });

  // 7. Golden Pocket (0.618 - 0.650)
  const goldenTopPrice = directionIsDown
    ? swingLow + swingRange * 0.618
    : swingHigh - swingRange * 0.618;
  const goldenBottomPrice = directionIsDown
    ? swingLow + swingRange * 0.650
    : swingHigh - swingRange * 0.650;
  const gpHigh = Math.max(goldenTopPrice, goldenBottomPrice);
  const gpLow = Math.min(goldenTopPrice, goldenBottomPrice);

  const goldenPocketTouched =
    (config.showGoldenPocket ?? true) &&
    candles[n - 1].high >= gpLow &&
    candles[n - 1].low <= gpHigh;

  const goldenPocket = (config.showGoldenPocket ?? true)
    ? {
        topPrice: goldenTopPrice,
        bottomPrice: goldenBottomPrice,
        high: gpHigh,
        low: gpLow,
        touched: goldenPocketTouched,
      }
    : null;

  // 8. Buy & Sell Touch Signals (Upper line touch = STRONG SELL, Lower line touch = STRONG BUY)
  const signals: Mpro2SignalArrow[] = [];
  const showTouchArrows = config.showTouchArrows ?? true;

  if (showTouchArrows && candles.length > 0) {
    const upperLinePrice = Math.max(swingHigh, swingLow + swingRange);
    const lowerLinePrice = Math.min(swingLow, swingHigh - swingRange);
    
    // Dynamic touch tolerance based on swing range and average candle volatility
    const sampleSize = Math.min(n, 50);
    const avgCandleRange = candles.slice(-sampleSize).reduce((acc, c) => acc + (c.high - c.low), 0) / sampleSize;
    const tolerance = Math.max(swingRange * 0.008, avgCandleRange * 0.6);

    let lastSignalType: 'BUY' | 'SELL' | null = null;
    let lastSignalBar = -50;

    // Stateful Breakout & Retest Engine:
    // Tracks whether price has broken cleanly beyond upperLinePrice or lowerLinePrice.
    // If price breaks above Upper Line (Resistance), that level flips to Support!
    // When price pulls back to retest the broken level from above and confirms with a bounce candle,
    // it triggers a RETEST BUY (Continuation), NOT a Sell!
    // Similarly, if price breaks below Lower Line (Support), that level flips to Resistance!
    // When price rallies to retest from below with a rejection candle, it triggers a RETEST SELL (Continuation)!
    let upperBreakoutActive = false;
    let lowerBreakdownActive = false;

    // Scan all chart candles across history
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      if (!c) continue;

      const cRange = Math.max(0.0001, c.high - c.low);
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const upperWickPct = upperWick / cRange;
      const lowerWickPct = lowerWick / cRange;
      const isBullishCandle = c.close > c.open;
      const isBearishCandle = c.close < c.open;

      // 1. Check for Breakout above Upper Line (Resistance)
      // A confirmed close above the upper line establishes the breakout
      if (!upperBreakoutActive && c.close > upperLinePrice + tolerance * 0.15) {
        upperBreakoutActive = true;
      }
      // Check for Breakdown below Lower Line (Support)
      if (!lowerBreakdownActive && c.close < lowerLinePrice - tolerance * 0.15) {
        lowerBreakdownActive = true;
      }

      // -------------------------------------------------------------
      // UPPER LINE LOGIC (0.000 / Resistance OR Flipped Support)
      // -------------------------------------------------------------
      if (upperBreakoutActive) {
        // Price previously broke above Upper Line: Upper Line is now SUPPORT!
        // A: Check if breakout failed and price re-entered deep back inside range (Sweep/Fakeout)
        if (c.close < upperLinePrice - tolerance * 0.6) {
          upperBreakoutActive = false; // Reset back to range
        } else {
          // B: Check for Retest of Broken Upper Line from Above
          const touchesUpperFromAbove = c.low <= upperLinePrice + tolerance && c.high >= upperLinePrice - tolerance * 0.2;
          
          if (touchesUpperFromAbove) {
            // Must be confirmed by a BOUNCE CANDLE (closes above or near level, bullish or lower wick rejection)
            const confirmedBounce =
              c.close >= upperLinePrice - tolerance * 0.25 &&
              (isBullishCandle || lowerWickPct >= 0.25 || (c.close - c.low) / cRange >= 0.55);

            if (confirmedBounce && (lastSignalType !== 'BUY' || i - lastSignalBar >= 4)) {
              signals.push({
                index: i,
                time: c.time,
                type: 'BUY',
                subType: 'RETEST_CONTINUATION_BUY',
                price: c.low,
                levelPrice: upperLinePrice,
                levelRatio: directionIsDown ? 0.0 : 1.0,
                message: `▲ RETEST BUY (Continuation) · ${upperLinePrice.toFixed(decimals)}`,
              });
              lastSignalType = 'BUY';
              lastSignalBar = i;
            }
          }
        }
      } else {
        // Inside Range: Upper Line acts as RESISTANCE
        const touchesUpperAsResistance = c.high >= upperLinePrice - tolerance && c.low <= upperLinePrice + tolerance;
        
        if (touchesUpperAsResistance && c.close <= upperLinePrice + tolerance * 0.15) {
          // MUST BE CONFIRMED BY A REJECTION CANDLE (does not close above; shows upper wick or bearish close)
          const confirmedRejection =
            (isBearishCandle && (upperWickPct >= 0.18 || c.close <= upperLinePrice)) ||
            upperWickPct >= 0.28 ||
            (c.high - c.close) / cRange >= 0.60;

          if (confirmedRejection && (lastSignalType !== 'SELL' || i - lastSignalBar >= 4)) {
            signals.push({
              index: i,
              time: c.time,
              type: 'SELL',
              subType: 'REVERSAL_SELL',
              price: c.high,
              levelPrice: upperLinePrice,
              levelRatio: directionIsDown ? 1.0 : 0.0,
              message: `▼ STRONG SELL (Resistance) · ${upperLinePrice.toFixed(decimals)}`,
            });
            lastSignalType = 'SELL';
            lastSignalBar = i;
          }
        }
      }

      // -------------------------------------------------------------
      // LOWER LINE LOGIC (1.000 / Support OR Flipped Resistance)
      // -------------------------------------------------------------
      if (lowerBreakdownActive) {
        // Price previously broke below Lower Line: Lower Line is now RESISTANCE!
        // A: Check if breakdown failed and price re-entered deep back inside range (Sweep/Fakeout)
        if (c.close > lowerLinePrice + tolerance * 0.6) {
          lowerBreakdownActive = false; // Reset back to range
        } else {
          // B: Check for Retest of Broken Lower Line from Below
          const touchesLowerFromBelow = c.high >= lowerLinePrice - tolerance && c.low <= lowerLinePrice + tolerance * 0.2;

          if (touchesLowerFromBelow) {
            // Must be confirmed by a REJECTION CANDLE (closes below or near level, bearish or upper wick rejection)
            const confirmedRejection =
              c.close <= lowerLinePrice + tolerance * 0.25 &&
              (isBearishCandle || upperWickPct >= 0.25 || (c.high - c.close) / cRange >= 0.55);

            if (confirmedRejection && (lastSignalType !== 'SELL' || i - lastSignalBar >= 4)) {
              signals.push({
                index: i,
                time: c.time,
                type: 'SELL',
                subType: 'RETEST_CONTINUATION_SELL',
                price: c.high,
                levelPrice: lowerLinePrice,
                levelRatio: directionIsDown ? 1.0 : 0.0,
                message: `▼ RETEST SELL (Continuation) · ${lowerLinePrice.toFixed(decimals)}`,
              });
              lastSignalType = 'SELL';
              lastSignalBar = i;
            }
          }
        }
      } else {
        // Inside Range: Lower Line acts as SUPPORT
        const touchesLowerAsSupport = c.low <= lowerLinePrice + tolerance && c.high >= lowerLinePrice - tolerance;

        if (touchesLowerAsSupport && c.close >= lowerLinePrice - tolerance * 0.15) {
          // MUST BE CONFIRMED BY A REJECTION CANDLE (does not close below; shows lower wick or bullish close)
          const confirmedBounce =
            (isBullishCandle && (lowerWickPct >= 0.18 || c.close >= lowerLinePrice)) ||
            lowerWickPct >= 0.28 ||
            (c.close - c.low) / cRange >= 0.60;

          if (confirmedBounce && (lastSignalType !== 'BUY' || i - lastSignalBar >= 4)) {
            signals.push({
              index: i,
              time: c.time,
              type: 'BUY',
              subType: 'REVERSAL_BUY',
              price: c.low,
              levelPrice: lowerLinePrice,
              levelRatio: directionIsDown ? 0.0 : 1.0,
              message: `▲ STRONG BUY (Support) · ${lowerLinePrice.toFixed(decimals)}`,
            });
            lastSignalType = 'BUY';
            lastSignalBar = i;
          }
        }
      }
    }
  }

  // 9. Fibonacci Time Zones (1, 2, 3, 5, 8, 13, 21, 34...)
  const timeZones: Mpro2TimeZone[] = [];
  if (config.showTimeZones) {
    const tzPalette = ['#D4AF37', '#5B8DEF', '#EC4899', '#26A69A', '#8B5CF6', '#F97316', '#38BDF8', '#EF5350'];
    const count = Math.min(15, Math.max(1, config.timeZoneCount ?? 5));
    const offsets: number[] = [1, 2];
    while (offsets.length < count) {
      const len = offsets.length;
      offsets.push(offsets[len - 1] + offsets[len - 2]);
    }

    for (let i = 0; i < count; i++) {
      const off = offsets[i];
      const zBar = swingStartBar + off;
      const col = config.useMultiColorZones ?? true
        ? tzPalette[i % tzPalette.length]
        : (config.timeZoneColor ?? '#D4AF37');

      timeZones.push({
        barIndex: zBar,
        offset: off,
        color: col,
        isFinal: i === count - 1,
      });
    }
  }

  // 10. Status Table Data
  const statusData: Mpro2StatusData = {
    trend: directionIsDown ? 'Bearish' : 'Bullish',
    swingHigh,
    swingLow,
    swingRange,
    nearestLevelRatio,
    nearestLevelPrice,
    strongestLevelRatio,
    strongestLevelPrice,
    strongestTouchCount: Math.max(0, strongestTouchCount),
    periodUsed: effectivePeriod,
    isPro: config.isPro ?? false,
    accessMode: config.accessMode ?? 'demo',
  };

  return {
    levels,
    goldenPocket,
    signals,
    statusData,
    timeZones,
    lineStartBarIndex,
    swingHigh,
    swingLow,
    directionIsDown,
    weeklyAnchor: weeklyAnchorState,
  };
}
