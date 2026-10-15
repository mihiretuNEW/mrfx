import {
  Candle,
  NexusTradingMode,
  NexusSignalFilter,
  NexusEntryMode,
  NexusStopLossMode,
  NexusSwingPoint,
  NexusStructureBreak,
  NexusOrderBlock,
  NexusFVG,
  NexusLiquidityPool,
  NexusTrendline,
  NexusSRLevel,
  NexusKeyLevels,
  NexusSessionWindow,
  NexusPulseData,
  NexusTemporalMemoryData,
  NexusMTFData,
  NexusSignal,
  NexusResults,
  ChartSettings,
} from '../types';

/**
 * Standard True Range and ATR Calculation
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(0);
  if (candles.length === 0) return atr;

  const tr: number[] = new Array(candles.length).fill(0);
  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }

  // Initial SMA of TR
  let sum = 0;
  const initPeriod = Math.min(period, candles.length);
  for (let i = 0; i < initPeriod; i++) {
    sum += tr[i];
  }
  let currentAtr = sum / initPeriod;
  atr[initPeriod - 1] = currentAtr;

  // Wilder's Smoothed ATR
  for (let i = initPeriod; i < candles.length; i++) {
    currentAtr = (currentAtr * (period - 1) + tr[i]) / period;
    atr[i] = currentAtr;
  }

  // Backfill early bars
  for (let i = 0; i < initPeriod - 1; i++) {
    atr[i] = atr[initPeriod - 1];
  }

  return atr;
}

/**
 * Exponential Moving Average
 */
function calculateEMA(values: number[], period: number): number[] {
  const ema: number[] = new Array(values.length).fill(0);
  if (values.length === 0) return ema;

  const k = 2 / (period + 1);
  let sum = 0;
  const initCount = Math.min(period, values.length);
  for (let i = 0; i < initCount; i++) {
    sum += values[i];
  }
  let prevEma = sum / initCount;
  ema[initCount - 1] = prevEma;

  for (let i = initCount; i < values.length; i++) {
    prevEma = values[i] * k + prevEma * (1 - k);
    ema[i] = prevEma;
  }

  for (let i = 0; i < initCount - 1; i++) {
    ema[i] = ema[initCount - 1];
  }

  return ema;
}

/**
 * Detect whether volume data is genuinely available
 */
export function detectVolumeAvailability(candles: Candle[]): boolean {
  if (candles.length < 20) return false;
  const sample = candles.slice(0, 20);
  let zeroOrOneCount = 0;
  for (const c of sample) {
    if (!c.volume || c.volume <= 1) {
      zeroOrOneCount++;
    }
  }
  return zeroOrOneCount < 15;
}

/**
 * Determine Pivot Sensitivity based on Trading Mode and Timeframe
 */
function getPivotSensitivities(
  mode: NexusTradingMode,
  timeframe: string
): { externalLen: number; internalLen: number } {
  if (mode === 'SCALPER') return { externalLen: 5, internalLen: 3 };
  if (mode === 'SWING') return { externalLen: 15, internalLen: 7 };
  if (mode === 'POSITION') return { externalLen: 30, internalLen: 12 };

  // AUTO mode
  const tf = timeframe.toUpperCase();
  if (tf.includes('1M') || tf.includes('3M') || tf.includes('5M')) {
    return { externalLen: 5, internalLen: 3 };
  }
  if (tf.includes('15M') || tf.includes('30M')) {
    return { externalLen: 8, internalLen: 4 };
  }
  if (tf.includes('1H') || tf.includes('2H') || tf.includes('4H')) {
    return { externalLen: 12, internalLen: 6 };
  }
  if (tf.includes('1D') || tf.includes('D') || tf.includes('W')) {
    return { externalLen: 18, internalLen: 8 };
  }
  return { externalLen: 8, internalLen: 4 };
}

/**
 * Main NEXUS SMART MONEY SUITE Engine
 */
