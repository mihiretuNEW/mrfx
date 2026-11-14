import fs from 'fs';
import path from 'path';

const PRIMARY_CONFIG_FILE = path.join(process.cwd(), '.cloud_alert_config.json');
const FALLBACK_CONFIG_FILE = path.join('/tmp', 'mcharts_cloud_alert_config.json');

export interface CloudAlertConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  symbol: string;
  timeframe: string;
  updatedAt: number;
  options: Record<string, any>;
}

const SENSITIVE_OPTION_KEYS = [
  'derivApiToken',
  'derivAppId',
  'derivToken',
  'apiToken',
  'token',
  'appId',
  'secret',
];

export function stripSensitiveOptions(options: Record<string, any> | undefined | null): Record<string, any> {
  const clean: Record<string, any> = { ...(options || {}) };
  for (const key of SENSITIVE_OPTION_KEYS) {
    if (key in clean) {
      delete clean[key];
    }
  }
  return clean;
}

export interface DerivEnvCredentialsResult {
  ok: boolean;
  token: string;
  appId: string;
  tokenConfigured: boolean;
  appIdConfigured: boolean;
  error?: string;
}

/**
 * Resolves Deriv credentials exclusively from backend environment variables.
 * Never falls back to JSON config, browser settings, or hardcoded credentials.
 */
export function getDerivEnvCredentials(): DerivEnvCredentialsResult {
  const token = (process.env.DERIV_API_TOKEN || '').trim();
  const appId = (process.env.DERIV_APP_ID || '').trim();
  const tokenConfigured = token.length > 0;
  const appIdConfigured = appId.length > 0;

  if (!tokenConfigured || !appIdConfigured) {
    const missing: string[] = [];
    if (!tokenConfigured) missing.push('DERIV_API_TOKEN');
    if (!appIdConfigured) missing.push('DERIV_APP_ID');
    return {
      ok: false,
      token: '',
      appId: '',
      tokenConfigured,
      appIdConfigured,
      error: `Missing Deriv backend environment variable(s): ${missing.join(', ')}. Configure them in Render Environment Variables.`,
    };
  }

  return {
    ok: true,
    token,
    appId,
    tokenConfigured: true,
    appIdConfigured: true,
  };
}

const DEFAULT_CONFIG: CloudAlertConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  enabled: true,
  symbol: 'R_75',
  timeframe: '1H',
  updatedAt: Date.now(),
  options: {
    targetMode: 'points',
    pointsSl: 165,
    pointsTp1: 607,
    pointsTp2: 650,
    pointsTp3: 1000,
    showTp1: true,
    showTp2: true,
    showTp3: false,
    showSl: true,
    targetFocus: 'TP2',
    historySpan: 'all',
    invalidateMode: true,
    keepN: 10,
    swingLen: 3,
    useStructureFilter: false,
    structureTf: '15',
    filterSwingLen: 2,
    useWickFilter: false,
    maxWickRatio: 0.25,
    useDisplacementFilter: false,
    minDisplacementAtr: 0.5,
    useBodyCloseFilter: false,
    minBodyRatio: 0.5,
    useSweepFilter: false,
    sweepLookback: 10,
    preventLateEntry: false,
    maxBreakoutDelay: 1,
    useAdxFilter: false,
    diLen: 14,
    adxSmooth: 14,
    minAdx: 20,
    useEmaFilter: false,
    emaLen: 200,
    useCandleFilter: false,
    minBodyAtr: 0.2,
    breakoutBufferAtr: 0,
    useFvgFilter: false,
    useVolumeFilter: false,
    useScoreFilter: false,
    useHtfFilter: false,
    usePremiumDiscountFilter: false,
    useInducementFilter: false,
    useKillZonesFilter: false,
    useTurtleSoupFilter: false,
    useRetestConfirmation: false,
    retestMaxBars: 3,
    useAntiWhipsawFilter: true,
    whipsawCooldownBars: 4,
    derivMode: 'demo',
    derivAutoTradeEnabled: true,
    derivStake: 2.0,
    multiplier: 200,
    derivMultiplier: 200,
    derivTakeProfitUsd: 6.68,
    derivStopLossUsd: 2.0,
    derivMaxConsecutiveLosses: 3,
  },
};

