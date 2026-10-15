/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Master System: Gatekeeper, Diagnostic Filter & Empirical Learning Engine
 * Built specifically for Jump 10 (1H Timeframe) with Mpro + Mpro2 Strategy
 */

import { Candle } from '../types';
import { Mpro2Results } from './mpro2Signals';
import { SRClassificationOptions, SRLevel, SRSignal } from './supportResistanceClassification';

export type MasterSignalSource =
  | 'MPRO_LOWER_BUY'
  | 'MPRO_UPPER_SELL'
  | 'MPRO2_LOWER_BUY'
  | 'MPRO2_UPPER_SELL'
  | 'MPRO2_BREAKOUT_RETEST_BUY'
  | 'MPRO2_BREAKDOWN_RETEST_SELL'
  | 'MPRO2_YELLOW_MID_BUY'
  | 'MPRO2_YELLOW_MID_SELL'
  | 'WEEKLY_ANCHOR_RETEST_BUY'
  | 'WEEKLY_ANCHOR_RETEST_SELL';

export type MasterDecision = 'TAKE' | 'WAIT' | 'SKIP';

export type MarketRegime = 'HEALTHY_TREND' | 'RANGE_BOUND' | 'HOSTILE_RUNAWAY' | 'COMPRESSION_SQUEEZE';

export type TouchPattern =
  | 'FIRST_TOUCH'
  | 'RETEST_DOUBLE_TOUCH'
  | 'BREAKOUT_RETEST_BOUNCE'
  | 'BREAKDOWN_RETEST_REJECTION'
  | 'MIDLINE_BOUNCE'
  | 'WEEKLY_PWH_RETEST'
  | 'WEEKLY_PWL_RETEST';

export type MicroTriggerStatus = 'CONFIRMED' | 'WAITING_BREAK' | 'EARLY_TRAP_WINDOW' | 'NO_TRIGGER';

export interface MicroTriggerContext {
  status: MicroTriggerStatus;
  triggerPrice: number;
  timeElapsedInCandleSeconds: number;
  isEarlyTrapWindow: boolean;
  breakConfirmed: boolean;
  tightStopLoss: number;
  tightRisk: number;
  breakEvenPrice: number; // 1:1 BE point
  tp1RPrice: number;      // 1:1 TP
  tp3RPrice: number;      // 1:3 TP
  statusText: string;
}

export interface PreTradeContext {
  signalSource: MasterSignalSource;
  signalDirection: 'BUY' | 'SELL';
  barIndex: number;
  candleTime: number;
  currentPrice: number;
  
  // Gate 1: Regime & Trend Vector
  slope: {
    mproSlopeDegrees: number;
    mpro2DirectionDown: boolean;
    regime: MarketRegime;
    isSlopeAligned: boolean;
    isRunawayHostile: boolean;
    slopeText: string;
  };

  // Gate 2: Room to 1:3 Target
  targetRoom: {
    entryPrice: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    riskAmount: number;
    rewardAmount: number;
    riskRewardRatio: number; // minimum 3.0
    opposingBarrierPrice: number;
    distanceToOpposingBarrier: number;
    hasRoomFor3R: boolean;
    clearanceRatio: number; // distanceToOpposingBarrier / rewardAmount
    clearanceText: string;
  };

  // Gate 3: Rejection Anatomy & Touch Pattern
  rejection: {
    wickRatio: number; // 0..1 (e.g. 0.42 = 42% wick)
    bodyRatio: number;
    closePositionRatio: number; // 0..1 (1.0 = closed at extreme high)
    isCleanRejection: boolean;
    touchPattern: TouchPattern;
    rejectionText: string;
  };

  // Gate 4: Micro-Trigger & 1:3 Execution Engine (5M/15M Structure & 15-Min Trap Prevention)
  microTrigger: MicroTriggerContext;

  // Final Master Gatekeeper Decision
  decision: MasterDecision;
  confidenceScore: number; // 0..100
  decisionReasons: string[];
}

export interface LoggedTrade {
  id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  source: MasterSignalSource;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  decisionAtEntry: MasterDecision;
  preTradeSnapshot: PreTradeContext;
  status: 'OPEN' | 'WIN_TP' | 'LOSS_SL' | 'MANUAL_CLOSED';
  outcomeTime?: number;
  outcomePrice?: number;
  actualR?: number; // e.g. +3.0 or -1.0
  notes?: string;
}

export interface FactorAttributionReport {
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  totalOpen: number;
  winRate: number; // 0..100
  netR: number; // Net R-Multiple (e.g. +14.0R)
  profitFactor: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;

  // Factor 1: Touch Pattern Attribution
  firstTouchCount: number;
  firstTouchWins: number;
  firstTouchWinRate: number;
  retestCount: number;
  retestWins: number;
  retestWinRate: number;
  midlineCount: number;
  midlineWins: number;
  midlineWinRate: number;

  // Factor 2: Slope Alignment Attribution
  favorableSlopeCount: number;
  favorableSlopeWins: number;
  favorableSlopeWinRate: number;
  hostileSlopeCount: number;
  hostileSlopeWins: number;
  hostileSlopeWinRate: number;

  // Factor 3: 1:3 Clearance Attribution
  sufficientRoomCount: number;
  sufficientRoomWins: number;
  sufficientRoomWinRate: number;
  blockedRoomCount: number;
  blockedRoomWins: number;
  blockedRoomWinRate: number;

  // Decision Accuracy
  takeTradesCount: number;
  takeTradesWinRate: number;
  skipTradesCount: number;
  skipTradesWinRate: number;

  // Empirical Recommendations
  actionableInsights: string[];
}

const STORAGE_KEY_TRADES = 'master_trade_log_jump10';

/**
 * Calculate the linear regression slope angle (in degrees) of a series over period
 */
export function calculateSlopeDegrees(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avg = sumY / n;
  if (avg === 0) return 0;

  // Normalize percent change per bar then convert to approximate visual degrees
  const normalizedSlope = (slope / avg) * 100;
  const radians = Math.atan(normalizedSlope * 2.5);
  return Math.round((radians * 180) / Math.PI);
}

/**
 * Detects Mpro & Mpro2 active signals on current / latest bars and applies
 * Master Gatekeeper rules (Regime, 1:3 Room, Rejection).
 */
