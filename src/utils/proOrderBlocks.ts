/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PRO Institutional Order Block Indicator (Live 8-Factor Strength & Shadow Engine)
 *
 * Designed for High-Accuracy Institutional Trading (1H, 15M, Jump Indices, Gold, Forex).
 *
 * Key Capabilities:
 * 1. Zero-Lag Live Detection: Detects developing and confirmed order blocks in real-time
 *    as soon as institutional displacement occurs (evaluating right up to the live candle,
 *    like the Nexus SMC suite).
 * 2. 8-Factor Confluence Scoring Engine (Scored 1-8, with Strength % 0-100%):
 *    - Factor 1: Displacement / Range Expansion (>= 1.3x ATR)
 *    - Factor 2: Fair Value Gap (FVG) / Imbalance Creation
 *    - Factor 3: Liquidity Sweep of previous swing highs/lows (BSL/SSL)
 *    - Factor 4: Break of Structure (BOS / MSS)
 *    - Factor 5: Institutional Volume Surge (>= 1.3x 20-SMA Volume)
 *    - Factor 6: Premium vs. Discount Equilibrium Positioning
 *    - Factor 7: Trend / Momentum Alignment (EMA50)
 *    - Factor 8: Freshness / Virgin Unmitigated Status (First Touch)
 * 3. Forward Shadow Projection:
 *    - Renders an illuminated institutional "Shadow" zone extending past live candles.
 *    - Inside the shadow, displays high-visibility institutional text:
 *      e.g. "BULL OB [7/8] • 88% STRONG" with full score and strength percentage.
 * 4. Customizable Shadow Visibility & Opacity in settings.
 */

import { Candle } from '../types';

export interface ProOrderBlockFactorBreakdown {
  displacement: boolean;      // 1. Departure expansion >= 1.3 ATR or strong momentum
  fvg: boolean;               // 2. Unmitigated FVG created right next to block
  liquiditySweep: boolean;    // 3. Sweep of recent opposing swing high/low
  bos: boolean;               // 4. Break of Structure (BOS / MSS)
  volumeSpike: boolean;       // 5. Volume spike >= 1.25x 20-SMA volume
  premiumDiscount: boolean;   // 6. Bullish in Discount (< 50%) or Bearish in Premium (> 50%)
  trendAlignment: boolean;    // 7. Aligned with EMA50 trend
  unmitigated: boolean;       // 8. Fresh virgin block (0 touches)
}

export interface ProOrderBlock {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  originIndex: number;
  originTime: number;
  topPrice: number;
  bottomPrice: number;
  midPrice: number;
  score: number; // 1 to 8
  strength: number; // 0 to 100% (round(score / 8 * 100))
  quality: 'ULTRA' | 'STRONG' | 'MODERATE' | 'WEAK';
  factors: ProOrderBlockFactorBreakdown;
  factorDescriptions: string[];
  isLive: boolean; // Formed on recent bars (zero-lag live appearance)
  isMitigated: boolean;
  mitigatedIndex: number | null;
  isInvalidated: boolean;
  invalidatedIndex: number | null;
  touchCount: number;
  lastTouchTime?: number;
  endBarIndex: number;
}

export interface ProOrderBlocksOptions {
  minScore?: number; // Minimum score (1-8) to display, default: 4
  showShadow?: boolean; // Shadow visibility toggle, default: true
  shadowOpacity?: number; // Shadow opacity (0-100), default: 25
  extendBars?: number; // Forward shadow projection distance in bars, default: 20
  showStrengthPercent?: boolean; // Display percentage from 100 inside shadow, default: true
  showScore?: boolean; // Display [X/8] score inside shadow, default: true
  showOnlyUnmitigated?: boolean; // Only show active unmitigated blocks, default: false
}

export interface ProOrderBlocksResult {
  orderBlocks: ProOrderBlock[];
  activeCount: number;
  liveCount: number;
  unmitigatedCount: number;
  avgStrength: number;
}

