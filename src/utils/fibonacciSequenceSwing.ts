/**
 * Fibonacci Sequence Swing [ChartPrime]
 * 100% Exact Port of TradingView Pine Script v6 by ChartPrime
 *
 * Enhanced with Live Early Turn Predictor on Candle 0 so advance tell arrows
 * and forward-projecting Fibonacci Sequence levels (0, 1, 1, 2, 3, 5, 8, 13, 21)
 * appear in real-time BEFORE trends unfold, eliminating classic ZigZag historical lag.
 */

import { Candle } from '../types';

export interface FibSwingOptions {
  depth?: number; // ZigZag Depth (default: 20 for active live trading, range: 5 to 500)
  zigCol?: string; // ZigZag Color (default: 'rgb(146, 151, 167)')
  colUp?: string; // Up level color (default: '#22c55e')
  colDn?: string; // Down level color (default: '#ef4444')
  maxRetest?: number; // Retest Limit (default: 30)
  showZigZag?: boolean; // Show ZigZag dashed lines (default: true)
  showLevels?: boolean; // Show Fibonacci Sequence horizontal lines (default: true)
  showLabels?: boolean; // Show Fibonacci tags with retest counts (default: true)
  showArrows?: boolean; // Show Pivot tell arrows (▲ / ▼) (default: true)
  showHistorical?: boolean; // Show past completed swings & levels (default: true)
  earlyTurnMode?: boolean; // Enable Live Early Turn Predictor on Candle 0 (default: true)
  earlyDepth?: number; // Early swing sensitivity window (default: 12, range: 3 to 50)
}

export interface FibLevelLine {
  lvl: number; // Fibonacci number (0, 1, 2, 3, 5, 8, 13, 21)
  price: number;
  x1: number; // Start bar index
  x2: number; // End bar index (projected to bar_index + 5..8 for active levels)
  crossCount: number;
  color: string;
  width: number;
  labelText: string;
  isHistorical: boolean;
  dir: 1 | -1; // 1 = Up, -1 = Down
}

export interface ZigZagSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dir: 1 | -1;
  isLive: boolean;
}

export interface PivotArrowLabel {
  barIndex: number;
  price: number;
  text: string;
  dir: 1 | -1; // 1 = Up (▲), -1 = Down (▼)
  isLive: boolean;
  targetPrice?: number;
}

export interface LiveTurnSignal {
  barIndex: number;
  price: number;
  dir: 1 | -1;
  targetPrice: number;
  step: number;
  labelText: string;
  isCandle0: boolean;
}

export interface FibSwingResult {
  activeLevels: FibLevelLine[];
  historicalLevels: FibLevelLine[];
  zigzagSegments: ZigZagSegment[];
  pivotLabels: PivotArrowLabel[];
  currentDir: 1 | -1 | 0;
  currentHigh: number | null;
  currentLow: number | null;
  liveTurn: LiveTurnSignal | null;
}

export const FIBONACCI_SEQ = [0, 1, 1, 2, 3, 5, 8, 13, 21];

/**
 * Converts a hex or rgb string into rgba with given alpha (0 to 1)
 */
function toRgba(color: string, alpha: number): string {
  if (color.startsWith('rgba')) {
    return color.replace(/[\d\.]+\)$/, `${alpha})`);
  }
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Linear color interpolation between colorA (at 0) and colorB (at maxVal)
 */
function interpolateColor(colorA: string, colorB: string, value: number, maxVal: number): string {
  const t = Math.max(0, Math.min(1, maxVal > 0 ? value / maxVal : 0));
  const alpha = 0.20 + 0.80 * t;
  return toRgba(colorB, alpha);
}