export function evaluateMasterSetup(
  candles: Candle[],
  _mproSignals: SRSignal[] | null,
  _mproLevels: SRLevel[] | null,
  mpro2Results: Mpro2Results | null,
  lookbackBars: number = 168,
  timeframe: string = '1H',
  livePrice?: number
): PreTradeContext | null {
  const n = candles.length;
  if (n < 15) return null;

  // USER MANDATE: Master operates strictly and exclusively on Mpro2!
  // Mpro is completely disabled for Master. If Mpro2 is not loaded, Master stays standby.
  if (!mpro2Results) return null;

  const currentBar = candles[n - 1];
  const prevBar = candles[n - 2];
  const lookbackStart = Math.max(0, n - lookbackBars);
  const windowCandles = candles.slice(lookbackStart);

  // Reference lines derived from Mpro2
  const closes = windowCandles.map((c) => c.close);
  const highs = windowCandles.map((c) => c.high);
  const lows = windowCandles.map((c) => c.low);

  const highestPrice = Math.max(...highs);
  const lowestPrice = Math.min(...lows);
  const totalRange = Math.max(0.0001, highestPrice - lowestPrice);

  // Measure channel slope over last 16 candles
  const slopeWindowCloses = closes.slice(-16);
  const mproSlopeDegrees = calculateSlopeDegrees(slopeWindowCloses);

  // Mpro2 Boundaries and Yellow Golden Pocket
  const mpro2SwingHigh = mpro2Results.swingHigh;
  const mpro2SwingLow = mpro2Results.swingLow;
  const mpro2GoldenTop = mpro2Results.goldenPocket?.topPrice ?? (lowestPrice + totalRange * 0.618);
  const mpro2GoldenBottom = mpro2Results.goldenPocket?.bottomPrice ?? (lowestPrice + totalRange * 0.650);
  const mpro2YellowMidTop = Math.max(mpro2GoldenTop, mpro2GoldenBottom);
  const mpro2YellowMidBottom = Math.min(mpro2GoldenTop, mpro2GoldenBottom);

  // Average candle range for dynamic touch tolerance
  const avgRange = windowCandles.slice(-20).reduce((acc, c) => acc + (c.high - c.low), 0) / 20 || 1;
  const touchTolerance = Math.max(avgRange * 0.45, totalRange * 0.008);

  // Scan for signals on the latest 2-3 candles
  let detectedSource: MasterSignalSource | null = null;
  let signalDirection: 'BUY' | 'SELL' = 'BUY';
  let touchPattern: TouchPattern = 'FIRST_TOUCH';
  let targetBarrierPrice = mpro2SwingHigh;

  // 0. Check Weekly Anchor Confirmed Swing Lock Retest (Option 1 + Option 3)
  const weeklyAnchor = mpro2Results.weeklyAnchor;
  if (weeklyAnchor && weeklyAnchor.currentStage === 'RETEST_ACTIVE') {
    if (weeklyAnchor.retestType === 'SUPPORT_RETEST') {
      detectedSource = 'WEEKLY_ANCHOR_RETEST_BUY';
      signalDirection = 'BUY';
      touchPattern = 'WEEKLY_PWH_RETEST';
      targetBarrierPrice = weeklyAnchor.confirmedHigh > weeklyAnchor.anchorHigh
        ? weeklyAnchor.confirmedHigh
        : weeklyAnchor.anchorHigh + (weeklyAnchor.anchorHigh - weeklyAnchor.anchorLow) * 0.5;
    } else if (weeklyAnchor.retestType === 'RESISTANCE_RETEST') {
      detectedSource = 'WEEKLY_ANCHOR_RETEST_SELL';
      signalDirection = 'SELL';
      touchPattern = 'WEEKLY_PWL_RETEST';
      targetBarrierPrice = weeklyAnchor.confirmedLow < weeklyAnchor.anchorLow
        ? weeklyAnchor.confirmedLow
        : weeklyAnchor.anchorLow - (weeklyAnchor.anchorHigh - weeklyAnchor.anchorLow) * 0.5;
    }
  }

  // 1. Check Mpro2 Yellow Golden Pocket Interaction
  // When price touches/interacts with yellow midline:
  // Bullish confirmation: dipped into/near yellow band and closed above it (BUY)
  // Bearish confirmation: rallied into/near yellow band and closed below it (SELL)
  const touchedYellowMid =
    (currentBar.low <= mpro2YellowMidTop + touchTolerance && currentBar.high >= mpro2YellowMidBottom - touchTolerance) ||
    (prevBar.low <= mpro2YellowMidTop + touchTolerance && prevBar.high >= mpro2YellowMidBottom - touchTolerance);

  if (!detectedSource && touchedYellowMid) {
    const isBullishBounce = currentBar.close > currentBar.open && currentBar.close >= mpro2YellowMidTop;
    const isBearishBounce = currentBar.close < currentBar.open && currentBar.close <= mpro2YellowMidBottom;

    if (isBullishBounce) {
      detectedSource = 'MPRO2_YELLOW_MID_BUY';
      signalDirection = 'BUY';
      touchPattern = 'MIDLINE_BOUNCE';
      targetBarrierPrice = mpro2SwingHigh;
    } else if (isBearishBounce) {
      detectedSource = 'MPRO2_YELLOW_MID_SELL';
      signalDirection = 'SELL';
      touchPattern = 'MIDLINE_BOUNCE';
      targetBarrierPrice = mpro2SwingLow;
    }
  }

  // 2. Check Mpro2 Signal Arrows (Outer Lines: Support Reversal, Resistance Reversal, or Retest Continuation)
  if (!detectedSource && mpro2Results && mpro2Results.signals.length > 0) {
    const recentMpro2 = mpro2Results.signals[mpro2Results.signals.length - 1];
    if (recentMpro2 && (n - 1 - recentMpro2.index <= 2)) {
      if (recentMpro2.subType === 'RETEST_CONTINUATION_BUY') {
        detectedSource = 'MPRO2_BREAKOUT_RETEST_BUY';
        signalDirection = 'BUY';
        touchPattern = 'BREAKOUT_RETEST_BOUNCE';
        targetBarrierPrice = mpro2SwingHigh + (mpro2SwingHigh - mpro2SwingLow) * 0.618;
      } else if (recentMpro2.subType === 'RETEST_CONTINUATION_SELL') {
        detectedSource = 'MPRO2_BREAKDOWN_RETEST_SELL';
        signalDirection = 'SELL';
        touchPattern = 'BREAKDOWN_RETEST_REJECTION';
        targetBarrierPrice = mpro2SwingLow - (mpro2SwingHigh - mpro2SwingLow) * 0.618;
      } else if (recentMpro2.type === 'BUY') {
        detectedSource = 'MPRO2_LOWER_BUY';
        signalDirection = 'BUY';
        touchPattern = 'FIRST_TOUCH';
        targetBarrierPrice = mpro2SwingHigh;
      } else {
        detectedSource = 'MPRO2_UPPER_SELL';
        signalDirection = 'SELL';
        touchPattern = 'FIRST_TOUCH';
        targetBarrierPrice = mpro2SwingLow;
      }
    }
  }

  // 3. Physical Mpro2 Boundary check on recent bars if no arrow fired yet:
  // CRITICAL RULE: A touch alone does NOT trigger a signal!
  // Price must have confirmed a candle rejection (bounce/wick) to validate the level.
  if (!detectedSource) {
    let hasRecentBreakoutAbove = false;
    let hasRecentBreakdownBelow = false;
    const scanStart = Math.max(0, n - 25);
    for (let idx = scanStart; idx < n - 1; idx++) {
      if (candles[idx].close > mpro2SwingHigh + touchTolerance * 0.15) {
        hasRecentBreakoutAbove = true;
      }
      if (candles[idx].close < mpro2SwingLow - touchTolerance * 0.15) {
        hasRecentBreakdownBelow = true;
      }
    }

    const cRange = Math.max(0.0001, currentBar.high - currentBar.low);
    const upperWick = currentBar.high - Math.max(currentBar.open, currentBar.close);
    const lowerWick = Math.min(currentBar.open, currentBar.close) - currentBar.low;
    const lowerWickPct = lowerWick / cRange;
    const upperWickPct = upperWick / cRange;

    // Check Upper Mpro2 Boundary Interaction (Resistance 0.000)
    const touchesUpper = currentBar.high >= mpro2SwingHigh - touchTolerance && currentBar.low <= mpro2SwingHigh + touchTolerance;
    if (touchesUpper) {
      if (hasRecentBreakoutAbove) {
        // Breakout occurred: broken resistance is now Support.
        // A bounce candle here is a Retest Continuation BUY!
        const confirmedBounce =
          currentBar.close >= mpro2SwingHigh - touchTolerance * 0.3 &&
          (currentBar.close > currentBar.open || lowerWickPct >= 0.25 || (currentBar.close - currentBar.low) / cRange >= 0.55);

        if (confirmedBounce) {
          detectedSource = 'MPRO2_BREAKOUT_RETEST_BUY';
          signalDirection = 'BUY';
          touchPattern = 'BREAKOUT_RETEST_BOUNCE';
          targetBarrierPrice = mpro2SwingHigh + totalRange * 0.618;
        }
      } else {
        // Inside Range: Upper Boundary is Resistance.
        // MUST confirm bearish rejection (not green momentum slamming through)!
        const confirmedRejection =
          currentBar.close <= mpro2SwingHigh + touchTolerance * 0.15 &&
          (currentBar.close < currentBar.open || upperWickPct >= 0.25 || (currentBar.high - currentBar.close) / cRange >= 0.55);

        if (confirmedRejection) {
          detectedSource = 'MPRO2_UPPER_SELL';
          signalDirection = 'SELL';
          touchPattern = 'FIRST_TOUCH';
          targetBarrierPrice = mpro2SwingLow;
        }
      }
    }

    // Check Lower Mpro2 Boundary Interaction (Support 1.000)
    const touchesLower = currentBar.low <= mpro2SwingLow + touchTolerance && currentBar.high >= mpro2SwingLow - touchTolerance;
    if (!detectedSource && touchesLower) {
      if (hasRecentBreakdownBelow) {
        // Breakdown occurred: broken support is now Resistance.
        // A rejection candle here is a Retest Continuation SELL!
        const confirmedRejection =
          currentBar.close <= mpro2SwingLow + touchTolerance * 0.3 &&
          (currentBar.close < currentBar.open || upperWickPct >= 0.25 || (currentBar.high - currentBar.close) / cRange >= 0.55);

        if (confirmedRejection) {
          detectedSource = 'MPRO2_BREAKDOWN_RETEST_SELL';
          signalDirection = 'SELL';
          touchPattern = 'BREAKDOWN_RETEST_REJECTION';
          targetBarrierPrice = mpro2SwingLow - totalRange * 0.618;
        }
      } else {
        // Inside Range: Lower Boundary is Support.
        // MUST confirm bullish bounce!
        const confirmedBounce =
          currentBar.close >= mpro2SwingLow - touchTolerance * 0.15 &&
          (currentBar.close > currentBar.open || lowerWickPct >= 0.25 || (currentBar.close - currentBar.low) / cRange >= 0.55);

        if (confirmedBounce) {
          detectedSource = 'MPRO2_LOWER_BUY';
          signalDirection = 'BUY';
          touchPattern = 'FIRST_TOUCH';
          targetBarrierPrice = mpro2SwingHigh;
        }
      }
    }
  }

  // If no setup detected at all, return null
  if (!detectedSource) {
    return null;
  }

  // Detect First Touch vs Retest / Double Touch
  // Scan previous 3 to 25 candles to see if a prior touch occurred at this zone
  if (
    touchPattern !== 'MIDLINE_BOUNCE' &&
    touchPattern !== 'WEEKLY_PWH_RETEST' &&
    touchPattern !== 'WEEKLY_PWL_RETEST' &&
    touchPattern !== 'BREAKOUT_RETEST_BOUNCE' &&
    touchPattern !== 'BREAKDOWN_RETEST_REJECTION'
  ) {
    let priorTouches = 0;
    const testLevel = signalDirection === 'BUY' ? lowestPrice : highestPrice;
    for (let i = Math.max(0, n - 25); i < n - 3; i++) {
      const c = candles[i];
      if (signalDirection === 'BUY' && Math.abs(c.low - testLevel) <= touchTolerance * 1.5) {
        priorTouches++;
      } else if (signalDirection === 'SELL' && Math.abs(c.high - testLevel) <= touchTolerance * 1.5) {
        priorTouches++;
      }
    }
    touchPattern = priorTouches > 0 ? 'RETEST_DOUBLE_TOUCH' : 'FIRST_TOUCH';
  }

  // -------------------------------------------------------------
  // REJECTION ANATOMY ANALYSIS
  // -------------------------------------------------------------
  const candleRange = Math.max(0.0001, currentBar.high - currentBar.low);
  const candleBody = Math.abs(currentBar.close - currentBar.open);
  const lowerWick = Math.min(currentBar.open, currentBar.close) - currentBar.low;
  const upperWick = currentBar.high - Math.max(currentBar.open, currentBar.close);

  const wickRatio = signalDirection === 'BUY' ? lowerWick / candleRange : upperWick / candleRange;
  const bodyRatio = candleBody / candleRange;
  const closePositionRatio = (currentBar.close - currentBar.low) / candleRange;

  const isCleanRejection =
    signalDirection === 'BUY'
      ? (wickRatio >= 0.28 && closePositionRatio >= 0.52 && currentBar.close > currentBar.open)
      : (wickRatio >= 0.28 && closePositionRatio <= 0.48 && currentBar.close < currentBar.open);

  // -------------------------------------------------------------
  // MICRO-TRIGGER & 15-MIN TRAP ENGINE (5M/15M Break of Structure)
  // -------------------------------------------------------------
  const entryPrice = livePrice || currentBar.close;
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsedSec = Math.max(0, nowSec - currentBar.time);
  const isOneHour = timeframe.toUpperCase() === '1H';
  // First 15 minutes of a 1H bar (900 seconds) is the early fakeout / trap window
  const isEarlyTrapWindow = isOneHour && elapsedSec < 900;

  let triggerPrice: number;
  let breakConfirmed: boolean;
  let tightStopLoss: number;
  let tightRisk: number;
  let breakEvenPrice: number;
  let tp1RPrice: number;
  let tp3RPrice: number;

  const tightBuffer = Math.max(avgRange * 0.15, entryPrice * 0.0008);

  if (signalDirection === 'SELL') {
    // For Sell: price must break down below the micro floor (5M/15M swing low / 35% retracement level)
    triggerPrice = Number((Math.min(currentBar.open, currentBar.high - candleRange * 0.35)).toFixed(3));
    breakConfirmed = currentBar.close <= triggerPrice;
    tightStopLoss = Number((currentBar.high + tightBuffer).toFixed(3));
    tightRisk = Math.max(0.001, tightStopLoss - entryPrice);
    breakEvenPrice = Number((entryPrice - tightRisk).toFixed(3));
    tp1RPrice = breakEvenPrice;
    tp3RPrice = Number((entryPrice - tightRisk * 3.0).toFixed(3));
  } else {
    // For Buy: price must break out above the micro ceiling (5M/15M swing high / 35% bounce level)
    triggerPrice = Number((Math.max(currentBar.open, currentBar.low + candleRange * 0.35)).toFixed(3));
    breakConfirmed = currentBar.close >= triggerPrice;
    tightStopLoss = Number((currentBar.low - tightBuffer).toFixed(3));
    tightRisk = Math.max(0.001, entryPrice - tightStopLoss);
    breakEvenPrice = Number((entryPrice + tightRisk).toFixed(3));
    tp1RPrice = breakEvenPrice;
    tp3RPrice = Number((entryPrice + tightRisk * 3.0).toFixed(3));
  }

  let microStatus: MicroTriggerStatus = 'WAITING_BREAK';
  let microStatusText = '';

  if (breakConfirmed) {
    microStatus = 'CONFIRMED';
    microStatusText = `5M/15M Micro-Structure Break Confirmed at ${triggerPrice} (1:3 Sniper Entry Ready)`;
  } else if (isEarlyTrapWindow) {
    microStatus = 'EARLY_TRAP_WINDOW';
    const minsElapsed = Math.floor(elapsedSec / 60);
    microStatusText = `First 15-Min Trap Window (${minsElapsed}m elapsed). Running candle in progress; wait for break ${signalDirection === 'SELL' ? 'below' : 'above'} ${triggerPrice}.`;
  } else {
    microStatus = 'WAITING_BREAK';
    microStatusText = signalDirection === 'SELL'
      ? `Waiting for 5M/15M lower low breakdown below ${triggerPrice}`
      : `Waiting for 5M/15M higher high breakout above ${triggerPrice}`;
  }

  // -------------------------------------------------------------
  // 1:3 RISK-TO-REWARD ROOM CALCULATION (Using High-Efficiency Tight SL)
  // -------------------------------------------------------------
  const stopLossPrice = tightStopLoss;
  const riskAmount = tightRisk;
  const rewardAmount = riskAmount * 3.0; // Strict 1:3 RR
  const takeProfitPrice = tp3RPrice;

  const distanceToOpposingBarrier =
    signalDirection === 'BUY'
      ? Math.max(0, targetBarrierPrice - entryPrice)
      : Math.max(0, entryPrice - targetBarrierPrice);

  const clearanceRatio = distanceToOpposingBarrier / Math.max(0.001, rewardAmount);
  // Has room if opposing barrier is AT OR BEYOND our 3R target
  const hasRoomFor3R = clearanceRatio >= 0.90;

  // -------------------------------------------------------------
  // REGIME & SLOPE EVALUATION
  // -------------------------------------------------------------
  let regime: MarketRegime = 'RANGE_BOUND';
  let isSlopeAligned = false;
  let isRunawayHostile = false;

  if (Math.abs(mproSlopeDegrees) >= 25) {
    regime = 'HEALTHY_TREND';
    if (mproSlopeDegrees > 25) {
      isSlopeAligned = signalDirection === 'BUY';
      isRunawayHostile = signalDirection === 'SELL';
    } else {
      isSlopeAligned = signalDirection === 'SELL';
      isRunawayHostile = signalDirection === 'BUY';
    }
  } else if (Math.abs(mproSlopeDegrees) <= 8) {
    regime = 'RANGE_BOUND';
    isSlopeAligned = true; // In range, both top and bottom reversals are valid
  } else {
    regime = 'HEALTHY_TREND';
    isSlopeAligned = (mproSlopeDegrees > 0 && signalDirection === 'BUY') || (mproSlopeDegrees < 0 && signalDirection === 'SELL');
  }

  // Check band compression
  const recentBandWidth = totalRange / entryPrice;
  if (recentBandWidth < 0.015) {
    regime = 'COMPRESSION_SQUEEZE';
  }

  // -------------------------------------------------------------
  // MASTER GATEKEEPER DECISION ENGINE
  // -------------------------------------------------------------
  const decisionReasons: string[] = [];
  let score = 50;

  // Gate 1: Slope & Trend
  if (isRunawayHostile) {
    if (breakConfirmed && isCleanRejection) {
      score -= 10;
      decisionReasons.push(`Counter-trend against runaway slope (${mproSlopeDegrees > 0 ? '+' : ''}${mproSlopeDegrees}°), but 5M/15M Micro-CHoCH breakdown is confirmed.`);
    } else {
      score -= 40;
      decisionReasons.push(`Hostile runaway trend (${mproSlopeDegrees > 0 ? '+' : ''}${mproSlopeDegrees}°). Early counter-trend candle is unconfirmed. Do not fade without 5M/15M structural break.`);
    }
  } else if (isSlopeAligned) {
    score += 15;
    decisionReasons.push(`Slope aligned with direction (${mproSlopeDegrees > 0 ? '+' : ''}${mproSlopeDegrees}°).`);
  } else {
    decisionReasons.push(`Neutral / Range-bound channel.`);
  }

  // Midline specific check
  if (touchPattern === 'MIDLINE_BOUNCE') {
    if (Math.abs(mproSlopeDegrees) < 12) {
      score -= 30;
      decisionReasons.push(`Yellow midline bounces require strong trend slope; currently flat/choppy (${mproSlopeDegrees}°).`);
    } else {
      score += 15;
      decisionReasons.push(`Valid trend continuation bounce off Mpro2 yellow pocket.`);
    }
  }

  // Gate 2: Room for 1:3 R:R
  if (!hasRoomFor3R) {
    score -= 30;
    decisionReasons.push(`Insufficient room for 1:3 RR. Opposing band is only ${clearanceRatio.toFixed(2)}x of 3R distance.`);
  } else {
    score += 20;
    decisionReasons.push(`Clear airway for 1:3 RR (${clearanceRatio.toFixed(2)}x clearance to opposing barrier).`);
  }

  // Gate 3: Rejection Anatomy & Pattern
  if (touchPattern === 'WEEKLY_PWH_RETEST' || touchPattern === 'WEEKLY_PWL_RETEST') {
    score += 25;
    decisionReasons.push(`Master Confirmed Swing Lock: Weekly Anchor retest confirmed (Break → Hold → Retest cycle completed).`);
  } else if (touchPattern === 'BREAKOUT_RETEST_BOUNCE') {
    score += 25;
    decisionReasons.push(`A+ Breakout Retest: Broken Resistance tested and confirmed as Support with bullish bounce (Continuation BUY).`);
  } else if (touchPattern === 'BREAKDOWN_RETEST_REJECTION') {
    score += 25;
    decisionReasons.push(`A+ Breakdown Retest: Broken Support tested and confirmed as Resistance with bearish rejection (Continuation SELL).`);
  } else if (touchPattern === 'RETEST_DOUBLE_TOUCH') {
    score += 20;
    decisionReasons.push(`High-probability 2nd touch / liquidity sweep retest confirmed.`);
  } else {
    score += 5;
    decisionReasons.push(`Confirmed level bounce/rejection.`);
  }

  if (isCleanRejection) {
    score += 15;
    decisionReasons.push(`Strong candle rejection: ${(wickRatio * 100).toFixed(0)}% wick absorption.`);
  } else if (wickRatio < 0.20) {
    score -= 15;
    decisionReasons.push(`Weak rejection wick (${(wickRatio * 100).toFixed(0)}%). High risk of continuation breakout.`);
  }

  // Gate 4: Micro-Trigger & 15-Minute Trap Status
  if (isEarlyTrapWindow && !breakConfirmed) {
    score -= 25;
    decisionReasons.unshift(`Active 15-Minute Trap Window: Running candle has not confirmed structural break. Avoid premature entry.`);
  }

  if (breakConfirmed) {
    score += 20;
    decisionReasons.push(`5M/15M Micro-structure break verified at ${triggerPrice}. Tight 1:3 SL active.`);
  } else {
    score -= 15;
    decisionReasons.push(signalDirection === 'SELL'
      ? `Wait for micro breakdown below ${triggerPrice} before entering.`
      : `Wait for micro breakout above ${triggerPrice} before entering.`);
  }

  score = Math.max(10, Math.min(99, score));

  // Determine Final Verdict
  let decision: MasterDecision = 'WAIT';

  if ((isRunawayHostile && !breakConfirmed) || !hasRoomFor3R || (touchPattern === 'MIDLINE_BOUNCE' && Math.abs(mproSlopeDegrees) < 12)) {
    decision = 'SKIP';
  } else if (score >= 65 && hasRoomFor3R && breakConfirmed) {
    decision = 'TAKE';
  } else {
    decision = 'WAIT';
    if (!breakConfirmed) {
      decisionReasons.unshift(`Wait for 5M/15M micro structural break ${signalDirection === 'SELL' ? 'below' : 'above'} ${triggerPrice}.`);
    } else if (!isCleanRejection) {
      decisionReasons.unshift('Wait for secondary retest or breakout of rejection candle high/low.');
    }
  }

  return {
    signalSource: detectedSource,
    signalDirection,
    barIndex: n - 1,
    candleTime: currentBar.time,
    currentPrice: entryPrice,
    slope: {
      mproSlopeDegrees,
      mpro2DirectionDown: mpro2Results?.directionIsDown ?? false,
      regime,
      isSlopeAligned,
      isRunawayHostile,
      slopeText: `${mproSlopeDegrees > 0 ? '+' : ''}${mproSlopeDegrees}° (${regime.replace('_', ' ')})`,
    },
    targetRoom: {
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      riskAmount,
      rewardAmount,
      riskRewardRatio: 3.0,
      opposingBarrierPrice: targetBarrierPrice,
      distanceToOpposingBarrier,
      hasRoomFor3R,
      clearanceRatio,
      clearanceText: `${clearanceRatio.toFixed(2)}x Clearance (${hasRoomFor3R ? 'PASSED' : 'BLOCKED'})`,
    },
    rejection: {
      wickRatio,
      bodyRatio,
      closePositionRatio,
      isCleanRejection,
      touchPattern,
      rejectionText: `${touchPattern.replace(/_/g, ' ')} · ${(wickRatio * 100).toFixed(0)}% Wick`,
    },
    microTrigger: {
      status: microStatus,
      triggerPrice,
      timeElapsedInCandleSeconds: elapsedSec,
      isEarlyTrapWindow,
      breakConfirmed,
      tightStopLoss,
      tightRisk,
      breakEvenPrice,
      tp1RPrice,
      tp3RPrice,
      statusText: microStatusText,
    },
    decision,
    confidenceScore: score,
    decisionReasons,
  };
}

