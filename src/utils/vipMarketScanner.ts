/**
 * VIP Market Scanner™ (VIP Algos) - Single Pair Matrix Engine
 * Multi-Timeframe & Momentum Confluence Scanner for the active symbol.
 * Clean layout with zero bottom or top signature watermarks.
 */

import { Candle, TimeframeId } from '../types';

export interface VipScannerRow {
  timeframe: string;
  trend: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
  trendText: string;
  trendColor: string;
  rsi: number;
  rsiStatus: 'OVERSOLD' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'OVERBOUGHT';
  rsiColor: string;
  volatility: 'SQUEEZE' | 'NORMAL' | 'EXPANDING';
  volatilityText: string;
  volatilityColor: string;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signalColor: string;
  score: number; // -100 to +100
}

export interface VipScannerResult {
  symbol: string;
  chartTimeframe: TimeframeId;
  rows: VipScannerRow[];
  confluenceBullishPct: number; // 0 - 100%
  confluenceBearishPct: number; // 0 - 100%
  masterVerdict: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  masterVerdictColor: string;
  alignmentAlert: string | null;
  activeSignalBadge: {
    text: string;
    color: string;
    subText: string;
  };
}

export interface VipScannerOptions {
  enabled?: boolean;
  showHud?: boolean;
  hudPosition?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left';
  hudOpacity?: number;
  rsiPeriod?: number;
  fastEma?: number;
  slowEma?: number;
  signalEma?: number;
  showAlignmentSignals?: boolean;
}

