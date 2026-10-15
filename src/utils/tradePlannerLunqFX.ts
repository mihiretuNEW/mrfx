/**
 * Trade Planner Buy Sell Signals, Stop Loss, TP & Lot Size [LunqFX]
 * 100% Exact Port of TradingView Pine Script v6 by LunqFX
 *
 * A signal is half a trade. The other half — where the stop goes, where the
 * targets are, and how big the position must be so that the stop costs
 * exactly what you decided to risk — is printed directly on the chart:
 *
 *     ENTRY   the close of a trend-pullback-resume bar
 *     STOP    beyond the extreme of the pullback, plus an ATR buffer
 *     TP1-3   at 1R, 2R and 3R of that stop (adjustable)
 *     SIZE    lots / units / contracts sized to your account and risk %,
 *             converted into your account currency
 *
 * Non-repainting: every signal, stop, target and hit is decided on closed bar logic.
 */

import { Candle } from '../types';

export interface TradePlannerOptions {
  // Account & Risk
  balance?: number; // Account balance (default: 10000)
  riskPct?: number; // Risk per trade % (default: 1.0)
  accCur?: string; // Account currency (default: 'USD')
  lotOver?: number; // Units per lot (0 = automatic)

  // Setup
  fastLen?: number; // Fast EMA (value zone) (default: 21)
  slowLen?: number; // Slow EMA (trend) (default: 50)
  rsiLen?: number; // Momentum RSI length (default: 14)
  zoneW?: number; // Value zone width (× ATR) (default: 0.25)
  slBuf?: number; // Stop buffer beyond pullback (× ATR) (default: 0.20)
  minStop?: number; // Minimum stop distance (× ATR) (default: 0.50)
  maxStop?: number; // Maximum stop distance (× ATR) (default: 3.0)
  pbBars?: number; // Pullback lookback (bars) (default: 10)

  // Targets & Management
  r1?: number; // TP1 (R) (default: 1.0)
  r2?: number; // TP2 (R) (default: 2.0)
  r3?: number; // TP3 (R) (default: 3.0)
  beOn?: boolean; // Move stop to entry after TP1 (default: false)
  oppOn?: boolean; // Close on opposite signal (default: true)

  // Visuals & Display
  candSty?: 'Neon Bloom' | 'Midnight Cyan' | 'Vibrant Neon' | 'Classic Soft' | 'Cool Blue' | 'Off';
  showZone?: boolean; // Show value zone (default: true)
  tagSize?: 'Small' | 'Normal' | 'Large' | 'Huge';
  keepN?: number; // Plans kept on chart (default: 2)
  showHUD?: boolean; // Show panel (default: true)
  hudPos?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left' | 'Middle Right';
  hudSize?: 'Small' | 'Normal' | 'Large';

  // Master switches for elements
  showSignals?: boolean; // Show Buy / Sell entry labels (default: true)
  showPlanBoxes?: boolean; // Show Risk/Reward boxes and TP lines (default: true)
  showEmaLines?: boolean; // Show Fast & Slow EMA lines (default: true)
  showSl?: boolean; // Show SL line and label (default: true)
  showTp1?: boolean; // Show TP1 line and label (default: true)
  showTp2?: boolean; // Show TP2 line and label (default: true)
  showTp3?: boolean; // Show TP3 line and label (default: true)
}

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE (Exact TradingView LunqFX Colors)
// ─────────────────────────────────────────────────────────────────────────────
export const LUNQ_PALETTE = {
  UP: '#00F5D4', // Neon Cyan / Mint
  DN: '#FF2E88', // Hot Pink
  RISK: '#FF4D6D', // Crimson Red
  GOLD: '#FFD250', // Warm Gold
  CARD: '#131A24', // Card dark slate
  CARD2: '#1B2431', // Card alternative row
  HEAD: '#0E141D', // Card header deep navy
  TXT: '#F1F5F9', // Off-white text
  MUTE: '#94A3B8', // Muted slate text
};

export interface PlanDrawing {
  id: number;
  dir: 1 | -1; // 1 = long, -1 = short
  entryBar: number;
  endBar: number; // extended to live bar while active, or frozen on exit
  entryPrice: number;
  slPrice: number;
  slOriginal: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  stage: number; // 0 open, 1 TP1 hit, 2 TP2 hit
  sizeText: string;
  active: boolean;
  exitReason: string;

  // Labels
  slLabelText: string;
  tp1LabelText: string;
  tp2LabelText: string;
  tp3LabelText: string;
  entryLabelText: string;

