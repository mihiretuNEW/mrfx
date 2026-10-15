import express from 'express';

const BOT_TOKEN = '8864552579:AAGSXeU9Z-WslGPehNXCxENWKSl1xeEe3FA';
const CHAT_ID = '-1004295328271';
const PASSCODE = 'Mihiretu12$0962862284';

export async function sendTelegramMessage(text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
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

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    const { action, passcode, text } = req.body || {};

    if (action === 'verify_passcode') {
      if (passcode === PASSCODE) {
        return res.status(200).json({ success: true, verified: true });
      } else {
        return res.status(401).json({ success: false, error: 'Incorrect passcode' });
      }
    }

    if (action === 'send_message') {
      if (!text) {
        return res.status(400).json({ error: 'Text required' });
      }
      const result = await sendTelegramMessage(text);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  res.setHeader('Allow', ['POST']);
  res.status(405).json({ error: 'Method Not Allowed' });
}
