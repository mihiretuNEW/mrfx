/**
 * @license
 * Mpro Signals: Professional Market Structure & Signal Engine
 * High-probability HTF support/resistance level classification and extreme zone reversal signals.
 */

import { Candle, TimeframeId } from '../types';

export type SRChoiceType =
  | 'NONE'
  | 'SMA'
  | 'Upper'
  | 'Lower'
  | 'Previous High'
  | 'Previous Low'
  | 'Swings'
  | 'Fibonacci';

export interface SRSetItem {
  choice: SRChoiceType;
  length: number;
  mult: number;
  res: string; // 'D', 'W', '4H', '1H', or '' (chart timeframe)
}

export interface SRClassificationOptions {
  lookback?: number; // default 500
  fade?: number; // default 5
  opt?: 'line' | 'value'; // default 'line'
  colU?: string; // default '#22c55e' (lime)
  colD?: string; // default '#ef4444' (red)
  left?: number; // default 10
  right?: number; // default 1
  showPP?: boolean; // show swings pivots (default false)
  showBreaks?: boolean; // default false
  sets?: SRSetItem[];
  isPro?: boolean; // Pro users get active live candle signals and levels
  lineExtension?: 'Anchored' | 'FullChart'; // Anchored to lookback cycle (Original Math) vs FullChart
}

export interface SRLevel {
  e: number; // Set number 1..9
  value: number; // Price level
  chc: SRChoiceType;
  res: string;
  txt: string;
  tooltip: string;
  grade: number; // 0 to 100 (0 = solid/0 breaks, 100 = completely faded)
  rank: number; // 1 (strongest/least breaks), 2, 3...
  breaks: number;
  color: string;
  alpha: number; // 0..1 computed as max(0.12, (100 - grade) / 100)
  isSupport: boolean; // close > value
}

export interface SRSwingPivot {
  barIndex: number;
  price: number;
  isHigh: boolean;
}

export interface SRRangeBox {
  top: number;
  bottom: number;
  startBarIndex: number;
  endBarIndex: number;
  color: string;
}

export interface SRSignal {
  index: number;
  type: 'buy' | 'sell';
  price: number;
  time: number;
  strength?: 'strong' | 'normal';
  isLastLineTouch?: boolean;
}

export interface MproSignalRR {
  signal: SRSignal;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  rewardAmount: number;
  rrRatio: number; // 1.5
  direction: 'buy' | 'sell';
  startBarIndex: number;
  endBarIndex: number;
}

export function calculateMproSignalRR(
  signal: SRSignal,
  candles: Candle[],
  highest: number,
  lowest: number,
  customEndBarIndex?: number
): MproSignalRR {
  const c = candles[signal.index];
  const barSpan = 14; // standard default span
  const defaultEndBarIndex = Math.min(candles.length - 1, signal.index + barSpan);
  const endBarIndex = customEndBarIndex !== undefined ? Math.min(candles.length - 1, customEndBarIndex) : defaultEndBarIndex;

  const entry = c ? (signal.type === 'buy' ? c.close : c.close) : signal.price;
  const candleRange = c ? Math.max(0.0001, c.high - c.low) : Math.abs(highest - lowest) * 0.05;

  let stopLoss: number;
  let riskAmount: number;

  if (signal.type === 'buy') {
    // For Buy: SL placed slightly below the candle low and bottom support floor
    const rawSL = Math.min(c ? c.low - candleRange * 0.5 : entry - candleRange, lowest);
    stopLoss = Math.min(entry * 0.998, rawSL);
    riskAmount = Math.max(candleRange * 0.8, entry - stopLoss);
    const rewardAmount = riskAmount * 1.5;
    const takeProfit = entry + rewardAmount;

    return {
      signal,
      entry,
      stopLoss,
      takeProfit,
      riskAmount,
      rewardAmount,
      rrRatio: 1.5,
      direction: 'buy',
      startBarIndex: signal.index,
      endBarIndex,
    };
  } else {
    // For Sell: SL placed slightly above the candle high and top resistance ceiling
    const rawSL = Math.max(c ? c.high + candleRange * 0.5 : entry + candleRange, highest);
    stopLoss = Math.max(entry * 1.002, rawSL);
    riskAmount = Math.max(candleRange * 0.8, stopLoss - entry);
    const rewardAmount = riskAmount * 1.5;
    const takeProfit = entry - rewardAmount;

    return {
      signal,
      entry,
      stopLoss,
      takeProfit,
      riskAmount,
      rewardAmount,
      rrRatio: 1.5,
      direction: 'sell',
      startBarIndex: signal.index,
      endBarIndex,
    };
  }
}

