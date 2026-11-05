import fs from 'fs';
import path from 'path';
import { loadAlertConfig, sendTelegramDirect } from './cloudAlertConfig.js';

export const EA_STATE_FILE = path.join('/tmp', 'mcharts_ea_state.json');

export interface EASignal {
  id: string; // e.g. "SIG_R_75_30M_1730721600_bull"
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price?: number;
  tp3Price?: number;
  slPips: number;
  tp1Pips: number;
  tp2Pips?: number;
  tp3Pips?: number;
  lotSize: number;
  createdAt: number;
  status: 'PENDING' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';
  ticket?: number;
  executionPrice?: number;
  executedAt?: number;
  closedAt?: number;
  exitPrice?: number;
  exitReason?: string;
  profit?: number;
  isWin?: boolean;
}

export interface EAState {
  autoBotEnabled: boolean;
  maxConsecutiveLosses: number;
  lotSize: number;
  magicNumber: number;
  pendingSignal: EASignal | null;
  activeTrade: EASignal | null;
  executedSignalIds: string[];
  signalHistory: EASignal[];
  consecutiveLossesToday: number;
  lastLossDate: string; // 'YYYY-MM-DD' UTC
  circuitBreakerTripped: boolean;
  circuitBreakerDate: string;
  lastEaPingTime: number;
  lastEaTicket?: number;
  lastUpdated: number;
}

function getTodayUtcString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

const DEFAULT_EA_STATE: EAState = {
  autoBotEnabled: true,
  maxConsecutiveLosses: 2,
  lotSize: 0.001,
  magicNumber: 757575,
  pendingSignal: null,
  activeTrade: null,
  executedSignalIds: [],
  signalHistory: [],
  consecutiveLossesToday: 0,
  lastLossDate: getTodayUtcString(),
  circuitBreakerTripped: false,
  circuitBreakerDate: '',
  lastEaPingTime: 0,
  lastUpdated: Date.now(),
};

// In-memory cache for ultra-fast <5ms EA polling response
let memoryState: EAState | null = null;

