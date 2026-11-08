import fs from 'fs';
import path from 'path';
import WebSocketNode from 'ws';
import { calculateMarketStructureTargetTracker, Candle, isV75KillZone } from './msttEngine.js';
import { loadAlertConfig } from './_lib/cloudAlertConfig.js';
import {
  executeDerivMultiplierTrade,
  recordDerivTradeOutcome,
  fetchDerivAccounts,
  getDerivCircuitStatus,
} from './_lib/derivTrader.js';

export const config = {
  maxDuration: 30,
};

const STATE_FILE = path.join('/tmp', 'mcharts_cron_state.json');

export interface ActiveTrade {
  id: string;
  symbol: string;
  tf: string;
  type: 'bull' | 'bear';
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price?: number;
  tp3Price?: number;
  slPips: number;
  tp1Pips: number;
  tp2Pips?: number;
  tp3Pips?: number;
  showTp1: boolean;
  showTp2: boolean;
  showTp3: boolean;
  startTime: number;
  entryCandleTime: number;
}

export interface TradeRecord {
  id: string;
  type: 'win' | 'loss';
  dir: 'bull' | 'bear';
  pips: number;
  symbol: string;
  tf: string;
  entryPrice: number;
  exitPrice: number;
  closedAt: number;
}

export interface CronState {
  lastAlertTime: number;
  lastAlertId?: string;
  alertedIds?: string[];
  lastHeartbeatTime: number;
  heartbeatMessageIds: number[];
  activeTrade: ActiveTrade | null;
  tradeHistory: TradeRecord[];
  lastWeeklyReportTime: number;
  lastDailyReportDate?: string;
  lastWeeklyReportDate?: string;
}

const DEFAULT_STATE: CronState = {
  lastAlertTime: 0,
  lastAlertId: '',
  alertedIds: [],
  lastHeartbeatTime: 0,
  heartbeatMessageIds: [],
  activeTrade: null,
  tradeHistory: [],
  lastWeeklyReportTime: Date.now(),
  lastDailyReportDate: '',
  lastWeeklyReportDate: '',
};

function loadCronState(): CronState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        alertedIds: Array.isArray(parsed.alertedIds) ? parsed.alertedIds : [],
        heartbeatMessageIds: Array.isArray(parsed.heartbeatMessageIds) ? parsed.heartbeatMessageIds : [],
        tradeHistory: Array.isArray(parsed.tradeHistory) ? parsed.tradeHistory : [],
      };
    }
  } catch (e) {
    console.warn('Failed to load cron state, using defaults:', e);
  }
  return DEFAULT_STATE;
}

function saveCronState(state: CronState) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save cron state:', e);
  }
}

// Atomic lock & claim mechanism across concurrent workers using POSIX O_EXCL / 'wx' flag
function tryAcquireSignalLock(signalId: string): boolean {
  const safeId = signalId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const lockPath = path.join('/tmp', `lock_${safeId}.lock`);
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, JSON.stringify({ signalId, time: Date.now() }));
    fs.closeSync(fd);
    return true;
  } catch (err: any) {
    if (err.code === 'EEXIST') {
      // Already claimed and locked by another concurrent process
      return false;
    }
    return true;
  }
}

const TIMEFRAME_SECONDS: Record<string, number> = {
  '1M': 60,
  '2M': 120,
  '3M': 180,
  '5M': 300,
  '10M': 600,
  '15M': 900,
  '30M': 1800,
  '1H': 3600,
  '2H': 7200,
  '4H': 14400,
  '8H': 28800,
  '1D': 86400,
};

function getSymbolDisplayName(symbol: string): string {
  if (symbol === 'R_75') return 'Volatility 75 index';
  if (symbol === '1HZ75V') return 'Volatility 75 (1s) index';
  if (symbol === 'R_100') return 'Volatility 100 index';
  if (symbol === '1HZ100V') return 'Volatility 100 (1s) index';
  if (symbol === 'R_50') return 'Volatility 50 index';
  if (symbol === 'R_25') return 'Volatility 25 index';
  if (symbol === 'R_10') return 'Volatility 10 index';
  return symbol;
}

async function getTelegramChat(botToken: string, chatId: string) {
  if (!botToken || !chatId) return null;
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/getChat?chat_id=${encodeURIComponent(chatId.trim())}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.ok ? data.result : null;
  } catch (err) {
    console.warn('Telegram getChat error:', err);
    return null;
  }
}

async function pinTelegramDirect(botToken: string, chatId: string, messageId: number) {
  if (!botToken || !chatId || !messageId) return { ok: false };
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/pinChatMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        message_id: messageId,
        disable_notification: true,
      }),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

