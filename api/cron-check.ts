import fs from 'fs';
import path from 'path';
import WebSocketNode from 'ws';
import { calculateMarketStructureTargetTracker, Candle, isV75KillZone } from './msttEngine';
import { queueNewSignalForEA, recordTradeResult, loadEAState } from './_lib/eaState';
import { sendSmsDirect, formatTradeSignalSms, formatTradeResolutionSms } from './_lib/smsEthiopia';
import { loadAlertConfig } from './_lib/cloudAlertConfig';

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

function notifyResolutionSms(isWin: boolean, symbolName: string, pips: number, exitPrice: number, reason: string) {
  try {
    const cloudCfg = loadAlertConfig();
    const smsKey = cloudCfg.smsApiKey || 'X5UZHVO1BTC9VTNGXPAR4BJQCDCLLOPYPEJ6U4H6';
    const smsPhone = cloudCfg.smsPhone || '251968865885';
    if (cloudCfg.smsAlertsEnabled !== false && smsKey && smsPhone) {
      const txt = formatTradeResolutionSms({ isWin, symbolName, pips, exitPrice, reason });
      sendSmsDirect(smsKey, smsPhone, txt).catch(() => {});
    }
  } catch (e) {}
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

    const defaultBot = '8864552579:AAGSXeU9Z-WslGPehNXCxENWKSl1xeEe3FA';
    const defaultChat = '-1004295328271';

    const botToken = (req.query?.token || req.query?.botToken || body.botToken || defaultBot)?.toString()?.trim();
    const chatId = (req.query?.chat || req.query?.chatId || body.chatId || defaultChat)?.toString()?.trim();

    const symbol = (req.query?.symbol || body.symbol || 'R_75').toString();
    const tf = (req.query?.tf || req.query?.timeframe || body.timeframe || '30M').toString();
    const granularity = TIMEFRAME_SECONDS[tf] || 1800; // 30M default = 1800s
    const symbolName = getSymbolDisplayName(symbol);

    const slPips = Number(req.query?.sl || body.options?.pointsSl || 200);
    const tp1Pips = Number(req.query?.tp1 || body.options?.pointsTp1 || 450);
    const tp2Pips = Number(req.query?.tp2 || body.options?.pointsTp2 || 650);
    const tp3Pips = Number(req.query?.tp3 || body.options?.pointsTp3 || 1000);
    const showTp1 = req.query?.showTp1 !== undefined ? (req.query.showTp1 === 'true' || req.query.showTp1 === '1') : true;
    const showTp2 = req.query?.showTp2 !== undefined ? (req.query.showTp2 === 'true' || req.query.showTp2 === '1') : false;
    const showTp3 = req.query?.showTp3 !== undefined ? (req.query.showTp3 === 'true' || req.query.showTp3 === '1') : false;
    const usePd = req.query?.usePd !== undefined ? (req.query.usePd === 'true' || req.query.usePd === '1') : Boolean(body.options?.usePremiumDiscountFilter);
    const useIdm = req.query?.useIdm !== undefined ? (req.query.useIdm === 'true' || req.query.useIdm === '1') : Boolean(body.options?.useInducementFilter);
    const useKz = req.query?.useKz !== undefined ? (req.query.useKz === 'true' || req.query.useKz === '1') : Boolean(body.options?.useKillZonesFilter);
    const useTurtle = req.query?.useTurtle !== undefined ? (req.query.useTurtle === 'true' || req.query.useTurtle === '1') : Boolean(body.options?.useTurtleSoupFilter);
    const useRetest = req.query?.useRetest !== undefined ? (req.query.useRetest === 'true' || req.query.useRetest === '1') : Boolean(body.options?.useRetestConfirmation);
    const useWhip = req.query?.useWhip !== undefined ? (req.query.useWhip === 'true' || req.query.useWhip === '1') : Boolean(body.options?.useAntiWhipsawFilter);

    const mergedOptions: Record<string, any> = {
      targetMode: 'points',
      pointsSl: slPips,
      pointsTp1: tp1Pips,
      pointsTp2: tp2Pips,
      pointsTp3: tp3Pips,
      showTp1,
      showTp2,
      showTp3,
      targetFocus: req.query?.targetFocus || 'TP1',
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

    const candles = await fetchDerivCandles(symbol, granularity, 350);
    if (!candles || candles.length < 20) {
      return res.status(200).json({
        ok: false,
        error: 'Insufficient candles returned from Deriv API',
      });
    }

    const lastCandleIdx = candles.length - 1;
    const latestCandle = candles[lastCandleIdx];

    // =========================================================================
    // 1. TRACK ACTIVE TRADE OUTCOME (TP HIT or SL HIT)
    // =========================================================================
    let tradeResolved = false;
    let resolutionMessage = '';

    if (state.activeTrade && state.activeTrade.symbol === symbol) {
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
            recordTradeResult({ signalId: active.id, exitPrice: active.tp3Price, exitReason: 'TP3 Hit (Win)', isWin: true });
            notifyResolutionSms(true, symbolName, pipsWon, active.tp3Price, 'TP3 Hit (Win)');
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
            recordTradeResult({ signalId: active.id, exitPrice: active.tp2Price, exitReason: 'TP2 Hit (Win)', isWin: true });
            notifyResolutionSms(true, symbolName, pipsWon, active.tp2Price, 'TP2 Hit (Win)');
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
            recordTradeResult({ signalId: active.id, exitPrice: active.tp1Price, exitReason: 'TP1 Hit (Win)', isWin: true });
            notifyResolutionSms(true, symbolName, pipsWon, active.tp1Price, 'TP1 Hit (Win)');
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
            recordTradeResult({ signalId: active.id, exitPrice: active.slPrice, exitReason: 'Stop Loss Hit (Loss)', isWin: false });
            notifyResolutionSms(false, symbolName, pipsLost, active.slPrice, 'Stop Loss Hit (Loss)');
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
            recordTradeResult({ signalId: active.id, exitPrice: active.tp3Price, exitReason: 'TP3 Hit (Win)', isWin: true });
            notifyResolutionSms(true, symbolName, pipsWon, active.tp3Price, 'TP3 Hit (Win)');
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
            recordTradeResult({ signalId: active.id, exitPrice: active.tp2Price, exitReason: 'TP2 Hit (Win)', isWin: true });
            notifyResolutionSms(true, symbolName, pipsWon, active.tp2Price, 'TP2 Hit (Win)');
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
            recordTradeResult({ signalId: active.id, exitPrice: active.tp1Price, exitReason: 'TP1 Hit (Win)', isWin: true });
            notifyResolutionSms(true, symbolName, pipsWon, active.tp1Price, 'TP1 Hit (Win)');
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
            recordTradeResult({ signalId: active.id, exitPrice: active.slPrice, exitReason: 'Stop Loss Hit (Loss)', isWin: false });
            notifyResolutionSms(false, symbolName, pipsLost, active.slPrice, 'Stop Loss Hit (Loss)');
            state.activeTrade = null;
            await sendTelegramDirect(botToken, chatId, resolutionMessage);
            await unpinTelegramDirect(botToken, chatId);
            break;
          }
        }
      }
    }

    // =========================================================================
    // 2. CHECK FOR NEW BREAKOUT SIGNAL WITH BULLETPROOF DUPLICATE PREVENTION
    // =========================================================================
    const msttResult = calculateMarketStructureTargetTracker(candles, mergedOptions, symbol);
    const markers = msttResult.signalMarkers || [];
    const recentMarker = markers.length > 0 ? markers[markers.length - 1] : null;

    let newSignalSent = false;
    let signalInfo: any = null;

    if (recentMarker && (recentMarker.barIndex === lastCandleIdx || recentMarker.barIndex === lastCandleIdx - 1)) {
      // 1. UNIQUE SIGNAL ID based on Symbol + Timeframe + Candle Timestamp + Direction
      const uniqueSignalId = `SIG_${symbol}_${tf}_${recentMarker.time}_${recentMarker.type}`;

      // 2. MULTI-TIER DUPLICATE CHECK
      // Tier 1: Local memory & cache
      const isLocallyAlerted =
        state.lastAlertId === uniqueSignalId ||
        (state.alertedIds && state.alertedIds.includes(uniqueSignalId));

      let isCloudAlerted = false;
      if (!isLocallyAlerted && botToken && chatId) {
        // Tier 2: Persistent Cloud Storage (Telegram getChat pinned message - survives all cold starts & redeploys!)
        const chatInfo = await getTelegramChat(botToken, chatId);
        const pinnedText = chatInfo?.pinned_message?.text || '';
        isCloudAlerted = pinnedText.includes(uniqueSignalId);
        if (isCloudAlerted) {
          // Sync local state to prevent redundant getChat queries
          state.lastAlertId = uniqueSignalId;
          if (!state.alertedIds) state.alertedIds = [];
          if (!state.alertedIds.includes(uniqueSignalId)) state.alertedIds.push(uniqueSignalId);
          saveCronState(state);
        }
      }

      // Check EA State circuit breaker and master toggle
      const eaState = loadEAState();
      const isAutoTradingAllowed = eaState.autoBotEnabled && !eaState.circuitBreakerTripped;

      // If NOT already alerted in local or cloud storage, and trading is active:
      if (!isLocallyAlerted && !isCloudAlerted && recentMarker.time > state.lastAlertTime && isAutoTradingAllowed) {
        // Tier 3: Atomic Lock / Claim Mechanism across concurrent workers
        const acquiredLock = tryAcquireSignalLock(uniqueSignalId);

        if (acquiredLock) {
          // STEP A: DELETE ALL PREVIOUS HOURLY SCANNING HEARTBEATS
          if (state.heartbeatMessageIds && state.heartbeatMessageIds.length > 0) {
            for (const msgId of state.heartbeatMessageIds) {
              try {
                await deleteTelegramDirect(botToken, chatId, msgId);
              } catch (e) {}
            }
            state.heartbeatMessageIds = [];
          }

          // STEP B: COMPOSE EXACT CLEAN TRADE SIGNAL MESSAGE
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
            `✅ TP1: ${tp1Price.toFixed(2)}`,
          ];

          if (showTp2) {
            lines.push(`✅ TP2: ${tp2Price.toFixed(2)}`);
          }
          if (showTp3) {
            lines.push(`✅ TP3: ${tp3Price.toFixed(2)}`);
          }

          lines.push(`🛑 Stop Loss: ${slPrice.toFixed(2)}`);
          lines.push('');
          lines.push('⚖️ Risk: 1–2% only');
          lines.push('');
          lines.push('🚨Mire this time must be comeback! Never revenge');
          lines.push('');
          lines.push(`<tg-spoiler>#${uniqueSignalId}</tg-spoiler>`);

          const alertMessage = lines.join('\n');

          const tgRes = await sendTelegramDirect(botToken, chatId, alertMessage);
          if (tgRes.ok && tgRes.messageId) {
            newSignalSent = true;
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
            };

            // Pin to Telegram Persistent Cloud Storage so ANY cold start knows it's already sent
            await pinTelegramDirect(botToken, chatId, tgRes.messageId);

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

            // Instantly queue this confirmed breakout signal for MT5 EA
            queueNewSignalForEA({
              id: uniqueSignalId,
              symbol,
              type: isBull ? 'BUY' : 'SELL',
              entryPrice,
              slPrice,
              tp1Price,
              tp2Price,
              tp3Price,
              slPips,
              tp1Pips,
              tp2Pips,
              tp3Pips,
              lotSize: eaState.lotSize || 0.001,
            });

            // Instant SMS notification via smsethiopia.com
            try {
              const cloudCfg = loadAlertConfig();
              const smsKey = (req.query?.smsKey || body.smsKey || cloudCfg.smsApiKey || 'X5UZHVO1BTC9VTNGXPAR4BJQCDCLLOPYPEJ6U4H6').toString();
              const smsPhone = (req.query?.smsPhone || body.smsPhone || cloudCfg.smsPhone || '251968865885').toString();
              const smsEnabled = req.query?.sms !== undefined ? (req.query.sms === 'true' || req.query.sms === '1') : (cloudCfg.smsAlertsEnabled !== false);

              if (smsEnabled && smsKey && smsPhone) {
                const smsText = formatTradeSignalSms({
                  type: isBull ? 'BUY' : 'SELL',
                  symbolName,
                  tf,
                  entryPrice,
                  slPrice,
                  tp1Price,
                  slPips,
                  tp1Pips,
                });
                sendSmsDirect(smsKey, smsPhone, smsText).catch((err) => {
                  console.error('Failed to send SMS alert:', err);
                });
              }
            } catch (smsErr) {
              console.error('SMS notification error:', smsErr);
            }
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
      candlesCount: candles.length,
      latestClose: latestCandle.close,
      trend: msttResult.dashboard?.trendStr || 'Neutral',
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