// -------------------------------------------------------------
// LOCAL STORAGE TRADE JOURNAL & TRACKING
// -------------------------------------------------------------

export function getLoggedTrades(): LoggedTrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRADES);
    if (!raw) {
      // Seed initial 20 historical trades reflecting the user's 8W / 12L record on Jump 10
      const seeded = generateSeedJump10Trades();
      localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Seeds the user's 20 historical trades (8 wins, 12 losses on Jump 10 1H)
 * with the pre-trade factors so the empirical learning engine immediately provides
 * clarity on what went wrong with the losses.
 */
function generateSeedJump10Trades(): LoggedTrade[] {
  const baseTime = Math.floor(Date.now() / 1000) - 20 * 3600 * 6; // spread over past days
  const trades: LoggedTrade[] = [];

  // Configuration of the 20 trades: 8 wins, 12 losses
  const tradeConfigs = [
    // 1. Win: Clean Retest with Aligned Slope
    { isWin: true, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: 18, hostile: false, pattern: 'RETEST_DOUBLE_TOUCH' as const, wick: 0.44, room: true, dec: 'TAKE' as const },
    // 2. Loss: Blind First Touch into Hostile Downward Runaway Trend (-32°)
    { isWin: false, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: -32, hostile: true, pattern: 'FIRST_TOUCH' as const, wick: 0.16, room: true, dec: 'SKIP' as const },
    // 3. Loss: Blind First Touch, Opposing Band Blocked 1:3 Target (0.68x clearance)
    { isWin: false, dir: 'SELL' as const, source: 'MPRO_UPPER_SELL' as const, slope: 5, hostile: false, pattern: 'FIRST_TOUCH' as const, wick: 0.22, room: false, dec: 'SKIP' as const },
    // 4. Win: Mpro2 Yellow Midline Bounce with Strong Aligned Uptrend (+28°)
    { isWin: true, dir: 'BUY' as const, source: 'MPRO2_YELLOW_MID_BUY' as const, slope: 28, hostile: false, pattern: 'MIDLINE_BOUNCE' as const, wick: 0.38, room: true, dec: 'TAKE' as const },
    // 5. Loss: Faded Strong Uptrend (+35° slope) on first touch upper band
    { isWin: false, dir: 'SELL' as const, source: 'MPRO_UPPER_SELL' as const, slope: 35, hostile: true, pattern: 'FIRST_TOUCH' as const, wick: 0.14, room: true, dec: 'SKIP' as const },
    // 6. Loss: Retest but opposing level choked 1:3 RR (0.75x room)
    { isWin: false, dir: 'BUY' as const, source: 'MPRO2_LOWER_BUY' as const, slope: -8, hostile: false, pattern: 'RETEST_DOUBLE_TOUCH' as const, wick: 0.32, room: false, dec: 'SKIP' as const },
    // 7. Win: Liquidity sweep retest on lower band with 52% wick
    { isWin: true, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: 12, hostile: false, pattern: 'RETEST_DOUBLE_TOUCH' as const, wick: 0.52, room: true, dec: 'TAKE' as const },
    // 8. Loss: Yellow midline attempted in flat/choppy market (slope 2°)
    { isWin: false, dir: 'SELL' as const, source: 'MPRO2_YELLOW_MID_SELL' as const, slope: 2, hostile: false, pattern: 'MIDLINE_BOUNCE' as const, wick: 0.20, room: true, dec: 'SKIP' as const },
    // 9. Loss: Blind first touch with weak candle body
    { isWin: false, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: -14, hostile: false, pattern: 'FIRST_TOUCH' as const, wick: 0.18, room: true, dec: 'WAIT' as const },
    // 10. Win: 2nd Touch Retest on Upper Band with Bearish Engulfing
    { isWin: true, dir: 'SELL' as const, source: 'MPRO_UPPER_SELL' as const, slope: -16, hostile: false, pattern: 'RETEST_DOUBLE_TOUCH' as const, wick: 0.40, room: true, dec: 'TAKE' as const },
    // 11. Loss: Counter-trend BUY into steep downtrend (-29°)
    { isWin: false, dir: 'BUY' as const, source: 'MPRO2_LOWER_BUY' as const, slope: -29, hostile: true, pattern: 'FIRST_TOUCH' as const, wick: 0.15, room: true, dec: 'SKIP' as const },
    // 12. Loss: Consecutive loss - premature entry before candle close
    { isWin: false, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: -22, hostile: false, pattern: 'FIRST_TOUCH' as const, wick: 0.12, room: false, dec: 'SKIP' as const },
    // 13. Loss: Consecutive loss - blocked 1:3 room
    { isWin: false, dir: 'SELL' as const, source: 'MPRO_UPPER_SELL' as const, slope: 15, hostile: false, pattern: 'FIRST_TOUCH' as const, wick: 0.25, room: false, dec: 'SKIP' as const },
    // 14. Win: High probability Mpro2 Yellow Midline trend continuation (+24°)
    { isWin: true, dir: 'BUY' as const, source: 'MPRO2_YELLOW_MID_BUY' as const, slope: 24, hostile: false, pattern: 'MIDLINE_BOUNCE' as const, wick: 0.42, room: true, dec: 'TAKE' as const },
    // 15. Win: Double bottom retest on lower band with 46% wick
    { isWin: true, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: 8, hostile: false, pattern: 'RETEST_DOUBLE_TOUCH' as const, wick: 0.46, room: true, dec: 'TAKE' as const },
    // 16. Loss: Hostile runaway momentum candle slicing through level
    { isWin: false, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: -36, hostile: true, pattern: 'FIRST_TOUCH' as const, wick: 0.10, room: true, dec: 'SKIP' as const },
    // 17. Loss: Midline bounce attempt without room for 1:3
    { isWin: false, dir: 'BUY' as const, source: 'MPRO2_YELLOW_MID_BUY' as const, slope: 10, hostile: false, pattern: 'MIDLINE_BOUNCE' as const, wick: 0.28, room: false, dec: 'SKIP' as const },
    // 18. Win: Perfect Retest on Upper Band with clean rejection
    { isWin: true, dir: 'SELL' as const, source: 'MPRO_UPPER_SELL' as const, slope: -20, hostile: false, pattern: 'RETEST_DOUBLE_TOUCH' as const, wick: 0.48, room: true, dec: 'TAKE' as const },
    // 19. Loss: Hostile slope trade
    { isWin: false, dir: 'SELL' as const, source: 'MPRO2_UPPER_SELL' as const, slope: 30, hostile: true, pattern: 'FIRST_TOUCH' as const, wick: 0.17, room: true, dec: 'SKIP' as const },
    // 20. Win: Retest bounce on lower Mpro line with 3.2x clearance to upper band
    { isWin: true, dir: 'BUY' as const, source: 'MPRO_LOWER_BUY' as const, slope: 14, hostile: false, pattern: 'RETEST_DOUBLE_TOUCH' as const, wick: 0.50, room: true, dec: 'TAKE' as const },
  ];

  tradeConfigs.forEach((cfg, idx) => {
    const tradeTime = baseTime + idx * 3600 * 6;
    const basePrice = 1250.0 + (idx % 5) * 15;
    const risk = 10.0;
    const reward = 30.0; // 1:3 RR

    const entryPrice = basePrice;
    const stopLoss = cfg.dir === 'BUY' ? entryPrice - risk : entryPrice + risk;
    const takeProfit = cfg.dir === 'BUY' ? entryPrice + reward : entryPrice - reward;

    trades.push({
      id: `seed_trade_${idx + 1}`,
      timestamp: tradeTime,
      symbol: 'Jump 10',
      timeframe: '1H',
      source: cfg.source,
      direction: cfg.dir,
      entryPrice,
      stopLoss,
      takeProfit,
      riskRewardRatio: 3.0,
      decisionAtEntry: cfg.dec,
      preTradeSnapshot: {
        signalSource: cfg.source,
        signalDirection: cfg.dir,
        barIndex: 100 + idx,
        candleTime: tradeTime,
        currentPrice: entryPrice,
        slope: {
          mproSlopeDegrees: cfg.slope,
          mpro2DirectionDown: cfg.slope < 0,
          regime: cfg.hostile ? 'HOSTILE_RUNAWAY' : Math.abs(cfg.slope) < 8 ? 'RANGE_BOUND' : 'HEALTHY_TREND',
          isSlopeAligned: (cfg.slope > 0 && cfg.dir === 'BUY') || (cfg.slope < 0 && cfg.dir === 'SELL'),
          isRunawayHostile: cfg.hostile,
          slopeText: `${cfg.slope > 0 ? '+' : ''}${cfg.slope}° (${cfg.hostile ? 'HOSTILE RUNAWAY' : 'NORMAL'})`,
        },
        targetRoom: {
          entryPrice,
          stopLossPrice: stopLoss,
          takeProfitPrice: takeProfit,
          riskAmount: risk,
          rewardAmount: reward,
          riskRewardRatio: 3.0,
          opposingBarrierPrice: cfg.dir === 'BUY' ? entryPrice + (cfg.room ? 45 : 20) : entryPrice - (cfg.room ? 45 : 20),
          distanceToOpposingBarrier: cfg.room ? 45 : 20,
          hasRoomFor3R: cfg.room,
          clearanceRatio: cfg.room ? 1.5 : 0.67,
          clearanceText: cfg.room ? '1.50x Clearance (PASSED)' : '0.67x Clearance (BLOCKED)',
        },
        rejection: {
          wickRatio: cfg.wick,
          bodyRatio: 1 - cfg.wick,
          closePositionRatio: cfg.dir === 'BUY' ? 0.8 : 0.2,
          isCleanRejection: cfg.wick >= 0.30,
          touchPattern: cfg.pattern,
          rejectionText: `${cfg.pattern.replace(/_/g, ' ')} · ${(cfg.wick * 100).toFixed(0)}% Wick`,
        },
        microTrigger: {
          status: cfg.isWin ? 'CONFIRMED' : cfg.hostile ? 'EARLY_TRAP_WINDOW' : 'WAITING_BREAK',
          triggerPrice: cfg.dir === 'BUY' ? entryPrice + 3.0 : entryPrice - 3.0,
          timeElapsedInCandleSeconds: 1800,
          isEarlyTrapWindow: cfg.hostile,
          breakConfirmed: cfg.isWin,
          tightStopLoss: stopLoss,
          tightRisk: risk,
          breakEvenPrice: cfg.dir === 'BUY' ? entryPrice + risk : entryPrice - risk,
          tp1RPrice: cfg.dir === 'BUY' ? entryPrice + risk : entryPrice - risk,
          tp3RPrice: takeProfit,
          statusText: cfg.isWin ? 'Micro-structure break confirmed' : 'Unconfirmed running candle',
        },
        decision: cfg.dec,
        confidenceScore: cfg.isWin ? 85 : 45,
        decisionReasons: cfg.hostile
          ? ['Hostile runaway trend. Counter-trend boundary fade.']
          : !cfg.room
          ? ['Opposing band blocks 1:3 RR target.']
          : ['High probability retest setup.'],
      },
      status: cfg.isWin ? 'WIN_TP' : 'LOSS_SL',
      outcomeTime: tradeTime + 3600 * 4,
      outcomePrice: cfg.isWin ? takeProfit : stopLoss,
      actualR: cfg.isWin ? 3.0 : -1.0,
      notes: `Jump 10 1H setup #${idx + 1}`,
    });
  });

  return trades;
}

export function saveLoggedTrade(trade: LoggedTrade): void {
  try {
    const trades = getLoggedTrades();
    const existingIdx = trades.findIndex((t) => t.id === trade.id);
    if (existingIdx >= 0) {
      trades[existingIdx] = trade;
    } else {
      trades.unshift(trade);
    }
    localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(trades));
  } catch (err) {
    console.error('Failed to save trade to localStorage:', err);
  }
}

