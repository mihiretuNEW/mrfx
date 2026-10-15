/**
 * EMA 50/100 + Candle Trend | Albert Setups
 * 100% Exact Port of TradingView Pine Script v6
 *
 * //@version=6
 * indicator("EMA 50/100 + Candle Trend | Albert Setups", overlay=true, max_labels_count=500)
 */

import { Candle } from '../types';

export interface Ema50100Config {
  fastLength?: number; // Fast EMA (default: 50)
  slowLength?: number; // Slow EMA (default: 100)
  showFastEma?: boolean; // Show Fast EMA Line (default: true)
  showSlowEma?: boolean; // Show Slow EMA Line (default: true)
  showSignals?: boolean; // Show BUY / SELL (default: true)
  colorCandles?: boolean; // Color Candles by Trend (default: true)
  showBackground?: boolean; // Show Trend Background (default: false)
  fastColor?: string; // EMA 50 line color (default: '#00e676' lime)
  slowColor?: string; // EMA 100 line color (default: '#ff9800' orange)
  fastLineWidth?: number; // EMA 50 line width (default: 2)
  slowLineWidth?: number; // EMA 100 line width (default: 2)
  buyColor?: string; // BUY Signal color (default: '#00c853' green)
  sellColor?: string; // SELL Signal color (default: '#d50000' red)
}

export interface EmaSignal {
  barIndex: number;
  time: number;
  type: 'BUY' | 'SELL';
  price: number;
  high: number;
  low: number;
}

export interface Ema50100Result {
  emaFast: number[];
  emaSlow: number[];
  currentEmaFast: number | null;
  currentEmaSlow: number | null;
  bullTrend: boolean[];
  bearTrend: boolean[];
  candleColors: string[]; // lime for bull, red for bear, gray for neutral
  signals: EmaSignal[];
  fastLength: number;
  slowLength: number;
  showFastEma: boolean;
  showSlowEma: boolean;
  fastLineWidth: number;
  slowLineWidth: number;
  showSignals: boolean;
  colorCandles: boolean;
  showBackground: boolean;
  fastColor: string;
  slowColor: string;
  buyColor: string;
  sellColor: string;
}

export const DEFAULT_EMA50100_CONFIG: Required<Ema50100Config> = {
  fastLength: 50,
  slowLength: 100,
  showFastEma: true,
  showSlowEma: true,
  fastLineWidth: 2,
  slowLineWidth: 2,
  showSignals: true,
  colorCandles: true,
  showBackground: false,
  fastColor: '#00e676', // color.lime
  slowColor: '#ff9800', // color.orange
  buyColor: '#00c853', // color.green
  sellColor: '#d50000', // color.red
};

/**
 * Standard Pine Script ta.ema implementation:
 * alpha = 2.0 / (length + 1.0)
 * ema := na(ema[1]) ? src : alpha * src + (1 - alpha) * ema[1]
 */
export function calculatePineEma(src: number[], length: number): number[] {
  const n = src.length;
  const result: number[] = new Array(n);
  if (n === 0) return result;

  const len = Math.max(1, Math.round(length));
  const alpha = 2.0 / (len + 1.0);
  let ema = NaN;

  for (let i = 0; i < n; i++) {
    const val = src[i];
    if (val === undefined || isNaN(val)) {
      result[i] = !isNaN(ema) ? ema : NaN;
      continue;
    }
    if (isNaN(ema)) {
      ema = val;
    } else {
      ema = alpha * val + (1.0 - alpha) * ema;
    }
    result[i] = ema;
  }

  return result;
}

