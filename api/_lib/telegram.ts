import { loadAlertConfig } from './cloudAlertConfig.js';

const PASSCODE = 'Mihiretu12$0962862284';

export async function sendTelegramMessage(text: string, customToken?: string, customChatId?: string) {
  const cfg = loadAlertConfig();
  const token = (customToken || cfg.botToken || '').trim();
  const chatId = (customChatId || cfg.chatId || '').toString().trim();

  if (!token || !chatId) {
    return { ok: false, error: 'Telegram Bot Token እና Chat ID አልተዋቀረም (Bot Token and Chat ID required). Please set them in Settings.' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Telegram API Error:', err);
    return { ok: false, error: err.message };
  }
}

export default async function telegramHandler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { action, passcode, text, botToken, chatId } = body;

    if (action === 'verify_passcode') {
      if (passcode === PASSCODE) {
        return res.status(200).json({ success: true, verified: true });
      } else {
        return res.status(401).json({ success: false, error: 'Incorrect passcode' });
      }
    }

    if (action === 'send_message') {
      if (!text) {
        return res.status(400).json({ success: false, error: 'Message text is required' });
      }
      const tgRes = await sendTelegramMessage(text, botToken, chatId);
      if (tgRes.ok) {
        return res.status(200).json({ success: true, messageId: tgRes.result?.message_id });
      } else {
        return res.status(500).json({ success: false, error: tgRes.description || tgRes.error || 'Failed to send Telegram message' });
      }
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