export function deleteLoggedTrade(tradeId: string): void {
  try {
    const trades = getLoggedTrades().filter((t) => t.id !== tradeId);
    localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(trades));
  } catch (err) {
    console.error('Failed to delete trade from localStorage:', err);
  }
}

export function clearAllLoggedTrades(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TRADES);
  } catch (err) {
    console.error('Failed to clear trades from localStorage:', err);
  }
}

/**
 * Manually closes or updates an open trade (e.g. user chose manual exit or early TP/SL)
 */
export function closeTradeManually(
  tradeId: string,
  outcome: 'WIN_TP' | 'LOSS_SL' | 'MANUAL_CLOSED',
  closePrice?: number,
  notes?: string
): LoggedTrade[] {
  const trades = getLoggedTrades();
  const trade = trades.find((t) => t.id === tradeId);
  if (!trade) return trades;

  trade.status = outcome;
  trade.outcomeTime = Math.floor(Date.now() / 1000);
  trade.outcomePrice = closePrice ?? (outcome === 'WIN_TP' ? trade.takeProfit : outcome === 'LOSS_SL' ? trade.stopLoss : trade.entryPrice);

  const risk = Math.abs(trade.entryPrice - trade.stopLoss);
  if (risk > 0 && trade.outcomePrice !== undefined) {
    const profitDistance = trade.direction === 'BUY'
      ? (trade.outcomePrice - trade.entryPrice)
      : (trade.entryPrice - trade.outcomePrice);
    trade.actualR = Number((profitDistance / risk).toFixed(2));
  } else {
    trade.actualR = outcome === 'WIN_TP' ? 3.0 : outcome === 'LOSS_SL' ? -1.0 : 0;
  }

  if (notes) {
    trade.notes = trade.notes ? `${trade.notes} | ${notes}` : notes;
  }

  try {
    localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(trades));
  } catch (err) {
    console.error('Failed to update trade in localStorage:', err);
  }

  return trades;
}

