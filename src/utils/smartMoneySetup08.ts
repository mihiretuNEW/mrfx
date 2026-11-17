/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 1:1 Exact TypeScript Port of:
 * "Smart Money Setup 08 [TradingFinder] Binary Options Gold Scalper" ("Smart Money Setup 08 TFlab")
 * Original Pine Script™ v5 © TFlab (Mozilla Public License 2.0)
 */

import { Candle } from '../types';

export interface SmartMoneySetup08Config {
  swingPeriod: number;
  alertEnabled: boolean;
  alertName: string;
  frequency: 'All' | 'Once Per Bar' | 'Per Bar Close';
  utc: string;
  messageBull: string;
  messageBear: string;
  fvgFilter: 'Off' | 'On';
  fvgFilterType: 'Very Aggressive' | 'Aggressive' | 'Defensive' | 'Very Defensive';
  confirmLastBar: boolean;
}

export const DEFAULT_SM08_CONFIG: SmartMoneySetup08Config = {
  swingPeriod: 5,
  alertEnabled: true,
  alertName: 'Smart Money Setup 08 [TradingFinder]',
  frequency: 'Once Per Bar',
  utc: 'UTC',
  messageBull: 'Long Signal Position',
  messageBear: 'Short Signal Position',
  fvgFilter: 'Off',
  fvgFilterType: 'Very Aggressive',
  confirmLastBar: false,
};

export interface Sm08Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  style: 'dotted' | 'dashed';
}

export interface Sm08Label {
  x: number;
  y: number;
  text: string;
  bgColor: string; // 'transparent' when alpha = 0
  textColor: string;
}

export interface Sm08GradientBox {
  x1: number;
  x2: number;
  d: number; // Base edge (strongest opacity at i = 0)
  p: number; // Fade edge (fades out at i = 19)
  baseHex: string; // RGB hex e.g. '#00d370'
  baseTransp: number; // Pine transparency offset: 55 for bull, 50 for bear
}

export interface Sm08Signal {
  barIndex: number;
  time: number;
  direction: 'bull' | 'bear';
  price: number;
  message: string;
}

export interface Sm08SetupDrawing {
  direction: 'bull' | 'bear';
  barIndex: number;
  minBarIndex: number;
  maxBarIndex: number;
  lines: Sm08Line[];
  labels: Sm08Label[];
  boxes: Sm08GradientBox[];
}

export interface SmartMoneySetup08Result {
  setups: Sm08SetupDrawing[];
  signals: Sm08Signal[];
  lastAlert: {
    direction: 'bull' | 'bear';
    barIndex: number;
    time: number;
    price: number;
    alertName: string;
    message: string;
  } | null;
}

interface Sm08PatternData {
  G_Permit: number;
  Lvl_cp: number;
  Lvl_ci: number;
  Lvl_pt: number;
  POI_pt: number;
  POI_t: number;
  POI_i: number;
  POI_o: number;
  POI_h: number;
  POI_l: number;
  POI_c: number;
  FVG_i: number;
  FVG_d: number;
  FVG_p: number;
  Fill_Ch_i: number;
  Fill_POI_i: number;
  Swg_i: number;
  Swg_p: number;
}

/**
 * Exact Pine Script ta.atr(length) using RMA of True Range
 */
function calculatePineATR(candles: Candle[], length: number): number[] {
  const n = candles.length;
  const atr = new Array<number>(n).fill(NaN);
  if (n === 0) return atr;

  const tr = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    if (i === 0) {
      tr[i] = h - l;
    } else {
      const prevC = candles[i - 1].close;
      tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    }
  }

  let sum = 0;
  let prevRma = NaN;
  const alpha = 1 / length;
  for (let i = 0; i < n; i++) {
    if (i < length) {
      sum += tr[i];
      if (i === length - 1) {
        prevRma = sum / length;
        atr[i] = prevRma;
      }
    } else {
      prevRma = alpha * tr[i] + (1 - alpha) * prevRma;
      atr[i] = prevRma;
    }
  }

  return atr;
}

