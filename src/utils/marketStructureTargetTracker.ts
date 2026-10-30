/**
 * Market Tick Two [MarkitTick] — Enhanced Filters
 * Market Structure Target Tracker
 *
 * 100% Exact 1:1 Port of TradingView Pine Script v6:
 * indicator("Market Structure Target Tracker [MarkitTick] — Enhanced Filters", overlay=true, max_lines_count=500, max_labels_count=500)
 *
 * This work is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 * © MarkitTick
 */

import { Candle } from '../types';

export interface MsttOptions {
  // Group BOS
  swingLen?: number; // Swing Length (default 5, min 3, max 50)
  // Group Vis
  showBosLine?: boolean; // Show BOS Line (default true)
  showLabel?: boolean; // Show Labels (default true)
  invalidateMode?: boolean; // Auto-Invalidate (default true)
  colBullBos?: string; // Bull BOS (default rgb(0,200,120))
  colBearBos?: string; // Bear BOS (default rgb(220,50,50))
  colTarget?: string; // Target (default rgb(255,200,0))
  colHit?: string; // Target Hit (default rgb(180,100,255))
  // Group SL/TP
  showTpSl?: boolean; // Show Entry/SL/TP (default true)
  slMulti?: number; // SL ATR Multi (default 1.0, min 0.1, max 10.0)
  tp1Multi?: number; // TP1 ATR Multi (default 1.5, min 0.1, max 20.0)
  tp2Multi?: number; // TP2 ATR Multi (default 3.0, min 0.1, max 20.0)
  tp3Multi?: number; // TP3 ATR Multi (default 5.0, min 0.1, max 20.0)
  atrLen?: number; // ATR Length (default 14, min 1, max 50)
  colEntry?: string; // Entry (default rgb(100,180,255))
  colSl?: string; // SL (default rgb(255,60,60))
  colTp1?: string; // TP1 (default rgb(0,220,130))
  colTp2?: string; // TP2 (default rgb(0,255,180))
  colTp3?: string; // TP3 (default rgb(0,255,255))
  showSl?: boolean; // Show SL line & label (default true)
  showTp1?: boolean; // Show TP1 line & label (default true)
  showTp2?: boolean; // Show TP2 line & label (default true)
  showTp3?: boolean; // Show TP3 line & label (default true)
  showSlShade?: boolean; // Show SL shade fill (default true)
  showTp1Shade?: boolean; // Show TP1 shade fill (default true)
  showTp2Shade?: boolean; // Show TP2 shade fill (default true)
  showTp3Shade?: boolean; // Show TP3 shade fill (default true)
  // Group HTF
  htfRes?: string; // HTF (default "240")
  useHtfFilter?: boolean; // HTF RSI Filter (default false)
  htfRsiLen?: number; // HTF RSI Len (default 14, min 2)
  // Group Alerts
  alertBos?: boolean; // BOS Alert (default true)
  alertTarget?: boolean; // Target Alert (default true)
  // Group Dash
  showDashboard?: boolean; // Show Dashboard (default true)
  dashBgColor?: string; // BG (default rgb(10,10,18))
  dashTxtColor?: string; // Text (default rgb(220,220,235))
  keepN?: number; // Number of trades to keep / evaluate in HUD (default 10, min 1, max 100)
  targetFocus?: 'TP1' | 'TP2' | 'TP3' | 'TP1_AND_TP2' | 'ALL'; // Target level for WIN determination (default 'TP1')
  targetMode?: 'atr' | 'points'; // Sizing mode: ATR Multiplier vs Exact Points (default 'atr')
  pointsSl?: number; // Stop Loss Size in Points/Pips (default 220)
  pointsTp1?: number; // TP1 Size in Points/Pips (default 1030)
  pointsTp2?: number; // TP2 Size in Points/Pips (default 2060)
  pointsTp3?: number; // TP3 Size in Points/Pips (default 3090)
  // Group Advanced Filters (Enhanced Filters Edition)
  useStructureFilter?: boolean; // 15M Structure Bias Filter (default true)
  structureTf?: string; // Structure Timeframe (default "15")
  filterSwingLen?: number; // Structure Swing Length (default 5, min 2, max 20)
  useWickFilter?: boolean; // Extreme Wick Filter (default true)
  maxWickRatio?: number; // Max Relevant Wick / Candle Range (default 0.70, min 0.10, max 0.95)
  useSweepFilter?: boolean; // Liquidity Sweep Filter (default false)
  sweepLookback?: number; // Sweep Lookback Bars (default 10, min 1, max 50)
  // New Enhanced Filters v2 Edition
  useBodyCloseFilter?: boolean; // Candle Body Close Confirmation (default true)
  minBodyRatio?: number; // Minimum Body / Candle Range (default 0.50, min 0.10, max 0.95)
  useDisplacementFilter?: boolean; // Displacement Candle Filter (default true)
  minDisplacementAtr?: number; // Minimum Body Size (ATR x) (default 0.80, min 0.10, max 3.0)
  useFvgFilter?: boolean; // Fair Value Gap (FVG) Confirmation (default false)
  useVolumeFilter?: boolean; // Relative Volume Confirmation (default false)
  volumeLength?: number; // Volume Average Length (default 20, min 2, max 100)
  volumeMultiplier?: number; // Volume vs Average (default 1.20, min 1.0, max 5.0)
  useScoreFilter?: boolean; // Continuation Confluence Score Filter (default false)
  minContinuationScore?: number; // Minimum Continuation Score (0-100) (default 60, min 20, max 100)
  preventLateEntry?: boolean; // Block signals that appear late after breakout or when target already reached (default: true)
  maxBreakoutDelay?: number; // Max delay candles between breakout and signal (default: 1, min: 0, max: 3)
  // Signal Quality Filters (EMA Trend, ADX + DI, Strong Breakout Candle)
  useEmaFilter?: boolean; // EMA Trend Filter (default: false)
  emaLen?: number; // EMA Length (default: 200, min: 20, max: 500)
  useAdxFilter?: boolean; // ADX + DI Filter (default: false)
  diLen?: number; // DI Length (default: 14, min: 2, max: 50)
  adxSmooth?: number; // ADX Smoothing (default: 14, min: 2, max: 50)
  minAdx?: number; // Minimum ADX (default: 18.0, min: 5.0, max: 50.0)
  useCandleFilter?: boolean; // Strong Breakout Candle (default: false)
  minBodyAtr?: number; // Minimum Candle Body (ATR) (default: 0.20)
  breakoutBufferAtr?: number; // Breakout Buffer (ATR) (default: 0.00)
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

export interface MsttSignalMarker {
  barIndex: number;
  time: number;
  type: 'bull' | 'bear';
  price: number;
  text: 'BOS' | 'CHoCH';
  color: string;
  entryPrice?: number;
  slPrice?: number;
  tp1Price?: number;
  tp2Price?: number;
  tp3Price?: number;
}

export interface MsttHistoricalTrade {
  id: number;
  dir: 'BULL' | 'BEAR';
  entryBar: number;
  entryTime?: number;
  endBar: number;
  endTime?: number;
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  exitPrice: number;
  exitReason: string;
  isWin: boolean;
  barsHeld: number;
  pipsText?: string;
  filterFlags?: string;
}

export interface MsttTradeStats {
  totalTrades: number;
  totalAllTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  consecWins: number;
  consecLosses: number;
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
  recentTrades: MsttHistoricalTrade[];
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
  structStr: string;
  structCol: string;
  filterStr: string;
  bosLvlStr: string;
  tgtLvlStr: string;
  tgtHitStr: string;
  tgtHitCol: string;
  entryStr: string;
  slStr: string;
  tp1Str: string;
  tp2Str: string;
  tp3Str: string;
  showTp1: boolean;
  showTp2: boolean;
  showTp3: boolean;
  showSl: boolean;
  targetFocus: string;
  rrStr: string;
  rrCol: string;
  durationStr: string;
  totalStr: string;
  // KeepN Trade Performance stats
  keepN: number;
  totalTradesStr: string;
  winLossStr: string;
  winRateStr: string;
  winRateCol: string;
  consecStr: string;
  stats?: MsttTradeStats;
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
  // Shaded fills (slFill, tp1Fill, tp2Fill, tp3Fill)
  slFill: MsttLineFill | null;
  tp1Fill: MsttLineFill | null;
  tp2Fill: MsttLineFill | null;
  tp3Fill: MsttLineFill | null;
  // Chart markers (plotshape for Bullish & Bearish BOS)
  signalMarkers: MsttSignalMarker[];
  // Dashboard (17 rows matching Pine Script v6 + Trade Scorecard & Audit)
  dashboard: MsttDashboard;
  // Trade stats & history
  stats: MsttTradeStats;
  historicalTrades: MsttHistoricalTrade[];
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
  // Webhook Alert Payloads
  lastBosAlert?: string | null;
  lastTargetAlert?: string | null;
  // Confluence Scores (0-100)
  bullScore?: number;
  bearScore?: number;
}

// ── SMA calculation (Pine Script ta.sma) ──────────────────────────────────────
export function calculateSMA(values: number[], length: number): number[] {
  const n = values.length;
  const result: number[] = new Array(n).fill(NaN);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
    if (i >= length) {
      sum -= values[i - length];
    }
    if (i >= length - 1) {
      result[i] = sum / length;
    }
  }
  return result;
}

// ── EMA calculation (Pine Script ta.ema) ──────────────────────────────────────
export function calculateEMA(values: number[], length: number): number[] {
  const n = values.length;
  const result: number[] = new Array(n).fill(NaN);
  if (n === 0 || length <= 0) return result;
  const k = 2 / (length + 1);
  let sum = 0;
  const seedLen = Math.min(length, n);
  for (let i = 0; i < seedLen; i++) sum += values[i];
  let curEma = sum / seedLen;
  result[seedLen - 1] = curEma;
  for (let i = seedLen; i < n; i++) {
    curEma = values[i] * k + curEma * (1 - k);
    result[i] = curEma;
  }
  return result;
}

