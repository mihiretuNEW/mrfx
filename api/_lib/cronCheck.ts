import fs from 'fs';
import path from 'path';
import WebSocketNode from 'ws';
import { loadAlertConfig, sendTelegramDirect, deleteTelegramDirect } from './cloudAlertConfig';
import { calculateMarketStructureTargetTracker } from '../../src/utils/marketStructureTargetTracker';
import { Candle } from '../../src/types';

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
  slPips: number;
  tp1Pips: number;
  tp2Pips?: number;
  showTp1: boolean;
  showTp2: boolean;
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
  lastHeartbeatTime: number;
  heartbeatMessageIds: number[];
  activeTrade: ActiveTrade | null;
  tradeHistory: TradeRecord[];
  lastWeeklyReportTime: number;
}

const DEFAULT_STATE: CronState = {
  lastAlertTime: 0,
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
  if (symbol === 'R_75') return 'Volatility 75 Index';
  if (symbol === '1HZ75V') return 'Volatility 75 (1s) Index';
  if (symbol === 'R_100') return 'Volatility 100 Index';
  if (symbol === '1HZ100V') return 'Volatility 100 (1s) Index';
  if (symbol === 'R_50') return 'Volatility 50 Index';
  if (symbol === 'R_25') return 'Volatility 25 Index';
  if (symbol === 'R_10') return 'Volatility 10 Index';
  return symbol;
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

export default async function cronCheckHandler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const config = loadAlertConfig();
  const botToken = (req.query?.token || req.query?.botToken || body.botToken || config.botToken)?.toString()?.trim();
  const chatId = (req.query?.chat || req.query?.chatId || body.chatId || config.chatId)?.toString()?.trim();
  const isEnabled = req.query?.enabled !== undefined
    ? (req.query.enabled === 'true' || req.query.enabled === '1')
    : (body.enabled !== undefined ? Boolean(body.enabled) : (config.enabled || Boolean(botToken && chatId)));

  if (!isEnabled || !botToken || !chatId) {
    return res.status(200).json({
      ok: true,
      status: 'idle',
      message: !isEnabled
        ? 'Cloud Alert is currently DISABLED in settings.'
        : 'Bot Token or Chat ID not configured. Please enter them in Settings -> Telegram Cloud Alert.',
      enabled: isEnabled,
    });
  }

  const symbol = (req.query?.symbol || body.symbol || config.symbol || 'R_75').toString();
  const tf = (req.query?.tf || req.query?.timeframe || body.timeframe || config.timeframe || '30M').toString();
  const granularity = TIMEFRAME_SECONDS[tf] || 1800; // 30M default = 1800s
  const symbolName = getSymbolDisplayName(symbol);

  const mergedOptions: Record<string, any> = {
    targetMode: 'points',
    pointsSl: 220,
    pointsTp1: 450,
    pointsTp2: 650,
    pointsTp3: 1000,
    showTp1: true,
    showTp2: false,
    showTp3: false,
    showSl: true,
    targetFocus: 'TP1',
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
    ...config.options,
    ...(body.options || {}),
  };

  if (req.query?.sl) mergedOptions.pointsSl = Number(req.query.sl);
  if (req.query?.tp1) mergedOptions.pointsTp1 = Number(req.query.tp1);
  if (req.query?.tp2) mergedOptions.pointsTp2 = Number(req.query.tp2);
  if (req.query?.showTp1 !== undefined) mergedOptions.showTp1 = req.query.showTp1 === 'true' || req.query.showTp1 === '1';
  if (req.query?.showTp2 !== undefined) mergedOptions.showTp2 = req.query.showTp2 === 'true' || req.query.showTp2 === '1';
  if (req.query?.targetFocus) mergedOptions.targetFocus = req.query.targetFocus.toString();

  const slPips = Number(mergedOptions.pointsSl) || 220;
  const tp1Pips = Number(mergedOptions.pointsTp1) || 450;
  const tp2Pips = Number(mergedOptions.pointsTp2) || 650;
  const showTp1 = mergedOptions.showTp1 !== false;
  const showTp2 = Boolean(mergedOptions.showTp2);

  const state = loadCronState();
  const now = Date.now();

  try {
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
      // Evaluate recent candles that occurred during or after trade entry
      const checkCandles = candles.filter((c) => c.time >= active.entryCandleTime);

      for (const candle of checkCandles) {
        if (active.type === 'bull') {
          // Bullish: High hits TP1, Low hits SL
          if (active.showTp1 && candle.high >= active.tp1Price) {
            tradeResolved = true;
            const pipsWon = active.tp1Pips;
            resolutionMessage =
              `🎯 <b>TARGET 1 HIT! (+${pipsWon} Pips Profit) 🚀</b>\n\n` +
              `📊 <b>Pair:</b> <code>${symbolName}</code>\n` +
              `⏱ <b>Timeframe:</b> <code>${active.tf}</code>\n` +
              `🟢 <b>Trade:</b> BUY / LONG\n\n` +
              `💵 <b>Entry Price:</b> <code>${active.entryPrice.toFixed(2)}</code>\n` +
              `🎯 <b>Exit (TP1):</b> <code>${active.tp1Price.toFixed(2)}</code>\n` +
              `💰 <b>Outcome:</b> <b>+${pipsWon} Pips WIN!</b> 🔥\n` +
              `📅 <b>Closed At:</b> ${new Date().toUTCString()}\n\n` +
              `<i>Discipline rewarded! Profit locked in MT5.</i>`;

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
            state.activeTrade = null;
            await sendTelegramDirect(botToken, chatId, resolutionMessage);
            break;
          } else if (candle.low <= active.slPrice) {
            tradeResolved = true;
            const pipsLost = active.slPips;
            resolutionMessage =
              `🛑 <b>STOP LOSS HIT (-${pipsLost} Pips)</b>\n\n` +
              `📊 <b>Pair:</b> <code>${symbolName}</code>\n` +
              `⏱ <b>Timeframe:</b> <code>${active.tf}</code>\n` +
              `🔴 <b>Trade:</b> BUY / LONG\n\n` +
              `💵 <b>Entry Price:</b> <code>${active.entryPrice.toFixed(2)}</code>\n` +
              `🛑 <b>Exit (SL):</b> <code>${active.slPrice.toFixed(2)}</code>\n` +
              `📉 <b>Outcome:</b> <b>-${pipsLost} Pips Loss</b>\n` +
              `📅 <b>Closed At:</b> ${new Date().toUTCString()}\n\n` +
              `<i>Protected by exact Stop Loss. Next setup will follow rules!</i>`;

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
            state.activeTrade = null;
            await sendTelegramDirect(botToken, chatId, resolutionMessage);
            break;
          }
        } else if (active.type === 'bear') {
          // Bearish: Low hits TP1, High hits SL
          if (active.showTp1 && candle.low <= active.tp1Price) {
            tradeResolved = true;
            const pipsWon = active.tp1Pips;
            resolutionMessage =
              `🎯 <b>TARGET 1 HIT! (+${pipsWon} Pips Profit) 🚀</b>\n\n` +
              `📊 <b>Pair:</b> <code>${symbolName}</code>\n` +
              `⏱ <b>Timeframe:</b> <code>${active.tf}</code>\n` +
              `🔴 <b>Trade:</b> SELL / SHORT\n\n` +
              `💵 <b>Entry Price:</b> <code>${active.entryPrice.toFixed(2)}</code>\n` +
              `🎯 <b>Exit (TP1):</b> <code>${active.tp1Price.toFixed(2)}</code>\n` +
              `💰 <b>Outcome:</b> <b>+${pipsWon} Pips WIN!</b> 🔥\n` +
              `📅 <b>Closed At:</b> ${new Date().toUTCString()}\n\n` +
              `<i>Discipline rewarded! Profit locked in MT5.</i>`;

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
            state.activeTrade = null;
            await sendTelegramDirect(botToken, chatId, resolutionMessage);
            break;
          } else if (candle.high >= active.slPrice) {
            tradeResolved = true;
            const pipsLost = active.slPips;
            resolutionMessage =
              `🛑 <b>STOP LOSS HIT (-${pipsLost} Pips)</b>\n\n` +
              `📊 <b>Pair:</b> <code>${symbolName}</code>\n` +
              `⏱ <b>Timeframe:</b> <code>${active.tf}</code>\n` +
              `🔴 <b>Trade:</b> SELL / SHORT\n\n` +
              `💵 <b>Entry Price:</b> <code>${active.entryPrice.toFixed(2)}</code>\n` +
              `🛑 <b>Exit (SL):</b> <code>${active.slPrice.toFixed(2)}</code>\n` +
              `📉 <b>Outcome:</b> <b>-${pipsLost} Pips Loss</b>\n` +
              `📅 <b>Closed At:</b> ${new Date().toUTCString()}\n\n` +
              `<i>Protected by exact Stop Loss. Risk managed properly!</i>`;

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
            state.activeTrade = null;
            await sendTelegramDirect(botToken, chatId, resolutionMessage);
            break;
          }
        }
      }
    }

    // =========================================================================
    // 2. CHECK FOR NEW BREAKOUT SIGNAL
    // =========================================================================
    const msttResult = calculateMarketStructureTargetTracker(candles, mergedOptions, symbol);
    const markers = msttResult.signalMarkers || [];
    const recentMarker = markers.length > 0 ? markers[markers.length - 1] : null;

    let newSignalSent = false;
    let signalInfo: any = null;

    // Check if the signal marker is fresh (on the last bar or the bar right before)
    if (recentMarker && (recentMarker.barIndex === lastCandleIdx || recentMarker.barIndex === lastCandleIdx - 1)) {
      if (recentMarker.time > state.lastAlertTime) {
        // ---------------------------------------------------------------------
        // STEP A: DELETE ALL PREVIOUS HOURLY SCANNING HEARTBEATS FROM TELEGRAM
        // ---------------------------------------------------------------------
        if (state.heartbeatMessageIds && state.heartbeatMessageIds.length > 0) {
          for (const msgId of state.heartbeatMessageIds) {
            try {
              await deleteTelegramDirect(botToken, chatId, msgId);
            } catch (e) {
              console.warn(`Failed to delete heartbeat message ${msgId}:`, e);
            }
          }
          state.heartbeatMessageIds = [];
        }

        // ---------------------------------------------------------------------
        // STEP B: COMPOSE EXACT MT5 ORDER SIGNAL MESSAGE
        // ---------------------------------------------------------------------
        const isBull = recentMarker.type === 'bull';
        const dirEmoji = isBull ? '🟢' : '🔴';
        const actionText = isBull ? 'BUY NOW' : 'SELL NOW';
        const entryPrice = recentMarker.entryPrice || msttResult.entryPrice || latestCandle.close;

        // Calculate exact price levels based on configured pips
        const slPrice = isBull ? (entryPrice - slPips) : (entryPrice + slPips);
        const tp1Price = isBull ? (entryPrice + tp1Pips) : (entryPrice - tp1Pips);
        const tp2Price = isBull ? (entryPrice + tp2Pips) : (entryPrice - tp2Pips);
        const rrRatio = (tp1Pips / slPips).toFixed(2);

        const alertMessage =
          `🚨 <b>URGENT MT5 TRADE SIGNAL!</b> 🚨\n\n` +
          `📊 <b>Pair:</b> <code>${symbolName}</code> (${symbol})\n` +
          `⏱ <b>Timeframe:</b> <code>${tf}</code>\n` +
          `${dirEmoji} <b>Action:</b> <b>${actionText}</b>\n\n` +
          `📋 <b>MT5 ORDER DETAILS (TAP TO COPY):</b>\n` +
          `• <b>Entry:</b> <code>${entryPrice.toFixed(2)}</code>\n` +
          `• <b>Stop Loss (SL):</b> <code>${slPrice.toFixed(2)}</code> (${slPips} pips)\n` +
          (showTp1 ? `• <b>Take Profit (TP1):</b> <code>${tp1Price.toFixed(2)}</code> (${tp1Pips} pips)\n` : '') +
          (showTp2 ? `• <b>Take Profit (TP2):</b> <code>${tp2Price.toFixed(2)}</code> (${tp2Pips} pips)\n` : '') +
          `• <b>Recommended Lot:</b> <code>0.001</code>\n\n` +
          `🎯 <b>Target Ratio:</b> <b>1:${rrRatio}</b> (High Probability Setup)\n` +
          `🛡️ <b>Strategy:</b> BOS Structure Breakout + Filters\n` +
          `📅 <b>Signal Time:</b> ${new Date(recentMarker.time * 1000).toUTCString()}\n\n` +
          `🔔 <i>ይህንን መልዕክት በሰማህ ጊዜ MT5ህን ከፍተህ ከላይ ያሉትን Entry፣ SL እና TP በ 10 ሰከንድ ውስጥ አስገባ።</i>`;

        const tgRes = await sendTelegramDirect(botToken, chatId, alertMessage);
        if (tgRes.ok) {
          newSignalSent = true;
          signalInfo = {
            type: recentMarker.type,
            time: recentMarker.time,
            entryPrice,
            slPrice,
            tp1Price,
            tp2Price,
            slPips,
            tp1Pips,
            tp2Pips,
          };
          state.lastAlertTime = recentMarker.time;
          state.activeTrade = {
            id: `${symbol}_${recentMarker.time}`,
            symbol,
            tf,
            type: isBull ? 'bull' : 'bear',
            entryPrice,
            slPrice,
            tp1Price,
            tp2Price,
            slPips,
            tp1Pips,
            tp2Pips,
            showTp1,
            showTp2,
            startTime: recentMarker.time,
            entryCandleTime: latestCandle.time,
          };
        } else {
          console.error('Failed to send Telegram message:', tgRes);
        }
      }
    }

    // =========================================================================
    // 3. HOURLY SCANNING HEARTBEAT (WHEN NO SIGNAL IS PRESENT)
    // =========================================================================
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (!newSignalSent && !state.activeTrade && (now - state.lastHeartbeatTime >= ONE_HOUR_MS)) {
      const scanMessage =
        `⏳ <b>MARKET SCANNING ACTIVE...</b>\n\n` +
        `📊 <b>Pair:</b> <code>${symbolName}</code> (${symbol})\n` +
        `⏱ <b>Timeframe:</b> <code>${tf}</code>\n` +
        `📡 <b>Status:</b> All 30M candles scanning normally. No BOS setup yet.\n` +
        `🛡️ <b>Target Config:</b> SL ${slPips} pips | TP ${tp1Pips} pips\n` +
        `⏰ <b>Scan Time:</b> ${new Date().toUTCString()}\n\n` +
        `<i>(ይህ መልእክት አዲስ የ BUY ወይም SELL ሲግናል ሲመጣ በራሱ ይሰረዛል!)</i>`;

      const hbRes = await sendTelegramDirect(botToken, chatId, scanMessage);
      if (hbRes.ok && hbRes.messageId) {
        state.heartbeatMessageIds.push(hbRes.messageId);
        state.lastHeartbeatTime = now;
      }
    }

    // =========================================================================
    // 4. WEEKLY 7-DAY PERFORMANCE RECAP
    // =========================================================================
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (now - state.lastWeeklyReportTime >= SEVEN_DAYS_MS) {
      const weekStart = now - SEVEN_DAYS_MS;
      const weekTrades = state.tradeHistory.filter((t) => t.closedAt >= weekStart);
      const wins = weekTrades.filter((t) => t.type === 'win').length;
      const losses = weekTrades.filter((t) => t.type === 'loss').length;
      const total = wins + losses;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
      const netPips = weekTrades.reduce((acc, t) => acc + t.pips, 0);

      const recapMessage =
        `📊 <b>7-DAY PERFORMANCE RECAP</b> 📊\n\n` +
        `📈 <b>Weekly Summary for ${symbolName} (${tf}):</b>\n\n` +
        `🔢 <b>Total Completed Trades:</b> <b>${total}</b>\n` +
        `🏆 <b>Wins:</b> <b>${wins}</b>\n` +
        `❌ <b>Losses:</b> <b>${losses}</b>\n` +
        `🎯 <b>Win Rate:</b> <b>${winRate}%</b>\n` +
        `💰 <b>Net Pips:</b> <b>${netPips >= 0 ? '+' : ''}${netPips} Pips</b>\n\n` +
        `🛡️ <i>Consistency beats emotion. Stick to 220 SL / 450 TP with 0.001 lot!</i>`;

      const recapRes = await sendTelegramDirect(botToken, chatId, recapMessage);
      if (recapRes.ok) {
        state.lastWeeklyReportTime = now;
      }
    }

    // Persist all state updates
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
  } catch (error: any) {
    console.error('Cron check error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error occurred during market analysis',
    });
  }
}