export function loadEAState(): EAState {
  if (memoryState) {
    checkDayRollover(memoryState);
    return memoryState;
  }

  try {
    if (fs.existsSync(EA_STATE_FILE)) {
      const raw = fs.readFileSync(EA_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryState = {
        ...DEFAULT_EA_STATE,
        ...parsed,
        executedSignalIds: Array.isArray(parsed.executedSignalIds) ? parsed.executedSignalIds : [],
        signalHistory: Array.isArray(parsed.signalHistory) ? parsed.signalHistory : [],
      };
      checkDayRollover(memoryState);
      return memoryState;
    }
  } catch (err) {
    console.warn('Failed to load EA state from disk, using defaults:', err);
  }

  memoryState = { ...DEFAULT_EA_STATE };
  return memoryState;
}

function checkDayRollover(state: EAState) {
  const today = getTodayUtcString();
  if (state.lastLossDate !== today) {
    // New trading day: reset daily loss counter and circuit breaker!
    state.consecutiveLossesToday = 0;
    state.lastLossDate = today;
    state.circuitBreakerTripped = false;
    state.circuitBreakerDate = '';
    saveEAState(state);
  }
}

export function saveEAState(state: EAState): EAState {
  state.lastUpdated = Date.now();
  memoryState = state;
  try {
    fs.writeFileSync(EA_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save EA state to disk:', err);
  }
  return state;
}

export function updateEASettings(updates: Partial<Pick<EAState, 'autoBotEnabled' | 'maxConsecutiveLosses' | 'lotSize' | 'magicNumber'>>): EAState {
  const state = loadEAState();
  if (updates.autoBotEnabled !== undefined) state.autoBotEnabled = updates.autoBotEnabled;
  if (updates.maxConsecutiveLosses !== undefined) state.maxConsecutiveLosses = updates.maxConsecutiveLosses;
  if (updates.lotSize !== undefined) state.lotSize = updates.lotSize;
  if (updates.magicNumber !== undefined) state.magicNumber = updates.magicNumber;

  // If user re-enables bot manually, reset tripped circuit breaker
  if (updates.autoBotEnabled === true && state.circuitBreakerTripped) {
    state.circuitBreakerTripped = false;
    state.consecutiveLossesToday = 0;
  }

  return saveEAState(state);
}

export function queueNewSignalForEA(signal: {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price?: number;
  tp3Price?: number;
  slPips: number;
  tp1Pips: number;
  tp2Pips?: number;
  tp3Pips?: number;
  lotSize?: number;
}): { queued: boolean; reason?: string } {
  const state = loadEAState();

  if (!state.autoBotEnabled) {
    return { queued: false, reason: 'Auto trading is paused by user' };
  }

  if (state.circuitBreakerTripped) {
    return { queued: false, reason: 'Circuit breaker active: Daily consecutive loss limit reached' };
  }

  // Idempotency: check if already executed or already pending
  if (state.executedSignalIds.includes(signal.id)) {
    return { queued: false, reason: 'Signal already executed' };
  }

  if (state.pendingSignal && state.pendingSignal.id === signal.id) {
    return { queued: false, reason: 'Signal already in pending queue' };
  }

  const eaSignal: EASignal = {
    id: signal.id,
    symbol: signal.symbol,
    type: signal.type,
    entryPrice: signal.entryPrice,
    slPrice: signal.slPrice,
    tp1Price: signal.tp1Price,
    tp2Price: signal.tp2Price,
    tp3Price: signal.tp3Price,
    slPips: signal.slPips,
    tp1Pips: signal.tp1Pips,
    tp2Pips: signal.tp2Pips,
    tp3Pips: signal.tp3Pips,
    lotSize: signal.lotSize || state.lotSize || 0.001,
    createdAt: Date.now(),
    status: 'PENDING',
  };

  state.pendingSignal = eaSignal;
  saveEAState(state);

  return { queued: true };
}

export function acknowledgeSignalExecution(params: {
  signalId: string;
  ticket: number;
  executionPrice?: number;
}): { ok: boolean; message: string; signal?: EASignal } {
  const state = loadEAState();

  let signal = state.pendingSignal?.id === params.signalId ? state.pendingSignal : null;
  if (!signal && state.activeTrade?.id === params.signalId) {
    signal = state.activeTrade;
  }

  if (!signal) {
    // If not found in memory, create record from id
    signal = {
      id: params.signalId,
      symbol: 'R_75',
      type: params.signalId.includes('bear') ? 'SELL' : 'BUY',
      entryPrice: params.executionPrice || 0,
      slPrice: 0,
      tp1Price: 0,
      slPips: 220,
      tp1Pips: 450,
      lotSize: state.lotSize || 0.001,
      createdAt: Date.now(),
      status: 'EXECUTED',
    };
  }

  signal.status = 'EXECUTED';
  signal.ticket = params.ticket;
  signal.executionPrice = params.executionPrice || signal.entryPrice;
  signal.executedAt = Date.now();

  state.pendingSignal = null;
  state.activeTrade = signal;
  state.lastEaTicket = params.ticket;
  state.lastEaPingTime = Date.now();

  if (!state.executedSignalIds.includes(params.signalId)) {
    state.executedSignalIds.push(params.signalId);
    if (state.executedSignalIds.length > 200) {
      state.executedSignalIds = state.executedSignalIds.slice(-200);
    }
  }

  saveEAState(state);

  // Send execution announcement to Telegram
  const alertConfig = loadAlertConfig();
  if (alertConfig.botToken && alertConfig.chatId) {
    const icon = signal.type === 'BUY' ? '🟢 BUY' : '🔴 SELL';
    const text =
      `🤖 <b>MT5 EA ORDER EXECUTED!</b> ⚡\n\n` +
      `🎫 <b>Ticket:</b> #<code>${params.ticket}</code>\n` +
      `🪙 <b>Symbol:</b> ${signal.symbol}\n` +
      `📈 <b>Action:</b> ${icon}\n` +
      `🎯 <b>Execution Price:</b> ${signal.executionPrice?.toFixed(2)}\n` +
      `🛑 <b>SL:</b> ${signal.slPrice ? signal.slPrice.toFixed(2) : 'Protected'}\n` +
      `✅ <b>TP:</b> ${signal.tp1Price ? signal.tp1Price.toFixed(2) : 'Target'}\n` +
      `⚖️ <b>Lot Size:</b> ${signal.lotSize}\n\n` +
      `🛡️ <i>Trade managed directly on VPS MetaTrader 5.</i>`;

    sendTelegramDirect(alertConfig.botToken, alertConfig.chatId, text).catch(() => {});
  }

  return { ok: true, message: 'Signal marked as EXECUTED', signal };
}

export function recordTradeResult(params: {
  signalId?: string;
  ticket?: number;
  exitPrice?: number;
  exitReason?: string;
  profit?: number;
  isWin: boolean;
}): { ok: boolean; circuitBreakerTripped: boolean; consecutiveLossesToday: number } {
  const state = loadEAState();
  checkDayRollover(state);

  const matchedSignal =
    (params.signalId && state.activeTrade?.id === params.signalId) ||
    (params.ticket && state.activeTrade?.ticket === params.ticket)
      ? state.activeTrade
      : null;

  if (matchedSignal) {
    matchedSignal.closedAt = Date.now();
    matchedSignal.exitPrice = params.exitPrice;
    matchedSignal.exitReason = params.exitReason;
    matchedSignal.profit = params.profit;
    matchedSignal.isWin = params.isWin;

    state.signalHistory.unshift(matchedSignal);
    if (state.signalHistory.length > 50) {
      state.signalHistory = state.signalHistory.slice(0, 50);
    }
    state.activeTrade = null;
  }

  if (params.isWin) {
    // Win resets consecutive loss streak!
    state.consecutiveLossesToday = 0;
  } else {
    // Loss increments consecutive losses
    state.consecutiveLossesToday += 1;
    state.lastLossDate = getTodayUtcString();

    if (state.consecutiveLossesToday >= state.maxConsecutiveLosses) {
      state.circuitBreakerTripped = true;
      state.circuitBreakerDate = getTodayUtcString();

      // Send emergency Telegram notification about Circuit Breaker
      const alertConfig = loadAlertConfig();
      if (alertConfig.botToken && alertConfig.chatId) {
        const warning =
          `🚨 <b>DAILY CIRCUIT BREAKER TRIGGERED!</b> 🛑\n\n` +
          `⚠️ <b>Max Daily Consecutive Losses Reached:</b> <b>${state.consecutiveLossesToday} Losses</b>\n` +
          `🛡️ <b>Action:</b> Auto-trading has been <b>PAUSED</b> for the remainder of today.\n` +
          `⏰ Trading will safely resume tomorrow at 00:00 UTC or when manually unpaused.\n\n` +
          `💡 <i>Rule #1: Protect capital. Never revenge trade against market conditions!</i>`;

        sendTelegramDirect(alertConfig.botToken, alertConfig.chatId, warning).catch(() => {});
      }
    }
  }

  saveEAState(state);

  return {
    ok: true,
    circuitBreakerTripped: state.circuitBreakerTripped,
    consecutiveLossesToday: state.consecutiveLossesToday,
  };
}
