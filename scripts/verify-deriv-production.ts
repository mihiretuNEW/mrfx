import assert from 'assert';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import {
  getDerivEnvCredentials,
  loadAlertConfig,
  saveAlertConfig,
} from '../api/_lib/cloudAlertConfig.js';
import { calculateMrovTradeOpeningRange } from '../src/utils/mrovTradeOpeningRange.js';
import {
  executeDerivMultiplierTrade,
  DerivAccount,
} from '../api/_lib/derivTrader.js';
import {
  liveDerivDaemon,
  acquireDaemonExecutionLock,
  getLockFilePath,
} from '../api/_lib/liveDerivDaemon.js';
import cronHandler, { getCronMonitorStatus } from '../api/cron-check.js';
import { Candle, calculateMarketStructureTargetTracker } from '../api/msttEngine.js';
import { calculateMarketStructureTargetTracker as frontendMsttEngine } from '../src/utils/marketStructureTargetTracker.js';

async function run() {
  console.log('=== [1/6] Testing Credential Hygiene, Env-Only & Switchable Demo/Real Policy ===');
  const savedReal = saveAlertConfig({
    options: {
      derivApiToken: 'pat_SHOULD_NOT_BE_SAVED',
      derivAppId: 'SHOULD_NOT_BE_SAVED',
      derivMode: 'real',
    },
  });
  assert.strictEqual((savedReal.options as any).derivApiToken, undefined, 'derivApiToken must be stripped from saved options');
  assert.strictEqual((savedReal.options as any).derivAppId, undefined, 'derivAppId must be stripped from saved options');
  assert.strictEqual(savedReal.options.derivMode, 'real', 'saveAlertConfig must persist valid Real mode');
  assert.strictEqual(loadAlertConfig().options.derivMode, 'real', 'loadAlertConfig must preserve Real mode');

  const savedDemo = saveAlertConfig({
    options: {
      derivMode: 'demo',
    },
  });
  assert.strictEqual(savedDemo.options.derivMode, 'demo', 'saveAlertConfig must switch cleanly back to Demo mode');

  const diskCfg = fs.readFileSync(path.join(process.cwd(), '.cloud_alert_config.json'), 'utf-8');
  assert.ok(!diskCfg.includes('pat_SHOULD_NOT_BE_SAVED'), '.cloud_alert_config.json must not persist derivApiToken');
  assert.ok(!diskCfg.includes('SHOULD_NOT_BE_SAVED'), '.cloud_alert_config.json must not persist derivAppId');

  const prevToken = process.env.DERIV_API_TOKEN;
  const prevAppId = process.env.DERIV_APP_ID;
  delete process.env.DERIV_API_TOKEN;
  delete process.env.DERIV_APP_ID;

  const missingCreds = getDerivEnvCredentials();
  assert.strictEqual(missingCreds.ok, false, 'Missing env credentials must return ok=false');

  const missingExec = await executeDerivMultiplierTrade({
    mode: 'demo',
    action: 'BUY',
    symbol: 'R_75',
    stake: 2,
    multiplier: 200,
  });
  assert.strictEqual(missingExec.ok, false);
  assert.strictEqual(missingExec.retryable, false, 'Missing credentials must not trigger retries');
  assert.ok(missingExec.error?.includes('DERIV_API_TOKEN'), 'Error must clearly explain missing DERIV_API_TOKEN');

  const missingRealExec = await executeDerivMultiplierTrade({
    mode: 'real',
    action: 'BUY',
    symbol: 'R_75',
    stake: 2,
    multiplier: 100,
  });
  assert.strictEqual(missingRealExec.ok, false);
  assert.strictEqual(missingRealExec.retryable, false);
  assert.ok(missingRealExec.error?.includes('DERIV_API_TOKEN'), 'Real mode must also require backend env credentials');
  console.log('PASS [1/6]: Zero tokens stored, missing env fails cleanly, Demo/Real mode switching verified.');

  console.log('=== [2/6] Testing Strict Account Isolation, Active USD Selection & Reconciliation ===');
  process.env.DERIV_API_TOKEN = 'test_env_token_only';
  process.env.DERIV_APP_ID = '99999';

  const demoOnlyAccounts: DerivAccount[] = [
    { account_id: 'DOT11111111', balance: 5000, currency: 'USD', account_type: 'demo', status: 'active' },
  ];
  const realOnlyAccounts: DerivAccount[] = [
    { account_id: 'ROT00000000', balance: 0, currency: 'USD', account_type: 'real', status: 'disabled' },
    { account_id: 'ROT22222222', balance: 100, currency: 'USD', account_type: 'real', status: 'active' },
  ];
  const bothAccounts: DerivAccount[] = [...demoOnlyAccounts, ...realOnlyAccounts];

  const demoBlockedOnRealOnly = await executeDerivMultiplierTrade(
    { mode: 'demo', action: 'BUY', symbol: 'R_75', stake: 2, multiplier: 200 },
    { fetchAccountsFn: async () => ({ ok: true, accounts: realOnlyAccounts }) }
  );
  assert.strictEqual(demoBlockedOnRealOnly.ok, false);
  assert.ok(demoBlockedOnRealOnly.error?.includes('No DEMO account'), 'Demo mode must never fall back to Real account');

  const realBlockedOnDemoOnly = await executeDerivMultiplierTrade(
    { mode: 'real', action: 'BUY', symbol: 'R_75', stake: 2, multiplier: 100 },
    { fetchAccountsFn: async () => ({ ok: true, accounts: demoOnlyAccounts }) }
  );
  assert.strictEqual(realBlockedOnDemoOnly.ok, false);
  assert.ok(realBlockedOnDemoOnly.error?.includes('No REAL account'), 'Real mode must never fall back to Demo account');

  let selectedOtpAccount = '';
  const demoSuccess = await executeDerivMultiplierTrade(
    { mode: 'demo', action: 'BUY', symbol: 'R_75', stake: 2, multiplier: 200, takeProfitUsd: 6, stopLossUsd: 2 },
    {
      fetchAccountsFn: async () => ({ ok: true, accounts: bothAccounts }),
      getOtpWsUrlFn: async (id) => { selectedOtpAccount = id; return { ok: true, url: 'wss://mock.deriv/otp' }; },
      wsBuyFn: async () => ({ ok: true, buy: { contract_id: 123456789, transaction_id: 987654321, buy_price: 2, balance_after: 4998 } }),
    }
  );
  assert.strictEqual(demoSuccess.ok, true);
  assert.strictEqual(selectedOtpAccount, 'DOT11111111');
  assert.strictEqual(demoSuccess.contractId, 123456789);
  assert.strictEqual(demoSuccess.accountType, 'demo');
  assert.ok(!JSON.stringify(demoSuccess).includes('DOT11111111'), 'Raw account ID must never leak in result');

  const realSuccess = await executeDerivMultiplierTrade(
    { mode: 'real', action: 'SELL', symbol: 'R_75', stake: 2, multiplier: 100, takeProfitUsd: 2, stopLossUsd: 2 },
    {
      fetchAccountsFn: async () => ({ ok: true, accounts: bothAccounts }),
      getOtpWsUrlFn: async (id) => { selectedOtpAccount = id; return { ok: true, url: 'wss://mock.deriv/otp' }; },
      wsBuyFn: async () => ({ ok: true, buy: { contract_id: 223344556, transaction_id: 55667788, buy_price: 2, balance_after: 98 } }),
    }
  );
  assert.strictEqual(realSuccess.ok, true);
  assert.strictEqual(selectedOtpAccount, 'ROT22222222', 'Real execution must select active funded USD account instead of empty/disabled sub-account');
  assert.strictEqual(realSuccess.contractId, 223344556);
  assert.strictEqual(realSuccess.accountType, 'real');
  assert.ok(!JSON.stringify(realSuccess).includes('ROT22222222'), 'Raw real account ID must never leak in result');

  const reconciledWin = await executeDerivMultiplierTrade(
    { mode: 'demo', action: 'BUY', symbol: 'R_75', stake: 2, multiplier: 200 },
    {
      fetchAccountsFn: async () => ({ ok: true, accounts: bothAccounts }),
      getOtpWsUrlFn: async () => ({ ok: true, url: 'wss://mock.deriv/otp' }),
      wsBuyFn: async () => ({ ok: false, error: 'timeout', retryable: false, uncertain: true }),
      reconcileFn: async () => ({ found: true, contractId: 777888999, buyPrice: 2 }),
    }
  );
  assert.strictEqual(reconciledWin.ok, true);
  assert.strictEqual(reconciledWin.contractId, 777888999);
  assert.strictEqual(reconciledWin.reconciled, true);
  console.log('PASS [2/6]: Account isolation, masking, and uncertain-timeout reconciliation verified.');

  console.log('=== [3/6] Verifying cron-check.ts Cannot Execute Deriv Trades (Monitor-Only) ===');
  const cronSource = fs.readFileSync(path.join(process.cwd(), 'api', 'cron-check.ts'), 'utf-8');
  assert.ok(!cronSource.includes('executeDerivMultiplierTrade'), 'cron-check.ts must not reference executeDerivMultiplierTrade');

  let cronJsonPayload: any = null;
  const mockCronRes = {
    setHeader: () => {},
    status: () => mockCronRes,
    json: (payload: any) => { cronJsonPayload = payload; },
    end: () => {},
  };
  await cronHandler({ method: 'GET', query: { checkOnly: '1' }, body: {} }, mockCronRes);
  assert.ok(cronJsonPayload, 'cron-check handler should return JSON payload');
  assert.strictEqual(cronJsonPayload.role, 'MONITOR_ONLY');
  assert.strictEqual(cronJsonPayload.executionAuthority, 'liveDerivDaemon');
  assert.strictEqual(cronJsonPayload.cronExecutionDisabled, true);
  assert.strictEqual(cronJsonPayload.activeMode, 'demo');
  assert.strictEqual(cronJsonPayload.realTradingEnabled, true);
  const monitorStatus = getCronMonitorStatus();
  assert.strictEqual(monitorStatus.mode, 'MONITOR_ONLY');
  assert.strictEqual(monitorStatus.autoTradeExecutionDisabled, true);
  assert.ok(monitorStatus.totalRuns >= 1);
  console.log('PASS [3/6]: cron-check.ts confirmed strictly MONITOR_ONLY (zero trade execution capability).');

  console.log('=== [4/6] Testing Sole Execution Daemon Path, Safe Retry, and Single Order Lock ===');
  const candles: Candle[] = await new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089');
    const t = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('Public WS timeout')); }, 10000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ ticks_history: 'R_75', adjust_start_time: 1, count: 250, end: 'latest', start: 1, style: 'candles', granularity: 3600 }));
    });
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.candles) {
        clearTimeout(t);
        ws.close();
        resolve(m.candles.map((c: any) => ({ time: Number(c.epoch), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) })));
      }
    });
    ws.on('error', (e) => { clearTimeout(t); reject(e); });
  });

  const targetIdx = candles.findIndex((c) => c.time === 1794585600);
  assert.ok(targetIdx > 30, 'Expected Nov 13 16:00Z candle present in Deriv public history');
  const liveSlice = candles.slice(0, targetIdx + 1);
  liveSlice[liveSlice.length - 1] = {
    ...liveSlice[liveSlice.length - 1],
    close: 40135.0,
  };

  const sigLockId = `SIG_R_75_1H_${liveSlice[liveSlice.length - 1].time}_bull`;
  const testLockPath = getLockFilePath(sigLockId);
  if (fs.existsSync(testLockPath)) fs.unlinkSync(testLockPath);

  let execCalls = 0;
  const firstRunLog = await liveDerivDaemon.evaluateCandlesForTest(liveSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    clearHandledId: sigLockId,
    overrideOptions: { useCandleFilter: false, breakoutBufferAtr: 0, useAdxFilter: false, useStructureFilter: false, useWickFilter: false, useBodyCloseFilter: false, useDisplacementFilter: false, useHtfFilter: false, derivAutoTradeEnabled: true },
    executor: async (_params, deps) => {
      execCalls += 1;
      deps?.onBuyDispatched?.();
      if (execCalls === 1) {
        return { ok: false, retryable: true, uncertain: false, error: 'Simulated transient socket reset before buy' };
      }
      return { ok: true, contractId: 99887766, stake: 2, multiplier: 200, takeProfit: 6.68, stopLoss: 2, balanceAfter: 4998 };
    },
  });

  assert.ok(firstRunLog, 'Expected signal log record from autonomous live-signal evaluation');
  assert.strictEqual(firstRunLog!.source, 'live_daemon');
  assert.strictEqual(firstRunLog!.mode, 'demo');
  assert.strictEqual(execCalls, 2, 'Expected 1 transient failure + 1 safe retry = 2 total executor calls');
  assert.strictEqual(firstRunLog!.status, 'EXECUTED');
  assert.strictEqual(firstRunLog!.contractId, 99887766);

  // Fire a 2nd tick on same bar -> must NOT execute duplicate order
  await liveDerivDaemon.evaluateCandlesForTest(liveSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    overrideOptions: { useCandleFilter: false, breakoutBufferAtr: 0, useAdxFilter: false, useStructureFilter: false, useWickFilter: false, useBodyCloseFilter: false, useDisplacementFilter: false, useHtfFilter: false, derivAutoTradeEnabled: true },
    executor: async () => {
      execCalls += 1;
      return { ok: true, contractId: 111111 };
    },
  });
  assert.strictEqual(execCalls, 2, 'Subsequent ticks on handled signal must NOT open duplicate orders');

  // Verify Honest Entry Parity & Filter-Active Breakout Execution (no false SKIPPED_SLIPPAGE, no back-dated bosLevel entry)
  const filterTestOpts = {
    targetMode: 'points',
    pointsSl: 165,
    pointsTp1: 607,
    targetFocus: 'TP1',
    swingLen: 3,
    useCandleFilter: true,
    minBodyAtr: 1,
    breakoutBufferAtr: 0.4,
    useAdxFilter: false,
    useStructureFilter: false,
    useWickFilter: false,
    useBodyCloseFilter: false,
    useDisplacementFilter: false,
    useHtfFilter: false,
    derivAutoTradeEnabled: true,
  };
  const baseCandlesForFilter = candles.slice(0, targetIdx + 1);
  baseCandlesForFilter[baseCandlesForFilter.length - 1] = {
    ...baseCandlesForFilter[baseCandlesForFilter.length - 1],
    close: Math.max(baseCandlesForFilter[baseCandlesForFilter.length - 1].close, 40500),
    high: Math.max(baseCandlesForFilter[baseCandlesForFilter.length - 1].high, 40520),
  };
  const backendFilterRes = calculateMarketStructureTargetTracker(baseCandlesForFilter, filterTestOpts as any, 'R_75');
  const frontendFilterRes = frontendMsttEngine(baseCandlesForFilter, filterTestOpts as any, 'R_75');
  assert.strictEqual(backendFilterRes.signalMarkers.length, frontendFilterRes.signalMarkers.length, 'Backend and frontend MSTT marker counts must match');
  assert.strictEqual(backendFilterRes.dashboard.stats?.totalTrades, frontendFilterRes.dashboard.stats?.totalTrades, 'Backend and frontend MSTT trade counts must match');
  assert.strictEqual(backendFilterRes.dashboard.stats?.winRate, frontendFilterRes.dashboard.stats?.winRate, 'Backend and frontend MSTT win rates must match');
  const nov13MarkerBackend = backendFilterRes.signalMarkers.find((m) => m.time === 1794585600);
  const nov13MarkerFrontend = frontendFilterRes.signalMarkers.find((m) => m.time === 1794585600);
  assert.ok(nov13MarkerBackend && nov13MarkerFrontend, 'Expected Nov 13 breakout marker under CANDLE filter');
  assert.ok(typeof nov13MarkerBackend!.entryPrice === 'number' && typeof nov13MarkerBackend!.slPrice === 'number', 'Expected entryPrice and slPrice on marker');
  assert.strictEqual(nov13MarkerBackend!.entryPrice, nov13MarkerFrontend!.entryPrice, 'Backend & frontend honest entryPrice must match exactly');
  assert.ok(nov13MarkerBackend!.entryPrice! > 40250, `Honest CANDLE entryPrice (${nov13MarkerBackend!.entryPrice}) must NOT back-date to old bosLevel (40132.20)`);
  assert.strictEqual(Number((nov13MarkerBackend!.entryPrice! - nov13MarkerBackend!.slPrice!).toFixed(2)), 165, 'SL must anchor to honest real-time entryPrice');

  // Genuine >20 pips past honest trigger (+35 pips) MUST still block via SKIPPED_SLIPPAGE
  const honestTriggerPrice = nov13MarkerBackend!.entryPrice!;
  const excessiveSlipSlice = baseCandlesForFilter.map((c, idx) =>
    idx === baseCandlesForFilter.length - 1 ? { ...c, close: Number((honestTriggerPrice + 35).toFixed(4)) } : c
  );
  if (fs.existsSync(testLockPath)) fs.unlinkSync(testLockPath);
  let blockedSlipCalls = 0;
  const slipBlockedLog = await liveDerivDaemon.evaluateCandlesForTest(excessiveSlipSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    clearHandledId: sigLockId,
    overrideOptions: filterTestOpts,
    executor: async () => {
      blockedSlipCalls += 1;
      return { ok: true, contractId: 999 };
    },
  });
  assert.strictEqual(blockedSlipCalls, 0, 'Genuine >20 pip slippage past honest trigger must still be blocked');
  assert.strictEqual(slipBlockedLog?.status, 'SKIPPED_SLIPPAGE');

  // Simulate live tick right after honest trigger (+3 pips above honest trigger, >180 pips above old bosLevel) -> MUST EXECUTE
  const liveFilterSlice = baseCandlesForFilter.map((c, idx) =>
    idx === baseCandlesForFilter.length - 1 ? { ...c, close: Number((honestTriggerPrice + 3).toFixed(4)) } : c
  );
  if (fs.existsSync(testLockPath)) fs.unlinkSync(testLockPath);
  let filterExecCalls = 0;
  const filterExecLog = await liveDerivDaemon.evaluateCandlesForTest(liveFilterSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    clearHandledId: sigLockId,
    overrideOptions: filterTestOpts,
    executor: async (_params, deps) => {
      filterExecCalls += 1;
      deps?.onBuyDispatched?.();
      return { ok: true, contractId: 44556677, stake: 2, multiplier: 200, takeProfit: 6.68, stopLoss: 2, balanceAfter: 4998 };
    },
  });
  assert.strictEqual(filterExecCalls, 1, 'Live tick +3 pips past honest CANDLE trigger must execute cleanly instead of false SKIPPED_SLIPPAGE');
  assert.strictEqual(filterExecLog?.status, 'EXECUTED');

  // Verify liveDerivDaemon respects Real mode when configured
  if (fs.existsSync(testLockPath)) fs.unlinkSync(testLockPath);
  let capturedDaemonMode: string = '';
  const realDaemonLog = await liveDerivDaemon.evaluateCandlesForTest(liveSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    clearHandledId: sigLockId,
    overrideOptions: { derivMode: 'real', useCandleFilter: false, breakoutBufferAtr: 0, useAdxFilter: false, useStructureFilter: false, useWickFilter: false, useBodyCloseFilter: false, useDisplacementFilter: false, useHtfFilter: false, derivAutoTradeEnabled: true },
    executor: async (params, deps) => {
      capturedDaemonMode = params.mode;
      deps?.onBuyDispatched?.();
      return { ok: true, contractId: 88776655, accountType: 'real', stake: 2, multiplier: 100, takeProfit: 2, stopLoss: 2, balanceAfter: 7.0 };
    },
  });
  assert.strictEqual(capturedDaemonMode, 'real', 'Daemon must forward derivMode="real" to tradeExecutor when Real mode is enabled');
  assert.strictEqual(realDaemonLog?.mode, 'real');
  assert.strictEqual(realDaemonLog?.status, 'EXECUTED');

  console.log('PASS [4/6]: Sole daemon executed Demo & Real contracts cleanly with honest MSTT parity + filter slippage guards.');

  console.log('=== [5/6] Testing Crash & Stale /tmp Lock Recovery ===');
  // Case A: EXECUTED lock persists in /tmp even if in-memory handledSignals was cleared (simulated restart)
  let lockBlockedExecCalls = 0;
  const blockedByExecutedLock = await liveDerivDaemon.evaluateCandlesForTest(liveSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    clearHandledId: sigLockId,
    overrideOptions: { useCandleFilter: false, breakoutBufferAtr: 0, useAdxFilter: false, useStructureFilter: false, useWickFilter: false, useBodyCloseFilter: false, useDisplacementFilter: false, useHtfFilter: false, derivAutoTradeEnabled: true },
    executor: async () => {
      lockBlockedExecCalls += 1;
      return { ok: true, contractId: 555555 };
    },
  });
  assert.strictEqual(lockBlockedExecCalls, 0, 'Persisted EXECUTED /tmp lock must prevent duplicate trade even after memory reset');
  assert.strictEqual(blockedByExecutedLock?.status, 'SKIPPED_LOCK');

  // Case B: Dead PID stale IN_FLIGHT lock in PRE_BUY phase -> safely reclaimed and executed once
  fs.writeFileSync(
    testLockPath,
    JSON.stringify({
      signalId: sigLockId,
      authority: 'liveDerivDaemon',
      pid: 999999,
      bootId: 'crashed-boot-1',
      state: 'IN_FLIGHT',
      phase: 'PRE_BUY',
      createdAtMs: Date.now() - 60_000,
      updatedAtMs: Date.now() - 60_000,
    }),
    'utf-8'
  );
  let preBuyRecoveredCalls = 0;
  const reclaimedLog = await liveDerivDaemon.evaluateCandlesForTest(liveSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    clearHandledId: sigLockId,
    overrideOptions: { useCandleFilter: false, breakoutBufferAtr: 0, useAdxFilter: false, useStructureFilter: false, useWickFilter: false, useBodyCloseFilter: false, useDisplacementFilter: false, useHtfFilter: false, derivAutoTradeEnabled: true },
    executor: async (_params, deps) => {
      preBuyRecoveredCalls += 1;
      deps?.onBuyDispatched?.();
      return { ok: true, contractId: 33445566, stake: 2, multiplier: 200, takeProfit: 6.68, stopLoss: 2, balanceAfter: 4996 };
    },
  });
  assert.strictEqual(preBuyRecoveredCalls, 1, 'Stale PRE_BUY lock from crashed process should be reclaimed cleanly');
  assert.strictEqual(reclaimedLog?.status, 'EXECUTED');

  // Case C: Dead PID stale IN_FLIGHT lock in BUY_DISPATCHED phase -> promoted fail-closed to UNCERTAIN_LOCKED
  fs.writeFileSync(
    testLockPath,
    JSON.stringify({
      signalId: sigLockId,
      authority: 'liveDerivDaemon',
      pid: 999999,
      bootId: 'crashed-boot-2',
      state: 'IN_FLIGHT',
      phase: 'BUY_DISPATCHED',
      createdAtMs: Date.now() - 60_000,
      updatedAtMs: Date.now() - 60_000,
    }),
    'utf-8'
  );
  let uncertainCalls = 0;
  const blockedUncertain = await liveDerivDaemon.evaluateCandlesForTest(liveSlice, {
    symbol: 'R_75',
    timeframe: '1H',
    clearHandledId: sigLockId,
    overrideOptions: { useCandleFilter: false, breakoutBufferAtr: 0, useAdxFilter: false, useStructureFilter: false, useWickFilter: false, useBodyCloseFilter: false, useDisplacementFilter: false, useHtfFilter: false, derivAutoTradeEnabled: true },
    executor: async () => {
      uncertainCalls += 1;
      return { ok: true, contractId: 777777 };
    },
  });
  assert.strictEqual(uncertainCalls, 0, 'Stale BUY_DISPATCHED lock must NEVER re-send a buy order');
  assert.strictEqual(blockedUncertain?.status, 'SKIPPED_LOCK');
  const promotedDisk = JSON.parse(fs.readFileSync(testLockPath, 'utf-8'));
  assert.strictEqual(promotedDisk.state, 'UNCERTAIN_LOCKED');

  // Case D: Corrupt lock file fails closed to UNCERTAIN_LOCKED
  const corruptSigId = 'SIG_CORRUPT_TEST_1H_999';
  const corruptLockPath = getLockFilePath(corruptSigId);
  fs.writeFileSync(corruptLockPath, '{corrupt-json', 'utf-8');
  const corruptAcquire = acquireDaemonExecutionLock(corruptSigId);
  assert.strictEqual(corruptAcquire.acquired, false);
  assert.strictEqual(corruptAcquire.reason, 'CORRUPT_LOCK_PROMOTED_UNCERTAIN');

  if (fs.existsSync(testLockPath)) fs.unlinkSync(testLockPath);
  if (fs.existsSync(corruptLockPath)) fs.unlinkSync(corruptLockPath);
  console.log('PASS [5/6]: Crash & stale /tmp lock recovery verified (PRE_BUY reclaim + BUY_DISPATCHED fail-closed).');

  console.log('=== [6/6] Testing Live Local HTTP Endpoints (/api/health, /api/execution-logs, /api/deriv-trade) ===');
  const healthRes = await fetch('http://localhost:3000/api/health');
  assert.strictEqual(healthRes.status, 200);
  const healthJson: any = await healthRes.json();
  assert.strictEqual(healthJson.status, 'ok');
  assert.strictEqual(healthJson.executionAuthority, 'liveDerivDaemon');
  assert.strictEqual(healthJson.cronExecutionDisabled, true);
  assert.strictEqual(healthJson.modePolicy?.realTradingEnabled, true);
  assert.deepStrictEqual(healthJson.modePolicy?.supportedModes, ['demo', 'real']);
  assert.ok(healthJson.modePolicy?.activeMode === 'demo' || healthJson.modePolicy?.activeMode === 'real', '/api/health must expose activeMode');
  assert.ok(healthJson.daemon && typeof healthJson.daemon.autoTradingEnabled === 'boolean', '/api/health must expose daemon.autoTradingEnabled');
  assert.ok(healthJson.daemon && healthJson.daemon.stages, '/api/health must expose daemon stage telemetry');
  assert.ok(typeof healthJson.daemon.stages.wsConnection?.endpoint === 'string', '/api/health must expose wsConnection.endpoint');
  assert.strictEqual(typeof healthJson.daemon.stages.wsConnection?.consecutiveQuickDrops, 'number', '/api/health must expose wsConnection.consecutiveQuickDrops');
  assert.ok(healthJson.cronMonitor && healthJson.cronMonitor.mode === 'MONITOR_ONLY', '/api/health must report cronMonitor as MONITOR_ONLY');
  const healthRaw = JSON.stringify(healthJson);
  assert.ok(!healthRaw.includes('pat_') && !healthRaw.includes('DOT') && !healthRaw.includes('ROT'), '/api/health must not expose credentials or account IDs');

  const logsRes = await fetch('http://localhost:3000/api/execution-logs');
  assert.strictEqual(logsRes.status, 200);
  const logsJson: any = await logsRes.json();
  assert.strictEqual(logsJson.ok, true);
  assert.strictEqual(logsJson.executionAuthority, 'liveDerivDaemon');
  assert.strictEqual(logsJson.cronExecutionDisabled, true);
  assert.strictEqual(logsJson.modePolicy?.realTradingEnabled, true);
  assert.ok(Array.isArray(logsJson.daemonSignals), '/api/execution-logs must return daemonSignals array');
  assert.ok(Array.isArray(logsJson.cronMonitorEvents), '/api/execution-logs must return cronMonitorEvents array');

  // Verify invalid execution mode returns 400 (while 'demo' and 'real' are accepted modes)
  const invalidModeRes = await fetch('http://localhost:3000/api/deriv-trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'execute', mode: 'invalid_mode', direction: 'BUY' }),
  });
  assert.strictEqual(invalidModeRes.status, 400, `POST /api/deriv-trade must reject invalid mode with 400 (got ${invalidModeRes.status})`);

  // Verify HTTP Demo/Real toggle via /api/cloud-alert-config
  const prevCfgBeforeSwitch = loadAlertConfig();
  const switchToRealHttp = await fetch('http://localhost:3000/api/cloud-alert-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options: { derivMode: 'real' } }),
  });
  assert.strictEqual(switchToRealHttp.status, 200);
  const realHttpJson: any = await switchToRealHttp.json();
  assert.strictEqual(realHttpJson.config?.options?.derivMode, 'real', 'HTTP config endpoint must persist Real mode');

  const switchToDemoHttp = await fetch('http://localhost:3000/api/cloud-alert-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options: { derivMode: prevCfgBeforeSwitch.options?.derivMode || 'demo' } }),
  });
  assert.strictEqual(switchToDemoHttp.status, 200);

  // Protected test endpoint must reject unauthorized requests cleanly
  const unauthTestRes = await fetch('http://localhost:3000/api/deriv-trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'protected_buy_test', mode: 'demo' }),
  });
  assert.ok(unauthTestRes.status === 401 || unauthTestRes.status === 403, `Protected test endpoint must block unauthorized calls (got ${unauthTestRes.status})`);

  // Test Telegram Env Var priority over cached disk JSON + Mrov 1H & 30M + Points/Pips mode
  const prevTgToken = process.env.TELEGRAM_BOT_TOKEN;
  const prevTgChat = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = '999999:NEW_ENV_BOT_TOKEN';
  process.env.TELEGRAM_CHAT_ID = '555555555';
  const savedWithEnv = saveAlertConfig({
    botToken: '111111...MASKED',
    chatId: '000000000',
  });
  assert.strictEqual(savedWithEnv.botToken, '999999:NEW_ENV_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN env var must override disk/UI tokens');
  assert.strictEqual(savedWithEnv.chatId, '555555555', 'TELEGRAM_CHAT_ID env var must override disk/UI chat ID');
  const loadedWithEnv = loadAlertConfig();
  assert.strictEqual(loadedWithEnv.botToken, '999999:NEW_ENV_BOT_TOKEN');
  assert.strictEqual(loadedWithEnv.chatId, '555555555');
  const diskConfigCheck = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.cloud_alert_config.json'), 'utf-8'));
  assert.strictEqual(diskConfigCheck.botToken, '', 'Disk config must not retain old/env-managed botToken');
  if (prevTgToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = prevTgToken;
  if (prevTgChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
  else process.env.TELEGRAM_CHAT_ID = prevTgChat;

  // Test Mrov Opening Range on 1H and 30M + fixed Points/Pips SL/TP
  const mrov1hRes = calculateMrovTradeOpeningRange(candles, '1H', {
    targetMode: 'points',
    pointsSl: 165,
    pointsTp: 607,
  });
  assert.strictEqual(mrov1hRes.validTimeframe, true, 'Mrov Opening Range must support 1H timeframe');
  assert.ok(mrov1hRes.ranges.length > 0, 'Mrov 1H must detect NY Opening Range boxes');
  if (mrov1hRes.trades.length > 0) {
    const t = mrov1hRes.trades[0];
    assert.strictEqual(Number(Math.abs(t.entryPrice - t.stopPrice).toFixed(2)), 165, 'Mrov Points mode SL must match written 165 pips');
    assert.strictEqual(Number(Math.abs(t.targetPrice - t.entryPrice).toFixed(2)), 607, 'Mrov Points mode TP must match written 607 pips');
  }
  const mrov30mRes = calculateMrovTradeOpeningRange(candles, '30M', {
    targetMode: 'points',
    pointsSl: 200,
    pointsTp: 500,
  });
  assert.strictEqual(mrov30mRes.validTimeframe, true, 'Mrov Opening Range must support 30M timeframe');

  if (prevToken === undefined) delete process.env.DERIV_API_TOKEN;
  else process.env.DERIV_API_TOKEN = prevToken;
  if (prevAppId === undefined) delete process.env.DERIV_APP_ID;
  else process.env.DERIV_APP_ID = prevAppId;

  // Clean test-generated logs so dev workspace starts clean
  const p1 = path.join(process.cwd(), '.signal_executions.json');
  const p2 = path.join('/tmp', 'mcharts_signal_executions.json');
  if (fs.existsSync(p1)) fs.unlinkSync(p1);
  if (fs.existsSync(p2)) fs.unlinkSync(p2);

  console.log('PASS [6/6]: Health, separated monitoring endpoints, Telegram env priority, Mrov 1H/30M+Pips, and Demo/Real mode switching verified cleanly.');
  console.log('ALL VERIFICATION CHECKS PASSED!');
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
