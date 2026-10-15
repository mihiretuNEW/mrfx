import { Candle } from '../types';

export type WeeklyAnchorStage = 
  | 'LOCKED_RANGE'       // Price is oscillating between PWH and PWL. Lines are 100% frozen.
  | 'BREAKOUT_PENDING'   // Price just closed beyond PWH/PWL. Lines DO NOT jump.
  | 'HOLDING_BREAK'      // Price is holding outside for 1-3 bars.
  | 'SWEEP_REJECTED'     // Price failed to hold and closed back inside (Liquidity Sweep / Fakeout).
  | 'RETEST_ACTIVE'      // Price pulled back to test the broken anchor level (A+ Retest Trade Setup).
  | 'CONFIRMED_UPDATE';  // New structural swing confirmed after sustained hold & fractal.

export interface WeeklyAnchorState {
  pwh: number;            // Previous Week High (Fixed Anchor)
  pwl: number;            // Previous Week Low (Fixed Anchor)
  pwm: number;            // Previous Week Midline (50%)
  goldenTop: number;      // Yellow Golden Pocket 0.650
  goldenBottom: number;   // Yellow Golden Pocket 0.618
  anchorHigh: number;     // Active locked upper boundary (does not jump on break)
  anchorLow: number;      // Active locked lower boundary (does not jump on break)
  currentStage: WeeklyAnchorStage;
  stageTitle: string;     // Clean human-readable title (Amharic & English)
  stageDescription: string;
  breakDirection: 'BULLISH' | 'BEARISH' | null;
  breakBarIndex: number | null;
  breakPrice: number | null;
  retested: boolean;
  retestCount: number;
  retestType: 'SUPPORT_RETEST' | 'RESISTANCE_RETEST' | null;
  retestPrice: number | null;
  confirmedHigh: number;
  confirmedLow: number;
  activeWeekStartIndex: number;
  totalWeeksDetected: number;
}

/**
 * Calculates Monday 00:00:00 UTC start of week timestamp for a given time
 */
export function getWeekStartTimestamp(timeSecOrMs: number): number {
  const tMs = timeSecOrMs > 1e11 ? timeSecOrMs : timeSecOrMs * 1000;
  const d = new Date(tMs);
  const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const daysSinceMonday = (day + 6) % 7;
  const mondayUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday, 0, 0, 0, 0));
  return Math.floor(mondayUtc.getTime() / 1000);
}

/**
 * Computes the Weekly Anchor and Confirmed Swing Lock state machine:
 * Flow: Break → Hold/Reject → Retest → Confirmation → Update
 */