/**
 * Exact Pine Script ta.pivothigh(SwingPeriod, SwingPeriod) and ta.pivotlow(SwingPeriod, SwingPeriod)
 */
function detectPivotHigh(candles: Candle[], barIndex: number, period: number): number | null {
  if (barIndex < period * 2) return null;
  const pivotIdx = barIndex - period;
  const pivotVal = candles[pivotIdx].high;
  for (let j = pivotIdx - period; j < pivotIdx; j++) {
    if (candles[j].high > pivotVal) return null;
  }
  for (let j = pivotIdx + 1; j <= pivotIdx + period; j++) {
    if (candles[j].high >= pivotVal) return null;
  }
  return pivotVal;
}

function detectPivotLow(candles: Candle[], barIndex: number, period: number): number | null {
  if (barIndex < period * 2) return null;
  const pivotIdx = barIndex - period;
  const pivotVal = candles[pivotIdx].low;
  for (let j = pivotIdx - period; j < pivotIdx; j++) {
    if (candles[j].low < pivotVal) return null;
  }
  for (let j = pivotIdx + 1; j <= pivotIdx + period; j++) {
    if (candles[j].low <= pivotVal) return null;
  }
  return pivotVal;
}

export function calculateSmartMoneySetup08(
  candles: Candle[],
  config: Partial<SmartMoneySetup08Config> = {}
): SmartMoneySetup08Result {
  const cfg: SmartMoneySetup08Config = {
    ...DEFAULT_SM08_CONFIG,
    ...config,
    swingPeriod: Math.max(1, Math.round(config.swingPeriod ?? DEFAULT_SM08_CONFIG.swingPeriod)),
  };

  const n = candles.length;
  if (n === 0) {
    return { setups: [], signals: [], lastAlert: null };
  }

  const SwingPeriod = cfg.swingPeriod;
  const VFVGFilter = cfg.fvgFilter;
  const VFVGFilterType = cfg.fvgFilterType;

  // FVG_Detector persistent state
  let DConditionFVG = false;
  let SConditionFVG = false;
  const atr55 = calculatePineATR(candles, 55);

  // SF_Detector persistent state (called with: SwingPeriod, 'Custom', 100, 'Real SFP', 2)
  const Z = 100000000000000000;
  const MaxSwingBack_Method = 'Custom' as 'All' | 'Custom';
  const MaxSwingBack = 100;
  const SFPType = 'Real SFP' as 'All' | 'Real SFP' | 'Considerable SFP';
  const BackToBreakPeriod = 2;

  const MSH_P: number[] = [];
  const MSH_I: number[] = [];
  const MSH_II: number[] = [];
  const MSH_Permit: boolean[] = [];
  const AOI_MSH: number[] = [];

  const MSL_P: number[] = [];
  const MSL_I: number[] = [];
  const MSL_II: number[] = [];
  const MSL_Permit: boolean[] = [];
  const AOI_MSL: number[] = [];

  let Last_MSH_P = 0.0;
  let Last_MSH_I = 0;
  let Last_MSL_P = 0.0;
  let Last_MSL_I = 0;

  let HSwingBack = 0;
  let LSwingBack = 0;

  let RealSFP = false;
  let ConsiderableSFP = false;

  let H_Price_SFP = 0.0;
  let H_Index_SFP = 0;
  let L_Price_SFP = 0.0;
  let L_Index_SFP = 0;

  // Pattern_Checker persistent state
  let xSL_i = 0;
  let xSL_ii = 0;
  let xSL_p = 0.0;
  let ChoCh_i = 0;
  let ChoCh_ii = 0;
  let ChoCh_p = 0.0;
  let POI_i = 0;
  let POI_ii = 0;
  let POI_p = 0.0;
  let POI_d = 0.0;
  let FVG_i = 0;
  let FVG_p = 0.0;
  let FVG_d = 0.0;
  const Data: Sm08PatternData[] = [];

  const setups: Sm08SetupDrawing[] = [];
  const signals: Sm08Signal[] = [];
  let lastAlert: SmartMoneySetup08Result['lastAlert'] = null;

  for (let bar_index = 0; bar_index < n; bar_index++) {
    const c = candles[bar_index];
    const isConfirmed = cfg.confirmLastBar ? true : bar_index < n - 1;

    // ── 1. FVG_Detector(VFVGFilter, VFVGFilterType) ───────────────────────────
    const ATR = atr55[bar_index];
    if (bar_index >= 2) {
      const c1 = candles[bar_index - 1];
      const c2 = candles[bar_index - 2];
      const range0 = c.high - c.low;
      const range1 = c1.high - c1.low;
      const range2 = c2.high - c2.low;

      if (VFVGFilter === 'Off') {
        DConditionFVG = c.low > c2.high;
        SConditionFVG = c.high < c2.low;
      } else {
        // VFVGFilter === 'On'
        if (VFVGFilterType === 'Very Aggressive') {
          DConditionFVG = c.low > c2.high && c.high > c1.high;
          SConditionFVG = c.high < c2.low && c1.low > c.low;
        } else if (VFVGFilterType === 'Aggressive') {
          DConditionFVG = !isNaN(ATR) && c.low > c2.high && range1 >= 1.0 * ATR && c.high > c1.high;
          SConditionFVG = !isNaN(ATR) && c.high < c2.low && range1 >= 1.0 * ATR && c1.low > c.low;
        } else if (VFVGFilterType === 'Defensive') {
          const bodyRatio1 = range1 > 0 ? Math.abs((c1.close - c1.open) / range1) : NaN;
          DConditionFVG =
            !isNaN(ATR) &&
            c.low > c2.high &&
            range1 >= 1.5 * ATR &&
            c.high > c1.high &&
            ((c2.close - c2.open > 0 && c1.close - c1.open > 0) || (!isNaN(bodyRatio1) && bodyRatio1 > 0.7));
          SConditionFVG =
            !isNaN(ATR) &&
            c.high < c2.low &&
            range1 >= 1.5 * ATR &&
            c1.low > c.low &&
            ((c2.close - c2.open < 0 && c1.close - c1.open < 0) || (!isNaN(bodyRatio1) && bodyRatio1 > 0.7));
        } else {
          // Very Defensive
          const bodyRatio0 = range0 > 0 ? Math.abs((c.close - c.open) / range0) : NaN;
          const bodyRatio1 = range1 > 0 ? Math.abs((c1.close - c1.open) / range1) : NaN;
          const bodyRatio2 = range2 > 0 ? Math.abs((c2.close - c2.open) / range2) : NaN;
          DConditionFVG =
            !isNaN(ATR) &&
            c.low > c2.high &&
            range1 >= 1.5 * ATR &&
            c.high > c1.high &&
            c2.close - c2.open > 0 &&
            c1.close - c1.open > 0 &&
            !isNaN(bodyRatio1) &&
            bodyRatio1 > 0.7 &&
            !isNaN(bodyRatio2) &&
            bodyRatio2 > 0.35 &&
            !isNaN(bodyRatio0) &&
            bodyRatio0 > 0.35;
          SConditionFVG =
            !isNaN(ATR) &&
            c.high < c2.low &&
            range1 >= 1.5 * ATR &&
            c1.low > c.low &&
            c2.close - c2.open < 0 &&
            c1.close - c1.open < 0 &&
            !isNaN(bodyRatio1) &&
            bodyRatio1 > 0.7 &&
            !isNaN(bodyRatio2) &&
            bodyRatio2 > 0.35 &&
            !isNaN(bodyRatio0) &&
            bodyRatio0 > 0.35;
        }
      }
    } else {
      DConditionFVG = false;
      SConditionFVG = false;
    }

    // ── 2. SF_Detector(SwingPeriod, 'Custom', 100, 'Real SFP', 2) ─────────────
    let HAlert = false;
    let LAlert = false;

    const MSH = detectPivotHigh(candles, bar_index, SwingPeriod);
    const MSL = detectPivotLow(candles, bar_index, SwingPeriod);

    if (MSH !== null) {
      const pivIdx = bar_index - SwingPeriod;
      MSH_P.push(candles[pivIdx].high);
      MSH_I.push(candles[pivIdx].time);
      MSH_II.push(pivIdx);
      MSH_Permit.push(true);
      AOI_MSH.push(Z);
    }

    if (MSL !== null) {
      const pivIdx = bar_index - SwingPeriod;
      MSL_P.push(candles[pivIdx].low);
      MSL_I.push(candles[pivIdx].time);
      MSL_II.push(pivIdx);
      MSL_Permit.push(true);
      AOI_MSL.push(Z);
    }

    if (MSH_P.length > 0) {
      Last_MSH_P = MSH_P[MSH_P.length - 1];
      Last_MSH_I = MSH_II[MSH_I.length - 1];
    }

    if (MSL_P.length > 0) {
      Last_MSL_P = MSL_P[MSL_P.length - 1];
      Last_MSL_I = MSL_II[MSL_I.length - 1];
    }

    if (MaxSwingBack_Method === 'All') {
      HSwingBack = MSH_P.length;
      LSwingBack = MSL_P.length;
    } else {
      HSwingBack = MaxSwingBack;
      LSwingBack = MaxSwingBack;
    }

    if (SFPType === 'All') {
      RealSFP = true;
      ConsiderableSFP = true;
    } else if (SFPType === 'Real SFP') {
      RealSFP = true;
      ConsiderableSFP = false;
    } else {
      RealSFP = false;
      ConsiderableSFP = true;
    }

    const barChanged = bar_index > 0; // bar_index > bar_index[1]

    if (MSH_P.length > 0 && barChanged) {
      const prevClose = candles[bar_index - 1].close;
      const limitH = Math.min(HSwingBack, MSH_P.length);
      for (let i = 1; i <= limitH; i++) {
        const idx = MSH_P.length - i;
        if (MSH_Permit[idx]) {
          if (bar_index <= AOI_MSH[idx] + BackToBreakPeriod) {
            if (
              (MSH_P[idx] < c.high && MSH_P[idx] > c.close && AOI_MSH[idx] === Z && RealSFP) ||
              (MSH_P[idx] > c.close && MSH_P[idx] < prevClose && ConsiderableSFP)
            ) {
              MSH_Permit[idx] = false;
              if (bar_index - MSH_II[idx] >= 10 && bar_index - MSH_II[idx] <= 50) {
                MSH_Permit[idx] = false;
                H_Index_SFP = MSH_II[idx];
                H_Price_SFP = MSH_P[idx];
                HAlert = true;
              }
            }
            if (RealSFP === false) {
              if (MSH_P[idx] < c.high && MSH_P[idx] > c.close && AOI_MSH[idx] === Z) {
                MSH_Permit[idx] = false;
              }
            }
          }
          if (MSH_P[idx] < c.close && AOI_MSH[idx] === Z) {
            AOI_MSH[idx] = bar_index;
          }
        }
      }
    }

    if (MSL_P.length > 0 && barChanged) {
      const prevClose = candles[bar_index - 1].close;
      const limitL = Math.min(LSwingBack, MSL_P.length);
      for (let i = 1; i <= limitL; i++) {
        const idx = MSL_P.length - i;
        if (MSL_Permit[idx]) {
          if (bar_index <= AOI_MSL[idx] + BackToBreakPeriod) {
            if (
              (MSL_P[idx] > c.low && MSL_P[idx] < c.close && AOI_MSL[idx] === Z && RealSFP) ||
              (MSL_P[idx] < c.close && MSL_P[idx] > prevClose && ConsiderableSFP)
            ) {
              MSL_Permit[idx] = false;
              if (bar_index - MSL_II[idx] >= 10 && bar_index - MSL_II[idx] <= 100) {
                MSL_Permit[idx] = false;
                L_Index_SFP = MSL_II[idx];
                L_Price_SFP = MSL_P[idx];
                LAlert = true;
              }
            }
            if (RealSFP === false) {
              if (MSL_P[idx] > c.low && MSL_P[idx] < c.close && AOI_MSL[idx] === Z) {
                MSL_Permit[idx] = false;
              }
            }
          }
          if (MSL_P[idx] > c.close && AOI_MSL[idx] === Z) {
            AOI_MSL[idx] = bar_index;
          }
        }
      }
    }

    // ── 3. Pattern_Checker() ──────────────────────────────────────────────────
    let Bull = false;
    let Bear = false;

    if (isConfirmed) {
      if (LAlert && MSH_P.length > 0) {
        Data.push({
          G_Permit: 1,
          Lvl_cp: Last_MSH_P,
          Lvl_ci: Last_MSH_I,
          Lvl_pt: 0,
          POI_pt: 0,
          POI_t: 1,
          POI_i: bar_index,
          POI_o: c.open,
          POI_h: c.high,
          POI_l: c.low,
          POI_c: c.close,
          FVG_i: 0,
          FVG_d: 0,
          FVG_p: 0,
          Fill_Ch_i: 0,
          Fill_POI_i: 0,
          Swg_i: L_Index_SFP,
          Swg_p: L_Price_SFP,
        });
      }

      if (HAlert && MSL_P.length > 0) {
        Data.push({
          G_Permit: 1,
          Lvl_cp: Last_MSL_P,
          Lvl_ci: Last_MSL_I,
          Lvl_pt: 0,
          POI_pt: 0,
          POI_t: -1,
          POI_i: bar_index,
          POI_o: c.open,
          POI_h: c.high,
          POI_l: c.low,
          POI_c: c.close,
          FVG_i: 0,
          FVG_d: 0,
          FVG_p: 0,
          Fill_Ch_i: 0,
          Fill_POI_i: 0,
          Swg_i: H_Index_SFP,
          Swg_p: H_Price_SFP,
        });
      }
    }

    if (isConfirmed && Data.length > 0) {
      const dataLimit = Math.min(10, Data.length);
      for (let i = 1; i <= dataLimit; i++) {
        const get = Data[Data.length - i];

        if (get.G_Permit === 1) {
          if (get.POI_t === 1) {
            if (get.POI_l > c.close) {
              get.G_Permit = 0;
            }

            if (get.POI_i + SwingPeriod <= bar_index && get.POI_pt === 0) {
              if (get.POI_h > c.low && c.close > get.POI_l) {
                get.POI_pt = 1;
                get.Fill_POI_i = bar_index;
              }
            }

            if (get.Lvl_pt === 0) {
              if (c.close > get.Lvl_cp) {
                get.Lvl_pt = 1;
                get.Fill_Ch_i = bar_index;
              }
              if (Last_MSH_P > get.Lvl_cp) {
                get.Lvl_ci = Last_MSH_I;
                get.Lvl_cp = Last_MSH_P;
              }
            }

            if (get.FVG_i === 0) {
              if (get.POI_pt === 1) {
                if (DConditionFVG) {
                  get.FVG_i = bar_index - 1;
                  get.FVG_d = candles[bar_index - 2].high;
                  get.FVG_p = c.low;
                }
              }
            } else {
              if (c.low < get.FVG_p && c.close > get.FVG_d && get.Lvl_pt === 1) {
                xSL_i = get.Swg_i;
                xSL_ii = get.POI_i;
                xSL_p = get.Swg_p;
                ChoCh_i = get.Lvl_ci;
                ChoCh_ii = get.Fill_Ch_i;
                ChoCh_p = get.Lvl_cp;
                POI_i = get.POI_i;
                POI_ii = get.Fill_POI_i;
                POI_p = get.POI_h;
                POI_d = get.POI_l;
                FVG_i = get.FVG_i;
                FVG_p = get.FVG_p;
                FVG_d = get.FVG_d;
                Bull = true;
                get.G_Permit = 0;
              }
              if (c.close < get.FVG_d) {
                get.G_Permit = 0;
              }
            }
          }

          if (get.POI_t === -1) {
            if (get.POI_h < c.close) {
              get.G_Permit = 0;
            }

            if (get.POI_i + SwingPeriod <= bar_index && get.POI_pt === 0) {
              if (get.POI_l < c.high) {
                get.POI_pt = 1;
                get.Fill_POI_i = bar_index;
              }
            }

            if (get.Lvl_pt === 0) {
              if (c.close < get.Lvl_cp) {
                get.Lvl_pt = 1;
                get.Fill_Ch_i = bar_index;
              }
              if (Last_MSL_P < get.Lvl_cp) {
                get.Lvl_ci = Last_MSL_I;
                get.Lvl_cp = Last_MSL_P;
              }
            }

            if (get.FVG_i === 0) {
              if (get.POI_pt === 1) {
                if (SConditionFVG) {
                  get.FVG_i = bar_index - 1;
                  get.FVG_d = candles[bar_index - 2].low;
                  get.FVG_p = c.high;
                }
              }
            } else {
              if (c.high > get.FVG_p && c.close < get.FVG_d && get.Lvl_pt === 1) {
                xSL_i = get.Swg_i;
                xSL_ii = get.POI_i;
                xSL_p = get.Swg_p;
                ChoCh_i = get.Lvl_ci;
                ChoCh_ii = get.Fill_Ch_i;
                ChoCh_p = get.Lvl_cp;
                POI_i = get.POI_i;
                POI_ii = get.Fill_POI_i;
                POI_p = get.POI_l;
                POI_d = get.POI_h;
                FVG_i = get.FVG_i;
                FVG_p = get.FVG_p;
                FVG_d = get.FVG_d;
                Bear = true;
                get.G_Permit = 0;
              }
              if (c.close > get.FVG_d) {
                get.G_Permit = 0;
              }
            }
          }
        }
      }
    }

    // ── 4. Drawing(Bull, Bear, ...) & Plotshape & Alerts ──────────────────────
    if (Bull) {
      const minX = Math.min(xSL_i, xSL_ii, ChoCh_i, ChoCh_ii, POI_i, POI_ii, FVG_i, bar_index);
      const maxX = Math.max(xSL_i, xSL_ii, ChoCh_i, ChoCh_ii, POI_i, POI_ii, FVG_i, bar_index);
      setups.push({
        direction: 'bull',
        barIndex: bar_index,
        minBarIndex: minX,
        maxBarIndex: maxX,
        lines: [
          { x1: xSL_i, y1: xSL_p, x2: xSL_ii, y2: xSL_p, color: '#5be660', style: 'dotted' },
          { x1: ChoCh_i, y1: ChoCh_p, x2: ChoCh_ii, y2: ChoCh_p, color: '#5be660', style: 'dotted' },
          { x1: POI_i, y1: POI_d, x2: POI_ii, y2: POI_d, color: '#509fff', style: 'dashed' },
          { x1: POI_i, y1: POI_p, x2: POI_ii, y2: POI_p, color: '#509fff', style: 'dashed' },
          { x1: FVG_i, y1: FVG_d, x2: bar_index, y2: FVG_d, color: '#68ff6d', style: 'dashed' },
          { x1: FVG_i, y1: FVG_p, x2: bar_index, y2: FVG_p, color: '#68ff6d', style: 'dashed' },
        ],
        labels: [
          { x: Math.trunc((xSL_i + xSL_ii) / 2), y: xSL_p, text: 'SSL', bgColor: '#a5f2a7', textColor: '#000000' },
          { x: Math.trunc((ChoCh_i + ChoCh_ii) / 2), y: ChoCh_p, text: 'ChoCh', bgColor: '#a5f2a7', textColor: '#000000' },
          { x: Math.trunc((POI_i + POI_ii) / 2), y: (POI_d + POI_p) / 2, text: 'POI', bgColor: 'transparent', textColor: '#dadada' },
          { x: Math.trunc((FVG_i + bar_index) / 2), y: (FVG_d + FVG_p) / 2, text: 'Imbalance', bgColor: 'transparent', textColor: '#dadada' },
        ],
        boxes: [
          { x1: FVG_i, x2: bar_index, d: FVG_d, p: FVG_p, baseHex: '#00d370', baseTransp: 55 },
          { x1: POI_i, x2: POI_ii, d: POI_d, p: POI_p, baseHex: '#00b4eb', baseTransp: 55 },
        ],
      });

      signals.push({
        barIndex: bar_index,
        time: c.time,
        direction: 'bull',
        price: c.low,
        message: cfg.messageBull,
      });

      if (cfg.alertEnabled) {
        lastAlert = {
          direction: 'bull',
          barIndex: bar_index,
          time: c.time,
          price: c.close,
          alertName: cfg.alertName,
          message: cfg.messageBull,
        };
      }
    }

    if (Bear) {
      const minX = Math.min(xSL_i, xSL_ii, ChoCh_i, ChoCh_ii, POI_i, POI_ii, FVG_i, bar_index);
      const maxX = Math.max(xSL_i, xSL_ii, ChoCh_i, ChoCh_ii, POI_i, POI_ii, FVG_i, bar_index);
      setups.push({
        direction: 'bear',
        barIndex: bar_index,
        minBarIndex: minX,
        maxBarIndex: maxX,
        lines: [
          { x1: xSL_i, y1: xSL_p, x2: xSL_ii, y2: xSL_p, color: '#e65b5b', style: 'dotted' },
          { x1: ChoCh_i, y1: ChoCh_p, x2: ChoCh_ii, y2: ChoCh_p, color: '#e65b5b', style: 'dotted' },
          { x1: POI_i, y1: POI_d, x2: POI_ii, y2: POI_d, color: '#ffeb50', style: 'dashed' },
          { x1: POI_i, y1: POI_p, x2: POI_ii, y2: POI_p, color: '#ffeb50', style: 'dashed' },
          { x1: FVG_i, y1: FVG_d, x2: bar_index, y2: FVG_d, color: '#ff6868', style: 'dashed' },
          { x1: FVG_i, y1: FVG_p, x2: bar_index, y2: FVG_p, color: '#ff6868', style: 'dashed' },
        ],
        labels: [
          { x: Math.trunc((xSL_i + xSL_ii) / 2), y: xSL_p, text: 'BSL', bgColor: '#dd8e8e', textColor: '#ffffff' },
          { x: Math.trunc((ChoCh_i + ChoCh_ii) / 2), y: ChoCh_p, text: 'ChoCh', bgColor: '#dd8e8e', textColor: '#ffffff' },
          { x: Math.trunc((POI_i + POI_ii) / 2), y: (POI_d + POI_p) / 2, text: 'POI', bgColor: 'transparent', textColor: '#dadada' },
          { x: Math.trunc((FVG_i + bar_index) / 2), y: (FVG_d + FVG_p) / 2, text: 'Imbalance', bgColor: 'transparent', textColor: '#dadada' },
        ],
        boxes: [
          { x1: FVG_i, x2: bar_index, d: FVG_d, p: FVG_p, baseHex: '#d3004a', baseTransp: 50 },
          { x1: POI_i, x2: POI_ii, d: POI_d, p: POI_p, baseHex: '#e7eb00', baseTransp: 50 },
        ],
      });

      signals.push({
        barIndex: bar_index,
        time: c.time,
        direction: 'bear',
        price: c.high,
        message: cfg.messageBear,
      });

      if (cfg.alertEnabled) {
        lastAlert = {
          direction: 'bear',
          barIndex: bar_index,
          time: c.time,
          price: c.close,
          alertName: cfg.alertName,
          message: cfg.messageBear,
        };
      }
    }
  }

  return { setups, signals, lastAlert };
}