export interface SRClassificationResult {
  levels: SRLevel[];
  highest: number;
  lowest: number;
  midline: number;
  dynamicMidline: { barIndex: number; price: number }[];
  startBarIndex: number;
  endBarIndex: number;
  topBox: SRRangeBox;
  bottomBox: SRRangeBox;
  midlineBox: SRRangeBox;
  swingPivots: SRSwingPivot[];
  signals: SRSignal[];
}

/**
 * Standard default 9 SET items matching LuxAlgo Pine Script
 */
export const DEFAULT_SR_SETS: SRSetItem[] = [
  { choice: 'SMA', length: 50, mult: 2, res: 'D' },
  { choice: 'SMA', length: 100, mult: 2, res: 'D' },
  { choice: 'SMA', length: 20, mult: 2, res: 'W' },
  { choice: 'Previous High', length: 20, mult: 2, res: 'W' },
  { choice: 'Previous Low', length: 20, mult: 2, res: 'W' },
  { choice: 'Upper', length: 20, mult: 2, res: 'D' },
  { choice: 'Lower', length: 20, mult: 2, res: 'D' },
  { choice: 'Swings', length: 20, mult: 2, res: 'D' },
  { choice: 'Fibonacci', length: 20, mult: 2, res: 'W' },
];

/**
 * Helper to aggregate intraday candles into Higher Timeframe (HTF) bars ('D', 'W', '4H', '1H', etc.)
 */