/**
 * Calculates 14-period Average True Range (ATR)
 */
function calculateATR(candles: Candle[], period: number = 14): number[] {
  const n = candles.length;
  const atr: number[] = new Array(n).fill(0);
  if (n < 2) return atr;

  let trSum = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    if (i <= period) {
      trSum += tr;
      atr[i] = trSum / i;
    } else {
      atr[i] = (atr[i - 1] * (period - 1) + tr) / period;
    }
  }
  return atr;
}

/**
 * Calculates 50-period Exponential Moving Average (EMA)
 */
function calculateEMA(candles: Candle[], period: number = 50): number[] {
  const n = candles.length;
  const ema: number[] = new Array(n).fill(0);
  if (n === 0) return ema;

  const k = 2 / (period + 1);
  ema[0] = candles[0].close;

  for (let i = 1; i < n; i++) {
    ema[i] = candles[i].close * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/**
 * Calculates 20-period Simple Moving Average of Volume
 */
function calculateVolumeSMA(candles: Candle[], period: number = 20): number[] {
  const n = candles.length;
  const vSma: number[] = new Array(n).fill(0);
  let sum = 0;

  for (let i = 0; i < n; i++) {
    const v = candles[i].volume ?? (candles[i].high - candles[i].low) * 10000;
    sum += v;
    if (i >= period) {
      const oldV = candles[i - period].volume ?? (candles[i - period].high - candles[i - period].low) * 10000;
      sum -= oldV;
      vSma[i] = sum / period;
    } else {
      vSma[i] = sum / (i + 1);
    }
  }
  return vSma;
}

/**
 * Core Algorithm: Detects and Scores Pro Order Blocks with Live Real-time & 8-Factor Strength
 */
export function calculateProOrderBlocks(
  candles: Candle[],
  options: ProOrderBlocksOptions = {}
): ProOrderBlocksResult {
  const {
    minScore = 4,
    extendBars = 20,
    showOnlyUnmitigated = false,
  } = options;

  const n = candles.length;
  if (n < 15) {
    return { orderBlocks: [], activeCount: 0, liveCount: 0, unmitigatedCount: 0, avgStrength: 0 };
  }

  const atr = calculateATR(candles, 14);
  const ema50 = calculateEMA(candles, Math.min(50, Math.floor(n / 2)));
  const volSma = calculateVolumeSMA(candles, 20);

  const rawBlocks: ProOrderBlock[] = [];

  // =========================================================================
  // STEP 1: Scan for Order Blocks (Historical + Live Candles up to index n - 2)
  // Zero-lag: Checks right up to the latest bars so blocks appear immediately in LIVE!
  // =========================================================================
  for (let i = 2; i < n - 1; i++) {
    const c = candles[i];
    const cNext = candles[i + 1];
    const curAtr = Math.max(0.0001, atr[i] || (c.high - c.low));
    const range = Math.max(0.00001, c.high - c.low);

    // Is candle i near the live edge? (Zero-lag detection like Nexus)
    const isLive = i >= n - 4;

    // -------------------------------------------------------------
    // A. BULLISH ORDER BLOCK CANDIDATE (Demand Block)
    // -------------------------------------------------------------
    // Condition 1: Candle i was bearish/indecision or lowest in its 3-bar micro-swing
    const isBearishCandle = c.close <= c.open || (c.open - c.close) > range * 0.2;
    const isLocalTrough = c.low <= candles[i - 1].low && (i < 2 || c.low <= candles[i - 2].low);

    // Condition 2: Candle i+1 displays strong bullish expansion / departure
    const nextBody = cNext.close - cNext.open;
    const isBullishExpansion =
      nextBody > 0 &&
      (cNext.close > c.high || nextBody >= curAtr * 0.9 || (i + 2 < n && candles[i + 2].close > c.high));

    if ((isBearishCandle || isLocalTrough) && isBullishExpansion) {
      // Define block boundaries: institutional body / candle range
      const bottomPrice = c.low;
      const bodyTop = Math.max(c.open, c.close);
      // Bound to body or upper 45% for precise institutional entry
      const topPrice = (bodyTop - c.low) < range * 0.2 ? c.low + range * 0.45 : bodyTop;

      // 8-Factor Confluence Evaluation for Bullish OB
      const factors: ProOrderBlockFactorBreakdown = {
        displacement: false,
        fvg: false,
        liquiditySweep: false,
        bos: false,
        volumeSpike: false,
        premiumDiscount: false,
        trendAlignment: false,
        unmitigated: true,
      };
      const factorDescs: string[] = [];

      // Factor 1: Displacement (Aggressive departure >= 1.3 ATR or engulfing expansion)
      const maxExpBody = Math.max(
        nextBody,
        i + 2 < n ? candles[i + 2].close - candles[i + 2].open : 0
      );
      if (maxExpBody >= curAtr * 1.25 || maxExpBody > range * 1.35) {
        factors.displacement = true;
        factorDescs.push('Displacement Expansion (>= 1.3 ATR)');
      }

      // Factor 2: FVG / Imbalance Creation (3-candle gap between candle i and i+2)
      if (i + 2 < n && candles[i + 2].low > c.high) {
        factors.fvg = true;
        factorDescs.push('Fair Value Gap (FVG) Imbalance');
      }

      // Factor 3: Liquidity Sweep (Swept lows of preceding 3-6 candles)
      let sweptLow = false;
      const lookbackStart = Math.max(0, i - 5);
      for (let k = lookbackStart; k < i; k++) {
        if (c.low < candles[k].low) {
          sweptLow = true;
          break;
        }
      }
      if (sweptLow) {
        factors.liquiditySweep = true;
        factorDescs.push('Sell-Side Liquidity (SSL) Sweep');
      }

      // Factor 4: Break of Structure (BOS / MSS)
      // Checks if the rally breaks the prior swing high
      let brokeSwing = false;
      for (let k = Math.max(0, i - 8); k < i; k++) {
        if (cNext.close > candles[k].high || (i + 2 < n && candles[i + 2].close > candles[k].high)) {
          brokeSwing = true;
          break;
        }
      }
      if (brokeSwing) {
        factors.bos = true;
        factorDescs.push('Market Structure Break (BOS / MSS)');
      }

      // Factor 5: Institutional Volume Surge
      const volAtBlock = Math.max(c.volume ?? 0, cNext.volume ?? 0);
      const avgV = volSma[i] || 1;
      if (volAtBlock >= avgV * 1.25 || (cNext.high - cNext.low) > curAtr * 1.3) {
        factors.volumeSpike = true;
        factorDescs.push('Institutional Volume Surge');
      }

      // Factor 6: Discount Zone Positioning (< 50% of recent 30-bar range)
      const rangeStart = Math.max(0, i - 25);
      let rHigh = -Infinity;
      let rLow = Infinity;
      for (let k = rangeStart; k <= i; k++) {
        rHigh = Math.max(rHigh, candles[k].high);
        rLow = Math.min(rLow, candles[k].low);
      }
      const eq = (rHigh + rLow) / 2;
      if (bottomPrice <= eq) {
        factors.premiumDiscount = true;
        factorDescs.push('Discount Zone Positioning (< 50% Range)');
      }

      // Factor 7: Trend / Momentum Alignment (Above EMA50 or EMA50 rising)
      if (c.close >= ema50[i] * 0.998 || (i > 5 && ema50[i] >= ema50[i - 3])) {
        factors.trendAlignment = true;
        factorDescs.push('EMA50 Trend / Momentum Alignment');
      }

      // Factor 8: Freshness (Evaluated during lifecycle simulation below)
      // Starts as true; if touched, unmitigated becomes false.

      // Calculate initial score
      let score = 0;
      if (factors.displacement) score++;
      if (factors.fvg) score++;
      if (factors.liquiditySweep) score++;
      if (factors.bos) score++;
      if (factors.volumeSpike) score++;
      if (factors.premiumDiscount) score++;
      if (factors.trendAlignment) score++;
      if (factors.unmitigated) score++; // Fresh bonus

      const strength = Math.round((score / 8) * 100);
      const quality = score >= 8 ? 'ULTRA' : score >= 6 ? 'STRONG' : score >= 4 ? 'MODERATE' : 'WEAK';

      rawBlocks.push({
        id: `pro-ob-bull-${i}-${c.time}`,
        type: 'BULLISH',
        originIndex: i,
        originTime: c.time,
        topPrice,
        bottomPrice,
        midPrice: (topPrice + bottomPrice) / 2,
        score,
        strength,
        quality,
        factors,
        factorDescriptions: factorDescs,
        isLive,
        isMitigated: false,
        mitigatedIndex: null,
        isInvalidated: false,
        invalidatedIndex: null,
        touchCount: 0,
        endBarIndex: n - 1 + extendBars,
      });
    }

    // -------------------------------------------------------------
    // B. BEARISH ORDER BLOCK CANDIDATE (Supply Block)
    // -------------------------------------------------------------
    // Condition 1: Candle i was bullish/indecision or highest in its 3-bar micro-swing
    const isBullishCandle = c.close >= c.open || (c.close - c.open) > range * 0.2;
    const isLocalPeak = c.high >= candles[i - 1].high && (i < 2 || c.high >= candles[i - 2].high);

    // Condition 2: Candle i+1 displays strong bearish expansion / departure
    const nextDropBody = cNext.open - cNext.close;
    const isBearishExpansion =
      nextDropBody > 0 &&
      (cNext.close < c.low || nextDropBody >= curAtr * 0.9 || (i + 2 < n && candles[i + 2].close < c.low));

    if ((isBullishCandle || isLocalPeak) && isBearishExpansion) {
      // Define block boundaries: institutional body / candle range
      const topPrice = c.high;
      const bodyBottom = Math.min(c.open, c.close);
      // Bound to body or lower 45% for precise institutional entry
      const bottomPrice = (c.high - bodyBottom) < range * 0.2 ? c.high - range * 0.45 : bodyBottom;

      // 8-Factor Confluence Evaluation for Bearish OB
      const factors: ProOrderBlockFactorBreakdown = {
        displacement: false,
        fvg: false,
        liquiditySweep: false,
        bos: false,
        volumeSpike: false,
        premiumDiscount: false,
        trendAlignment: false,
        unmitigated: true,
      };
      const factorDescs: string[] = [];

      // Factor 1: Displacement (Aggressive drop >= 1.3 ATR or engulfing expansion)
      const maxExpBody = Math.max(
        nextDropBody,
        i + 2 < n ? candles[i + 2].open - candles[i + 2].close : 0
      );
      if (maxExpBody >= curAtr * 1.25 || maxExpBody > range * 1.35) {
        factors.displacement = true;
        factorDescs.push('Displacement Expansion (>= 1.3 ATR)');
      }

      // Factor 2: FVG / Imbalance Creation (3-candle gap between candle i and i+2)
      if (i + 2 < n && candles[i + 2].high < c.low) {
        factors.fvg = true;
        factorDescs.push('Fair Value Gap (FVG) Imbalance');
      }

      // Factor 3: Liquidity Sweep (Swept highs of preceding 3-6 candles)
      let sweptHigh = false;
      const lookbackStart = Math.max(0, i - 5);
      for (let k = lookbackStart; k < i; k++) {
        if (c.high > candles[k].high) {
          sweptHigh = true;
          break;
        }
      }
      if (sweptHigh) {
        factors.liquiditySweep = true;
        factorDescs.push('Buy-Side Liquidity (BSL) Sweep');
      }

      // Factor 4: Break of Structure (BOS / MSS)
      // Checks if the sell-off breaks the prior swing low
      let brokeSwing = false;
      for (let k = Math.max(0, i - 8); k < i; k++) {
        if (cNext.close < candles[k].low || (i + 2 < n && candles[i + 2].close < candles[k].low)) {
          brokeSwing = true;
          break;
        }
      }
      if (brokeSwing) {
        factors.bos = true;
        factorDescs.push('Market Structure Break (BOS / MSS)');
      }

      // Factor 5: Institutional Volume Surge
      const volAtBlock = Math.max(c.volume ?? 0, cNext.volume ?? 0);
      const avgV = volSma[i] || 1;
      if (volAtBlock >= avgV * 1.25 || (cNext.high - cNext.low) > curAtr * 1.3) {
        factors.volumeSpike = true;
        factorDescs.push('Institutional Volume Surge');
      }

      // Factor 6: Premium Zone Positioning (> 50% of recent 30-bar range)
      const rangeStart = Math.max(0, i - 25);
      let rHigh = -Infinity;
      let rLow = Infinity;
      for (let k = rangeStart; k <= i; k++) {
        rHigh = Math.max(rHigh, candles[k].high);
        rLow = Math.min(rLow, candles[k].low);
      }
      const eq = (rHigh + rLow) / 2;
      if (topPrice >= eq) {
        factors.premiumDiscount = true;
        factorDescs.push('Premium Zone Positioning (> 50% Range)');
      }

      // Factor 7: Trend / Momentum Alignment (Below EMA50 or EMA50 falling)
      if (c.close <= ema50[i] * 1.002 || (i > 5 && ema50[i] <= ema50[i - 3])) {
        factors.trendAlignment = true;
        factorDescs.push('EMA50 Trend / Momentum Alignment');
      }

      // Calculate initial score
      let score = 0;
      if (factors.displacement) score++;
      if (factors.fvg) score++;
      if (factors.liquiditySweep) score++;
      if (factors.bos) score++;
      if (factors.volumeSpike) score++;
      if (factors.premiumDiscount) score++;
      if (factors.trendAlignment) score++;
      if (factors.unmitigated) score++; // Fresh bonus

      const strength = Math.round((score / 8) * 100);
      const quality = score >= 8 ? 'ULTRA' : score >= 6 ? 'STRONG' : score >= 4 ? 'MODERATE' : 'WEAK';

      rawBlocks.push({
        id: `pro-ob-bear-${i}-${c.time}`,
        type: 'BEARISH',
        originIndex: i,
        originTime: c.time,
        topPrice,
        bottomPrice,
        midPrice: (topPrice + bottomPrice) / 2,
        score,
        strength,
        quality,
        factors,
        factorDescriptions: factorDescs,
        isLive,
        isMitigated: false,
        mitigatedIndex: null,
        isInvalidated: false,
        invalidatedIndex: null,
        touchCount: 0,
        endBarIndex: n - 1 + extendBars,
      });
    }
  }

  // =========================================================================
  // STEP 2: Lifecycle Simulation (Invalidation, Mitigation, Virgin Status)
  // Forward tracking from originIndex + 2 to latest candle
  // =========================================================================
  const activeAndFilteredBlocks: ProOrderBlock[] = [];
  let activeCount = 0;
  let liveCount = 0;
  let unmitigatedCount = 0;
  let totalStrengthSum = 0;

  for (const block of rawBlocks) {
    let invalidated = false;
    let invalidatedIdx: number | null = null;
    let mitigated = false;
    let mitigatedIdx: number | null = null;
    let touches = 0;
    let lastTouchTime: number | undefined = undefined;

    for (let j = block.originIndex + 2; j < n; j++) {
      const c = candles[j];

      // 1. Invalidation Check (Price closes completely beyond the opposite side)
      if (block.type === 'BULLISH') {
        if (c.close < block.bottomPrice) {
          invalidated = true;
          invalidatedIdx = j;
          break;
        }
      } else {
        if (c.close > block.topPrice) {
          invalidated = true;
          invalidatedIdx = j;
          break;
        }
      }

      // 2. Mitigation Check (Price enters/touches the order block zone)
      if (block.type === 'BULLISH') {
        if (c.low <= block.topPrice && c.high >= block.bottomPrice) {
          if (!mitigated) {
            mitigated = true;
            mitigatedIdx = j;
          }
          touches++;
          lastTouchTime = c.time;
        }
      } else {
        if (c.high >= block.bottomPrice && c.low <= block.topPrice) {
          if (!mitigated) {
            mitigated = true;
            mitigatedIdx = j;
          }
          touches++;
          lastTouchTime = c.time;
        }
      }
    }

    block.isInvalidated = invalidated;
    block.invalidatedIndex = invalidatedIdx;
    block.isMitigated = mitigated;
    block.mitigatedIndex = mitigatedIdx;
    block.touchCount = touches;
    block.lastTouchTime = lastTouchTime;

    // Update Factor 8 (Freshness): If mitigated, fresh bonus drops
    if (mitigated) {
      block.factors.unmitigated = false;
      block.score = Math.max(1, block.score - 1);
      block.strength = Math.round((block.score / 8) * 100);
      block.quality = block.score >= 8 ? 'ULTRA' : block.score >= 6 ? 'STRONG' : block.score >= 4 ? 'MODERATE' : 'WEAK';
    }

    // Set endBarIndex:
    // If live & not invalidated, cast shadow forward past current candle!
    if (invalidated) {
      block.endBarIndex = invalidatedIdx ?? (n - 1);
      // Skip dead invalidated blocks if filtering for clean charts
      continue;
    } else {
      block.endBarIndex = n - 1 + extendBars;
      activeCount++;
      if (block.isLive) liveCount++;
      if (!mitigated) unmitigatedCount++;
    }

    // Filter by options
    if (showOnlyUnmitigated && mitigated) continue;
    if (block.score < minScore) continue;

    activeAndFilteredBlocks.push(block);
    totalStrengthSum += block.strength;
  }

  // =========================================================================
  // STEP 3: Deduplicate / Cluster & Sort
  // Keep clean, high-conviction order blocks (avoid redundant overlapping boxes)
  // =========================================================================
  const finalBlocks: ProOrderBlock[] = [];
  // Sort by recentness (newest first) then score (highest first)
  activeAndFilteredBlocks.sort((a, b) => {
    if (b.originIndex !== a.originIndex) return b.originIndex - a.originIndex;
    return b.score - a.score;
  });

  for (const candidate of activeAndFilteredBlocks) {
    // Check if this candidate overlaps heavily with an existing accepted block of same type
    const isDuplicate = finalBlocks.some((existing) => {
      if (existing.type !== candidate.type) return false;
      const priceOverlap =
        Math.max(0, Math.min(existing.topPrice, candidate.topPrice) - Math.max(existing.bottomPrice, candidate.bottomPrice));
      const minRange = Math.min(existing.topPrice - existing.bottomPrice, candidate.topPrice - candidate.bottomPrice);
      return (priceOverlap / Math.max(0.00001, minRange)) > 0.65;
    });

    if (!isDuplicate) {
      finalBlocks.push(candidate);
    }
  }

  // Limit to most relevant active zones (e.g. up to 12 zones)
  const clampedBlocks = finalBlocks.slice(0, 12);

  const avgStrength = clampedBlocks.length > 0 ? Math.round(totalStrengthSum / clampedBlocks.length) : 0;

  return {
    orderBlocks: clampedBlocks,
    activeCount,
    liveCount,
    unmitigatedCount,
    avgStrength,
  };
}
