/**
 * Market Structure Target Tracker [MarkitTick]
 * 100% Exact Port of TradingView Pine Script v6
 *
 * This work is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 * © MarkitTick
 */

import { Candle } from '../types';

export interface MsttOptions {
  swingLen?: number; // Swing Length (default 5, min 1, max 100)
  showBosLine?: boolean; // Show BOS Line (default true)
  showLabel?: boolean; // Show Labels (default true)
  invalidateMode?: boolean; // Auto-Invalidate (default true)
  colBullBos?: string; // Bull BOS color (rgb(0,200,120))
  colBearBos?: string; // Bear BOS color (rgb(220,50,50))
  colTarget?: string; // Target color (rgb(255,200,0))
  colHit?: string; // Target Hit color (rgb(180,100,255))
  showTpSl?: boolean; // Show Entry/SL/TP (default true)
  slMulti?: number; // SL ATR Multi (default 1.0, min 0.1, max 10.0, step 0.1)
  tp1Multi?: number; // TP1 ATR Multi (default 1.5, min 0.1, max 20.0, step 0.1)
  tp2Multi?: number; // TP2 ATR Multi (default 3.0, min 0.1, max 20.0, step 0.1)
  tp3Multi?: number; // TP3 ATR Multi (default 5.0, min 0.1, max 20.0, step 0.1)
  atrLen?: number; // ATR Length (default 14, min 1, max 50)
  colEntry?: string; // Entry color (rgb(100,180,255))
  colSl?: string; // SL color (rgb(255,60,60))
  colTp1?: string; // TP1 color (rgb(0,220,130))
  colTp2?: string; // TP2 color (rgb(0,255,180))
  colTp3?: string; // TP3 color (rgb(0,255,255))
  showSl?: boolean; // Show SL line & label (default true)
  showTp1?: boolean; // Show TP1 line & label (default true)
  showTp2?: boolean; // Show TP2 line & label (default true)
  showTp3?: boolean; // Show TP3 line & label (default true)
  showSlShade?: boolean; // Show SL shade fill (default true)
  showTp1Shade?: boolean; // Show TP1 shade fill (default true)
  showTp2Shade?: boolean; // Show TP2 shade fill (default true)
  showTp3Shade?: boolean; // Show TP3 shade fill (default true)
  colSlShade?: string; // Custom SL shade color (default colSl)
  colTp1Shade?: string; // Custom TP1 shade color (default colTp1)
  colTp2Shade?: string; // Custom TP2 shade color (default colTp2)
  colTp3Shade?: string; // Custom TP3 shade color (default colTp3)
  slShadeAlpha?: number; // Custom SL shade opacity (default 0.30)
  tp1ShadeAlpha?: number; // Custom TP1 shade opacity (default 0.30)
  tp2ShadeAlpha?: number; // Custom TP2 shade opacity (default 0.15)
  tp3ShadeAlpha?: number; // Custom TP3 shade opacity (default 0.05)
  htfRes?: string; // HTF timeframe (default "240")
  useHtfFilter?: boolean; // HTF Filter (default false)
  htfRsiLen?: number; // HTF RSI Len (default 14, min 2)
  showDashboard?: boolean; // Show Dashboard table (default true)
  dashBgColor?: string; // Dashboard BG (rgb(10,10,18))
  dashTxtColor?: string; // Dashboard Text (rgb(220,220,235))
}

export interface MsttLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  style: 'dashed' | 'solid';
}

export interface MsttLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  textColor: string;
  style: 'label_down' | 'label_up' | 'label_left';
  size: 'small';
}

export interface MsttLineFill {
  y1: number;
  y2: number;
  x1: number;
  x2: number;
  color: string;
}

export interface MsttDashboard {
  ticker: string;
  tag: string;
  trendStr: string;
  trendCol: string;
  htfStr: string;
  htfDirCol: string;
  htfBarStr: string;
  htfBarCol: string;
  bosLvlStr: string;
  tgtLvlStr: string;
  tgtHitStr: string;
  tgtHitCol: string;
  entryStr: string;
  slStr: string;
  tp1Str: string;
  tp2Str: string;
  tp3Str: string;
  rrStr: string;
  rrCol: string;
  durationStr: string;
  totalStr: string;
}