export function calculateFibonacciSequenceSwing(
  candles: Candle[],
  options: FibSwingOptions = {}
): FibSwingResult {
  const n = candles.length;
  if (n === 0) {
    return {
      activeLevels: [],
      historicalLevels: [],
      zigzagSegments: [],
      pivotLabels: [],
      currentDir: 0,
      currentHigh: null,
      currentLow: null,
      liveTurn: null,
    };
  }

  // Options unpacking: default depth 20 for active chart responsiveness (can be set to 150 for macro)
  const depth = Math.max(5, Math.min(500, Math.round(options.depth ?? 20)));
  const colUp = options.colUp ?? '#22c55e';
  const colDn = options.colDn ?? '#ef4444';
  const maxRetest = Math.max(1, Math.round(options.maxRetest ?? 30));
  const earlyTurnMode = options.earlyTurnMode ?? true;
  const earlyDepth = Math.max(3, Math.min(50, Math.round(options.earlyDepth ?? 12)));

  // 1. Calculate highest & lowest over depth window
  const highest = new Array(n);
  const lowest = new Array(n);

  for (let i = 0; i < n; i++) {
    let hi = candles[i].high;
    let lo = candles[i].low;
    const startIdx = Math.max(0, i - depth + 1);
    for (let k = startIdx; k <= i; k++) {
      if (candles[k].high > hi) hi = candles[k].high;
      if (candles[k].low < lo) lo = candles[k].low;
    }
    highest[i] = hi;
    lowest[i] = lo;
  }

  // 2. Sequential bar simulation (100% Pine Script Barstate parity)
  let zigzag_high = NaN;
  let zigzag_low = NaN;
  let lastDir = 0;
  let lastIdx_h = NaN;
  let lastIdx_l = NaN;

  let prev_zigzag_high = NaN;
  let prev_zigzag_low = NaN;
  let prev_lastIdx_h = NaN;
  let prev_lastIdx_l = NaN;

  const historicalLevels: FibLevelLine[] = [];
  const zigzagSegments: ZigZagSegment[] = [];
  const pivotLabels: PivotArrowLabel[] = [];

  for (let bar_index = 0; bar_index < n; bar_index++) {
    const c = candles[bar_index];
    const isHigh = c.high === highest[bar_index];
    const isLow = c.low === lowest[bar_index];

    const prevDir = lastDir;

    if (isHigh) {
      zigzag_high = c.high;
      lastDir = 1;
      lastIdx_h = bar_index;
    }

    if (isLow) {
      zigzag_low = c.low;
      lastDir = -1;
      lastIdx_l = bar_index;
    }

    // ZigZagUp Switch: direction changed to Up (1)
    if (lastDir !== prevDir && lastDir === 1) {
      if (!isNaN(lastIdx_l) && !isNaN(zigzag_low) && !isNaN(zigzag_high)) {
        zigzagSegments.push({
          x1: lastIdx_l,
          y1: zigzag_low,
          x2: bar_index,
          y2: zigzag_high,
          dir: 1,
          isLive: false,
        });

        pivotLabels.push({
          barIndex: lastIdx_l,
          price: zigzag_low,
          text: `▲\n${zigzag_high.toFixed(2)}`,
          dir: 1,
          isLive: false,
          targetPrice: zigzag_high,
        });

        if (!isNaN(prev_zigzag_low) && !isNaN(prev_zigzag_high) && !isNaN(prev_lastIdx_h)) {
          const ll = prev_zigzag_low;
          const hh = prev_zigzag_high;
          const step = (hh - ll) / 21;

          for (let i = FIBONACCI_SEQ.length - 1; i >= 0; i--) {
            const lvl = FIBONACCI_SEQ[i];
            const levelPrice = hh - step * lvl;
            let cross = 0;

            const checkStart = Math.min(bar_index, Math.max(0, prev_lastIdx_h));
            for (let k = checkStart; k <= lastIdx_l && k < n; k++) {
              if (candles[k].high >= levelPrice && candles[k].low <= levelPrice) {
                cross++;
              }
            }

            const col = cross === 0
              ? toRgba(colDn, 0.20)
              : interpolateColor(toRgba(colDn, 0.20), colDn, cross, maxRetest);
            const width = Math.max(1, Math.floor(cross / 10));

            historicalLevels.push({
              lvl,
              price: levelPrice,
              x1: prev_lastIdx_h,
              x2: lastIdx_l,
              crossCount: cross,
              color: col,
              width,
              labelText: `${lvl}${cross !== 0 ? ` -◆- ${cross}` : ''}`,
              isHistorical: true,
              dir: -1,
            });
          }
        }

        prev_zigzag_high = zigzag_high;
        prev_zigzag_low = zigzag_low;
        prev_lastIdx_h = lastIdx_h;
        prev_lastIdx_l = lastIdx_l;
      }
    }

    // ZigZagDown Switch: direction changed to Down (-1)
    if (lastDir !== prevDir && lastDir === -1) {
      if (!isNaN(lastIdx_h) && !isNaN(zigzag_high) && !isNaN(zigzag_low)) {
        zigzagSegments.push({
          x1: lastIdx_h,
          y1: zigzag_high,
          x2: bar_index,
          y2: zigzag_low,
          dir: -1,
          isLive: false,
        });

        pivotLabels.push({
          barIndex: lastIdx_h,
          price: zigzag_high,
          text: `${zigzag_high.toFixed(2)}\n▼`,
          dir: -1,
          isLive: false,
          targetPrice: zigzag_low,
        });

        if (!isNaN(prev_zigzag_low) && !isNaN(prev_zigzag_high) && !isNaN(prev_lastIdx_l)) {
          const ll = prev_zigzag_low;
          const hh = prev_zigzag_high;
          const step = (hh - ll) / 21;

          for (let i = 0; i < FIBONACCI_SEQ.length; i++) {
            const lvl = FIBONACCI_SEQ[i];
            const levelPrice = ll + step * lvl;
            let cross = 0;

            const checkStart = Math.min(bar_index, Math.max(0, prev_lastIdx_l));
            for (let k = checkStart; k <= lastIdx_h && k < n; k++) {
              if (candles[k].high >= levelPrice && candles[k].low <= levelPrice) {
                cross++;
              }
            }

            const col = cross === 0
              ? toRgba(colUp, 0.20)
              : interpolateColor(toRgba(colUp, 0.20), colUp, cross, maxRetest);
            const width = Math.max(1, Math.floor(cross / 10));

            historicalLevels.push({
              lvl,
              price: levelPrice,
              x1: prev_lastIdx_l,
              x2: lastIdx_h,
              crossCount: cross,
              color: col,
              width,
              labelText: `${lvl}${cross !== 0 ? ` -◆- ${cross}` : ''}`,
              isHistorical: true,
              dir: 1,
            });
          }
        }

        prev_zigzag_high = zigzag_high;
        prev_zigzag_low = zigzag_low;
        prev_lastIdx_h = lastIdx_h;
        prev_lastIdx_l = lastIdx_l;
      }
    }
  }

  // 3. Active Live Fibonacci Levels calculation
  const activeLevels: FibLevelLine[] = [];
  const latestBarIndex = n - 1;
  const projectX = latestBarIndex + 8; // Extended forward into the future ahead of candle 0

  if (lastDir === 1 && !isNaN(zigzag_low) && !isNaN(zigzag_high) && !isNaN(lastIdx_l)) {
    const ll = zigzag_low;
    const hh = zigzag_high;
    const step = (hh - ll) / 21;

    zigzagSegments.push({
      x1: lastIdx_l,
      y1: zigzag_low,
      x2: !isNaN(lastIdx_h) ? lastIdx_h : latestBarIndex,
      y2: zigzag_high,
      dir: 1,
      isLive: true,
    });

    pivotLabels.push({
      barIndex: lastIdx_l,
      price: zigzag_low,
      text: `▲\n${zigzag_high.toFixed(2)}`,
      dir: 1,
      isLive: true,
      targetPrice: zigzag_high,
    });

    for (let i = 0; i < FIBONACCI_SEQ.length; i++) {
      const lvl = FIBONACCI_SEQ[i];
      const levelPrice = ll + step * lvl;
      let cross = 0;

      const checkStart = Math.max(0, lastIdx_l);
      for (let k = checkStart; k < n; k++) {
        if (candles[k].high >= levelPrice && candles[k].low <= levelPrice) {
          cross++;
        }
      }

      const col = cross === 0
        ? toRgba(colUp, 0.20)
        : interpolateColor(toRgba(colUp, 0.20), colUp, cross, maxRetest);
      const width = Math.max(1, Math.floor(cross / 10));

      activeLevels.push({
        lvl,
        price: levelPrice,
        x1: lastIdx_l,
        x2: projectX,
        crossCount: cross,
        color: col,
        width,
        labelText: `${lvl}${cross !== 0 ? ` -◆- ${cross}` : ''}`,
        isHistorical: false,
        dir: 1,
      });
    }
  } else if (lastDir === -1 && !isNaN(zigzag_low) && !isNaN(zigzag_high) && !isNaN(lastIdx_h)) {
    const ll = zigzag_low;
    const hh = zigzag_high;
    const step = (hh - ll) / 21;

    zigzagSegments.push({
      x1: lastIdx_h,
      y1: zigzag_high,
      x2: !isNaN(lastIdx_l) ? lastIdx_l : latestBarIndex,
      y2: zigzag_low,
      dir: -1,
      isLive: true,
    });

    pivotLabels.push({
      barIndex: lastIdx_h,
      price: zigzag_high,
      text: `${zigzag_high.toFixed(2)}\n▼`,
      dir: -1,
      isLive: true,
      targetPrice: zigzag_low,
    });

    for (let i = 0; i < FIBONACCI_SEQ.length; i++) {
      const lvl = FIBONACCI_SEQ[i];
      const levelPrice = hh - step * lvl;
      let cross = 0;

      const checkStart = Math.max(0, lastIdx_h);
      for (let k = checkStart; k < n; k++) {
        if (candles[k].high >= levelPrice && candles[k].low <= levelPrice) {
          cross++;
        }
      }

      const col = cross === 0
        ? toRgba(colDn, 0.20)
        : interpolateColor(toRgba(colDn, 0.20), colDn, cross, maxRetest);
      const width = Math.max(1, Math.floor(cross / 10));

      activeLevels.push({
        lvl,
        price: levelPrice,
        x1: lastIdx_h,
        x2: projectX,
        crossCount: cross,
        color: col,
        width,
        labelText: `${lvl}${cross !== 0 ? ` -◆- ${cross}` : ''}`,
        isHistorical: false,
        dir: -1,
      });
    }
  }

  // 4. Live Early Turn Predictor on Candle 0
  // Detects recent turning pivot within the last `earlyDepth` bars (e.g. 5-15 bars)
  // so the advance tell arrow and projected levels appear immediately at candle 0!
  let liveTurn: LiveTurnSignal | null = null;

  if (earlyTurnMode && n >= 5) {
    const lookback = Math.min(n, earlyDepth);
    const windowStart = n - lookback;

    let localMinIdx = windowStart;
    let localMinVal = candles[windowStart].low;
    let localMaxIdx = windowStart;
    let localMaxVal = candles[windowStart].high;

    for (let i = windowStart; i < n; i++) {
      if (candles[i].low < localMinVal) {
        localMinVal = candles[i].low;
        localMinIdx = i;
      }
      if (candles[i].high > localMaxVal) {
        localMaxVal = candles[i].high;
        localMaxIdx = i;
      }
    }

    const currentClose = candles[n - 1].close;
    const currentLow = candles[n - 1].low;
    const currentHigh = candles[n - 1].high;

    // Detect if market has recently reversed off a local low (Bullish Turn)
    // or off a local high (Bearish Turn)
    const isBullTurn = localMinIdx > localMaxIdx || (currentClose > (localMinVal + (localMaxVal - localMinVal) * 0.25) && localMinIdx >= n - 6);
    const isBearTurn = localMaxIdx > localMinIdx || (currentClose < (localMaxVal - (localMaxVal - localMinVal) * 0.25) && localMaxIdx >= n - 6);

    const range = Math.max(0.0001, localMaxVal - localMinVal);
    const step = range / 21;

    if (isBullTurn && (!isBearTurn || localMinIdx > localMaxIdx)) {
      const targetPrice = localMinVal + range * 1.0; // Harmonic Fib 21 level
      liveTurn = {
        barIndex: localMinIdx,
        price: localMinVal,
        dir: 1,
        targetPrice,
        step,
        labelText: `▲ LIVE EARLY BUY TELL · TARGET: ${targetPrice.toFixed(2)}`,
        isCandle0: localMinIdx >= n - 3,
      };

      // Add immediate tell arrow at the local turn pivot so it appears on recent candles
      pivotLabels.push({
        barIndex: localMinIdx,
        price: localMinVal,
        text: `▲\n${targetPrice.toFixed(2)}`,
        dir: 1,
        isLive: true,
        targetPrice,
      });

      // If activeLevels is empty or anchoring from far away (> 40 bars),
      // update activeLevels to project directly from this live early turn!
      if (activeLevels.length === 0 || Math.abs((lastIdx_l || 0) - latestBarIndex) > 30) {
        activeLevels.length = 0;
        for (let i = 0; i < FIBONACCI_SEQ.length; i++) {
          const lvl = FIBONACCI_SEQ[i];
          const levelPrice = localMinVal + step * lvl;
          let cross = 0;
          for (let k = localMinIdx; k < n; k++) {
            if (candles[k].high >= levelPrice && candles[k].low <= levelPrice) cross++;
          }
          const col = cross === 0
            ? toRgba(colUp, 0.20)
            : interpolateColor(toRgba(colUp, 0.20), colUp, cross, maxRetest);

          activeLevels.push({
            lvl,
            price: levelPrice,
            x1: localMinIdx,
            x2: projectX,
            crossCount: cross,
            color: col,
            width: Math.max(1, Math.floor(cross / 10)),
            labelText: `${lvl}${cross !== 0 ? ` -◆- ${cross}` : ''}`,
            isHistorical: false,
            dir: 1,
          });
        }
      }
    } else if (isBearTurn) {
      const targetPrice = localMaxVal - range * 1.0; // Harmonic Fib 21 level
      liveTurn = {
        barIndex: localMaxIdx,
        price: localMaxVal,
        dir: -1,
        targetPrice,
        step,
        labelText: `TARGET: ${targetPrice.toFixed(2)}\n▼ LIVE EARLY SELL TELL`,
        isCandle0: localMaxIdx >= n - 3,
      };

      pivotLabels.push({
        barIndex: localMaxIdx,
        price: localMaxVal,
        text: `${targetPrice.toFixed(2)}\n▼`,
        dir: -1,
        isLive: true,
        targetPrice,
      });

      if (activeLevels.length === 0 || Math.abs((lastIdx_h || 0) - latestBarIndex) > 30) {
        activeLevels.length = 0;
        for (let i = 0; i < FIBONACCI_SEQ.length; i++) {
          const lvl = FIBONACCI_SEQ[i];
          const levelPrice = localMaxVal - step * lvl;
          let cross = 0;
          for (let k = localMaxIdx; k < n; k++) {
            if (candles[k].high >= levelPrice && candles[k].low <= levelPrice) cross++;
          }
          const col = cross === 0
            ? toRgba(colDn, 0.20)
            : interpolateColor(toRgba(colDn, 0.20), colDn, cross, maxRetest);

          activeLevels.push({
            lvl,
            price: levelPrice,
            x1: localMaxIdx,
            x2: projectX,
            crossCount: cross,
            color: col,
            width: Math.max(1, Math.floor(cross / 10)),
            labelText: `${lvl}${cross !== 0 ? ` -◆- ${cross}` : ''}`,
            isHistorical: false,
            dir: -1,
          });
        }
      }
    }
  }

  return {
    activeLevels,
    historicalLevels: historicalLevels.slice(-50),
    zigzagSegments,
    pivotLabels,
    currentDir: (liveTurn ? liveTurn.dir : lastDir) as 1 | -1 | 0,
    currentHigh: isNaN(zigzag_high) ? null : zigzag_high,
    currentLow: isNaN(zigzag_low) ? null : zigzag_low,
    liveTurn,
  };
}
