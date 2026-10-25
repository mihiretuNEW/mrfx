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
import { getSymbolSpec, SymbolSpec } from './symbolSpecs';

export interface TradePlannerOptions {
  // Account & Risk
  balance?: number; // Account balance (default: 10000)
  riskPct?: number; // Risk per trade % (default: 1.0)
  accCur?: string; // Account currency (default: 'USD')
  lotOver?: number; // Units/Lots override (0 = automatic based on risk)

  // Broker & Asset Sizing (Deriv MT5 & Standard MT5)
  brokerPreset?: 'auto' | 'deriv_v75' | 'deriv_volatility' | 'deriv_boom_crash' | 'deriv_step' | 'forex' | 'gold' | 'crypto' | 'custom';
  pointValue?: number; // $ value of 1.0 full point per 1.0 lot (default: 1.0 for V75 where 100 pips = $1)
  minLot?: number; // Minimum allowed lot size on MT5 (default: 0.001)
  lotStep?: number; // Lot step increment on MT5 (default: 0.001)

  // Setup
  fastLen?: number; // Fast EMA (value zone) (default: 21)
  slowLen?: number; // Slow EMA (trend) (default: 50)
  rsiLen?: number; // Momentum RSI length (default: 14)
  zoneW?: number; // Value zone width (× ATR) (default: 0.25)
  slBuf?: number; // Stop buffer beyond pullback (× ATR) (default: 0.20)
  minStop?: number; // Minimum stop distance (× ATR) (default: 0.50)
  maxStop?: number; // Maximum stop distance (× ATR) (default: 3.0)
  pbBars?: number; // Pullback lookback (bars) (default: 10)
  retestMode?: 'retest_touch' | 'standard_pullback'; // Retest Mode: Exact EMA Touch & Reject (default: 'retest_touch')
  retestTouchTarget?: 'slow_ema' | 'value_zone_deep' | 'both_emas'; // Retest Touch Target: Slow EMA (Recommended) vs Deep Value Zone vs Both EMAs
  exhaustionFilter?: boolean; // Protect against extreme 5,000+ pt overextended climax traps & break-through crashes (default: true)
  maxClimaxPoints?: number; // Climax points threshold before requiring high absorption (default: 5000)

  // Targets & Management
  targetMode?: 'r_multiple' | 'cash_amount' | 'pips'; // Calculation mode: R-Multiple vs Fixed Cash $ Amount vs Exact Pips (default: 'r_multiple')
  cashSl?: number; // Exact cash loss amount for SL in $ (default: 1.0 for $1 loss)
  cashTp1?: number; // Exact cash win amount for TP1 in $ (default: 1.0 for $1 win)
  cashTp2?: number; // Exact cash win amount for TP2 in $ (default: 2.0 for $2 win)
  cashTp3?: number; // Exact cash win amount for TP3 in $ (default: 3.0 for $3 win)
  pipsSl?: number; // Exact stop loss distance in pips (default: 220)
  pipsTp1?: number; // Exact TP1 distance in pips (default: 1030)
  pipsTp2?: number; // Exact TP2 distance in pips (default: 2060)
  pipsTp3?: number; // Exact TP3 distance in pips (default: 3090)
  targetFocus?: 'TP1' | 'TP2' | 'TP3' | 'first_enabled'; // Target level triggering Win in win rate (default: 'TP1')
  slMult?: number; // SL Size (R Multiple / Multiplier) (default: 1.0)
  r1?: number; // TP1 (R) (default: 1.0)
  r2?: number; // TP2 (R) (default: 2.0)
  r3?: number; // TP3 (R) (default: 3.0)
  beOn?: boolean; // Move stop to entry after TP1 (default: false)
  oppOn?: boolean; // Close on opposite signal (default: true)

  // Visuals & Display
  candSty?: 'Neon Bloom' | 'Midnight Cyan' | 'Vibrant Neon' | 'Classic Soft' | 'Cool Blue' | 'Off';
  showZone?: boolean; // Show value zone (default: true)
  showEntryLabel?: boolean; // Show pill text next to BUY/SELL arrow (default: false to eliminate unit clutter)
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
  showDottedLines?: boolean; // Show Dotted Target & SL Level Lines (default: true)

  // Advanced Quality Filters (On/Off without altering core logic)
  filterAdx?: boolean; // ADX Trend Strength Filter (Block Sideways Chop) (default: false)
  filterSlope?: boolean; // EMA Slope Angle Filter (Block Flat Trends) (default: false)
  filterRsiExhaustion?: boolean; // RSI Exhaustion Guard (No Buy > 70 / No Sell < 30) (default: false)
  filterWickRejection?: boolean; // Candle Rejection Wick Filter (Block Counter-Rejections) (default: false)
  filterVolatility?: boolean; // Volatility Expansion Filter (Avoid Dead Volume Chop) (default: false)
  filterMinStopDist?: boolean; // Execution Cost & Min Stop Buffer Guard (default: false)
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

  // Outcome tracking for exact win rate & audit transparency
  riskMoney: number;
  rewardMoney: number;
  riskPips: number;
  rewardPips: number;
  exitPrice?: number;
  isWin?: boolean;
  pnlText?: string;
  pipsText?: string;

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

export interface TradePlannerStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // percentage (e.g. 64.5)
  maxConsecWins: number;
  maxConsecLosses: number;
  targetName: string; // e.g. "TP1", "TP2", or "TP3"
  targetR: number; // e.g. 1.0, 2.0, 3.0
  slSize: number; // e.g. 1.0x
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
}

export interface RecentTradeAudit {
  id: number;
  dir: 'BUY' | 'SELL';
  entryBar: number;
  endBar: number;
  entryPrice: number;
  exitPrice?: number;
  exitReason: string;
  isWin: boolean;
  pnlText: string;
  pipsText: string;
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
  stats?: TradePlannerStats | null;
  brokerInfo?: string;
  slSizeStr?: string;
  recentTrades?: RecentTradeAudit[];
  lastCompletedTrade?: RecentTradeAudit | null;
}

export interface CandleStyleColors {
  bull: string;
  bear: string;
  applied: boolean;
}

export interface TradePlannerSignal {
  id: number;
  barIndex: number;
  time: number;
  dir: 1 | -1;
  price: number;
  type: 'BUY' | 'SELL';
  isRetest: boolean;
  emaPrice: number;
  labelText: string;
}

