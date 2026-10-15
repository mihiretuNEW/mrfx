/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HVN Profile Indicator (ATAS Market Profile by ProfitPro)
 * Implements High Volume Node (HVN) detection, Point of Control (POC),
 * Volume Profile silhouettes, and forward-projected Amber/Gold reaction zones.
 */

import { Candle } from '../types';

export interface HvnBin {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  volume: number;
}

export interface HvnZone {
  id: string;
  price: number; // Center POC / HVN price
  priceTop: number;
  priceBottom: number;
  startBarIndex: number;
  endBarIndex: number; // Extended end bar index (mitigation or chart edge)
  isMitigated: boolean;
  mitigatedBarIndex: number | null;
  volume: number;
  isPoc: boolean;
}

export interface HvnSegment {
  id: string;
  startBarIndex: number;
  endBarIndex: number;
  startTime: number;
  endTime: number;
  minPrice: number;
  maxPrice: number;
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  maxBinVolume: number;
  totalVolume: number;
  bins: HvnBin[];
  zones: HvnZone[];
}

export interface HvnProfileResult {
  segments: HvnSegment[];
  allZones: HvnZone[];
}

export interface HvnProfileOptions {
  periodBars?: number; // Segment length in bars (default 60)
  numBins?: number; // Price bins per profile (default 40)
  zoneThicknessPct?: number; // Zone vertical tolerance in % of range (default 3.0)
  extensionMode?: 'Mitigation' | 'NextPeriod' | 'FullRight';
  mitigationType?: 'Touch' | 'Close';
  showSecondaryNodes?: boolean;
}

