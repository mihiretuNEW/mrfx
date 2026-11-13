import type { Request, Response } from 'express';
import crypto from 'crypto';
import {
  fetchDerivAccounts,
  executeDerivMultiplierTrade,
  getDerivCircuitStatus,
  resetDerivCircuitBreaker,
  maskAccountId,
} from './_lib/derivTrader.js';
import { sendTelegramDirect, getAlertConfig, getDerivEnvCredentials } from './_lib/cloudAlertConfig.js';

function timingSafeMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req: Request, res: Response) {
  const creds = getDerivEnvCredentials();

  if (req.method === 'GET') {
    const config = getAlertConfig();
    const breaker = getDerivCircuitStatus();
    return res.status(200).json({
      ok: true,
      credentialsConfigured: creds.ok,
      tokenConfigured: creds.tokenConfigured,
      appIdConfigured: creds.appIdConfigured,
      circuitBreaker: breaker,
      derivConfig: {
        tokenConfigured: creds.tokenConfigured,
        appIdConfigured: creds.appIdConfigured,
        mode: config?.options?.derivMode === 'real' ? 'real' : 'demo',
        autoTradeEnabled: config?.options?.derivAutoTradeEnabled !== false,
        stake: config?.options?.derivStake ?? 2.0,
        multiplier: config?.options?.derivMultiplier ?? 200,
        takeProfitUsd: config?.options?.derivTakeProfitUsd ?? 6.68,
        stopLossUsd: config?.options?.derivStopLossUsd ?? 2.0,
        maxConsecutiveLosses: config?.options?.derivMaxConsecutiveLosses ?? 3,
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const action = body.action;

  // 1. Reset Circuit Breaker
  if (action === 'reset_breaker') {
    resetDerivCircuitBreaker();
    return res.status(200).json({ ok: true, message: 'Circuit breaker reset successfully' });
  }

  // 2. Verify Backend Environment Credentials & Fetch Live Account Summary (masked, no secrets returned)
  if (action === 'verify_token') {
    if (!creds.ok) {
      return res.status(400).json({ ok: false, error: creds.error });
    }

    const result = await fetchDerivAccounts();
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    const sanitizedAccounts = (result.accounts || []).map((a) => ({
      account_label: maskAccountId(a.account_id),
      account_type: a.account_type,
      balance: a.balance,
      currency: a.currency,
      status: a.status,
    }));

    return res.status(200).json({
      ok: true,
      message: `Backend Deriv credentials verified! Found ${sanitizedAccounts.length} account(s).`,
      accounts: sanitizedAccounts,
    });
  }

  // 3. Protected Deriv Buy Verification Endpoint (requires DERIV_TEST_SECRET header)
  if (action === 'protected_buy_test') {
    const expectedSecret = (process.env.DERIV_TEST_SECRET || '').trim();
    if (!expectedSecret) {
      return res.status(403).json({
        ok: false,
        error: 'Protected test endpoint is disabled because DERIV_TEST_SECRET is not set on the server.',
      });
    }

    const headerSecret = String(
      req.headers['x-test-secret'] ||
      (String(req.headers.authorization || '').startsWith('Bearer ')
        ? String(req.headers.authorization).slice(7)
        : '')
    ).trim();

    if (!headerSecret || !timingSafeMatch(headerSecret, expectedSecret)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: invalid or missing test secret.' });
    }

    if (!creds.ok) {
      return res.status(400).json({ ok: false, error: creds.error });
    }

    const mode = body.mode === 'real' ? 'real' : 'demo';
    if (mode === 'real' && body.confirmReal !== true) {
      return res.status(400).json({
        ok: false,
        error: 'Real-account test execution requires explicit { confirmReal: true }.',
      });
    }

    const tradeRes = await executeDerivMultiplierTrade({
      mode,
      action: body.direction === 'SELL' ? 'SELL' : 'BUY',
      symbol: body.symbol || 'R_75',
      stake: Number(body.stake) || 1.0,
      multiplier: Number(body.multiplier) || 200,
      takeProfitUsd: Number(body.takeProfitUsd) || 3.0,
      stopLossUsd: Number(body.stopLossUsd) || 1.0,
      maxConsecutiveLosses: 3,
    });

    if (!tradeRes.ok) {
      return res.status(400).json({ ok: false, error: tradeRes.error, uncertain: tradeRes.uncertain });
    }

    return res.status(200).json({
      ok: true,
      message: `Protected Deriv ${mode.toUpperCase()} buy verified cleanly!`,
      contractId: tradeRes.contractId,
      transactionId: tradeRes.transactionId,
      buyPrice: tradeRes.buyPrice,
      balanceAfter: tradeRes.balanceAfter,
      accountType: tradeRes.accountType,
      accountLabel: tradeRes.accountLabel,
    });
  }

  // 4. Execute Multiplier Trade using ONLY backend environment credentials
  if (action === 'execute') {
    if (!creds.ok) {
      return res.status(400).json({ ok: false, error: creds.error });
    }

    const mode = body.mode === 'real' ? 'real' : 'demo';
    const tradeDir = body.direction === 'SELL' ? 'SELL' : 'BUY';
    const stake = Number(body.stake) || 2.0;
    const multiplier = Number(body.multiplier) || 200;
    const takeProfitUsd = Number(body.takeProfitUsd) || 6.68;
    const stopLossUsd = Number(body.stopLossUsd) || 2.0;
    const symbol = body.symbol || 'R_75';

    const tradeRes = await executeDerivMultiplierTrade({
      mode,
      action: tradeDir,
      symbol,
      stake,
      multiplier,
      takeProfitUsd,
      stopLossUsd,
      maxConsecutiveLosses: Number(body.maxConsecutiveLosses) || 3,
    });

    if (!tradeRes.ok) {
      return res.status(400).json({ ok: false, error: tradeRes.error });
    }

    const botToken = (getAlertConfig()?.botToken || '').trim();
    const chatId = (getAlertConfig()?.chatId || '').trim();

    if (botToken && chatId) {
      const modeEmoji = mode === 'real' ? '🔴 REAL LIVE' : '🧪 DEMO VIRTUAL';
      const dirEmoji = tradeDir === 'BUY' ? '📈 BUY (MULTUP)' : '📉 SELL (MULTDOWN)';
      const tgMsg =
        `🚀 <b>DERIV MULTIPLIER ORDER EXECUTED!</b>\n\n` +
        `⚖️ Mode: <b>${modeEmoji}</b>\n` +
        `🪙 Pair: <b>${symbol === 'R_75' ? 'Volatility 75 Index' : symbol}</b>\n` +
        `🧭 Direction: <b>${dirEmoji}</b>\n\n` +
        `💵 Stake: <b>$${stake.toFixed(2)} USD</b>\n` +
        `⚡ Multiplier: <b>${multiplier}x</b>\n` +
        `🎯 Take Profit: <b>+$${takeProfitUsd.toFixed(2)} USD</b>\n` +
        `🛑 Stop Loss: <b>-$${stopLossUsd.toFixed(2)} USD</b>\n\n` +
        `🆔 Contract ID: <code>#${tradeRes.contractId}</code>\n` +
        `💰 Balance After: <b>$${tradeRes.balanceAfter?.toFixed(2) ?? '---'} USD</b>\n\n` +
        `⏰ Time: ${new Date().toISOString()}`;

      sendTelegramDirect(botToken, chatId, tgMsg).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      message: `✅ Deriv ${mode.toUpperCase()} ${tradeDir} Multiplier trade executed!`,
      trade: tradeRes,
    });
  }

  return res.status(400).json({ ok: false, error: 'Unrecognized action' });
}
