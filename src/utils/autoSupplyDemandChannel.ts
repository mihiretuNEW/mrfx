/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../types';

export interface SupplyDemandZone {
  id: string;
  type: 'SUPPLY' | 'DEMAND';
  topPrice: number;
  bottomPrice: number;
  startBarIndex: number;
  endBarIndex: number | null; // null if unmitigated & extending to active edge
  isMitigated: boolean;
  label: string;
  isImpulse?: boolean;
}

export interface ParallelTrendChannel {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  slope: number;
  upperIntercept: number;
  lowerIntercept: number;
  upperStartPrice: number;
  upperEndPrice: number;
  lowerStartPrice: number;
  lowerEndPrice: number;
  futureBarCount: number;
  upperFuturePrice: number;
  lowerFuturePrice: number;
  trendDir: 'UP' | 'DOWN' | 'SIDEWAYS';
}

export interface FvgProjectionBlock {
  id: string;
  isBullish: boolean;
  topPrice: number;
  bottomPrice: number;
  startIndex: number;
  endIndex: number | null; // null if unmitigated
  isFilled: boolean;
  isVeryStrong: boolean; // Flag indicating if this FVG is very very strong (extends long)
  strengthScore: number; // 0-100 score based on displacement and gap size
  label: string;
  gapPct: number;
}

export interface AutoSupplyDemandChannelResult {
  supplyZones: SupplyDemandZone[];
  demandZones: SupplyDemandZone[];
  channel: ParallelTrendChannel | null;
  fvgProjections: FvgProjectionBlock[];
}

/**
 * Auto-detects Institutional Supply/Demand Zones, Parallel Trend Channels, and Right-Hand Projection Gaps.
 * Optimized for Live Trading: Fast impulse OB detection, live channel projection, and clean noise-free FVGs.
 */
