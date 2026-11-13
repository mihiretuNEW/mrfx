import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { calculateMarketStructureTargetTracker, Candle } from '../msttEngine.js';
import { executeDerivMultiplierTrade, DerivExecutionResult, MultiplierTradeParams, DerivTransportDeps } from './derivTrader.js';
import { sendTelegramDirect, loadAlertConfig, getDerivEnvCredentials } from './cloudAlertConfig.js';

const TIMEFRAME_SECONDS: Record<string, number> = {
  '1M': 60,
  '2M': 120,
  '3M': 180,
  '5M': 300,
  '10M': 600,
  '15M': 900,
  '30M': 1800,
  '1H': 3600,
  '2H': 7200,
  '4H': 14400,
  '8H': 28800,
  '1D': 86400,
};

const PROCESS_BOOT_ID = crypto.randomBytes(6).toString('hex');
const STALE_IN_FLIGHT_MS = 25_000;
const LOCK_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface DaemonLockRecord {
  signalId: string;
  authority: 'liveDerivDaemon';
  pid: number;
  bootId: string;
  state: 'IN_FLIGHT' | 'EXECUTED' | 'RECONCILED_EXECUTED' | 'UNCERTAIN_LOCKED' | 'DERIV_ERROR';
  phase: 'PRE_BUY' | 'BUY_DISPATCHED';
  contractId?: number;
  error?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

function getSymbolDisplayName(symbol: string): string {
  if (symbol === 'R_75') return 'Volatility 75 index';
  if (symbol === '1HZ75V') return 'Volatility 75 (1s) index';
  return symbol;
}

export function getLockFilePath(signalId: string): string {
  const safeId = signalId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join('/tmp', `lock_${safeId}.lock`);
}

function readLockFile(lockPath: string): DaemonLockRecord | null {
  try {
    const raw = fs.readFileSync(lockPath, 'utf-8');
    return JSON.parse(raw) as DaemonLockRecord;
  } catch {
    return null;
  }
}

export function updateDaemonLock(signalId: string, patch: Partial<DaemonLockRecord>) {
  const lockPath = getLockFilePath(signalId);
  try {
    const existing = readLockFile(lockPath);
    const updated: DaemonLockRecord = {
      signalId,
      authority: 'liveDerivDaemon',
      pid: process.pid,
      bootId: PROCESS_BOOT_ID,
      state: existing?.state || 'IN_FLIGHT',
      phase: existing?.phase || 'PRE_BUY',
      createdAtMs: existing?.createdAtMs || Date.now(),
      ...existing,
      ...patch,
      updatedAtMs: Date.now(),
    };
    fs.writeFileSync(lockPath, JSON.stringify(updated), 'utf-8');
  } catch {}
}

function releaseDaemonLock(signalId: string) {
  try {
    const p = getLockFilePath(signalId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

/**
 * Acquires an exclusive POSIX O_EXCL ('wx') execution lock for liveDerivDaemon.
 * Handles stale locks left behind by crashes/restarts safely:
 * - EXECUTED / RECONCILED_EXECUTED / UNCERTAIN_LOCKED / DERIV_ERROR: blocks duplicate order.
 * - IN_FLIGHT (stale from dead process/bootId or >25s):
 *   - phase === 'PRE_BUY': safe to reclaim and retry (buy frame never left socket).
 *   - phase === 'BUY_DISPATCHED' or corrupt: promotes to UNCERTAIN_LOCKED and blocks duplicate order.
 */
export function acquireDaemonExecutionLock(
  signalId: string,
  nowMs: number = Date.now()
): { acquired: boolean; reason?: string; recoveredStalePreBuy?: boolean } {
  const lockPath = getLockFilePath(signalId);
  const initialRecord: DaemonLockRecord = {
    signalId,
    authority: 'liveDerivDaemon',
    pid: process.pid,
    bootId: PROCESS_BOOT_ID,
    state: 'IN_FLIGHT',
    phase: 'PRE_BUY',
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };

  const tryCreate = () => {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, JSON.stringify(initialRecord));
    fs.closeSync(fd);
  };

  try {
    tryCreate();
    return { acquired: true };
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      return { acquired: false, reason: `LOCK_IO_ERROR:${err.code || err.message}` };
    }

    const existing = readLockFile(lockPath);
    if (!existing) {
      // Corrupt / unreadable lock file: fail closed to prevent duplicate order
      updateDaemonLock(signalId, {
        state: 'UNCERTAIN_LOCKED',
        phase: 'BUY_DISPATCHED',
        error: 'Corrupt lock file promoted to UNCERTAIN_LOCKED for duplicate protection',
      });
      return { acquired: false, reason: 'CORRUPT_LOCK_PROMOTED_UNCERTAIN' };
    }

    if (
      existing.state === 'EXECUTED' ||
      existing.state === 'RECONCILED_EXECUTED' ||
      existing.state === 'UNCERTAIN_LOCKED'
    ) {
      return { acquired: false, reason: `LOCKED_${existing.state}` };
    }

    if (existing.state === 'DERIV_ERROR') {
      return { acquired: false, reason: 'LOCKED_TERMINAL_ERROR' };
    }

    // Existing lock is IN_FLIGHT
    const isFromPreviousProcess = existing.pid !== process.pid || existing.bootId !== PROCESS_BOOT_ID;
    const isExpired = nowMs - (existing.updatedAtMs || existing.createdAtMs || 0) > STALE_IN_FLIGHT_MS;

    if (!isFromPreviousProcess && !isExpired) {
      return { acquired: false, reason: 'IN_FLIGHT_ACTIVE' };
    }

    // Stale IN_FLIGHT lock recovery
    if (existing.phase === 'PRE_BUY') {
      try {
        fs.unlinkSync(lockPath);
        tryCreate();
        return { acquired: true, recoveredStalePreBuy: true };
      } catch {
        return { acquired: false, reason: 'STALE_PRE_BUY_RECLAIM_LOST_RACE' };
      }
    }

    // Crash happened after buy payload was dispatched -> never risk opening a 2nd order
    updateDaemonLock(signalId, {
      state: 'UNCERTAIN_LOCKED',
      phase: 'BUY_DISPATCHED',
      error: 'Stale BUY_DISPATCHED lock recovered safely as UNCERTAIN_LOCKED',
    });
    return { acquired: false, reason: 'STALE_BUY_DISPATCHED_PROMOTED_UNCERTAIN' };
  }
}

const SIGNAL_LOG_PRIMARY = path.join(process.cwd(), '.signal_executions.json');
const SIGNAL_LOG_FALLBACK = path.join('/tmp', 'mcharts_signal_executions.json');

export type SignalLogStatus =
  | 'EXECUTED'
  | 'RECONCILED_EXECUTED'
  | 'PAUSED'
  | 'MISSING_CREDENTIALS'
  | 'DERIV_ERROR'
  | 'UNCERTAIN_LOCKED'
  | 'SKIPPED_FRESHNESS'
  | 'SKIPPED_SLIPPAGE'
  | 'SKIPPED_BEYOND_TPSL'
  | 'SKIPPED_LOCK';

export interface SignalExecutionLog {
  source: 'live_daemon';
  signalId: string;
  symbol: string;
  timeframe: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  slippagePips: number;
  status: SignalLogStatus;
  reason?: string;
  retryAttempts?: number;
  contractId?: number;
  reconciled?: boolean;
  mode: 'demo';
  error?: string;
  timestamp: string;
}

export function readPersistedExecutionLogs(): SignalExecutionLog[] {
  try {
    const targetRead = fs.existsSync(SIGNAL_LOG_PRIMARY)
      ? SIGNAL_LOG_PRIMARY
      : (fs.existsSync(SIGNAL_LOG_FALLBACK) ? SIGNAL_LOG_FALLBACK : null);
    if (targetRead) {
      const parsed = JSON.parse(fs.readFileSync(targetRead, 'utf-8'));
      if (Array.isArray(parsed)) {
        return parsed.map((r) => ({ ...r, source: 'live_daemon' as const }));
      }
    }
  } catch {}
  return [];
}

function appendSignalExecutionAsync(record: SignalExecutionLog) {
  setImmediate(() => {
    try {
      const existing = readPersistedExecutionLogs();
      const next = [record, ...existing.filter((r) => r.signalId !== record.signalId)].slice(0, 100);
      const serialized = JSON.stringify(next, null, 2);
      try { fs.writeFileSync(SIGNAL_LOG_PRIMARY, serialized, 'utf-8'); } catch {}
      try { fs.writeFileSync(SIGNAL_LOG_FALLBACK, serialized, 'utf-8'); } catch {}
    } catch {}
  });
}

export type TradeExecutorFn = (params: MultiplierTradeParams, deps?: DerivTransportDeps) => Promise<DerivExecutionResult>;

class LiveDerivDaemon {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private candles: Candle[] = [];
  private currentSymbol = 'R_75';
  private currentTimeframe = '1H';
  private currentHistorySpan = 'all';
  private granularity = 3600;

  private inFlightSignals = new Set<string>();
  private handledSignals = new Set<string>();
  private skippedLoggedIds = new Set<string>();

  private reconnectTimer: NodeJS.Timeout | null = null;
  private configWatchTimer: NodeJS.Timeout | null = null;
  private lastConfigMtime = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private handshakeTimer: NodeJS.Timeout | null = null;
  private hasCompletedInitialLoad = false;
  private lastDisconnectedAtMs = 0;
  private lastOpenedAtMs = 0;
  private endpointIndex = 0;
  private consecutiveQuickDrops = 0;

  private wsConnected = false;
  private connectAttempts = 0;
  private lastConnectedAt: string | null = null;
  private lastDisconnectedAt: string | null = null;
  private lastDisconnectReason: string | null = null;
  private lastHistoryLoadedAt: string | null = null;
  private currentEndpoint: string = 'wss://api.derivws.com/trading/v1/options/ws/public';

  private totalTicksReceived = 0;
  private lastTickTime: string | null = null;
  private lastTickEpoch: number | null = null;
  private lastTickPrice: number | null = null;

  private totalEvaluations = 0;
  private lastEvaluatedAt: string | null = null;
  private lastEvaluatedSignal: {
    signalId: string;
    barIndex: number;
    barTime: number;
    type: 'bull' | 'bear';
    entryPrice: number;
    evaluatedAt: string;
    outcome: string;
  } | null = null;

  private attemptedExecutions = 0;
  private successfulExecutions = 0;
  private failedExecutions = 0;
  private skippedSignalsCount = 0;
  private staleLocksRecovered = 0;
  private lastExecutionAt: string | null = null;
  private recentSignals: SignalExecutionLog[] = [];

  private tradeExecutor: TradeExecutorFn = executeDerivMultiplierTrade;
  private maxRetries = 2;

  private recoverHandledStateOnBoot() {
    const persisted = readPersistedExecutionLogs();
    this.recentSignals = persisted.slice(0, 50);
    for (const rec of persisted) {
      if (
        rec.status === 'EXECUTED' ||
        rec.status === 'RECONCILED_EXECUTED' ||
        rec.status === 'UNCERTAIN_LOCKED' ||
        rec.status === 'DERIV_ERROR'
      ) {
        this.handledSignals.add(rec.signalId);
      }
    }

    // Scan /tmp/lock_*.lock for prior executions, uncertain locks, or crashed IN_FLIGHT locks
    try {
      const files = fs.readdirSync('/tmp').filter((f) => f.startsWith('lock_') && f.endsWith('.lock'));
      const nowMs = Date.now();
      for (const file of files) {
        const fullPath = path.join('/tmp', file);
        const rec = readLockFile(fullPath);
        if (!rec || !rec.signalId) {
          try { fs.unlinkSync(fullPath); } catch {}
          continue;
        }
        if (nowMs - (rec.updatedAtMs || rec.createdAtMs || 0) > LOCK_RETENTION_MS && rec.state !== 'IN_FLIGHT') {
          try { fs.unlinkSync(fullPath); } catch {}
          continue;
        }
        if (
          rec.state === 'EXECUTED' ||
          rec.state === 'RECONCILED_EXECUTED' ||
          rec.state === 'UNCERTAIN_LOCKED' ||
          rec.state === 'DERIV_ERROR'
        ) {
          this.handledSignals.add(rec.signalId);
        } else if (rec.state === 'IN_FLIGHT') {
          if (rec.phase === 'PRE_BUY') {
            try {
              fs.unlinkSync(fullPath);
              this.staleLocksRecovered += 1;
              console.log(`[LiveDerivDaemon][Boot Recovery] Cleared stale PRE_BUY lock for ${rec.signalId}`);
            } catch {}
          } else {
            updateDaemonLock(rec.signalId, {
              state: 'UNCERTAIN_LOCKED',
              phase: 'BUY_DISPATCHED',
              error: 'Process restarted while BUY_DISPATCHED was in-flight; locked to prevent duplicate order.',
            });
            this.handledSignals.add(rec.signalId);
            this.staleLocksRecovered += 1;
            console.warn(`[LiveDerivDaemon][Boot Recovery] Promoted stale BUY_DISPATCHED lock to UNCERTAIN_LOCKED: ${rec.signalId}`);
          }
        }
      }
    } catch {}
  }

  public start() {
    this.recoverHandledStateOnBoot();
    const opts = this.getMergedOptions();
    const creds = getDerivEnvCredentials();

    console.log(`======================================================================`);
    console.log(`[RENDER BACKEND] 🚀 24/7 SOLE EXECUTION DAEMON STARTED (Demo Mode Only)`);
    console.log(
      `[LiveDerivDaemon] Boot -> Authority: SOLE | Mode: DEMO_ONLY | Credentials: ${creds.ok ? 'ENV CONFIGURED' : 'MISSING ENV VARS'} | AutoTrade: ${opts.derivAutoTradeEnabled !== false ? 'ON' : 'OFF'} | ADX: ${opts.useAdxFilter ? 'ON' : 'OFF'}`
    );
    console.log(`======================================================================`);
    this.syncConfig(true);
    this.connect();

    this.configWatchTimer = setInterval(() => {
      this.syncConfig(false);
    }, 3000);

    this.heartbeatTimer = setInterval(() => {
      const curOpts = this.getMergedOptions();
      const curCreds = getDerivEnvCredentials();
      console.log(
        `[LiveDerivDaemon Heartbeat] 🟢 WS:${this.wsConnected ? 'OPEN' : 'DOWN'} | ${this.currentSymbol} (${this.currentTimeframe}/${this.currentHistorySpan}) | Candles:${this.candles.length} | Ticks:${this.totalTicksReceived} | LastPrice:${this.lastTickPrice ?? '---'} | Creds:${curCreds.ok ? 'OK' : 'MISSING'} | AutoTrade:${curOpts.derivAutoTradeEnabled !== false ? 'ON' : 'PAUSED'} (DEMO ONLY)`
      );
    }, 60000);
  }

  private getMergedOptions(): Record<string, any> {
    const config = loadAlertConfig();
    const options = config.options || {};
    return {
      targetMode: 'points',
      pointsSl: Number(options.pointsSl || 165),
      pointsTp1: Number(options.pointsTp1 || 607),
      pointsTp2: Number(options.pointsTp2 || 650),
      pointsTp3: Number(options.pointsTp3 || 1000),
      slMulti: options.slMulti ?? 1.0,
      tp1Multi: options.tp1Multi ?? 1.5,
      tp2Multi: options.tp2Multi ?? 2.5,
      tp3Multi: options.tp3Multi ?? 5.0,
      atrLen: options.atrLen ?? 14,
      showTp1: options.showTp1 !== false,
      showTp2: Boolean(options.showTp2),
      showTp3: Boolean(options.showTp3),
      showSl: options.showSl !== false,
      targetFocus: options.targetFocus || 'TP1',
      invalidateMode: options.invalidateMode ?? true,
      keepN: options.keepN ?? 10,
      swingLen: Number(options.swingLen || 3),
      filterSwingLen: Number(options.filterSwingLen || 3),
      useStructureFilter: options.useStructureFilter ?? false,
      structureTf: options.structureTf || '15',
      useWickFilter: options.useWickFilter ?? false,
      maxWickRatio: options.maxWickRatio ?? 0.25,
      useDisplacementFilter: options.useDisplacementFilter ?? false,
      minDisplacementAtr: options.minDisplacementAtr ?? 0.5,
      useBodyCloseFilter: options.useBodyCloseFilter ?? false,
      minBodyRatio: options.minBodyRatio ?? 0.5,
      useSweepFilter: options.useSweepFilter ?? false,
      sweepLookback: options.sweepLookback ?? 10,
      useFvgFilter: Boolean(options.useFvgFilter),
      useVolumeFilter: Boolean(options.useVolumeFilter),
      volumeLength: options.volumeLength ?? 20,
      volumeMultiplier: options.volumeMultiplier ?? 1.20,
      useScoreFilter: Boolean(options.useScoreFilter),
      minContinuationScore: options.minContinuationScore ?? 60,
      useHtfFilter: options.useHtfFilter ?? false,
      htfRes: options.htfRes || '240',
      htfRsiLen: options.htfRsiLen ?? 14,
      useEmaFilter: Boolean(options.useEmaFilter),
      emaLen: options.emaLen ?? 200,
      useAdxFilter: options.useAdxFilter ?? false,
      diLen: options.diLen ?? 14,
      adxSmooth: options.adxSmooth ?? 14,
      minAdx: options.minAdx ?? 20.0,
      useCandleFilter: Boolean(options.useCandleFilter),
      minBodyAtr: options.minBodyAtr ?? 0.20,
      breakoutBufferAtr: options.breakoutBufferAtr ?? 0.00,
      preventLateEntry: options.preventLateEntry ?? false,
      maxBreakoutDelay: options.maxBreakoutDelay ?? 1,
      usePremiumDiscountFilter: Boolean(options.usePremiumDiscountFilter),
      useInducementFilter: Boolean(options.useInducementFilter),
      useKillZonesFilter: Boolean(options.useKillZonesFilter),
      useTurtleSoupFilter: Boolean(options.useTurtleSoupFilter),
      useRetestConfirmation: Boolean(options.useRetestConfirmation),
      retestMaxBars: options.retestMaxBars ?? 3,
      useAntiWhipsawFilter: options.useAntiWhipsawFilter ?? true,
      whipsawCooldownBars: options.whipsawCooldownBars ?? 4,
      ...options,
      derivMode: 'demo',
    };
  }

  private syncConfig(force: boolean) {
    try {
      const configPath = path.join(process.cwd(), '.cloud_alert_config.json');
      if (fs.existsSync(configPath)) {
        const stat = fs.statSync(configPath);
        if (force || stat.mtimeMs > this.lastConfigMtime) {
          const wasInitial = this.lastConfigMtime === 0;
          this.lastConfigMtime = stat.mtimeMs;
          const config = loadAlertConfig();
          const newSymbol = config.symbol || 'R_75';
          const newTf = config.timeframe || '1H';
          const opts = config.options || {};
          const newHistorySpan = String(opts.historySpan || 'all');

          if (!wasInitial && !force) {
            console.log(
              `[LiveDerivDaemon] Config Synced -> AutoTrade: ${opts.derivAutoTradeEnabled !== false ? 'ON' : 'OFF'} | Mode: DEMO_ONLY | TF: ${newTf} | Span: ${newHistorySpan} | ADX: ${opts.useAdxFilter ? 'ON' : 'OFF'} | SL: ${opts.pointsSl} | TP1: ${opts.pointsTp1}`
            );
          }

          if (newSymbol !== this.currentSymbol || newTf !== this.currentTimeframe || newHistorySpan !== this.currentHistorySpan) {
            console.log(`[LiveDerivDaemon] Market/History changed: ${this.currentSymbol}/${this.currentTimeframe}/${this.currentHistorySpan} -> ${newSymbol}/${newTf}/${newHistorySpan}`);
            this.currentSymbol = newSymbol;
            this.currentTimeframe = newTf;
            this.currentHistorySpan = newHistorySpan;
            this.granularity = TIMEFRAME_SECONDS[newTf] || 3600;
            this.hasCompletedInitialLoad = false;
            this.reconnect();
          }
        }
      }
    } catch {
      // ignore config read error
    }
  }

  public getStatus() {
    const creds = getDerivEnvCredentials();
    const opts = this.getMergedOptions();
    const autoTradingEnabled = opts.derivAutoTradeEnabled !== false;
    const wsOpen = this.wsConnected && Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);

    let autoTradingPausedReason: string | null = null;
    if (!autoTradingEnabled) {
      autoTradingPausedReason = 'Auto-trading is paused in settings (derivAutoTradeEnabled=false).';
    } else if (!creds.ok) {
      autoTradingPausedReason = creds.error || 'Missing backend DERIV_API_TOKEN or DERIV_APP_ID.';
    } else if (!wsOpen) {
      autoTradingPausedReason = 'Deriv public market WebSocket is reconnecting.';
    }

    return {
      executionAuthority: 'liveDerivDaemon',
      enforcedMode: 'demo' as const,
      realTradingEnabled: false,
      autoTradingEnabled,
      autoTradingActive: autoTradingEnabled && creds.ok && wsOpen,
      autoTradingPausedReason,
      symbol: this.currentSymbol,
      timeframe: this.currentTimeframe,
      historySpan: this.currentHistorySpan,
      wsConnected: wsOpen,
      candlesLoaded: this.candles.length,
      lastTick: {
        epoch: this.lastTickEpoch,
        price: this.lastTickPrice,
        receivedAt: this.lastTickTime,
        totalTicks: this.totalTicksReceived,
      },
      lastEvaluatedSignal: this.lastEvaluatedSignal,
      recentExecutions: this.recentSignals.slice(0, 20),
      stages: {
        wsConnection: {
          connected: wsOpen,
          endpoint: this.currentEndpoint,
          connectAttempts: this.connectAttempts,
          consecutiveQuickDrops: this.consecutiveQuickDrops,
          lastConnectedAt: this.lastConnectedAt,
          lastDisconnectedAt: this.lastDisconnectedAt,
          lastDisconnectReason: this.lastDisconnectReason,
        },
        candleHistory: {
          loaded: this.hasCompletedInitialLoad,
          count: this.candles.length,
          lastLoadedAt: this.lastHistoryLoadedAt,
        },
        liveTicks: {
          totalReceived: this.totalTicksReceived,
          lastTickAt: this.lastTickTime,
          lastPrice: this.lastTickPrice,
        },
        strategyEvaluation: {
          totalEvaluations: this.totalEvaluations,
          lastEvaluatedAt: this.lastEvaluatedAt,
        },
        tradeExecution: {
          authority: 'liveDerivDaemon',
          enforcedMode: 'demo',
          credentialsConfigured: creds.ok,
          autoTradingEnabled,
          attempted: this.attemptedExecutions,
          executed: this.successfulExecutions,
          failed: this.failedExecutions,
          skipped: this.skippedSignalsCount,
          staleLocksRecovered: this.staleLocksRecovered,
          lastExecutionAt: this.lastExecutionAt,
        },
      },
    };
  }

  public getLiveCandlesSnapshot(symbol: string, timeframe: string): { candles: Candle[]; fresh: boolean } | null {
    const wsOpen = this.wsConnected && Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
    if (!wsOpen || !this.hasCompletedInitialLoad) return null;
    if (this.currentSymbol !== symbol || this.currentTimeframe !== timeframe) return null;
    if (this.candles.length < 30) return null;
    return {
      candles: this.candles.map((c) => ({ ...c })),
      fresh: true,
    };
  }

  public getExecutionLogs(limit = 50): SignalExecutionLog[] {
    const combined = [...this.recentSignals];
    const persisted = readPersistedExecutionLogs();
    for (const item of persisted) {
      if (!combined.some((c) => c.signalId === item.signalId)) {
        combined.push(item);
      }
    }
    return combined.slice(0, limit);
  }

  private getCandleCountForSpan(): number {
    if (this.currentHistorySpan === '1W') {
      return Math.min(1000, Math.max(168, Math.ceil((7 * 86400) / this.granularity)));
    }
    if (this.currentHistorySpan === '2W') {
      return Math.min(1000, Math.max(336, Math.ceil((14 * 86400) / this.granularity)));
    }
    if (this.currentHistorySpan === '1M') {
      return Math.min(1000, Math.max(720, Math.ceil((30 * 86400) / this.granularity)));
    }
    return 1000;
  }

  private getPublicWsEndpoints(): string[] {
    const endpoints = [
      'wss://api.derivws.com/trading/v1/options/ws/public',
      'wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089',
      'wss://api.derivws.com/trading/v1/options/ws/public?app_id=36544',
    ];
    return endpoints;
  }

  private clearWsTimers() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private disposeSocket(sock: WebSocket | null) {
    if (!sock) return;
    try {
      sock.removeAllListeners();
    } catch {}
    try {
      if (sock.readyState === WebSocket.OPEN) {
        sock.close(1000, 'daemon_reconnect');
      } else if (sock.readyState === WebSocket.CONNECTING) {
        sock.terminate();
      }
    } catch {}
  }

  private connect() {
    if (this.isConnecting) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearWsTimers();

    // Dispose any prior socket cleanly with listeners detached BEFORE creating a new one
    if (this.ws) {
      const oldSocket = this.ws;
      this.ws = null;
      this.disposeSocket(oldSocket);
    }

    this.isConnecting = true;
    this.connectAttempts += 1;

    try {
      const endpoints = this.getPublicWsEndpoints();
      const wsUrl = endpoints[this.endpointIndex % endpoints.length];
      this.currentEndpoint = wsUrl;

      const socket = new WebSocket(wsUrl, {
        perMessageDeflate: false,
        handshakeTimeout: 10000,
        headers: {
          'User-Agent': 'Mire75TraderDaemon/1.0',
        },
      });
      this.ws = socket;

      this.handshakeTimer = setTimeout(() => {
        if (this.ws !== socket) return;
        if (socket.readyState !== WebSocket.OPEN) {
          console.warn(`[LiveDerivDaemon][Stage 1: WS Handshake Timeout] ${wsUrl} timed out after 10s`);
          this.ws = null;
          this.disposeSocket(socket);
          this.wsConnected = false;
          this.isConnecting = false;
          this.lastDisconnectedAt = new Date().toISOString();
          this.lastDisconnectedAtMs = Date.now();
          this.lastDisconnectReason = 'handshake_timeout';
          this.rotateEndpointAndBackoff();
          this.scheduleReconnect();
        }
      }, 10500);

      socket.on('open', () => {
        if (this.ws !== socket) {
          this.disposeSocket(socket);
          return;
        }
        if (this.handshakeTimer) {
          clearTimeout(this.handshakeTimer);
          this.handshakeTimer = null;
        }
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.isConnecting = false;
        this.wsConnected = true;
        this.lastOpenedAtMs = Date.now();
        this.lastConnectedAt = new Date().toISOString();
        console.log(`[LiveDerivDaemon][Stage 1: WS Connected] (${wsUrl}) Subscribing to ${this.currentSymbol} ${this.currentTimeframe} (${this.currentHistorySpan}) live ticks...`);

        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.ws !== socket) return;
          try {
            if (socket.readyState === WebSocket.OPEN) {
              socket.ping();
              socket.send(JSON.stringify({ ping: 1 }));
            }
          } catch {}
        }, 20000);

        const candleCount = this.getCandleCountForSpan();
        socket.send(JSON.stringify({
          ticks_history: this.currentSymbol,
          adjust_start_time: 1,
          count: candleCount,
          end: 'latest',
          start: 1,
          style: 'candles',
          granularity: this.granularity,
          subscribe: 1,
        }));
      });

      socket.on('message', (data: WebSocket.RawData) => {
        if (this.ws !== socket) return;
        try {
          const raw = typeof data === 'string' ? data : data.toString();
          const msg = JSON.parse(raw);

          if (msg.ping === 'pong' || msg.msg_type === 'ping') return;

          if (msg.error) {
            console.warn('[LiveDerivDaemon] Deriv WS message error:', msg.error.message || JSON.stringify(msg.error));
            return;
          }

          if (msg.candles && Array.isArray(msg.candles)) {
            this.candles = msg.candles.map((c: any) => ({
              time: Number(c.epoch),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            }));
            this.lastHistoryLoadedAt = new Date().toISOString();

            const disconnectDurationSec = this.lastDisconnectedAtMs > 0
              ? (Date.now() - this.lastDisconnectedAtMs) / 1000
              : 9999;
            const isFastReconnect = this.hasCompletedInitialLoad && disconnectDurationSec <= 10;

            try {
              const options = this.getMergedOptions();
              const result = calculateMarketStructureTargetTracker(this.candles, options as any, this.currentSymbol);
              const markers = result.signalMarkers || [];
              const lastCandleIdx = this.candles.length - 1;
              const nowSec = Math.floor(Date.now() / 1000);
              let newlySeeded = 0;

              for (const m of markers) {
                const candleCloseSec = m.time + this.granularity;
                const isJustClosed = m.barIndex === lastCandleIdx - 1 && (nowSec - candleCloseSec <= 10);
                const isCurrentBarJustOpened = m.barIndex === lastCandleIdx && (nowSec - m.time <= 10);
                const isCurrentBarOnFastReconnect = m.barIndex === lastCandleIdx && isFastReconnect;
                const isFresh = isJustClosed || isCurrentBarJustOpened || isCurrentBarOnFastReconnect;

                if (!isFresh) {
                  const id = `SIG_${this.currentSymbol}_${this.currentTimeframe}_${m.time}_${m.type}`;
                  if (!this.handledSignals.has(id)) {
                    newlySeeded++;
                    this.handledSignals.add(id);
                  }
                }
              }

              this.hasCompletedInitialLoad = true;
              console.log(
                `[LiveDerivDaemon][Stage 2: History Loaded] ${this.candles.length} candles (reconnect=${isFastReconnect ? `${disconnectDurationSec.toFixed(1)}s` : 'boot'}). Seeded ${newlySeeded} old historical signals. Waiting for LIVE ticks.`
              );

              if (isFastReconnect) {
                this.evaluateLiveMarket('live_tick');
              }
            } catch (err: any) {
              this.hasCompletedInitialLoad = true;
              console.error('[LiveDerivDaemon] Error seeding historical signals:', err.message);
            }
            return;
          }

          if (msg.ohlc) {
            if (this.lastOpenedAtMs > 0 && Date.now() - this.lastOpenedAtMs > 15000) {
              this.consecutiveQuickDrops = 0;
            }
            const ohlc = msg.ohlc;
            const candleEpoch = Number(ohlc.open_time || ohlc.epoch);
            const open = Number(ohlc.open);
            const high = Number(ohlc.high);
            const low = Number(ohlc.low);
            const close = Number(ohlc.close);

            this.totalTicksReceived += 1;
            this.lastTickEpoch = Number(ohlc.epoch || candleEpoch);
            this.lastTickPrice = close;
            this.lastTickTime = new Date().toISOString();

            if (this.candles.length > 0) {
              const lastCandle = this.candles[this.candles.length - 1];
              if (lastCandle.time === candleEpoch) {
                lastCandle.high = Math.max(lastCandle.high, high);
                lastCandle.low = Math.min(lastCandle.low, low);
                lastCandle.close = close;
              } else if (candleEpoch > lastCandle.time) {
                this.candles.push({
                  time: candleEpoch,
                  open,
                  high,
                  low,
                  close,
                });
                if (this.candles.length > 1000) {
                  this.candles.shift();
                }
              }
            } else {
              this.candles.push({ time: candleEpoch, open, high, low, close });
            }

            this.evaluateLiveMarket('live_tick');
          }
        } catch {
          // ignore parse errors
        }
      });

      socket.on('error', (err) => {
        if (this.ws !== socket) return;
        this.wsConnected = false;
        this.isConnecting = false;
        this.lastDisconnectedAt = new Date().toISOString();
        this.lastDisconnectReason = err.message;
        console.error('[LiveDerivDaemon][Stage 1: WS Error]', err.message);
      });

      socket.on('close', (code) => {
        if (this.ws !== socket) return;
        this.ws = null;
        this.clearWsTimers();
        this.wsConnected = false;
        this.isConnecting = false;
        this.lastDisconnectedAt = new Date().toISOString();
        this.lastDisconnectedAtMs = Date.now();
        this.lastDisconnectReason = `closed(${code})`;

        const openDurationMs = this.lastOpenedAtMs > 0 ? (Date.now() - this.lastOpenedAtMs) : 0;
        if (openDurationMs < 15000) {
          this.rotateEndpointAndBackoff();
        } else {
          this.consecutiveQuickDrops = 0;
        }

        const delayMs = this.getReconnectDelayMs();
        console.warn(`[LiveDerivDaemon][Stage 1: WS Closed] code=${code} (open=${(openDurationMs / 1000).toFixed(1)}s). Reconnecting in ${(delayMs / 1000).toFixed(1)}s...`);
        this.scheduleReconnect(delayMs);
      });
    } catch (e: any) {
      this.ws = null;
      this.clearWsTimers();
      this.wsConnected = false;
      this.isConnecting = false;
      this.lastDisconnectReason = e.message;
      console.error('[LiveDerivDaemon] Connection failed:', e.message);
      this.lastDisconnectedAtMs = Date.now();
      this.rotateEndpointAndBackoff();
      this.scheduleReconnect();
    }
  }

  private rotateEndpointAndBackoff() {
    this.consecutiveQuickDrops += 1;
    this.endpointIndex = (this.endpointIndex + 1) % this.getPublicWsEndpoints().length;
  }

  private getReconnectDelayMs(): number {
    if (this.consecutiveQuickDrops <= 1) return 2000;
    if (this.consecutiveQuickDrops === 2) return 3000;
    if (this.consecutiveQuickDrops === 3) return 5000;
    return 10000;
  }

  private scheduleReconnect(delayMs?: number) {
    this.isConnecting = false;
    this.clearWsTimers();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const waitMs = delayMs ?? this.getReconnectDelayMs();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, waitMs);
  }

  private reconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearWsTimers();
    if (this.ws) {
      const oldSocket = this.ws;
      this.ws = null;
      this.disposeSocket(oldSocket);
    }
    this.wsConnected = false;
    this.isConnecting = false;
    this.consecutiveQuickDrops = 0;
    this.candles = [];
    this.scheduleReconnect(250);
  }

  private recordSignalLog(record: SignalExecutionLog, persistAsync = true) {
    this.recentSignals = [record, ...this.recentSignals.filter((r) => r.signalId !== record.signalId)].slice(0, 50);
    if (persistAsync) {
      appendSignalExecutionAsync(record);
    }
  }

  private logSkipOnce(
    uniqueSignalId: string,
    status: SignalLogStatus,
    reason: string,
    meta: { symbol: string; tf: string; action: 'BUY' | 'SELL'; entryPrice: number; slPrice: number; tpPrice: number; slippagePips: number }
  ) {
    if (!this.skippedLoggedIds.has(uniqueSignalId)) {
      this.skippedLoggedIds.add(uniqueSignalId);
      this.skippedSignalsCount += 1;
      console.log(`[LiveDerivDaemon][Stage 5: Signal Skipped] ${uniqueSignalId} (${status}): ${reason}`);
      this.recordSignalLog({
        source: 'live_daemon',
        signalId: uniqueSignalId,
        symbol: meta.symbol,
        timeframe: meta.tf,
        action: meta.action,
        entryPrice: meta.entryPrice,
        slPrice: meta.slPrice,
        tpPrice: meta.tpPrice,
        slippagePips: Number(meta.slippagePips.toFixed(2)),
        status,
        reason,
        mode: 'demo',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Test hook for verifying Stage 4 -> Stage 6 and stale-lock recovery deterministically.
   */
  public async evaluateCandlesForTest(
    testCandles: Candle[],
    opts: {
      symbol?: string;
      timeframe?: string;
      executor?: TradeExecutorFn;
      nowSecOverride?: number;
      maxRetries?: number;
      overrideOptions?: Record<string, any>;
      clearHandledId?: string;
    } = {}
  ): Promise<SignalExecutionLog | null> {
    const prevCandles = this.candles;
    const prevSymbol = this.currentSymbol;
    const prevTf = this.currentTimeframe;
    const prevExec = this.tradeExecutor;
    const prevRetries = this.maxRetries;

    this.candles = testCandles.map((c) => ({ ...c }));
    this.currentSymbol = opts.symbol || 'R_75';
    this.currentTimeframe = opts.timeframe || '1H';
    this.granularity = TIMEFRAME_SECONDS[this.currentTimeframe] || 3600;
    if (opts.executor) this.tradeExecutor = opts.executor;
    if (opts.maxRetries !== undefined) this.maxRetries = opts.maxRetries;
    if (opts.clearHandledId) {
      this.handledSignals.delete(opts.clearHandledId);
      this.skippedLoggedIds.delete(opts.clearHandledId);
    }

    try {
      await this.evaluateLiveMarket('live_tick', opts.nowSecOverride, opts.overrideOptions);
      return this.recentSignals[0] || null;
    } finally {
      this.candles = prevCandles;
      this.currentSymbol = prevSymbol;
      this.currentTimeframe = prevTf;
      this.granularity = TIMEFRAME_SECONDS[prevTf] || 3600;
      this.tradeExecutor = prevExec;
      this.maxRetries = prevRetries;
    }
  }

  private async evaluateLiveMarket(
    triggerSource: string,
    nowSecOverride?: number,
    overrideOptions?: Record<string, any>
  ) {
    if (triggerSource !== 'live_tick') return;
    if (this.candles.length < 30) return;

    try {
      const config = loadAlertConfig();
      const options = { ...this.getMergedOptions(), ...(overrideOptions || {}) };
      const tf = this.currentTimeframe;
      const symbol = this.currentSymbol;

      // Stage 4: Strategy Evaluation
      this.totalEvaluations += 1;
      this.lastEvaluatedAt = new Date().toISOString();

      const result = calculateMarketStructureTargetTracker(this.candles, options as any, symbol);
      const markers = result.signalMarkers || [];
      if (markers.length === 0) return;

      const recentMarker = markers[markers.length - 1];
      const lastCandleIdx = this.candles.length - 1;
      const activeCandle = this.candles[lastCandleIdx];
      const nowSec = nowSecOverride ?? Math.floor(Date.now() / 1000);
      const uniqueSignalId = `SIG_${symbol}_${tf}_${recentMarker.time}_${recentMarker.type}`;

      const isBull = recentMarker.type === 'bull';
      const action: 'BUY' | 'SELL' = isBull ? 'BUY' : 'SELL';
      const entryPrice = recentMarker.entryPrice || recentMarker.price || activeCandle.close;
      const slPips = Number(options.pointsSl || 165);
      const tp1Pips = Number(options.pointsTp1 || 607);
      const slPrice = recentMarker.slPrice || (isBull ? entryPrice - slPips : entryPrice + slPips);
      const tpPrice = recentMarker.tp1Price || (isBull ? entryPrice + tp1Pips : entryPrice - tp1Pips);
      const pipsMovedPastEntry = isBull ? (activeCandle.close - entryPrice) : (entryPrice - activeCandle.close);

      this.lastEvaluatedSignal = {
        signalId: uniqueSignalId,
        barIndex: recentMarker.barIndex,
        barTime: recentMarker.time,
        type: recentMarker.type,
        entryPrice,
        evaluatedAt: this.lastEvaluatedAt,
        outcome: this.handledSignals.has(uniqueSignalId) ? 'HANDLED' : 'EVALUATING',
      };

      // Stage 5: Freshness, Slippage & Lock Guards
      if (this.handledSignals.has(uniqueSignalId) || this.inFlightSignals.has(uniqueSignalId)) {
        return;
      }

      if (recentMarker.barIndex < lastCandleIdx - 1) {
        return;
      }

      if (recentMarker.barIndex === lastCandleIdx - 1) {
        const candleCloseSec = recentMarker.time + this.granularity;
        const secondsSinceClose = nowSec - candleCloseSec;
        if (secondsSinceClose > 10) {
          this.logSkipOnce(
            uniqueSignalId,
            'SKIPPED_FRESHNESS',
            `Candle closed ${secondsSinceClose}s ago (> 10s fresh limit)`,
            { symbol, tf, action, entryPrice, slPrice, tpPrice, slippagePips: pipsMovedPastEntry }
          );
          this.handledSignals.add(uniqueSignalId);
          this.lastEvaluatedSignal.outcome = 'SKIPPED_FRESHNESS';
          return;
        }
      }

      if (pipsMovedPastEntry > 20) {
        this.logSkipOnce(
          uniqueSignalId,
          'SKIPPED_SLIPPAGE',
          `Price moved ${pipsMovedPastEntry.toFixed(1)} pips past entry (> 20 pips limit)`,
          { symbol, tf, action, entryPrice, slPrice, tpPrice, slippagePips: pipsMovedPastEntry }
        );
        this.handledSignals.add(uniqueSignalId);
        this.lastEvaluatedSignal.outcome = 'SKIPPED_SLIPPAGE';
        return;
      }

      const beyondTpOrSl = isBull
        ? (activeCandle.close >= tpPrice || activeCandle.close <= slPrice)
        : (activeCandle.close <= tpPrice || activeCandle.close >= slPrice);
      if (beyondTpOrSl) {
        this.logSkipOnce(
          uniqueSignalId,
          'SKIPPED_BEYOND_TPSL',
          `Price ${activeCandle.close} already past TP (${tpPrice.toFixed(2)}) or SL (${slPrice.toFixed(2)})`,
          { symbol, tf, action, entryPrice, slPrice, tpPrice, slippagePips: pipsMovedPastEntry }
        );
        this.handledSignals.add(uniqueSignalId);
        this.lastEvaluatedSignal.outcome = 'SKIPPED_BEYOND_TPSL';
        return;
      }

      const isAutoTradeEnabled = options.derivAutoTradeEnabled !== false;
      // DEMO MODE ONLY: Never enable Real trading
      const mode: 'demo' = 'demo';

      if (!isAutoTradeEnabled) {
        this.logSkipOnce(
          uniqueSignalId,
          'PAUSED',
          'Auto-Trade is paused in settings (derivAutoTradeEnabled=false)',
          { symbol, tf, action, entryPrice, slPrice, tpPrice, slippagePips: pipsMovedPastEntry }
        );
        this.handledSignals.add(uniqueSignalId);
        this.lastEvaluatedSignal.outcome = 'PAUSED';
        return;
      }

      // Acquire in-flight mutex + crash-safe /tmp atomic lock BEFORE sending buy order
      this.inFlightSignals.add(uniqueSignalId);
      const lockAcquisition = acquireDaemonExecutionLock(uniqueSignalId);
      if (lockAcquisition.recoveredStalePreBuy) {
        this.staleLocksRecovered += 1;
        console.log(`[LiveDerivDaemon][Lock Recovery] Reclaimed stale PRE_BUY lock for ${uniqueSignalId}`);
      }
      if (!lockAcquisition.acquired) {
        this.inFlightSignals.delete(uniqueSignalId);
        this.logSkipOnce(
          uniqueSignalId,
          'SKIPPED_LOCK',
          `Execution lock prevented duplicate order (${lockAcquisition.reason})`,
          { symbol, tf, action, entryPrice, slPrice, tpPrice, slippagePips: pipsMovedPastEntry }
        );
        this.handledSignals.add(uniqueSignalId);
        this.lastEvaluatedSignal.outcome = 'SKIPPED_LOCK';
        return;
      }

      console.log(
        `[LiveDerivDaemon][Stage 5 -> Stage 6] ⚡ GENUINE LIVE BREAKOUT DETECTED: ${uniqueSignalId} | DEMO ${action} @ ${activeCandle.close} (slippage: ${pipsMovedPastEntry.toFixed(1)} pips <= 20)`
      );

      let execStatus: SignalLogStatus = 'DERIV_ERROR';
      let execContractId: number | undefined;
      let execReconciled = false;
      let execError: string | undefined;
      let attempts = 0;
      let tradeExecutionReport = '';

      try {
        this.attemptedExecutions += 1;
        this.lastExecutionAt = new Date().toISOString();

        for (let attempt = 1; attempt <= 1 + this.maxRetries; attempt++) {
          attempts = attempt;
          if (attempt > 1) {
            const retryCandle = this.candles[this.candles.length - 1];
            const retryNowSec = nowSecOverride ?? Math.floor(Date.now() / 1000);
            if (recentMarker.barIndex === lastCandleIdx - 1 && (retryNowSec - (recentMarker.time + this.granularity)) > 10) {
              execError = `${execError || 'Transient failure'} | Retry aborted: >10s freshness expired`;
              break;
            }
            const retrySlip = isBull ? (retryCandle.close - entryPrice) : (entryPrice - retryCandle.close);
            if (retrySlip > 20) {
              execError = `${execError || 'Transient failure'} | Retry aborted: slippage ${retrySlip.toFixed(1)} > 20 pips`;
              break;
            }
            await new Promise((r) => setTimeout(r, 250));
          }

          const tradeRes = await this.tradeExecutor(
            {
              mode,
              action,
              symbol,
              stake: Number(options.derivStake || 2.0),
              multiplier: Number(options.derivMultiplier || 200),
              takeProfitUsd: Number(options.derivTakeProfitUsd || 6.68),
              stopLossUsd: Number(options.derivStopLossUsd || 2.0),
              maxConsecutiveLosses: Number(options.derivMaxConsecutiveLosses || 3),
            },
            {
              onBuyDispatched: () => {
                updateDaemonLock(uniqueSignalId, { state: 'IN_FLIGHT', phase: 'BUY_DISPATCHED' });
              },
            }
          );

          if (tradeRes.ok && tradeRes.contractId) {
            execStatus = tradeRes.reconciled ? 'RECONCILED_EXECUTED' : 'EXECUTED';
            execContractId = tradeRes.contractId;
            execReconciled = Boolean(tradeRes.reconciled);
            execError = undefined;
            this.successfulExecutions += 1;
            this.handledSignals.add(uniqueSignalId);
            updateDaemonLock(uniqueSignalId, {
              state: execStatus,
              phase: 'BUY_DISPATCHED',
              contractId: execContractId,
            });

            tradeExecutionReport =
              `\n\n⚡ <b>DERIV DEMO ORDER PLACED!</b>\n` +
              `🆔 Contract: #${tradeRes.contractId}\n` +
              `💵 Stake: $${(tradeRes.stake ?? Number(options.derivStake || 2)).toFixed(2)} USD (${tradeRes.multiplier ?? 200}x)\n` +
              `🎯 TP: +$${(tradeRes.takeProfit ?? 6.68).toFixed(2)} | 🛑 SL: -$${(tradeRes.stopLoss ?? 2.0).toFixed(2)}\n` +
              (tradeRes.balanceAfter !== undefined ? `💰 Balance After: $${tradeRes.balanceAfter.toFixed(2)} USD\n` : '');
            console.log(`[LiveDerivDaemon][Stage 6: Deriv Confirmed] ✅ Demo Contract #${tradeRes.contractId}`);
            break;
          }

          execError = tradeRes.error || 'Unknown Deriv execution error';

          if (tradeRes.uncertain) {
            execStatus = 'UNCERTAIN_LOCKED';
            this.failedExecutions += 1;
            this.handledSignals.add(uniqueSignalId);
            updateDaemonLock(uniqueSignalId, {
              state: 'UNCERTAIN_LOCKED',
              phase: 'BUY_DISPATCHED',
              error: execError,
            });
            console.error(`[LiveDerivDaemon][Stage 6: UNCERTAIN] 🛑 ${uniqueSignalId}: ${execError}`);
            break;
          }

          if (execError.includes('DERIV_API_TOKEN') || execError.includes('DERIV_APP_ID')) {
            execStatus = 'MISSING_CREDENTIALS';
            this.failedExecutions += 1;
            this.handledSignals.add(uniqueSignalId);
            releaseDaemonLock(uniqueSignalId);
            console.error(`[LiveDerivDaemon][Stage 6: MISSING CREDENTIALS] ❌ ${execError}`);
            break;
          }

          if (!tradeRes.retryable || attempt >= 1 + this.maxRetries) {
            execStatus = 'DERIV_ERROR';
            this.failedExecutions += 1;
            this.handledSignals.add(uniqueSignalId);
            updateDaemonLock(uniqueSignalId, {
              state: 'DERIV_ERROR',
              error: execError,
            });
            console.error(`[LiveDerivDaemon][Stage 6: Execution Failed] ❌ ${uniqueSignalId} after ${attempts} attempt(s): ${execError}`);
            break;
          }

          console.warn(`[LiveDerivDaemon][Stage 6: Transient Error] Retrying (${attempt}/${this.maxRetries}): ${execError}`);
        }

        if (execStatus === 'DERIV_ERROR' || execStatus === 'MISSING_CREDENTIALS' || execStatus === 'UNCERTAIN_LOCKED') {
          tradeExecutionReport = `\n\n⚠️ <i>Deriv Execution Status (${execStatus}): ${execError}</i>`;
        }
      } finally {
        this.inFlightSignals.delete(uniqueSignalId);
      }

      if (this.lastEvaluatedSignal) {
        this.lastEvaluatedSignal.outcome = execStatus;
      }

      const logRecord: SignalExecutionLog = {
        source: 'live_daemon',
        signalId: uniqueSignalId,
        symbol,
        timeframe: tf,
        action,
        entryPrice,
        slPrice,
        tpPrice,
        slippagePips: Number(pipsMovedPastEntry.toFixed(2)),
        status: execStatus,
        reason: execStatus === 'EXECUTED' || execStatus === 'RECONCILED_EXECUTED'
          ? 'Live breakout confirmed and executed on Deriv Demo'
          : execError,
        retryAttempts: attempts,
        contractId: execContractId,
        reconciled: execReconciled || undefined,
        mode: 'demo',
        error: execError,
        timestamp: new Date().toISOString(),
      };
      this.recordSignalLog(logRecord, true);

      const botToken = config.botToken || '';
      const chatId = config.chatId || '';
      if (botToken && chatId) {
        const symbolName = getSymbolDisplayName(symbol);
        const arrow = isBull ? '🟢' : '🔴';
        const direction = isBull ? 'BUY (Long)' : 'SELL (Short)';
        const msg =
          `⚡ <b>REAL-TIME MSTT BREAKOUT SIGNAL</b>\n\n` +
          `🪙 Pair: <b>${symbolName}</b>\n` +
          `${arrow} Direction: <b>${direction}</b>\n` +
          `⏰ Timeframe: <b>${tf}</b>\n\n` +
          `🎯 Entry: <b>${entryPrice.toFixed(2)}</b>\n` +
          `✅ TP: <b>${tpPrice.toFixed(2)}</b> (+${tp1Pips} pips)\n` +
          `🛑 Stop Loss: <b>${slPrice.toFixed(2)}</b> (-${slPips} pips)\n` +
          `⚖️ Mode: <b>DEMO ONLY</b>` +
          tradeExecutionReport +
          `\n\n<tg-spoiler>#${uniqueSignalId}</tg-spoiler>`;

        await sendTelegramDirect(botToken, chatId, msg);
      }
    } catch (err: any) {
      console.error('[LiveDerivDaemon] Error in live market evaluation:', err.message);
    }
  }
}

export const liveDerivDaemon = new LiveDerivDaemon();