export interface MsttResult {
  // Current active structure lines & targets
  bosLine: MsttLine | null;
  bosLabel: MsttLabel | null;
  entryLine: MsttLine | null;
  entryLabel: MsttLabel | null;
  slLine: MsttLine | null;
  slLabel: MsttLabel | null;
  tp1Line: MsttLine | null;
  tp1Label: MsttLabel | null;
  tp2Line: MsttLine | null;
  tp2Label: MsttLabel | null;
  tp3Line: MsttLine | null;
  tp3Label: MsttLabel | null;
  // Shaded fills
  slFill: MsttLineFill | null;
  tp1Fill: MsttLineFill | null;
  tp2Fill: MsttLineFill | null;
  tp3Fill: MsttLineFill | null;
  // Dashboard
  dashboard: MsttDashboard;
  // State
  bosActive: boolean;
  targetHit: boolean;
  bosIsBull: boolean;
  bosLevel: number | null;
  targetLevel: number | null;
  entryPrice: number | null;
  slPrice: number | null;
  tp1Price: number | null;
  tp2Price: number | null;
  tp3Price: number | null;
}

// ── RMA calculation (Pine Script ta.rma) ──────────────────────────────────────
function calculateRMA(values: number[], length: number): number[] {
  const result: number[] = new Array(values.length);
  const alpha = 1 / length;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < length) {
      sum += values[i];
      if (i === length - 1) {
        result[i] = sum / length;
      } else {
        result[i] = NaN;
      }
    } else {
      result[i] = alpha * values[i] + (1 - alpha) * result[i - 1];
    }
  }
  return result;
}

// ── ATR calculation (Pine Script ta.atr) ───────────────────────────────────────
function calculateATR(candles: Candle[], length: number): number[] {
  const n = candles.length;
  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr[i] = candles[i].high - candles[i].low;
    } else {
      const h = candles[i].high;
      const l = candles[i].low;
      const prevClose = candles[i - 1].close;
      tr[i] = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    }
  }
  return calculateRMA(tr, length);
}

