import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { getDerivEnvCredentials } from './cloudAlertConfig.js';

export interface DerivAccount {
  account_id: string;
  balance: number;
  currency: string;
  account_type: 'demo' | 'real';
  status: string;
}

export interface DerivExecutionResult {
  ok: boolean;
  contractId?: number;
  transactionId?: number;
  buyPrice?: number;
  balanceAfter?: number;
  longcode?: string;
  accountLabel?: string;
  accountType?: 'demo' | 'real';
  action?: 'BUY' | 'SELL';
  symbol?: string;
  stake?: number;
  multiplier?: number;
  takeProfit?: number;
  stopLoss?: number;
  error?: string;
  retryable?: boolean;
  uncertain?: boolean;
  reconciled?: boolean;
}

export function maskAccountId(accountId: string): string {
  const clean = (accountId || '').trim();
  if (clean.length <= 4) return '***';
  return `${clean.slice(0, 3)}***${clean.slice(-3)}`;
}

interface CircuitBreakerState {
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  isTripped: boolean;
  lastTripDate: string;
}

const CIRCUIT_FILE = path.join('/tmp', 'mcharts_deriv_circuit.json');

const defaultCircuitState: CircuitBreakerState = {
  consecutiveLosses: 0,
  maxConsecutiveLosses: 2,
  isTripped: false,
  lastTripDate: '',
};

function readCircuitFromDisk(): CircuitBreakerState {
  try {
    if (fs.existsSync(CIRCUIT_FILE)) {
      const raw = fs.readFileSync(CIRCUIT_FILE, 'utf-8');
      return { ...defaultCircuitState, ...JSON.parse(raw) };
    }
  } catch {
    // fallback to default
  }
  return { ...defaultCircuitState };
}

function writeCircuitToDisk(state: CircuitBreakerState) {
  try {
    fs.writeFileSync(CIRCUIT_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write circuit state to disk:', e);
  }
}

export function getDerivCircuitStatus() {
  const current = readCircuitFromDisk();
  const todayStr = new Date().toISOString().slice(0, 10);
  if (current.lastTripDate && current.lastTripDate !== todayStr) {
    current.consecutiveLosses = 0;
    current.isTripped = false;
    current.lastTripDate = '';
    writeCircuitToDisk(current);
  }
  return { ...current };
}

export function resetDerivCircuitBreaker() {
  const current = readCircuitFromDisk();
  current.consecutiveLosses = 0;
  current.isTripped = false;
  current.lastTripDate = '';
  writeCircuitToDisk(current);
}

export function recordDerivTradeOutcome(isWin: boolean, maxLosses: number = 2) {
  const current = readCircuitFromDisk();
  current.maxConsecutiveLosses = maxLosses;
  const todayStr = new Date().toISOString().slice(0, 10);

  if (isWin) {
    current.consecutiveLosses = 0;
  } else {
    current.consecutiveLosses += 1;
    if (current.consecutiveLosses >= current.maxConsecutiveLosses) {
      current.isTripped = true;
      current.lastTripDate = todayStr;
    }
  }
  writeCircuitToDisk(current);
}

/**
 * Fetch accounts strictly using backend environment variables (DERIV_API_TOKEN & DERIV_APP_ID).
 */
export async function fetchDerivAccounts(): Promise<{ ok: boolean; accounts?: DerivAccount[]; error?: string }> {
  const creds = getDerivEnvCredentials();
  if (!creds.ok) {
    return { ok: false, error: creds.error };
  }

  try {
    const res = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Deriv-App-ID': creds.appId,
      },
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: `Invalid response from Deriv API (HTTP ${res.status})` };
    }

    if (!res.ok || json?.error) {
      const errMsg = json?.error?.message || json?.message || `Deriv API error (HTTP ${res.status})`;
      return { ok: false, error: errMsg };
    }

    const rawAccounts: any[] = Array.isArray(json?.data) ? json.data : [];
    const accounts: DerivAccount[] = rawAccounts.map((a) => ({
      account_id: String(a.account_id || ''),
      balance: Number(a.balance ?? 0),
      currency: String(a.currency || 'USD'),
      account_type: String(a.account_type).toLowerCase() === 'real' ? 'real' : 'demo',
      status: String(a.status || 'active'),
    }));

    return { ok: true, accounts };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error connecting to Deriv API' };
  }
}

/**
 * Request an OTP WebSocket URL strictly using backend environment credentials.
 */
export async function getAccountOtpWsUrl(
  accountId: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const creds = getDerivEnvCredentials();
  if (!creds.ok) {
    return { ok: false, error: creds.error };
  }

  try {
    const res = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Deriv-App-ID': creds.appId,
        'Content-Type': 'application/json',
      },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.data?.url) {
      const errMsg = json?.error?.message || json?.message || `Failed to generate OTP WebSocket URL (HTTP ${res.status})`;
      return { ok: false, error: errMsg };
    }

    return { ok: true, url: json.data.url };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error requesting Deriv OTP URL' };
  }
}

