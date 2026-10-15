/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../types';

export interface MarketStructureLine {
  id: string;
  startBarIndex: number;
  endBarIndex: number;
  level: number;
  type: 'BOS' | 'CHoCH';
  isBullish: boolean;
  labelBarIndex: number;
}

export interface TradeSetupBox {
  id: string;
  direction: 'LONG' | 'SHORT';
  entryBarIndex: number;
  endBarIndex: number;
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price: number;
  isClosed: boolean;
  closeReason?: 'TP1' | 'TP2' | 'SL' | 'Reversal';
}

export interface MarketStructureDashboardStats {
  totalSignals: number;
  totalClosedTrades: number;
  tp1Wins: number;
  tp2Wins: number;
  slLosses: number;
  tp1WinRate: number;
  tp2WinRate: number;
  overallWinRate: number;
  tradeHistory: string[];
}

export interface MarketStructureSignalsResult {
  lines: MarketStructureLine[];
  tradeSetups: TradeSetupBox[];
  stats: MarketStructureDashboardStats;
  activeTrade: TradeSetupBox | null;
}

export interface MarketStructureSignalsOptions {
  swingLength?: number;
  bosConfirmation?: 'Close' | 'Wick';
  showCHoCH?: boolean;
  tp1Percent?: number;
  tp2Percent?: number;
  slPercent?: number;
  colorBullish?: string;
  colorBearish?: string;
  colorTP1?: string;
  colorTP2?: string;
  colorSL?: string;
  boxTransparency?: number;
  borderTransparency?: number;
  dashboardTextSize?: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
}

/**
 * Calculates 10-day Average Daily Range (ADR10)
 */
function calculateADR10(candles: Candle[]): number {
  if (!candles || !Array.isArray(candles) || candles.length === 0) return 10;

  // Group candles by day (YYYY-MM-DD)
  const dayRanges: number[] = [];
  let currentDayKey = '';
  let dayHigh = -Infinity;
  let dayLow = Infinity;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const date = new Date(c.time * 1000);
    const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;

    if (dayKey !== currentDayKey) {
      if (currentDayKey !== '' && dayHigh > dayLow) {
        dayRanges.push(dayHigh - dayLow);
      }
      currentDayKey = dayKey;
      dayHigh = c.high;
      dayLow = c.low;
    } else {
      if (c.high > dayHigh) dayHigh = c.high;
      if (c.low < dayLow) dayLow = c.low;
    }
  }

  if (dayHigh > dayLow) {
    dayRanges.push(dayHigh - dayLow);
  }

  if (dayRanges.length >= 2) {
    const last10 = dayRanges.slice(-10);
    const sum = last10.reduce((acc, val) => acc + val, 0);
    return sum / (last10.length || 1);
  }

  // Fallback if intraday candles don't span multiple days: 10-candle SMA of high-low
  const recentWindow = candles.slice(-30);
  if (recentWindow.length === 0) return 10;
  const sumRange = recentWindow.reduce((acc, c) => acc + (c.high - c.low), 0);
  return (sumRange / (recentWindow.length || 1)) * 4;
}

/**
 * Main Market Structure Signals | ProjectSyndicate calculation algorithm
 */
