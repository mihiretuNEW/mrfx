/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Mrov Trade: Opening Range Indicator Engine
 * Translated 1:1 from TradingView Pine Script v6:
 * - High-precision New York 09:30–10:00 Opening Range (Mon-Fri)
 * - Breakout detection & first breakout filter per session
 * - Risk/Reward (R:R) trade grid with dynamic risk/reward zones
 * - Automated trade lifecycle: Stop Loss (SL) & Take Profit (TP) detection
 * - Real-time statistics: Closed Trades, Take Profits, Stop Losses, Win Rate %, Total R
 */

import { Candle, TimeframeId } from '../types';

export interface MrovOpeningRangeBox {
  id: string;
  startBarIndex: number;
  endBarIndex: number;
  startTime: number;
  endTime: number;
  high: number;
  low: number;
  isComplete: boolean;
  highLineEndIndex: number;
  lowLineEndIndex: number;
}

export interface MrovTradeSetup {
  id: string;
  direction: 1 | -1; // 1 = LONG, -1 = SHORT
  breakoutBarIndex: number;
  breakoutTime: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  riskAmount: number;
  rr: number;
  currentRightIndex: number;
  status: 'ACTIVE' | 'TP' | 'SL';
  exitBarIndex?: number;
  exitPrice?: number;
  exitTime?: number;
  realizedR?: number;
}

export interface MrovTradeStats {
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalR: number;
}

export interface MrovTradeIndicatorConfig {
  rangeColor: string; // Range Color
  fillTransparency: number; // Range Transparency (0..100)
  borderWidth: number; // Border Width (1..4)
  levelWidth: number; // Level Width (1..4)
  showRangeCaption: boolean; // Show Opening Range Label

  longColor: string; // LONG Color
  shortColor: string; // SHORT Color
  highlightBreakout: boolean; // Highlight Breakout Candle
  showSignalLabels: boolean; // Show LONG / SHORT Labels
  showBreakoutMarker: boolean; // Show Entry Marker

  rr: number; // Risk / Reward ratio (e.g. 3.0)
  showTradeGrid: boolean; // Show Trade Grid
  riskColor: string; // Risk Zone Color
  rewardColor: string; // Reward Zone Color
  entryColor: string; // Entry Color
  zoneTransparency: number; // Zone Transparency (0..100)
  showStatsTable: boolean; // Show Statistics Table
}

export interface MrovTradeResult {
  ranges: MrovOpeningRangeBox[];
  trades: MrovTradeSetup[];
  stats: MrovTradeStats;
  breakoutCandleIndices: Map<number, { direction: 1 | -1; color: string; price: number }>;
  validTimeframe: boolean;
  timeframeMinutes: number;
  errorMessage?: string;
}

export const DEFAULT_MROV_CONFIG: MrovTradeIndicatorConfig = {
  rangeColor: '#2979ff', // color.rgb(41, 121, 255)
  fillTransparency: 88,
  borderWidth: 2,
  levelWidth: 2,
  showRangeCaption: true,

  longColor: '#00c878', // color.rgb(0, 200, 120)
  shortColor: '#e64646', // color.rgb(230, 70, 70)
  highlightBreakout: true,
  showSignalLabels: true,
  showBreakoutMarker: true,

  rr: 3.0,
  showTradeGrid: true,
  riskColor: '#dc4155', // color.rgb(220, 65, 85)
  rewardColor: '#00a078', // color.rgb(0, 160, 120)
  entryColor: '#e6e6e6', // color.rgb(230, 230, 230)
  zoneTransparency: 78,
  showStatsTable: true,
};

/**
 * Computes America/New_York daylight saving time offset in seconds for any Unix timestamp.
 * Standard Energy Policy Act rule:
 * - Starts 2nd Sunday in March at 02:00 local time (07:00 UTC) -> UTC-4 (-14,400s)
 * - Ends 1st Sunday in November at 02:00 local time (06:00 UTC) -> UTC-5 (-18,000s)
 */
export function getNewYorkOffsetSeconds(epochSec: number): number {
  const d = new Date(epochSec * 1000);
  const year = d.getUTCFullYear();

  // 2nd Sunday in March
  const mar1 = new Date(Date.UTC(year, 2, 1));
  const mar1Day = mar1.getUTCDay();
  const firstSunMar = 1 + (7 - mar1Day) % 7;
  const secondSunMar = firstSunMar + 7;
  const dstStart = Date.UTC(year, 2, secondSunMar, 7, 0, 0);

  // 1st Sunday in November
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const nov1Day = nov1.getUTCDay();
  const firstSunNov = 1 + (7 - nov1Day) % 7;
  const dstEnd = Date.UTC(year, 10, firstSunNov, 6, 0, 0);

  const timeMs = epochSec * 1000;
  return timeMs >= dstStart && timeMs < dstEnd ? -14400 : -18000;
}