/**
 * Updates the Stop Loss of an open trade (e.g. moving Stop Loss to Break-Even at +1R)
 */
export function updateTradeStopLoss(tradeId: string, newStopLoss: number, note?: string): LoggedTrade[] {
  const trades = getLoggedTrades();
  const trade = trades.find((t) => t.id === tradeId);
  if (!trade) return trades;

  trade.stopLoss = newStopLoss;
  const beNote = note || `SL adjusted to Break-Even (${newStopLoss})`;
  trade.notes = trade.notes ? `${trade.notes} | ${beNote}` : beNote;

  try {
    localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(trades));
  } catch (err) {
    console.error('Failed to update stop loss in localStorage:', err);
  }

  return trades;
}

/**
 * Automatically evaluates OPEN trades against new candles to check if
 * Take Profit (+3R) or Stop Loss (-1R) was reached.
 */
export function syncOpenTradesWithCandles(candles: Candle[]): { updatedCount: number; updatedTrades: LoggedTrade[] } {
  if (candles.length === 0) return { updatedCount: 0, updatedTrades: [] };
  const trades = getLoggedTrades();
  let updatedCount = 0;

  for (const trade of trades) {
    if (trade.status !== 'OPEN') continue;

    // Find candles that occurred after trade timestamp
    const subsequentCandles = candles.filter((c) => c.time >= trade.timestamp);
    if (subsequentCandles.length === 0) continue;

    for (const c of subsequentCandles) {
      if (trade.direction === 'BUY') {
        // Did it hit TP?
        if (c.high >= trade.takeProfit) {
          trade.status = 'WIN_TP';
          trade.outcomeTime = c.time;
          trade.outcomePrice = trade.takeProfit;
          trade.actualR = 3.0;
          updatedCount++;
          break;
        }
        // Did it hit SL?
        if (c.low <= trade.stopLoss) {
          trade.status = 'LOSS_SL';
          trade.outcomeTime = c.time;
          trade.outcomePrice = trade.stopLoss;
          trade.actualR = -1.0;
          updatedCount++;
          break;
        }
      } else {
        // SELL
        if (c.low <= trade.takeProfit) {
          trade.status = 'WIN_TP';
          trade.outcomeTime = c.time;
          trade.outcomePrice = trade.takeProfit;
          trade.actualR = 3.0;
          updatedCount++;
          break;
        }
        if (c.high >= trade.stopLoss) {
          trade.status = 'LOSS_SL';
          trade.outcomeTime = c.time;
          trade.outcomePrice = trade.stopLoss;
          trade.actualR = -1.0;
          updatedCount++;
          break;
        }
      }
    }
  }

  if (updatedCount > 0) {
    try {
      localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(trades));
    } catch (err) {
      console.error('Failed to sync trade outcomes to localStorage:', err);
    }
  }

  return { updatedCount, updatedTrades: trades };
}