export function calculateMarketStructureSignals(
  candles: Candle[],
  options?: MarketStructureSignalsOptions
): MarketStructureSignalsResult | null {
  if (!candles || !Array.isArray(candles) || candles.length < 15) {
    return null;
  }

  const swingLength = options?.swingLength ?? 25;
  const bosConfirmation = options?.bosConfirmation ?? 'Close';
  const showCHoCH = options?.showCHoCH ?? true;
  const tp1Percent = options?.tp1Percent ?? 20.0;
  const tp2Percent = options?.tp2Percent ?? 30.0;
  const slPercent = options?.slPercent ?? 20.0;

  const adr10 = calculateADR10(candles);
  const tp1Distance = adr10 * (tp1Percent / 100);
  const tp2Distance = adr10 * (tp2Percent / 100);
  const slDistance = adr10 * (slPercent / 100);

  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  let lastHighBar: number | null = null;
  let lastLowBar: number | null = null;
  let highActive = false;
  let lowActive = false;
  let lastBreakDirection = 0; // 1 = bullish, -1 = bearish

  const lines: MarketStructureLine[] = [];
  const tradeSetups: TradeSetupBox[] = [];

  // Active trade tracking
  let activeTrade: TradeSetupBox | null = null;

  let totalSignals = 0;
  let totalClosedTrades = 0;
  let tp1Wins = 0;
  let tp2Wins = 0;
  let slLosses = 0;
  const tradeHistory: string[] = [];

  const recordTrade = (result: string) => {
    tradeHistory.unshift(result);
    if (tradeHistory.length > 10) {
      tradeHistory.pop();
    }
  };

  // Helper to detect pivot highs & lows
  const isPivotHigh = (idx: number): boolean => {
    if (idx < swingLength || idx >= candles.length - swingLength) return false;
    const targetHigh = candles[idx].high;
    for (let j = idx - swingLength; j <= idx + swingLength; j++) {
      if (j === idx) continue;
      if (candles[j].high > targetHigh) return false;
    }
    return true;
  };

  const isPivotLow = (idx: number): boolean => {
    if (idx < swingLength || idx >= candles.length - swingLength) return false;
    const targetLow = candles[idx].low;
    for (let j = idx - swingLength; j <= idx + swingLength; j++) {
      if (j === idx) continue;
      if (candles[j].low < targetLow) return false;
    }
    return true;
  };

  for (let i = 1; i < candles.length; i++) {
    // Check if pivot confirmed at bar i (pivot occurred swingLength bars ago)
    const pivotBarIndex = i - swingLength;
    if (pivotBarIndex >= 0) {
      if (isPivotHigh(pivotBarIndex)) {
        lastHigh = candles[pivotBarIndex].high;
        lastHighBar = pivotBarIndex;
        highActive = true;
      }
      if (isPivotLow(pivotBarIndex)) {
        lastLow = candles[pivotBarIndex].low;
        lastLowBar = pivotBarIndex;
        lowActive = true;
      }
    }

    const prevCandle = candles[i - 1];
    const breakoutSourceHigh = bosConfirmation === 'Close' ? prevCandle.close : prevCandle.high;
    const breakoutSourceLow = bosConfirmation === 'Close' ? prevCandle.close : prevCandle.low;

    let confirmedBullishBreakout = false;
    let confirmedBearishBreakout = false;
    let confirmedBreakoutHigh: number | null = null;
    let confirmedBreakoutLow: number | null = null;
    let confirmedBreakoutHighBar: number | null = null;
    let confirmedBreakoutLowBar: number | null = null;
    let confirmedIsBullishCHoCH = false;
    let confirmedIsBearishCHoCH = false;

    if (highActive && lastHigh !== null && lastHighBar !== null) {
      if (breakoutSourceHigh > lastHigh) {
        confirmedBullishBreakout = true;
        confirmedBreakoutHigh = lastHigh;
        confirmedBreakoutHighBar = lastHighBar;
        confirmedIsBullishCHoCH = lastBreakDirection === -1;
        highActive = false;
        lastBreakDirection = 1;
      }
    }

    if (lowActive && lastLow !== null && lastLowBar !== null) {
      if (breakoutSourceLow < lastLow) {
        confirmedBearishBreakout = true;
        confirmedBreakoutLow = lastLow;
        confirmedBreakoutLowBar = lastLowBar;
        confirmedIsBearishCHoCH = lastBreakDirection === 1;
        lowActive = false;
        lastBreakDirection = -1;
      }
    }

    // Process breakouts
    if (confirmedBullishBreakout && confirmedBreakoutHigh !== null && confirmedBreakoutHighBar !== null) {
      const type = (confirmedIsBullishCHoCH && showCHoCH) ? 'CHoCH' : 'BOS';
      lines.push({
        id: `line_bull_${i}`,
        startBarIndex: confirmedBreakoutHighBar,
        endBarIndex: i,
        level: confirmedBreakoutHigh,
        type,
        isBullish: true,
        labelBarIndex: Math.floor((confirmedBreakoutHighBar + i) / 2),
      });

      // Close previous active trade by reversal if active
      if (activeTrade) {
        slLosses += 1;
        totalClosedTrades += 1;
        recordTrade('Reversal');
        activeTrade.isClosed = true;
        activeTrade.endBarIndex = i;
        activeTrade.closeReason = 'Reversal';
        activeTrade = null;
      }

      // Open Bullish Trade
      totalSignals += 1;
      const newTrade: TradeSetupBox = {
        id: `trade_long_${i}`,
        direction: 'LONG',
        entryBarIndex: i,
        endBarIndex: i,
        entryPrice: confirmedBreakoutHigh,
        slPrice: confirmedBreakoutHigh - slDistance,
        tp1Price: confirmedBreakoutHigh + tp1Distance,
        tp2Price: confirmedBreakoutHigh + tp2Distance,
        isClosed: false,
      };
      activeTrade = newTrade;
      tradeSetups.push(newTrade);
    }

    if (confirmedBearishBreakout && confirmedBreakoutLow !== null && confirmedBreakoutLowBar !== null) {
      const type = (confirmedIsBearishCHoCH && showCHoCH) ? 'CHoCH' : 'BOS';
      lines.push({
        id: `line_bear_${i}`,
        startBarIndex: confirmedBreakoutLowBar,
        endBarIndex: i,
        level: confirmedBreakoutLow,
        type,
        isBullish: false,
        labelBarIndex: Math.floor((confirmedBreakoutLowBar + i) / 2),
      });

      // Close previous active trade by reversal if active
      if (activeTrade) {
        slLosses += 1;
        totalClosedTrades += 1;
        recordTrade('Reversal');
        activeTrade.isClosed = true;
        activeTrade.endBarIndex = i;
        activeTrade.closeReason = 'Reversal';
        activeTrade = null;
      }

      // Open Bearish Trade
      totalSignals += 1;
      const newTrade: TradeSetupBox = {
        id: `trade_short_${i}`,
        direction: 'SHORT',
        entryBarIndex: i,
        endBarIndex: i,
        entryPrice: confirmedBreakoutLow,
        slPrice: confirmedBreakoutLow + slDistance,
        tp1Price: confirmedBreakoutLow - tp1Distance,
        tp2Price: confirmedBreakoutLow - tp2Distance,
        isClosed: false,
      };
      activeTrade = newTrade;
      tradeSetups.push(newTrade);
    }

    // Monitor active trade on current bar
    if (activeTrade && !activeTrade.isClosed) {
      const c = candles[i];
      if (activeTrade.direction === 'LONG') {
        const tp2Hit = c.high >= activeTrade.tp2Price;
        const tp1Hit = c.high >= activeTrade.tp1Price;
        const slHit = c.low <= activeTrade.slPrice;

        if (tp2Hit) {
          tp2Wins += 1;
          tp1Wins += 1; // TP2 counts as TP1 win as well
          totalClosedTrades += 1;
          recordTrade('TP2');
          activeTrade.isClosed = true;
          activeTrade.endBarIndex = i;
          activeTrade.closeReason = 'TP2';
          activeTrade = null;
        } else if (tp1Hit && !slHit) {
          tp1Wins += 1;
          totalClosedTrades += 1;
          recordTrade('TP1');
          activeTrade.isClosed = true;
          activeTrade.endBarIndex = i;
          activeTrade.closeReason = 'TP1';
          activeTrade = null;
        } else if (slHit) {
          slLosses += 1;
          totalClosedTrades += 1;
          recordTrade('SL');
          activeTrade.isClosed = true;
          activeTrade.endBarIndex = i;
          activeTrade.closeReason = 'SL';
          activeTrade = null;
        } else {
          activeTrade.endBarIndex = i;
        }
      } else if (activeTrade.direction === 'SHORT') {
        const tp2Hit = c.low <= activeTrade.tp2Price;
        const tp1Hit = c.low <= activeTrade.tp1Price;
        const slHit = c.high >= activeTrade.slPrice;

        if (tp2Hit) {
          tp2Wins += 1;
          tp1Wins += 1;
          totalClosedTrades += 1;
          recordTrade('TP2');
          activeTrade.isClosed = true;
          activeTrade.endBarIndex = i;
          activeTrade.closeReason = 'TP2';
          activeTrade = null;
        } else if (tp1Hit && !slHit) {
          tp1Wins += 1;
          totalClosedTrades += 1;
          recordTrade('TP1');
          activeTrade.isClosed = true;
          activeTrade.endBarIndex = i;
          activeTrade.closeReason = 'TP1';
          activeTrade = null;
        } else if (slHit) {
          slLosses += 1;
          totalClosedTrades += 1;
          recordTrade('SL');
          activeTrade.isClosed = true;
          activeTrade.endBarIndex = i;
          activeTrade.closeReason = 'SL';
          activeTrade = null;
        } else {
          activeTrade.endBarIndex = i;
        }
      }
    }
  }

  // Extend current active trade to latest bar if open
  if (activeTrade && !activeTrade.isClosed) {
    activeTrade.endBarIndex = candles.length - 1;
  }

  const tp1WinRate = totalClosedTrades > 0 ? (tp1Wins / totalClosedTrades) * 100 : 0;
  const tp2WinRate = totalClosedTrades > 0 ? (tp2Wins / totalClosedTrades) * 100 : 0;
  const overallWinRate = totalClosedTrades > 0 ? (tp1Wins / totalClosedTrades) * 100 : 0;

  return {
    lines,
    tradeSetups,
    stats: {
      totalSignals,
      totalClosedTrades,
      tp1Wins,
      tp2Wins,
      slLosses,
      tp1WinRate,
      tp2WinRate,
      overallWinRate,
      tradeHistory,
    },
    activeTrade,
  };
}