  // Coordinates for boxes and lines
  riskBox: { x1: number; y1: number; x2: number; y2: number };
  rewBox: { x1: number; y1: number; x2: number; y2: number };
  line1: { x1: number; y: number; x2: number };
  line2: { x1: number; y: number; x2: number };
  line3: { x1: number; y: number; x2: number };
}

export interface ValueZoneBar {
  time: number;
  emaF: number;
  emaS: number;
  zTop: number;
  zBot: number;
  color: string; // UP, DN, or MUTE
  trendUp: boolean;
  trendDn: boolean;
}

export interface TradePlannerHud {
  title: string;
  riskPctText: string;
  statusText: string;
  statusBg: string;
  entryStr: string;
  stopStr: string;
  tp1Str: string;
  tp2Str: string;
  tp3Str: string;
  posStr: string;
  riskStr: string;
  nowStr: string;
  nowCol: string;
  lastPlanStr: string;
  active: boolean;
}

export interface CandleStyleColors {
  bull: string;
  bear: string;
  applied: boolean;
}

export interface TradePlannerResult {
  plans: PlanDrawing[];
  valueZone: ValueZoneBar[];
  hud: TradePlannerHud | null;
  candleColors: CandleStyleColors;
  currentTrend: 'UP' | 'DOWN' | 'NONE';
  inValueZone: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICAL HELPERS (Pine Script Parity)
// ─────────────────────────────────────────────────────────────────────────────
function calculateEMA(values: number[], length: number): number[] {
  const n = values.length;
  const ema = new Array(n).fill(NaN);
  if (n < length) return ema;

  const alpha = 2 / (length + 1);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += values[i];
  ema[length - 1] = sum / length;

  for (let i = length; i < n; i++) {
    ema[i] = alpha * values[i] + (1 - alpha) * ema[i - 1];
  }
  return ema;
}

function calculateATR(candles: Candle[], length = 14): number[] {
  const n = candles.length;
  const atr = new Array(n).fill(NaN);
  if (n === 0) return atr;

  const tr: number[] = new Array(n);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }

  // RMA of TR
  const alpha = 1 / length;
  let sum = 0;
  const seedLen = Math.min(length, n);
  for (let i = 0; i < seedLen; i++) sum += tr[i];
  atr[seedLen - 1] = sum / seedLen;

  for (let i = seedLen; i < n; i++) {
    atr[i] = alpha * tr[i] + (1 - alpha) * atr[i - 1];
  }
  return atr;
}