export function computeWeeklyAnchor(candles: Candle[]): WeeklyAnchorState {
  const n = candles.length;
  if (n === 0) {
    return {
      pwh: 0,
      pwl: 0,
      pwm: 0,
      goldenTop: 0,
      goldenBottom: 0,
      anchorHigh: 0,
      anchorLow: 0,
      currentStage: 'LOCKED_RANGE',
      stageTitle: 'No Data',
      stageDescription: 'Insufficient candle data',
      breakDirection: null,
      breakBarIndex: null,
      breakPrice: null,
      retested: false,
      retestCount: 0,
      retestType: null,
      retestPrice: null,
      confirmedHigh: 0,
      confirmedLow: 0,
      activeWeekStartIndex: 0,
      totalWeeksDetected: 0,
    };
  }

  // 1. Group candles by calendar week
  const weekBuckets = new Map<number, { candles: Candle[]; startIndex: number }>();
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const wKey = getWeekStartTimestamp(c.time);
    if (!weekBuckets.has(wKey)) {
      weekBuckets.set(wKey, { candles: [], startIndex: i });
    }
    weekBuckets.get(wKey)!.candles.push(c);
  }

  const sortedWeekKeys = Array.from(weekBuckets.keys()).sort((a, b) => a - b);
  const totalWeeksDetected = sortedWeekKeys.length;

  let pwh = 0;
  let pwl = 0;
  let activeWeekStartIndex = 0;

  if (totalWeeksDetected >= 2) {
    // We have at least 1 full previous week and the current ongoing week
    const currentWeekKey = sortedWeekKeys[sortedWeekKeys.length - 1];
    const prevWeekKey = sortedWeekKeys[sortedWeekKeys.length - 2];

    const prevWeekCandles = weekBuckets.get(prevWeekKey)!.candles;
    activeWeekStartIndex = weekBuckets.get(currentWeekKey)!.startIndex;

    let maxH = -Infinity;
    let minL = Infinity;
    for (const c of prevWeekCandles) {
      if (c.high > maxH) maxH = c.high;
      if (c.low < minL) minL = c.low;
    }
    pwh = maxH;
    pwl = minL;
  } else {
    // If fewer than 2 distinct calendar weeks are present in the dataset (e.g. intraday 1M/5M),
    // use the confirmed macro swing high & low from the prior 70% of candles as the anchor
    const splitIndex = Math.max(1, Math.floor(n * 0.7));
    activeWeekStartIndex = splitIndex;

    let maxH = -Infinity;
    let minL = Infinity;
    for (let i = 0; i < splitIndex; i++) {
      if (candles[i].high > maxH) maxH = candles[i].high;
      if (candles[i].low < minL) minL = candles[i].low;
    }
    pwh = maxH > -Infinity ? maxH : candles[0].high;
    pwl = minL < Infinity ? minL : candles[0].low;
  }

  // Guard against inverted or zero ranges
  if (pwh <= pwl || pwh === -Infinity || pwl === Infinity) {
    pwh = Math.max(...candles.map((c) => c.high));
    pwl = Math.min(...candles.map((c) => c.low));
  }

  const pRange = Math.max(0.00001, pwh - pwl);
  const pwm = (pwh + pwl) / 2;
  const goldenTop = pwl + pRange * 0.650;
  const goldenBottom = pwl + pRange * 0.618;

  // 2. Confirmed Swing Lock State Machine:
  // Initial Anchor starts solidly fixed at PWH and PWL
  let anchorHigh = pwh;
  let anchorLow = pwl;

  let currentStage: WeeklyAnchorStage = 'LOCKED_RANGE';
  let breakDirection: 'BULLISH' | 'BEARISH' | null = null;
  let breakBarIndex: number | null = null;
  let breakPrice: number | null = null;
  let retested = false;
  let retestCount = 0;
  let retestType: 'SUPPORT_RETEST' | 'RESISTANCE_RETEST' | null = null;
  let retestPrice: number | null = null;

  let confirmedHigh = pwh;
  let confirmedLow = pwl;

  // Touch tolerance for clean retests (0.3% of anchor range)
  const tol = pRange * 0.0035;

  let consecutiveOutsideBars = 0;
  let newPotentialPeak = anchorHigh;
  let newPotentialTrough = anchorLow;

  // Scan current active week's candles bar-by-bar
  for (let i = activeWeekStartIndex; i < n; i++) {
    const c = candles[i];
    const prevC = i > 0 ? candles[i - 1] : c;

    // --- BULLISH BREAKOUT TRACKING ---
    if (breakDirection === null && c.close > anchorHigh) {
      // Step 1: Breakout occurred!
      currentStage = 'BREAKOUT_PENDING';
      breakDirection = 'BULLISH';
      breakBarIndex = i;
      breakPrice = anchorHigh;
      consecutiveOutsideBars = 1;
      newPotentialPeak = c.high;
      // CRITICAL RULE: anchorHigh DOES NOT JUMP. It remains locked at PWH!
      continue;
    }

    // --- BEARISH BREAKDOWN TRACKING ---
    if (breakDirection === null && c.close < anchorLow) {
      // Step 1: Breakdown occurred!
      currentStage = 'BREAKOUT_PENDING';
      breakDirection = 'BEARISH';
      breakBarIndex = i;
      breakPrice = anchorLow;
      consecutiveOutsideBars = 1;
      newPotentialTrough = c.low;
      // CRITICAL RULE: anchorLow DOES NOT JUMP. It remains locked at PWL!
      continue;
    }

    // If currently evaluating a Bullish Breakout
    if (breakDirection === 'BULLISH') {
      if (c.high > newPotentialPeak) {
        newPotentialPeak = c.high;
      }

      // Check for Rejection / Fakeout (Sweep): closed back inside below anchorHigh
      if (c.close < anchorHigh - tol * 0.5) {
        currentStage = 'SWEEP_REJECTED';
        // Market rejected the breakout and returned inside the weekly range
        breakDirection = null; // Reset back to range oscillation
        consecutiveOutsideBars = 0;
        continue;
      }

      // Check for Retest: price dips into anchorHigh and holds/bounces
      const touchesBrokenLevel = c.low <= anchorHigh + tol && c.high >= anchorHigh - tol;
      if (touchesBrokenLevel && c.close >= anchorHigh - tol * 0.5) {
        currentStage = 'RETEST_ACTIVE';
        retested = true;
        retestCount++;
        retestType = 'SUPPORT_RETEST';
        retestPrice = anchorHigh;
      } else if (c.close > anchorHigh) {
        consecutiveOutsideBars++;
        if (currentStage !== 'RETEST_ACTIVE') {
          currentStage = consecutiveOutsideBars >= 2 ? 'HOLDING_BREAK' : 'BREAKOUT_PENDING';
        }
      }

      // Step 4: Confirmation & Update
      // Only when price has held outside for 6+ bars AND confirmed a new swing high with a pullback
      if (consecutiveOutsideBars >= 6 && i >= (breakBarIndex ?? 0) + 4) {
        const pullbackCheck = c.close < newPotentialPeak - pRange * 0.05;
        if (pullbackCheck) {
          currentStage = 'CONFIRMED_UPDATE';
          confirmedHigh = newPotentialPeak;
          // Note: anchorHigh remains locked at pwh so user can always see the original breakout level,
          // but confirmedHigh records the updated structural top.
        }
      }
    }

    // If currently evaluating a Bearish Breakdown
    if (breakDirection === 'BEARISH') {
      if (c.low < newPotentialTrough) {
        newPotentialTrough = c.low;
      }

      // Check for Rejection / Fakeout (Sweep): closed back inside above anchorLow
      if (c.close > anchorLow + tol * 0.5) {
        currentStage = 'SWEEP_REJECTED';
        breakDirection = null;
        consecutiveOutsideBars = 0;
        continue;
      }

      // Check for Retest: price rallies into anchorLow and holds/rejects
      const touchesBrokenLevel = c.high >= anchorLow - tol && c.low <= anchorLow + tol;
      if (touchesBrokenLevel && c.close <= anchorLow + tol * 0.5) {
        currentStage = 'RETEST_ACTIVE';
        retested = true;
        retestCount++;
        retestType = 'RESISTANCE_RETEST';
        retestPrice = anchorLow;
      } else if (c.close < anchorLow) {
        consecutiveOutsideBars++;
        if (currentStage !== 'RETEST_ACTIVE') {
          currentStage = consecutiveOutsideBars >= 2 ? 'HOLDING_BREAK' : 'BREAKOUT_PENDING';
        }
      }

      // Step 4: Confirmation & Update
      if (consecutiveOutsideBars >= 6 && i >= (breakBarIndex ?? 0) + 4) {
        const bounceCheck = c.close > newPotentialTrough + pRange * 0.05;
        if (bounceCheck) {
          currentStage = 'CONFIRMED_UPDATE';
          confirmedLow = newPotentialTrough;
        }
      }
    }
  }

  // Generate clean stage titles and descriptions in Amharic & English
  let stageTitle = 'Locked Weekly Range';
  let stageDescription = 'ዋጋው በሳምንታዊው High እና Low ክልል ውስጥ እየተወዛወዘ ነው። መስመሮች ተቆልፈዋል።';

  switch (currentStage) {
    case 'BREAKOUT_PENDING':
      stageTitle = breakDirection === 'BULLISH' ? '⚡ PWH Breakout (Holding)' : '⚡ PWL Breakdown (Holding)';
      stageDescription = breakDirection === 'BULLISH'
        ? 'ዋጋው የሳምንቱን PWH ጥሶ ወጥቷል። መስመሩ አልሮጠም፤ Hold/Retest እየተጠበቀ ነው።'
        : 'ዋጋው የሳምንቱን PWL ጥሶ ወርዷል። መስመሩ አልሮጠም፤ Hold/Retest እየተጠበቀ ነው።';
      break;
    case 'HOLDING_BREAK':
      stageTitle = breakDirection === 'BULLISH' ? 'Holding Above PWH' : 'Holding Below PWL';
      stageDescription = 'ዋጋው ከተሰበረው የሳምንት ጣሪያ በላይ ፀንቶ ቆይቷል፤ Retest ይጠበቃል።';
      break;
    case 'SWEEP_REJECTED':
      stageTitle = '🛡️ Liquidity Sweep (Fakeout Rejected)';
      stageDescription = 'የውሸት መሰበር (Fakeout) ተመልሶ ወደ ሳምንታዊው ክልል ገብቷል። Rejection Sweep!';
      break;
    case 'RETEST_ACTIVE':
      stageTitle = retestType === 'SUPPORT_RETEST' ? '🎯 PWH Retest (Support Bounce)' : '🎯 PWL Retest (Resistance Bounce)';
      stageDescription = retestType === 'SUPPORT_RETEST'
        ? 'የተሰበረው PWH አሁን እንደ Support እየተፈተሸ ነው (A+ Retest Confirmation)! BUY Setup.'
        : 'የተሰበረው PWL አሁን እንደ Resistance እየተፈተሸ ነው (A+ Retest Confirmation)! SELL Setup.';
      break;
    case 'CONFIRMED_UPDATE':
      stageTitle = '✅ Confirmed Trend Extension';
      stageDescription = 'አዲሱ አዝማሚያ ተረጋግጧል፤ አዲሱ መዋቅር ፀንቷል።';
      break;
    default:
      stageTitle = 'Locked Weekly Range';
      stageDescription = 'ዋጋው በሳምንታዊው High እና Low ክልል ውስጥ እየተወዛወዘ ነው። መስመሮች ተቆልፈዋል።';
      break;
  }

  return {
    pwh,
    pwl,
    pwm,
    goldenTop,
    goldenBottom,
    anchorHigh,
    anchorLow,
    currentStage,
    stageTitle,
    stageDescription,
    breakDirection,
    breakBarIndex,
    breakPrice,
    retested,
    retestCount,
    retestType,
    retestPrice,
    confirmedHigh,
    confirmedLow,
    activeWeekStartIndex,
    totalWeeksDetected,
  };
}