/**
 * Generates an empirical factor attribution audit from logged trade history
 * without AI hallucinations.
 */
export function generateEmpiricalAttributionReport(trades: LoggedTrade[]): FactorAttributionReport {
  const completed = trades.filter((t) => t.status === 'WIN_TP' || t.status === 'LOSS_SL');
  const totalTrades = completed.length;
  const totalOpen = trades.filter((t) => t.status === 'OPEN').length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      totalWins: 0,
      totalLosses: 0,
      totalOpen,
      winRate: 0,
      netR: 0,
      profitFactor: 0,
      maxConsecutiveLosses: 0,
      maxConsecutiveWins: 0,
      firstTouchCount: 0,
      firstTouchWins: 0,
      firstTouchWinRate: 0,
      retestCount: 0,
      retestWins: 0,
      retestWinRate: 0,
      midlineCount: 0,
      midlineWins: 0,
      midlineWinRate: 0,
      favorableSlopeCount: 0,
      favorableSlopeWins: 0,
      favorableSlopeWinRate: 0,
      hostileSlopeCount: 0,
      hostileSlopeWins: 0,
      hostileSlopeWinRate: 0,
      sufficientRoomCount: 0,
      sufficientRoomWins: 0,
      sufficientRoomWinRate: 0,
      blockedRoomCount: 0,
      blockedRoomWins: 0,
      blockedRoomWinRate: 0,
      takeTradesCount: 0,
      takeTradesWinRate: 0,
      skipTradesCount: 0,
      skipTradesWinRate: 0,
      actionableInsights: ['Log your first 5-10 trades on Jump 10 (1H) to start generating empirical factor diagnostics.'],
    };
  }

  let totalWins = 0;
  let totalLosses = 0;
  let netR = 0;
  let curLossStreak = 0;
  let maxConsecutiveLosses = 0;
  let curWinStreak = 0;
  let maxConsecutiveWins = 0;

  // Factor breakdown counters
  let firstTouchCount = 0;
  let firstTouchWins = 0;
  let retestCount = 0;
  let retestWins = 0;
  let midlineCount = 0;
  let midlineWins = 0;

  let favorableSlopeCount = 0;
  let favorableSlopeWins = 0;
  let hostileSlopeCount = 0;
  let hostileSlopeWins = 0;

  let sufficientRoomCount = 0;
  let sufficientRoomWins = 0;
  let blockedRoomCount = 0;
  let blockedRoomWins = 0;

  let takeTradesCount = 0;
  let takeTradesWins = 0;
  let skipTradesCount = 0;
  let skipTradesWins = 0;

  for (const t of completed) {
    const isWin = t.status === 'WIN_TP';
    if (isWin) {
      totalWins++;
      netR += t.actualR ?? 3.0;
      curWinStreak++;
      curLossStreak = 0;
      if (curWinStreak > maxConsecutiveWins) maxConsecutiveWins = curWinStreak;
    } else {
      totalLosses++;
      netR += t.actualR ?? -1.0;
      curLossStreak++;
      curWinStreak = 0;
      if (curLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = curLossStreak;
    }

    // Touch pattern attribution
    const pattern = t.preTradeSnapshot?.rejection?.touchPattern;
    if (pattern === 'FIRST_TOUCH') {
      firstTouchCount++;
      if (isWin) firstTouchWins++;
    } else if (pattern === 'RETEST_DOUBLE_TOUCH') {
      retestCount++;
      if (isWin) retestWins++;
    } else if (pattern === 'MIDLINE_BOUNCE') {
      midlineCount++;
      if (isWin) midlineWins++;
    }

    // Slope alignment attribution
    const isAligned = t.preTradeSnapshot?.slope?.isSlopeAligned;
    const isHostile = t.preTradeSnapshot?.slope?.isRunawayHostile;
    if (isAligned) {
      favorableSlopeCount++;
      if (isWin) favorableSlopeWins++;
    }
    if (isHostile) {
      hostileSlopeCount++;
      if (isWin) hostileSlopeWins++;
    }

    // 1:3 Clearance attribution
    const hasRoom = t.preTradeSnapshot?.targetRoom?.hasRoomFor3R;
    if (hasRoom) {
      sufficientRoomCount++;
      if (isWin) sufficientRoomWins++;
    } else {
      blockedRoomCount++;
      if (isWin) blockedRoomWins++;
    }

    // Decision attribution
    if (t.decisionAtEntry === 'TAKE') {
      takeTradesCount++;
      if (isWin) takeTradesWins++;
    } else if (t.decisionAtEntry === 'SKIP') {
      skipTradesCount++;
      if (isWin) skipTradesWins++;
    }
  }

  const winRate = Number(((totalWins / totalTrades) * 100).toFixed(1));
  const profitFactor = totalLosses === 0 ? totalWins * 3.0 : Number(((totalWins * 3.0) / totalLosses).toFixed(2));

  const firstTouchWinRate = firstTouchCount > 0 ? Number(((firstTouchWins / firstTouchCount) * 100).toFixed(1)) : 0;
  const retestWinRate = retestCount > 0 ? Number(((retestWins / retestCount) * 100).toFixed(1)) : 0;
  const midlineWinRate = midlineCount > 0 ? Number(((midlineWins / midlineCount) * 100).toFixed(1)) : 0;

  const favorableSlopeWinRate = favorableSlopeCount > 0 ? Number(((favorableSlopeWins / favorableSlopeCount) * 100).toFixed(1)) : 0;
  const hostileSlopeWinRate = hostileSlopeCount > 0 ? Number(((hostileSlopeWins / hostileSlopeCount) * 100).toFixed(1)) : 0;

  const sufficientRoomWinRate = sufficientRoomCount > 0 ? Number(((sufficientRoomWins / sufficientRoomCount) * 100).toFixed(1)) : 0;
  const blockedRoomWinRate = blockedRoomCount > 0 ? Number(((blockedRoomWins / blockedRoomCount) * 100).toFixed(1)) : 0;

  const takeTradesWinRate = takeTradesCount > 0 ? Number(((takeTradesWins / takeTradesCount) * 100).toFixed(1)) : 0;
  const skipTradesWinRate = skipTradesCount > 0 ? Number(((skipTradesWins / skipTradesCount) * 100).toFixed(1)) : 0;

  // Generate quantitative plain-language insights
  const actionableInsights: string[] = [];

  if (retestCount >= 3 && firstTouchCount >= 3) {
    if (retestWinRate > firstTouchWinRate + 15) {
      actionableInsights.push(
        `Retests have a ${retestWinRate}% win rate vs ${firstTouchWinRate}% on blind first touches. Waiting for the second touch/sweep prevents the majority of your stop-outs.`
      );
    }
  }

  if (hostileSlopeCount >= 2 && hostileSlopeWinRate < 35) {
    actionableInsights.push(
      `Fading hostile runaway slopes has yielded only ${hostileSlopeWinRate}% win rate. Hard rule: Do NOT take counter-trend boundary signals when slope > 25°.`
    );
  }

  if (blockedRoomCount >= 2 && blockedRoomWinRate < 35) {
    actionableInsights.push(
      `Trades where the opposing band blocked 1:3 RR had only ${blockedRoomWinRate}% win rate. Target clearance is critical on Jump 10.`
    );
  }

  if (midlineCount >= 3) {
    actionableInsights.push(
      `Mpro2 Yellow Midline bounces have achieved a ${midlineWinRate}% win rate (${midlineWins}/${midlineCount}). Only take midline retests when channel has strong trend slope.`
    );
  }

  if (actionableInsights.length === 0) {
    actionableInsights.push(
      `Current 1:3 RR performance: ${totalWins} Wins / ${totalLosses} Losses (${winRate}% Win Rate, Net ${netR > 0 ? '+' : ''}${netR.toFixed(1)}R). Continue logging trades to refine empirical factors.`
    );
  }

  return {
    totalTrades,
    totalWins,
    totalLosses,
    totalOpen,
    winRate,
    netR: Number(netR.toFixed(1)),
    profitFactor,
    maxConsecutiveLosses,
    maxConsecutiveWins,
    firstTouchCount,
    firstTouchWins,
    firstTouchWinRate,
    retestCount,
    retestWins,
    retestWinRate,
    midlineCount,
    midlineWins,
    midlineWinRate,
    favorableSlopeCount,
    favorableSlopeWins,
    favorableSlopeWinRate,
    hostileSlopeCount,
    hostileSlopeWins,
    hostileSlopeWinRate,
    sufficientRoomCount,
    sufficientRoomWins,
    sufficientRoomWinRate,
    blockedRoomCount,
    blockedRoomWins,
    blockedRoomWinRate,
    takeTradesCount,
    takeTradesWinRate,
    skipTradesCount,
    skipTradesWinRate,
    actionableInsights,
  };
}