// ── ADX + DI calculation (Pine Script ta.dmi) ─────────────────────────────────
export function calculateMsttADX(
  candles: Candle[],
  diLen = 14,
  adxLen = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const n = candles.length;
  const adx = new Array(n).fill(NaN);
  const plusDI = new Array(n).fill(NaN);
  const minusDI = new Array(n).fill(NaN);
  if (n <= diLen) return { adx, plusDI, minusDI };

  const tr: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);

  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);

    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }

  let sTR = 0;
  let sPlus = 0;
  let sMinus = 0;
  for (let i = 0; i < diLen; i++) {
    sTR += tr[i];
    sPlus += plusDM[i];
    sMinus += minusDM[i];
  }

  const dx: number[] = new Array(n).fill(NaN);
  for (let i = diLen; i < n; i++) {
    sTR = sTR - sTR / diLen + tr[i];
    sPlus = sPlus - sPlus / diLen + plusDM[i];
    sMinus = sMinus - sMinus / diLen + minusDM[i];

    const pDI = sTR > 0 ? (sPlus / sTR) * 100 : 0;
    const mDI = sTR > 0 ? (sMinus / sTR) * 100 : 0;
    plusDI[i] = pDI;
    minusDI[i] = mDI;

    const diff = Math.abs(pDI - mDI);
    const sum = pDI + mDI;
    dx[i] = sum > 0 ? (diff / sum) * 100 : 0;
  }

  let sDX = 0;
  const startAdx = diLen + adxLen;
  if (n >= startAdx) {
    for (let i = diLen; i < startAdx; i++) sDX += isNaN(dx[i]) ? 0 : dx[i];
    let curAdx = sDX / adxLen;
    adx[startAdx - 1] = curAdx;
    for (let i = startAdx; i < n; i++) {
      curAdx = (curAdx * (adxLen - 1) + (isNaN(dx[i]) ? 0 : dx[i])) / adxLen;
      adx[i] = curAdx;
    }
  }

  return { adx, plusDI, minusDI };
}

// ── RMA calculation (Pine Script ta.rma / Wilder's Smoothing) ─────────────────
export function calculateRMA(values: number[], length: number): number[] {
  const n = values.length;
  const result: number[] = new Array(n);
  const alpha = 1 / length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (i < length) {
      sum += values[i];
      if (i === length - 1) {
        result[i] = sum / length;
      } else {
        result[i] = NaN;
      }
    } else {
      const prev = isNaN(result[i - 1]) ? values[i] : result[i - 1];
      result[i] = alpha * values[i] + (1 - alpha) * prev;
    }
  }
  return result;
}