export function calculateAutoSupplyDemandChannel(
  candles: Candle[],
  options?: {
    pivotLength?: number;
    maxZones?: number;
    channelWindow?: number;
  }
): AutoSupplyDemandChannelResult | null {
  if (!candles || !Array.isArray(candles) || candles.length < 15) {
    return null;
  }

  const pivotLength = options?.pivotLength ?? 5;
  const maxZones = options?.maxZones ?? 3;
  const channelWindow = Math.min(candles.length - 1, options?.channelWindow ?? 80);

  // Compute Average Candle Body & Range for noise filtering
  const recentWindow = Math.min(candles.length, 50);
  let totalBody = 0;
  for (let i = candles.length - recentWindow; i < candles.length; i++) {
    const c = candles[i];
    totalBody += Math.abs(c.close - c.open);
  }
  const avgBody = totalBody / recentWindow || (candles[candles.length - 1].close * 0.002);
  const lastPrice = candles[candles.length - 1].close;

  // -------------------------------------------------------------
  // 1. AUTO SUPPLY & DEMAND ZONES (FULL HISTORICAL ACROSS PAST + PRESENT)
  // -------------------------------------------------------------
  const supplyZones: SupplyDemandZone[] = [];
  const demandZones: SupplyDemandZone[] = [];

  // A) True Institutional Order Blocks (Requires Break of Structure [BOS] across full history)
  for (let i = 10; i < candles.length - 1; i++) {
    const curr = candles[i];
    const body = Math.abs(curr.close - curr.open);

    if (body < 1.6 * avgBody) continue; // Require strong expansion

    // Check Break of Structure (BOS) over preceding 7 candles
    const checkRange = Math.min(i, 7);
    let prevMaxHigh = -Infinity;
    let prevMinLow = Infinity;
    for (let k = 1; k <= checkRange; k++) {
      if (candles[i - k].high > prevMaxHigh) prevMaxHigh = candles[i - k].high;
      if (candles[i - k].low < prevMinLow) prevMinLow = candles[i - k].low;
    }

    // Bullish BOS -> Institutional Demand Zone
    if (curr.close > curr.open && curr.close > prevMaxHigh) {
      let baseIdx = i - 1;
      for (let b = i - 1; b >= Math.max(0, i - 4); b--) {
        if (candles[b].close <= candles[b].open) {
          baseIdx = b;
          break;
        }
      }
      const baseCandle = candles[baseIdx];
      const topPrice = Math.max(baseCandle.open, baseCandle.close);
      const bottomPrice = baseCandle.low;

      if (topPrice > bottomPrice && (topPrice - bottomPrice) >= avgBody * 0.25) {
        let isMitigated = false;
        let endBarIndex: number | null = null;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].low <= bottomPrice) {
            isMitigated = true;
            endBarIndex = k;
            break;
          }
        }
        demandZones.push({
          id: `bos_dem_${i}`,
          type: 'DEMAND',
          topPrice,
          bottomPrice,
          startBarIndex: baseIdx,
          endBarIndex,
          isMitigated,
          label: isMitigated ? 'DEMAND (MITIGATED)' : 'DEMAND ZONE (BOS)',
          isImpulse: true,
        });
      }
    }

    // Bearish BOS -> Institutional Supply Zone
    if (curr.close < curr.open && curr.close < prevMinLow) {
      let baseIdx = i - 1;
      for (let b = i - 1; b >= Math.max(0, i - 4); b--) {
        if (candles[b].close >= candles[b].open) {
          baseIdx = b;
          break;
        }
      }
      const baseCandle = candles[baseIdx];
      const topPrice = baseCandle.high;
      const bottomPrice = Math.min(baseCandle.open, baseCandle.close);

      if (topPrice > bottomPrice && (topPrice - bottomPrice) >= avgBody * 0.25) {
        let isMitigated = false;
        let endBarIndex: number | null = null;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].high >= topPrice) {
            isMitigated = true;
            endBarIndex = k;
            break;
          }
        }
        supplyZones.push({
          id: `bos_sup_${i}`,
          type: 'SUPPLY',
          topPrice,
          bottomPrice,
          startBarIndex: baseIdx,
          endBarIndex,
          isMitigated,
          label: isMitigated ? 'SUPPLY (MITIGATED)' : 'SUPPLY ZONE (BOS)',
          isImpulse: true,
        });
      }
    }
  }

  // B) Major Swing Pivot Order Blocks Across Full History
  const majorPivotLen = 6;
  for (let i = majorPivotLen; i < candles.length - majorPivotLen; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - majorPivotLen; j <= i + majorPivotLen; j++) {
      if (j === i) continue;
      if (candles[j].high > c.high) isHigh = false;
      if (candles[j].low < c.low) isLow = false;
    }

    if (isHigh) {
      const topPrice = c.high;
      const bodyMax = Math.max(c.open, c.close);
      const bottomPrice = Math.min(topPrice, bodyMax > 0 ? bodyMax : topPrice * 0.995);

      let isMitigated = false;
      let endBarIndex: number | null = null;
      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].high >= topPrice) {
          isMitigated = true;
          endBarIndex = k;
          break;
        }
      }

      supplyZones.push({
        id: `piv_sup_${i}`,
        type: 'SUPPLY',
        topPrice,
        bottomPrice,
        startBarIndex: i,
        endBarIndex,
        isMitigated,
        label: isMitigated ? 'SUPPLY (MITIGATED)' : 'KEY SUPPLY ZONE',
      });
    }

    if (isLow) {
      const bottomPrice = c.low;
      const bodyMin = Math.min(c.open, c.close);
      const topPrice = Math.max(bottomPrice, bodyMin > 0 ? bodyMin : bottomPrice * 1.005);

      let isMitigated = false;
      let endBarIndex: number | null = null;
      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].low <= bottomPrice) {
          isMitigated = true;
          endBarIndex = k;
          break;
        }
      }

      demandZones.push({
        id: `piv_dem_${i}`,
        type: 'DEMAND',
        topPrice,
        bottomPrice,
        startBarIndex: i,
        endBarIndex,
        isMitigated,
        label: isMitigated ? 'DEMAND (MITIGATED)' : 'KEY DEMAND ZONE',
      });
    }
  }

  // Deduplicate and filter: Keep active unmitigated zones + historical mitigated zones
  const filterZones = (zones: SupplyDemandZone[]) => {
    const sorted = [...zones].sort((a, b) => b.startBarIndex - a.startBarIndex);
    const unmitigated: SupplyDemandZone[] = [];
    const mitigated: SupplyDemandZone[] = [];

    for (const z of sorted) {
      if (!z.isMitigated) {
        const overlaps = unmitigated.some(e =>
          Math.max(z.bottomPrice, e.bottomPrice) < Math.min(z.topPrice, e.topPrice)
        );
        if (!overlaps && unmitigated.length < 10) {
          unmitigated.push(z);
        }
      } else {
        const overlaps = mitigated.some(e =>
          Math.max(z.bottomPrice, e.bottomPrice) < Math.min(z.topPrice, e.topPrice) &&
          Math.abs(z.startBarIndex - e.startBarIndex) < 12
        );
        if (!overlaps && mitigated.length < 20) {
          mitigated.push(z);
        }
      }
    }
    return [...unmitigated, ...mitigated];
  };

  const activeSupply = filterZones(supplyZones);
  const activeDemand = filterZones(demandZones);

  // -------------------------------------------------------------
  // 2. AUTO PARALLEL TREND CHANNEL (LIVE PROJECTED)
  // -------------------------------------------------------------
  let channel: ParallelTrendChannel | null = null;

  if (candles.length >= 20) {
    const startIndex = Math.max(0, candles.length - channelWindow);
    const endIndex = candles.length - 1;
    const n = endIndex - startIndex + 1;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const idx = startIndex + i;
      const x = i;
      const y = (candles[idx].high + candles[idx].low) / 2;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);

    const upperDiffs: number[] = [];
    const lowerDiffs: number[] = [];

    for (let i = 0; i < n; i++) {
      const idx = startIndex + i;
      const x = i;
      const expectedY = slope * x;
      upperDiffs.push(candles[idx].high - expectedY);
      lowerDiffs.push(candles[idx].low - expectedY);
    }

    upperDiffs.sort((a, b) => a - b);
    lowerDiffs.sort((a, b) => a - b);

    const uIdx = Math.floor(upperDiffs.length * 0.92);
    const lIdx = Math.floor(lowerDiffs.length * 0.08);

    const upperIntercept = upperDiffs[uIdx] ?? Math.max(...upperDiffs);
    const lowerIntercept = lowerDiffs[lIdx] ?? Math.min(...lowerDiffs);

    const upperStartPrice = slope * 0 + upperIntercept;
    const upperEndPrice = slope * (n - 1) + upperIntercept;
    const lowerStartPrice = slope * 0 + lowerIntercept;
    const lowerEndPrice = slope * (n - 1) + lowerIntercept;

    const futureBarCount = 30; // Project 30 bars into the future for live trading
    const upperFuturePrice = slope * (n - 1 + futureBarCount) + upperIntercept;
    const lowerFuturePrice = slope * (n - 1 + futureBarCount) + lowerIntercept;

    const priceSpan = Math.abs(upperEndPrice - upperStartPrice);
    const avgP = (upperStartPrice + lowerStartPrice) / 2;
    const movePct = (priceSpan / avgP) * 100;

    let trendDir: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    if (slope > 0 && movePct > 0.4) trendDir = 'UP';
    else if (slope < 0 && movePct > 0.4) trendDir = 'DOWN';

    channel = {
      startIndex,
      endIndex,
      startTime: candles[startIndex].time,
      endTime: candles[endIndex].time,
      slope,
      upperIntercept,
      lowerIntercept,
      upperStartPrice,
      upperEndPrice,
      lowerStartPrice,
      lowerEndPrice,
      futureBarCount,
      upperFuturePrice,
      lowerFuturePrice,
      trendDir,
    };
  }

  // -------------------------------------------------------------
  // 3. NOISE-FREE FVG PROJECTIONS (ONE-TIME BLOCKS & STRONG EXTENDED FVGs)
  // -------------------------------------------------------------
  const fvgProjections: FvgProjectionBlock[] = [];
  const minFvgGapSize = Math.max(avgBody * 0.35, lastPrice * 0.0004);

  for (let i = 2; i < candles.length - 1; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // Imbalance / impulse middle candle
    const c3 = candles[i];

    const body2 = Math.abs(c2.close - c2.open);
    const bodyRatio = body2 / Math.max(0.00001, avgBody);

    // Bullish FVG (Gap formed below candle 3: c3.low > c1.high)
    if (c3.low > c1.high) {
      const topPrice = c3.low;
      const bottomPrice = c1.high;
      const gap = topPrice - bottomPrice;
      const gapRatio = gap / Math.max(0.00001, avgBody);
      const gapPct = (gap / lastPrice) * 100;

      if (gap >= minFvgGapSize) {
        let isFilled = false;
        let endIndex: number | null = null;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].low <= bottomPrice) {
            isFilled = true;
            endIndex = k;
            break;
          }
        }

        // Determine if FVG is "Very Very Strong":
        // 1. Massive price gap >= 1.65x average candle body, OR
        // 2. High impulse displacement candle (bodyRatio >= 2.0) with strong gap >= 1.1x avgBody, OR
        // 3. Significant percent gap expansion >= 0.30%
        const isVeryStrong = gapRatio >= 1.65 || (gapRatio >= 1.1 && bodyRatio >= 2.0) || gapPct >= 0.30;
        const strengthScore = Math.min(100, Math.round(gapRatio * 35 + bodyRatio * 25));

        let label: string;
        if (isVeryStrong) {
          label = isFilled ? '★ STRONG FVG (FILLED)' : '★ STRONG FVG (BUY)';
        } else {
          label = isFilled ? 'FVG (FILLED)' : 'FVG (BUY)';
        }

        fvgProjections.push({
          id: `fvg_bull_${i}`,
          isBullish: true,
          topPrice,
          bottomPrice,
          startIndex: i,
          endIndex,
          isFilled,
          isVeryStrong,
          strengthScore,
          label,
          gapPct,
        });
      }
    }

    // Bearish FVG (Gap formed above candle 3: c3.high < c1.low)
    if (c3.high < c1.low) {
      const topPrice = c1.low;
      const bottomPrice = c3.high;
      const gap = topPrice - bottomPrice;
      const gapRatio = gap / Math.max(0.00001, avgBody);
      const gapPct = (gap / lastPrice) * 100;

      if (gap >= minFvgGapSize) {
        let isFilled = false;
        let endIndex: number | null = null;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].high >= topPrice) {
            isFilled = true;
            endIndex = k;
            break;
          }
        }

        // Determine if FVG is "Very Very Strong":
        const isVeryStrong = gapRatio >= 1.65 || (gapRatio >= 1.1 && bodyRatio >= 2.0) || gapPct >= 0.30;
        const strengthScore = Math.min(100, Math.round(gapRatio * 35 + bodyRatio * 25));

        let label: string;
        if (isVeryStrong) {
          label = isFilled ? '★ STRONG FVG (FILLED)' : '★ STRONG FVG (SELL)';
        } else {
          label = isFilled ? 'FVG (FILLED)' : 'FVG (SELL)';
        }

        fvgProjections.push({
          id: `fvg_bear_${i}`,
          isBullish: false,
          topPrice,
          bottomPrice,
          startIndex: i,
          endIndex,
          isFilled,
          isVeryStrong,
          strengthScore,
          label,
          gapPct,
        });
      }
    }
  }

  // Collect open unmitigated FVGs + major historical FVGs across history
  const unmitigatedFvgs = fvgProjections.filter(f => !f.isFilled);
  const filledFvgs = fvgProjections.filter(f => f.isFilled).slice(-35); // Keep recent filled FVGs for historical timeline

  const allFvgs = [...unmitigatedFvgs, ...filledFvgs];

  return {
    supplyZones: activeSupply,
    demandZones: activeDemand,
    channel,
    fvgProjections: allFvgs,
  };
}