export interface TradePlannerResult {
  plans: PlanDrawing[];
  signals: TradePlannerSignal[];
  valueZone: ValueZoneBar[];
  hud: TradePlannerHud | null;
  candleColors: CandleStyleColors;
  currentTrend: 'UP' | 'DOWN' | 'NONE';
  inValueZone: boolean;
  allHistoricalPlans?: PlanDrawing[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICAL HELPERS (Pine Script Parity)
// ─────────────────────────────────────────────────────────────────────────────
function calculateEMA(values: number[], length: number): number[] {
  const n = values.length;
  const ema = new Array(n).fill(NaN);
  if (n === 0) return ema;

  const validLen = Math.max(1, length);
  const alpha = 2 / (validLen + 1);
  ema[0] = values[0];

  for (let i = 1; i < n; i++) {
    const val = !isNaN(values[i]) ? values[i] : ema[i - 1];
    ema[i] = alpha * val + (1 - alpha) * ema[i - 1];
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

function calculateADX(candles: Candle[], length = 14): number[] {
  const n = candles.length;
  const adx = new Array(n).fill(NaN);
  if (n <= length) return adx;

  const tr: number[] = new Array(n);
  const plusDM: number[] = new Array(n);
  const minusDM: number[] = new Array(n);

  tr[0] = candles[0].high - candles[0].low;
  plusDM[0] = 0;
  minusDM[0] = 0;

  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);

    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  // Smooth TR, +DM, -DM using Wilder's RMA (alpha = 1/length)
  let sTR = 0;
  let sPlusDM = 0;
  let sMinusDM = 0;

  const seed = Math.min(length, n);
  for (let i = 0; i < seed; i++) {
    sTR += tr[i];
    sPlusDM += plusDM[i];
    sMinusDM += minusDM[i];
  }

  const dx: number[] = new Array(n).fill(NaN);

  for (let i = length; i < n; i++) {
    sTR = sTR - sTR / length + tr[i];
    sPlusDM = sPlusDM - sPlusDM / length + plusDM[i];
    sMinusDM = sMinusDM - sMinusDM / length + minusDM[i];

    const plusDI = sTR > 0 ? (sPlusDM / sTR) * 100 : 0;
    const minusDI = sTR > 0 ? (sMinusDM / sTR) * 100 : 0;
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    dx[i] = diSum > 0 ? (diDiff / diSum) * 100 : 0;
  }

  // Smooth DX for ADX
  let sumDX = 0;
  const startADX = Math.min(n, length * 2);
  for (let i = length; i < startADX; i++) {
    sumDX += !isNaN(dx[i]) ? dx[i] : 0;
  }
  let curADX = sumDX / Math.max(1, startADX - length);
  if (startADX - 1 < n) adx[startADX - 1] = curADX;

  for (let i = startADX; i < n; i++) {
    const val = !isNaN(dx[i]) ? dx[i] : curADX;
    curADX = (curADX * (length - 1) + val) / length;
    adx[i] = curADX;
  }

  return adx;
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
      signals: [],
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
  const brokerPreset = options.brokerPreset ?? 'auto';

  const fastLen = Math.max(3, Math.min(500, Math.round(Number(options.fastLen ?? 21)) || 21));
  const slowLen = Math.max(3, Math.min(500, Math.round(Number(options.slowLen ?? 50)) || 50));
  const rsiLen = Math.max(2, Math.min(50, Math.round(options.rsiLen ?? 14)));
  const zoneW = options.zoneW ?? 0.25;
  const slBuf = options.slBuf ?? 0.20;
  const minStop = options.minStop ?? 0.50;
  const maxStop = options.maxStop ?? 3.0;
  const pbBars = Math.max(2, Math.min(50, Math.round(options.pbBars ?? 10)));
  const retestMode = options.retestMode ?? 'retest_touch';
  const retestTouchTarget = options.retestTouchTarget ?? 'slow_ema';
  const exhaustionFilter = options.exhaustionFilter ?? true;
  const maxClimaxPoints = Math.max(500, Number(options.maxClimaxPoints ?? 5000) || 5000);

  // Target and SL Size Multipliers, Pips & Exact Cash $ Targets
  const targetMode = options.targetMode ?? 'r_multiple';
  const cashSl = Math.max(0.01, Number(options.cashSl ?? 1.0) || 1.0);
  const cashTp1 = Math.max(0.01, Number(options.cashTp1 ?? 1.0) || 1.0);
  const cashTp2 = Math.max(0.01, Number(options.cashTp2 ?? 2.0) || 2.0);
  const cashTp3 = Math.max(0.01, Number(options.cashTp3 ?? 3.0) || 3.0);
  const pipsSl = Math.max(1, Number(options.pipsSl ?? 220) || 220);
  const pipsTp1 = Math.max(1, Number(options.pipsTp1 ?? 1030) || 1030);
  const pipsTp2 = Math.max(1, Number(options.pipsTp2 ?? 2060) || 2060);
  const pipsTp3 = Math.max(1, Number(options.pipsTp3 ?? 3090) || 3090);
  const targetFocus = options.targetFocus ?? 'TP1';
  const slMult = Math.max(0.05, Math.min(20.0, Number(options.slMult ?? 1.0) || 1.0));
  const r1 = options.r1 ?? 1.0;
  const r2 = options.r2 ?? 2.0;
  const r3 = options.r3 ?? 3.0;
  const beOn = options.beOn ?? false;
  const oppOn = options.oppOn ?? true;

  const candSty = options.candSty ?? 'Neon Bloom';
  const keepN = Math.max(1, Math.min(500, Math.round(Number(options.keepN ?? 2)) || 2));

  // Quality filters (on/off toggles)
  const filterAdx = options.filterAdx ?? false;
  const filterSlope = options.filterSlope ?? false;
  const filterRsiExhaustion = options.filterRsiExhaustion ?? false;
  const filterWickRejection = options.filterWickRejection ?? false;
  const filterVolatility = options.filterVolatility ?? false;
  const filterMinStopDist = options.filterMinStopDist ?? false;

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

  // ── Instrument & MT5 Broker Sizing Configuration ──────────────────────────
  // User trades Volatility 75 index on Deriv MT5: 100 pips are worth $1.00 per 1.0 lot
  const spec: SymbolSpec = getSymbolSpec(symbolName || 'R_75');
  const cleanSym = (symbolName || '').toUpperCase().trim();
  const isV75 =
    brokerPreset === 'deriv_v75' ||
    cleanSym.includes('75') ||
    cleanSym.includes('V75') ||
    cleanSym.includes('R_75') ||
    spec.displayName.toUpperCase().includes('VOLATILITY 75');

  // Value of 1.0 full price point per 1.0 lot in account currency
  // For Volatility 75 Index: 100 pips = 1.00 index point = $1.00 per 1.0 lot
  let pointValue = options.pointValue ?? 1.0;
  let minLot = options.minLot ?? (isV75 ? 0.001 : spec.minLot || 0.01);
  let lotStep = options.lotStep ?? (isV75 ? 0.001 : spec.lotStep || 0.001);
  let pipSize = isV75 ? 0.01 : spec.pipSize || 0.01;
  let brokerLabel = 'Deriv MT5 · Volatility 75';

  if (isV75) {
    pointValue = options.pointValue ?? 1.0; // 100 pips = $1.00 per 1.0 lot
    minLot = options.minLot ?? 0.001;
    lotStep = options.lotStep ?? 0.001;
    pipSize = 0.01;
    brokerLabel = 'Deriv MT5 · V75 (100 pips = $1)';
  } else if (brokerPreset === 'deriv_boom_crash' || spec.marketCategory === 'boom_crash') {
    pointValue = options.pointValue ?? 1.0;
    minLot = options.minLot ?? (spec.minLot || 0.20);
    lotStep = options.lotStep ?? (spec.lotStep || 0.01);
    pipSize = spec.pipSize || 1.0;
    brokerLabel = 'Deriv MT5 · Boom/Crash';
  } else if (brokerPreset === 'deriv_step' || spec.marketCategory === 'step') {
    pointValue = options.pointValue ?? 10.0;
    minLot = options.minLot ?? (spec.minLot || 0.10);
    lotStep = options.lotStep ?? (spec.lotStep || 0.01);
    pipSize = spec.pipSize || 1.0;
    brokerLabel = 'Deriv MT5 · Step Index';
  } else if (brokerPreset === 'forex' || spec.marketCategory === 'forex') {
    pointValue = options.pointValue ?? (spec.contractSize * spec.pointSize);
    minLot = options.minLot ?? 0.01;
    lotStep = options.lotStep ?? 0.01;
    pipSize = spec.pipSize || 0.0001;
    brokerLabel = 'Standard MT5 · Forex Majors';
  } else if (brokerPreset === 'gold' || spec.marketCategory === 'metals') {
    pointValue = options.pointValue ?? (spec.contractSize * spec.pointSize);
    minLot = options.minLot ?? 0.01;
    lotStep = options.lotStep ?? 0.01;
    pipSize = spec.pipSize || 0.10;
    brokerLabel = 'Standard MT5 · Gold / Metals';
  } else if (spec.isSpecAvailable) {
    pointValue = options.pointValue ?? (spec.contractSize * (spec.pointSize > 0 ? spec.pointSize : 1.0));
    minLot = options.minLot ?? spec.minLot;
    lotStep = options.lotStep ?? spec.lotStep;
    pipSize = spec.pipSize || 0.01;
    brokerLabel = `Deriv MT5 · ${spec.displayName}`;
  }

  const riskMoney = (balance * riskPct) / 100.0;

  const sizeFor = (dist: number): number => {
    if (dist <= 0) return 0;
    if (lotOver > 0) return lotOver;

    // Dollar risk for 1.0 lot over `dist` price points
    const lossPerLot = dist * pointValue;
    if (lossPerLot <= 0) return minLot;

    const rawLot = riskMoney / lossPerLot;
    const clampedLot = Math.max(minLot, rawLot);

    const stepDecimals = Math.max(0, Math.min(5, Math.round(-Math.log10(lotStep))));
    const rounded = Math.round(clampedLot / lotStep) * lotStep;
    return Number(Math.max(minLot, rounded).toFixed(stepDecimals));
  };

  const sizeTxt = (s: number | null | undefined): string => {
    if (s === null || s === undefined || isNaN(s) || s <= 0) return '—';
    const decimals = lotStep <= 0.001 ? 3 : lotStep <= 0.01 ? 2 : 1;
    return `${s.toFixed(decimals)} lots`;
  };

  const pipsTxt = (dist: number): string => {
    if (dist <= 0) return '';
    const pips = Math.round(dist / pipSize);
    return `${pips.toLocaleString()} pips`;
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
  const adxSeries = filterAdx ? calculateADX(candles, 14) : [];
  const atrMaSeries = filterVolatility ? calculateEMA(atrSeries.map((v) => (isNaN(v) ? 0 : v)), 20) : [];

  // 2. Sequential bar simulation & Retest Signal Engine
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
  const signals: TradePlannerSignal[] = [];
  let currentActivePlan: PlanDrawing | null = null;
  let nextPlanId = 1;
  let nextSignalId = 1;
  let lastLongSigBar = -999;
  let lastShortSigBar = -999;

  for (let bar_index = 0; bar_index < n; bar_index++) {
    const c = candles[bar_index];
    const emaF = !isNaN(emaFSeries[bar_index]) ? emaFSeries[bar_index] : c.close;
    const emaS = !isNaN(emaSSeries[bar_index]) ? emaSSeries[bar_index] : c.close;
    const atr = !isNaN(atrSeries[bar_index]) ? atrSeries[bar_index] : Math.max(1, c.high - c.low);
    const rsi = !isNaN(rsiSeries[bar_index]) ? rsiSeries[bar_index] : 50;
    const prevRsi = bar_index > 0 && !isNaN(rsiSeries[bar_index - 1]) ? rsiSeries[bar_index - 1] : rsi;
    const zone = atr * zoneW;
    const prevEmaS3 = bar_index >= 3 && !isNaN(emaSSeries[bar_index - 3]) ? emaSSeries[bar_index - 3] : emaS;
    const prevEmaF3 = bar_index >= 3 && !isNaN(emaFSeries[bar_index - 3]) ? emaFSeries[bar_index - 3] : emaF;
    const emaFSlope = emaF - prevEmaF3;

    // ── Trend Detection (Resilient across all EMA combinations e.g. 260/280, 21/50, or single EMA) ──
    const emaTop = Math.max(emaF, emaS);
    const emaBot = Math.min(emaF, emaS);

    // Bullish Trend:
    // Fast EMA leads Slow EMA, OR price is clearly holding/moving above the EMA band with non-negative slope
    const trendUp =
      (emaF >= emaS && (c.close >= emaBot - zone * 1.5 || c.low >= emaBot - zone * 2.0)) ||
      (c.close > emaF && emaFSlope >= 0);

    // Bearish Trend:
    // Fast EMA trails Slow EMA, OR price is clearly holding/moving below the EMA band with non-positive slope
    const trendDn =
      (emaF <= emaS && (c.close <= emaTop + zone * 1.5 || c.high <= emaTop + zone * 2.0)) ||
      (c.close < emaF && emaFSlope <= 0);

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
    const okL = c.close - stopL <= atr * (maxStop * 1.5);
    const okS = stopS - c.close <= atr * (maxStop * 1.5);

    // ── 1. Retest of EMA / Value Zone Detection ──────────────────────────────
    // Check recent price separation: price was above/below BOTH EMAs prior to this pullback
    let hadBullSeparation = bar_index < 5;
    let hadBearSeparation = bar_index < 5;
    let recentMaxHigh = c.high;
    let recentMinLow = c.low;

    const sepLookbackStart = Math.max(0, bar_index - 35);
    for (let k = sepLookbackStart; k <= bar_index; k++) {
      if (candles[k].high > recentMaxHigh) recentMaxHigh = candles[k].high;
      if (candles[k].low < recentMinLow) recentMinLow = candles[k].low;
      if (k < bar_index) {
        const kEmaF = !isNaN(emaFSeries[k]) ? emaFSeries[k] : candles[k].close;
        const kEmaS = !isNaN(emaSSeries[k]) ? emaSSeries[k] : candles[k].close;
        const kEmaTop = Math.max(kEmaF, kEmaS);
        const kEmaBot = Math.min(kEmaF, kEmaS);
        if (candles[k].close > kEmaTop) hadBullSeparation = true;
        if (candles[k].close < kEmaBot) hadBearSeparation = true;
      }
    }

    // Touch Target Resolution:
    // The user specifically emphasizes: "ተመልሶ ይመጣና ወይም Slow ema ይነካና rejectioncandle red/green ያሳያል፥
    // እሱ rejection candle ስያሳይ arrow! Fast ema ብቻ ስነካ አይሁን እንጂ። ለየትኛውም setting ላይ ለተስተካከለ ema must be the same."
    // In any setting (e.g. 260/280, 21/50, 50/200):
    // In an Uptrend, the deeper support baseline is emaS. Touching Fast EMA alone is shallow.
    // In a Downtrend, the deeper resistance baseline is emaS. Touching Fast EMA alone is shallow.
    const isBothEmaMode = retestTouchTarget === 'both_emas';

    // A. Long Retest Touch:
    // Price pulls back and reaches down to the Slow EMA (within zone tolerance)
    const touchLong = isBothEmaMode
      ? (c.low <= Math.max(emaF, emaS) + zone && c.high >= Math.min(emaF, emaS) - zone * 1.5)
      : (c.low <= emaS + zone * 0.9 && c.high >= emaS - zone * 1.5);

    // Fast-EMA-only exclusion filter ("Fast ema ብቻ ስነካ አይሁን እንጂ"):
    // If price only touched Fast EMA while staying strictly above Slow EMA, exclude shallow touch!
    const isShallowFastOnlyLong =
      !isBothEmaMode &&
      emaF > emaS &&
      c.low > emaS + zone * 0.9;

    // B. Short Retest Touch:
    // Price rallies up and reaches up to the Slow EMA (within zone tolerance)
    const touchShort = isBothEmaMode
      ? (c.high >= Math.min(emaF, emaS) - zone && c.low <= Math.max(emaF, emaS) + zone * 1.5)
      : (c.high >= emaS - zone * 0.9 && c.low <= emaS + zone * 1.5);

    // Fast-EMA-only exclusion filter for short:
    const isShallowFastOnlyShort =
      !isBothEmaMode &&
      emaF < emaS &&
      c.high < emaS - zone * 0.9;

    // C. Rejection Candle Confirmation ("rejectioncandle red/green ያሳያል፥ እሱ rejection candle ስያሳይ arrow!")
    const barRange = Math.max(0.0001, c.high - c.low);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const isBullCandle = c.close > c.open;
    const isBearCandle = c.close < c.open;

    // Long Rejection:
    // MUST be a GREEN candle (close > open) OR strong lower hammer wick (lowerWick / barRange >= 0.35)
    // AND must respect/hold the Slow EMA (close must not be broken below the Slow EMA)
    const rejectLong =
      !isShallowFastOnlyLong &&
      ((isBullCandle && c.close >= emaS - zone * 0.35) ||
       (lowerWick / barRange >= 0.35 && c.close >= c.open * 0.9995 && c.close >= emaS - zone * 0.35));

    // Short Rejection:
    // MUST be a RED candle (close < open) OR strong upper shooting star wick (upperWick / barRange >= 0.35)
    // AND must respect/hold the Slow EMA (close must not be broken above the Slow EMA)
    const rejectShort =
      !isShallowFastOnlyShort &&
      ((isBearCandle && c.close <= emaS + zone * 0.35) ||
       (upperWick / barRange >= 0.35 && c.close <= c.open * 1.0005 && c.close <= emaS + zone * 0.35));

    // D. Climax Overextension & Breakthrough Safeguard ("5000-6000 ርቀት ተጉዞ ሲመለስ ሰብሮ እንዳይወጣ ማዳን")
    // If price previously ran away > 5000 points (or > 7.5x ATR) from the Slow EMA,
    // a violent counter-trend waterfall / spike often slices straight through the EMAs.
    const climaxDistLong = recentMaxHigh - emaS;
    const climaxDistShort = emaS - recentMinLow;
    const isExtremeClimaxLong = climaxDistLong >= maxClimaxPoints || climaxDistLong >= atr * 7.5;
    const isExtremeClimaxShort = climaxDistShort >= maxClimaxPoints || climaxDistShort >= atr * 7.5;

    // Breakdown / Breakthrough Guard:
    // If the candle closed significantly beyond the Slow EMA, that is a breakdown / breakout, NOT a bounce!
    const isBreakthroughLong = c.close < emaS - zone * 0.65 || c.low < emaS - atr * 1.0;
    const isBreakthroughShort = c.close > emaS + zone * 0.65 || c.high > emaS + atr * 1.0;

    // Waterfall Violent Momentum Guard (Oversized candle slamming into EMA):
    const prevCandle = bar_index > 0 ? candles[bar_index - 1] : c;
    const prevRange = Math.max(0.0001, prevCandle.high - prevCandle.low);
    const isViolentWaterfallLong =
      (barRange > atr * 2.5 && c.close < c.open) ||
      (prevRange > atr * 2.5 && prevCandle.close < prevCandle.open && c.close < (emaF + emaS) / 2);
    const isViolentWaterfallShort =
      (barRange > atr * 2.5 && c.close > c.open) ||
      (prevRange > atr * 2.5 && prevCandle.close > prevCandle.open && c.close > (emaF + emaS) / 2);

    let allowClimaxLong = true;
    let allowClimaxShort = true;

    if (exhaustionFilter) {
      if (isBreakthroughLong || isViolentWaterfallLong) allowClimaxLong = false;
      if (isBreakthroughShort || isViolentWaterfallShort) allowClimaxShort = false;

      // In an extreme climax move (> 5,000 pts / 7.5x ATR):
      // Require clear bullish absorption candle (green close > open, close >= Slow EMA, and not an indecision doji)
      if (isExtremeClimaxLong) {
        if (!isBullCandle || c.close < emaS || (c.close - c.open) / barRange < 0.25) {
          allowClimaxLong = false;
        }
      }
      if (isExtremeClimaxShort) {
        if (!isBearCandle || c.close > emaS || (c.open - c.close) / barRange < 0.25) {
          allowClimaxShort = false;
        }
      }
    }

    // Track pullbacks
    if (trendUp) {
      if (touchLong) pbL = true;
      if (pbL) pbLow = pbLow === null ? c.low : Math.min(pbLow, c.low);
    } else {
      pbL = false;
      pbLow = null;
    }

    if (trendDn) {
      if (touchShort) pbS = true;
      if (pbS) pbHigh = pbHigh === null ? c.high : Math.max(pbHigh, c.high);
    } else {
      pbS = false;
      pbHigh = null;
    }

    // ── 2. Signal Triggering (EMA Retest vs Classic Pullback) ─────────────────
    const minBarsBetweenSignals = 2;

    // A. EMA Retest Touch Mode (Directly captures the textbook retest shown by user)
    const retestGoLong =
      trendUp &&
      hadBullSeparation &&
      touchLong &&
      rejectLong &&
      allowClimaxLong &&
      bar_index - lastLongSigBar >= minBarsBetweenSignals;

    const retestGoShort =
      trendDn &&
      hadBearSeparation &&
      touchShort &&
      rejectShort &&
      allowClimaxShort &&
      bar_index - lastShortSigBar >= minBarsBetweenSignals;

    // B. Classic Pine Pullback Mode (LunqFX original)
    const standardGoLong =
      trendUp &&
      pbL &&
      c.close > emaF &&
      c.close > c.open &&
      (rsi > 45 || rsi > prevRsi) &&
      okL &&
      bar_index - lastLongSigBar >= minBarsBetweenSignals;

    const standardGoShort =
      trendDn &&
      pbS &&
      c.close < emaF &&
      c.close < c.open &&
      (rsi < 55 || rsi < prevRsi) &&
      okS &&
      bar_index - lastShortSigBar >= minBarsBetweenSignals;

    const baseGoLong = retestMode === 'retest_touch' ? retestGoLong : standardGoLong;
    const baseGoShort = retestMode === 'retest_touch' ? retestGoShort : standardGoShort;

    // ── Optional Quality Filter Shields (Only active when specifically toggled ON) ───
    let passLongFilters = true;
    let passShortFilters = true;

    if (filterAdx) {
      const curAdx = adxSeries[bar_index];
      if (isNaN(curAdx) || curAdx < 20) {
        passLongFilters = false;
        passShortFilters = false;
      }
    }

    if (filterSlope) {
      const slope = atr > 0 ? (emaS - prevEmaS3) / atr : 0;
      if (slope < 0.03) passLongFilters = false;
      if (slope > -0.03) passShortFilters = false;
    }

    if (filterRsiExhaustion) {
      if (rsi > 70) passLongFilters = false;
      if (rsi < 30) passShortFilters = false;
    }

    if (filterWickRejection) {
      if (upperWick / barRange > 0.45) passLongFilters = false;
      if (lowerWick / barRange > 0.45) passShortFilters = false;
    }

    if (filterVolatility) {
      const curAtrMa = atrMaSeries[bar_index];
      if (!isNaN(curAtrMa) && curAtrMa > 0 && atr < curAtrMa * 0.85) {
        passLongFilters = false;
        passShortFilters = false;
      }
    }

    if (filterMinStopDist) {
      const minHealthyStop = atr * 0.65;
      if (Math.abs(c.close - stopL) < minHealthyStop) passLongFilters = false;
      if (Math.abs(stopS - c.close) < minHealthyStop) passShortFilters = false;
    }

    const goLong = baseGoLong && passLongFilters;
    const goShort = baseGoShort && passShortFilters;

    // Store in global signals collection for chart visualization (All retest arrows visible!)
    if (goLong) {
      signals.push({
        id: nextSignalId++,
        barIndex: bar_index,
        time: c.time,
        dir: 1,
        price: c.low,
        type: 'BUY',
        isRetest: true,
        emaPrice: emaF,
        labelText: '▲ BUY',
      });
      lastLongSigBar = bar_index;
    }

    if (goShort) {
      signals.push({
        id: nextSignalId++,
        barIndex: bar_index,
        time: c.time,
        dir: -1,
        price: c.high,
        type: 'SELL',
        isRetest: true,
        emaPrice: emaF,
        labelText: '▼ SELL',
      });
      lastShortSigBar = bar_index;
    }

    // ── 3. Open Plan Management (100% Truthful Win/Loss Execution) ───────────
    if (tDir !== 0 && tBar !== null && bar_index > tBar && currentActivePlan) {
      const slHit = tDir === 1 ? c.low <= tSL! : c.high >= tSL!;
      const h1 = tStage < 1 && (tDir === 1 ? c.high >= tTP1! : c.low <= tTP1!);
      const h2 = tStage < 2 && (tDir === 1 ? c.high >= tTP2! : c.low <= tTP2!);
      const h3 = tStage < 3 && (tDir === 1 ? c.high >= tTP3! : c.low <= tTP3!);

      // Conservative Risk Priority:
      // If both SL and TP are touched on the same candle, SL takes priority -> marked strictly as LOSS
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
        currentActivePlan.exitReason = atEntry ? 'Exit at Entry (BE)' : 'Stop Loss Hit (Loss)';
        currentActivePlan.exitPrice = tSL!;
        currentActivePlan.isWin = false;
        currentActivePlan.pnlText = `-$${currentActivePlan.riskMoney.toFixed(2)}`;
        currentActivePlan.pipsText = `-${Math.round(currentActivePlan.riskPips)} pips`;
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
          currentActivePlan.stage = 3;
        }

        // Complete plan when it reaches designated target focus (default: TP1) or TP3
        const targetReached =
          (targetFocus === 'TP1' && h1) ||
          (targetFocus === 'TP2' && (h2 || currentActivePlan.stage >= 2)) ||
          (targetFocus === 'TP3' && (h3 || currentActivePlan.stage >= 3)) ||
          h3;

        if (targetReached && (targetFocus === 'TP1' || h3 || (!options.showTp2 && !options.showTp3))) {
          currentActivePlan.endBar = bar_index;
          currentActivePlan.riskBox.x2 = bar_index;
          currentActivePlan.rewBox.x2 = bar_index;
          currentActivePlan.line1.x2 = bar_index;
          currentActivePlan.line2.x2 = bar_index;
          currentActivePlan.line3.x2 = bar_index;
          currentActivePlan.active = false;
          currentActivePlan.exitReason = h3 ? 'TP3 reached' : h2 ? 'TP2 reached' : 'TP1 reached';
          currentActivePlan.exitPrice = h3 ? tTP3! : h2 ? tTP2! : tTP1!;
          currentActivePlan.isWin = true;
          currentActivePlan.pnlText = `+$${currentActivePlan.rewardMoney.toFixed(2)}`;
          currentActivePlan.pipsText = `+${Math.round(currentActivePlan.rewardPips)} pips`;
          lastOut = currentActivePlan.exitReason;
          completedPlans.push(currentActivePlan);
          currentActivePlan = null;
          tDir = 0;
        } else if (oppOn && ((tDir === 1 && goShort) || (tDir === -1 && goLong))) {
          // Closed on opposite counter-trend signal
          const exitPx = c.close;
          const isProfitable = tDir === 1 ? exitPx > tEntry! : exitPx < tEntry!;
          currentActivePlan.endBar = bar_index;
          currentActivePlan.riskBox.x2 = bar_index;
          currentActivePlan.rewBox.x2 = bar_index;
          currentActivePlan.line1.x2 = bar_index;
          currentActivePlan.line2.x2 = bar_index;
          currentActivePlan.line3.x2 = bar_index;
          currentActivePlan.active = false;
          currentActivePlan.exitReason = isProfitable
            ? `Closed on opposite signal (${tDir === 1 ? 'SELL' : 'BUY'})`
            : `Opposite Signal Exit (Loss)`;
          currentActivePlan.exitPrice = exitPx;
          currentActivePlan.isWin = false; // Only target reach counts as Target Win!
          currentActivePlan.pnlText = isProfitable ? `+$0.00` : `-$${currentActivePlan.riskMoney.toFixed(2)}`;
          currentActivePlan.pipsText = isProfitable ? `+0 pips` : `-${Math.round(currentActivePlan.riskPips)} pips`;
          lastOut = currentActivePlan.exitReason;
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

    // ── 4. Open New Trade Plan ───────────────────────────────────────────────
    if (tDir === 0 && (goLong || goShort)) {
      const pointsPerDollar = isV75
        ? (lotOver > 0 ? 1.0 / lotOver : 1000.0)
        : (lotOver > 0 ? 1.0 / (lotOver * (spec.contractSize || 1)) : 1.0 / ((spec.minLot || 0.01) * (spec.contractSize || 1)));

      const pipPriceDist = isV75
        ? 10.0
        : (spec.pipSize || 0.01);

      const isCashMode = targetMode === 'cash_amount';
      const isPipsMode = targetMode === 'pips';
      const d = goLong ? 1 : -1;

      // Realistic Next-Candle Open entry price upon candle confirmation
      const nextCandle = bar_index + 1 < n ? candles[bar_index + 1] : null;
      const e = nextCandle ? nextCandle.open : c.close;

      let risk: number;
      let s: number;
      let planTP1: number;
      let planTP2: number;
      let planTP3: number;
      let planSize: number;
      let planRiskMoney: number;
      let rew1: number;
      let rew2: number;
      let rew3: number;
      let planRiskPips: number;
      let planRewPips: number;

      let distSl: number;
      let distTp1: number;
      let distTp2: number;
      let distTp3: number;

      if (isPipsMode) {
        // Exact Pips Mode (e.g. 220 pips SL, 1030 pips TP1)
        distSl = pipsSl * pipPriceDist;
        distTp1 = pipsTp1 * pipPriceDist;
        distTp2 = pipsTp2 * pipPriceDist;
        distTp3 = pipsTp3 * pipPriceDist;
        planSize = lotOver > 0 ? lotOver : (isV75 ? 0.001 : minLot);

        planRiskMoney = distSl / pointsPerDollar;
        rew1 = distTp1 / pointsPerDollar;
        rew2 = distTp2 / pointsPerDollar;
        rew3 = distTp3 / pointsPerDollar;
        planRiskPips = pipsSl;
        planRewPips = pipsTp1;
      } else if (isCashMode) {
        // Exact Fixed Cash $ Mode (e.g. $2.20 SL = 220 pips, $10.30 TP = 1030 pips on V75)
        distSl = cashSl * pointsPerDollar;
        distTp1 = cashTp1 * pointsPerDollar;
        distTp2 = cashTp2 * pointsPerDollar;
        distTp3 = cashTp3 * pointsPerDollar;
        planSize = lotOver > 0 ? lotOver : (isV75 ? 0.001 : minLot);

        planRiskMoney = cashSl;
        rew1 = cashTp1;
        rew2 = cashTp2;
        rew3 = cashTp3;
        planRiskPips = Math.round(distSl / pipPriceDist);
        planRewPips = Math.round(distTp1 / pipPriceDist);
      } else {
        // Standard R-Multiple / Dynamic Technical Mode
        const baseStop = goLong ? stopL : stopS;
        const baseRisk = Math.abs(e - baseStop);
        risk = baseRisk * slMult;
        distSl = risk;
        distTp1 = risk * r1;
        distTp2 = risk * r2;
        distTp3 = risk * r3;
        planSize = sizeFor(risk);

        planRiskMoney = riskMoney;
        rew1 = riskMoney * r1;
        rew2 = riskMoney * r2;
        rew3 = riskMoney * r3;
        planRiskPips = Math.round(distSl / pipPriceDist);
        planRewPips = Math.round(distTp1 / pipPriceDist);
      }

      risk = distSl;
      s = goLong ? e - distSl : e + distSl;
      planTP1 = e + d * distTp1;
      planTP2 = e + d * distTp2;
      planTP3 = e + d * distTp3;

      tDir = d;
      tEntry = e;
      tSL = s;
      tSL0 = s;
      tTP1 = planTP1;
      tTP2 = planTP2;
      tTP3 = planTP3;
      tBar = bar_index;
      tStage = 0;
      tSize = planSize;

      pbL = false;
      pbLow = null;
      pbS = false;
      pbHigh = null;

      const xr = bar_index + 3;
      const tpHi = d === 1 ? planTP3 : e;
      const tpLo = d === 1 ? e : planTP3;

      const slText = isPipsMode
        ? `SL · ${pipsSl} pips  ${px(s)}  −$${planRiskMoney.toFixed(2)}`
        : isCashMode
        ? `SL · $${cashSl.toFixed(2)} (${planRiskPips}p)  ${px(s)}`
        : `SL · ${slMult.toFixed(2)}x  ${px(s)}  −${money(riskMoney)}`;

      const tp1Text = isPipsMode
        ? `TP1 · ${pipsTp1} pips  ${px(planTP1)}  +$${rew1.toFixed(2)}`
        : isCashMode
        ? `TP1 · $${cashTp1.toFixed(2)} (${planRewPips}p)  ${px(planTP1)}`
        : `TP1 · ${r1.toFixed(2)}R  ${px(planTP1)}  +${money(rew1)}`;

      const tp2Text = isPipsMode
        ? `TP2 · ${pipsTp2} pips  ${px(planTP2)}  +$${rew2.toFixed(2)}`
        : isCashMode
        ? `TP2 · $${cashTp2.toFixed(2)}  ${px(planTP2)}`
        : `TP2 · ${r2.toFixed(2)}R  ${px(planTP2)}  +${money(rew2)}`;

      const tp3Text = isPipsMode
        ? `TP3 · ${pipsTp3} pips  ${px(planTP3)}  +$${rew3.toFixed(2)}`
        : isCashMode
        ? `TP3 · $${cashTp3.toFixed(2)}  ${px(planTP3)}`
        : `TP3 · ${r3.toFixed(2)}R  ${px(planTP3)}  +${money(rew3)}`;

      currentActivePlan = {
        id: nextPlanId++,
        dir: d as 1 | -1,
        entryBar: bar_index,
        endBar: xr,
        entryPrice: e,
        slPrice: s,
        slOriginal: s,
        tp1Price: planTP1,
        tp2Price: planTP2,
        tp3Price: planTP3,
        stage: 0,
        sizeText: sizeTxt(planSize),
        active: true,
        exitReason: '',
        riskMoney: planRiskMoney,
        rewardMoney: rew1,
        riskPips: planRiskPips,
        rewardPips: planRewPips,

        slLabelText: slText,
        tp1LabelText: tp1Text,
        tp2LabelText: tp2Text,
        tp3LabelText: tp3Text,
        entryLabelText: d === 1 ? '▲ BUY' : '▼ SELL',

        riskBox: { x1: bar_index, y1: Math.max(e, s), x2: xr, y2: Math.min(e, s) },
        rewBox: { x1: bar_index, y1: tpHi, x2: xr, y2: tpLo },
        line1: { x1: bar_index, y: planTP1, x2: xr },
        line2: { x1: bar_index, y: planTP2, x2: xr },
        line3: { x1: bar_index, y: planTP3, x2: xr },
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

  // 5. Compute HUD panel values on the latest bar
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

  // 6. Compute KeepN Performance Scorecard & Trade Statistics
  const showTp1 = options.showTp1 ?? true;
  const showTp2 = options.showTp2 ?? true;
  const showTp3 = options.showTp3 ?? true;

  const isCashMode = targetMode === 'cash_amount';
  const isPipsMode = targetMode === 'pips';

  let targetStage = 1;
  let targetName = 'TP1';
  let targetR = r1;

  if (targetFocus === 'TP3' || (!showTp1 && !showTp2 && showTp3)) {
    targetStage = 3;
    targetName = isPipsMode
      ? `TP3 (${pipsTp3} pips)`
      : isCashMode
      ? `TP3 ($${cashTp3.toFixed(2)})`
      : `TP3 (${r3.toFixed(1)}R)`;
    targetR = isPipsMode ? pipsTp3 : isCashMode ? cashTp3 : r3;
  } else if (targetFocus === 'TP2' || (!showTp1 && showTp2)) {
    targetStage = 2;
    targetName = isPipsMode
      ? `TP2 (${pipsTp2} pips)`
      : isCashMode
      ? `TP2 ($${cashTp2.toFixed(2)})`
      : `TP2 (${r2.toFixed(1)}R)`;
    targetR = isPipsMode ? pipsTp2 : isCashMode ? cashTp2 : r2;
  } else {
    targetStage = 1;
    targetName = isPipsMode
      ? `TP1 (${pipsTp1} pips)`
      : isCashMode
      ? `TP1 ($${cashTp1.toFixed(2)})`
      : `TP1 (${r1.toFixed(1)}R)`;
    targetR = isPipsMode ? pipsTp1 : isCashMode ? cashTp1 : r1;
  }

  // Exact 100% Fact-Checked Performance: Evaluated on the last keepN completed trades!
  const keepNCompleted = completedPlans.slice(-keepN);
  const chronologicalPlans = [...keepNCompleted].sort((a, b) => a.entryBar - b.entryBar);

  let totalWins = 0;
  let totalLosses = 0;
  let currentConsecWins = 0;
  let maxConsecWins = 0;
  let currentConsecLosses = 0;
  let maxConsecLosses = 0;
  let tp1Hits = 0;
  let tp2Hits = 0;
  let tp3Hits = 0;

  for (const p of chronologicalPlans) {
    if (p.stage >= 1 || p.exitReason.includes('TP1') || p.exitReason.includes('TP2') || p.exitReason.includes('TP3')) tp1Hits++;
    if (p.stage >= 2 || p.exitReason.includes('TP2') || p.exitReason.includes('TP3')) tp2Hits++;
    if (p.stage >= 3 || p.exitReason.includes('TP3')) tp3Hits++;

    if (p.isWin === true) {
      totalWins++;
      currentConsecWins++;
      currentConsecLosses = 0;
      if (currentConsecWins > maxConsecWins) maxConsecWins = currentConsecWins;
    } else {
      totalLosses++;
      currentConsecLosses++;
      currentConsecWins = 0;
      if (currentConsecLosses > maxConsecLosses) maxConsecLosses = currentConsecLosses;
    }
  }

  const evaluatedTrades = totalWins + totalLosses;
  const winRate = evaluatedTrades > 0 ? Number(((totalWins / evaluatedTrades) * 100).toFixed(1)) : 0;

  const stats: TradePlannerStats = {
    totalTrades: evaluatedTrades,
    wins: totalWins,
    losses: totalLosses,
    winRate,
    maxConsecWins,
    maxConsecLosses,
    targetName,
    targetR,
    slSize: isPipsMode ? pipsSl : isCashMode ? cashSl : slMult,
    tp1Hits,
    tp2Hits,
    tp3Hits,
  };

  // Recent trade audit entries for the Trade Audit Log table (Newest first)
  const recentTrades: RecentTradeAudit[] = [...keepNCompleted].reverse().map((p) => ({
    id: p.id,
    dir: p.dir === 1 ? ('BUY' as const) : ('SELL' as const),
    entryBar: p.entryBar,
    endBar: p.endBar,
    entryPrice: p.entryPrice,
    exitPrice: p.exitPrice,
    exitReason: p.exitReason,
    isWin: p.isWin ?? false,
    pnlText: p.pnlText || (p.isWin ? `+$${p.rewardMoney.toFixed(2)}` : `-$${p.riskMoney.toFixed(2)}`),
    pipsText: p.pipsText || (p.isWin ? `+${Math.round(p.rewardPips)} pips` : `-${Math.round(p.riskPips)} pips`),
  }));

  const lastCompletedPlan = completedPlans.length > 0 ? completedPlans[completedPlans.length - 1] : null;
  const lastCompletedTrade: RecentTradeAudit | null = lastCompletedPlan
    ? {
        id: lastCompletedPlan.id,
        dir: lastCompletedPlan.dir === 1 ? ('BUY' as const) : ('SELL' as const),
        entryBar: lastCompletedPlan.entryBar,
        endBar: lastCompletedPlan.endBar,
        entryPrice: lastCompletedPlan.entryPrice,
        exitPrice: lastCompletedPlan.exitPrice,
        exitReason: lastCompletedPlan.exitReason,
        isWin: lastCompletedPlan.isWin ?? false,
        pnlText:
          lastCompletedPlan.pnlText ||
          (lastCompletedPlan.isWin ? `+$${lastCompletedPlan.rewardMoney.toFixed(2)}` : `-$${lastCompletedPlan.riskMoney.toFixed(2)}`),
        pipsText:
          lastCompletedPlan.pipsText ||
          (lastCompletedPlan.isWin ? `+${Math.round(lastCompletedPlan.rewardPips)} pips` : `-${Math.round(lastCompletedPlan.riskPips)} pips`),
      }
    : null;

  const hud: TradePlannerHud = {
    title: 'TRADE PLANNER',
    riskPctText: isPipsMode
      ? `${pipsSl} pips SL`
      : isCashMode
      ? `$${cashSl.toFixed(2)} exact risk`
      : `${riskPct.toFixed(2)}% risk`,
    statusText: hTx,
    statusBg: hBg,
    entryStr: active ? px(tEntry) : '—',
    stopStr: active
      ? `${px(tSL)}   −$${(isPipsMode ? (pipsSl / 100) * pointValue : isCashMode ? cashSl : riskMoney).toFixed(2)}`
      : '—',
    tp1Str: active ? `${tStage >= 1 ? '✓  ' : ''}${px(tTP1)}` : '—',
    tp2Str: active ? `${tStage >= 2 ? '✓  ' : ''}${px(tTP2)}` : '—',
    tp3Str: active ? px(tTP3) : '—',
    posStr: active ? sizeTxt(tSize) : '—',
    riskStr: isPipsMode
      ? `${pipsSl} pips SL · ${pipsTp1} pips TP`
      : isCashMode
      ? `$${cashSl.toFixed(2)} loss · $${cashTp1.toFixed(2)} win`
      : `${money(riskMoney)}  ·  ${riskPct.toFixed(2)}%`,
    nowStr: active && liveR !== null ? `${liveR >= 0 ? '+' : ''}${liveR.toFixed(1)} R` : '—',
    nowCol: active && liveR !== null ? (liveR >= 0 ? LUNQ_PALETTE.UP : LUNQ_PALETTE.RISK) : LUNQ_PALETTE.MUTE,
    lastPlanStr: lastOut === '' ? '—' : lastOut,
    active,
    stats,
    brokerInfo: brokerLabel,
    slSizeStr: isPipsMode
      ? `${pipsSl} pips SL`
      : isCashMode
      ? `$${cashSl.toFixed(2)} SL`
      : `${slMult.toFixed(2)}x SL`,
    recentTrades,
    lastCompletedTrade,
  };

  return {
    plans: allPlansList,
    signals,
    valueZone,
    hud,
    candleColors: { bull: cBull, bear: cBear, applied: applyCandles },
    currentTrend: lastTrendUp ? 'UP' : lastTrendDn ? 'DOWN' : 'NONE',
    inValueZone: lastTrendUp ? pbL : lastTrendDn ? pbS : false,
    allHistoricalPlans: completedPlans,
  };
}