// ── ATR calculation (Pine Script ta.atr) ───────────────────────────────────────
export function calculateATR(candles: Candle[], length: number): number[] {
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
export function calculateRSI(values: number[], length: number): number[] {
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

// ── Resolution parser ─────────────────────────────────────────────────────────
function parseTfMinutes(res: string): number {
  const clean = String(res).trim().toUpperCase();
  if (clean === 'D' || clean === '1D' || clean === '1440') return 1440;
  if (clean === '4H' || clean === '240') return 240;
  if (clean === '2H' || clean === '120') return 120;
  if (clean === '1H' || clean === '60') return 60;
  if (clean === '30' || clean === '30M') return 30;
  if (clean === '15' || clean === '15M') return 15;
  if (clean === '5' || clean === '5M') return 5;
  if (clean === '1' || clean === '1M') return 1;
  const num = parseInt(clean, 10);
  return isNaN(num) || num <= 0 ? 15 : num;
}

// ── HTF RSI & Macro Regime Calculation (Pine Script request.security(..., htfRes)) ──
interface HtfRegimeResult {
  rsiSeries: number[];
  emaSeries: number[];
  htfTrend: ('BULL' | 'BEAR' | 'CHOP')[];
}

function calculateHtfRegimeSeries(candles: Candle[], htfRes: string, htfRsiLen: number, htfEmaLen = 50): HtfRegimeResult {
  const n = candles.length;
  if (n === 0) return { rsiSeries: [], emaSeries: [], htfTrend: [] };
  const closeSeries = candles.map((c) => c.close);
  if (n < 2) {
    const rsi = calculateRSI(closeSeries, htfRsiLen);
    const ema = calculateEMA(closeSeries, htfEmaLen);
    const trend = rsi.map((r) => (r > 50 ? 'BULL' : r < 50 ? 'BEAR' : 'CHOP'));
    return { rsiSeries: rsi, emaSeries: ema, htfTrend: trend as any };
  }

  const htfMin = parseTfMinutes(htfRes);
  const htfSec = htfMin * 60;

  const isMs = candles[0].time > 1e11;
  const diffTime = Math.abs(candles[n - 1].time - candles[0].time);
  const chartIntervalSec = Math.max(10, isMs ? diffTime / (n - 1) / 1000 : diffTime / (n - 1));

  if (chartIntervalSec >= htfSec) {
    const rsi = calculateRSI(closeSeries, htfRsiLen);
    const ema = calculateEMA(closeSeries, htfEmaLen);
    const trend = rsi.map((r, i) => {
      const isBull = r >= 48 && (!isNaN(ema[i]) ? closeSeries[i] >= ema[i] * 0.99 : true);
      const isBear = r <= 52 && (!isNaN(ema[i]) ? closeSeries[i] <= ema[i] * 1.01 : true);
      return isBull && !isBear ? 'BULL' : isBear && !isBull ? 'BEAR' : 'CHOP';
    });
    return { rsiSeries: rsi, emaSeries: ema, htfTrend: trend as any };
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

  if (buckets.length >= 5) {
    const bucketCloses = buckets.map((b) => b.close);
    const bucketRsi = calculateRSI(bucketCloses, htfRsiLen);
    const effEmaLen = Math.min(htfEmaLen, Math.max(5, Math.floor(buckets.length / 2)));
    const bucketEma = calculateEMA(bucketCloses, effEmaLen);

    const rsiRes = new Array(n);
    const emaRes = new Array(n);
    const trendRes: ('BULL' | 'BEAR' | 'CHOP')[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const bIdx = candleBucketIndices[i];
      // lookahead=barmerge.lookahead_off: uses previous completed bar bucket
      const prevBIdx = Math.max(0, bIdx - 1);
      const r = !isNaN(bucketRsi[prevBIdx]) ? bucketRsi[prevBIdx] : 50;
      const e = !isNaN(bucketEma[prevBIdx]) ? bucketEma[prevBIdx] : candles[i].close;
      rsiRes[i] = r;
      emaRes[i] = e;

      const isBull = r >= 48 && candles[i].close >= e * 0.99;
      const isBear = r <= 52 && candles[i].close <= e * 1.01;
      trendRes[i] = isBull && !isBear ? 'BULL' : isBear && !isBull ? 'BEAR' : 'CHOP';
    }
    return { rsiSeries: rsiRes, emaSeries: emaRes, htfTrend: trendRes };
  }

  const ratio = Math.max(1, Math.round(htfSec / chartIntervalSec));
  const effectiveLen = Math.max(2, Math.min(200, Math.round(htfRsiLen * ratio)));
  const rsi = calculateRSI(closeSeries, effectiveLen);
  const ema = calculateEMA(closeSeries, Math.min(50 * ratio, 200));
  const trend = rsi.map((r, i) => {
    const isBull = r >= 48 && (!isNaN(ema[i]) ? closeSeries[i] >= ema[i] * 0.99 : true);
    const isBear = r <= 52 && (!isNaN(ema[i]) ? closeSeries[i] <= ema[i] * 1.01 : true);
    return isBull && !isBear ? 'BULL' : isBear && !isBull ? 'BEAR' : 'CHOP';
  });
  return { rsiSeries: rsi, emaSeries: ema, htfTrend: trend as any };
}

// ── Structure Bias Filter Calculation (HH/HL or LH/LL on structureTf) ─────────
// structPH = request.security(syminfo.tickerid, structureTf, ta.pivothigh(high, filterSwingLen, filterSwingLen))
// structPL = request.security(syminfo.tickerid, structureTf, ta.pivotlow(low, filterSwingLen, filterSwingLen))
function calculateStructurePivotsSeries(
  candles: Candle[],
  structureTf: string,
  filterSwingLen: number
): { structPH: (number | null)[]; structPL: (number | null)[] } {
  const n = candles.length;
  const structPHArr: (number | null)[] = new Array(n).fill(null);
  const structPLArr: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return { structPH: structPHArr, structPL: structPLArr };

  const sMin = parseTfMinutes(structureTf);
  const sSec = sMin * 60;
  const isMs = candles[0].time > 1e11;
  const diffTime = Math.abs(candles[n - 1].time - candles[0].time);
  const chartIntervalSec = Math.max(10, isMs ? diffTime / (n - 1) / 1000 : diffTime / (n - 1));

  // If chart timeframe >= structure timeframe or too few candles, calculate directly on candles
  if (chartIntervalSec >= sSec || n < (filterSwingLen * 2 + 1) * 3) {
    for (let i = filterSwingLen * 2; i < n; i++) {
      const pivotIdx = i - filterSwingLen;
      const pivotHigh = candles[pivotIdx].high;
      const pivotLow = candles[pivotIdx].low;
      let isHigh = true;
      let isLow = true;
      for (let j = pivotIdx - filterSwingLen; j <= pivotIdx + filterSwingLen; j++) {
        if (j === pivotIdx) continue;
        if (candles[j].high > pivotHigh) isHigh = false;
        if (candles[j].low < pivotLow) isLow = false;
      }
      if (isHigh) structPHArr[i] = pivotHigh;
      if (isLow) structPLArr[i] = pivotLow;
    }
    return { structPH: structPHArr, structPL: structPLArr };
  }

  // Resample candles into structure timeframe bars
  interface ResampleBar {
    bucketId: number;
    high: number;
    low: number;
    close: number;
    time: number;
    firstIndex: number;
    lastIndex: number;
  }
  const buckets: ResampleBar[] = [];
  const candleToBucket: number[] = new Array(n);
  let curBId = -1;

  for (let i = 0; i < n; i++) {
    const tSec = isMs ? candles[i].time / 1000 : candles[i].time;
    const bId = Math.floor(tSec / sSec);
    if (bId !== curBId) {
      curBId = bId;
      buckets.push({
        bucketId: bId,
        high: candles[i].high,
        low: candles[i].low,
        close: candles[i].close,
        time: candles[i].time,
        firstIndex: i,
        lastIndex: i,
      });
    } else {
      const cur = buckets[buckets.length - 1];
      cur.high = Math.max(cur.high, candles[i].high);
      cur.low = Math.min(cur.low, candles[i].low);
      cur.close = candles[i].close;
      cur.lastIndex = i;
    }
    candleToBucket[i] = buckets.length - 1;
  }

  const numBuckets = buckets.length;
  const bPH: (number | null)[] = new Array(numBuckets).fill(null);
  const bPL: (number | null)[] = new Array(numBuckets).fill(null);

  for (let b = filterSwingLen * 2; b < numBuckets; b++) {
    const pIdx = b - filterSwingLen;
    const pHigh = buckets[pIdx].high;
    const pLow = buckets[pIdx].low;
    let isH = true;
    let isL = true;
    for (let k = pIdx - filterSwingLen; k <= pIdx + filterSwingLen; k++) {
      if (k === pIdx) continue;
      if (buckets[k].high > pHigh) isH = false;
      if (buckets[k].low < pLow) isL = false;
    }
    if (isH) bPH[b] = pHigh;
    if (isL) bPL[b] = pLow;
  }

  for (let i = 0; i < n; i++) {
    const bIdx = candleToBucket[i];
    // In Pine Script with lookahead=barmerge.lookahead_off, values update when confirmed
    if (bPH[bIdx] !== null && i === buckets[bIdx].lastIndex) {
      structPHArr[i] = bPH[bIdx];
    }
    if (bPL[bIdx] !== null && i === buckets[bIdx].lastIndex) {
      structPLArr[i] = bPL[bIdx];
    }
  }

  return { structPH: structPHArr, structPL: structPLArr };
}

// ── Dashboard Helper Functions (Pine Script exact match) ───────────────────────
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
 * 100% Exact 1:1 Execution of Market Structure Target Tracker [MarkitTick] — Enhanced Filters (Market Tick Two)
 */
export function calculateMarketStructureTargetTracker(
  candles: Candle[],
  options: MsttOptions = {},
  cleanTicker = 'MARKET'
): MsttResult {
  // Input Groups
  const swingLen = Math.max(3, Math.min(50, Math.round(options.swingLen ?? 5)));
  const showBosLine = options.showBosLine ?? true;
  const showLabel = options.showLabel ?? true;
  const invalidateMode = options.invalidateMode ?? true;
  const colBullBos = options.colBullBos ?? 'rgb(0, 200, 120)';
  const colBearBos = options.colBearBos ?? 'rgb(220, 50, 50)';
  const colTarget = options.colTarget ?? 'rgb(255, 200, 0)';
  const colHit = options.colHit ?? 'rgb(180, 100, 255)';

  // SL/TP
  const showTpSl = options.showTpSl ?? true;
  const targetMode = options.targetMode ?? 'atr';
  const slMulti = options.slMulti ?? 1.0;
  const tp1Multi = options.tp1Multi ?? 1.5;
  const tp2Multi = options.tp2Multi ?? 2.5;
  const tp3Multi = options.tp3Multi ?? 5.0;
  const pointsSl = options.pointsSl ?? 220;
  const pointsTp1 = options.pointsTp1 ?? 1030;
  const pointsTp2 = options.pointsTp2 ?? 2060;
  const pointsTp3 = options.pointsTp3 ?? 3090;
  const atrLen = Math.max(1, Math.min(50, Math.round(options.atrLen ?? 14)));
  const colEntry = options.colEntry ?? 'rgb(100, 180, 255)';
  const colSl = options.colSl ?? 'rgb(255, 60, 60)';
  const colTp1 = options.colTp1 ?? 'rgb(0, 220, 130)';
  const colTp2 = options.colTp2 ?? 'rgb(0, 255, 180)';
  const colTp3 = options.colTp3 ?? 'rgb(0, 255, 255)';

  const targetFocus = options.targetFocus ?? 'TP1';
  const showSl = options.showSl ?? true;
  // Synchronize target visibility strictly with targetFocus:
  // - 'TP1': shows ONLY TP1
  // - 'TP2': shows ONLY TP2
  // - 'TP1_AND_TP2': shows BOTH TP1 & TP2
  // - 'TP3': shows ONLY TP3
  // - 'ALL': shows TP1, TP2, TP3
  const focusShowsTp1 = targetFocus === 'TP1' || targetFocus === 'TP1_AND_TP2' || targetFocus === 'ALL';
  const focusShowsTp2 = targetFocus === 'TP2' || targetFocus === 'TP1_AND_TP2' || targetFocus === 'ALL';
  const focusShowsTp3 = targetFocus === 'TP3' || targetFocus === 'ALL';

  const showTp1 = options.showTp1 !== undefined ? (options.showTp1 && focusShowsTp1) : focusShowsTp1;
  const showTp2 = options.showTp2 !== undefined ? (options.showTp2 && focusShowsTp2) : focusShowsTp2;
  const showTp3 = options.showTp3 !== undefined ? (options.showTp3 && focusShowsTp3) : focusShowsTp3;
  const showSlShade = options.showSlShade ?? true;
  const showTp1Shade = options.showTp1Shade !== undefined ? (options.showTp1Shade && showTp1) : showTp1;
  const showTp2Shade = options.showTp2Shade !== undefined ? (options.showTp2Shade && showTp2) : showTp2;
  const showTp3Shade = options.showTp3Shade !== undefined ? (options.showTp3Shade && showTp3) : showTp3;

  // HTF Regime Filter (Default true to block chop / counter-trend fakeouts)
  const htfRes = options.htfRes ?? '240';
  const useHtfFilter = options.useHtfFilter ?? true;
  const htfRsiLen = Math.max(2, Math.round(options.htfRsiLen ?? 14));

  // Alerts
  const alertBos = options.alertBos ?? true;
  const alertTarget = options.alertTarget ?? true;

  // Advanced Filters (Enhanced Filters Edition)
  const useStructureFilter = options.useStructureFilter ?? true;
  const structureTf = options.structureTf ?? '15';
  const filterSwingLen = Math.max(2, Math.min(20, Math.round(options.filterSwingLen ?? 5)));
  const useWickFilter = options.useWickFilter ?? true;
  const maxWickRatio = options.maxWickRatio ?? 0.70;
  const useSweepFilter = options.useSweepFilter ?? false;
  const sweepLookback = Math.max(1, Math.min(50, Math.round(options.sweepLookback ?? 10)));
  // New Enhanced Filters v2 Edition
  const useBodyCloseFilter = options.useBodyCloseFilter ?? true;
  const minBodyRatio = options.minBodyRatio ?? 0.50;
  const useDisplacementFilter = options.useDisplacementFilter ?? true;
  const minDisplacementAtr = options.minDisplacementAtr ?? 0.80;
  const useFvgFilter = options.useFvgFilter ?? false;
  const useVolumeFilter = options.useVolumeFilter ?? false;
  const volumeLength = Math.max(2, Math.min(100, Math.round(options.volumeLength ?? 20)));
  const volumeMultiplier = options.volumeMultiplier ?? 1.20;
  const useScoreFilter = options.useScoreFilter ?? false;
  const minContinuationScore = Math.max(20, Math.min(100, Math.round(options.minContinuationScore ?? 60)));
  const keepN = Math.max(0, Math.min(1000, Math.round(options.keepN ?? 10)));
  const preventLateEntry = options.preventLateEntry ?? true;
  const maxBreakoutDelay = Math.max(0, Math.min(3, Math.round(options.maxBreakoutDelay ?? 1)));

  // Signal Quality Filters (EMA, ADX + DI Regime Engine, Strong Breakout Candle)
  const useEmaFilter = options.useEmaFilter ?? false;
  const emaLen = Math.max(20, Math.min(500, Math.round(options.emaLen ?? 200)));
  const useAdxFilter = options.useAdxFilter ?? true;
  const diLen = Math.max(2, Math.min(50, Math.round(options.diLen ?? 14)));
  const adxSmooth = Math.max(2, Math.min(50, Math.round(options.adxSmooth ?? 14)));
  const minAdx = options.minAdx ?? 20.0;
  const useCandleFilter = options.useCandleFilter ?? false;
  const minBodyAtr = options.minBodyAtr ?? 0.20;
  const breakoutBufferAtr = options.breakoutBufferAtr ?? 0.00;

  const n = candles.length;
  if (n === 0) {
    const emptyStats: MsttTradeStats = {
      totalTrades: 0,
      totalAllTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      consecWins: 0,
      consecLosses: 0,
      tp1Hits: 0,
      tp2Hits: 0,
      tp3Hits: 0,
      recentTrades: [],
    };

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
      signalMarkers: [],
      dashboard: {
        ticker: cleanTicker,
        tag: 'BOS [MT]',
        trendStr: '● Neutral',
        trendCol: 'rgb(140, 140, 140)',
        htfStr: '● Neutral HTF',
        htfDirCol: 'rgb(140, 140, 140)',
        htfBarStr: '░░░░░░░░░░ 0%',
        htfBarCol: 'rgb(110, 110, 110)',
        structStr: '● Mixed',
        structCol: 'rgb(140, 140, 140)',
        filterStr: 'OFF',
        bosLvlStr: '—',
        tgtLvlStr: '—',
        tgtHitStr: '—',
        tgtHitCol: 'rgb(110, 110, 110)',
        entryStr: '—',
        slStr: '—',
        tp1Str: '—',
        tp2Str: '—',
        tp3Str: '—',
        showTp1,
        showTp2,
        showTp3,
        showSl,
        targetFocus,
        rrStr: '—',
        rrCol: 'rgb(110, 110, 110)',
        durationStr: '—',
        totalStr: '0 (0▲ / 0▼)',
        keepN,
        totalTradesStr: '0 Trades',
        winLossStr: '0W · 0L',
        winRateStr: '0.0%',
        winRateCol: 'rgb(140, 140, 140)',
        consecStr: '0W · 0L',
        stats: emptyStats,
      },
      stats: emptyStats,
      historicalTrades: [],
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
      lastBosAlert: null,
      lastTargetAlert: null,
      bullScore: 0,
      bearScore: 0,
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

  // 2. Calculate Volume Average (ta.sma(volume, volumeLength))
  const volumeSeries = candles.map((c) => c.volume ?? 0);
  const volAvgSeries = calculateSMA(volumeSeries, volumeLength);

  // 3. Calculate HTF RSI & Macro Trend based on htfRes
  const { rsiSeries, emaSeries: htfEmaSeries, htfTrend: htfTrendSeries } = calculateHtfRegimeSeries(candles, htfRes, htfRsiLen);

  // 4. Calculate Structure Pivots for Structure Bias Filter (15m HH/HL vs LH/LL)
  const { structPH: structPHSeries, structPL: structPLSeries } = calculateStructurePivotsSeries(
    candles,
    structureTf,
    filterSwingLen
  );

  // 5. Calculate EMA series if EMA filter enabled
  const emaSeries = useEmaFilter ? calculateEMA(candles.map((c) => c.close), emaLen) : [];

  // 6. Calculate ADX + DI series if ADX filter enabled
  const { adx: adxSeries, plusDI: pdiSeries, minusDI: mdiSeries } = useAdxFilter
    ? calculateMsttADX(candles, diLen, adxSmooth)
    : { adx: [], plusDI: [], minusDI: [] };

  // ── Persistent State Variables (mimicking Pine Script var declarations) ──────
  let prevStructHigh: number | null = null;
  let lastStructHigh: number | null = null;
  let prevStructLow: number | null = null;
  let lastStructLow: number | null = null;
  let seenStructPH: number | null = null;
  let seenStructPL: number | null = null;

  let lastBullScore = 0;
  let lastBearScore = 0;

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
  let bosBarTime: number | null = null;
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
  let firstBreakHighBar: number | null = null;
  let firstBreakLowBar: number | null = null;

  let lastBullSweepBar: number | null = null;
  let lastBearSweepBar: number | null = null;

  // Active drawings (Pine Script line.new, label.new)
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

  // Trade Simulation & Audit Log (Win/Loss, Consecutive W/L, KeepN)
  interface ActiveTradeState {
    id: number;
    dir: 'BULL' | 'BEAR';
    entryBar: number;
    entryTime: number;
    entryPrice: number;
    slPrice: number;
    tp1Price: number;
    tp2Price: number;
    tp3Price: number;
    filterFlags?: string;
  }
  let activeTrade: ActiveTradeState | null = null;
  const completedTrades: MsttHistoricalTrade[] = [];
  let nextTradeId = 1;

  // Historical plotshape signals
  const signalMarkers: MsttSignalMarker[] = [];
  let lastBosAlert: string | null = null;
  let lastTargetAlert: string | null = null;

  // ── Sequential Bar Execution (1:1 with Pine Script execution engine) ────────
  for (let bar_index = 0; bar_index < n; bar_index++) {
    const c = candles[bar_index];
    const atrVal = !isNaN(atrSeries[bar_index]) ? atrSeries[bar_index] : 0;
    const atrLocked = bar_index > 0 && !isNaN(atrSeries[bar_index - 1]) ? atrSeries[bar_index - 1] : atrVal;

    // ── Evaluate Open Trade Simulation on Current Bar ────────────────────────
    if (activeTrade !== null && bar_index > activeTrade.entryBar) {
      if (activeTrade.dir === 'BULL') {
        const slHit = c.low <= activeTrade.slPrice;
        const tp1Hit = c.high >= activeTrade.tp1Price;
        const tp2Hit = c.high >= activeTrade.tp2Price;
        const tp3Hit = c.high >= activeTrade.tp3Price;

        // Conservative risk priority: if both SL and TP hit on same candle, SL takes priority (LOSS)
        if (slHit) {
          completedTrades.push({
            id: activeTrade.id,
            dir: 'BULL',
            entryBar: activeTrade.entryBar,
            entryTime: activeTrade.entryTime,
            endBar: bar_index,
            endTime: c.time,
            entryPrice: activeTrade.entryPrice,
            slPrice: activeTrade.slPrice,
            tp1Price: activeTrade.tp1Price,
            tp2Price: activeTrade.tp2Price,
            tp3Price: activeTrade.tp3Price,
            exitPrice: activeTrade.slPrice,
            exitReason: 'Stop Loss Hit (Loss)',
            isWin: false,
            barsHeld: bar_index - activeTrade.entryBar,
            pipsText: `-${Math.abs(activeTrade.entryPrice - activeTrade.slPrice).toFixed(1)} pts`,
            filterFlags: activeTrade.filterFlags,
          });
          if (curEntryLine) curEntryLine.x2 = bar_index;
          if (curSlLine) curSlLine.x2 = bar_index;
          if (curTp1Line) curTp1Line.x2 = bar_index;
          if (curTp2Line) curTp2Line.x2 = bar_index;
          if (curTp3Line) curTp3Line.x2 = bar_index;
          if (curSlLbl) {
            curSlLbl.x = bar_index;
            curSlLbl.text = '✕ SL Hit  ' + formatPrice(activeTrade.slPrice, minTickPrecision);
          }
          activeTrade = null;
        } else {
          let isTargetReached = false;
          let hitReason = 'Target Hit (Win)';
          let exitP = activeTrade.tp1Price;

          if (targetFocus === 'TP1') {
            if (tp1Hit) {
              isTargetReached = true;
              hitReason = 'TP1 Hit (Win)';
              exitP = activeTrade.tp1Price;
            }
          } else if (targetFocus === 'TP2') {
            if (tp2Hit) {
              isTargetReached = true;
              hitReason = 'TP2 Hit (Win)';
              exitP = activeTrade.tp2Price;
            }
          } else if (targetFocus === 'TP1_AND_TP2') {
            if (tp2Hit) {
              isTargetReached = true;
              hitReason = 'TP2 Hit (Win)';
              exitP = activeTrade.tp2Price;
            } else if (tp1Hit) {
              isTargetReached = true;
              hitReason = 'TP1 Hit (Win)';
              exitP = activeTrade.tp1Price;
            }
          } else if (targetFocus === 'TP3') {
            if (tp3Hit) {
              isTargetReached = true;
              hitReason = 'TP3 Hit (Win)';
              exitP = activeTrade.tp3Price;
            }
          } else {
            // 'ALL'
            if (tp3Hit) {
              isTargetReached = true;
              hitReason = 'TP3 Hit (Win)';
              exitP = activeTrade.tp3Price;
            } else if (tp2Hit) {
              isTargetReached = true;
              hitReason = 'TP2 Hit (Win)';
              exitP = activeTrade.tp2Price;
            } else if (tp1Hit) {
              isTargetReached = true;
              hitReason = 'TP1 Hit (Win)';
              exitP = activeTrade.tp1Price;
            }
          }

          if (isTargetReached) {
            completedTrades.push({
              id: activeTrade.id,
              dir: 'BULL',
              entryBar: activeTrade.entryBar,
              entryTime: activeTrade.entryTime,
              endBar: bar_index,
              endTime: c.time,
              entryPrice: activeTrade.entryPrice,
              slPrice: activeTrade.slPrice,
              tp1Price: activeTrade.tp1Price,
              tp2Price: activeTrade.tp2Price,
              tp3Price: activeTrade.tp3Price,
              exitPrice: exitP,
              exitReason: hitReason,
              isWin: true,
              barsHeld: bar_index - activeTrade.entryBar,
              pipsText: `+${Math.abs(exitP - activeTrade.entryPrice).toFixed(1)} pts`,
              filterFlags: activeTrade.filterFlags,
            });
            if (curEntryLine) curEntryLine.x2 = bar_index;
            if (curSlLine) curSlLine.x2 = bar_index;
            if (curTp1Line) curTp1Line.x2 = bar_index;
            if (curTp2Line) curTp2Line.x2 = bar_index;
            if (curTp3Line) curTp3Line.x2 = bar_index;
            if (curTp1Lbl) {
              curTp1Lbl.x = bar_index;
              curTp1Lbl.text = '✓ Target Hit  ' + formatPrice(exitP, minTickPrecision);
            }
            activeTrade = null;
          }
        }
      } else {
        // BEAR Trade
        const slHit = c.high >= activeTrade.slPrice;
        const tp1Hit = c.low <= activeTrade.tp1Price;
        const tp2Hit = c.low <= activeTrade.tp2Price;
        const tp3Hit = c.low <= activeTrade.tp3Price;

        if (slHit) {
          completedTrades.push({
            id: activeTrade.id,
            dir: 'BEAR',
            entryBar: activeTrade.entryBar,
            entryTime: activeTrade.entryTime,
            endBar: bar_index,
            endTime: c.time,
            entryPrice: activeTrade.entryPrice,
            slPrice: activeTrade.slPrice,
            tp1Price: activeTrade.tp1Price,
            tp2Price: activeTrade.tp2Price,
            tp3Price: activeTrade.tp3Price,
            exitPrice: activeTrade.slPrice,
            exitReason: 'Stop Loss Hit (Loss)',
            isWin: false,
            barsHeld: bar_index - activeTrade.entryBar,
            pipsText: `-${Math.abs(activeTrade.slPrice - activeTrade.entryPrice).toFixed(1)} pts`,
            filterFlags: activeTrade.filterFlags,
          });
          if (curEntryLine) curEntryLine.x2 = bar_index;
          if (curSlLine) curSlLine.x2 = bar_index;
          if (curTp1Line) curTp1Line.x2 = bar_index;
          if (curTp2Line) curTp2Line.x2 = bar_index;
          if (curTp3Line) curTp3Line.x2 = bar_index;
          if (curSlLbl) {
            curSlLbl.x = bar_index;
            curSlLbl.text = '✕ SL Hit  ' + formatPrice(activeTrade.slPrice, minTickPrecision);
          }
          activeTrade = null;
        } else {
          let isTargetReached = false;
          let hitReason = 'Target Hit (Win)';
          let exitP = activeTrade.tp1Price;

          if (targetFocus === 'TP1') {
            if (tp1Hit) {
              isTargetReached = true;
              hitReason = 'TP1 Hit (Win)';
              exitP = activeTrade.tp1Price;
            }
          } else if (targetFocus === 'TP2') {
            if (tp2Hit) {
              isTargetReached = true;
              hitReason = 'TP2 Hit (Win)';
              exitP = activeTrade.tp2Price;
            }
          } else if (targetFocus === 'TP1_AND_TP2') {
            if (tp2Hit) {
              isTargetReached = true;
              hitReason = 'TP2 Hit (Win)';
              exitP = activeTrade.tp2Price;
            } else if (tp1Hit) {
              isTargetReached = true;
              hitReason = 'TP1 Hit (Win)';
              exitP = activeTrade.tp1Price;
            }
          } else if (targetFocus === 'TP3') {
            if (tp3Hit) {
              isTargetReached = true;
              hitReason = 'TP3 Hit (Win)';
              exitP = activeTrade.tp3Price;
            }
          } else {
            // 'ALL'
            if (tp3Hit) {
              isTargetReached = true;
              hitReason = 'TP3 Hit (Win)';
              exitP = activeTrade.tp3Price;
            } else if (tp2Hit) {
              isTargetReached = true;
              hitReason = 'TP2 Hit (Win)';
              exitP = activeTrade.tp2Price;
            } else if (tp1Hit) {
              isTargetReached = true;
              hitReason = 'TP1 Hit (Win)';
              exitP = activeTrade.tp1Price;
            }
          }

          if (isTargetReached) {
            completedTrades.push({
              id: activeTrade.id,
              dir: 'BEAR',
              entryBar: activeTrade.entryBar,
              entryTime: activeTrade.entryTime,
              endBar: bar_index,
              endTime: c.time,
              entryPrice: activeTrade.entryPrice,
              slPrice: activeTrade.slPrice,
              tp1Price: activeTrade.tp1Price,
              tp2Price: activeTrade.tp2Price,
              tp3Price: activeTrade.tp3Price,
              exitPrice: exitP,
              exitReason: hitReason,
              isWin: true,
              barsHeld: bar_index - activeTrade.entryBar,
              pipsText: `+${Math.abs(activeTrade.entryPrice - exitP).toFixed(1)} pts`,
              filterFlags: activeTrade.filterFlags,
            });
            if (curEntryLine) curEntryLine.x2 = bar_index;
            if (curSlLine) curSlLine.x2 = bar_index;
            if (curTp1Line) curTp1Line.x2 = bar_index;
            if (curTp2Line) curTp2Line.x2 = bar_index;
            if (curTp3Line) curTp3Line.x2 = bar_index;
            if (curTp1Lbl) {
              curTp1Lbl.x = bar_index;
              curTp1Lbl.text = '✓ Target Hit  ' + formatPrice(exitP, minTickPrecision);
            }
            activeTrade = null;
          }
        }
      }
    }
    // HTF RSI & Macro Trend Alignment Filter
    const htfRsi = !isNaN(rsiSeries[bar_index]) ? rsiSeries[bar_index] : 50;
    const htfTrendDir = htfTrendSeries[bar_index] || 'CHOP';
    const htfEmaVal = htfEmaSeries.length > bar_index && !isNaN(htfEmaSeries[bar_index]) ? htfEmaSeries[bar_index] : null;

    // A clean Bullish breakout requires HTF RSI >= 48 (not in heavy macro dump) AND HTF not trending down against us
    const htfBull = htfRsi >= 48.0 && htfTrendDir !== 'BEAR' && (htfEmaVal === null || c.close >= htfEmaVal * 0.985);
    // A clean Bearish breakout requires HTF RSI <= 52 (not in heavy macro rally) AND HTF not trending up against us
    const htfBear = htfRsi <= 52.0 && htfTrendDir !== 'BULL' && (htfEmaVal === null || c.close <= htfEmaVal * 1.015);

    const htfOkBull = !useHtfFilter || htfBull;
    const htfOkBear = !useHtfFilter || htfBear;

    // Pivot Detection (ta.pivothigh / ta.pivotlow)
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
      firstBreakHighBar = null;
    }

    if (pl !== null) {
      prevSwingLow = lastSwingLow;
      lastSwingLow = pl;
      lastSwingLowBar = bar_index - swingLen;
      firstBreakLowBar = null;
    }

    // ── Structure Bias Filter (HH/HL or LH/LL) ────────────────────────────────
    const structPH = structPHSeries[bar_index];
    const structPL = structPLSeries[bar_index];

    if (structPH !== null && (seenStructPH === null || structPH !== seenStructPH)) {
      prevStructHigh = lastStructHigh;
      lastStructHigh = structPH;
      seenStructPH = structPH;
    }
    if (structPL !== null && (seenStructPL === null || structPL !== seenStructPL)) {
      prevStructLow = lastStructLow;
      lastStructLow = structPL;
      seenStructPL = structPL;
    }

    const structureBull =
      prevStructHigh !== null &&
      lastStructHigh !== null &&
      prevStructLow !== null &&
      lastStructLow !== null &&
      lastStructHigh > prevStructHigh &&
      lastStructLow > prevStructLow;

    const structureBear =
      prevStructHigh !== null &&
      lastStructHigh !== null &&
      prevStructLow !== null &&
      lastStructLow !== null &&
      lastStructHigh < prevStructHigh &&
      lastStructLow < prevStructLow;

    const structureOkBull = !useStructureFilter || structureBull;
    const structureOkBear = !useStructureFilter || structureBear;

    // ── Extreme Wick Filter ───────────────────────────────────────────────────
    const candleRange = c.high - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const wickOkBull = !useWickFilter || (candleRange > 0 && upperWick / candleRange <= maxWickRatio);
    const wickOkBear = !useWickFilter || (candleRange > 0 && lowerWick / candleRange <= maxWickRatio);

    // ── Liquidity Sweep Filter ─────────────────────────────────────────────────
    // Prior high / low over previous sweepLookback bars (excluding current bar)
    let priorHigh = -Infinity;
    let priorLow = Infinity;
    if (bar_index >= 1) {
      const lookStart = Math.max(0, bar_index - sweepLookback);
      for (let k = lookStart; k < bar_index; k++) {
        if (candles[k].high > priorHigh) priorHigh = candles[k].high;
        if (candles[k].low < priorLow) priorLow = candles[k].low;
      }
    }

    const bullishSweep = priorLow !== Infinity && c.low < priorLow && c.close > priorLow;
    const bearishSweep = priorHigh !== -Infinity && c.high > priorHigh && c.close < priorHigh;

    if (bullishSweep) lastBullSweepBar = bar_index;
    if (bearishSweep) lastBearSweepBar = bar_index;

    const barsSinceBullSweep = lastBullSweepBar !== null ? bar_index - lastBullSweepBar : null;
    const barsSinceBearSweep = lastBearSweepBar !== null ? bar_index - lastBearSweepBar : null;

    const sweepOkBull = !useSweepFilter || (barsSinceBullSweep !== null && barsSinceBullSweep <= sweepLookback);
    const sweepOkBear = !useSweepFilter || (barsSinceBearSweep !== null && barsSinceBearSweep <= sweepLookback);

    // ── Candle body close + displacement + FVG + relative volume ─────────────
    const candleBody = Math.abs(c.close - c.open);
    const bodyRatio = candleRange > 0 ? candleBody / candleRange : 0.0;
    const bodyCloseBull = c.close > c.open && c.close > (lastSwingHigh ?? c.close);
    const bodyCloseBear = c.close < c.open && c.close < (lastSwingLow ?? c.close);
    const bodyCloseOkBull = !useBodyCloseFilter || (bodyCloseBull && bodyRatio >= minBodyRatio);
    const bodyCloseOkBear = !useBodyCloseFilter || (bodyCloseBear && bodyRatio >= minBodyRatio);

    const displacementBull = c.close > c.open && atrVal > 0 && candleBody >= atrVal * minDisplacementAtr;
    const displacementBear = c.close < c.open && atrVal > 0 && candleBody >= atrVal * minDisplacementAtr;
    const displacementOkBull = !useDisplacementFilter || displacementBull;
    const displacementOkBear = !useDisplacementFilter || displacementBear;

    const bullishFvg = bar_index >= 2 && c.low > candles[bar_index - 2].high;
    const bearishFvg = bar_index >= 2 && c.high < candles[bar_index - 2].low;
    const fvgOkBull = !useFvgFilter || bullishFvg;
    const fvgOkBear = !useFvgFilter || bearishFvg;

    const curVol = c.volume ?? 0;
    const volAvg = volAvgSeries[bar_index];
    const volumeDataAvailable = !isNaN(volAvg) && curVol > 0 && volAvg > 0;
    const volumeSpike = volumeDataAvailable && curVol >= volAvg * volumeMultiplier;
    const volumeOk = !useVolumeFilter || (volumeDataAvailable && volumeSpike);

    // Five-part confluence score: body close, displacement, FVG, relative volume, recent sweep
    const sweepBullActive = barsSinceBullSweep !== null && barsSinceBullSweep <= sweepLookback;
    const sweepBearActive = barsSinceBearSweep !== null && barsSinceBearSweep <= sweepLookback;
    const bullScore =
      (bodyCloseBull ? 20 : 0) +
      (displacementBull ? 20 : 0) +
      (bullishFvg ? 20 : 0) +
      (volumeSpike ? 20 : 0) +
      (sweepBullActive ? 20 : 0);
    const bearScore =
      (bodyCloseBear ? 20 : 0) +
      (displacementBear ? 20 : 0) +
      (bearishFvg ? 20 : 0) +
      (volumeSpike ? 20 : 0) +
      (sweepBearActive ? 20 : 0);
    const scoreOkBull = !useScoreFilter || bullScore >= minContinuationScore;
    const scoreOkBear = !useScoreFilter || bearScore >= minContinuationScore;

    lastBullScore = bullScore;
    lastBearScore = bearScore;

    // ── Track Fresh Breakout and Timing ──────────────────────────────────────
    // A Break of Structure (BOS) is strictly a crossover of the confirmed swing level:
    // ta.crossover(close, lastSwingHigh) / ta.crossunder(close, lastSwingLow)
    const prevBarClose = bar_index > 0 ? candles[bar_index - 1].close : c.open;
    const isHighCross = lastSwingHigh !== null && c.close > lastSwingHigh && prevBarClose <= lastSwingHigh;
    if (isHighCross && firstBreakHighBar === null && lastSwingHighBar !== lastProcessedHighBar) {
      firstBreakHighBar = bar_index;
    }
    const isLowCross = lastSwingLow !== null && c.close < lastSwingLow && prevBarClose >= lastSwingLow;
    if (isLowCross && firstBreakLowBar === null && lastSwingLowBar !== lastProcessedLowBar) {
      firstBreakLowBar = bar_index;
    }

    const barsSinceBreakBull = firstBreakHighBar !== null ? bar_index - firstBreakHighBar : 999;
    const barsSinceBreakBear = firstBreakLowBar !== null ? bar_index - firstBreakLowBar : 999;

    // Strict breakout location: signal MUST only appear on the breakout candle (bar 0) or immediate confirmation candle (bar 1).
    // It can NEVER jump or trigger on bar 2, 3, 4, 5+ in the middle of a move.
    const isAtBreakoutLocationBull = firstBreakHighBar !== null && (bar_index === firstBreakHighBar || bar_index === firstBreakHighBar + 1);
    const isAtBreakoutLocationBear = firstBreakLowBar !== null && (bar_index === firstBreakLowBar || bar_index === firstBreakLowBar + 1);

    // ── Candidate Target Levels & Anti-Lag / Target Pre-Hit Protection ────────
    const candEntryBull = lastSwingHigh !== null ? lastSwingHigh + (targetMode === 'points' ? 0 : atrLocked * 0.1) : null;
    const candTp1Bull = candEntryBull !== null ? (targetMode === 'points' ? candEntryBull + pointsTp1 : candEntryBull + atrLocked * tp1Multi) : null;
    const candSlBull = candEntryBull !== null ? (targetMode === 'points' ? candEntryBull - pointsSl : lastSwingHigh! - atrLocked * slMulti) : null;

    let targetAlreadyReachedBull = false;
    let overextendedBull = false;
    if (candEntryBull !== null && candTp1Bull !== null) {
      if (c.high >= candTp1Bull || c.close >= candTp1Bull) {
        targetAlreadyReachedBull = true;
      }
      if (candSlBull !== null && c.low <= candSlBull) {
        targetAlreadyReachedBull = true;
      }
      const tpDist = candTp1Bull - candEntryBull;
      if (tpDist > 0 && (c.close - candEntryBull) > tpDist * 0.85) {
        overextendedBull = true;
      }
    }

    const candEntryBear = lastSwingLow !== null ? lastSwingLow - (targetMode === 'points' ? 0 : atrLocked * 0.1) : null;
    const candTp1Bear = candEntryBear !== null ? (targetMode === 'points' ? candEntryBear - pointsTp1 : candEntryBear - atrLocked * tp1Multi) : null;
    const candSlBear = candEntryBear !== null ? (targetMode === 'points' ? candEntryBear + pointsSl : lastSwingLow! + atrLocked * slMulti) : null;

    let targetAlreadyReachedBear = false;
    let overextendedBear = false;
    if (candEntryBear !== null && candTp1Bear !== null) {
      if (c.low <= candTp1Bear || c.close <= candTp1Bear) {
        targetAlreadyReachedBear = true;
      }
      if (candSlBear !== null && c.high >= candSlBear) {
        targetAlreadyReachedBear = true;
      }
      const tpDist = candEntryBear - candTp1Bear;
      if (tpDist > 0 && (candEntryBear - c.close) > tpDist * 0.85) {
        overextendedBear = true;
      }
    }

    // ── EMA Trend Filter ──────────────────────────────────────────────────────
    const emaVal = useEmaFilter && emaSeries.length > bar_index && !isNaN(emaSeries[bar_index]) ? emaSeries[bar_index] : null;
    const emaOkBull = !useEmaFilter || (emaVal === null || c.close > emaVal);
    const emaOkBear = !useEmaFilter || (emaVal === null || c.close < emaVal);

    // ── ADX + DI Market Regime Filter (Chop vs Expansion Engine) ───────────────
    const curAdx = useAdxFilter && adxSeries.length > bar_index && !isNaN(adxSeries[bar_index]) ? adxSeries[bar_index] : null;
    const prevAdx = useAdxFilter && bar_index > 0 && adxSeries.length > bar_index - 1 && !isNaN(adxSeries[bar_index - 1]) ? adxSeries[bar_index - 1] : curAdx;
    const curPdi = useAdxFilter && pdiSeries.length > bar_index && !isNaN(pdiSeries[bar_index]) ? pdiSeries[bar_index] : null;
    const curMdi = useAdxFilter && mdiSeries.length > bar_index && !isNaN(mdiSeries[bar_index]) ? mdiSeries[bar_index] : null;

    // 1. Minimum trend strength threshold (default 20.0, filters flat sideways chop)
    const isAdxTrending = curAdx !== null && curAdx >= minAdx;
    // 2. Momentum expansion: ADX >= 24 (strong trend) OR rising/steady (>= prevAdx - 0.4)
    const isAdxExpanding = curAdx !== null && (curAdx >= 24 || (prevAdx !== null && curAdx >= prevAdx - 0.4));
    // 3. Directional dominance: Bull must have dominant +DI (at least 2.0 above -DI), Bear must have dominant -DI
    const diSpreadBull = curPdi !== null && curMdi !== null ? curPdi - curMdi : 0;
    const diSpreadBear = curPdi !== null && curMdi !== null ? curMdi - curPdi : 0;
    const minDiSpread = 2.0;

    const adxOkBull = !useAdxFilter || (curAdx === null || (isAdxTrending && isAdxExpanding && diSpreadBull >= minDiSpread));
    const adxOkBear = !useAdxFilter || (curAdx === null || (isAdxTrending && isAdxExpanding && diSpreadBear >= minDiSpread));

    // ── Strong Breakout Candle Filter ─────────────────────────────────────────
    const candleBodyVal = Math.abs(c.close - c.open);
    const bodyAtrOk = !useCandleFilter || (atrVal <= 0 || candleBodyVal >= atrVal * minBodyAtr);
    const bufferAtrOkBull = !useCandleFilter || (atrVal <= 0 || breakoutBufferAtr <= 0 || (lastSwingHigh !== null && c.close >= lastSwingHigh + atrVal * breakoutBufferAtr));
    const bufferAtrOkBear = !useCandleFilter || (atrVal <= 0 || breakoutBufferAtr <= 0 || (lastSwingLow !== null && c.close <= lastSwingLow - atrVal * breakoutBufferAtr));
    const candleOkBull = bodyAtrOk && bufferAtrOkBull;
    const candleOkBear = bodyAtrOk && bufferAtrOkBear;

    const timelyOkBull = !preventLateEntry || (barsSinceBreakBull <= maxBreakoutDelay && !targetAlreadyReachedBull && !overextendedBull);
    const timelyOkBear = !preventLateEntry || (barsSinceBreakBear <= maxBreakoutDelay && !targetAlreadyReachedBear && !overextendedBear);

    // ── Candidate BOS events gated by all enabled filters ─────────────────────
    const rawBosBull =
      lastSwingHigh !== null &&
      c.close > lastSwingHigh &&
      isAtBreakoutLocationBull &&
      htfOkBull &&
      timelyOkBull &&
      (lastProcessedHighBar === null || lastSwingHighBar !== lastProcessedHighBar);

    const rawBosBear =
      lastSwingLow !== null &&
      c.close < lastSwingLow &&
      isAtBreakoutLocationBear &&
      htfOkBear &&
      timelyOkBear &&
      (lastProcessedLowBar === null || lastSwingLowBar !== lastProcessedLowBar);

    const bosBull =
      rawBosBull &&
      structureOkBull &&
      wickOkBull &&
      sweepOkBull &&
      bodyCloseOkBull &&
      displacementOkBull &&
      fvgOkBull &&
      volumeOk &&
      scoreOkBull &&
      emaOkBull &&
      adxOkBull &&
      candleOkBull;

    const bosBear =
      rawBosBear &&
      structureOkBear &&
      wickOkBear &&
      sweepOkBear &&
      bodyCloseOkBear &&
      displacementOkBear &&
      fvgOkBear &&
      volumeOk &&
      scoreOkBear &&
      emaOkBear &&
      adxOkBear &&
      candleOkBear;

    // ── Bullish BOS/CHoCH Handler ─────────────────────────────────────────────
    if (bosBull) {
      lastProcessedHighBar = lastSwingHighBar;
      firstBreakHighBar = null;
      const _lbl = trend === 1 ? 'BOS' : 'CHoCH';
      trend = 1;
      bosLevel = lastSwingHigh;
      targetLevel = prevSwingHigh;
      bosBar = bar_index;
      bosBarTime = c.time;
      bosIsBull = true;
      targetHit = false;
      bosBarsCount = 0;
      totalBos += 1;
      bullBosCount += 1;

      entryPrice = bosLevel! + (targetMode === 'points' ? 0 : atrLocked * 0.1);
      if (targetMode === 'points') {
        slPrice = entryPrice - pointsSl;
        tp1Price = entryPrice + pointsTp1;
        tp2Price = entryPrice + pointsTp2;
        tp3Price = entryPrice + pointsTp3;
      } else {
        slPrice = bosLevel! - atrLocked * slMulti;
        tp1Price = entryPrice + atrLocked * tp1Multi;
        tp2Price = entryPrice + atrLocked * tp2Multi;
        tp3Price = entryPrice + atrLocked * tp3Multi;
      }
      invalidSwingRef = lastSwingLow;

      // Plotshape signal with full Entry/SL/TP levels embedded
      signalMarkers.push({
        barIndex: bar_index,
        time: c.time,
        type: 'bull',
        price: c.low,
        text: trend === 1 ? 'BOS' : 'CHoCH',
        color: colBullBos,
        entryPrice: entryPrice!,
        slPrice: slPrice!,
        tp1Price: tp1Price!,
        tp2Price: tp2Price!,
        tp3Price: tp3Price!,
      });

      const currentActiveFilters = [
        useStructureFilter ? 'STR' : '',
        useWickFilter ? 'WICK' : '',
        useSweepFilter ? 'SWEEP' : '',
        useBodyCloseFilter ? 'BODY' : '',
        useDisplacementFilter ? 'DISP' : '',
        useFvgFilter ? 'FVG' : '',
        useVolumeFilter ? 'VOL' : '',
        useScoreFilter ? 'SCORE' : '',
        useEmaFilter ? 'EMA' : '',
        useAdxFilter ? 'ADX' : '',
        useHtfFilter ? 'HTF' : '',
        useCandleFilter ? 'CANDLE' : '',
      ].filter(Boolean).join(' ');

      // If an opposite BEAR trade was running, close it on trend reversal
      if (activeTrade !== null && activeTrade.dir === 'BEAR') {
        const pts = activeTrade.entryPrice - c.close;
        const isProfit = pts > 0;
        completedTrades.push({
          id: activeTrade.id,
          dir: activeTrade.dir,
          entryBar: activeTrade.entryBar,
          entryTime: activeTrade.entryTime,
          endBar: bar_index,
          endTime: c.time,
          entryPrice: activeTrade.entryPrice,
          slPrice: activeTrade.slPrice,
          tp1Price: activeTrade.tp1Price,
          tp2Price: activeTrade.tp2Price,
          tp3Price: activeTrade.tp3Price,
          exitPrice: c.close,
          exitReason: isProfit ? 'Reversal Exit (Profit)' : 'Reversal Exit (Loss)',
          isWin: false,
          barsHeld: bar_index - activeTrade.entryBar,
          pipsText: isProfit ? `+${pts.toFixed(1)} pts` : `-${Math.abs(pts).toFixed(1)} pts`,
          filterFlags: activeTrade.filterFlags,
        });
        activeTrade = null;
      }
      // If no active trade is running, open new Bull trade
      if (activeTrade === null) {
        activeTrade = {
          id: nextTradeId++,
          dir: 'BULL',
          entryBar: bar_index,
          entryTime: c.time,
          entryPrice: entryPrice!,
          slPrice: slPrice!,
          tp1Price: tp1Price!,
          tp2Price: tp2Price!,
          tp3Price: tp3Price!,
          filterFlags: currentActiveFilters || 'NONE',
        };
      }

      if (showBosLine && bosLevel !== null) {
        const x1Bull = lastSwingHighBar === null ? bar_index : Math.max(lastSwingHighBar, bar_index - 499);
        curBosLine = {
          x1: x1Bull,
          y1: bosLevel,
          x2: bar_index,
          y2: bosLevel,
          color: colBullBos,
          width: 2,
          style: 'dashed',
        };
      }

      if (showLabel && bosLevel !== null) {
        const x1LabelBull = lastSwingHighBar === null ? bar_index : Math.max(lastSwingHighBar, bar_index - 499);
        const midBull = Math.min(Math.round((x1LabelBull + bar_index) / 2), bar_index);
        curBosLbl = {
          x: midBull,
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

      if (alertBos) {
        lastBosAlert = JSON.stringify({
          t: cleanTicker,
          tf: 'current',
          type: 'BOS',
          dir: 'bull',
          lvl: formatPrice(bosLevel, minTickPrecision),
          entry: formatPrice(entryPrice, minTickPrecision),
          sl: formatPrice(slPrice, minTickPrecision),
          tp1: formatPrice(tp1Price, minTickPrecision),
          tp2: formatPrice(tp2Price, minTickPrecision),
          tp3: formatPrice(tp3Price, minTickPrecision),
        });
      }
    }

    // ── Bearish BOS/CHoCH Handler ─────────────────────────────────────────────
    if (bosBear) {
      lastProcessedLowBar = lastSwingLowBar;
      firstBreakLowBar = null;
      const _lbl = trend === -1 ? 'BOS' : 'CHoCH';
      trend = -1;
      bosLevel = lastSwingLow;
      targetLevel = prevSwingLow;
      bosBar = bar_index;
      bosBarTime = c.time;
      bosIsBull = false;
      targetHit = false;
      bosBarsCount = 0;
      totalBos += 1;
      bearBosCount += 1;

      // Realistic entry price anchoring (if delayed entry allowed, anchor to current candle close)
      entryPrice = bosLevel! - (targetMode === 'points' ? 0 : atrLocked * 0.1);
      if (targetMode === 'points') {
        slPrice = entryPrice + pointsSl;
        tp1Price = entryPrice - pointsTp1;
        tp2Price = entryPrice - pointsTp2;
        tp3Price = entryPrice - pointsTp3;
      } else {
        slPrice = bosLevel! + atrLocked * slMulti;
        tp1Price = entryPrice - atrLocked * tp1Multi;
        tp2Price = entryPrice - atrLocked * tp2Multi;
        tp3Price = entryPrice - atrLocked * tp3Multi;
      }
      invalidSwingRef = lastSwingHigh;

      // Plotshape signal with full Entry/SL/TP levels embedded
      signalMarkers.push({
        barIndex: bar_index,
        time: c.time,
        type: 'bear',
        price: c.high,
        text: trend === -1 ? 'BOS' : 'CHoCH',
        color: colBearBos,
        entryPrice: entryPrice!,
        slPrice: slPrice!,
        tp1Price: tp1Price!,
        tp2Price: tp2Price!,
        tp3Price: tp3Price!,
      });

      const currentActiveFilters = [
        useStructureFilter ? 'STR' : '',
        useWickFilter ? 'WICK' : '',
        useSweepFilter ? 'SWEEP' : '',
        useBodyCloseFilter ? 'BODY' : '',
        useDisplacementFilter ? 'DISP' : '',
        useFvgFilter ? 'FVG' : '',
        useVolumeFilter ? 'VOL' : '',
        useScoreFilter ? 'SCORE' : '',
        useEmaFilter ? 'EMA' : '',
        useAdxFilter ? 'ADX' : '',
        useHtfFilter ? 'HTF' : '',
        useCandleFilter ? 'CANDLE' : '',
      ].filter(Boolean).join(' ');

      // If an opposite BULL trade was running, close it on trend reversal
      if (activeTrade !== null && activeTrade.dir === 'BULL') {
        const pts = c.close - activeTrade.entryPrice;
        const isProfit = pts > 0;
        completedTrades.push({
          id: activeTrade.id,
          dir: activeTrade.dir,
          entryBar: activeTrade.entryBar,
          entryTime: activeTrade.entryTime,
          endBar: bar_index,
          endTime: c.time,
          entryPrice: activeTrade.entryPrice,
          slPrice: activeTrade.slPrice,
          tp1Price: activeTrade.tp1Price,
          tp2Price: activeTrade.tp2Price,
          tp3Price: activeTrade.tp3Price,
          exitPrice: c.close,
          exitReason: isProfit ? 'Reversal Exit (Profit)' : 'Reversal Exit (Loss)',
          isWin: false,
          barsHeld: bar_index - activeTrade.entryBar,
          pipsText: isProfit ? `+${pts.toFixed(1)} pts` : `-${Math.abs(pts).toFixed(1)} pts`,
          filterFlags: activeTrade.filterFlags,
        });
        activeTrade = null;
      }
      // If no active trade is running, open new Bear trade
      if (activeTrade === null) {
        activeTrade = {
          id: nextTradeId++,
          dir: 'BEAR',
          entryBar: bar_index,
          entryTime: c.time,
          entryPrice: entryPrice!,
          slPrice: slPrice!,
          tp1Price: tp1Price!,
          tp2Price: tp2Price!,
          tp3Price: tp3Price!,
          filterFlags: currentActiveFilters || 'NONE',
        };
      }

      if (showBosLine && bosLevel !== null) {
        const x1Bear = lastSwingLowBar === null ? bar_index : Math.max(lastSwingLowBar, bar_index - 499);
        curBosLine = {
          x1: x1Bear,
          y1: bosLevel,
          x2: bar_index,
          y2: bosLevel,
          color: colBearBos,
          width: 2,
          style: 'dashed',
        };
      }

      if (showLabel && bosLevel !== null) {
        const x1LabelBear = lastSwingLowBar === null ? bar_index : Math.max(lastSwingLowBar, bar_index - 499);
        const midBear = Math.min(Math.round((x1LabelBear + bar_index) / 2), bar_index);
        curBosLbl = {
          x: midBear,
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

      if (alertBos) {
        lastBosAlert = JSON.stringify({
          t: cleanTicker,
          tf: 'current',
          type: 'BOS',
          dir: 'bear',
          lvl: formatPrice(bosLevel, minTickPrecision),
          entry: formatPrice(entryPrice, minTickPrecision),
          sl: formatPrice(slPrice, minTickPrecision),
          tp1: formatPrice(tp1Price, minTickPrecision),
          tp2: formatPrice(tp2Price, minTickPrecision),
          tp3: formatPrice(tp3Price, minTickPrecision),
        });
      }
    }

    // Close the breakout window for the current swing high / low if it has passed without triggering,
    // ensuring that no signal can ever "jump" onto later bars (bar 2, 3, 4, 5+).
    if (firstBreakHighBar !== null && bar_index >= firstBreakHighBar + 1) {
      lastProcessedHighBar = lastSwingHighBar;
    }
    if (firstBreakLowBar !== null && bar_index >= firstBreakLowBar + 1) {
      lastProcessedLowBar = lastSwingLowBar;
    }

    // ── Active BOS Line Extension ─────────────────────────────────────────────
    const bosActive = bosLevel !== null && bosBar !== null;
    if (bosActive && !bosBull && !bosBear) {
      bosBarsCount += 1;
      // Keep SL, TP and Entry rays extending forward while active trade is STILL running!
      if (showTpSl && activeTrade !== null) {
        const x2Target = bar_index + 15;
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
      if (alertTarget) {
        lastTargetAlert = JSON.stringify({
          t: cleanTicker,
          type: 'TGT',
          dir: bosIsBull ? 'bull' : 'bear',
          tgt: formatPrice(targetLevel, minTickPrecision),
        });
      }
    }

    // ── BOS Invalidation Logic ────────────────────────────────────────────────
    const invalidated =
      bosActive &&
      !targetHit &&
      invalidSwingRef !== null &&
      (bosIsBull ? c.close < invalidSwingRef : c.close > invalidSwingRef) &&
      invalidateMode;

    // Invalidation only resets the structural line if NO trade is currently running
    if (invalidated && activeTrade === null) {
      bosLevel = null;
      bosBar = null;
      bosBarTime = null;
      targetLevel = null;
      invalidSwingRef = null;
      trend = 0;
      lastProcessedHighBar = null;
      lastProcessedLowBar = null;
      curBosLine = null;
      curBosLbl = null;
    }
  }

  // ── Construct Line Fills (Pine Script linefill.new) ────────────────────────
  let slFill: MsttLineFill | null = null;
  let tp1Fill: MsttLineFill | null = null;
  let tp2Fill: MsttLineFill | null = null;
  let tp3Fill: MsttLineFill | null = null;

  const isBosActiveNow = bosLevel !== null && bosBar !== null;

  if (isBosActiveNow && curEntryLine) {
    const x1 = curEntryLine.x1;
    const x2 = curEntryLine.x2;
    if (showSl && showSlShade && curSlLine) {
      slFill = { x1, x2, y1: curEntryLine.y1, y2: curSlLine.y1, color: colSl };
    }
    if (showTp1 && showTp1Shade && curTp1Line) {
      tp1Fill = { x1, x2, y1: curEntryLine.y1, y2: curTp1Line.y1, color: colTp1 };
    }
    if (showTp2 && showTp2Shade && curTp2Line) {
      const topBoundary = curTp1Line ? curTp1Line.y1 : curEntryLine.y1;
      tp2Fill = { x1, x2, y1: topBoundary, y2: curTp2Line.y1, color: colTp2 };
    }
    if (showTp3 && showTp3Shade && curTp3Line) {
      const topBoundary = curTp2Line ? curTp2Line.y1 : curTp1Line ? curTp1Line.y1 : curEntryLine.y1;
      tp3Fill = { x1, x2, y1: topBoundary, y2: curTp3Line.y1, color: colTp3 };
    }
  }

  // ── Dashboard String & Color Pre-computation (17 rows exact match) ─────────
  const lastBarIndex = n - 1;
  const lastHtfRsi = !isNaN(rsiSeries[lastBarIndex]) ? rsiSeries[lastBarIndex] : 50;
  const lastHtfTrend = htfTrendSeries[lastBarIndex] || 'CHOP';
  const htfBull = lastHtfRsi >= 48.0 && lastHtfTrend !== 'BEAR';
  const htfBear = lastHtfRsi <= 52.0 && lastHtfTrend !== 'BULL';

  const trendStr = trend === 1 ? '▲ Bull' : trend === -1 ? '▼ Bear' : '● Neutral';
  const trendCol = trend === 1 ? 'rgb(0, 200, 120)' : trend === -1 ? 'rgb(220, 50, 50)' : 'rgb(140, 140, 140)';
  const htfBarVal = lastHtfRsi;
  const htfBarStr = f_blockBar(htfBarVal, 100.0);
  const htfBarCol = f_blockColor(htfBarVal, 30.0, 50.0, 70.0);

  const lastStructureBull =
    prevStructHigh !== null &&
    lastStructHigh !== null &&
    prevStructLow !== null &&
    lastStructLow !== null &&
    lastStructHigh > prevStructHigh &&
    lastStructLow > prevStructLow;

  const lastStructureBear =
    prevStructHigh !== null &&
    lastStructHigh !== null &&
    prevStructLow !== null &&
    lastStructLow !== null &&
    lastStructHigh < prevStructHigh &&
    lastStructLow < prevStructLow;

  const structStr = lastStructureBull ? '▲ Bull' : lastStructureBear ? '▼ Bear' : '● Mixed';
  const structCol = lastStructureBull ? '#22c55e' : lastStructureBear ? '#ef4444' : '#9ca3af';

  const filterStr =
    ((useStructureFilter ? 'STR ' : '') +
    (useWickFilter ? 'WICK ' : '') +
    (useSweepFilter ? 'SWEEP ' : '') +
    (useBodyCloseFilter ? 'BODY ' : '') +
    (useDisplacementFilter ? 'DISP ' : '') +
    (useFvgFilter ? 'FVG ' : '') +
    (useVolumeFilter ? 'VOL ' : '') +
    (useScoreFilter ? 'SCORE ' : '') +
    (useEmaFilter ? 'EMA ' : '') +
    (useAdxFilter ? 'ADX ' : '') +
    (useHtfFilter ? 'HTF ' : '') +
    (useCandleFilter ? 'CANDLE ' : '')).trim();

  const bosLvlStr = isBosActiveNow && bosLevel !== null ? formatPrice(bosLevel, minTickPrecision) : '—';
  const tgtLvlStr = isBosActiveNow && targetLevel !== null ? formatPrice(targetLevel, minTickPrecision) : '—';
  const entryStr = isBosActiveNow && entryPrice !== null ? formatPrice(entryPrice, minTickPrecision) : '—';
  const slStr = isBosActiveNow && slPrice !== null ? formatPrice(slPrice, minTickPrecision) : '—';
  const tp1Str = isBosActiveNow && tp1Price !== null ? formatPrice(tp1Price, minTickPrecision) : '—';
  const tp2Str = isBosActiveNow && tp2Price !== null ? formatPrice(tp2Price, minTickPrecision) : '—';
  const tp3Str = isBosActiveNow && tp3Price !== null ? formatPrice(tp3Price, minTickPrecision) : '—';

  const tgtHitStr = targetHit ? '✓ Hit' : isBosActiveNow ? '⏳ Pending' : '—';
  const tgtHitCol = targetHit ? colHit : isBosActiveNow ? 'rgb(255, 200, 0)' : 'rgb(110, 110, 110)';
  const durationStr = isBosActiveNow ? '⏳ ' + bosBarsCount.toString() + ' Bars' : '—';
  const totalStr = totalBos.toString() + ' (' + bullBosCount.toString() + '▲ / ' + bearBosCount.toString() + '▼)';
  const htfStr = htfBull ? '▲ Bull HTF' : htfBear ? '▼ Bear HTF' : '● Range HTF';
  const htfDirCol = htfBull ? 'rgb(0, 200, 120)' : htfBear ? 'rgb(220, 50, 50)' : '#f59e0b';

  const slDiff = entryPrice !== null && slPrice !== null ? Math.abs(entryPrice - slPrice) : 0;
  let targetDiff = 0;
  if (targetFocus === 'TP2' && tp2Price !== null && entryPrice !== null) {
    targetDiff = Math.abs(tp2Price - entryPrice);
  } else if (targetFocus === 'TP3' && tp3Price !== null && entryPrice !== null) {
    targetDiff = Math.abs(tp3Price - entryPrice);
  } else if (entryPrice !== null) {
    if (showTp1 && tp1Price !== null) {
      targetDiff = Math.abs(tp1Price - entryPrice);
    } else if (showTp2 && tp2Price !== null) {
      targetDiff = Math.abs(tp2Price - entryPrice);
    } else if (showTp3 && tp3Price !== null) {
      targetDiff = Math.abs(tp3Price - entryPrice);
    }
  }

  const rrVal =
    isBosActiveNow && targetDiff > 0 && slDiff > 0
      ? targetDiff / slDiff
      : 0;

  const rrStr = isBosActiveNow ? rrVal.toFixed(2) + ' R' : '—';
  const rrCol =
    rrVal >= 2.0
      ? 'rgb(0, 255, 120)'
      : rrVal >= 1.5
      ? 'rgb(80, 255, 0)'
      : rrVal >= 1.0
      ? 'rgb(200, 200, 0)'
      : 'rgb(110, 110, 110)';

  // ── Calculate Evaluated Trade Performance over last keepN trades ───────────
  const evaluatedTrades = keepN === 0 ? [] : completedTrades.slice(-keepN);
  let wins = 0;
  let losses = 0;
  let curConsecW = 0;
  let maxConsecW = 0;
  let curConsecL = 0;
  let maxConsecL = 0;
  let tp1Hits = 0;
  let tp2Hits = 0;
  let tp3Hits = 0;

  evaluatedTrades.forEach((t) => {
    if (t.isWin) {
      wins++;
      curConsecW++;
      curConsecL = 0;
      if (curConsecW > maxConsecW) maxConsecW = curConsecW;
      if (t.exitReason.includes('TP1')) tp1Hits++;
      if (t.exitReason.includes('TP2')) tp2Hits++;
      if (t.exitReason.includes('TP3')) tp3Hits++;
    } else {
      losses++;
      curConsecL++;
      curConsecW = 0;
      if (curConsecL > maxConsecL) maxConsecL = curConsecL;
    }
  });

  const totalEvaluated = evaluatedTrades.length;
  const winRate = totalEvaluated > 0 ? (wins / totalEvaluated) * 100 : 0;
  const winRateStr = totalEvaluated > 0 ? `${winRate.toFixed(1)}%` : '—';
  const winRateCol =
    totalEvaluated === 0
      ? 'rgb(140, 140, 140)'
      : winRate >= 60
      ? 'rgb(0, 255, 120)'
      : winRate >= 45
      ? 'rgb(255, 200, 0)'
      : 'rgb(255, 77, 109)';

  const stats: MsttTradeStats = {
    totalTrades: totalEvaluated,
    totalAllTrades: completedTrades.length,
    wins,
    losses,
    winRate,
    consecWins: maxConsecW,
    consecLosses: maxConsecL,
    tp1Hits,
    tp2Hits,
    tp3Hits,
    recentTrades: (completedTrades.length > 0 ? completedTrades.slice(-Math.max(keepN, 35)) : evaluatedTrades).slice().reverse(),
  };

  const totalTradesStr = `${totalEvaluated} (${completedTrades.length} Total)`;
  const winLossStr = `${wins}W · ${losses}L`;
  const consecStr = `Max ${maxConsecW}W · ${maxConsecL}L`;

  const dashboard: MsttDashboard = {
    ticker: cleanTicker,
    tag: 'BOS [MT]',
    trendStr,
    trendCol,
    htfStr,
    htfDirCol,
    htfBarStr,
    htfBarCol,
    structStr,
    structCol,
    filterStr,
    bosLvlStr,
    tgtLvlStr,
    tgtHitStr,
    tgtHitCol,
    entryStr,
    slStr,
    tp1Str,
    tp2Str,
    tp3Str,
    showTp1,
    showTp2,
    showTp3,
    showSl,
    targetFocus,
    rrStr,
    rrCol,
    durationStr,
    totalStr,
    keepN,
    totalTradesStr,
    winLossStr,
    winRateStr,
    winRateCol,
    consecStr,
    stats,
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
    signalMarkers,
    dashboard,
    stats,
    historicalTrades: completedTrades,
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
    lastBosAlert,
    lastTargetAlert,
    bullScore: lastBullScore,
    bearScore: lastBearScore,
  };
}

/**
 * Format and export full trade-by-trade audit table to standard CSV string
 */
export function exportMsttTradesToCsv(
  trades: MsttHistoricalTrade[],
  symbol = 'MARKET',
  timeframe = '30M'
): string {
  const headers = [
    'Trade_ID',
    'Symbol',
    'Timeframe',
    'Direction',
    'Entry_Bar',
    'Entry_Timestamp_UTC',
    'Entry_Price',
    'Stop_Loss',
    'TP1',
    'TP2',
    'TP3',
    'Exit_Bar',
    'Exit_Timestamp_UTC',
    'Exit_Price',
    'Exit_Reason',
    'Outcome',
    'Bars_Held',
    'PnL_Points',
    'Active_Filters'
  ];

  const rows = trades.map((t) => {
    const entryIso = t.entryTime
      ? new Date(t.entryTime > 1e11 ? t.entryTime : t.entryTime * 1000).toISOString()
      : `Bar_${t.entryBar}`;
    const exitIso = t.endTime
      ? new Date(t.endTime > 1e11 ? t.endTime : t.endTime * 1000).toISOString()
      : `Bar_${t.endBar}`;
    const outcome = t.isWin ? 'WIN' : 'LOSS';
    const pnl = t.dir === 'BULL' ? (t.exitPrice - t.entryPrice) : (t.entryPrice - t.exitPrice);

    return [
      t.id,
      symbol,
      timeframe,
      t.dir,
      t.entryBar,
      entryIso,
      t.entryPrice.toFixed(4),
      t.slPrice.toFixed(4),
      t.tp1Price.toFixed(4),
      t.tp2Price.toFixed(4),
      t.tp3Price.toFixed(4),
      t.endBar,
      exitIso,
      t.exitPrice.toFixed(4),
      `"${t.exitReason}"`,
      outcome,
      t.barsHeld,
      pnl.toFixed(4),
      `"${t.filterFlags || ''}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

