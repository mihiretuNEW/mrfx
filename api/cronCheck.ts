import fs from 'fs';
import path from 'path';
import WebSocketNode from 'ws';
import { loadAlertConfig, sendTelegramDirect } from './cloudAlertConfig';
import { calculateMarketStructureTargetTracker } from '../src/utils/marketStructureTargetTracker';
import { Candle } from '../src/types';

const LAST_ALERT_FILE = path.join('/tmp', 'mcharts_last_alerted_signal.json');

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

function getLastAlertedTime(): number {
  try {
    if (fs.existsSync(LAST_ALERT_FILE)) {
      const data = fs.readFileSync(LAST_ALERT_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return Number(parsed.lastAlertTime) || 0;
    }
  } catch (e) {}
  return 0;
}

function setLastAlertedTime(time: number, details: any) {
  try {
    fs.writeFileSync(LAST_ALERT_FILE, JSON.stringify({ lastAlertTime: time, details, recordedAt: Date.now() }), 'utf-8');
  } catch (e) {
    console.error('Failed to save last alerted time:', e);
  }
}

async function fetchDerivCandles(symbol: string, granularity: number, count = 300): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const wsUrl = 'wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089';
    const WebSocketClass = (globalThis as any).WebSocket || WebSocketNode;
    if (!WebSocketClass) {
      return reject(new Error('WebSocket is not available in Node environment'));
    }

    const ws = new WebSocketClass(wsUrl);
    const timeout = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      reject(new Error('Deriv WebSocket timed out after 7 seconds'));
    }, 7000);

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
  // Support both GET (from cron-job.org) and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const config = loadAlertConfig();
  const botToken = config.botToken?.trim();
  const chatId = config.chatId?.trim();

  // If alerts are disabled or bot token is missing, report status
  if (!config.enabled || !botToken || !chatId) {
    return res.status(200).json({
      ok: true,
      status: 'idle',
      message: !config.enabled
        ? 'Cloud Alert is currently DISABLED in settings.'
        : 'Bot Token or Chat ID not configured. Please enter them in Settings -> Telegram Cloud Alert.',
      enabled: config.enabled,
    });
  }

  const symbol = config.symbol || '1HZ75V';
  const tf = config.timeframe || '1H';
  const granularity = TIMEFRAME_SECONDS[tf] || 3600;

  try {
    // 1. Fetch live candles directly from Deriv
    const candles = await fetchDerivCandles(symbol, granularity, 350);
    if (!candles || candles.length < 20) {
      return res.status(200).json({
        ok: false,
        error: 'Insufficient candles returned from Deriv API',
      });
    }

    // 2. Run Market Structure Target Tracker calculation with user's EXACT active settings
    const msttResult = calculateMarketStructureTargetTracker(candles, config.options, symbol);
    const markers = msttResult.signalMarkers || [];
    const lastCandleIdx = candles.length - 1;
    const latestCandle = candles[lastCandleIdx];

    // Check if the most recent signal marker occurred on the current or previous candle
    const recentMarker = markers.length > 0 ? markers[markers.length - 1] : null;
    const lastAlertedTime = getLastAlertedTime();

    let newSignalSent = false;
    let signalInfo: any = null;

    if (recentMarker && (recentMarker.barIndex === lastCandleIdx || recentMarker.barIndex === lastCandleIdx - 1)) {
      // Check if this signal timestamp has already been sent to Telegram
      if (recentMarker.time > lastAlertedTime) {
        const isBull = recentMarker.type === 'bull';
        const dirEmoji = isBull ? '🟢' : '🔴';
        const dirName = isBull ? 'BUY (BULLISH BOS)' : 'SELL (BEARISH BOS)';
        const entryPrice = msttResult.entryPrice || latestCandle.close;
        const slPrice = msttResult.slPrice;
        const tp1Price = msttResult.tp1Price;
        const tp2Price = msttResult.tp2Price;
        const rrStr = msttResult.dashboard.rrStr || '1:4.2 R';

        // Format professional HTML Telegram Message
        const message =
          `⚡ <b>NEW BOS SIGNAL TRIGGERED!</b> ⚡\n\n` +
          `📊 <b>Pair:</b> <code>${symbol}</code> (Volatility 75 1s)\n` +
          `⏱ <b>Timeframe:</b> <code>${tf}</code>\n` +
          `${dirEmoji} <b>Direction:</b> <b>${dirName}</b>\n\n` +
          `🎯 <b>Execution Levels:</b>\n` +
          `• <b>Entry:</b> <code>${entryPrice?.toFixed(2)}</code>\n` +
          `• <b>Stop Loss (SL):</b> <code>${slPrice ? slPrice.toFixed(2) : '—'}</code> (${config.options?.pointsSl || 220} pts)\n` +
          `• <b>Take Profit (TP1):</b> <code>${tp1Price ? tp1Price.toFixed(2) : '—'}</code> (${config.options?.pointsTp1 || 1030} pts)\n` +
          (tp2Price ? `• <b>Take Profit (TP2):</b> <code>${tp2Price.toFixed(2)}</code>\n` : '') +
          `🛡️ <b>Active Rules & Applied Settings:</b>\n` +
          `• SL Size: <b>${config.options?.pointsSl || 220} pts</b> | TP1: <b>${config.options?.pointsTp1 || 1030} pts</b>\n` +
          `• Win Benchmark: <b>${config.options?.targetFocus || 'TP1'}</b>\n` +
          `• Anti-Lag & Overextension Check: <b>${config.options?.preventLateEntry !== false ? '✅ Active' : '❌ Off'}</b>\n` +
          `• Candle Body Close: <b>${config.options?.useBodyCloseFilter !== false ? '✅ Active' : '❌ Off'}</b>\n` +
          `• Extreme Wick Filter: <b>${config.options?.useWickFilter !== false ? '✅ Active' : '❌ Off'}</b>\n\n` +
          `📅 <b>Signal Time:</b> ${new Date(recentMarker.time * 1000).toUTCString()}\n` +
          `🤖 <i>Auto-monitored 24/7 by M-Charts Cloud Cron</i>`;

        const tgRes = await sendTelegramDirect(botToken, chatId, message);
        if (tgRes.ok) {
          newSignalSent = true;
          signalInfo = {
            type: recentMarker.type,
            time: recentMarker.time,
            entryPrice,
            slPrice,
            tp1Price,
          };
          setLastAlertedTime(recentMarker.time, signalInfo);
        } else {
          console.error('Failed to send Telegram message:', tgRes);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      symbol,
      timeframe: tf,
      candlesCount: candles.length,
      latestClose: latestCandle.close,
      trend: msttResult.dashboard.trendStr,
      recentSignal: recentMarker ? {
        type: recentMarker.type,
        time: recentMarker.time,
        barIndex: recentMarker.barIndex,
      } : null,
      signalSent: newSignalSent,
      signalDetails: signalInfo,
    });
  } catch (error: any) {
    console.error('Cron check error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error occurred during market analysis',
    });
  }
}