async function unpinTelegramDirect(botToken: string, chatId: string) {
  if (!botToken || !chatId) return { ok: false };
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/unpinAllChatMessages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId.trim() }),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

async function sendTelegramDirect(botToken: string, chatId: string, text: string) {
  if (!botToken || !chatId) {
    return { ok: false, error: 'Bot token and Chat ID are required' };
  }
  const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      messageId: data.result?.message_id,
      description: data.description,
      data,
    };
  } catch (err: any) {
    console.error('Telegram direct send error:', err);
    return { ok: false, error: err.message };
  }
}

async function deleteTelegramDirect(botToken: string, chatId: string, messageId: number) {
  if (!botToken || !chatId || !messageId) {
    return { ok: false };
  }
  const url = `https://api.telegram.org/bot${botToken.trim()}/deleteMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        message_id: messageId,
      }),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok) };
  } catch (err: any) {
    console.error('Telegram deleteMessage error:', err);
    return { ok: false, error: err.message };
  }
}

async function fetchDerivCandles(symbol: string, granularity: number, count = 350): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const wsUrl = 'wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089';
    const WebSocketClass = (globalThis as any).WebSocket || WebSocketNode;
    if (!WebSocketClass) {
      return reject(new Error('WebSocket is not available in Node environment'));
    }

    const ws = new WebSocketClass(wsUrl);
    const timeout = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      reject(new Error('Deriv WebSocket timed out after 8 seconds'));
    }, 8000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: count,
        end: 'latest',
        start: 1,
        style: 'candles',
        granularity: granularity,
      }));
    };

    ws.onmessage = (event: any) => {
      clearTimeout(timeout);
      try {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString();
        const data = JSON.parse(raw);
        if (data.candles && Array.isArray(data.candles)) {
          const list: Candle[] = data.candles.map((c: any) => ({
            time: Number(c.epoch),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));
          try { ws.close(); } catch (e) {}
          resolve(list);
        } else if (data.error) {
          try { ws.close(); } catch (e) {}
          reject(new Error(data.error.message || 'Deriv API error'));
        }
      } catch (err) {
        try { ws.close(); } catch (e) {}
        reject(err);
      }
    };

    ws.onerror = (err: any) => {
      clearTimeout(timeout);
      try { ws.close(); } catch (e) {}
      reject(new Error(err?.message || 'WebSocket connection error'));
    };
  });
}

async function checkAndSendScheduledReports(
  botToken: string,
  chatId: string,
  state: CronState,
  savedConfig: any
) {
  if (!botToken || !chatId) return;

  const now = Date.now();
  // Ethiopian Time is UTC + 3
  const eatDate = new Date(now + 3 * 3600 * 1000);
  const eatHour = eatDate.getUTCHours();
  const eatMinutes = eatDate.getUTCMinutes();
  const eatDayOfWeek = eatDate.getUTCDay(); // 0 = Sunday
  const eatDateStr = eatDate.toISOString().slice(0, 10);
  const eatTimeFormatted = `${String(eatHour).padStart(2, '0')}:${String(eatMinutes).padStart(2, '0')} EAT`;

  const derivToken = (savedConfig.options?.derivApiToken || '').trim();
  const derivAppId = (savedConfig.options?.derivAppId || '').trim();
  const derivMode = (savedConfig.options?.derivMode === 'real' ? 'real' : 'demo') as 'real' | 'demo';
  const circuit = getDerivCircuitStatus();

  async function getLiveBalanceStr(): Promise<string> {
    if (derivToken && derivAppId) {
      try {
        const accs = await fetchDerivAccounts(derivToken, derivAppId);
        if (accs.ok && accs.accounts) {
          const match = accs.accounts.find((a) => a.account_type === derivMode);
          if (match) {
            return `${match.balance.toFixed(2)} ${match.currency}`;
          }
        }
      } catch (e) {}
    }
    return '---';
  }

  // 1. DAILY REPORT: Triggered every morning at 06:00 Ethiopian Time (06:00 - 06:59 EAT)
  if (eatHour === 6 && state.lastDailyReportDate !== eatDateStr) {
    state.lastDailyReportDate = eatDateStr;

    const oneDayAgo = now - 24 * 3600 * 1000;
    const last24hTrades = (state.tradeHistory || []).filter((t) => t.closedAt >= oneDayAgo);
    const wins = last24hTrades.filter((t) => t.type === 'win').length;
    const losses = last24hTrades.filter((t) => t.type === 'loss').length;
    const totalTrades = last24hTrades.length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
    const totalPips = last24hTrades.reduce((acc, t) => acc + (t.pips || 0), 0);
    const balanceStr = await getLiveBalanceStr();

    const dailyMsg =
      `🌅 <b>DAILY MORNING BRIEFING (የዕለቱ ሪፖርት)</b>\n\n` +
      `📅 <b>Date:</b> ${eatDateStr} | ⏰ <b>${eatTimeFormatted}</b>\n` +
      `🪙 <b>Strategy:</b> Volatility 75 Index (1H Breakout)\n` +
      `🎯 <b>Risk:</b> Stake $${Number(savedConfig.options?.derivStake || 2.0).toFixed(2)} | TP +$${Number(savedConfig.options?.derivTakeProfitUsd || 6.68).toFixed(2)} | SL -$${Number(savedConfig.options?.derivStopLossUsd || 2.0).toFixed(2)}\n\n` +
      `📊 <b>24-Hour Performance:</b>\n` +
      `• Total Trades: <b>${totalTrades}</b>\n` +
      `• Wins (TP Hit): <b>${wins} ✅</b>\n` +
      `• Losses (SL Hit): <b>${losses} ❌</b>\n` +
      `• Win Rate: <b>${winRate}%</b>\n` +
      `• Net Pips: <b>${totalPips >= 0 ? '+' : ''}${totalPips} pips</b>\n\n` +
      `💼 <b>Deriv Status (${derivMode.toUpperCase()}):</b>\n` +
      `• Live Balance: <b>$${balanceStr}</b>\n` +
      `• Circuit Breaker: <b>${circuit.isTripped ? '🛑 TRIPPED (Safe Stop)' : `🟢 ACTIVE (${circuit.consecutiveLosses}/${circuit.maxConsecutiveLosses} consecutive losses)`}</b>\n\n` +
      `✨ <i>Mire, discipline is key! Never revenge trade, let the 1H strategy execute cleanly!</i>`;

    await sendTelegramDirect(botToken, chatId, dailyMsg).catch(() => {});
    saveCronState(state);
  }

  // 2. WEEKLY REPORT: Triggered every Sunday night at 21:00 Ethiopian Time (21:00 - 21:59 EAT)
  if (eatDayOfWeek === 0 && eatHour >= 21 && state.lastWeeklyReportDate !== eatDateStr) {
    state.lastWeeklyReportDate = eatDateStr;

    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    const weekTrades = (state.tradeHistory || []).filter((t) => t.closedAt >= sevenDaysAgo);
    const wins = weekTrades.filter((t) => t.type === 'win').length;
    const losses = weekTrades.filter((t) => t.type === 'loss').length;
    const totalTrades = weekTrades.length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
    const totalPips = weekTrades.reduce((acc, t) => acc + (t.pips || 0), 0);
    const balanceStr = await getLiveBalanceStr();

    const weeklyMsg =
      `👑 <b>WEEKLY PERFORMANCE MASTER REPORT</b>\n\n` +
      `📅 <b>Week Ending:</b> ${eatDateStr} (Sunday Night)\n` +
      `🪙 <b>Asset:</b> Volatility 75 Index\n\n` +
      `📈 <b>Weekly Summary:</b>\n` +
      `• Total Trades: <b>${totalTrades}</b>\n` +
      `• Wins: <b>${wins} ✅</b>\n` +
      `• Losses: <b>${losses} ❌</b>\n` +
      `• Win Rate: <b>${winRate}%</b>\n` +
      `• Total Pips: <b>${totalPips >= 0 ? '+' : ''}${totalPips} pips</b>\n\n` +
      `💼 <b>Deriv Balance:</b> $${balanceStr}\n\n` +
      `🚀 <i>Strong discipline this week! Ready for tomorrow's markets!</i>`;

    await sendTelegramDirect(botToken, chatId, weeklyMsg).catch(() => {});
    saveCronState(state);
  }
}