/**
 * Determines timeframe minutes and whether it's valid for NY Opening Range (09:30–10:00).
 * Pine Script rule: valid_timeframe = timeframe.isminutes and timeframe_minutes <= 30 and 30 % timeframe_minutes == 0
 */
export function getTimeframeMinutes(timeframe: TimeframeId | string): number {
  switch (timeframe) {
    case '1M':
    case '1m':
      return 1;
    case '2M':
    case '2m':
      return 2;
    case '5M':
    case '5m':
      return 5;
    case '15M':
    case '15m':
      return 15;
    case '30M':
    case '30m':
      return 30;
    case '1H':
    case '1h':
      return 60;
    case '4H':
    case '4h':
      return 240;
    case '1D':
    case '1d':
      return 1440;
    default:
      return 15;
  }
}

/**
 * Checks if a candle is in the Opening Range Session (09:30-10:00 NY, Mon-Fri).
 */
export function isNyOpeningRange(epochSec: number): boolean {
  const offset = getNewYorkOffsetSeconds(epochSec);
  const localMs = (epochSec + offset) * 1000;
  const nyDate = new Date(localMs);

  const nyDay = nyDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  // Monday to Friday: 23456 in TradingView session notation
  if (nyDay < 1 || nyDay > 5) return false;

  const nyMinutes = nyDate.getUTCHours() * 60 + nyDate.getUTCMinutes();
  // 09:30 AM = 570 minutes, 10:00 AM = 600 minutes
  return nyMinutes >= 570 && nyMinutes < 600;
}

/**
 * Executes Mrov Trade: Opening Range calculation matching Pine Script v6.
 */