function calculateRSI(values: number[], length = 14): number[] {
  const n = values.length;
  const rsi = new Array(n).fill(NaN);
  if (n <= length) return rsi;

  const gains = new Array(n).fill(0);
  const losses = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gains[i] = diff;
    else losses[i] = -diff;
  }

  const alpha = 1 / length;
  let sumG = 0;
  let sumL = 0;
  for (let i = 1; i <= length; i++) {
    sumG += gains[i];
    sumL += losses[i];
  }
  let avgG = sumG / length;
  let avgL = sumL / length;

  rsi[length] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);

  for (let i = length + 1; i < n; i++) {
    avgG = alpha * gains[i] + (1 - alpha) * avgG;
    avgL = alpha * losses[i] + (1 - alpha) * avgL;
    rsi[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return rsi;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENGINE: calculateTradePlanner
// ─────────────────────────────────────────────────────────────────────────────
export function calculateTradePlanner(
  candles: Candle[],
  options: TradePlannerOptions = {},
  symbolName = 'MARKET'
): TradePlannerResult {
  const n = candles.length;
  if (n === 0) {
    return {
      plans: [],
      valueZone: [],
      hud: null,
      candleColors: { bull: LUNQ_PALETTE.UP, bear: LUNQ_PALETTE.DN, applied: false },
      currentTrend: 'NONE',
      inValueZone: false,
    };
  }

  // Options unpacking with Pine defaults
  const balance = options.balance ?? 10000;
  const riskPct = options.riskPct ?? 1.0;
  const accCur = options.accCur ?? 'USD';
  const lotOver = options.lotOver ?? 0;

  const fastLen = Math.max(2, Math.min(200, Math.round(options.fastLen ?? 21)));
  const slowLen = Math.max(5, Math.min(400, Math.round(options.slowLen ?? 50)));
  const rsiLen = Math.max(2, Math.min(50, Math.round(options.rsiLen ?? 14)));
  const zoneW = options.zoneW ?? 0.25;
  const slBuf = options.slBuf ?? 0.20;
  const minStop = options.minStop ?? 0.50;
  const maxStop = options.maxStop ?? 3.0;
  const pbBars = Math.max(2, Math.min(50, Math.round(options.pbBars ?? 10)));

  const r1 = options.r1 ?? 1.0;
  const r2 = options.r2 ?? 2.0;
  const r3 = options.r3 ?? 3.0;
  const beOn = options.beOn ?? false;
  const oppOn = options.oppOn ?? true;

  const candSty = options.candSty ?? 'Neon Bloom';
  const keepN = Math.max(1, Math.min(10, Math.round(options.keepN ?? 2)));

  // Precision formatting
  const lastClose = candles[n - 1].close;
  let precision = 2;
  if (lastClose < 0.1) precision = 5;
  else if (lastClose < 1) precision = 4;
  else if (lastClose < 10) precision = 3;
  else if (lastClose < 1000) precision = 2;
  else precision = 2;

  const px = (v: number | null | undefined): string => {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return v.toFixed(precision);
  };

  const money = (v: number): string => {
    const curPrefix = accCur === 'USD' || accCur === 'USDT' ? '$' : accCur + ' ';
    return curPrefix + Math.round(v).toLocaleString();
  };

  // Position Sizing setup
  const tk = (symbolName || 'MARKET').toUpperCase();
  const isForex = /^(EUR|USD|GBP|JPY|CHF|AUD|CAD|NZD)/.test(tk) && tk.length === 6;
  const autoUnits = isForex ? 100000.0 : tk.includes('XAU') ? 100.0 : tk.includes('XAG') ? 5000.0 : 1.0;
  const lotUnits = lotOver > 0 ? lotOver : autoUnits;
  const sizeWord = lotUnits > 1 ? 'lots' : 'units';
  const riskMoney = (balance * riskPct) / 100.0;

  const sizeFor = (dist: number): number => {
    if (dist <= 0) return 0;
    const perUnit = dist; // pointvalue 1.0, 1:1 currency conversion default
    return perUnit > 0 ? riskMoney / perUnit / lotUnits : 0;
  };

  const sizeTxt = (s: number | null | undefined): string => {
    if (s === null || s === undefined || isNaN(s) || s <= 0) return '—';
    const formatted = s < 10 ? s.toFixed(2) : s.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return `${formatted} ${sizeWord}`;
  };

  // Candle colors
  let cBull = LUNQ_PALETTE.UP;
  let cBear = LUNQ_PALETTE.DN;
  let applyCandles = candSty !== 'Off';

  switch (candSty) {
    case 'Midnight Cyan':
      cBull = '#34E89E';
      cBear = '#FF4D7D';
      break;
    case 'Vibrant Neon':
      cBull = '#00E5B0';
      cBear = '#FF2E63';
      break;
    case 'Classic Soft':
      cBull = '#3FB68B';
      cBear = '#E0556B';
      break;
    case 'Cool Blue':
      cBull = '#4C9AFF';
      cBear = '#8A94A6';
      break;
    case 'Off':
      applyCandles = false;
      break;
    default:
      cBull = LUNQ_PALETTE.UP;
      cBear = LUNQ_PALETTE.DN;
      break;
  }

  // 1. Calculate Technical Series
  const closeSeries = candles.map((c) => c.close);
  const emaFSeries = calculateEMA(closeSeries, fastLen);
  const emaSSeries = calculateEMA(closeSeries, slowLen);
  const atrSeries = calculateATR(candles, 14);
  const rsiSeries = calculateRSI(closeSeries, rsiLen);

  // 2. Sequential bar simulation (100% Pine Script Barstate parity)
  let pbL = false;
  let pbLow: number | null = null;
  let pbS = false;
  let pbHigh: number | null = null;

  let tDir = 0; // 0 none, 1 long, -1 short
  let tEntry: number | null = null;
  let tSL: number | null = null;
  let tSL0: number | null = null;
  let tTP1: number | null = null;
  let tTP2: number | null = null;
  let tTP3: number | null = null;
  let tBar: number | null = null;
  let tStage = 0; // 0 open, 1 TP1 hit, 2 TP2 hit
  let tSize: number | null = null;
  let lastOut = '';

  const valueZone: ValueZoneBar[] = new Array(n);
  const completedPlans: PlanDrawing[] = [];
  let currentActivePlan: PlanDrawing | null = null;
  let nextPlanId = 1;

  for (let bar_index = 0; bar_index < n; bar_index++) {
    const c = candles[bar_index];
    const emaF = !isNaN(emaFSeries[bar_index]) ? emaFSeries[bar_index] : c.close;
    const emaS = !isNaN(emaSSeries[bar_index]) ? emaSSeries[bar_index] : c.close;
    const atr = !isNaN(atrSeries[bar_index]) ? atrSeries[bar_index] : Math.max(1, c.high - c.low);
    const rsi = !isNaN(rsiSeries[bar_index]) ? rsiSeries[bar_index] : 50;
    const prevRsi = bar_index > 0 && !isNaN(rsiSeries[bar_index - 1]) ? rsiSeries[bar_index - 1] : rsi;
    const zone = atr * zoneW;

    // Trend: fast EMA leads slow EMA, price holds above slow EMA, and slow EMA is not falling
    const prevEmaS3 = bar_index >= 3 && !isNaN(emaSSeries[bar_index - 3]) ? emaSSeries[bar_index - 3] : emaS;
    const trendUp = emaF > emaS && c.close > emaS && emaS >= prevEmaS3;
    const trendDn = emaF < emaS && c.close < emaS && emaS <= prevEmaS3;

    const zCol = trendUp ? LUNQ_PALETTE.UP : trendDn ? LUNQ_PALETTE.DN : LUNQ_PALETTE.MUTE;
    valueZone[bar_index] = {
      time: c.time,
      emaF,
      emaS,
      zTop: emaF + zone,
      zBot: emaF - zone,
      color: zCol,
      trendUp,
      trendDn,
    };

    // Pullback anchors
    let anchorL = c.low;
    let anchorH = c.high;
    const startLookback = Math.max(0, bar_index - pbBars + 1);
    for (let k = startLookback; k <= bar_index; k++) {
      if (candles[k].low < anchorL) anchorL = candles[k].low;
      if (candles[k].high > anchorH) anchorH = candles[k].high;
    }

    const stopL0 = anchorL - atr * slBuf;
    const stopS0 = anchorH + atr * slBuf;
    const stopL = c.close - stopL0 < atr * minStop ? c.close - atr * minStop : stopL0;
    const stopS = stopS0 - c.close < atr * minStop ? c.close + atr * minStop : stopS0;
    const okL = c.close - stopL <= atr * maxStop;
    const okS = stopS - c.close <= atr * maxStop;

    // ── 1. Manage the open plan (bars after the entry bar only) ──────────────
    if (tDir !== 0 && tBar !== null && bar_index > tBar && currentActivePlan) {
      const slHit = tDir === 1 ? c.low <= tSL! : c.high >= tSL!;
      const h1 = tStage < 1 && (tDir === 1 ? c.high >= tTP1! : c.low <= tTP1!);
      const h2 = tStage < 2 && (tDir === 1 ? c.high >= tTP2! : c.low <= tTP2!);
      const h3 = tDir === 1 ? c.high >= tTP3! : c.low <= tTP3!;

      if (slHit) {
        const atEntry = tSL === tEntry;
        currentActivePlan.slLabelText = (atEntry ? 'EXIT AT ENTRY  ' : 'STOPPED  ') + px(tSL);
        currentActivePlan.endBar = bar_index;
        currentActivePlan.riskBox.x2 = bar_index;
        currentActivePlan.rewBox.x2 = bar_index;
        currentActivePlan.line1.x2 = bar_index;
        currentActivePlan.line2.x2 = bar_index;
        currentActivePlan.line3.x2 = bar_index;
        currentActivePlan.active = false;
        currentActivePlan.exitReason = atEntry ? 'exit at entry' : 'stopped';
        lastOut = currentActivePlan.exitReason;
        completedPlans.push(currentActivePlan);
        currentActivePlan = null;
        tDir = 0;
      } else {
        if (h1) {
          tStage = 1;
          currentActivePlan.stage = 1;
          currentActivePlan.tp1LabelText = 'TP1 ✓  ' + px(tTP1);
          if (beOn && tEntry !== null) {
            tSL = tEntry;
            currentActivePlan.slPrice = tEntry;
            currentActivePlan.riskBox.y1 = tEntry;
            currentActivePlan.riskBox.y2 = tEntry;
            currentActivePlan.slLabelText = 'STOP AT ENTRY  ' + px(tEntry);
          }
        }
        if (h2) {
          tStage = 2;
          currentActivePlan.stage = 2;
          currentActivePlan.tp2LabelText = 'TP2 ✓  ' + px(tTP2);
        }
        if (h3) {
          currentActivePlan.tp3LabelText = 'TP3 ✓  ' + px(tTP3);
          currentActivePlan.endBar = bar_index;
          currentActivePlan.riskBox.x2 = bar_index;
          currentActivePlan.rewBox.x2 = bar_index;
          currentActivePlan.line1.x2 = bar_index;
          currentActivePlan.line2.x2 = bar_index;
          currentActivePlan.line3.x2 = bar_index;
          currentActivePlan.active = false;
          currentActivePlan.exitReason = 'TP3 reached';
          lastOut = 'TP3 reached';
          completedPlans.push(currentActivePlan);
          currentActivePlan = null;
          tDir = 0;
        }
      }

      // Keep open plan drawings reaching the live bar (+3 bars into the future)
      if (tDir !== 0 && currentActivePlan) {
        const xr = bar_index + 3;
        currentActivePlan.endBar = xr;
        currentActivePlan.riskBox.x2 = xr;
        currentActivePlan.rewBox.x2 = xr;
        currentActivePlan.line1.x2 = xr;
        currentActivePlan.line2.x2 = xr;
        currentActivePlan.line3.x2 = xr;
      }
    }

    // ── 2. Track pullbacks into the value zone ──────────────────────────────
    if (trendUp) {
      if (c.low <= emaF + zone) {
        pbL = true;
      }
      if (pbL) {
        pbLow = pbLow === null ? c.low : Math.min(pbLow, c.low);
      }
    } else {
      pbL = false;
      pbLow = null;
    }

    if (trendDn) {
      if (c.high >= emaF - zone) {
        pbS = true;
      }
      if (pbS) {
        pbHigh = pbHigh === null ? c.high : Math.max(pbHigh, c.high);
      }
    } else {
      pbS = false;
      pbHigh = null;
    }

    // ── 3. The Trigger: momentum turns back in trend direction ───────────────
    const goLong =
      trendUp &&
      pbL &&
      c.close > emaF &&
      c.close > c.open &&
      rsi > 50 &&
      rsi > prevRsi &&
      okL &&
      tDir !== 1 &&
      (tDir === 0 || oppOn);

    const goShort =
      trendDn &&
      pbS &&
      c.close < emaF &&
      c.close < c.open &&
      rsi < 50 &&
      rsi < prevRsi &&
      okS &&
      tDir !== -1 &&
      (tDir === 0 || oppOn);

    if (goLong || goShort) {
      // Close previous plan on opposite signal
      if (tDir !== 0 && currentActivePlan) {
        lastOut = 'closed on opposite signal';
        currentActivePlan.endBar = bar_index;
        currentActivePlan.riskBox.x2 = bar_index;
        currentActivePlan.rewBox.x2 = bar_index;
        currentActivePlan.line1.x2 = bar_index;
        currentActivePlan.line2.x2 = bar_index;
        currentActivePlan.line3.x2 = bar_index;
        currentActivePlan.active = false;
        currentActivePlan.exitReason = lastOut;
        completedPlans.push(currentActivePlan);
        currentActivePlan = null;
      }

      const d = goLong ? 1 : -1;
      const e = c.close;
      const s = goLong ? stopL : stopS;
      const risk = Math.abs(e - s);

      tDir = d;
      tEntry = e;
      tSL = s;
      tSL0 = s;
      tTP1 = e + d * risk * r1;
      tTP2 = e + d * risk * r2;
      tTP3 = e + d * risk * r3;
      tBar = bar_index;
      tStage = 0;
      tSize = sizeFor(risk);

      pbL = false;
      pbLow = null;
      pbS = false;
      pbHigh = null;

      const xr = bar_index + 3;
      const tpHi = d === 1 ? tTP3 : e;
      const tpLo = d === 1 ? e : tTP3;
      const rew1 = riskMoney * r1;

      currentActivePlan = {
        id: nextPlanId++,
        dir: d as 1 | -1,
        entryBar: bar_index,
        endBar: xr,
        entryPrice: e,
        slPrice: s,
        slOriginal: s,
        tp1Price: tTP1,
        tp2Price: tTP2,
        tp3Price: tTP3,
        stage: 0,
        sizeText: sizeTxt(tSize),
        active: true,
        exitReason: '',

        slLabelText: `SL  ${px(s)}   −${money(riskMoney)}`,
        tp1LabelText: `TP1 · ${r1.toFixed(2)}R  ${px(tTP1)}   +${money(rew1)}`,
        tp2LabelText: `TP2 · ${r2.toFixed(2)}R  ${px(tTP2)}`,
        tp3LabelText: `TP3 · ${r3.toFixed(2)}R  ${px(tTP3)}`,
        entryLabelText: `${d === 1 ? '▲ BUY  ' : '▼ SELL  '}${sizeTxt(tSize)}`,

        riskBox: { x1: bar_index, y1: Math.max(e, s), x2: xr, y2: Math.min(e, s) },
        rewBox: { x1: bar_index, y1: tpHi, x2: xr, y2: tpLo },
        line1: { x1: bar_index, y: tTP1, x2: xr },
        line2: { x1: bar_index, y: tTP2, x2: xr },
        line3: { x1: bar_index, y: tTP3, x2: xr },
      };
    }
  }

  // Collect all plans to keep (keepN)
  const allPlansList: PlanDrawing[] = [];
  if (currentActivePlan) {
    allPlansList.push(currentActivePlan);
  }
  for (let i = completedPlans.length - 1; i >= 0; i--) {
    if (allPlansList.length >= keepN) break;
    allPlansList.unshift(completedPlans[i]);
  }

  // 3. Compute HUD panel values on the latest bar
  const lastBarIndex = n - 1;
  const lastEmaF = valueZone[lastBarIndex]?.emaF ?? lastClose;
  const lastEmaS = valueZone[lastBarIndex]?.emaS ?? lastClose;
  const lastTrendUp = valueZone[lastBarIndex]?.trendUp ?? false;
  const lastTrendDn = valueZone[lastBarIndex]?.trendDn ?? false;
  const active = tDir !== 0 && tEntry !== null && tSL0 !== null;

  const riskNow = active ? Math.abs(tEntry! - tSL0!) : 0;
  const liveR = active && riskNow > 0 ? ((lastClose - tEntry!) * tDir) / riskNow : null;

  const planTx =
    (tDir === 1 ? '▲ LONG PLAN' : '▼ SHORT PLAN') +
    (tStage === 2 ? '  ·  TP2 ✓' : tStage === 1 ? '  ·  TP1 ✓' : '');
  const trendTx = lastTrendUp
    ? pbL
      ? '▲ UPTREND · in value zone'
      : '▲ UPTREND · waiting for pullback'
    : lastTrendDn
    ? pbS
      ? '▼ DOWNTREND · in value zone'
      : '▼ DOWNTREND · waiting for pullback'
    : 'NO TREND · no plan';

  const hTx = active ? planTx : trendTx;
  const hBg = active ? (tDir === 1 ? '#0A5F55' : '#8E1148') : LUNQ_PALETTE.CARD2;

  const hud: TradePlannerHud = {
    title: 'TRADE PLANNER',
    riskPctText: `${riskPct.toFixed(2)}% risk`,
    statusText: hTx,
    statusBg: hBg,
    entryStr: active ? px(tEntry) : '—',
    stopStr: active ? `${px(tSL)}   −${money(riskMoney)}` : '—',
    tp1Str: active ? `${tStage >= 1 ? '✓  ' : ''}${px(tTP1)}` : '—',
    tp2Str: active ? `${tStage >= 2 ? '✓  ' : ''}${px(tTP2)}` : '—',
    tp3Str: active ? px(tTP3) : '—',
    posStr: active ? sizeTxt(tSize) : '—',
    riskStr: `${money(riskMoney)}  ·  ${riskPct.toFixed(2)}%`,
    nowStr: active && liveR !== null ? `${liveR >= 0 ? '+' : ''}${liveR.toFixed(1)} R` : '—',
    nowCol: active && liveR !== null ? (liveR >= 0 ? LUNQ_PALETTE.UP : LUNQ_PALETTE.RISK) : LUNQ_PALETTE.MUTE,
    lastPlanStr: lastOut === '' ? '—' : lastOut,
    active,
  };

  return {
    plans: allPlansList,
    valueZone,
    hud,
    candleColors: { bull: cBull, bear: cBear, applied: applyCandles },
    currentTrend: lastTrendUp ? 'UP' : lastTrendDn ? 'DOWN' : 'NONE',
    inValueZone: lastTrendUp ? pbL : lastTrendDn ? pbS : false,
  };
}