export default async function handler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const savedConfig = loadAlertConfig();
    const botToken = (req.query?.token || req.query?.botToken || body.botToken || savedConfig.botToken || '')?.toString()?.trim();
    const chatId = (req.query?.chat || req.query?.chatId || body.chatId || savedConfig.chatId || '')?.toString()?.trim();

    const symbol = (req.query?.symbol || body.symbol || savedConfig.symbol || 'R_75').toString();
    const tf = (req.query?.tf || req.query?.timeframe || body.timeframe || savedConfig.timeframe || '30M').toString();
    const granularity = TIMEFRAME_SECONDS[tf] || 1800; // 30M default = 1800s
    const symbolName = getSymbolDisplayName(symbol);

    const slPips = Number(req.query?.sl || body.options?.pointsSl || savedConfig.options?.pointsSl || 220);
    const tp1Pips = Number(req.query?.tp1 || body.options?.pointsTp1 || savedConfig.options?.pointsTp1 || 450);
    const tp2Pips = Number(req.query?.tp2 || body.options?.pointsTp2 || savedConfig.options?.pointsTp2 || 650);
    const tp3Pips = Number(req.query?.tp3 || body.options?.pointsTp3 || savedConfig.options?.pointsTp3 || 1000);
    const showTp1 = req.query?.showTp1 !== undefined ? (req.query.showTp1 === 'true' || req.query.showTp1 === '1') : (savedConfig.options?.showTp1 ?? true);
    const showTp2 = req.query?.showTp2 !== undefined ? (req.query.showTp2 === 'true' || req.query.showTp2 === '1') : (savedConfig.options?.showTp2 ?? false);
    const showTp3 = req.query?.showTp3 !== undefined ? (req.query.showTp3 === 'true' || req.query.showTp3 === '1') : (savedConfig.options?.showTp3 ?? false);
    const usePd = req.query?.usePd !== undefined ? (req.query.usePd === 'true' || req.query.usePd === '1') : Boolean(body.options?.usePremiumDiscountFilter ?? savedConfig.options?.usePremiumDiscountFilter);
    const useIdm = req.query?.useIdm !== undefined ? (req.query.useIdm === 'true' || req.query.useIdm === '1') : Boolean(body.options?.useInducementFilter ?? savedConfig.options?.useInducementFilter);
    const useKz = req.query?.useKz !== undefined ? (req.query.useKz === 'true' || req.query.useKz === '1') : Boolean(body.options?.useKillZonesFilter ?? savedConfig.options?.useKillZonesFilter);
    const useTurtle = req.query?.useTurtle !== undefined ? (req.query.useTurtle === 'true' || req.query.useTurtle === '1') : Boolean(body.options?.useTurtleSoupFilter ?? savedConfig.options?.useTurtleSoupFilter);
    const useRetest = req.query?.useRetest !== undefined ? (req.query.useRetest === 'true' || req.query.useRetest === '1') : Boolean(body.options?.useRetestConfirmation ?? savedConfig.options?.useRetestConfirmation);
    const useWhip = req.query?.useWhip !== undefined ? (req.query.useWhip === 'true' || req.query.useWhip === '1') : Boolean(body.options?.useAntiWhipsawFilter ?? savedConfig.options?.useAntiWhipsawFilter);

    const mergedOptions: Record<string, any> = {
      targetMode: 'points',
      pointsSl: slPips,
      pointsTp1: tp1Pips,
      pointsTp2: tp2Pips,
      pointsTp3: tp3Pips,
      showTp1,
      showTp2,
      showTp3,
      targetFocus: req.query?.targetFocus || savedConfig.options?.targetFocus || 'TP1',
      swingLen: 5,
      useStructureFilter: true,
      structureTf: '15',
      filterSwingLen: 5,
      useWickFilter: true,
      maxWickRatio: 0.70,
      useDisplacementFilter: true,
      minDisplacementAtr: 0.80,
      useBodyCloseFilter: true,
      minBodyRatio: 0.50,
      useSweepFilter: false,
      sweepLookback: 10,
      preventLateEntry: true,
      maxBreakoutDelay: 1,
      usePremiumDiscountFilter: usePd,
      useInducementFilter: useIdm,
      useKillZonesFilter: useKz,
      useTurtleSoupFilter: useTurtle,
      useRetestConfirmation: useRetest,
      useAntiWhipsawFilter: useWhip,
      ...(savedConfig.options || {}),
      ...(body.options || {}),
    };

    const state = loadCronState();
    const now = Date.now();

    // =========================================================================
    // COLD-START RECOVERY: RECONSTRUCT ACTIVE TRADE FROM TELEGRAM PINNED MESSAGE
    // =========================================================================
    if (!state.activeTrade && botToken && chatId) {
      const cloudChat = await getTelegramChat(botToken, chatId);
      const pinned = cloudChat?.pinned_message?.text || '';
      if (pinned.includes('SIG_')) {
        const sigMatch = pinned.match(/SIG_([A-Za-z0-9_]+)_([0-9A-Za-z]+)_(\d+)_(bull|bear)/);
        const entryMatch = pinned.match(/Entry:\s*([0-9.]+)/);
        const slMatch = pinned.match(/Stop Loss:\s*([0-9.]+)/) || pinned.match(/SL\):\s*<code>([0-9.]+)<\/code>/);
        const tp1Match = pinned.match(/TP1:\s*([0-9.]+)/) || pinned.match(/TP1\):\s*<code>([0-9.]+)<\/code>/);
        const tp2Match = pinned.match(/TP2:\s*([0-9.]+)/) || pinned.match(/TP2\):\s*<code>([0-9.]+)<\/code>/);
        const tp3Match = pinned.match(/TP3:\s*([0-9.]+)/) || pinned.match(/TP3\):\s*<code>([0-9.]+)<\/code>/);
        if (sigMatch && entryMatch && slMatch && tp1Match) {
          const entryVal = Number(entryMatch[1]);
          const slVal = Number(slMatch[1]);
          const tp1Val = Number(tp1Match[1]);
          state.activeTrade = {
            id: sigMatch[0],
            symbol: sigMatch[1],
            tf: sigMatch[2],
            type: sigMatch[4] as 'bull' | 'bear',
            entryPrice: entryVal,
            slPrice: slVal,
            tp1Price: tp1Val,
            tp2Price: tp2Match ? Number(tp2Match[1]) : undefined,
            tp3Price: tp3Match ? Number(tp3Match[1]) : undefined,
            slPips: Math.abs(entryVal - slVal),
            tp1Pips: Math.abs(tp1Val - entryVal),
            tp2Pips: tp2Match ? Math.abs(Number(tp2Match[1]) - entryVal) : undefined,
            tp3Pips: tp3Match ? Math.abs(Number(tp3Match[1]) - entryVal) : undefined,
            showTp1: true,
            showTp2: Boolean(tp2Match),
            showTp3: Boolean(tp3Match),
            startTime: Number(sigMatch[3]),
            entryCandleTime: Number(sigMatch[3]),
          };
          state.lastAlertId = sigMatch[0];
          state.lastAlertTime = Number(sigMatch[3]);
        }
      }
    }

    // =========================================================================
    // CHECK SCHEDULED REPORTS (Daily 06:00 EAT & Sunday 21:00 EAT)
    // =========================================================================
    await checkAndSendScheduledReports(botToken, chatId, state, savedConfig);

    // =========================================================================
    // METHOD 3: MULTI-PASS SURVEILLANCE LOOP (3 passes across ~10-12s)
    // Minimizes latency down to seconds while staying inside serverless budget
    // =========================================================================
    const maxPasses = 3;
    const passDelayMs = 3800; // 3.8s between passes
    let passesCompleted = 0;

    let tradeResolved = false;
    let resolutionMessage = '';
    let newSignalSent = false;
    let signalInfo: any = null;
    let candles: Candle[] = [];
    let latestCandle: Candle | null = null;
    let msttResult: any = null;

    for (let pass = 0; pass < maxPasses; pass++) {
      passesCompleted++;
      if (pass > 0) {
        await new Promise((resolve) => setTimeout(resolve, passDelayMs));
      }

      try {
        candles = await fetchDerivCandles(symbol, granularity, 350);
      } catch (err) {
        if (pass === maxPasses - 1 && candles.length === 0) {
          throw err;
        }
        continue;
      }

      if (!candles || candles.length < 20) {
        continue;
      }

      const lastCandleIdx = candles.length - 1;
      latestCandle = candles[lastCandleIdx];

      // 1. TRACK ACTIVE TRADE OUTCOME (TP HIT or SL HIT)
      if (state.activeTrade && state.activeTrade.symbol === symbol && !tradeResolved) {
        const active = state.activeTrade;
        const checkCandles = candles.filter((c) => c.time >= active.entryCandleTime);

        for (const candle of checkCandles) {
          if (active.type === 'bull') {
            if (active.showTp3 && active.tp3Price && candle.high >= active.tp3Price) {
              tradeResolved = true;
              const pipsWon = active.tp3Pips || Math.round(active.tp3Price - active.entryPrice);
              resolutionMessage =
                `🎯 TAKE PROFIT 3 HIT! ✅\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📈 Target: TP3 Hit (+${pipsWon} pips)\n` +
                `💰 Exit Price: ${active.tp3Price.toFixed(2)}\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🏆 Mire, maximum profit secured! Outstanding trade!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'win',
                dir: 'bull',
                pips: pipsWon,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.tp3Price,
                closedAt: Date.now(),
              });
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            } else if (active.showTp2 && active.tp2Price && candle.high >= active.tp2Price) {
              tradeResolved = true;
              const pipsWon = active.tp2Pips || Math.round(active.tp2Price - active.entryPrice);
              resolutionMessage =
                `🎯 TAKE PROFIT 2 HIT! ✅\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📈 Target: TP2 Hit (+${pipsWon} pips)\n` +
                `💰 Exit Price: ${active.tp2Price.toFixed(2)}\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🏆 Mire, TP2 secured! Great discipline!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'win',
                dir: 'bull',
                pips: pipsWon,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.tp2Price,
                closedAt: Date.now(),
              });
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            } else if (active.showTp1 && candle.high >= active.tp1Price) {
              tradeResolved = true;
              const pipsWon = active.tp1Pips;
              resolutionMessage =
                `🎯 TAKE PROFIT HIT! ✅\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📈 Target: TP1 Hit (+${pipsWon} pips)\n` +
                `💰 Exit Price: ${active.tp1Price.toFixed(2)}\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🏆 Mire, profit locked in! Never give back profits!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'win',
                dir: 'bull',
                pips: pipsWon,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.tp1Price,
                closedAt: Date.now(),
              });
              recordDerivTradeOutcome(true);
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            } else if (candle.low <= active.slPrice) {
              tradeResolved = true;
              const pipsLost = active.slPips;
              resolutionMessage =
                `🛑 STOP LOSS HIT ❌\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📉 Exit Price: ${active.slPrice.toFixed(2)}\n` +
                `⚠️ Result: SL Touched (-${pipsLost} pips)\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🚨 Mire, stay disciplined and wait for next clean setup. Never revenge trade!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'loss',
                dir: 'bull',
                pips: -pipsLost,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.slPrice,
                closedAt: Date.now(),
              });
              recordDerivTradeOutcome(false, Number(savedConfig.options?.derivMaxConsecutiveLosses || 2));
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            }
          } else if (active.type === 'bear') {
            if (active.showTp3 && active.tp3Price && candle.low <= active.tp3Price) {
              tradeResolved = true;
              const pipsWon = active.tp3Pips || Math.round(active.entryPrice - active.tp3Price);
              resolutionMessage =
                `🎯 TAKE PROFIT 3 HIT! ✅\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📉 Target: TP3 Hit (+${pipsWon} pips)\n` +
                `💰 Exit Price: ${active.tp3Price.toFixed(2)}\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🏆 Mire, maximum profit secured! Outstanding trade!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'win',
                dir: 'bear',
                pips: pipsWon,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.tp3Price,
                closedAt: Date.now(),
              });
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            } else if (active.showTp2 && active.tp2Price && candle.low <= active.tp2Price) {
              tradeResolved = true;
              const pipsWon = active.tp2Pips || Math.round(active.entryPrice - active.tp2Price);
              resolutionMessage =
                `🎯 TAKE PROFIT 2 HIT! ✅\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📉 Target: TP2 Hit (+${pipsWon} pips)\n` +
                `💰 Exit Price: ${active.tp2Price.toFixed(2)}\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🏆 Mire, TP2 secured! Great discipline!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'win',
                dir: 'bear',
                pips: pipsWon,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.tp2Price,
                closedAt: Date.now(),
              });
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            } else if (active.showTp1 && candle.low <= active.tp1Price) {
              tradeResolved = true;
              const pipsWon = active.tp1Pips;
              resolutionMessage =
                `🎯 TAKE PROFIT HIT! ✅\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📉 Target: TP1 Hit (+${pipsWon} pips)\n` +
                `💰 Exit Price: ${active.tp1Price.toFixed(2)}\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🏆 Mire, profit locked in! Never give back profits!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'win',
                dir: 'bear',
                pips: pipsWon,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.tp1Price,
                closedAt: Date.now(),
              });
              recordDerivTradeOutcome(true);
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            } else if (candle.high >= active.slPrice) {
              tradeResolved = true;
              const pipsLost = active.slPips;
              resolutionMessage =
                `🛑 STOP LOSS HIT ❌\n\n` +
                `🪙 Pair: ${symbolName}\n` +
                `📈 Exit Price: ${active.slPrice.toFixed(2)}\n` +
                `⚠️ Result: SL Touched (-${pipsLost} pips)\n` +
                `⏰ Timeframe: ${active.tf}\n\n` +
                `🚨 Mire, stay disciplined and wait for next clean setup. Never revenge trade!`;

              state.tradeHistory.push({
                id: active.id,
                type: 'loss',
                dir: 'bear',
                pips: -pipsLost,
                symbol: active.symbol,
                tf: active.tf,
                entryPrice: active.entryPrice,
                exitPrice: active.slPrice,
                closedAt: Date.now(),
              });
              recordDerivTradeOutcome(false, Number(savedConfig.options?.derivMaxConsecutiveLosses || 2));
              state.activeTrade = null;
              await sendTelegramDirect(botToken, chatId, resolutionMessage);
              await unpinTelegramDirect(botToken, chatId);
              break;
            }
          }
        }
      }

      // 2. CHECK FOR NEW BREAKOUT SIGNAL
      msttResult = calculateMarketStructureTargetTracker(candles, mergedOptions, symbol);
      const markers = msttResult.signalMarkers || [];
      const recentMarker = markers.length > 0 ? markers[markers.length - 1] : null;

      if (recentMarker && recentMarker.barIndex >= lastCandleIdx - 2) {
        const uniqueSignalId = `SIG_${symbol}_${tf}_${recentMarker.time}_${recentMarker.type}`;
        const isLocallyAlerted =
          state.lastAlertId === uniqueSignalId ||
          (state.alertedIds && state.alertedIds.includes(uniqueSignalId));

        let isCloudAlerted = false;
        if (!isLocallyAlerted && botToken && chatId) {
          const chatInfo = await getTelegramChat(botToken, chatId);
          const pinnedText = chatInfo?.pinned_message?.text || '';
          isCloudAlerted = pinnedText.includes(uniqueSignalId);
          if (isCloudAlerted) {
            state.lastAlertId = uniqueSignalId;
            if (!state.alertedIds) state.alertedIds = [];
            if (!state.alertedIds.includes(uniqueSignalId)) state.alertedIds.push(uniqueSignalId);
            saveCronState(state);
          }
        }

        if (!isLocallyAlerted && !isCloudAlerted) {
          const acquiredLock = tryAcquireSignalLock(uniqueSignalId);

          if (acquiredLock) {
            // Delete older scanning heartbeat messages
            if (state.heartbeatMessageIds && state.heartbeatMessageIds.length > 0) {
              for (const msgId of state.heartbeatMessageIds) {
                try {
                  await deleteTelegramDirect(botToken, chatId, msgId);
                } catch (e) {}
              }
              state.heartbeatMessageIds = [];
            }

            const isBull = recentMarker.type === 'bull';
            const headerTitle = isBull ? '📊 BUY SIGNAL' : '📊 SELL SIGNAL';
            const directionText = isBull ? '📈 Direction: BUY (Long)' : '📉 Direction: SELL (Short)';
            const entryPrice = recentMarker.entryPrice || msttResult.entryPrice || latestCandle.close;

            const slPrice = isBull ? (entryPrice - slPips) : (entryPrice + slPips);
            const tp1Price = isBull ? (entryPrice + tp1Pips) : (entryPrice - tp1Pips);
            const tp2Price = isBull ? (entryPrice + tp2Pips) : (entryPrice - tp2Pips);
            const tp3Price = isBull ? (entryPrice + tp3Pips) : (entryPrice - tp3Pips);

            const lines: string[] = [
              headerTitle,
              '',
              `🪙 Pair: ${symbolName}`,
              directionText,
              `⏰ Timeframe: ${tf}`,
              '',
              `🎯 Entry: ${entryPrice.toFixed(2)}`,
              `✅ TP1: ${tp1Price.toFixed(2)} (+${tp1Pips} pips)`,
            ];

            if (showTp2) {
              lines.push(`✅ TP2: ${tp2Price.toFixed(2)} (+${tp2Pips} pips)`);
            }
            if (showTp3) {
              lines.push(`✅ TP3: ${tp3Price.toFixed(2)} (+${tp3Pips} pips)`);
            }

            lines.push(`🛑 Stop Loss: ${slPrice.toFixed(2)} (-${slPips} pips)`);
            lines.push('');
            lines.push('⚖️ Risk: 1–2% only');
            lines.push('');
            lines.push('🚨 Mire this time must be comeback! Never revenge');
            lines.push('');
            lines.push(`<tg-spoiler>#${uniqueSignalId}</tg-spoiler>`);

            const alertMessage = lines.join('\n');

            let tgResult: any = { ok: false, error: 'Telegram credentials missing' };
            if (botToken && chatId) {
              tgResult = await sendTelegramDirect(botToken, chatId, alertMessage);
              if (tgResult.ok && tgResult.messageId) {
                await pinTelegramDirect(botToken, chatId, tgResult.messageId).catch(() => {});
              }
            }

            // DERIV AUTO-TRADING MULTIPLIER EXECUTION
            let derivTradeResult: any = null;
            const derivToken = (savedConfig.options?.derivApiToken || '').trim();
            const derivAppId = (savedConfig.options?.derivAppId || '').trim();
            const derivAutoTrade = Boolean(savedConfig.options?.derivAutoTradeEnabled);

            if (derivAutoTrade && derivToken && derivAppId) {
              try {
                derivTradeResult = await executeDerivMultiplierTrade({
                  token: derivToken,
                  appId: derivAppId,
                  mode: savedConfig.options?.derivMode === 'real' ? 'real' : 'demo',
                  action: isBull ? 'BUY' : 'SELL',
                  symbol: symbol === '1HZ75V' || symbol === 'R_75' ? 'R_75' : symbol,
                  stake: Number(savedConfig.options?.derivStake || 2.0),
                  multiplier: Number(savedConfig.options?.derivMultiplier || 200),
                  takeProfitUsd: Number(savedConfig.options?.derivTakeProfitUsd || 6.68),
                  stopLossUsd: Number(savedConfig.options?.derivStopLossUsd || 2.0),
                  maxConsecutiveLosses: Number(savedConfig.options?.derivMaxConsecutiveLosses || 2),
                });

                if (derivTradeResult?.ok && botToken && chatId) {
                  const modeLabel = savedConfig.options?.derivMode === 'real' ? '🔴 REAL LIVE' : '🧪 DEMO VIRTUAL';
                  const eatDate = new Date(Date.now() + 3 * 3600 * 1000);
                  const eatTimeFormatted = `${eatDate.toISOString().replace('T', ' ').slice(0, 16)} EAT`;

                  const derivMsg =
                    `🚀 <b>DERIV AUTO-TRADE EXECUTED!</b>\n\n` +
                    `⚖️ <b>Account:</b> ${modeLabel} (<code>${derivTradeResult.accountId || 'Deriv'}</code>)\n` +
                    `🧭 <b>Action:</b> ${isBull ? '📈 BUY (MULTUP)' : '📉 SELL (MULTDOWN)'}\n` +
                    `🪙 <b>Asset:</b> ${symbolName} (${tf})\n` +
                    `💵 <b>Stake:</b> $${Number(savedConfig.options?.derivStake || 2.0).toFixed(2)} USD (${savedConfig.options?.derivMultiplier || 200}x Multiplier)\n` +
                    `🎯 <b>Take Profit:</b> +$${Number(savedConfig.options?.derivTakeProfitUsd || 6.68).toFixed(2)} USD (~${tp1Pips} pips)\n` +
                    `🛑 <b>Stop Loss:</b> -$${Number(savedConfig.options?.derivStopLossUsd || 2.0).toFixed(2)} USD (~${slPips} pips)\n` +
                    `🆔 <b>Contract ID:</b> <code>#${derivTradeResult.contractId}</code>\n` +
                    `💰 <b>Balance After:</b> $${derivTradeResult.balanceAfter?.toFixed(2) ?? '---'} USD\n` +
                    `⏰ <b>Execution Time:</b> ${eatTimeFormatted}\n` +
                    `🛡️ <b>Circuit Breaker:</b> Active (Capital Protected)`;

                  await sendTelegramDirect(botToken, chatId, derivMsg).catch(() => {});
                }
              } catch (derivErr: any) {
                console.error('Deriv auto-trade execution error in cron:', derivErr);
              }
            }

            newSignalSent = Boolean(tgResult.ok || derivTradeResult?.ok);
            signalInfo = {
              type: recentMarker.type,
              time: recentMarker.time,
              signalId: uniqueSignalId,
              entryPrice,
              slPrice,
              tp1Price,
              tp2Price,
              tp3Price,
              slPips,
              tp1Pips,
              tp2Pips,
              tp3Pips,
              telegram: tgResult,
              deriv: derivTradeResult,
            };

            state.lastAlertTime = recentMarker.time;
            state.lastAlertId = uniqueSignalId;
            if (!state.alertedIds) state.alertedIds = [];
            state.alertedIds.push(uniqueSignalId);
            if (state.alertedIds.length > 100) state.alertedIds = state.alertedIds.slice(-100);

            state.activeTrade = {
              id: uniqueSignalId,
              symbol,
              tf,
              type: isBull ? 'bull' : 'bear',
              entryPrice,
              slPrice,
              tp1Price,
              tp2Price,
              tp3Price,
              slPips,
              tp1Pips,
              tp2Pips,
              tp3Pips,
              showTp1,
              showTp2,
              showTp3,
              startTime: recentMarker.time,
              entryCandleTime: latestCandle.time,
            };

            // Break out of multi-pass loop immediately once trade has executed!
            break;
          }
        }
      }
    }

    // Clean up any remaining legacy heartbeat messages
    if (state.heartbeatMessageIds && state.heartbeatMessageIds.length > 0) {
      for (const msgId of state.heartbeatMessageIds) {
        try {
          await deleteTelegramDirect(botToken, chatId, msgId);
        } catch (e) {}
      }
      state.heartbeatMessageIds = [];
    }

    saveCronState(state);

    return res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      symbol,
      timeframe: tf,
      passesCompleted,
      candlesCount: candles.length,
      latestClose: latestCandle ? latestCandle.close : undefined,
      trend: msttResult?.dashboard?.trendStr || 'Neutral',
      activeTrade: state.activeTrade,
      tradeResolved,
      signalSent: newSignalSent,
      signalDetails: signalInfo,
      totalHistoricalTrades: state.tradeHistory.length,
      heartbeatsQueued: state.heartbeatMessageIds.length,
    });
  } catch (err: any) {
    console.error('Unhandled cron check error:', err);
    return res.status(200).json({
      ok: false,
      status: 'error_caught',
      error: err?.message || String(err),
    });
  }
}
