import fs from 'fs';
import path from 'path';
import { sendSmsDirect } from './smsEthiopia.js';

const CONFIG_FILE = path.join('/tmp', 'mcharts_cloud_alert_config.json');

export interface CloudAlertConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  symbol: string;
  timeframe: string;
  updatedAt: number;
  smsApiKey?: string;
  smsPhone?: string;
  smsAlertsEnabled?: boolean;
  options: Record<string, any>;
}

const DEFAULT_CONFIG: CloudAlertConfig = {
  botToken: '8864552579:AAGSXeU9Z-WslGPehNXCxENWKSl1xeEe3FA',
  chatId: '-1004295328271',
  enabled: true,
  symbol: 'R_75',
  timeframe: '30M',
  smsApiKey: 'X5UZHVO1BTC9VTNGXPAR4BJQCDCLLOPYPEJ6U4H6',
  smsPhone: '251968865885',
  smsAlertsEnabled: true,
  updatedAt: Date.now(),
  options: {
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
    usePremiumDiscountFilter: false,
    useInducementFilter: false,
    useKillZonesFilter: false,
    useTurtleSoupFilter: false,
    useRetestConfirmation: false,
    useAntiWhipsawFilter: false,
  },
};

export function loadAlertConfig(): CloudAlertConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.warn('Failed to load alert config from disk, using defaults:', err);
  }
  return DEFAULT_CONFIG;
}

export function saveAlertConfig(config: Partial<CloudAlertConfig>): CloudAlertConfig {
  const current = loadAlertConfig();
  const merged: CloudAlertConfig = {
    ...current,
    ...config,
    updatedAt: Date.now(),
    options: {
      ...current.options,
      ...(config.options || {}),
    },
  };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save alert config to disk:', err);
  }
  return merged;
}

export async function sendTelegramDirect(botToken: string, chatId: string, text: string) {
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

export async function deleteTelegramDirect(botToken: string, chatId: string, messageId: number) {
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

export default async function cloudAlertConfigHandler(req: any, res: any) {
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
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch (e) {
        body = {};
      }
    }

    const action = req.query?.action || body?.action;

    if (req.method === 'GET' && !action) {
      const cfg = loadAlertConfig();
      const masked = {
        ...cfg,
        botToken: cfg.botToken ? `${cfg.botToken.substring(0, 6)}...${cfg.botToken.slice(-4)}` : '',
        hasToken: Boolean(cfg.botToken),
      };
      return res.status(200).json({ ok: true, config: masked });
    }

    if (req.method === 'POST') {
      if (action === 'test_sms' || body.action === 'test_sms') {
        const currentCfg = loadAlertConfig();
        const apiKey = body.smsApiKey || currentCfg.smsApiKey;
        const phone = body.smsPhone || currentCfg.smsPhone;
        if (!apiKey || !phone) {
          return res.status(400).json({ ok: false, error: 'SMS Ethiopia API Key and Phone Number are required.' });
        }
        const testText = '🔔 Mcharts Signal Connected! Your SMS alerts are active. Mire stay disciplined!';
        const smsRes = await sendSmsDirect(apiKey, phone, testText);
        if (smsRes.ok) {
          return res.status(200).json({ ok: true, message: `✅ የሙከራ SMS ወደ ${phone} በተሳካ ሁኔታ ተልኳል! ስልክዎን ይመልከቱ።` });
        } else {
          return res.status(400).json({ ok: false, error: smsRes.error || 'Failed to send SMS via smsethiopia.com' });
        }
      }

      if (action === 'test' || body.action === 'test') {
        const token = body.botToken || loadAlertConfig().botToken;
        const chat = body.chatId || loadAlertConfig().chatId;
        if (!token || !chat) {
          return res.status(400).json({ ok: false, error: 'Telegram Bot Token and Chat ID are required to send a test message.' });
        }
        const testMsg = `🟢 <b>Connected!</b>\n\n` +
          `✅ Telegram Bot successfully connected.\n` +
          `🪙 Pair: Volatility 75 index\n` +
          `⏰ Timeframe: ${body.timeframe || '30M'}`;

        const result = await sendTelegramDirect(token, chat, testMsg);
        if (result.ok) {
          return res.status(200).json({ ok: true, message: 'Test message sent successfully to your Telegram!' });
        } else {
          return res.status(400).json({ ok: false, error: result.description || result.error || 'Failed to send message via Telegram API' });
        }
      }

      const saved = saveAlertConfig({
        botToken: body.botToken !== undefined ? body.botToken : undefined,
        chatId: body.chatId !== undefined ? body.chatId : undefined,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
        symbol: body.symbol || '1HZ75V',
        timeframe: body.timeframe || '1H',
        smsApiKey: body.smsApiKey !== undefined ? body.smsApiKey : undefined,
        smsPhone: body.smsPhone !== undefined ? body.smsPhone : undefined,
        smsAlertsEnabled: body.smsAlertsEnabled !== undefined ? Boolean(body.smsAlertsEnabled) : undefined,
        options: body.options || {},
      });

      return res.status(200).json({
        ok: true,
        message: 'Cloud Alert configuration saved successfully! Signals will now follow these exact settings.',
        config: {
          ...saved,
          botToken: saved.botToken ? `${saved.botToken.substring(0, 6)}...${saved.botToken.slice(-4)}` : '',
          hasToken: Boolean(saved.botToken),
        },
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('Error in cloudAlertConfigHandler:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error occurred in alert config handler',
    });
  }
}
