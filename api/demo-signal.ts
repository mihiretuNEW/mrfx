import { loadAlertConfig, saveAlertConfig } from './_lib/cloudAlertConfig.js';
import { executeDerivMultiplierTrade } from './_lib/derivTrader.js';

async function parseBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf-8'));
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c: any) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function sendTelegramDirect(botToken: string, chatId: string, text: string) {
  if (!botToken || !chatId) return { ok: false, error: 'No Telegram credentials' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok), messageId: data.result?.message_id, data };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

export default async function handler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, KEY, Authorization');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = await parseBody(req);
    const query = req.query || {};
    const config = loadAlertConfig();

    const targetBotToken = (body.botToken || body.tgBotToken || query.botToken || query.token || config.botToken || '').trim();
    const targetChatId = (body.chatId || body.tgChatId || query.chatId || query.chat || config.chatId || '').toString().trim();

    const tf = (body.tf || body.timeframe || body.msttTgTimeframe || query.tf || query.timeframe || config.timeframe || '30M').toString();
    const slPips = Number(body.slPips || body.msttPointsSl || body.pointsSl || body.sl || query.slPips || query.sl || config.options?.pointsSl || 220);
    const tp1Pips = Number(body.tp1Pips || body.msttPointsTp1 || body.pointsTp1 || body.tp1 || query.tp1Pips || query.tp1 || config.options?.pointsTp1 || 450);

    // Auto-persist new bot credentials and settings to cloud config
    saveAlertConfig({
      botToken: targetBotToken || undefined,
      chatId: targetChatId || undefined,
      timeframe: tf,
      options: {
        pointsSl: slPips,
        pointsTp1: tp1Pips,
        ...(body.stake ? { derivStake: Number(body.stake) } : {}),
        ...(body.multiplier ? { derivMultiplier: Number(body.multiplier) } : {}),
        ...(body.takeProfitUsd ? { derivTakeProfitUsd: Number(body.takeProfitUsd) } : {}),
        ...(body.stopLossUsd ? { derivStopLossUsd: Number(body.stopLossUsd) } : {}),
      },
    });

    const action: 'BUY' | 'SELL' = (body.action || query.action || 'BUY').toString().toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
    const symbol = (body.symbol || query.symbol || config.symbol || 'R_75').toString();

    // Approximate baseline price for synthetic demo testing if not provided
    const basePrice = Number(body.entryPrice || query.entryPrice || 35500.0);
    const isBull = action === 'BUY';
    const entryPrice = basePrice;
    const slPrice = isBull ? (entryPrice - slPips) : (entryPrice + slPips);
    const tp1Price = isBull ? (entryPrice + tp1Pips) : (entryPrice - tp1Pips);

    const demoSignalId = `DEMO_${symbol}_${action}_${Date.now()}`;
    const timestamp = Date.now();

    const signalData = {
      id: demoSignalId,
      symbol,
      type: action,
      tf,
      entryPrice,
      slPrice,
      tp1Price,
      slPips,
      tp1Pips,
      isDemo: true,
      createdAt: timestamp,
    };

    // Execute on Deriv Demo Account if configured
    let derivResult: any = null;
    const derivToken = (body.derivApiToken || config.options?.derivApiToken || 'pat_3bd79e08a0c497fd3850ea056cd21b67f4c249278925d700c8d6ab45fc832a93').trim();
    const derivAppId = (body.derivAppId || config.options?.derivAppId || '34TqYcyq1e1ZVYR74xqTh').trim();

    if (derivToken && derivAppId) {
      derivResult = await executeDerivMultiplierTrade({
        token: derivToken,
        appId: derivAppId,
        mode: 'demo', // Always demo for test signal simulation
        action,
        symbol: 'R_75',
        stake: Number(body.stake || config.options?.derivStake || 2.0),
        multiplier: Number(body.multiplier || config.options?.derivMultiplier || 200),
        takeProfitUsd: Number(body.takeProfitUsd || config.options?.derivTakeProfitUsd || 6.68),
        stopLossUsd: Number(body.stopLossUsd || config.options?.derivStopLossUsd || 2.0),
      }).catch((e: any) => ({ ok: false, error: e?.message || 'Trade execution failed' }));
    }

    // Telegram Dispatch
    let tgResult: any = { ok: false, error: 'Telegram botToken and chatId not configured' };
    if (targetBotToken && targetChatId) {
      let tgText =
        `🧪 <b>DEMO TEST SIGNAL</b> (Mire Live Simulation)\n\n` +
        `🪙 Pair: Volatility 75 index\n` +
        `${isBull ? '📈 Direction: BUY (Long)' : '📉 Direction: SELL (Short)'}\n` +
        `⏰ Timeframe: ${tf}\n\n` +
        `🎯 Entry: ${entryPrice.toFixed(2)}\n` +
        `✅ TP: ${tp1Price.toFixed(2)} (+${tp1Pips} pips)\n` +
        `🛑 Stop Loss: ${slPrice.toFixed(2)} (-${slPips} pips)\n\n` +
        `⚖️ Mode: <b>DEMO / TEST</b>`;

      if (derivResult?.ok) {
        tgText +=
          `\n\n⚡ <b>DERIV DEMO ORDER PLACED!</b>\n` +
          `🆔 Contract: <code>#${derivResult.contractId}</code>\n` +
          `💵 Stake: <b>$${derivResult.stake?.toFixed(2)} USD</b> (${derivResult.multiplier}x)\n` +
          `🎯 TP: +$${derivResult.takeProfit?.toFixed(2)} | 🛑 SL: -$${derivResult.stopLoss?.toFixed(2)}\n` +
          `💰 Balance After: <b>$${derivResult.balanceAfter?.toFixed(2) ?? '---'} USD</b>`;
      } else if (derivResult && !derivResult.ok) {
        tgText += `\n\n⚠️ Deriv Order: ${derivResult.error}`;
      }

      tgText += `\n\n<tg-spoiler>#${demoSignalId}</tg-spoiler>`;

      tgResult = await sendTelegramDirect(targetBotToken, targetChatId, tgText);
    }

    return res.status(200).json({
      ok: true,
      message: `✅ Demo ${action} Signal dispatched!`,
      signal: signalData,
      telegram: tgResult,
      deriv: derivResult,
    });
  } catch (err: any) {
    console.error('Error in /api/demo-signal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error occurred while dispatching demo signal',
    });
  }
}
