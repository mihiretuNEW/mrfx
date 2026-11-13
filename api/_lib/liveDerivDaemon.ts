import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { calculateMarketStructureTargetTracker, Candle } from '../msttEngine.js';
import { executeDerivMultiplierTrade, DerivExecutionResult, MultiplierTradeParams } from './derivTrader.js';
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

function getSymbolDisplayName(symbol: string): string {
  if (symbol === 'R_75') return 'Volatility 75 index';
  if (symbol === '1HZ75V') return 'Volatility 75 (1s) index';
  return symbol;
}

function getLockFilePath(signalId: string): string {
  const safeId = signalId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join('/tmp', `lock_${safeId}.lock`);
}

function tryAcquireDaemonLock(signalId: string): boolean {
  const lockPath = getLockFilePath(signalId);
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, JSON.stringify({ signalId, source: 'liveDerivDaemon', status: 'IN_FLIGHT', time: Date.now() }));
    fs.closeSync(fd);
    return true;
  } catch (err: any) {
    if (err.code === 'EEXIST') {
      return false;
    }
    return true;
  }
}

function updateDaemonLock(signalId: string, data: Record<string, any>) {
  try {
    fs.writeFileSync(getLockFilePath(signalId), JSON.stringify({ signalId, ...data, updatedAt: Date.now() }), 'utf-8');
  } catch {}
}