export function calculateEma50100CandleTrend(
  candles: Candle[],
  config: Ema50100Config = {}
): Ema50100Result {
  const fastLength = config.fastLength ?? DEFAULT_EMA50100_CONFIG.fastLength;
  const slowLength = config.slowLength ?? DEFAULT_EMA50100_CONFIG.slowLength;
  const showFastEma = config.showFastEma ?? DEFAULT_EMA50100_CONFIG.showFastEma;
  const showSlowEma = config.showSlowEma ?? DEFAULT_EMA50100_CONFIG.showSlowEma;
  const fastLineWidth = config.fastLineWidth ?? DEFAULT_EMA50100_CONFIG.fastLineWidth;
  const slowLineWidth = config.slowLineWidth ?? DEFAULT_EMA50100_CONFIG.slowLineWidth;
  const showSignals = config.showSignals ?? DEFAULT_EMA50100_CONFIG.showSignals;
  const colorCandles = config.colorCandles ?? DEFAULT_EMA50100_CONFIG.colorCandles;
  const showBackground = config.showBackground ?? DEFAULT_EMA50100_CONFIG.showBackground;
  const fastColor = config.fastColor ?? DEFAULT_EMA50100_CONFIG.fastColor;
  const slowColor = config.slowColor ?? DEFAULT_EMA50100_CONFIG.slowColor;
  const buyColor = config.buyColor ?? DEFAULT_EMA50100_CONFIG.buyColor;
  const sellColor = config.sellColor ?? DEFAULT_EMA50100_CONFIG.sellColor;

  const n = candles.length;
  if (n === 0) {
    return {
      emaFast: [],
      emaSlow: [],
      currentEmaFast: null,
      currentEmaSlow: null,
      bullTrend: [],
      bearTrend: [],
      candleColors: [],
      signals: [],
      fastLength,
      slowLength,
      showFastEma,
      showSlowEma,
      fastLineWidth,
      slowLineWidth,
      showSignals,
      colorCandles,
      showBackground,
      fastColor,
      slowColor,
      buyColor,
      sellColor,
    };
  }

  const closes = candles.map((c) => c.close);
  const emaFast = calculatePineEma(closes, fastLength);
  const emaSlow = calculatePineEma(closes, slowLength);

  const bullTrend: boolean[] = new Array(n);
  const bearTrend: boolean[] = new Array(n);
  const candleColors: string[] = new Array(n);
  const signals: EmaSignal[] = [];

  for (let i = 0; i < n; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];

    const isBull = !isNaN(f) && !isNaN(s) && f > s;
    const isBear = !isNaN(f) && !isNaN(s) && f < s;

    bullTrend[i] = isBull;
    bearTrend[i] = isBear;

    // candleColor = bullTrend ? color.lime : bearTrend ? color.red : color.gray
    if (isBull) {
      candleColors[i] = fastColor; // lime
    } else if (isBear) {
      candleColors[i] = sellColor; // red
    } else {
      candleColors[i] = '#94a3b8'; // gray
    }

    // BUY / SELL Signals: ta.crossover / ta.crossunder
    if (i > 0 && !isNaN(f) && !isNaN(s)) {
      const prevF = emaFast[i - 1];
      const prevS = emaSlow[i - 1];

      if (!isNaN(prevF) && !isNaN(prevS)) {
        // ta.crossover(ema50, ema100)
        const isCrossover = prevF <= prevS && f > s;
        // ta.crossunder(ema50, ema100)
        const isCrossunder = prevF >= prevS && f < s;

        if (isCrossover) {
          signals.push({
            barIndex: i,
            time: candles[i].time,
            type: 'BUY',
            price: candles[i].close,
            high: candles[i].high,
            low: candles[i].low,
          });
        } else if (isCrossunder) {
          signals.push({
            barIndex: i,
            time: candles[i].time,
            type: 'SELL',
            price: candles[i].close,
            high: candles[i].high,
            low: candles[i].low,
          });
        }
      }
    }
  }

  // Cap signals to max_labels_count=500 matching Pine Script
  const trimmedSignals = signals.slice(-500);

  const currentEmaFast = n > 0 && !isNaN(emaFast[n - 1]) ? emaFast[n - 1] : null;
  const currentEmaSlow = n > 0 && !isNaN(emaSlow[n - 1]) ? emaSlow[n - 1] : null;

  return {
    emaFast,
    emaSlow,
    currentEmaFast,
    currentEmaSlow,
    bullTrend,
    bearTrend,
    candleColors,
    signals: trimmedSignals,
    fastLength,
    slowLength,
    showFastEma,
    showSlowEma,
    fastLineWidth,
    slowLineWidth,
    showSignals,
    colorCandles,
    showBackground,
    fastColor,
    slowColor,
    buyColor,
    sellColor,
  };
}