// ── RSI calculation (Pine Script ta.rsi) ──────────────────────────────────────
function calculateRSI(values: number[], length: number): number[] {
  const n = values.length;
  const result: number[] = new Array(n).fill(NaN);
  if (n < length + 1) return result;

  const gains: number[] = new Array(n).fill(0);
  const losses: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) {
      gains[i] = diff;
    } else {
      losses[i] = -diff;
    }
  }

  const rmaGains = calculateRMA(gains, length);
  const rmaLosses = calculateRMA(losses, length);

  for (let i = 0; i < n; i++) {
    const g = rmaGains[i];
    const l = rmaLosses[i];
    if (isNaN(g) || isNaN(l)) continue;
    if (l === 0) {
      result[i] = 100;
    } else {
      const rs = g / l;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

// ── HTF RSI Calculation (Pine Script request.security(..., htfRes, ta.rsi(close, len))) ──
function parseHtfMinutes(res: string): number {
  const clean = String(res).trim().toUpperCase();
  if (clean === 'D' || clean === '1D' || clean === '1440') return 1440;
  if (clean === '4H' || clean === '240') return 240;
  if (clean === '2H' || clean === '120') return 120;
  if (clean === '1H' || clean === '60') return 60;
  if (clean === '30' || clean === '30M') return 30;
  if (clean === '15' || clean === '15M') return 15;
  if (clean === '5' || clean === '5M') return 5;
  const num = parseInt(clean, 10);
  return isNaN(num) || num <= 0 ? 240 : num;
}

function calculateHtfRsiSeries(candles: Candle[], htfRes: string, htfRsiLen: number): number[] {
  const n = candles.length;
  if (n === 0) return [];
  const closeSeries = candles.map((c) => c.close);
  if (n < 2) return calculateRSI(closeSeries, htfRsiLen);

  const htfMin = parseHtfMinutes(htfRes);
  const htfSec = htfMin * 60;

  const isMs = candles[0].time > 1e11;
  const diffTime = Math.abs(candles[n - 1].time - candles[0].time);
  const chartIntervalSec = Math.max(10, isMs ? diffTime / (n - 1) / 1000 : diffTime / (n - 1));

  // If chart interval is equal to or larger than HTF, use chart RSI directly
  if (chartIntervalSec >= htfSec) {
    return calculateRSI(closeSeries, htfRsiLen);
  }

  // Resample candles into HTF buckets
  const buckets: { bucketId: number; close: number }[] = [];
  const candleBucketIndices: number[] = new Array(n);
  let currentBucketId = -1;

  for (let i = 0; i < n; i++) {
    const tSec = isMs ? candles[i].time / 1000 : candles[i].time;
    const bId = Math.floor(tSec / htfSec);
    if (bId !== currentBucketId) {
      currentBucketId = bId;
      buckets.push({ bucketId: bId, close: candles[i].close });
    } else {
      buckets[buckets.length - 1].close = candles[i].close;
    }
    candleBucketIndices[i] = buckets.length - 1;
  }

  if (buckets.length >= htfRsiLen + 2) {
    const bucketCloses = buckets.map((b) => b.close);
    const bucketRsi = calculateRSI(bucketCloses, htfRsiLen);
    const result = new Array(n);
    for (let i = 0; i < n; i++) {
      const bIdx = candleBucketIndices[i];
      result[i] = !isNaN(bucketRsi[bIdx]) ? bucketRsi[bIdx] : 50;
    }
    return result;
  }

  // Fallback if not enough HTF bars in view: scale the RSI length proportional to timeframe ratio
  const ratio = Math.max(1, Math.round(htfSec / chartIntervalSec));
  const effectiveLen = Math.max(2, Math.min(200, Math.round(htfRsiLen * ratio)));
  return calculateRSI(closeSeries, effectiveLen);
}

// ── Dashboard Helper Functions ────────────────────────────────────────────────
function f_blockBar(rawVal: number, domainMax: number): string {
  const pct = Math.min(Math.max((rawVal / domainMax) * 100.0, 0.0), 100.0);
  const n = Math.round(pct / 10.0);
  let s = '';
  for (let i = 1; i <= 10; i++) {
    s += i <= n ? '█' : '░';
  }
  return s + ' ' + Math.round(pct).toString() + '%';
}

function f_blockColor(rawVal: number, lo: number, mid: number, hi: number): string {
  return rawVal >= hi
    ? 'rgb(0, 255, 120)'
    : rawVal >= mid
    ? 'rgb(80, 255, 0)'
    : rawVal >= lo
    ? 'rgb(200, 200, 0)'
    : 'rgb(110, 110, 110)';
}

function formatPrice(val: number | null | undefined, minTickPrecision = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return val.toFixed(minTickPrecision);
}

/**
 * 100% Exact Execution of Market Structure Target Tracker [MarkitTick]
 */
export function calculateMarketStructureTargetTracker(
  candles: Candle[],
  options: MsttOptions = {},
  cleanTicker = 'MARKET'
): MsttResult {
  const swingLen = Math.max(1, Math.min(100, Math.round(options.swingLen ?? 5)));
  const showBosLine = options.showBosLine ?? true;
  const showLabel = options.showLabel ?? true;
  const invalidateMode = options.invalidateMode ?? true;
  const colBullBos = options.colBullBos ?? 'rgb(0,200,120)';
  const colBearBos = options.colBearBos ?? 'rgb(220,50,50)';
  const colTarget = options.colTarget ?? 'rgb(255,200,0)';
  const colHit = options.colHit ?? 'rgb(180,100,255)';
  const showTpSl = options.showTpSl ?? true;
  const slMulti = options.slMulti ?? 1.0;
  const tp1Multi = options.tp1Multi ?? 1.5;
  const tp2Multi = options.tp2Multi ?? 3.0;
  const tp3Multi = options.tp3Multi ?? 5.0;
  const atrLen = options.atrLen ?? 14;
  const colEntry = options.colEntry ?? 'rgb(100,180,255)';
  const colSl = options.colSl ?? 'rgb(255,60,60)';
  const colTp1 = options.colTp1 ?? 'rgb(0,220,130)';
  const colTp2 = options.colTp2 ?? 'rgb(0,255,180)';
  const colTp3 = options.colTp3 ?? 'rgb(0,255,255)';
  const showSl = options.showSl ?? true;
  const showTp1 = options.showTp1 ?? true;
  const showTp2 = options.showTp2 ?? true;
  const showTp3 = options.showTp3 ?? true;
  const showSlShade = options.showSlShade ?? true;
  const showTp1Shade = options.showTp1Shade ?? true;
  const showTp2Shade = options.showTp2Shade ?? true;
  const showTp3Shade = options.showTp3Shade ?? true;
  const colSlShade = options.colSlShade || colSl;
  const colTp1Shade = options.colTp1Shade || colTp1;
  const colTp2Shade = options.colTp2Shade || colTp2;
  const colTp3Shade = options.colTp3Shade || colTp3;
  const useHtfFilter = options.useHtfFilter ?? false;
  const htfRes = options.htfRes ?? '240';
  const htfRsiLen = options.htfRsiLen ?? 14;

  const n = candles.length;
  if (n === 0) {
    return {
      bosLine: null,
      bosLabel: null,
      entryLine: null,
      entryLabel: null,
      slLine: null,
      slLabel: null,
      tp1Line: null,
      tp1Label: null,
      tp2Line: null,
      tp2Label: null,
      tp3Line: null,
      tp3Label: null,
      slFill: null,
      tp1Fill: null,
      tp2Fill: null,
      tp3Fill: null,
      dashboard: {
        ticker: cleanTicker,
        tag: 'BOS [MT]',
        trendStr: '● Neutral',
        trendCol: 'rgb(140,140,140)',
        htfStr: '● Neutral',
        htfDirCol: 'rgb(140,140,140)',
        htfBarStr: '░░░░░░░░░░ 0%',
        htfBarCol: 'rgb(110,110,110)',
        bosLvlStr: '—',
        tgtLvlStr: '—',
        tgtHitStr: '—',
        tgtHitCol: 'rgb(110,110,110)',
        entryStr: '—',
        slStr: '—',
        tp1Str: '—',
        tp2Str: '—',
        tp3Str: '—',
        rrStr: '—',
        rrCol: 'rgb(110,110,110)',
        durationStr: '—',
        totalStr: '0 (0▲ / 0▼)',
      },
      bosActive: false,
      targetHit: false,
      bosIsBull: false,
      bosLevel: null,
      targetLevel: null,
      entryPrice: null,
      slPrice: null,
      tp1Price: null,
      tp2Price: null,
      tp3Price: null,
    };
  }

  // Determine price precision for mintick formatting
  let minTickPrecision = 2;
  const sampleClose = candles[candles.length - 1].close;
  if (sampleClose < 1) minTickPrecision = 5;
  else if (sampleClose < 10) minTickPrecision = 4;
  else if (sampleClose < 100) minTickPrecision = 3;
  else minTickPrecision = 2;

  // 1. Calculate ATR (atrVal = ta.atr(atrLen))
  const atrSeries = calculateATR(candles, atrLen);

  // 2. Calculate HTF RSI based on htfRes resolution (Pine Script request.security)
  const rsiSeries = calculateHtfRsiSeries(candles, htfRes, htfRsiLen);

  // ── Persistent State Variables (mimicking var in Pine Script) ────────────────
  let lastSwingHigh: number | null = null;
  let lastSwingLow: number | null = null;
  let prevSwingHigh: number | null = null;
  let prevSwingLow: number | null = null;
  let lastSwingHighBar: number | null = null;
  let lastSwingLowBar: number | null = null;
  let trend = 0; // 1 = bull, -1 = bear, 0 = neutral
  let bosLevel: number | null = null;
  let targetLevel: number | null = null;
  let bosBar: number | null = null;
  let bosIsBull = false;
  let targetHit = false;
  let entryPrice: number | null = null;
  let slPrice: number | null = null;
  let tp1Price: number | null = null;
  let tp2Price: number | null = null;
  let tp3Price: number | null = null;
  let bosBarsCount = 0;
  let totalBos = 0;
  let bullBosCount = 0;
  let bearBosCount = 0;
  let invalidSwingRef: number | null = null;
  let lastProcessedHighBar: number | null = null;
  let lastProcessedLowBar: number | null = null;

  // Visual structures currently active
  let curBosLine: MsttLine | null = null;
  let curBosLbl: MsttLabel | null = null;
  let curEntryLine: MsttLine | null = null;
  let curSlLine: MsttLine | null = null;
  let curTp1Line: MsttLine | null = null;
  let curTp2Line: MsttLine | null = null;
  let curTp3Line: MsttLine | null = null;
  let curEntryLbl: MsttLabel | null = null;
  let curSlLbl: MsttLabel | null = null;
  let curTp1Lbl: MsttLabel | null = null;
  let curTp2Lbl: MsttLabel | null = null;
  let curTp3Lbl: MsttLabel | null = null;

  // ── Sequential Bar Execution ────────────────────────────────────────────────
  for (let bar_index = 0; bar_index < n; bar_index++) {
    const c = candles[bar_index];
    const prevAtr = bar_index > 0 && !isNaN(atrSeries[bar_index - 1]) ? atrSeries[bar_index - 1] : atrSeries[bar_index] || 1;
    const atrLocked = prevAtr;

    // HTF Bias via RSI
    const htfRsi = !isNaN(rsiSeries[bar_index]) ? rsiSeries[bar_index] : 50;
    const htfBull = htfRsi > 50.0;
    const htfBear = htfRsi < 50.0;
    const htfOkBull = !useHtfFilter || htfBull;
    const htfOkBear = !useHtfFilter || htfBear;

    // Pivot detection (ta.pivothigh / ta.pivotlow)
    // A pivot is confirmed at bar_index if the bar at (bar_index - swingLen) is the highest/lowest in range
    let ph: number | null = null;
    let pl: number | null = null;

    if (bar_index >= swingLen * 2) {
      const candidateIdx = bar_index - swingLen;
      const candidateHigh = candles[candidateIdx].high;
      const candidateLow = candles[candidateIdx].low;

      let isHigh = true;
      let isLow = true;

      for (let j = candidateIdx - swingLen; j <= candidateIdx + swingLen; j++) {
        if (j === candidateIdx) continue;
        if (candles[j].high > candidateHigh) isHigh = false;
        if (candles[j].low < candidateLow) isLow = false;
      }

      if (isHigh) ph = candidateHigh;
      if (isLow) pl = candidateLow;
    }

    if (ph !== null) {
      prevSwingHigh = lastSwingHigh;
      lastSwingHigh = ph;
      lastSwingHighBar = bar_index - swingLen;
    }

    if (pl !== null) {
      prevSwingLow = lastSwingLow;
      lastSwingLow = pl;
      lastSwingLowBar = bar_index - swingLen;
    }

    // BOS condition
    const bosBull =
      lastSwingHigh !== null &&
      c.close > lastSwingHigh &&
      htfOkBull &&
      (lastProcessedHighBar === null || lastSwingHighBar !== lastProcessedHighBar);

    const bosBear =
      lastSwingLow !== null &&
      c.close < lastSwingLow &&
      htfOkBear &&
      (lastProcessedLowBar === null || lastSwingLowBar !== lastProcessedLowBar);

    // ── Bullish BOS/CHoCH Handler ─────────────────────────────────────────────
    if (bosBull) {
      lastProcessedHighBar = lastSwingHighBar;
      const _lbl = trend === 1 ? 'BOS' : 'CHoCH';
      trend = 1;
      bosLevel = lastSwingHigh;
      targetLevel = prevSwingHigh;
      bosBar = bar_index;
      bosIsBull = true;
      targetHit = false;
      bosBarsCount = 0;
      totalBos += 1;
      bullBosCount += 1;

      entryPrice = bosLevel! + atrLocked * 0.1;
      slPrice = bosLevel! - atrLocked * slMulti;
      tp1Price = entryPrice + atrLocked * tp1Multi;
      tp2Price = entryPrice + atrLocked * tp2Multi;
      tp3Price = entryPrice + atrLocked * tp3Multi;
      invalidSwingRef = lastSwingLow;

      if (showBosLine && bosLevel !== null) {
        const _x1 = lastSwingHighBar === null ? bar_index : Math.max(lastSwingHighBar, bar_index - 499);
        curBosLine = {
          x1: _x1,
          y1: bosLevel,
          x2: bar_index,
          y2: bosLevel,
          color: colBullBos,
          width: 2,
          style: 'dashed',
        };
      }

      if (showLabel && bosLevel !== null) {
        const _x1 = lastSwingHighBar === null ? bar_index : Math.max(lastSwingHighBar, bar_index - 499);
        const _mid = Math.min(Math.round((_x1 + bar_index) / 2), bar_index);
        curBosLbl = {
          x: _mid,
          y: bosLevel,
          text: '▲ ' + _lbl,
          color: 'transparent',
          textColor: colBullBos,
          style: 'label_down',
          size: 'small',
        };
      }

      if (showTpSl && entryPrice !== null) {
        const x2Target = bar_index + 30;
        curEntryLine = { x1: bosBar, y1: entryPrice, x2: x2Target, y2: entryPrice, color: colEntry, width: 1, style: 'dashed' };
        curEntryLbl = { x: x2Target, y: entryPrice, text: '► Entry  ' + formatPrice(entryPrice, minTickPrecision), color: colEntry, textColor: colEntry, style: 'label_left', size: 'small' };

        if (showSl && slPrice !== null) {
          curSlLine = { x1: bosBar, y1: slPrice, x2: x2Target, y2: slPrice, color: colSl, width: 1, style: 'dashed' };
          curSlLbl = { x: x2Target, y: slPrice, text: '✕ SL  ' + formatPrice(slPrice, minTickPrecision), color: colSl, textColor: colSl, style: 'label_left', size: 'small' };
        } else {
          curSlLine = null;
          curSlLbl = null;
        }

        if (showTp1 && tp1Price !== null) {
          curTp1Line = { x1: bosBar, y1: tp1Price, x2: x2Target, y2: tp1Price, color: colTp1, width: 1, style: 'dashed' };
          curTp1Lbl = { x: x2Target, y: tp1Price, text: '● TP1  ' + formatPrice(tp1Price, minTickPrecision), color: colTp1, textColor: colTp1, style: 'label_left', size: 'small' };
        } else {
          curTp1Line = null;
          curTp1Lbl = null;
        }

        if (showTp2 && tp2Price !== null) {
          curTp2Line = { x1: bosBar, y1: tp2Price, x2: x2Target, y2: tp2Price, color: colTp2, width: 1, style: 'dashed' };
          curTp2Lbl = { x: x2Target, y: tp2Price, text: '★ TP2  ' + formatPrice(tp2Price, minTickPrecision), color: colTp2, textColor: colTp2, style: 'label_left', size: 'small' };
        } else {
          curTp2Line = null;
          curTp2Lbl = null;
        }

        if (showTp3 && tp3Price !== null) {
          curTp3Line = { x1: bosBar, y1: tp3Price, x2: x2Target, y2: tp3Price, color: colTp3, width: 1, style: 'dashed' };
          curTp3Lbl = { x: x2Target, y: tp3Price, text: '◆ TP3  ' + formatPrice(tp3Price, minTickPrecision), color: colTp3, textColor: colTp3, style: 'label_left', size: 'small' };
        } else {
          curTp3Line = null;
          curTp3Lbl = null;
        }
      }
    }

    // ── Bearish BOS/CHoCH Handler ─────────────────────────────────────────────
    if (bosBear) {
      lastProcessedLowBar = lastSwingLowBar;
      const _lbl = trend === -1 ? 'BOS' : 'CHoCH';
      trend = -1;
      bosLevel = lastSwingLow;
      targetLevel = prevSwingLow;
      bosBar = bar_index;
      bosIsBull = false;
      targetHit = false;
      bosBarsCount = 0;
      totalBos += 1;
      bearBosCount += 1;

      entryPrice = bosLevel! - atrLocked * 0.1;
      slPrice = bosLevel! + atrLocked * slMulti;
      tp1Price = entryPrice - atrLocked * tp1Multi;
      tp2Price = entryPrice - atrLocked * tp2Multi;
      tp3Price = entryPrice - atrLocked * tp3Multi;
      invalidSwingRef = lastSwingHigh;

      if (showBosLine && bosLevel !== null) {
        const _x1 = lastSwingLowBar === null ? bar_index : Math.max(lastSwingLowBar, bar_index - 499);
        curBosLine = {
          x1: _x1,
          y1: bosLevel,
          x2: bar_index,
          y2: bosLevel,
          color: colBearBos,
          width: 2,
          style: 'dashed',
        };
      }

      if (showLabel && bosLevel !== null) {
        const _x1 = lastSwingLowBar === null ? bar_index : Math.max(lastSwingLowBar, bar_index - 499);
        const _mid = Math.min(Math.round((_x1 + bar_index) / 2), bar_index);
        curBosLbl = {
          x: _mid,
          y: bosLevel,
          text: '▼ ' + _lbl,
          color: 'transparent',
          textColor: colBearBos,
          style: 'label_up',
          size: 'small',
        };
      }

      if (showTpSl && entryPrice !== null) {
        const x2Target = bar_index + 30;
        curEntryLine = { x1: bosBar, y1: entryPrice, x2: x2Target, y2: entryPrice, color: colEntry, width: 1, style: 'dashed' };
        curEntryLbl = { x: x2Target, y: entryPrice, text: '► Entry  ' + formatPrice(entryPrice, minTickPrecision), color: colEntry, textColor: colEntry, style: 'label_left', size: 'small' };

        if (showSl && slPrice !== null) {
          curSlLine = { x1: bosBar, y1: slPrice, x2: x2Target, y2: slPrice, color: colSl, width: 1, style: 'dashed' };
          curSlLbl = { x: x2Target, y: slPrice, text: '✕ SL  ' + formatPrice(slPrice, minTickPrecision), color: colSl, textColor: colSl, style: 'label_left', size: 'small' };
        } else {
          curSlLine = null;
          curSlLbl = null;
        }

        if (showTp1 && tp1Price !== null) {
          curTp1Line = { x1: bosBar, y1: tp1Price, x2: x2Target, y2: tp1Price, color: colTp1, width: 1, style: 'dashed' };
          curTp1Lbl = { x: x2Target, y: tp1Price, text: '● TP1  ' + formatPrice(tp1Price, minTickPrecision), color: colTp1, textColor: colTp1, style: 'label_left', size: 'small' };
        } else {
          curTp1Line = null;
          curTp1Lbl = null;
        }

        if (showTp2 && tp2Price !== null) {
          curTp2Line = { x1: bosBar, y1: tp2Price, x2: x2Target, y2: tp2Price, color: colTp2, width: 1, style: 'dashed' };
          curTp2Lbl = { x: x2Target, y: tp2Price, text: '★ TP2  ' + formatPrice(tp2Price, minTickPrecision), color: colTp2, textColor: colTp2, style: 'label_left', size: 'small' };
        } else {
          curTp2Line = null;
          curTp2Lbl = null;
        }

        if (showTp3 && tp3Price !== null) {
          curTp3Line = { x1: bosBar, y1: tp3Price, x2: x2Target, y2: tp3Price, color: colTp3, width: 1, style: 'dashed' };
          curTp3Lbl = { x: x2Target, y: tp3Price, text: '◆ TP3  ' + formatPrice(tp3Price, minTickPrecision), color: colTp3, textColor: colTp3, style: 'label_left', size: 'small' };
        } else {
          curTp3Line = null;
          curTp3Lbl = null;
        }
      }
    }

    // ── Active BOS Line Extension ─────────────────────────────────────────────
    const bosActive = bosLevel !== null && bosBar !== null;
    if (bosActive && !bosBull && !bosBear) {
      bosBarsCount += 1;
      if (showTpSl) {
        const x2Target = bar_index + 30;
        if (curEntryLine) curEntryLine.x2 = x2Target;
        if (curSlLine) curSlLine.x2 = x2Target;
        if (curTp1Line) curTp1Line.x2 = x2Target;
        if (curTp2Line) curTp2Line.x2 = x2Target;
        if (curTp3Line) curTp3Line.x2 = x2Target;
        if (curEntryLbl) curEntryLbl.x = x2Target;
        if (curSlLbl) curSlLbl.x = x2Target;
        if (curTp1Lbl) curTp1Lbl.x = x2Target;
        if (curTp2Lbl) curTp2Lbl.x = x2Target;
        if (curTp3Lbl) curTp3Lbl.x = x2Target;
      }
    }

    // ── Target Hit Detection ──────────────────────────────────────────────────
    const targetReached =
      bosActive &&
      !targetHit &&
      targetLevel !== null &&
      (bosIsBull ? c.high >= targetLevel : c.low <= targetLevel);

    if (targetReached) {
      targetHit = true;
    }

    // ── BOS Invalidation Logic ────────────────────────────────────────────────
    const invalidated =
      bosActive &&
      !targetHit &&
      invalidSwingRef !== null &&
      (bosIsBull ? c.close < invalidSwingRef : c.close > invalidSwingRef) &&
      invalidateMode;

    if (invalidated) {
      bosLevel = null;
      bosBar = null;
      targetLevel = null;
      entryPrice = null;
      slPrice = null;
      tp1Price = null;
      tp2Price = null;
      tp3Price = null;
      invalidSwingRef = null;
      trend = 0;
      lastProcessedHighBar = null;
      lastProcessedLowBar = null;

      curBosLine = null;
      curBosLbl = null;
      curEntryLine = null;
      curSlLine = null;
      curTp1Line = null;
      curTp2Line = null;
      curTp3Line = null;
      curEntryLbl = null;
      curSlLbl = null;
      curTp1Lbl = null;
      curTp2Lbl = null;
      curTp3Lbl = null;
    }
  }

  // ── Construct Line Fills ───────────────────────────────────────────────────
  let slFill: MsttLineFill | null = null;
  let tp1Fill: MsttLineFill | null = null;
  let tp2Fill: MsttLineFill | null = null;
  let tp3Fill: MsttLineFill | null = null;

  const isBosActiveNow = bosLevel !== null && bosBar !== null;

  if (isBosActiveNow && curEntryLine) {
    const x1 = curEntryLine.x1;
    const x2 = curEntryLine.x2;
    if (showSl && showSlShade && curSlLine) {
      slFill = { x1, x2, y1: curEntryLine.y1, y2: curSlLine.y1, color: colSlShade };
    }
    if (showTp1 && showTp1Shade && curTp1Line) {
      tp1Fill = { x1, x2, y1: curEntryLine.y1, y2: curTp1Line.y1, color: colTp1Shade };
    }
    if (showTp2 && showTp2Shade && curTp2Line) {
      const topBoundary = curTp1Line ? curTp1Line.y1 : curEntryLine.y1;
      tp2Fill = { x1, x2, y1: topBoundary, y2: curTp2Line.y1, color: colTp2Shade };
    }
    if (showTp3 && showTp3Shade && curTp3Line) {
      const topBoundary = curTp2Line ? curTp2Line.y1 : curTp1Line ? curTp1Line.y1 : curEntryLine.y1;
      tp3Fill = { x1, x2, y1: topBoundary, y2: curTp3Line.y1, color: colTp3Shade };
    }
  }

  // ── Dashboard String & Color Pre-computation ────────────────────────────────
  const lastBarIndex = n - 1;
  const lastCandle = candles[lastBarIndex];
  const lastHtfRsi = !isNaN(rsiSeries[lastBarIndex]) ? rsiSeries[lastBarIndex] : 50;
  const htfBull = lastHtfRsi > 50.0;

  const trendStr = trend === 1 ? '▲ Bull' : trend === -1 ? '▼ Bear' : '● Neutral';
  const trendCol = trend === 1 ? 'rgb(0,200,120)' : trend === -1 ? 'rgb(220,50,50)' : 'rgb(140,140,140)';
  const htfBarVal = lastHtfRsi;
  const htfBarStr = f_blockBar(htfBarVal, 100.0);
  const htfBarCol = f_blockColor(htfBarVal, 30.0, 50.0, 70.0);

  const bosLvlStr = isBosActiveNow && bosLevel !== null ? formatPrice(bosLevel, minTickPrecision) : '—';
  const tgtLvlStr = isBosActiveNow && targetLevel !== null ? formatPrice(targetLevel, minTickPrecision) : '—';
  const entryStr = isBosActiveNow && entryPrice !== null ? formatPrice(entryPrice, minTickPrecision) : '—';
  const slStr = isBosActiveNow && slPrice !== null ? formatPrice(slPrice, minTickPrecision) : '—';
  const tp1Str = isBosActiveNow && tp1Price !== null ? formatPrice(tp1Price, minTickPrecision) : '—';
  const tp2Str = isBosActiveNow && tp2Price !== null ? formatPrice(tp2Price, minTickPrecision) : '—';
  const tp3Str = isBosActiveNow && tp3Price !== null ? formatPrice(tp3Price, minTickPrecision) : '—';

  const tgtHitStr = targetHit ? '✓ Hit' : isBosActiveNow ? '⏳ Pending' : '—';
  const tgtHitCol = targetHit ? colHit : isBosActiveNow ? 'rgb(255,200,0)' : 'rgb(110,110,110)';
  const durationStr = isBosActiveNow ? '⏳ ' + bosBarsCount.toString() + ' Bars' : '—';
  const totalStr = totalBos.toString() + ' (' + bullBosCount.toString() + '▲ / ' + bearBosCount.toString() + '▼)';
  const htfStr = htfBull ? '▲ Bull HTF' : '▼ Bear HTF';
  const htfDirCol = htfBull ? 'rgb(0,200,120)' : 'rgb(220,50,50)';

  const _slDiff = entryPrice !== null && slPrice !== null ? Math.abs(entryPrice - slPrice) : 0;
  const rrVal =
    isBosActiveNow && tp1Price !== null && entryPrice !== null && slPrice !== null && _slDiff > 0
      ? Math.abs(tp1Price - entryPrice) / _slDiff
      : 0;

  const rrStr = isBosActiveNow ? rrVal.toFixed(2) + ' R' : '—';
  const rrCol =
    rrVal >= 2.0
      ? 'rgb(0,255,120)'
      : rrVal >= 1.5
      ? 'rgb(80,255,0)'
      : rrVal >= 1.0
      ? 'rgb(200,200,0)'
      : 'rgb(110,110,110)';

  const dashboard: MsttDashboard = {
    ticker: cleanTicker,
    tag: 'BOS [MT]',
    trendStr,
    trendCol,
    htfStr,
    htfDirCol,
    htfBarStr,
    htfBarCol,
    bosLvlStr,
    tgtLvlStr,
    tgtHitStr,
    tgtHitCol,
    entryStr,
    slStr,
    tp1Str,
    tp2Str,
    tp3Str,
    rrStr,
    rrCol,
    durationStr,
    totalStr,
  };

  return {
    bosLine: curBosLine,
    bosLabel: curBosLbl,
    entryLine: curEntryLine,
    entryLabel: curEntryLbl,
    slLine: curSlLine,
    slLabel: curSlLbl,
    tp1Line: curTp1Line,
    tp1Label: curTp1Lbl,
    tp2Line: curTp2Line,
    tp2Label: curTp2Lbl,
    tp3Line: curTp3Line,
    tp3Label: curTp3Lbl,
    slFill,
    tp1Fill,
    tp2Fill,
    tp3Fill,
    dashboard,
    bosActive: isBosActiveNow,
    targetHit,
    bosIsBull,
    bosLevel,
    targetLevel,
    entryPrice,
    slPrice,
    tp1Price,
    tp2Price,
    tp3Price,
  };
}