function releaseDaemonLock(signalId: string) {
  try {
    const p = getLockFilePath(signalId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
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
  mode?: 'demo' | 'real';
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
      if (Array.isArray(parsed)) return parsed;
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

export type TradeExecutorFn = (params: MultiplierTradeParams) => Promise<DerivExecutionResult>;

class LiveDerivDaemon {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private candles: Candle[] = [];
  private currentSymbol = 'R_75';
  private currentTimeframe = '1H';
  private currentHistorySpan = 'all';
  private granularity = 3600;

  // State sets: only handledSignals permanently suppresses future ticks!
  private inFlightSignals = new Set<string>();
  private handledSignals = new Set<string>();
  private skippedLoggedIds = new Set<string>();

  private reconnectTimer: NodeJS.Timeout | null = null;
  private configWatchTimer: NodeJS.Timeout | null = null;
  private lastConfigMtime = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private hasCompletedInitialLoad = false;
  private lastDisconnectedAtMs = 0;

  // Detailed stage monitoring telemetry (zero secrets!)
  private wsConnected = false;
  private connectAttempts = 0;
  private lastConnectedAt: string | null = null;
  private lastDisconnectedAt: string | null = null;
  private lastDisconnectReason: string | null = null;
  private lastHistoryLoadedAt: string | null = null;

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
  private lastExecutionAt: string | null = null;
  private recentSignals: SignalExecutionLog[] = [];

  private tradeExecutor: TradeExecutorFn = executeDerivMultiplierTrade;
  private maxRetries = 2;

  public start() {
    this.recentSignals = readPersistedExecutionLogs().slice(0, 50);
    const opts = this.getMergedOptions();
    const creds = getDerivEnvCredentials();

    console.log(`======================================================================`);
    console.log(`[RENDER BACKEND] 🚀 24/7 STANDALONE ENGINE STARTED (Independent of Browser)`);
    console.log(
      `[LiveDerivDaemon] Boot -> Credentials: ${creds.ok ? 'ENV CONFIGURED' : 'MISSING ENV VARS'} | AutoTrade: ${opts.derivAutoTradeEnabled !== false ? 'ON' : 'OFF'} | Mode: ${(opts.derivMode || 'demo').toUpperCase()} | ADX: ${opts.useAdxFilter ? 'ON' : 'OFF'}`
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
        `[LiveDerivDaemon Heartbeat] 🟢 WS:${this.wsConnected ? 'OPEN' : 'DOWN'} | ${this.currentSymbol} (${this.currentTimeframe}/${this.currentHistorySpan}) | Candles:${this.candles.length} | Ticks:${this.totalTicksReceived} | LastPrice:${this.lastTickPrice ?? '---'} | Creds:${curCreds.ok ? 'OK' : 'MISSING'} | AutoTrade:${curOpts.derivAutoTradeEnabled !== false ? 'ON' : 'PAUSED'} (${(curOpts.derivMode || 'demo').toUpperCase()})`
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
              `[LiveDerivDaemon] Config Synced -> AutoTrade: ${opts.derivAutoTradeEnabled !== false ? 'ON' : 'OFF'} | Mode: ${(opts.derivMode || 'demo').toUpperCase()} | TF: ${newTf} | Span: ${newHistorySpan} | ADX: ${opts.useAdxFilter ? 'ON' : 'OFF'} | SL: ${opts.pointsSl} | TP1: ${opts.pointsTp1}`
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
    return {
      symbol: this.currentSymbol,
      timeframe: this.currentTimeframe,
      historySpan: this.currentHistorySpan,
      wsConnected: this.wsConnected && Boolean(this.ws && this.ws.readyState === WebSocket.OPEN),
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
          connected: this.wsConnected,
          connectAttempts: this.connectAttempts,
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
          credentialsConfigured: creds.ok,
          attempted: this.attemptedExecutions,
          executed: this.successfulExecutions,
          failed: this.failedExecutions,
          skipped: this.skippedSignalsCount,
          lastExecutionAt: this.lastExecutionAt,
        },
      },
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

  private connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;
    this.connectAttempts += 1;

    try {
      if (this.ws) {
        try { this.ws.terminate(); } catch {}
        this.ws = null;
      }

      // Public market data WebSocket (does NOT use private trading token)
      const wsUrl = 'wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089';
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.isConnecting = false;
        this.wsConnected = true;
        this.lastConnectedAt = new Date().toISOString();
        console.log(`[LiveDerivDaemon][Stage 1: WS Connected] Subscribing to ${this.currentSymbol} ${this.currentTimeframe} (${this.currentHistorySpan}) live ticks...`);

        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          try {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ ping: 1 }));
            }
          } catch {}
        }, 25000);

        const candleCount = this.getCandleCountForSpan();
        this.ws?.send(JSON.stringify({
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

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const raw = typeof data === 'string' ? data : data.toString();
          const msg = JSON.parse(raw);

          if (msg.ping === 'pong') return;

          // Stage 2: Candle History Batch
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

          // Stage 3: Live Tick Reception
          if (msg.ohlc) {
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

      this.ws.on('error', (err) => {
        this.wsConnected = false;
        this.lastDisconnectedAt = new Date().toISOString();
        this.lastDisconnectReason = err.message;
        console.error('[LiveDerivDaemon][Stage 1: WS Error]', err.message);
        this.lastDisconnectedAtMs = Date.now();
        this.scheduleReconnect();
      });

      this.ws.on('close', (code) => {
        this.wsConnected = false;
        this.lastDisconnectedAt = new Date().toISOString();
        this.lastDisconnectReason = `closed(${code})`;
        console.warn(`[LiveDerivDaemon][Stage 1: WS Closed] code=${code}. Reconnecting in 2s...`);
        this.lastDisconnectedAtMs = Date.now();
        this.scheduleReconnect();
      });
    } catch (e: any) {
      this.wsConnected = false;
      this.lastDisconnectReason = e.message;
      console.error('[LiveDerivDaemon] Connection failed:', e.message);
      this.lastDisconnectedAtMs = Date.now();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.isConnecting = false;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 2000);
  }

  private reconnect() {
    this.candles = [];
    this.scheduleReconnect();
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
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Test hook allowing end-to-end verification of Stage 4 -> Stage 6 without touching real market ticks.
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

      // Stage 5: Signal Freshness & Eligibility Guards
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

      // Check Auto-Trade toggle & backend environment credentials BEFORE acquiring execution lock
      const isAutoTradeEnabled = options.derivAutoTradeEnabled !== false;
      const mode = (options.derivMode === 'real' ? 'real' : 'demo') as 'demo' | 'real';

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

      // Acquire in-flight mutex + atomic lock BEFORE sending buy order (never mark handled yet!)
      this.inFlightSignals.add(uniqueSignalId);
      if (!tryAcquireDaemonLock(uniqueSignalId)) {
        this.inFlightSignals.delete(uniqueSignalId);
        this.logSkipOnce(
          uniqueSignalId,
          'SKIPPED_LOCK',
          'Execution lock already held by another worker',
          { symbol, tf, action, entryPrice, slPrice, tpPrice, slippagePips: pipsMovedPastEntry }
        );
        this.handledSignals.add(uniqueSignalId);
        this.lastEvaluatedSignal.outcome = 'SKIPPED_LOCK';
        return;
      }

      console.log(
        `[LiveDerivDaemon][Stage 5 -> Stage 6] ⚡ GENUINE LIVE BREAKOUT DETECTED: ${uniqueSignalId} | ${action} @ ${activeCandle.close} (slippage: ${pipsMovedPastEntry.toFixed(1)} pips <= 20)`
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

        // Safe retry loop: ONLY retries pre-buy transient errors (retryable=true, uncertain=false)
        for (let attempt = 1; attempt <= 1 + this.maxRetries; attempt++) {
          attempts = attempt;
          if (attempt > 1) {
            // Re-verify freshness & slippage guards before retrying
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

          const tradeRes = await this.tradeExecutor({
            mode,
            action,
            symbol,
            stake: Number(options.derivStake || 2.0),
            multiplier: Number(options.derivMultiplier || 200),
            takeProfitUsd: Number(options.derivTakeProfitUsd || 6.68),
            stopLossUsd: Number(options.derivStopLossUsd || 2.0),
            maxConsecutiveLosses: Number(options.derivMaxConsecutiveLosses || 3),
          });

          if (tradeRes.ok && tradeRes.contractId) {
            execStatus = tradeRes.reconciled ? 'RECONCILED_EXECUTED' : 'EXECUTED';
            execContractId = tradeRes.contractId;
            execReconciled = Boolean(tradeRes.reconciled);
            execError = undefined;
            this.successfulExecutions += 1;
            this.handledSignals.add(uniqueSignalId);
            updateDaemonLock(uniqueSignalId, { status: execStatus, contractId: execContractId });

            tradeExecutionReport =
              `\n\n⚡ <b>DERIV ${mode.toUpperCase()} ORDER PLACED!</b>\n` +
              `🆔 Contract: #${tradeRes.contractId}\n` +
              `💵 Stake: $${(tradeRes.stake ?? Number(options.derivStake || 2)).toFixed(2)} USD (${tradeRes.multiplier ?? 200}x)\n` +
              `🎯 TP: +$${(tradeRes.takeProfit ?? 6.68).toFixed(2)} | 🛑 SL: -$${(tradeRes.stopLoss ?? 2.0).toFixed(2)}\n` +
              (tradeRes.balanceAfter !== undefined ? `💰 Balance After: $${tradeRes.balanceAfter.toFixed(2)} USD\n` : '');
            console.log(`[LiveDerivDaemon][Stage 6: Deriv Confirmed] ✅ Contract #${tradeRes.contractId} (${mode.toUpperCase()})`);
            break;
          }

          execError = tradeRes.error || 'Unknown Deriv execution error';

          // Uncertain timeout after buy dispatch: NEVER retry, lock immediately!
          if (tradeRes.uncertain) {
            execStatus = 'UNCERTAIN_LOCKED';
            this.failedExecutions += 1;
            this.handledSignals.add(uniqueSignalId);
            updateDaemonLock(uniqueSignalId, { status: 'UNCERTAIN_LOCKED', error: execError });
            console.error(`[LiveDerivDaemon][Stage 6: UNCERTAIN] 🛑 ${uniqueSignalId}: ${execError}`);
            break;
          }

          // Missing credentials: fail immediately without retrying, release lock only? No, mark handled so tick doesn't spam
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
            updateDaemonLock(uniqueSignalId, { status: 'DERIV_ERROR', attempts, error: execError });
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
        signalId: uniqueSignalId,
        symbol,
        timeframe: tf,
        action,
        entryPrice,
        slPrice,
        tpPrice,
        slippagePips: Number(pipsMovedPastEntry.toFixed(2)),
        status: execStatus,
        reason: execStatus === 'EXECUTED' ? 'Live breakout confirmed and executed on Deriv' : execError,
        retryAttempts: attempts,
        contractId: execContractId,
        reconciled: execReconciled || undefined,
        mode,
        error: execError,
        timestamp: new Date().toISOString(),
      };
      this.recordSignalLog(logRecord, true);

      // Telegram Dispatch (always after execution decision)
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
          `⚖️ Mode: <b>${mode.toUpperCase()}</b>` +
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
