import type { Request, Response } from 'express';
import {
  fetchDerivAccounts,
  executeDerivMultiplierTrade,
  getDerivCircuitStatus,
  resetDerivCircuitBreaker,
} from './_lib/derivTrader.js';
import { sendTelegramDirect, getAlertConfig, saveAlertConfig } from './_lib/cloudAlertConfig.js';

export default async function handler(req: Request, res: Response) {
  if (req.method === 'GET') {
    const config = getAlertConfig();
    const breaker = getDerivCircuitStatus();
    return res.status(200).json({
      ok: true,
      circuitBreaker: breaker,
      derivConfig: {
        tokenConfigured: Boolean(config?.options?.derivApiToken),
        appId: config?.options?.derivAppId || '',
        mode: config?.options?.derivMode || 'demo',
        autoTradeEnabled: Boolean(config?.options?.derivAutoTradeEnabled),
        stake: config?.options?.derivStake ?? 2.0,
        multiplier: config?.options?.derivMultiplier ?? 200,
        takeProfitUsd: config?.options?.derivTakeProfitUsd ?? 6.68,
        stopLossUsd: config?.options?.derivStopLossUsd ?? 2.0,
        maxConsecutiveLosses: config?.options?.derivMaxConsecutiveLosses ?? 2,
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

  // 2. Verify Token & Fetch Live Accounts
  if (action === 'verify_token') {
    const token = (body.token || '').trim();
    const appId = (body.appId || '').trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: 'Deriv Personal Access Token is required' });
    }
    if (!appId) {
      return res.status(400).json({ ok: false, error: 'Deriv App ID is required' });
    }

    const result = await fetchDerivAccounts(token, appId);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    // Persist in config if requested
    if (body.saveConfig) {
      const config = getAlertConfig();
      saveAlertConfig({
        ...config,
        options: {
          ...(config.options || {}),
          derivApiToken: token,
          derivAppId: appId,
        },
      });
    }

    return res.status(200).json({
      ok: true,
      message: '✅ Deriv connection verified successfully!',
      accounts: result.accounts,
    });
  }

  // 3. Execute Multiplier Trade
  if (action === 'execute') {
    const token = (body.token || '').trim();
    const appId = (body.appId || '').trim();
    const mode = body.mode === 'real' ? 'real' : 'demo';
    const tradeDir = body.direction === 'SELL' ? 'SELL' : 'BUY';
    const stake = Number(body.stake) || 2.0;
    const multiplier = Number(body.multiplier) || 200;
    const takeProfitUsd = Number(body.takeProfitUsd) || 6.68;
    const stopLossUsd = Number(body.stopLossUsd) || 2.0;
    const symbol = body.symbol || 'R_75';

    if (!token || !appId) {
      return res.status(400).json({ ok: false, error: 'Token and App ID are required to execute trade' });
    }

    const tradeRes = await executeDerivMultiplierTrade({
      token,
      appId,
      mode,
      action: tradeDir,
      symbol,
      stake,
      multiplier,
      takeProfitUsd,
      stopLossUsd,
      maxConsecutiveLosses: Number(body.maxConsecutiveLosses) || 2,
    });

    if (!tradeRes.ok) {
      return res.status(400).json({ ok: false, error: tradeRes.error });
    }

    // Send Telegram Notification if bot token and chat ID are available
    const botToken = (body.botToken || getAlertConfig()?.botToken || '').trim();
    const chatId = (body.chatId || getAlertConfig()?.chatId || '').trim();

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
        `🏦 Account: <code>${tradeRes.accountId}</code>\n` +
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