export function loadAlertConfig(): CloudAlertConfig {
  const envBotToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const envChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

  try {
    let loaded: any = null;
    if (fs.existsSync(PRIMARY_CONFIG_FILE)) {
      const data = fs.readFileSync(PRIMARY_CONFIG_FILE, 'utf-8');
      loaded = JSON.parse(data);
    } else if (fs.existsSync(FALLBACK_CONFIG_FILE)) {
      const data = fs.readFileSync(FALLBACK_CONFIG_FILE, 'utf-8');
      loaded = JSON.parse(data);
    }
    if (loaded) {
      const sanitizedLoadedOptions = stripSensitiveOptions(loaded.options);
      const mergedOptions = {
        ...DEFAULT_CONFIG.options,
        ...sanitizedLoadedOptions,
      };
      if (mergedOptions.derivAutoTradeEnabled === undefined) {
        mergedOptions.derivAutoTradeEnabled = true;
      }
      mergedOptions.derivMode = String(mergedOptions.derivMode || '').toLowerCase() === 'real' ? 'real' : 'demo';
      const diskBotToken = (loaded.botToken && !String(loaded.botToken).includes('...'))
        ? String(loaded.botToken).trim()
        : '';
      const diskChatId = loaded.chatId ? String(loaded.chatId).trim() : '';
      return {
        ...DEFAULT_CONFIG,
        ...loaded,
        // Backend Render Environment Variables ALWAYS take priority over cached disk JSON
        botToken: envBotToken || diskBotToken,
        chatId: envChatId || diskChatId,
        options: mergedOptions,
      };
    }
  } catch (err) {
    console.warn('Failed to load alert config from disk, using defaults:', err);
  }
  return {
    ...DEFAULT_CONFIG,
    botToken: envBotToken,
    chatId: envChatId,
  };
}

export const getAlertConfig = loadAlertConfig;

