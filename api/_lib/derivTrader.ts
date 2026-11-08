import WebSocket from 'ws';

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
  accountId?: string;
  accountType?: 'demo' | 'real';
  action?: 'BUY' | 'SELL';
  symbol?: string;
  stake?: number;
  multiplier?: number;
  takeProfit?: number;
  stopLoss?: number;
  error?: string;
  raw?: any;
}

// Disk-backed trade state for daily circuit breaker & consecutive loss tracking across serverless cold starts
import fs from 'fs';
import path from 'path';

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
  } catch (e) {
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
    // Reset daily at 00:00 UTC
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
 * Fetch list of accounts (demo and real) for the given Personal Access Token and App ID
 */
export async function fetchDerivAccounts(
  token: string,
  appId: string
): Promise<{ ok: boolean; accounts?: DerivAccount[]; error?: string }> {
  const cleanToken = (token || '').trim();
  const cleanAppId = (appId || '').trim();

  if (!cleanToken) {
    return { ok: false, error: 'Deriv API Token is required' };
  }
  if (!cleanAppId) {
    return { ok: false, error: 'Deriv App ID is required' };
  }

  try {
    const res = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'Deriv-App-ID': cleanAppId,
      },
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: `Invalid response from Deriv API (${res.status}): ${text.slice(0, 150)}` };
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
      account_type: a.account_type === 'real' ? 'real' : 'demo',
      status: String(a.status || 'active'),
    }));

    return { ok: true, accounts };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error connecting to Deriv API' };
  }
}

/**
 * Request an OTP WebSocket URL for an account
 */
export async function getAccountOtpWsUrl(
  token: string,
  appId: string,
  accountId: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Deriv-App-ID': appId.trim(),
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

export interface MultiplierTradeParams {
  token: string;
  appId: string;
  mode?: 'demo' | 'real';
  accountId?: string;
  action: 'BUY' | 'SELL';
  symbol?: string; // default R_75
  stake: number; // e.g. 2.00
  multiplier: number; // e.g. 200
  takeProfitUsd?: number; // e.g. 6.68
  stopLossUsd?: number; // e.g. 2.00
  maxConsecutiveLosses?: number;
}

/**
 * Execute a Multiplier trade (MULTUP or MULTDOWN) on Deriv
 */
export async function executeDerivMultiplierTrade(
  params: MultiplierTradeParams
): Promise<DerivExecutionResult> {
  const token = (params.token || '').trim();
  const appId = (params.appId || '').trim();
  const targetMode = params.mode === 'real' ? 'real' : 'demo';
  const symbol = params.symbol || 'R_75';
  const action = params.action === 'SELL' ? 'SELL' : 'BUY';
  const contractType = action === 'BUY' ? 'MULTUP' : 'MULTDOWN';
  const stake = Math.max(0.35, params.stake || 2.0);
  const multiplier = params.multiplier || 200;
  const maxLosses = params.maxConsecutiveLosses || 2;

  // Safeguard: Check Circuit Breaker
  const breaker = getDerivCircuitStatus();
  if (breaker.isTripped && targetMode === 'real') {
    return {
      ok: false,
      error: `🛑 Daily Circuit Breaker is active! Trading paused after ${breaker.consecutiveLosses} consecutive losses. Capital protected!`,
    };
  }

  // Step 1: Resolve Account ID
  let targetAccountId = params.accountId;
  if (!targetAccountId) {
    const accResult = await fetchDerivAccounts(token, appId);
    if (!accResult.ok || !accResult.accounts || accResult.accounts.length === 0) {
      return { ok: false, error: accResult.error || 'Could not fetch Deriv accounts' };
    }

    const matched = accResult.accounts.find((a) => a.account_type === targetMode);
    if (!matched) {
      return { ok: false, error: `No active ${targetMode.toUpperCase()} account found under this token` };
    }

    if (matched.balance < stake) {
      return {
        ok: false,
        error: `Insufficient balance on ${targetMode.toUpperCase()} account. Balance: $${matched.balance.toFixed(2)}, Stake needed: $${stake.toFixed(2)}`,
      };
    }

    targetAccountId = matched.account_id;
  }

  // Step 2: Request OTP WS URL
  const otpRes = await getAccountOtpWsUrl(token, appId, targetAccountId);
  if (!otpRes.ok || !otpRes.url) {
    return { ok: false, error: otpRes.error || 'Failed to obtain Deriv WebSocket OTP URL' };
  }

  // Step 3: Connect via WebSocket and purchase contract
  return new Promise<DerivExecutionResult>((resolve) => {
    let hasResolved = false;
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        try {
          ws.close();
        } catch {}
        resolve({ ok: false, error: 'Deriv trade execution timed out after 12 seconds' });
      }
    }, 12000);

    const ws = new WebSocket(otpRes.url!);

    ws.on('open', () => {
      const buyPayload: any = {
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: contractType,
          currency: 'USD',
          multiplier,
          underlying_symbol: symbol,
        },
      };

      // Add Limit Order (Take Profit and Stop Loss) if defined
      if (params.takeProfitUsd || params.stopLossUsd) {
        buyPayload.parameters.limit_order = {};
        if (params.takeProfitUsd && params.takeProfitUsd > 0) {
          buyPayload.parameters.limit_order.take_profit = Number(params.takeProfitUsd);
        }
        if (params.stopLossUsd && params.stopLossUsd > 0) {
          buyPayload.parameters.limit_order.stop_loss = Number(params.stopLossUsd);
        }
      }

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
              raw: msg,
            });
          }
          return;
        }

        if (msg.buy) {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            ws.close();

            const buyData = msg.buy;
            resolve({
              ok: true,
              contractId: buyData.contract_id,
              transactionId: buyData.transaction_id,
              buyPrice: buyData.buy_price,
              balanceAfter: buyData.balance_after,
              longcode: buyData.longcode,
              accountId: targetAccountId,
              accountType: targetMode,
              action,
              symbol,
              stake,
              multiplier,
              takeProfit: params.takeProfitUsd,
              stopLoss: params.stopLossUsd,
              raw: buyData,
            });
          }
        }
      } catch (err: any) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({ ok: false, error: err?.message || 'Error parsing broker response' });
        }
      }
    });

    ws.on('error', (err) => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timeout);
        resolve({ ok: false, error: `Deriv WebSocket error: ${err.message}` });
      }
    });
  });
}