/**
 * Reconciles uncertain buy timeout against Deriv portfolio over a fresh OTP WS connection.
 */
async function reconcileRecentContract(
  accountId: string,
  symbol: string,
  contractType: 'MULTUP' | 'MULTDOWN',
  sinceEpochSec: number
): Promise<{ found: boolean; contractId?: number; buyPrice?: number }> {
  try {
    const otpRes = await getAccountOtpWsUrl(accountId);
    if (!otpRes.ok || !otpRes.url) return { found: false };

    return await new Promise((resolve) => {
      let settled = false;
      const ws = new WebSocket(otpRes.url!);
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { ws.close(); } catch {}
          resolve({ found: false });
        }
      }, 6000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ portfolio: 1 }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.portfolio && Array.isArray(msg.portfolio.contracts)) {
            const matched = msg.portfolio.contracts.find((c: any) =>
              String(c.symbol || c.underlying_symbol || '') === symbol &&
              String(c.contract_type || '') === contractType &&
              Number(c.purchase_time || c.date_start || 0) >= sinceEpochSec - 15
            );
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              try { ws.close(); } catch {}
              if (matched && matched.contract_id) {
                resolve({
                  found: true,
                  contractId: Number(matched.contract_id),
                  buyPrice: Number(matched.buy_price ?? 0),
                });
              } else {
                resolve({ found: false });
              }
            }
          } else if (msg.error && !settled) {
            settled = true;
            clearTimeout(timer);
            try { ws.close(); } catch {}
            resolve({ found: false });
          }
        } catch {
          // ignore parse error
        }
      });

      ws.on('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ found: false });
        }
      });
    });
  } catch {
    return { found: false };
  }
}

export interface MultiplierTradeParams {
  mode: 'demo' | 'real';
  action: 'BUY' | 'SELL';
  symbol?: string;
  stake: number;
  multiplier: number;
  takeProfitUsd?: number;
  stopLossUsd?: number;
  maxConsecutiveLosses?: number;
}

export interface DerivTransportDeps {
  fetchAccountsFn?: typeof fetchDerivAccounts;
  getOtpWsUrlFn?: typeof getAccountOtpWsUrl;
  wsBuyFn?: (
    wsUrl: string,
    buyPayload: any
  ) => Promise<{ ok: boolean; buy?: any; error?: string; retryable?: boolean; uncertain?: boolean }>;
  reconcileFn?: typeof reconcileRecentContract;
}

async function defaultWsBuy(
  wsUrl: string,
  buyPayload: any
): Promise<{ ok: boolean; buy?: any; error?: string; retryable?: boolean; uncertain?: boolean }> {
  return new Promise((resolve) => {
    let hasResolved = false;
    let buySent = false;

    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        try { ws.close(); } catch {}
        resolve({
          ok: false,
          error: buySent
            ? 'Deriv buy response timed out after 12s'
            : 'Deriv WebSocket handshake timed out after 12s',
          retryable: !buySent,
          uncertain: buySent,
        });
      }
    }, 12000);

    ws.on('open', () => {
      buySent = true;
      ws.send(JSON.stringify(buyPayload));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.error) {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve({
              ok: false,
              error: msg.error.message || 'Deriv trade rejected by broker',
              retryable: false,
              uncertain: false,
            });
          }
          return;
        }
        if (msg.buy) {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve({ ok: true, buy: msg.buy });
          }
        }
      } catch (err: any) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            ok: false,
            error: err?.message || 'Error parsing broker response',
            retryable: false,
            uncertain: buySent,
          });
        }
      }
    });

    ws.on('error', (err) => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timeout);
        resolve({
          ok: false,
          error: `Deriv WebSocket error: ${err.message}`,
          retryable: !buySent,
          uncertain: buySent,
        });
      }
    });
  });
}

/**
 * Execute a Multiplier trade (MULTUP or MULTDOWN) on Deriv strictly using backend env credentials
 * and strict demo vs real account isolation.
 */