export function saveAlertConfig(config: Partial<CloudAlertConfig>): CloudAlertConfig {
  const current = loadAlertConfig();
  const incomingOptions = stripSensitiveOptions(config.options);
  const envBotToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const envChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

  const rawIncomingToken = typeof config.botToken === 'string' ? config.botToken.trim() : '';
  const validIncomingToken = rawIncomingToken && !rawIncomingToken.includes('...') ? rawIncomingToken : '';
  const rawIncomingChatId = typeof config.chatId === 'string' ? config.chatId.trim() : '';

  const finalBotToken = envBotToken || validIncomingToken || current.botToken || '';
  const finalChatId = envChatId || rawIncomingChatId || current.chatId || '';

  const finalAutoTrade = incomingOptions.derivAutoTradeEnabled !== undefined
    ? Boolean(incomingOptions.derivAutoTradeEnabled)
    : (current.options?.derivAutoTradeEnabled !== undefined ? current.options.derivAutoTradeEnabled : true);

  const rawMode = incomingOptions.derivMode ?? current.options?.derivMode;
  const finalDerivMode: 'demo' | 'real' = String(rawMode || '').toLowerCase() === 'real' ? 'real' : 'demo';

  const mergedOptions = stripSensitiveOptions({
    ...current.options,
    ...incomingOptions,
    derivMode: finalDerivMode,
    derivAutoTradeEnabled: finalAutoTrade,
  });

  // Never persist env-managed Telegram credentials onto disk where they could shadow future env changes
  const diskRecord: CloudAlertConfig = {
    ...current,
    ...config,
    botToken: envBotToken ? '' : finalBotToken,
    chatId: envChatId ? '' : finalChatId,
    updatedAt: Date.now(),
    options: mergedOptions,
  };

  try {
    fs.writeFileSync(PRIMARY_CONFIG_FILE, JSON.stringify(diskRecord, null, 2), 'utf-8');
  } catch (err) {
    // Primary might be read-only in some serverless runtimes
  }
  try {
    fs.writeFileSync(FALLBACK_CONFIG_FILE, JSON.stringify(diskRecord, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save alert config to fallback disk:', err);
  }
  return {
    ...diskRecord,
    botToken: finalBotToken,
    chatId: finalChatId,
  };
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
      const creds = getDerivEnvCredentials();
      const telegramEnvConfigured = Boolean((process.env.TELEGRAM_BOT_TOKEN || '').trim() && (process.env.TELEGRAM_CHAT_ID || '').trim());
      const masked = {
        ...cfg,
        botToken: cfg.botToken ? `${cfg.botToken.substring(0, 6)}...${cfg.botToken.slice(-4)}` : '',
        hasToken: Boolean(cfg.botToken),
        telegramEnvConfigured,
        derivCredentialsConfigured: creds.ok,
        options: stripSensitiveOptions(cfg.options),
      };
      return res.status(200).json({ ok: true, config: masked, ...masked });
    }

    if (req.method === 'POST') {
      if (action === 'test' || body.action === 'test') {
        const loadedCfg = loadAlertConfig();
        const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
        const envChat = (process.env.TELEGRAM_CHAT_ID || '').trim();
        const bodyToken = (typeof body.botToken === 'string' && !body.botToken.includes('...')) ? body.botToken.trim() : '';
        const bodyChat = typeof body.chatId === 'string' ? body.chatId.trim() : '';
        const token = envToken || bodyToken || loadedCfg.botToken;
        const chat = envChat || bodyChat || loadedCfg.chatId;
        if (!token || !chat) {
          return res.status(400).json({ ok: false, error: 'Telegram Bot Token and Chat ID are required to send a test message.' });
        }
        const testMsg = `🟢 <b>Connected!</b>\n\n` +
          `✅ Telegram Bot successfully connected.\n` +
          `🪙 Pair: Volatility 75 index\n` +
          `⏰ Timeframe: ${body.timeframe || '1H'}`;

        const result = await sendTelegramDirect(token, chat, testMsg);
        if (result.ok) {
          return res.status(200).json({ ok: true, message: 'Test message sent successfully to your Telegram!' });
        } else {
          return res.status(400).json({ ok: false, error: result.description || result.error || 'Failed to send message via Telegram API' });
        }
      }

      const existing = loadAlertConfig();
      const incomingOptions = stripSensitiveOptions(body.options);
      const rawBodyToken = typeof body.botToken === 'string' ? body.botToken.trim() : '';
      const validBodyToken = rawBodyToken && !rawBodyToken.includes('...') ? rawBodyToken : undefined;
      const validBodyChat = typeof body.chatId === 'string' && body.chatId.trim() ? body.chatId.trim() : undefined;

      const saved = saveAlertConfig({
        botToken: validBodyToken !== undefined ? validBodyToken : existing.botToken,
        chatId: validBodyChat !== undefined ? validBodyChat : existing.chatId,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
        symbol: body.symbol || existing.symbol || 'R_75',
        timeframe: body.timeframe || existing.timeframe || '1H',
        options: {
          ...stripSensitiveOptions(existing.options),
          ...incomingOptions,
        },
      });

      const creds = getDerivEnvCredentials();
      const telegramEnvConfigured = Boolean((process.env.TELEGRAM_BOT_TOKEN || '').trim() && (process.env.TELEGRAM_CHAT_ID || '').trim());
      return res.status(200).json({
        ok: true,
        message: 'Cloud Alert settings saved! Deriv and Telegram credentials remain managed safely by backend environment variables when configured.',
        config: {
          ...saved,
          botToken: saved.botToken ? `${saved.botToken.substring(0, 6)}...${saved.botToken.slice(-4)}` : '',
          hasToken: Boolean(saved.botToken),
          telegramEnvConfigured,
          derivCredentialsConfigured: creds.ok,
          options: stripSensitiveOptions(saved.options),
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