export function calculateHvnProfile(
  candles: Candle[],
  options: HvnProfileOptions = {}
): HvnProfileResult | null {
  if (!candles || candles.length < 10) return null;

  const periodBars = Math.max(15, Math.min(300, options.periodBars ?? 60));
  const numBins = Math.max(15, Math.min(100, options.numBins ?? 40));
  const zoneThicknessPct = Math.max(0.5, Math.min(10, options.zoneThicknessPct ?? 3.0)) / 100;
  const extensionMode = options.extensionMode ?? 'Mitigation';
  const mitigationType = options.mitigationType ?? 'Touch';
  const showSecondaryNodes = options.showSecondaryNodes ?? false;

  const totalCandles = candles.length;
  const segments: HvnSegment[] = [];
  const allZones: HvnZone[] = [];

  // Break historical candles into distinct chronological segments
  let segStart = 0;
  while (segStart < totalCandles) {
    const segEnd = Math.min(totalCandles - 1, segStart + periodBars - 1);
    const segCandles = candles.slice(segStart, segEnd + 1);

    if (segCandles.length >= 5) {
      let minPrice = Infinity;
      let maxPrice = -Infinity;

      for (let i = 0; i < segCandles.length; i++) {
        const c = segCandles[i];
        if (c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
      }

      const spread = Math.max(0.00001, maxPrice - minPrice);
      const binHeight = spread / numBins;
      const bins: HvnBin[] = [];

      for (let b = 0; b < numBins; b++) {
        const pLow = minPrice + b * binHeight;
        const pHigh = pLow + binHeight;
        bins.push({
          priceLow: pLow,
          priceHigh: pHigh,
          priceMid: (pLow + pHigh) / 2,
          volume: 0,
        });
      }

      // Distribute candle volume across intersecting price bins
      let segTotalVol = 0;
      for (let i = 0; i < segCandles.length; i++) {
        const c = segCandles[i];
        const candleSpread = Math.max(0.00001, c.high - c.low);
        const bodySpread = Math.abs(c.close - c.open);
        // Order-flow volume approximation based on price range + body activity
        const baseVol = (candleSpread / Math.max(0.0001, c.close)) * 10000 + bodySpread * 6000 + 150;
        segTotalVol += baseVol;

        // Distribute proportionally across touched bins with weight towards close/open body
        let touchedCount = 0;
        const touchedIndices: number[] = [];
        for (let b = 0; b < numBins; b++) {
          if (c.high >= bins[b].priceLow && c.low <= bins[b].priceHigh) {
            touchedCount++;
            touchedIndices.push(b);
          }
        }

        if (touchedCount > 0) {
          const bodyMin = Math.min(c.open, c.close);
          const bodyMax = Math.max(c.open, c.close);
          for (const idx of touchedIndices) {
            const b = bins[idx];
            // Give 2x weight if bin intersects candle body (high volume fair value zone)
            const inBody = b.priceHigh >= bodyMin && b.priceLow <= bodyMax;
            const weight = inBody ? 2.0 : 1.0;
            const allocated = (baseVol / touchedCount) * (weight / 1.5);
            b.volume += allocated;
          }
        }
      }

      // Find Point of Control (POC) - bin with highest accumulated volume
      let maxBinVolume = 0;
      let pocBinIndex = 0;
      for (let b = 0; b < numBins; b++) {
        if (bins[b].volume > maxBinVolume) {
          maxBinVolume = bins[b].volume;
          pocBinIndex = b;
        }
      }

      const pocPrice = bins[pocBinIndex] ? bins[pocBinIndex].priceMid : (minPrice + maxPrice) / 2;

      // Value Area Calculation (70% standard)
      const targetVaVol = segTotalVol * 0.7;
      let vaVol = bins[pocBinIndex] ? bins[pocBinIndex].volume : 0;
      let upIdx = pocBinIndex + 1;
      let downIdx = pocBinIndex - 1;
      let vahPrice = bins[pocBinIndex] ? bins[pocBinIndex].priceHigh : maxPrice;
      let valPrice = bins[pocBinIndex] ? bins[pocBinIndex].priceLow : minPrice;

      while (vaVol < targetVaVol && (upIdx < numBins || downIdx >= 0)) {
        const upVol = upIdx < numBins ? bins[upIdx].volume : -1;
        const downVol = downIdx >= 0 ? bins[downIdx].volume : -1;
        if (upVol >= downVol && upIdx < numBins) {
          vaVol += bins[upIdx].volume;
          vahPrice = bins[upIdx].priceHigh;
          upIdx++;
        } else if (downIdx >= 0) {
          vaVol += bins[downIdx].volume;
          valPrice = bins[downIdx].priceLow;
          downIdx--;
        } else if (upIdx < numBins) {
          vaVol += bins[upIdx].volume;
          vahPrice = bins[upIdx].priceHigh;
          upIdx++;
        } else {
          break;
        }
      }

      // Identify High Volume Nodes (HVNs)
      const hvnIndices: number[] = [pocBinIndex];

      if (showSecondaryNodes) {
        // Detect secondary local maxima with high volume concentration (> 65% of POC)
        for (let b = 1; b < numBins - 1; b++) {
          if (b !== pocBinIndex) {
            const v = bins[b].volume;
            if (v > bins[b - 1].volume && v > bins[b + 1].volume && v >= maxBinVolume * 0.65) {
              // Ensure reasonable distance from existing nodes
              const tooClose = hvnIndices.some((existing) => Math.abs(existing - b) <= 2);
              if (!tooClose) {
                hvnIndices.push(b);
              }
            }
          }
        }
      }

      const segZones: HvnZone[] = [];
      const halfZoneThickness = (spread * zoneThicknessPct) / 2;

      for (const hIndex of hvnIndices) {
        const bin = bins[hIndex];
        const isPoc = hIndex === pocBinIndex;
        const centerPrice = bin.priceMid;
        const priceTop = centerPrice + halfZoneThickness;
        const priceBottom = centerPrice - halfZoneThickness;

        // Project zone forward
        let endBarIndex = totalCandles - 1;
        let isMitigated = false;
        let mitigatedBarIndex: number | null = null;

        if (extensionMode === 'NextPeriod') {
          endBarIndex = Math.min(totalCandles - 1, segEnd + periodBars);
        } else if (extensionMode === 'Mitigation') {
          // Check subsequent candles beyond segment for price retest / mitigation
          for (let cIdx = segEnd + 1; cIdx < totalCandles; cIdx++) {
            const cand = candles[cIdx];
            const isTouch = cand.high >= priceBottom && cand.low <= priceTop;
            const isClose = cand.close >= priceBottom && cand.close <= priceTop;
            const triggered = mitigationType === 'Touch' ? isTouch : isClose;

            if (triggered) {
              isMitigated = true;
              mitigatedBarIndex = cIdx;
              endBarIndex = cIdx;
              break;
            }
          }
        } else {
          // FullRight mode
          endBarIndex = totalCandles - 1;
        }

        const zone: HvnZone = {
          id: `hvn-${segStart}-${hIndex}`,
          price: centerPrice,
          priceTop,
          priceBottom,
          startBarIndex: segStart,
          endBarIndex,
          isMitigated,
          mitigatedBarIndex,
          volume: bin.volume,
          isPoc,
        };

        segZones.push(zone);
        allZones.push(zone);
      }

      segments.push({
        id: `hvn-seg-${segStart}`,
        startBarIndex: segStart,
        endBarIndex: segEnd,
        startTime: segCandles[0].time,
        endTime: segCandles[segCandles.length - 1].time,
        minPrice,
        maxPrice,
        pocPrice,
        vahPrice,
        valPrice,
        maxBinVolume: Math.max(1, maxBinVolume),
        totalVolume: Math.max(1, segTotalVol),
        bins,
        zones: segZones,
      });
    }

    segStart += periodBars;
  }

  return {
    segments,
    allZones,
  };
}