export async function executeDerivMultiplierTrade(
  params: MultiplierTradeParams,
  deps: DerivTransportDeps = {}
): Promise<DerivExecutionResult> {
  if (params.mode !== 'demo' && params.mode !== 'real') {
    return {
      ok: false,
      retryable: false,
      uncertain: false,
      error: `Invalid execution mode "${String(params.mode)}". Must be "demo" or "real".`,
    };
  }

  const targetMode: 'demo' | 'real' = params.mode;
  const symbol = params.symbol || 'R_75';
  const action: 'BUY' | 'SELL' = params.action === 'SELL' ? 'SELL' : 'BUY';
  const contractType: 'MULTUP' | 'MULTDOWN' = action === 'BUY' ? 'MULTUP' : 'MULTDOWN';
  const stake = Math.max(0.35, Number(params.stake) || 2.0);
  const multiplier = Number(params.multiplier) || 200;

  // Safeguard: Daily Circuit Breaker for Real Account
  const breaker = getDerivCircuitStatus();
  if (breaker.isTripped && targetMode === 'real') {
    return {
      ok: false,
      retryable: false,
      uncertain: false,
      error: `Daily Circuit Breaker is active after ${breaker.consecutiveLosses} consecutive losses. Trading paused for capital protection.`,
    };
  }

  const fetchAccountsFn = deps.fetchAccountsFn || fetchDerivAccounts;
  const getOtpFn = deps.getOtpWsUrlFn || getAccountOtpWsUrl;
  const wsBuyFn = deps.wsBuyFn || defaultWsBuy;
  const reconcileFn = deps.reconcileFn || reconcileRecentContract;

  // Step 1: Resolve target account strictly matching requested mode (demo vs real)
  const accResult = await fetchAccountsFn();
  if (!accResult.ok || !accResult.accounts || accResult.accounts.length === 0) {
    const errText = accResult.error || 'Could not fetch Deriv accounts';
    const isMissingCreds = errText.includes('DERIV_API_TOKEN') || errText.includes('DERIV_APP_ID');
    return {
      ok: false,
      retryable: !isMissingCreds,
      uncertain: false,
      error: errText,
    };
  }

  const matched = accResult.accounts.find((a) => a.account_type === targetMode);
  if (!matched) {
    return {
      ok: false,
      retryable: false,
      uncertain: false,
      error: `No ${targetMode.toUpperCase()} account found under configured Deriv credentials (strict isolation prevents fallback).`,
    };
  }

  if (matched.balance < stake) {
    return {
      ok: false,
      retryable: false,
      uncertain: false,
      error: `Insufficient balance on ${targetMode.toUpperCase()} account ($${matched.balance.toFixed(2)} < $${stake.toFixed(2)}).`,
    };
  }

  const targetAccountId = matched.account_id;

  // Step 2: Request OTP WS URL
  const otpRes = await getOtpFn(targetAccountId);
  if (!otpRes.ok || !otpRes.url) {
    const errText = otpRes.error || 'Failed to obtain Deriv WebSocket OTP URL';
    const isMissingCreds = errText.includes('DERIV_API_TOKEN') || errText.includes('DERIV_APP_ID');
    return {
      ok: false,
      retryable: !isMissingCreds,
      uncertain: false,
      error: errText,
    };
  }

  // Step 3: Build & dispatch buy payload
  const buyPayload: any = {
    buy: 1,
    price: stake,
    parameters: {
      amount: stake,
      basis: 'stake',
      contract_type: contractType,
      currency: matched.currency || 'USD',
      multiplier,
      underlying_symbol: symbol,
    },
  };

  if (params.takeProfitUsd || params.stopLossUsd) {
    buyPayload.parameters.limit_order = {};
    if (params.takeProfitUsd && params.takeProfitUsd > 0) {
      buyPayload.parameters.limit_order.take_profit = Number(params.takeProfitUsd);
    }
    if (params.stopLossUsd && params.stopLossUsd > 0) {
      buyPayload.parameters.limit_order.stop_loss = Number(params.stopLossUsd);
    }
  }

  const dispatchEpochSec = Math.floor(Date.now() / 1000);
  const wsRes = await wsBuyFn(otpRes.url, buyPayload);

  if (wsRes.ok && wsRes.buy) {
    const buyData = wsRes.buy;
    return {
      ok: true,
      contractId: Number(buyData.contract_id),
      transactionId: Number(buyData.transaction_id),
      buyPrice: Number(buyData.buy_price ?? stake),
      balanceAfter: buyData.balance_after !== undefined ? Number(buyData.balance_after) : undefined,
      longcode: buyData.longcode,
      accountLabel: `${targetMode.toUpperCase()} (${maskAccountId(targetAccountId)})`,
      accountType: targetMode,
      action,
      symbol,
      stake,
      multiplier,
      takeProfit: params.takeProfitUsd,
      stopLoss: params.stopLossUsd,
    };
  }

  // Uncertain timeout/disconnect AFTER sending buy -> reconcile instead of duplicate retry!
  if (wsRes.uncertain) {
    const rec = await reconcileFn(targetAccountId, symbol, contractType, dispatchEpochSec);
    if (rec.found && rec.contractId) {
      return {
        ok: true,
        contractId: rec.contractId,
        buyPrice: rec.buyPrice ?? stake,
        accountLabel: `${targetMode.toUpperCase()} (${maskAccountId(targetAccountId)})`,
        accountType: targetMode,
        action,
        symbol,
        stake,
        multiplier,
        takeProfit: params.takeProfitUsd,
        stopLoss: params.stopLossUsd,
        reconciled: true,
      };
    }
    return {
      ok: false,
      retryable: false,
      uncertain: true,
      error: `${wsRes.error || 'Uncertain buy response'} (reconciliation inconclusive; retry blocked to prevent duplicate order).`,
    };
  }

  return {
    ok: false,
    retryable: Boolean(wsRes.retryable),
    uncertain: false,
    error: wsRes.error || 'Deriv trade execution failed',
  };
}
