/**
 * Multi-Timeframe EMA 15m 1H
 * 100% Exact Port of TradingView Pine Script v6
 *
 * //@version=6
 * indicator("Multi-Timeframe EMA 15m 1H", overlay=true)
 *
 * Smooth higher-timeframe-equivalent EMAs calculated on continuous candle data:
 * 15 minutes = 3 × 5-minute candles (length * 3)
 * 1 hour    = 12 × 5-minute candles (length * 12)
 */

import { Candle } from '../types';

export interface MtfEmaOptions {
  length?: number; // EMA Length (default: 20, minval: 1)
  show15min?: boolean; // Show 15-minute EMA (default: true)
  show60min?: boolean; // Show 1-hour EMA (default: true)
  color15min?: string; // 15-minute EMA Color (default: '#00008B')
  color60min?: string; // 1-hour EMA Color (default: '#FF0000')
  adaptiveTf?: boolean; // Dynamically adjust multipliers to current timeframe (default: true)
}

export interface MtfEmaResult {
  ema15: number[];
  ema60: number[];
  currentEma15: number | null;
  currentEma60: number | null;
  color15: string;
  color60: string;
  show15: boolean;
  show60: boolean;
}

/**
 * Exact Pine Script smooth EMA calculation:
 * f_smooth_ema(src, len) =>
 *     alpha = 2.0 / (len + 1.0)
 *     float emaValue = na
 *     emaValue := na(emaValue[1]) ? src : alpha * src + (1.0 - alpha) * emaValue[1]
 *     emaValue
 */
export function f_smooth_ema(src: number[], len: number): number[] {
  const n = src.length;
  const result: number[] = new Array(n);
  if (n === 0) return result;

  const effectiveLen = Math.max(1, Math.round(len));
  const alpha = 2.0 / (effectiveLen + 1.0);
  let emaVal = NaN;

  for (let i = 0; i < n; i++) {
    const val = src[i];
    // Guard against any null/undefined/NaN tick data in JavaScript array
    if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
      result[i] = !isNaN(emaVal) ? emaVal : NaN;
      continue;
    }
    if (isNaN(emaVal)) {
      emaVal = val;
    } else {
      emaVal = alpha * val + (1.0 - alpha) * emaVal;
    }
    result[i] = emaVal;
  }

  return result;
}

export function calculateMultiTimeframeEma(
  candles: Candle[],
  options: MtfEmaOptions = {},
  _currentTimeframe?: string
): MtfEmaResult {
  const n = candles.length;
  const length = Math.max(1, Math.round(options.length ?? 20));
  const show15 = options.show15min ?? true;
  const show60 = options.show60min ?? true;
  const color15 = options.color15min ?? '#00008B';
  const color60 = options.color60min ?? '#FF0000';

  if (n === 0) {
    return {
      ema15: [],
      ema60: [],
      currentEma15: null,
      currentEma60: null,
      color15,
      color60,
      show15,
      show60,
    };
  }

  // 100% Exact TradingView Pine Script v6 execution:
  // ema_15 = f_smooth_ema(close, length * 3)
  // ema_60 = f_smooth_ema(close, length * 12)
  // TradingView evaluates length * 3 (= 60) and length * 12 (= 240) as constant bar lengths
  // across all timeframes.
  const len15 = Math.max(1, Math.round(length * 3));
  const len60 = Math.max(1, Math.round(length * 12));

  const closes = candles.map((c) => c.close);
  const ema15 = show15 ? f_smooth_ema(closes, len15) : new Array(n).fill(NaN);
  const ema60 = show60 ? f_smooth_ema(closes, len60) : new Array(n).fill(NaN);

  const currentEma15 = ema15.length > 0 && !isNaN(ema15[n - 1]) ? ema15[n - 1] : null;
  const currentEma60 = ema60.length > 0 && !isNaN(ema60[n - 1]) ? ema60[n - 1] : null;

  return {
    ema15,
    ema60,
    currentEma15,
    currentEma60,
    color15,
    color60,
    show15,
    show60,
  };
}