function aggregateHTFCandles(candles: Candle[], res: string, currentTf: TimeframeId = '1M'): Candle[] {
  if (!candles || candles.length === 0) return [];
  if (!res || res === '' || res === 'chart') return candles;

  const resSecondsMap: Record<string, number> = {
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
    'MONTHLY': 2592000,
  };

  const targetSec = resSecondsMap[res.toUpperCase()] || 86400;
  const currentSec = resSecondsMap[currentTf] || 60;

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
 * Calculates Simple Moving Average
 */
function calculateSMA(data: number[], length: number): number | null {
  if (data.length === 0) return null;
  const actualLen = Math.min(length, data.length);
  if (actualLen <= 0) return null;
  const slice = data.slice(-actualLen);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / actualLen;
}

/**
 * Calculates Bollinger Bands Upper/Lower
 */
function calculateBB(data: number[], length: number, mult: number): { upper: number; lower: number; basis: number } | null {
  if (data.length === 0) return null;
  const actualLen = Math.min(length, data.length);
  if (actualLen <= 0) return null;
  const slice = data.slice(-actualLen);
  const basis = slice.reduce((a, b) => a + b, 0) / actualLen;
  const variance = slice.reduce((a, b) => a + Math.pow(b - basis, 2), 0) / actualLen;
  const stdev = Math.sqrt(variance);
  return {
    upper: basis + mult * stdev,
    lower: basis - mult * stdev,
    basis,
  };
}

/**
 * Main calculation module for Support Resistance Classification [LuxAlgo]
 */
export function calculateSupportResistanceClassification(
  candles: Candle[],
  options: SRClassificationOptions = {},
  currentTf: TimeframeId = '1M'
): SRClassificationResult | null {
  if (!candles || !Array.isArray(candles) || candles.length < 10) {
    return null;
  }

  const n = candles.length;
  const lkb = Math.max(20, Math.min(3000, options.lookback ?? 100));
  const fade = Math.max(1, options.fade ?? 5);
  const opt = options.opt ?? 'line';
  const fromR = opt === 'value';
  const colU = options.colU ?? '#22c55e';
  const colD = options.colD ?? '#ef4444';
  const left = Math.max(1, Math.min(20, options.left ?? 10));
  const right = Math.max(1, Math.min(10, options.right ?? 1));
  const showPP = options.showPP ?? false;
  const showBreaks = options.showBreaks ?? false;
  const sets = options.sets && options.sets.length === 9 ? options.sets : DEFAULT_SR_SETS;

  // Window slice for lookback:
  // In 'FullChart' mode, lines and evaluation cover from candle 0 across all history.
  // In 'Anchored' mode (Original Math), lines anchor to the lookback window cycle [n - lkb, n - 1 + 8].
  const isFullChart = options.lineExtension === 'FullChart';
  const lookbackStartIdx = isFullChart ? 0 : Math.max(0, n - lkb);
  const lookbackCandles = candles.slice(lookbackStartIdx);

  // Highest and Lowest in lookback
  let highest = -Infinity;
  let lowest = Infinity;
  for (let i = 0; i < lookbackCandles.length; i++) {
    const c = lookbackCandles[i];
    if (c.high > highest) highest = c.high;
    if (c.low < lowest) lowest = c.low;
  }

  if (highest <= lowest || !isFinite(highest) || !isFinite(lowest)) {
    return null;
  }

  // 1. Swings Pivot Detection (left / right)
  const pivH: { b: number; p: number }[] = [];
  const pivL: { b: number; p: number }[] = [];

  for (let i = left; i < n - right; i++) {
    // Pivot High
    const curH = candles[i].high;
    let isPh = true;
    for (let k = 1; k <= left; k++) {
      if (candles[i - k].high >= curH) {
        isPh = false;
        break;
      }
    }
    if (isPh) {
      for (let k = 1; k <= right; k++) {
        if (candles[i + k].high > curH) {
          isPh = false;
          break;
        }
      }
    }

    if (isPh) {
      // Remove pivots older than lookback
      while (pivH.length > 0 && pivH[0].b < lookbackStartIdx) {
        pivH.shift();
      }
      // Keep non-broken / non-dominated pivots
      for (let k = pivH.length - 1; k >= 0; k--) {
        if (curH >= pivH[k].p) {
          pivH.splice(k, 1);
        }
      }
      pivH.push({ b: i, p: curH });
    }

    // Pivot Low
    const curL = candles[i].low;
    let isPl = true;
    for (let k = 1; k <= left; k++) {
      if (candles[i - k].low <= curL) {
        isPl = false;
        break;
      }
    }
    if (isPl) {
      for (let k = 1; k <= right; k++) {
        if (candles[i + k].low < curL) {
          isPl = false;
          break;
        }
      }
    }

    if (isPl) {
      while (pivL.length > 0 && pivL[0].b < lookbackStartIdx) {
        pivL.shift();
      }
      for (let k = pivL.length - 1; k >= 0; k--) {
        if (curL <= pivL[k].p) {
          pivL.splice(k, 1);
        }
      }
      pivL.push({ b: i, p: curL });
    }
  }

  // Raw collected level candidates before ranking
  interface RawLevelCandidate {
    e: number;
    value: number;
    chc: SRChoiceType;
    res: string;
    txt: string;
    tooltip: string;
    breaks: number;
    grade: number;
  }

  const rawLevels: RawLevelCandidate[] = [];
  const currentClose = candles[n - 1].close;

  // Helper to count breaks and calculate grade for a level
  const evaluateLevelBreaks = (val: number): { breaks: number; grade: number } => {
    const firstPos = val > currentClose ? 'r' : 's';
    let pos = 1;
    let breaks = 0;

    for (let i = n - 1; i >= lookbackStartIdx; i--) {
      const closePrice = candles[i].close;
      if (firstPos === 'r') {
        if (pos === 1 && closePrice > val) {
          breaks++;
          pos = 0;
        } else if (pos === 0 && closePrice < val) {
          pos = 1;
        }
      } else {
        if (pos === 1 && closePrice < val) {
          breaks++;
          pos = 0;
        } else if (pos === 0 && closePrice > val) {
          pos = 1;
        }
      }
    }

    const grade = Math.min(100, Math.round((100 / fade) * breaks));
    return { breaks, grade };
  };

  // Process SET 1 to 9
  for (let sIdx = 0; sIdx < sets.length; sIdx++) {
    const e = sIdx + 1;
    const item = sets[sIdx];
    const { choice: chc, length: len, mult: mlt, res } = item;

    if (chc === 'NONE') continue;

    const htfCandles = aggregateHTFCandles(candles, res, currentTf);
    if (htfCandles.length === 0) continue;

    const closes = htfCandles.map((c) => c.close);
    const chart = !res || res === '' || res === 'chart';
    const sRes = chart ? 'chart' : res;

    // 1. Swings Choice
    if (chc === 'Swings') {
      // Process Pivot Highs
      for (const p of pivH) {
        if (p.p <= highest && p.p >= lowest) {
          const { breaks, grade } = evaluateLevelBreaks(p.p);
          rawLevels.push({
            e,
            value: p.p,
            chc,
            res,
            txt: '',
            tooltip: `N°${e} Swings`,
            breaks,
            grade,
          });
        }
      }

      // Process Pivot Lows
      for (const p of pivL) {
        if (p.p <= highest && p.p >= lowest) {
          const { breaks, grade } = evaluateLevelBreaks(p.p);
          rawLevels.push({
            e,
            value: p.p,
            chc,
            res,
            txt: '',
            tooltip: `N°${e} Swings`,
            breaks,
            grade,
          });
        }
      }
      continue;
    }

    // 2. Fibonacci Choice
    if (chc === 'Fibonacci') {
      // Use previous closed HTF bar for stable non-repainting pivot points
      const prevBar = htfCandles.length >= 2 ? htfCandles[htfCandles.length - 2] : htfCandles[htfCandles.length - 1];
      const H = prevBar.high;
      const L = prevBar.low;
      const C = prevBar.close;
      const P = (H + L + C) / 3;
      const diff = H - L;

      const fibLevels = [
        { name: 'P', val: P },
        { name: 'R1', val: P + 0.382 * diff },
        { name: 'S1', val: P - 0.382 * diff },
        { name: 'R2', val: P + 0.618 * diff },
        { name: 'S2', val: P - 0.618 * diff },
        { name: 'R3', val: P + 1.0 * diff },
        { name: 'S3', val: P - 1.0 * diff },
        { name: 'R4', val: P + 1.618 * diff },
        { name: 'S4', val: P - 1.618 * diff },
        { name: 'R5', val: P + 2.618 * diff },
        { name: 'S5', val: P - 2.618 * diff },
      ];

      for (const fl of fibLevels) {
        if (fl.val <= highest && fl.val >= lowest) {
          const { breaks, grade } = evaluateLevelBreaks(fl.val);
          const txtSuffix = (chart ? '' : `(${res}) `) + `(${fl.name}, Fib.)`;
          rawLevels.push({
            e,
            value: fl.val,
            chc,
            res,
            txt: txtSuffix,
            tooltip: `N°${e} – HTF: ${sRes} \n${fl.name} (Fib.)`,
            breaks,
            grade,
          });
        }
      }
      continue;
    }

    // 3. Single Value Choices: SMA, Upper, Lower, Previous High, Previous Low
    let val: number | null = null;
    const isHL = chc === 'Previous High' || chc === 'Previous Low';

    if (chc === 'SMA') {
      val = calculateSMA(closes, len);
    } else if (chc === 'Upper') {
      const bb = calculateBB(closes, len, mlt);
      val = bb ? bb.upper : null;
    } else if (chc === 'Lower') {
      const bb = calculateBB(closes, len, mlt);
      val = bb ? bb.lower : null;
    } else if (chc === 'Previous High') {
      const prevBar = htfCandles.length >= 2 ? htfCandles[htfCandles.length - 2] : htfCandles[htfCandles.length - 1];
      val = prevBar.high;
    } else if (chc === 'Previous Low') {
      const prevBar = htfCandles.length >= 2 ? htfCandles[htfCandles.length - 2] : htfCandles[htfCandles.length - 1];
      val = prevBar.low;
    }

    if (val !== null && val <= highest && val >= lowest) {
      const { breaks, grade } = evaluateLevelBreaks(val);
      const txtSuffix = (chart ? '' : `(${res}) `) + chc;
      const tooltip = `N°${e} – HTF: ${sRes} \n${chc}` + (isHL ? '' : `, len ${len}`);

      rawLevels.push({
        e,
        value: val,
        chc,
        res,
        txt: txtSuffix,
        tooltip,
        breaks,
        grade,
      });
    }
  }

  // Deduplicate and rank grades
  const allGrades = rawLevels.map((r) => r.grade);
  const uniqueGrades = Array.from(new Set(allGrades)).sort((a, b) => a - b);

  // Build final ranked SR Levels
  const levels: SRLevel[] = rawLevels.map((r) => {
    const rank = uniqueGrades.indexOf(r.grade) + 1;
    const isSupport = currentClose >= r.value;
    const color = currentClose > r.value ? colU : currentClose < r.value ? colD : '#3b82f6';
    const alpha = Math.max(0.15, (100 - r.grade) / 100);

    let displayTxt = `${rank} ${r.txt}`;
    if (r.chc === 'Swings') {
      displayTxt = `${rank} N°${r.e} Swings`;
    }
    if (showBreaks) {
      displayTxt += `\n${r.breaks} brk`;
    }

    return {
      e: r.e,
      value: r.value,
      chc: r.chc,
      res: r.res,
      txt: displayTxt,
      tooltip: r.tooltip,
      grade: r.grade,
      rank,
      breaks: r.breaks,
      color,
      alpha,
      isSupport,
    };
  });

  // End bar extends 8 bars forward
  const endBarIndex = n - 1 + 8;
  const rangeHeight = highest - lowest;
  const boxHeight = rangeHeight / 20;

  // Top Box (Red 90% transparent)
  const topBox: SRRangeBox = {
    top: highest,
    bottom: highest - boxHeight,
    startBarIndex: lookbackStartIdx,
    endBarIndex,
    color: colD,
  };

  // Bottom Box (Lime 90% transparent)
  const bottomBox: SRRangeBox = {
    top: lowest + boxHeight,
    bottom: lowest,
    startBarIndex: lookbackStartIdx,
    endBarIndex,
    color: colU,
  };

  // Middle Line (50% Equilibrium between Highest & Lowest of chart history)
  const midline = (highest + lowest) / 2;
  const halfBoxHeight = boxHeight / 2;

  // Middle Box (Equilibrium Shadow Zone)
  const midlineBox: SRRangeBox = {
    top: midline + halfBoxHeight,
    bottom: midline - halfBoxHeight,
    startBarIndex: lookbackStartIdx,
    endBarIndex,
    color: '#06b6d4', // Vibrant Cyan
  };

  // Dynamic history midline across lookback window
  const dynamicMidline: { barIndex: number; price: number }[] = [];
  let rollHigh = -Infinity;
  let rollLow = Infinity;
  for (let i = lookbackStartIdx; i < n; i++) {
    const c = candles[i];
    if (c.high > rollHigh) rollHigh = c.high;
    if (c.low < rollLow) rollLow = c.low;
    dynamicMidline.push({
      barIndex: i,
      price: (rollHigh + rollLow) / 2,
    });
  }

  // Swings Pivots list for rendering if showPP is enabled
  const swingPivots: SRSwingPivot[] = [];
  if (showPP) {
    for (const ph of pivH) {
      swingPivots.push({ barIndex: ph.b, price: ph.p, isHigh: true });
    }
    for (const pl of pivL) {
      swingPivots.push({ barIndex: pl.b, price: pl.p, isHigh: false });
    }
  }

  // Detect BUY and SELL signals immediately when price touches the extreme outer zones or the last support/resistance line
  // BUY: Candle touches or dips into the bottom support zone (lowest + boxHeight) OR the lowest support line
  // SELL: Candle touches or spikes into the top resistance zone (highest - boxHeight) OR the highest resistance line
  // Instant trigger: does not wait for candle close / confirmation
  const signals: SRSignal[] = [];
  const bottomZoneCeiling = lowest + boxHeight;
  const topZoneFloor = highest - boxHeight;

  // Identify the last / extreme support line and last / extreme resistance line
  const activeSupportLevels = levels.filter((l) => l.isSupport);
  const activeResistanceLevels = levels.filter((l) => !l.isSupport);

  const minSupportLine = activeSupportLevels.length > 0
    ? activeSupportLevels.reduce((min, l) => Math.min(min, l.value), Infinity)
    : lowest + boxHeight;

  const maxResistanceLine = activeResistanceLevels.length > 0
    ? activeResistanceLevels.reduce((max, l) => Math.max(max, l.value), -Infinity)
    : highest - boxHeight;

  // Touch trigger thresholds (with small 0.05% tolerance for precise line touch)
  const bottomTriggerThreshold = Math.max(
    bottomZoneCeiling,
    isFinite(minSupportLine) ? minSupportLine * 1.0005 : bottomZoneCeiling
  );

  const topTriggerThreshold = Math.min(
    topZoneFloor,
    isFinite(maxResistanceLine) ? maxResistanceLine * 0.9995 : topZoneFloor
  );

  let lastSignalType: 'buy' | 'sell' | null = null;
  let lastSignalBar = -999;

  for (let i = lookbackStartIdx; i < n; i++) {
    const c = candles[i];
    if (!c) continue;

    // Instant touch condition: Check if price touched the last support line vs the bottom shaded zone
    const touchesLastSupportLine = isFinite(minSupportLine) && c.low <= minSupportLine * 1.0005;
    const touchesBottomZone = c.low <= bottomZoneCeiling;

    if (touchesLastSupportLine || touchesBottomZone) {
      if (lastSignalType !== 'buy' || (i - lastSignalBar) >= 2) {
        const isStrong = touchesLastSupportLine;
        signals.push({
          index: i,
          type: 'buy',
          price: c.low,
          time: c.time,
          strength: isStrong ? 'strong' : 'normal',
          isLastLineTouch: isStrong,
        });
        lastSignalType = 'buy';
        lastSignalBar = i;
        continue;
      }
    }

    // Instant touch condition: Check if price touched the last resistance line vs the top shaded zone
    const touchesLastResistanceLine = isFinite(maxResistanceLine) && c.high >= maxResistanceLine * 0.9995;
    const touchesTopZone = c.high >= topZoneFloor;

    if (touchesLastResistanceLine || touchesTopZone) {
      if (lastSignalType !== 'sell' || (i - lastSignalBar) >= 2) {
        const isStrong = touchesLastResistanceLine;
        signals.push({
          index: i,
          type: 'sell',
          price: c.high,
          time: c.time,
          strength: isStrong ? 'strong' : 'normal',
          isLastLineTouch: isStrong,
        });
        lastSignalType = 'sell';
        lastSignalBar = i;
        continue;
      }
    }
  }

  return {
    levels,
    highest,
    lowest,
    midline,
    dynamicMidline,
    startBarIndex: lookbackStartIdx,
    endBarIndex,
    topBox,
    bottomBox,
    midlineBox,
    swingPivots,
    signals,
  };
}