export function calculateMrovTradeOpeningRange(
  candles: Candle[],
  timeframe: TimeframeId | string,
  config: Partial<MrovTradeIndicatorConfig> = {}
): MrovTradeResult {
  const mergedConfig: MrovTradeIndicatorConfig = {
    ...DEFAULT_MROV_CONFIG,
    ...config,
  };

  const tfMinutes = getTimeframeMinutes(timeframe);
  const isValidTimeframe = tfMinutes <= 30 && 30 % tfMinutes === 0;

  if (!isValidTimeframe || candles.length === 0) {
    return {
      ranges: [],
      trades: [],
      stats: {
        closedTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalR: 0,
      },
      breakoutCandleIndices: new Map(),
      validTimeframe: false,
      timeframeMinutes: tfMinutes,
      errorMessage:
        'Incompatible timeframe. Please use 1m, 2m, 5m, 15m, or 30m for the 09:30–10:00 (New York) Opening Range.',
    };
  }

  const requiredRangeBars = 30 / tfMinutes;

  const ranges: MrovOpeningRangeBox[] = [];
  const trades: MrovTradeSetup[] = [];
  const breakoutCandleIndices = new Map<number, { direction: 1 | -1; color: string; price: number }>();

  let closedTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalR = 0.0;

  // State tracker mirroring Pine Script variables
  let currentRangeHigh: number | null = null;
  let currentRangeLow: number | null = null;
  let currentRangeReady = false;
  let currentRangeComplete = false;
  let currentRangeBarCount = 0;
  let currentFirstBreakoutUsed = false;

  let currentRangeBox: MrovOpeningRangeBox | null = null;

  let tradeActive = false;
  let tradeDirection: 1 | -1 = 1;
  let tradeEntry = 0;
  let tradeStop = 0;
  let tradeTarget = 0;
  let activeTradeSetup: MrovTradeSetup | null = null;

  let wasInOpeningRange = false;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const inOpeningRange = isNyOpeningRange(c.time);

    const rangeStarts = inOpeningRange && !wasInOpeningRange;
    const rangeEnds = !inOpeningRange && wasInOpeningRange;

    let tradeClosedThisBar = false;

    // 1. Range Starts: New Day Opening Range
    if (rangeStarts) {
      if (currentRangeBox) {
        currentRangeBox.highLineEndIndex = i;
        currentRangeBox.lowLineEndIndex = i;
      }

      currentRangeHigh = c.high;
      currentRangeLow = c.low;
      currentRangeReady = false;
      currentRangeComplete = true;
      currentRangeBarCount = 1;
      currentFirstBreakoutUsed = false;

      currentRangeBox = {
        id: `or-box-${c.time}-${i}`,
        startBarIndex: i,
        endBarIndex: i + 1,
        startTime: c.time,
        endTime: c.time,
        high: c.high,
        low: c.low,
        isComplete: false,
        highLineEndIndex: candles.length - 1,
        lowLineEndIndex: candles.length - 1,
      };
      ranges.push(currentRangeBox);
    } else if (inOpeningRange && currentRangeComplete && currentRangeBox) {
      // 2. While in Opening Range: Expand High & Low
      currentRangeBarCount += 1;
      currentRangeHigh = currentRangeHigh === null ? c.high : Math.max(currentRangeHigh, c.high);
      currentRangeLow = currentRangeLow === null ? c.low : Math.min(currentRangeLow, c.low);

      currentRangeBox.endBarIndex = i + 1;
      currentRangeBox.endTime = c.time;
      currentRangeBox.high = currentRangeHigh;
      currentRangeBox.low = currentRangeLow;
    }

    // 3. Range Ends: Lock Box & Create High/Low Support/Resistance Levels
    if (rangeEnds) {
      currentRangeReady = currentRangeComplete && currentRangeBarCount >= requiredRangeBars;
      if (currentRangeBox) {
        currentRangeBox.isComplete = currentRangeReady;
        currentRangeBox.endBarIndex = i;
        currentRangeBox.highLineEndIndex = candles.length - 1;
        currentRangeBox.lowLineEndIndex = candles.length - 1;
      }
    }

    // 4. Trade Active Tracking & Exit Check (Stop Loss / Take Profit)
    if (tradeActive && activeTradeSetup) {
      activeTradeSetup.currentRightIndex = i + 1;

      const stopHit = tradeDirection === 1 ? c.low <= tradeStop : c.high >= tradeStop;
      const targetHit = tradeDirection === 1 ? c.high >= tradeTarget : c.low <= tradeTarget;

      if (stopHit || targetHit) {
        tradeClosedThisBar = true;
        closedTrades += 1;

        if (stopHit) {
          losingTrades += 1;
          totalR -= 1.0;
          activeTradeSetup.status = 'SL';
          activeTradeSetup.realizedR = -1.0;
          activeTradeSetup.exitPrice = tradeStop;
        } else {
          winningTrades += 1;
          totalR += mergedConfig.rr;
          activeTradeSetup.status = 'TP';
          activeTradeSetup.realizedR = mergedConfig.rr;
          activeTradeSetup.exitPrice = tradeTarget;
        }

        activeTradeSetup.exitBarIndex = i;
        activeTradeSetup.exitTime = c.time;
        activeTradeSetup.currentRightIndex = i;

        tradeActive = false;
        activeTradeSetup = null;
      }
    }

    // 5. Breakout Detection: First Breakout of the Session
    let firstLongBreakout = false;
    let firstShortBreakout = false;
    const canDetectBreakout =
      currentRangeReady &&
      !inOpeningRange &&
      !currentFirstBreakoutUsed &&
      currentRangeHigh !== null &&
      currentRangeLow !== null;

    if (canDetectBreakout) {
      if (c.close > currentRangeHigh!) {
        currentFirstBreakoutUsed = true;
        firstLongBreakout = true;
      } else if (c.close < currentRangeLow!) {
        currentFirstBreakoutUsed = true;
        firstShortBreakout = true;
      }
    }

    // 6. Open Trade if Breakout Detected
    const canOpenTrade = !tradeActive && !tradeClosedThisBar;

    if (canOpenTrade && (firstLongBreakout || firstShortBreakout)) {
      const entryDirection: 1 | -1 = firstLongBreakout ? 1 : -1;
      const risk = entryDirection === 1 ? c.close - c.low : c.high - c.close;

      if (risk > 0) {
        tradeActive = true;
        tradeDirection = entryDirection;
        tradeEntry = c.close;
        tradeStop = entryDirection === 1 ? c.low : c.high;
        tradeTarget = tradeEntry + entryDirection * risk * mergedConfig.rr;

        activeTradeSetup = {
          id: `mrov-trade-${c.time}-${i}`,
          direction: entryDirection,
          breakoutBarIndex: i,
          breakoutTime: c.time,
          entryPrice: tradeEntry,
          stopPrice: tradeStop,
          targetPrice: tradeTarget,
          riskAmount: risk,
          rr: mergedConfig.rr,
          currentRightIndex: i + 1,
          status: 'ACTIVE',
        };
        trades.push(activeTradeSetup);

        breakoutCandleIndices.set(i, {
          direction: entryDirection,
          color: entryDirection === 1 ? mergedConfig.longColor : mergedConfig.shortColor,
          price: c.close,
        });
      }
    }

    wasInOpeningRange = inOpeningRange;
  }

  // Cap history at 500 boxes/trades (matching Pine Script max_boxes_count = 500)
  const trimmedRanges = ranges.slice(-500);
  const trimmedTrades = trades.slice(-500);

  const winRate = closedTrades > 0 ? (winningTrades * 100.0) / closedTrades : 0.0;

  return {
    ranges: trimmedRanges,
    trades: trimmedTrades,
    stats: {
      closedTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalR,
    },
    breakoutCandleIndices,
    validTimeframe: true,
    timeframeMinutes: tfMinutes,
  };
}
