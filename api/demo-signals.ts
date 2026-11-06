import { loadAlertConfig, saveAlertConfig } from './_lib/cloudAlertConfig.js';
import { queueNewSignalForEA, loadEAState } from './_lib/eaState.js';
import { sendSmsDirect } from './_lib/smsEthiopia.js';
import { sendGitHubDispatch } from './_lib/githubDispatch.js';

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
    const eaState = loadEAState();

    const targetBotToken = (body.botToken || body.tgBotToken || query.botToken || query.token || config.botToken || '').trim();
    const targetChatId = (body.chatId || body.tgChatId || query.chatId || query.chat || config.chatId || '').toString().trim();

    // Auto-persist new bot credentials if provided
    if (body.botToken || body.chatId) {
      saveAlertConfig({
        botToken: targetBotToken || undefined,
        chatId: targetChatId || undefined,
      });
    }

    const action: 'BUY' | 'SELL' = (body.action || query.action || 'BUY').toString().toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
    const symbol = (body.symbol || query.symbol || config.symbol || 'R_75').toString();
    const tf = (body.tf || query.tf || config.timeframe || '30M').toString();
    const lot = Number(body.lot || query.lot || eaState.lotSize || 0.001);

    const slPips = Number(body.slPips || query.slPips || config.options?.pointsSl || 220);
    const tp1Pips = Number(body.tp1Pips || query.tp1Pips || config.options?.pointsTp1 || 450);

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
      lotSize: lot,
      isDemo: true,
      createdAt: timestamp,
    };

    // Parallel multi-channel dispatch
    const [tgResult, smsResult, ghResult, eaResult] = await Promise.all([
      // 1. Telegram
      (async () => {
        if (!targetBotToken || !targetChatId) return { ok: false, error: 'Telegram botToken and chatId not configured' };

        const tgText =
          `🧪 <b>DEMO TEST SIGNAL</b> (Mire Live Simulation)\n\n` +
          `🪙 Pair: Volatility 75 index\n` +
          `${isBull ? '📈 Direction: BUY (Long)' : '📉 Direction: SELL (Short)'}\n` +
          `⏰ Timeframe: ${tf}\n\n` +
          `🎯 Entry: ${entryPrice.toFixed(2)}\n` +
          `✅ TP1: ${tp1Price.toFixed(2)} (+${tp1Pips} pips)\n` +
          `🛑 Stop Loss: ${slPrice.toFixed(2)} (-${slPips} pips)\n` +
          `📦 Lot: ${lot}\n\n` +
          `⚖️ Mode: <b>DEMO / TEST</b>\n` +
          `🚀 Dispatched simultaneously to MT5 EA & GitHub VPS Dispatch!\n\n` +
          `<tg-spoiler>#${demoSignalId}</tg-spoiler>`;

        return sendTelegramDirect(targetBotToken, targetChatId, tgText);
      })(),

      // 2. Ethiopian SMS
      (async () => {
        const smsKey = (body.smsApiKey || config.smsApiKey || 'X5UZHVO1BTC9VTNGXPAR4BJQCDCLLOPYPEJ6U4H6').trim();
        const smsPhone = (body.smsPhone || config.smsPhone || '251968865885').trim();
        if (!smsKey || !smsPhone) return { ok: false, error: 'SMS not configured' };

        const smsText =
          `🧪 DEMO ${action} SIGNAL!\n` +
          `Pair: ${symbol} (${tf})\n` +
          `Entry: ${entryPrice.toFixed(2)}\n` +
          `TP: ${tp1Price.toFixed(2)} (+${tp1Pips})\n` +
          `SL: ${slPrice.toFixed(2)} (-${slPips})\n` +
          `Lot: ${lot} - Mire test connected!`;

        return sendSmsDirect(smsKey, smsPhone, smsText);
      })(),

      // 3. GitHub Repository Dispatch
      (async () => {
        const owner = (body.githubOwner || config.githubOwner || 'mihiretuNEW').trim();
        const repo = (body.githubRepo || config.githubRepo || 'my-vps').trim();
        const token = (body.githubToken || config.githubToken || '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').trim();

        return sendGitHubDispatch(owner, repo, token, {
          id: demoSignalId,
          symbol,
          action,
          lot,
          entryPrice,
          sl: slPrice,
          tp: tp1Price,
          slPips,
          tpPips: tp1Pips,
          isDemo: true,
          timestamp,
        });
      })(),

      // 4. MT5 EA Queue
      (async () => {
        try {
          const queueRes = queueNewSignalForEA({
            id: demoSignalId,
            symbol,
            type: action,
            entryPrice,
            slPrice,
            tp1Price,
            slPips,
            tp1Pips,
            lotSize: lot,
          });
          return { ok: true, queue: queueRes };
        } catch (e: any) {
          return { ok: false, error: e?.message };
        }
      })(),
    ]);

    // Send ACK summary back to Telegram channel
    const ackSummary =
      `🔔 <b>DEMO ACKNOWLEDGMENT:</b>\n` +
      `✅ Demo Signal: <code>${demoSignalId}</code>\n` +
      `• Telegram: ${tgResult.ok ? '✅ Sent' : '❌ Failed'}\n` +
      `• SMS: ${smsResult.ok ? '✅ Sent (251968865885)' : '❌ Failed'}\n` +
      `• GitHub (my-vps): ${ghResult.ok ? '✅ Dispatched (204)' : '❌ ' + (ghResult.error || 'Failed')}\n` +
      `• MT5 EA Queue: ${eaResult.ok ? '✅ Queued for MT5 EA' : '❌ Failed'}`;

    if (targetBotToken && targetChatId) {
      sendTelegramDirect(targetBotToken, targetChatId, ackSummary).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      message: `✅ Demo ${action} Signal dispatched across all channels!`,
      signal: signalData,
      destinations: {
        telegram: tgResult,
        sms: smsResult,
        github: ghResult,
        eaQueue: eaResult,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/demo-signal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error occurred while dispatching demo signal',
    });
  }
}
