import type { IncomingMessage, ServerResponse } from 'http';
import { sendSmsDirect, formatEthiopianPhone } from './_lib/smsEthiopia.js';
import { loadAlertConfig } from './_lib/cloudAlertConfig.js';

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

  // If body is a stream (standard Node/Vercel raw request)
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: any) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: any, res: any) {
  // Ultra-safe CORS
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
    const savedConfig = loadAlertConfig();
    const body = await parseBody(req);
    const query = req.query || {};

    const action = body.action || query.action || 'send';
    const apiKey = (body.smsApiKey || body.apiKey || query.apiKey || savedConfig.smsApiKey || 'X5UZHVO1BTC9VTNGXPAR4BJQCDCLLOPYPEJ6U4H6').trim();
    const phone = formatEthiopianPhone(body.smsPhone || body.phone || query.phone || savedConfig.smsPhone || '251968865885');

    // GET request returns status check
    if (req.method === 'GET' && !query.text) {
      return res.status(200).json({
        ok: true,
        endpoint: '/api/send-sms',
        status: 'ready',
        configuredPhone: phone,
        hasApiKey: Boolean(apiKey),
        provider: 'smsethiopia.com',
      });
    }

    // Default test message if none provided
    const text =
      body.text ||
      body.message ||
      query.text ||
      query.message ||
      '🔔 Mcharts Signal Connected! Your SMS alerts are active. Mire stay disciplined!';

    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        error: 'SMS Ethiopia API Key is missing. Please provide apiKey.',
      });
    }

    if (!phone || phone.length < 10) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid phone number. Ethiopian phone number must be e.g. 251968865885 or 0968865885.',
      });
    }

    // Dispatch SMS via smsethiopia.com
    const result = await sendSmsDirect(apiKey, phone, text);

    if (result.ok) {
      return res.status(200).json({
        ok: true,
        sent: true,
        message: `✅ የሙከራ SMS ወደ ${phone} በተሳካ ሁኔታ ተልኳል! ስልክዎን ይመልከቱ።`,
        id: result.id,
        description: result.description,
        phone,
      });
    } else {
      return res.status(400).json({
        ok: false,
        error: result.error || 'Failed to send SMS via smsethiopia.com gateway',
        phone,
      });
    }
  } catch (err: any) {
    console.error('Error in /api/send-sms handler:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error occurred while dispatching SMS',
    });
  }
}