export function evaluateNexusSuite(
  candles: Candle[],
  timeframe: string = '5M',
  settings: Partial<ChartSettings['indicators']> = {}
): NexusResults | null {
  const n = candles.length;
  if (n < 25) return null;

  const mode: NexusTradingMode = settings.nexusTradingMode ?? 'AUTO';
  const signalFilter: NexusSignalFilter = settings.nexusSignalFilter ?? 'A_PLUS_AND_A';
  const entryMode: NexusEntryMode = settings.nexusEntryMode ?? 'BOTH';
  const slMode: NexusStopLossMode = settings.nexusStopLossMode ?? 'ATR';
  const atrMultiplierSL = settings.nexusAtrMultiplierSL ?? 2.0;

  const { externalLen, internalLen } = getPivotSensitivities(mode, timeframe);
  const atr = calculateATR(candles, 14);
  const hasVolume = detectVolumeAvailability(candles);

  // -------------------------------------------------------------
  // 1. SWINGS & MARKET STRUCTURE ENGINE (HH, HL, LH, LL, BOS, CHoCH, SMS)
  // -------------------------------------------------------------
  const swings: NexusSwingPoint[] = [];
  const internalSwings: NexusSwingPoint[] = [];

  // External pivots
  for (let i = externalLen; i < n - externalLen; i++) {
    const curHigh = candles[i].high;
    const curLow = candles[i].low;

    let isHigh = true;
    let isLow = true;

    for (let k = 1; k <= externalLen; k++) {
      if (candles[i - k].high >= curHigh || candles[i + k].high > curHigh) isHigh = false;
      if (candles[i - k].low <= curLow || candles[i + k].low < curLow) isLow = false;
    }

    if (isHigh) {
      const prevHigh = swings.filter((s) => s.type === 'HH' || s.type === 'LH').slice(-1)[0];
      const type = prevHigh ? (curHigh >= prevHigh.price ? 'HH' : 'LH') : 'HH';
      swings.push({ index: i, time: candles[i].time, price: curHigh, type });
    } else if (isLow) {
      const prevLow = swings.filter((s) => s.type === 'HL' || s.type === 'LL').slice(-1)[0];
      const type = prevLow ? (curLow >= prevLow.price ? 'HL' : 'LL') : 'LL';
      swings.push({ index: i, time: candles[i].time, price: curLow, type });
    }
  }

  // Internal pivots for SMS
  for (let i = internalLen; i < n - internalLen; i++) {
    const curHigh = candles[i].high;
    const curLow = candles[i].low;
    let isHigh = true;
    let isLow = true;

    for (let k = 1; k <= internalLen; k++) {
      if (candles[i - k].high >= curHigh || candles[i + k].high > curHigh) isHigh = false;
      if (candles[i - k].low <= curLow || candles[i + k].low < curLow) isLow = false;
    }

    if (isHigh) {
      const prevHigh = internalSwings.filter((s) => s.type === 'HH' || s.type === 'LH').slice(-1)[0];
      const type = prevHigh ? (curHigh >= prevHigh.price ? 'HH' : 'LH') : 'HH';
      internalSwings.push({ index: i, time: candles[i].time, price: curHigh, type });
    } else if (isLow) {
      const prevLow = internalSwings.filter((s) => s.type === 'HL' || s.type === 'LL').slice(-1)[0];
      const type = prevLow ? (curLow >= prevLow.price ? 'HL' : 'LL') : 'LL';
      internalSwings.push({ index: i, time: candles[i].time, price: curLow, type });
    }
  }

  // Detect Structure Breaks (BOS, CHoCH, SMS)
  const structureBreaks: NexusStructureBreak[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  const barTrends: Array<'BULLISH' | 'BEARISH' | 'NEUTRAL'> = new Array(n).fill('NEUTRAL');

  for (let i = 10; i < n; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];

    // Relevant past swing highs and lows before candle i
    const pastHighs = swings.filter((s) => s.index < i - 1 && (s.type === 'HH' || s.type === 'LH'));
    const pastLows = swings.filter((s) => s.index < i - 1 && (s.type === 'HL' || s.type === 'LL'));

    const lastHigh = pastHighs.length > 0 ? pastHighs[pastHighs.length - 1] : null;
    const lastLow = pastLows.length > 0 ? pastLows[pastLows.length - 1] : null;

    // Bullish Breakout
    if (lastHigh && prevC.close <= lastHigh.price && c.close > lastHigh.price) {
      const isReversal = currentTrend === 'BEARISH';
      const breakType = isReversal ? 'CHoCH' : 'BOS';
      currentTrend = 'BULLISH';
      structureBreaks.push({
        id: `break-${i}-${breakType}-bull`,
        type: breakType,
        direction: 'BULLISH',
        startIndex: lastHigh.index,
        breakIndex: i,
        time: c.time,
        price: c.close,
        level: lastHigh.price,
        confirmed: true,
      });
    }

    // Bearish Breakout
    if (lastLow && prevC.close >= lastLow.price && c.close < lastLow.price) {
      const isReversal = currentTrend === 'BULLISH';
      const breakType = isReversal ? 'CHoCH' : 'BOS';
      currentTrend = 'BEARISH';
      structureBreaks.push({
        id: `break-${i}-${breakType}-bear`,
        type: breakType,
        direction: 'BEARISH',
        startIndex: lastLow.index,
        breakIndex: i,
        time: c.time,
        price: c.close,
        level: lastLow.price,
        confirmed: true,
      });
    }

    barTrends[i] = currentTrend;

    // Internal SMS (Shift in Market Structure)
    const pastIntHighs = internalSwings.filter((s) => s.index < i - 1 && (s.type === 'HH' || s.type === 'LH'));
    const pastIntLows = internalSwings.filter((s) => s.index < i - 1 && (s.type === 'HL' || s.type === 'LL'));
    const lastIntHigh = pastIntHighs.length > 0 ? pastIntHighs[pastIntHighs.length - 1] : null;
    const lastIntLow = pastIntLows.length > 0 ? pastIntLows[pastIntLows.length - 1] : null;

    if (currentTrend === 'BEARISH' && lastIntHigh && prevC.close <= lastIntHigh.price && c.close > lastIntHigh.price) {
      // Internal bullish shift
      if (!structureBreaks.some((sb) => Math.abs(sb.breakIndex - i) < 3)) {
        structureBreaks.push({
          id: `sms-${i}-bull`,
          type: 'SMS',
          direction: 'BULLISH',
          startIndex: lastIntHigh.index,
          breakIndex: i,
          time: c.time,
          price: c.close,
          level: lastIntHigh.price,
          confirmed: true,
        });
      }
    } else if (currentTrend === 'BULLISH' && lastIntLow && prevC.close >= lastIntLow.price && c.close < lastIntLow.price) {
      // Internal bearish shift
      if (!structureBreaks.some((sb) => Math.abs(sb.breakIndex - i) < 3)) {
        structureBreaks.push({
          id: `sms-${i}-bear`,
          type: 'SMS',
          direction: 'BEARISH',
          startIndex: lastIntLow.index,
          breakIndex: i,
          time: c.time,
          price: c.close,
          level: lastIntLow.price,
          confirmed: true,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 2. PREMIUM, DISCOUNT, AND EQUILIBRIUM (25% Premium, 25% Discount, 50% Eq)
  // -------------------------------------------------------------
  const lookbackRangeBars = Math.min(120, n);
  const rangeSlice = candles.slice(n - lookbackRangeBars);
  const premiumHigh = Math.max(...rangeSlice.map((c) => c.high));
  const discountLow = Math.min(...rangeSlice.map((c) => c.low));
  const fullSpan = Math.max(0.0001, premiumHigh - discountLow);

  const equilibriumPrice = discountLow + fullSpan * 0.5;
  const currentPrice = candles[n - 1].close;

  let currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' = 'EQUILIBRIUM';
  if (currentPrice >= discountLow + fullSpan * 0.75) {
    currentZone = 'PREMIUM';
  } else if (currentPrice <= discountLow + fullSpan * 0.25) {
    currentZone = 'DISCOUNT';
  }

  // -------------------------------------------------------------
  // 3. ORDER BLOCK DETECTION AND SCORING (1 to 5) + BREAKER CONVERSION
  // -------------------------------------------------------------
  const orderBlocks: NexusOrderBlock[] = [];

  for (const sb of structureBreaks) {
    if (sb.type === 'SMS') continue; // OBs created from confirmed BOS and CHoCH
    const breakIdx = sb.breakIndex;
    const curAtr = atr[breakIdx] || atr[atr.length - 1];

    // Measure displacement
    const lookbackOrigin = Math.max(0, breakIdx - 12);
    let originCandleIdx = -1;

    if (sb.direction === 'BULLISH') {
      // Search backward for last bearish candle
      for (let j = breakIdx - 1; j >= lookbackOrigin; j--) {
        if (candles[j].close < candles[j].open) {
          originCandleIdx = j;
          break;
        }
      }
    } else {
      // Search backward for last bullish candle
      for (let j = breakIdx - 1; j >= lookbackOrigin; j--) {
        if (candles[j].close > candles[j].open) {
          originCandleIdx = j;
          break;
        }
      }
    }

    if (originCandleIdx === -1) originCandleIdx = Math.max(0, breakIdx - 2);

    const originCandle = candles[originCandleIdx];
    const originRange = originCandle.high - originCandle.low;
    const originBody = Math.abs(originCandle.close - originCandle.open);
    const bodyRatio = originRange > 0 ? originBody / originRange : 0.5;

    // Filter out indecision/doji (< 0.20 body ratio)
    if (bodyRatio < 0.2) continue;

    const displacementMove = Math.abs(candles[breakIdx].close - originCandle.close);
    const dispRatio = curAtr > 0 ? displacementMove / curAtr : 1.0;

    // Must exceed minimum displacement ratio (1.0x ATR)
    if (dispRatio < 0.8) continue;

    // Calculate quality score (1 to 5)
    let score = 1;
    if (dispRatio >= 1.5) score += 1;
    if (dispRatio >= 2.5) score += 1;

    // Volume or body confirmation
    if (hasVolume && originCandle.volume) {
      const avgVol =
        candles.slice(Math.max(0, originCandleIdx - 10), originCandleIdx).reduce((a, b) => a + (b.volume || 0), 0) / 10;
      if (originCandle.volume > avgVol * 1.3) score += 1;
    } else if (bodyRatio > 0.65) {
      score += 1;
    }

    // Zone positioning: Bullish in discount / Bearish in premium
    if (sb.direction === 'BULLISH' && originCandle.low <= discountLow + fullSpan * 0.4) {
      score += 1;
    } else if (sb.direction === 'BEARISH' && originCandle.high >= discountLow + fullSpan * 0.6) {
      score += 1;
    }

    score = Math.min(5, Math.max(1, score));

    const topPrice = originCandle.high;
    const bottomPrice = originCandle.low;

    // Check forward mitigation and breaker conversion
    let isMitigated = false;
    let mitigatedIndex: number | undefined;
    let isBreaker = false;

    for (let k = breakIdx + 1; k < n; k++) {
      const c = candles[k];
      if (sb.direction === 'BULLISH') {
        if (c.close < bottomPrice) {
          isMitigated = true;
          mitigatedIndex = k;
          isBreaker = true; // Converts to Bearish Breaker
          break;
        }
      } else {
        if (c.close > topPrice) {
          isMitigated = true;
          mitigatedIndex = k;
          isBreaker = true; // Converts to Bullish Breaker
          break;
        }
      }
    }

    orderBlocks.push({
      id: `ob-${originCandleIdx}-${sb.direction}`,
      type: sb.direction === 'BULLISH' ? 'BULL_OB' : 'BEAR_OB',
      originIndex: originCandleIdx,
      startIndex: originCandleIdx,
      endIndex: mitigatedIndex ?? n - 1,
      topPrice,
      bottomPrice,
      score,
      displacementRatio: dispRatio,
      isMitigated,
      mitigatedIndex,
      isBreaker,
    });
  }

  // -------------------------------------------------------------
  // 4. FAIR VALUE GAP (FVG) ENGINE & LIFECYCLE (CE 50%, Filled, iFVG)
  // -------------------------------------------------------------
  const fvgs: NexusFVG[] = [];

  for (let i = 2; i < n; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // Momentum candle
    const c3 = candles[i];
    const curAtr = atr[i] || atr[atr.length - 1];

    // Bullish FVG: Low of candle 3 is above High of candle 1
    if (c3.low > c1.high) {
      const gapHeight = c3.low - c1.high;
      if (gapHeight >= curAtr * 0.15) {
        const topPrice = c3.low;
        const bottomPrice = c1.high;
        const cePrice = (topPrice + bottomPrice) / 2;

        let isCeTouched = false;
        let isFilled = false;
        let filledIndex: number | undefined;
        let isInverted = false;
        let isTerminated = false;

        for (let k = i + 1; k < n; k++) {
          const testC = candles[k];
          if (testC.low <= cePrice && !isCeTouched) {
            isCeTouched = true;
          }
          if (testC.close < bottomPrice) {
            isFilled = true;
            filledIndex = k;
            isInverted = true; // Inverts into Bearish Resistance (iFVG)
            break;
          }
        }

        // If inverted, check if traded through again
        if (isInverted && filledIndex !== undefined) {
          for (let m = filledIndex + 1; m < n; m++) {
            if (candles[m].close > topPrice) {
              isTerminated = true;
              break;
            }
          }
        }

        fvgs.push({
          id: `fvg-${i}-bull`,
          type: 'BULL_FVG',
          startIndex: i,
          endIndex: filledIndex ?? n - 1,
          topPrice,
          bottomPrice,
          cePrice,
          isCeTouched,
          isFilled,
          filledIndex,
          isInverted,
          isTerminated,
        });
      }
    }

    // Bearish FVG: High of candle 3 is below Low of candle 1
    if (c3.high < c1.low) {
      const gapHeight = c1.low - c3.high;
      if (gapHeight >= curAtr * 0.15) {
        const topPrice = c1.low;
        const bottomPrice = c3.high;
        const cePrice = (topPrice + bottomPrice) / 2;

        let isCeTouched = false;
        let isFilled = false;
        let filledIndex: number | undefined;
        let isInverted = false;
        let isTerminated = false;

        for (let k = i + 1; k < n; k++) {
          const testC = candles[k];
          if (testC.high >= cePrice && !isCeTouched) {
            isCeTouched = true;
          }
          if (testC.close > topPrice) {
            isFilled = true;
            filledIndex = k;
            isInverted = true; // Inverts into Bullish Support (iFVG)
            break;
          }
        }

        if (isInverted && filledIndex !== undefined) {
          for (let m = filledIndex + 1; m < n; m++) {
            if (candles[m].close < bottomPrice) {
              isTerminated = true;
              break;
            }
          }
        }

        fvgs.push({
          id: `fvg-${i}-bear`,
          type: 'BEAR_FVG',
          startIndex: i,
          endIndex: filledIndex ?? n - 1,
          topPrice,
          bottomPrice,
          cePrice,
          isCeTouched,
          isFilled,
          filledIndex,
          isInverted,
          isTerminated,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 5. LIQUIDITY POOL AND SWEEP DETECTION (BSL x4, SSL x3, Sweeps)
  // -------------------------------------------------------------
  const liquidityPools: NexusLiquidityPool[] = [];
  const sweeps: Array<{ type: 'BSL' | 'SSL'; index: number; price: number; time: number }> = [];

  const highSwings = swings.filter((s) => s.type === 'HH' || s.type === 'LH');
  const lowSwings = swings.filter((s) => s.type === 'HL' || s.type === 'LL');

  // Cluster swing highs into BSL pools
  const clusteredHighs: NexusSwingPoint[][] = [];
  for (const s of highSwings) {
    let placed = false;
    for (const cluster of clusteredHighs) {
      const avg = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
      if (Math.abs(s.price - avg) / avg < 0.0035) {
        cluster.push(s);
        placed = true;
        break;
      }
    }
    if (!placed) clusteredHighs.push([s]);
  }

  for (const cluster of clusteredHighs) {
    if (cluster.length >= 2) {
      const avgPrice = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
      const latestIdx = Math.max(...cluster.map((c) => c.index));
      liquidityPools.push({
        id: `bsl-${latestIdx}`,
        type: 'BSL',
        price: avgPrice,
        touchCount: cluster.length,
        swingIndices: cluster.map((c) => c.index),
        isSwept: false,
      });
    }
  }

  // Cluster swing lows into SSL pools
  const clusteredLows: NexusSwingPoint[][] = [];
  for (const s of lowSwings) {
    let placed = false;
    for (const cluster of clusteredLows) {
      const avg = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
      if (Math.abs(s.price - avg) / avg < 0.0035) {
        cluster.push(s);
        placed = true;
        break;
      }
    }
    if (!placed) clusteredLows.push([s]);
  }

  for (const cluster of clusteredLows) {
    if (cluster.length >= 2) {
      const avgPrice = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
      const latestIdx = Math.max(...cluster.map((c) => c.index));
      liquidityPools.push({
        id: `ssl-${latestIdx}`,
        type: 'SSL',
        price: avgPrice,
        touchCount: cluster.length,
        swingIndices: cluster.map((c) => c.index),
        isSwept: false,
      });
    }
  }

  // Detect Sweeps (wick beyond level, but close remains back inside)
  let lastBslSweepIdx = -999;
  let lastSslSweepIdx = -999;

  for (const pool of liquidityPools) {
    const minStart = Math.max(...pool.swingIndices);
    for (let k = minStart + 1; k < n; k++) {
      const c = candles[k];
      if (pool.type === 'BSL') {
        if (c.high > pool.price && c.close < pool.price && k - lastBslSweepIdx > 8) {
          pool.isSwept = true;
          pool.sweepIndex = k;
          pool.sweepPrice = c.high;
          lastBslSweepIdx = k;
          sweeps.push({ type: 'BSL', index: k, price: c.high, time: c.time });
          break;
        }
      } else {
        if (c.low < pool.price && c.close > pool.price && k - lastSslSweepIdx > 8) {
          pool.isSwept = true;
          pool.sweepIndex = k;
          pool.sweepPrice = c.low;
          lastSslSweepIdx = k;
          sweeps.push({ type: 'SSL', index: k, price: c.low, time: c.time });
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 6. DENSITY-WEIGHTED S/R LEVELS WITH GLOW (Touch count scaling)
  // -------------------------------------------------------------
  const srLevels: NexusSRLevel[] = [];
  const allPivots = [...highSwings, ...lowSwings];
  const srClusters: NexusSwingPoint[][] = [];

  for (const p of allPivots) {
    let placed = false;
    for (const cl of srClusters) {
      const avg = cl.reduce((a, b) => a + b.price, 0) / cl.length;
      if (Math.abs(p.price - avg) / avg < 0.004) {
        cl.push(p);
        placed = true;
        break;
      }
    }
    if (!placed) srClusters.push([p]);
  }

  for (let idx = 0; idx < srClusters.length; idx++) {
    const cl = srClusters[idx];
    if (cl.length >= 2) {
      const avgPrice = cl.reduce((a, b) => a + b.price, 0) / cl.length;
      const type = avgPrice >= currentPrice ? 'RESISTANCE' : 'SUPPORT';
      const touches = cl.length;
      const glow = Math.min(1.0, 0.25 + touches * 0.15);
      const width = Math.min(4, 1 + Math.floor(touches / 2));
      srLevels.push({
        id: `sr-${idx}`,
        type,
        price: avgPrice,
        touchCount: touches,
        glowIntensity: glow,
        lineWidth: width,
      });
    }
  }

  // -------------------------------------------------------------
  // 7. VWAP WITH STANDARD DEVIATION BANDS
  // -------------------------------------------------------------
  let vwapResult: { vwap: number; upperBand1: number; lowerBand1: number } | undefined;
  if (!timeframe.toUpperCase().includes('D') && !timeframe.toUpperCase().includes('W')) {
    let cumVol = 0;
    let cumTypicalVol = 0;
    const vwapSlice = candles.slice(Math.max(0, n - 80));

    for (const c of vwapSlice) {
      const typical = (c.high + c.low + c.close) / 3;
      const vol = hasVolume && c.volume ? c.volume : 1;
      cumVol += vol;
      cumTypicalVol += typical * vol;
    }

    const currentVwap = cumVol > 0 ? cumTypicalVol / cumVol : currentPrice;
    const curAtr = atr[n - 1] || 1;
    vwapResult = {
      vwap: currentVwap,
      upperBand1: currentVwap + curAtr * 1.5,
      lowerBand1: currentVwap - curAtr * 1.5,
    };
  }

  // -------------------------------------------------------------
  // 8. KEY INSTITUTIONAL LEVELS (PDH, PDL, PDO, PWH, PWL)
  // -------------------------------------------------------------
  const keyLevels: NexusKeyLevels = {
    pdh: null,
    pdl: null,
    pdo: null,
    pwh: null,
    pwl: null,
  };

  // Group candles roughly by day / week based on timestamp
  if (candles.length > 30) {
    const dayBars = Math.min(candles.length, 48);
    const prevDaySlice = candles.slice(Math.max(0, candles.length - dayBars * 2), candles.length - dayBars);
    if (prevDaySlice.length > 5) {
      keyLevels.pdh = Math.max(...prevDaySlice.map((c) => c.high));
      keyLevels.pdl = Math.min(...prevDaySlice.map((c) => c.low));
      keyLevels.pdo = prevDaySlice[0].open;
    }

    const weekBars = Math.min(candles.length, 120);
    const prevWeekSlice = candles.slice(Math.max(0, candles.length - weekBars * 2), candles.length - weekBars);
    if (prevWeekSlice.length > 10) {
      keyLevels.pwh = Math.max(...prevWeekSlice.map((c) => c.high));
      keyLevels.pwl = Math.min(...prevWeekSlice.map((c) => c.low));
    }
  }

  // -------------------------------------------------------------
  // 9. SMART TRENDLINE ENGINE (Image 6 Specification: Active glow & extension, broken fades to gray with TL BREAK)
  // -------------------------------------------------------------
  const trendlines: NexusTrendline[] = [];

  // Ascending Trendlines (connecting higher lows)
  for (let i = lowSwings.length - 2; i >= 0; i--) {
    const p1 = lowSwings[i];
    const p2 = lowSwings[i + 1];
    if (p2.price > p1.price && p2.index - p1.index >= 4) {
      const slope = (p2.price - p1.price) / (p2.index - p1.index);
      let touches = 2;
      let isBroken = false;
      let breakIndex: number | undefined;

      for (let k = p2.index + 1; k < n; k++) {
        const expectedPrice = p1.price + slope * (k - p1.index);
        const c = candles[k];
        if (c.close < expectedPrice) {
          isBroken = true;
          breakIndex = k;
          break;
        } else if (Math.abs(c.low - expectedPrice) / expectedPrice < 0.0035) {
          touches++;
        }
      }

      trendlines.push({
        id: `tl-asc-${p1.index}`,
        type: 'ASCENDING',
        startIndex: p1.index,
        endIndex: breakIndex ?? n - 1,
        p1: { index: p1.index, price: p1.price },
        p2: { index: p2.index, price: p2.price },
        touchCount: touches,
        isBroken,
        breakIndex,
      });
      if (trendlines.filter((t) => t.type === 'ASCENDING').length >= 3) break;
    }
  }

  // Descending Trendlines (connecting lower highs)
  for (let i = highSwings.length - 2; i >= 0; i--) {
    const p1 = highSwings[i];
    const p2 = highSwings[i + 1];
    if (p2.price < p1.price && p2.index - p1.index >= 4) {
      const slope = (p2.price - p1.price) / (p2.index - p1.index);
      let touches = 2;
      let isBroken = false;
      let breakIndex: number | undefined;

      for (let k = p2.index + 1; k < n; k++) {
        const expectedPrice = p1.price + slope * (k - p1.index);
        const c = candles[k];
        if (c.close > expectedPrice) {
          isBroken = true;
          breakIndex = k;
          break;
        } else if (Math.abs(c.high - expectedPrice) / expectedPrice < 0.0035) {
          touches++;
        }
      }

      trendlines.push({
        id: `tl-desc-${p1.index}`,
        type: 'DESCENDING',
        startIndex: p1.index,
        endIndex: breakIndex ?? n - 1,
        p1: { index: p1.index, price: p1.price },
        p2: { index: p2.index, price: p2.price },
        touchCount: touches,
        isBroken,
        breakIndex,
      });
      if (trendlines.filter((t) => t.type === 'DESCENDING').length >= 3) break;
    }
  }

  // -------------------------------------------------------------
  // 10. SESSION AND KILL ZONE AWARENESS (Asia, London, New York)
  // -------------------------------------------------------------
  const sessions: NexusSessionWindow[] = [];
  const lastTimeMs = candles[n - 1].time * (candles[n - 1].time < 1e11 ? 1000 : 1);
  const curDate = new Date(lastTimeMs);
  const curUtcHour = curDate.getUTCHours();
  const curUtcMin = curDate.getUTCMinutes();
  const curDecHour = curUtcHour + curUtcMin / 60;

  let activeSessionName = 'None';
  let isKillZoneActive = false;

  // Check Asia (20:00 - 04:00 UTC)
  const isAsia = curDecHour >= 20 || curDecHour < 4;
  if (isAsia) activeSessionName = 'Asia';

  // Check London (07:00 - 16:00 UTC) & London Kill Zone (07:00 - 10:00 UTC)
  const isLondon = curDecHour >= 7 && curDecHour < 16;
  const isLondonKZ = curDecHour >= 7 && curDecHour < 10;
  if (isLondon) {
    activeSessionName = 'London';
    if (isLondonKZ) isKillZoneActive = true;
  }

  // Check New York (12:00 - 21:00 UTC) & NY Kill Zone (12:30 - 15:00 UTC)
  const isNY = curDecHour >= 12 && curDecHour < 21;
  const isNYKZ = curDecHour >= 12.5 && curDecHour < 15;
  if (isNY) {
    activeSessionName = isLondon ? 'London / NY' : 'New York';
    if (isNYKZ) isKillZoneActive = true;
  }

  // Create session box slice for the last 30 bars
  const sessionSlice = candles.slice(Math.max(0, n - 35));
  if (sessionSlice.length > 5) {
    sessions.push({
      name: isNY ? 'New York' : isLondon ? 'London' : 'Asia',
      killZoneName: isLondonKZ ? 'LDN KZ' : isNYKZ ? 'NY KZ' : undefined,
      isKillZone: isKillZoneActive,
      isActive: true,
      startIndex: Math.max(0, n - 30),
      endIndex: n - 1,
      high: Math.max(...sessionSlice.map((c) => c.high)),
      low: Math.min(...sessionSlice.map((c) => c.low)),
      openPrice: sessionSlice[0].open,
    });
  }

  // -------------------------------------------------------------
  // 11. NEXUS PULSE (COMPOSITE MOMENTUM MECHANICS)
  // -------------------------------------------------------------
  // 1. Displacement Index
  const closes = candles.map((c) => c.close);
  const emaFast = calculateEMA(closes, 8);
  const emaSlow = calculateEMA(closes, 21);
  const diffPct = closes.map((c, i) => (emaSlow[i] > 0 ? ((emaFast[i] - emaSlow[i]) / emaSlow[i]) * 1000 : 0));
  const displacementIndex = diffPct[diffPct.length - 1];

  // 2. Absorption Score
  const recentCandle = candles[n - 1];
  const recentRange = recentCandle.high - recentCandle.low;
  const recentBody = Math.abs(recentCandle.close - recentCandle.open);
  let absorptionScore = 0;
  if (recentRange > 0 && recentBody / recentRange < 0.35) {
    absorptionScore = 20; // Absorption in progress
  }

  // 3. Structure Velocity
  const recentSwings = swings.slice(-6);
  const bullSwings = recentSwings.filter((s) => s.type === 'HH' || s.type === 'HL').length;
  const bearSwings = recentSwings.filter((s) => s.type === 'LH' || s.type === 'LL').length;
  const structureVelocity = recentSwings.length > 0 ? ((bullSwings - bearSwings) / recentSwings.length) * 40 : 0;

  // 4. Liquidity Gradient
  const unsweptBSL = liquidityPools.filter((p) => p.type === 'BSL' && !p.isSwept && p.price > currentPrice).length;
  const unsweptSSL = liquidityPools.filter((p) => p.type === 'SSL' && !p.isSwept && p.price < currentPrice).length;
  const totalUnswept = unsweptBSL + unsweptSSL;
  const liquidityGradient = totalUnswept > 0 ? ((unsweptBSL - unsweptSSL) / totalUnswept) * 30 : 0;

  // Composite Pulse (-100 to +100)
  const rawComposite = displacementIndex * 1.5 + structureVelocity + liquidityGradient - (currentTrend === 'BULLISH' ? -absorptionScore : absorptionScore);
  const compositeScore = Number(Math.max(-100, Math.min(100, rawComposite)).toFixed(1));

  let pulseState: 'Strong Bull' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bear' = 'Neutral';
  if (compositeScore >= 30) pulseState = 'Strong Bull';
  else if (compositeScore >= 10) pulseState = 'Bullish';
  else if (compositeScore <= -30) pulseState = 'Strong Bear';
  else if (compositeScore <= -10) pulseState = 'Bearish';

  const pulse: NexusPulseData = {
    displacementIndex: Number(displacementIndex.toFixed(1)),
    absorptionScore,
    structureVelocity: Number(structureVelocity.toFixed(1)),
    liquidityGradient: Number(liquidityGradient.toFixed(1)),
    compositeScore,
    signalLine: Number((compositeScore * 0.85).toFixed(1)),
    stateDescription: pulseState,
  };

  // -------------------------------------------------------------
  // 12. TEMPORAL CONFLUENCE MEMORY (Rolling decay of Sweep, Zone, Disp)
  // -------------------------------------------------------------
  const memoryWindow = 30;
  const recentSweeps = sweeps.filter((s) => n - 1 - s.index <= memoryWindow);
  const latestSweep = recentSweeps.length > 0 ? recentSweeps[recentSweeps.length - 1] : null;

  const sweepMemory = {
    active: latestSweep !== null,
    direction: latestSweep ? (latestSweep.type === 'SSL' ? ('BULLISH' as const) : ('BEARISH' as const)) : null,
    barsAgo: latestSweep ? n - 1 - latestSweep.index : 99,
    weight: latestSweep ? Math.max(0, 1 - (n - 1 - latestSweep.index) / memoryWindow) : 0,
  };

  // Check recent Zone contact (OB, FVG, or Breaker)
  let zoneMemory = {
    active: false,
    quality: 'LOW' as 'OVL' | 'HI' | 'MED' | 'LOW',
    barsAgo: 99,
    weight: 0,
  };

  for (let b = n - 1; b >= Math.max(0, n - memoryWindow); b--) {
    const c = candles[b];
    // Check if candle touched an active OB or FVG
    const touchedOB = orderBlocks.find((ob) => c.low <= ob.topPrice && c.high >= ob.bottomPrice);
    const touchedFVG = fvgs.find((fvg) => c.low <= fvg.topPrice && c.high >= fvg.bottomPrice);

    if (touchedOB && touchedFVG) {
      zoneMemory = { active: true, quality: 'OVL', barsAgo: n - 1 - b, weight: 1.0 };
      break;
    } else if (touchedOB && touchedOB.score >= 4) {
      zoneMemory = { active: true, quality: 'HI', barsAgo: n - 1 - b, weight: 0.85 };
      break;
    } else if (touchedOB || touchedFVG) {
      zoneMemory = { active: true, quality: 'MED', barsAgo: n - 1 - b, weight: 0.65 };
      break;
    }
  }

  // Check recent displacement
  let dispMemory = {
    active: false,
    direction: null as 'BULLISH' | 'BEARISH' | null,
    barsAgo: 99,
    weight: 0,
  };

  for (let b = n - 1; b >= Math.max(0, n - 15); b--) {
    const c = candles[b];
    const curAtr = atr[b] || 1;
    const body = Math.abs(c.close - c.open);
    if (body > curAtr * 1.3) {
      dispMemory = {
        active: true,
        direction: c.close > c.open ? 'BULLISH' : 'BEARISH',
        barsAgo: n - 1 - b,
        weight: 1 - (n - 1 - b) / 15,
      };
      break;
    }
  }

  const recentBreak = structureBreaks.find((sb) => n - 1 - sb.breakIndex <= 3);

  let sequenceStatus: 'INACTIVE' | 'EARLY' | 'BUILDING' | 'READY' = 'INACTIVE';
  let activeCount = 0;
  if (sweepMemory.active) activeCount++;
  if (zoneMemory.active) activeCount++;
  if (dispMemory.active) activeCount++;

  if (activeCount === 1) sequenceStatus = 'EARLY';
  else if (activeCount === 2) sequenceStatus = 'BUILDING';
  else if (activeCount >= 3) sequenceStatus = 'READY';

  const temporalMemory: NexusTemporalMemoryData = {
    sweep: sweepMemory,
    zone: zoneMemory,
    displacement: dispMemory,
    structureBreak: {
      active: !!recentBreak,
      type: recentBreak ? recentBreak.type : null,
      barsAgo: recentBreak ? n - 1 - recentBreak.breakIndex : 99,
    },
    sequenceStatus,
    sequenceDirection: sweepMemory.direction ? (sweepMemory.direction === 'BULLISH' ? 'LONG' : 'SHORT') : null,
  };

  // -------------------------------------------------------------
  // 13. MULTI-TIMEFRAME CONFLUENCE (15m, 60m, 240m, Daily)
  // -------------------------------------------------------------
  const ema8 = calculateEMA(closes, 8);
  const ema21 = calculateEMA(closes, 21);
  const ema55 = calculateEMA(closes, 55);

  const cur8 = ema8[n - 1];
  const cur21 = ema21[n - 1];
  const cur55 = ema55[n - 1];

  let tf15Trend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR' = 'FLAT';
  if (cur8 > cur21 && cur21 > cur55) tf15Trend = 'STRONG_BULL';
  else if (cur8 > cur21) tf15Trend = 'BULL';
  else if (cur8 < cur21 && cur21 < cur55) tf15Trend = 'STRONG_BEAR';
  else if (cur8 < cur21) tf15Trend = 'BEAR';

  // Simulating higher timeframe trend consensus from multi-span EMA
  const ema100 = calculateEMA(closes, 100);
  const cur100 = ema100[n - 1];

  let tf60Trend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR' = currentTrend === 'BULLISH' ? 'STRONG_BULL' : 'STRONG_BEAR';
  let tf240Trend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR' = curCloseAbove(closes, cur100) ? 'BULL' : 'BEAR';
  let tfdTrend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR' = keyLevels.pwh && currentPrice > keyLevels.pwh ? 'STRONG_BULL' : 'BEAR';

  const mtf: NexusMTFData = {
    tf15: { trend: tf15Trend, text: tf15Trend.includes('BULL') ? '▲ STRONG' : tf15Trend.includes('BEAR') ? '▼ STRONG' : '— FLAT', dir: tf15Trend.includes('BULL') ? 'up' : tf15Trend.includes('BEAR') ? 'down' : 'flat' },
    tf60: { trend: tf60Trend, text: tf60Trend.includes('BULL') ? '▲ BULL' : '▼ BEAR', dir: tf60Trend.includes('BULL') ? 'up' : 'down' },
    tf240: { trend: tf240Trend, text: tf240Trend.includes('BULL') ? '▲ BULL' : '— FLAT', dir: tf240Trend.includes('BULL') ? 'up' : 'flat' },
    tfd: { trend: tfdTrend, text: tfdTrend.includes('BULL') ? '▲ BULL' : '▼ BEAR', dir: tfdTrend.includes('BULL') ? 'up' : 'down' },
    consensus: currentTrend === 'BULLISH' ? 'BULLISH' : currentTrend === 'BEARISH' ? 'BEARISH' : 'NEUTRAL',
  };

  // -------------------------------------------------------------
  // 14. MULTI-FACTOR SIGNAL SCORING & GRADING (0 to 100)
  // -------------------------------------------------------------
  const signals: NexusSignal[] = [];

  for (let i = 25; i < n; i++) {
    const c = candles[i];
    const curAtr = atr[i] || 1;

    // Check if a structure break occurred at this bar
    const brk = structureBreaks.find((sb) => sb.breakIndex === i && sb.type !== 'SMS');
    if (!brk) continue;

    const isLong = brk.direction === 'BULLISH';
    const sigCategory = brk.type; // 'BOS' or 'CHoCH'

    // Confirmation bar option
    if (settings.nexusConfirmationBar) {
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range > 0 && body / range < 0.4) continue; // Skip weak wick breakout
    }

    // 1. Structure Base Score
    let score = sigCategory === 'BOS' ? 30 : 20;

    // 2. Zone Confluence (OB / FVG / Breaker)
    const activeOB = orderBlocks.find((ob) => ob.startIndex <= i && ob.endIndex >= i && ((isLong && ob.type === 'BULL_OB') || (!isLong && ob.type === 'BEAR_OB')));
    const activeFVG = fvgs.find((f) => f.startIndex <= i && f.endIndex >= i && ((isLong && f.type === 'BULL_FVG') || (!isLong && f.type === 'BEAR_FVG')));

    if (activeOB && activeFVG) {
      score += 18; // Overlap bonus
    } else if (activeOB) {
      score += 8 + activeOB.score * 2;
    } else if (activeFVG) {
      score += 10;
    }

    // 3. Liquidity Sweep Memory
    const recentDirSweep = sweeps.find((s) => i - s.index <= 20 && ((isLong && s.type === 'SSL') || (!isLong && s.type === 'BSL')));
    if (recentDirSweep) {
      const recencyBonus = Math.max(2, Math.floor(12 * (1 - (i - recentDirSweep.index) / 20)));
      score += recencyBonus;
    }

    // 4. Premium / Discount Positioning
    if (isLong && c.close <= discountLow + fullSpan * 0.35) {
      score += 10; // Buying cheap in discount
    } else if (!isLong && c.close >= discountLow + fullSpan * 0.65) {
      score += 10; // Selling expensive in premium
    }

    // 5. Session / Kill Zone Bonus
    if (isKillZoneActive) score += 5;
    else if (activeSessionName !== 'None') score += 3;

    // 6. MTF Alignment
    if (isLong && mtf.consensus === 'BULLISH') score += 8;
    else if (!isLong && mtf.consensus === 'BEARISH') score += 8;

    // 7. Volume confirmation
    if (hasVolume && c.volume) {
      const avgVol = candles.slice(Math.max(0, i - 15), i).reduce((a, b) => a + (b.volume || 0), 0) / 15;
      if (c.volume > avgVol * 1.25) score += 4;
    }

    // Clamp score
    score = Math.min(100, Math.max(15, score));

    // Grading
    let grade: 'A+' | 'A' | 'B' | 'C' = 'C';
    if (score >= 52) grade = 'A+';
    else if (score >= 40) grade = 'A';
    else if (score >= 28) grade = 'B';

    // Apply Quality Filter
    if (signalFilter === 'A_PLUS_ONLY' && grade !== 'A+') continue;
    if (signalFilter === 'A_PLUS_AND_A' && grade !== 'A+' && grade !== 'A') continue;
    if (signalFilter === 'B_AND_ABOVE' && grade === 'C') continue;

    // Calculate Stop Loss & 3 Take Profit Targets
    let stopLoss = 0;
    if (slMode === 'ATR') {
      stopLoss = isLong ? c.close - curAtr * atrMultiplierSL : c.close + curAtr * atrMultiplierSL;
    } else if (slMode === 'SWING') {
      const relSwings = swings.filter((s) => s.index <= i && ((isLong && (s.type === 'HL' || s.type === 'LL')) || (!isLong && (s.type === 'HH' || s.type === 'LH'))));
      const lastSwing = relSwings[relSwings.length - 1];
      stopLoss = lastSwing ? lastSwing.price : (isLong ? c.close - curAtr * 2 : c.close + curAtr * 2);
    } else {
      // PERCENT mode (0.8%)
      stopLoss = isLong ? c.close * 0.992 : c.close * 1.008;
    }

    const risk = Math.abs(c.close - stopLoss);
    if (risk <= 0) continue;

    const tp1 = isLong ? c.close + risk * 1.5 : c.close - risk * 1.5;
    const tp2 = isLong ? c.close + risk * 2.5 : c.close - risk * 2.5;
    const tp3 = isLong ? c.close + risk * 4.0 : c.close - risk * 4.0;

    // Forward trade progression
    let tp1Hit = false;
    let tp2Hit = false;
    let tp3Hit = false;
    let slHit = false;
    let currentSL = stopLoss;
    let status: NexusSignal['status'] = 'ACTIVE';
    let statusText = 'ACTIVE';

    for (let k = i + 1; k < n; k++) {
      const testC = candles[k];

      if (isLong) {
        if (testC.high >= tp1 && !tp1Hit) {
          tp1Hit = true;
          currentSL = c.close; // Move to Breakeven
          status = 'TP1_HIT';
          statusText = 'TP1 HIT';
        }
        if (testC.high >= tp2 && !tp2Hit) {
          tp2Hit = true;
          status = 'TP2_HIT';
          statusText = 'PARTIAL TP2 BANKED';
        }
        if (testC.high >= tp3) {
          tp3Hit = true;
          status = 'FULL_TARGET';
          statusText = 'FULL TARGET';
          break;
        }
        if (testC.low <= currentSL) {
          slHit = true;
          status = tp1Hit ? 'TP1_HIT' : 'STOPPED_OUT';
          statusText = tp1Hit ? 'STOP AT BE' : 'STOPPED OUT';
          break;
        }
      } else {
        if (testC.low <= tp1 && !tp1Hit) {
          tp1Hit = true;
          currentSL = c.close; // Move to Breakeven
          status = 'TP1_HIT';
          statusText = 'TP1 HIT';
        }
        if (testC.low <= tp2 && !tp2Hit) {
          tp2Hit = true;
          status = 'TP2_HIT';
          statusText = 'PARTIAL TP2 BANKED';
        }
        if (testC.low <= tp3) {
          tp3Hit = true;
          status = 'FULL_TARGET';
          statusText = 'FULL TARGET';
          break;
        }
        if (testC.high >= currentSL) {
          slHit = true;
          status = tp1Hit ? 'TP1_HIT' : 'STOPPED_OUT';
          statusText = tp1Hit ? 'STOP AT BE' : 'STOPPED OUT';
          break;
        }
      }
    }

    signals.push({
      id: `sig-${i}-${isLong ? 'LONG' : 'SHORT'}`,
      barIndex: i,
      time: c.time,
      type: isLong ? 'LONG' : 'SHORT',
      signalCategory: sigCategory,
      score,
      grade,
      price: c.close,
      stopLoss,
      tp1,
      tp2,
      tp3,
      tp1Hit,
      tp2Hit,
      tp3Hit,
      slHit,
      status,
      statusText,
    });
  }

  // Active Trade is the latest signal that is still active or within last 20 bars
  const activeTrade = signals.length > 0 ? signals[signals.length - 1] : null;

  // -------------------------------------------------------------
  // 15. TREND-COLORED CANDLES (Image 6: Undefined structure is neutral gray, structure confirmed = trend color)
  // -------------------------------------------------------------
  const candleColors: Array<{ index: number; color: string }> = [];
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const isBull = c.close >= c.open;
    const bTrend = barTrends[i] || 'NEUTRAL';

    if (bTrend === 'BULLISH') {
      candleColors.push({
        index: i,
        color: isBull ? '#22c55e' : 'rgba(239, 68, 68, 0.45)', // Bullish structure: bright green, dimmed red pullbacks
      });
    } else if (bTrend === 'BEARISH') {
      candleColors.push({
        index: i,
        color: !isBull ? '#ef4444' : 'rgba(34, 197, 94, 0.45)', // Bearish structure: bright red, dimmed green pullbacks
      });
    } else {
      candleColors.push({
        index: i,
        color: '#787b86', // Undefined structure is neutral gray (Image 6 specification: no directional bias until structure confirms)
      });
    }
  }

  // -------------------------------------------------------------
  // 16. MARKET NARRATIVE (Institutional Summary Box)
  // -------------------------------------------------------------
  const structureNarrative = currentTrend === 'BEARISH' ? 'Bearish structure intact' : currentTrend === 'BULLISH' ? 'Bullish structure intact' : 'Structure consolidating';
  const zoneNarrative = currentZone === 'PREMIUM' ? 'Price in PREMIUM' : currentZone === 'DISCOUNT' ? 'Price in DISCOUNT' : 'Price in EQUILIBRIUM';
  const sessionNarrative = activeSessionName !== 'None' ? `${activeSessionName} session` : 'Off-session hours';
  const summaryPill = currentTrend === 'BEARISH' ? 'BEARISH — Trend aligned' : currentTrend === 'BULLISH' ? 'BULLISH — Trend aligned' : 'NEUTRAL — Wait for break';

  return {
    trend: currentTrend,
    bias: currentTrend === 'BULLISH' ? 'LONG' : currentTrend === 'BEARISH' ? 'SHORT' : 'NEUTRAL',
    currentZone,
    premiumHigh,
    discountLow,
    equilibriumPrice,
    hasVolume,
    swings,
    structureBreaks,
    orderBlocks,
    fvgs,
    liquidityPools,
    sweeps,
    srLevels,
    trendlines,
    vwap: vwapResult,
    keyLevels,
    sessions,
    activeSessionName,
    isKillZoneActive,
    pulse,
    temporalMemory,
    mtf,
    signals,
    activeTrade,
    candleColors,
    narrative: {
      structureText: structureNarrative,
      zoneText: zoneNarrative,
      sessionText: sessionNarrative,
      summaryPillText: summaryPill,
      summaryPillType: currentTrend === 'BULLISH' ? 'bullish' : currentTrend === 'BEARISH' ? 'bearish' : 'neutral',
    },
  };
}

function curCloseAbove(closes: number[], ema: number): boolean {
  return closes.length > 0 && closes[closes.length - 1] > ema;
}