// EMA helper
function calculateEma(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = new Array(values.length);
  let sum = 0;
  const initialBars = Math.min(period, values.length);
  for (let i = 0; i < initialBars; i++) {
    sum += values[i];
  }
  ema[initialBars - 1] = sum / initialBars;
  for (let i = 0; i < initialBars - 1; i++) {
    ema[i] = values[i];
  }
  for (let i = initialBars; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

// RSI helper
function calculateRsi(candles: Candle[], period = 14): number {
  if (candles.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.max(0, Math.min(100, 100 - (100 / (1 + rs))));
}

// Synthetic higher timeframe aggregation for single pair scanner
function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1 || candles.length === 0) return candles;
  const aggregated: Candle[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor);
    if (chunk.length === 0) continue;
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const c of chunk) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume || 0;
    }
    aggregated.push({
      time: chunk[0].time,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return aggregated;
}

export function calculateVipMarketScanner(
  candles: Candle[],
  chartTimeframe: TimeframeId,
  symbol: string,
  options: VipScannerOptions = {}
): VipScannerResult | null {
  if (!candles || candles.length < 20) return null;

  const rsiPeriod = options.rsiPeriod ?? 14;
  const fastPeriod = options.fastEma ?? 9;
  const slowPeriod = options.slowEma ?? 21;
  const baselinePeriod = options.signalEma ?? 50;

  // Timeframes to scan: 5M, 15M, 30M, 1H, 4H, 1D
  // Using multi-tier sampling relative to active chart timeframe
  const tfConfigs = [
    { label: '5M', factor: 1 },
    { label: '15M', factor: 3 },
    { label: '30M', factor: 6 },
    { label: '1H', factor: 12 },
    { label: '4H', factor: 24 },
    { label: '1D', factor: 48 },
  ];

  const rows: VipScannerRow[] = [];
  let totalBullScore = 0;
  let totalBearScore = 0;

  tfConfigs.forEach((cfg) => {
    const bars = cfg.factor === 1 ? candles : aggregateCandles(candles, cfg.factor);
    const len = bars.length;
    if (len < 10) return;

    const closes = bars.map((c) => c.close);
    const lastClose = closes[len - 1];

    const emaFast = calculateEma(closes, fastPeriod);
    const emaSlow = calculateEma(closes, slowPeriod);
    const emaBase = calculateEma(closes, baselinePeriod);

    const vFast = emaFast[len - 1] ?? lastClose;
    const vSlow = emaSlow[len - 1] ?? lastClose;
    const vBase = emaBase[len - 1] ?? lastClose;

    // Trend determination
    let trend: VipScannerRow['trend'] = 'NEUTRAL';
    let trendText = 'NEUTRAL';
    let trendColor = '#94a3b8'; // slate

    if (vFast > vSlow && lastClose > vFast && vSlow > vBase) {
      trend = 'STRONG_BULL';
      trendText = 'STR BULL ▲▲';
      trendColor = '#10b981'; // emerald
    } else if (vFast > vSlow || lastClose > vBase) {
      trend = 'BULL';
      trendText = 'BULLISH ▲';
      trendColor = '#34d399';
    } else if (vFast < vSlow && lastClose < vFast && vSlow < vBase) {
      trend = 'STRONG_BEAR';
      trendText = 'STR BEAR ▼▼';
      trendColor = '#ef4444'; // red
    } else if (vFast < vSlow || lastClose < vBase) {
      trend = 'BEAR';
      trendText = 'BEARISH ▼';
      trendColor = '#f87171';
    }

    // RSI calculation
    const rsiVal = calculateRsi(bars, rsiPeriod);
    let rsiStatus: VipScannerRow['rsiStatus'] = 'NEUTRAL';
    let rsiColor = '#94a3b8';

    if (rsiVal >= 70) {
      rsiStatus = 'OVERBOUGHT';
      rsiColor = '#f59e0b'; // amber
    } else if (rsiVal >= 55) {
      rsiStatus = 'BULLISH';
      rsiColor = '#10b981';
    } else if (rsiVal <= 30) {
      rsiStatus = 'OVERSOLD';
      rsiColor = '#38bdf8'; // sky blue
    } else if (rsiVal <= 45) {
      rsiStatus = 'BEARISH';
      rsiColor = '#ef4444';
    } else {
      rsiStatus = 'NEUTRAL';
      rsiColor = '#94a3b8';
    }

    // Volatility determination (ATR / Range expansion)
    let rangeSum = 0;
    const lookback = Math.min(14, len);
    for (let i = len - lookback; i < len; i++) {
      rangeSum += bars[i].high - bars[i].low;
    }
    const avgRange = rangeSum / lookback;
    const currentRange = bars[len - 1].high - bars[len - 1].low;
    const rangeRatio = avgRange > 0 ? currentRange / avgRange : 1;

    let volatility: VipScannerRow['volatility'] = 'NORMAL';
    let volatilityText = 'NORMAL';
    let volatilityColor = '#94a3b8';

    if (rangeRatio > 1.4) {
      volatility = 'EXPANDING';
      volatilityText = 'EXPANDING ⚡';
      volatilityColor = '#38bdf8';
    } else if (rangeRatio < 0.65) {
      volatility = 'SQUEEZE';
      volatilityText = 'SQUEEZE 🔒';
      volatilityColor = '#eab308';
    }

    // Composite Row Score (-100 to +100)
    let rowScore = 0;
    if (trend === 'STRONG_BULL') rowScore += 50;
    else if (trend === 'BULL') rowScore += 25;
    else if (trend === 'STRONG_BEAR') rowScore -= 50;
    else if (trend === 'BEAR') rowScore -= 25;

    if (rsiStatus === 'BULLISH') rowScore += 30;
    else if (rsiStatus === 'OVERBOUGHT') rowScore += 15;
    else if (rsiStatus === 'BEARISH') rowScore -= 30;
    else if (rsiStatus === 'OVERSOLD') rowScore -= 15;

    // Signal determination
    let signal: VipScannerRow['signal'] = 'NEUTRAL';
    let signalColor = '#94a3b8';

    if (rowScore >= 55) {
      signal = 'STRONG_BUY';
      signalColor = '#10b981';
      totalBullScore += 2;
    } else if (rowScore >= 20) {
      signal = 'BUY';
      signalColor = '#34d399';
      totalBullScore += 1;
    } else if (rowScore <= -55) {
      signal = 'STRONG_SELL';
      signalColor = '#ef4444';
      totalBearScore += 2;
    } else if (rowScore <= -20) {
      signal = 'SELL';
      signalColor = '#f87171';
      totalBearScore += 1;
    }

    rows.push({
      timeframe: cfg.label,
      trend,
      trendText,
      trendColor,
      rsi: Math.round(rsiVal),
      rsiStatus,
      rsiColor,
      volatility,
      volatilityText,
      volatilityColor,
      signal,
      signalColor,
      score: rowScore,
    });
  });

  const totalPossible = Math.max(1, rows.length * 2);
  const confluenceBullishPct = Math.min(100, Math.round((totalBullScore / totalPossible) * 100));
  const confluenceBearishPct = Math.min(100, Math.round((totalBearScore / totalPossible) * 100));

  let masterVerdict: VipScannerResult['masterVerdict'] = 'NEUTRAL';
  let masterVerdictColor = '#94a3b8';

  if (confluenceBullishPct >= 70) {
    masterVerdict = 'STRONG BUY';
    masterVerdictColor = '#10b981';
  } else if (confluenceBullishPct >= 50 && confluenceBullishPct > confluenceBearishPct) {
    masterVerdict = 'BUY';
    masterVerdictColor = '#34d399';
  } else if (confluenceBearishPct >= 70) {
    masterVerdict = 'STRONG SELL';
    masterVerdictColor = '#ef4444';
  } else if (confluenceBearishPct >= 50 && confluenceBearishPct > confluenceBullishPct) {
    masterVerdict = 'SELL';
    masterVerdictColor = '#f87171';
  }

  // Alignment alert
  let alignmentAlert: string | null = null;
  const buySignals = rows.filter((r) => r.signal === 'BUY' || r.signal === 'STRONG_BUY').length;
  const sellSignals = rows.filter((r) => r.signal === 'SELL' || r.signal === 'STRONG_SELL').length;

  if (buySignals >= 4) {
    alignmentAlert = `⚡ MULTI-TF BULLISH ALIGNMENT (${buySignals}/${rows.length} TFs)`;
  } else if (sellSignals >= 4) {
    alignmentAlert = `⚡ MULTI-TF BEARISH ALIGNMENT (${sellSignals}/${rows.length} TFs)`;
  }

  return {
    symbol,
    chartTimeframe,
    rows,
    confluenceBullishPct,
    confluenceBearishPct,
    masterVerdict,
    masterVerdictColor,
    alignmentAlert,
    activeSignalBadge: {
      text: masterVerdict,
      color: masterVerdictColor,
      subText: `${Math.max(confluenceBullishPct, confluenceBearishPct)}% Matrix Alignment`,
    },
  };
}
