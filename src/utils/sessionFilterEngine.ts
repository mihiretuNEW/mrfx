/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, ChartSettings } from '../types';

export interface SessionFilterInterval {
  id: string;
  name: 'Asia' | 'London' | 'New York';
  fullName: string;
  shortName: string;
  startIndex: number;
  endIndex: number | null; // null if session is currently active/ongoing
  startTimeMs: number;
  endTimeMs: number;
  isActive: boolean;
  color: string;
}

interface InternalSessionDef {
  name: 'Asia' | 'London' | 'New York';
  fullName: string;
  shortName: string;
  startHourUtc: number;
  startMinUtc: number;
  endHourUtc: number;
  endMinUtc: number;
  defaultColor: string;
  enabledKey: keyof ChartSettings['indicators'];
}

const SESSION_DEFINITIONS: InternalSessionDef[] = [
  {
    name: 'Asia',
    fullName: 'Asian Session (Tokyo / Sydney)',
    shortName: 'ASIA',
    startHourUtc: 0,
    startMinUtc: 0,
    endHourUtc: 8,
    endMinUtc: 0,
    defaultColor: '#38bdf8', // Soft sky blue
    enabledKey: 'sessionFilterShowAsia',
  },
  {
    name: 'London',
    fullName: 'London Session',
    shortName: 'LONDON',
    startHourUtc: 7,
    startMinUtc: 0,
    endHourUtc: 16,
    endMinUtc: 0,
    defaultColor: '#fbbf24', // Soft amber/gold
    enabledKey: 'sessionFilterShowLondon',
  },
  {
    name: 'New York',
    fullName: 'New York Session',
    shortName: 'NEW YORK',
    startHourUtc: 13,
    startMinUtc: 0,
    endHourUtc: 21,
    endMinUtc: 0,
    defaultColor: '#34d399', // Soft emerald/mint
    enabledKey: 'sessionFilterShowNewYork',
  },
];

/**
 * Calculates historical and active session intervals based on candle timestamps.
 * - For past sessions: both start and end candle indices are determined.
 * - For currently active session: start candle is identified, and endIndex is null.
 * - Completely zero-noise algorithm operating in O(N).
 */
export function calculateSessionFilter(
  candles: Candle[],
  indicatorSettings: ChartSettings['indicators']
): SessionFilterInterval[] {
  if (!candles || candles.length === 0) return [];

  const getTimeMs = (time: number): number => (time < 1e11 ? time * 1000 : time);
  const n = candles.length;
  const lastCandleTimeMs = getTimeMs(candles[n - 1].time);

  // Filter which sessions the user has enabled (default true)
  const activeDefs = SESSION_DEFINITIONS.filter((def) => {
    const isEnabled = indicatorSettings[def.enabledKey];
    return isEnabled === undefined ? true : Boolean(isEnabled);
  });

  if (activeDefs.length === 0) return [];

  // 1. Collect unique UTC day start timestamps (midnight UTC) from candles
  const dayStartList: number[] = [];
  let prevDayMidnight = -1;

  for (let i = 0; i < n; i++) {
    const t = getTimeMs(candles[i].time);
    const dayMidnight = Math.floor(t / 86400000) * 86400000;
    if (dayMidnight !== prevDayMidnight) {
      dayStartList.push(dayMidnight);
      prevDayMidnight = dayMidnight;
    }
  }

  // Pre-extract timestamps for fast binary/linear lookups
  const candleTimes = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    candleTimes[i] = getTimeMs(candles[i].time);
  }

  const intervals: SessionFilterInterval[] = [];
  const customColors = indicatorSettings.sessionFilterCustomColors ?? true;
  const uniformColor = indicatorSettings.sessionFilterLineColor ?? '#94a3b8';

  // 2. For each day and each enabled session definition:
  for (const dayMidnight of dayStartList) {
    for (const def of activeDefs) {
      const startMs = dayMidnight + def.startHourUtc * 3600000 + def.startMinUtc * 60000;
      const endMs = dayMidnight + def.endHourUtc * 3600000 + def.endMinUtc * 60000;

      // Find first candle index >= startMs
      let startIdx = -1;
      let left = 0;
      let right = n - 1;
      while (left <= right) {
        const mid = (left + right) >> 1;
        if (candleTimes[mid] >= startMs) {
          startIdx = mid;
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }

      // If no candle reached startMs, or the first candle is already >= endMs, skip (no candles inside this session)
      if (startIdx === -1 || candleTimes[startIdx] >= endMs) {
        continue;
      }

      // Determine if session has finished or is still actively running
      let endIdx: number | null = null;
      let isActive = false;

      if (lastCandleTimeMs < endMs) {
        // Session is currently ACTIVE (ongoing)
        // As requested: active session has a start line, but end line is not placed because it hasn't ended yet
        isActive = true;
        endIdx = null;
      } else {
        // Session is completed in the past. Find first candle >= endMs
        left = startIdx;
        right = n - 1;
        let foundEnd = -1;
        while (left <= right) {
          const mid = (left + right) >> 1;
          if (candleTimes[mid] >= endMs) {
            foundEnd = mid;
            right = mid - 1;
          } else {
            left = mid + 1;
          }
        }

        if (foundEnd !== -1) {
          endIdx = foundEnd;
        } else {
          endIdx = n - 1;
        }

        // Avoid degenerate single-point overlap if there's room
        if (endIdx <= startIdx && startIdx + 1 < n) {
          endIdx = startIdx + 1;
        }
      }

      intervals.push({
        id: `${def.name}-${startMs}`,
        name: def.name,
        fullName: def.fullName,
        shortName: def.shortName,
        startIndex: startIdx,
        endIndex: endIdx,
        startTimeMs: startMs,
        endTimeMs: endMs,
        isActive,
        color: customColors ? def.defaultColor : uniformColor,
      });
    }
  }

  // Sort intervals chronologically by start index
  intervals.sort((a, b) => a.startIndex - b.startIndex);

  return intervals;
}
