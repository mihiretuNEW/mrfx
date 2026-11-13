import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { calculateMarketStructureTargetTracker, Candle } from '../msttEngine.js';
import { executeDerivMultiplierTrade } from './derivTrader.js';
import { sendTelegramDirect, loadAlertConfig } from './cloudAlertConfig.js';

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

function tryAcquireDaemonLock(signalId: string): boolean {
  const safeId = signalId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const lockPath = path.join('/tmp', `lock_${safeId}.lock`);
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, JSON.stringify({ signalId, source: 'liveDerivDaemon', time: Date.now() }));
    fs.closeSync(fd);
    return true;
  } catch (err: any) {
    if (err.code === 'EEXIST') {
      return false;
    }
    return true;
  }
}

const SIGNAL_LOG_PRIMARY = path.join(process.cwd(), '.signal_executions.json');
const SIGNAL_LOG_FALLBACK = path.join('/tmp', 'mcharts_signal_executions.json');

export interface SignalExecutionLog {
  signalId: string;
  symbol: string;
  timeframe: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  slippagePips: number;
  status: 'EXECUTED' | 'PAUSED' | 'DERIV_ERROR' | 'SKIPPED_FRESHNESS' | 'SKIPPED_SLIPPAGE' | 'SKIPPED_BEYOND_TPSL' | 'SKIPPED_LOCK';
  contractId?: number;
  mode?: 'demo' | 'real';
  error?: string;
  timestamp: string;
}

function appendSignalExecutionAsync(record: SignalExecutionLog) {
  setImmediate(() => {
    try {
      let existing: SignalExecutionLog[] = [];
      const targetRead = fs.existsSync(SIGNAL_LOG_PRIMARY)
        ? SIGNAL_LOG_PRIMARY
        : (fs.existsSync(SIGNAL_LOG_FALLBACK) ? SIGNAL_LOG_FALLBACK : null);
      if (targetRead) {
        try {
          const parsed = JSON.parse(fs.readFileSync(targetRead, 'utf-8'));
          if (Array.isArray(parsed)) existing = parsed;
        } catch {}
      }
      const next = [record, ...existing.filter((r) => r.signalId !== record.signalId)].slice(0, 50);
      const serialized = JSON.stringify(next, null, 2);
      try { fs.writeFileSync(SIGNAL_LOG_PRIMARY, serialized, 'utf-8'); } catch {}
      try { fs.writeFileSync(SIGNAL_LOG_FALLBACK, serialized, 'utf-8'); } catch {}
    } catch {}
  });
}

class LiveDerivDaemon {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private candles: Candle[] = [];
  private currentSymbol = 'R_75';
  private currentTimeframe = '1H';
  private currentHistorySpan = 'all';
  private granularity = 3600;
  private lastAlertId: string | null = null;
  private alertedIds = new Set<string>();
  private skippedLoggedIds = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private configWatchTimer: NodeJS.Timeout | null = null;
  private lastConfigMtime = 0;
  private daemonStartTimeSec = Math.floor(Date.now() / 1000);
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private hasCompletedInitialLoad = false;
  private lastDisconnectedAtMs = 0;
  private recentSignals: SignalExecutionLog[] = [];

  public start() {
    this.daemonStartTimeSec = Math.floor(Date.now() / 1000);
    const opts = this.getMergedOptions();
    console.log(`======================================================================`);
    console.log(`[RENDER BACKEND] 🚀 24/7 STANDALONE ENGINE STARTED (No Browser Needed!)`);
    console.log(`[LiveDerivDaemon] Real-Time Tick Engine on Render (boot: ${new Date().toISOString()})...`);
    console.log(
      `[LiveDerivDaemon] Active Settings -> AutoTrade: ${opts.derivAutoTradeEnabled !== false ? 'ON' : 'OFF'} | Mode: ${(opts.derivMode || 'demo').toUpperCase()} | ADX Filter: ${opts.useAdxFilter ? 'ON' : 'OFF'} | SL: ${opts.pointsSl} | TP1: ${opts.pointsTp1}`
    );
    console.log(`======================================================================`);
    this.syncConfig(true);
    this.connect();

    // Check for config file changes every 3 seconds
    this.configWatchTimer = setInterval(() => {
      this.syncConfig(false);
    }, 3000);

    // Heartbeat every 60 seconds to prove the backend is alive in Render logs
    this.heartbeatTimer = setInterval(() => {
      const lastCandle = this.candles[this.candles.length - 1];
      const priceStr = lastCandle ? lastCandle.close.toFixed(2) : 'connecting...';
      const curOpts = this.getMergedOptions();
      console.log(
        `[LiveDerivDaemon Heartbeat] 🟢 Alive: ${this.currentSymbol} (${this.currentTimeframe}) | Price: ${priceStr} | Candles: ${this.candles.length} | AutoTrade: ${curOpts.derivAutoTradeEnabled !== false ? 'ON' : 'PAUSED'} (${(curOpts.derivMode || 'demo').toUpperCase()}) | ADX: ${curOpts.useAdxFilter ? 'ON' : 'OFF'}`
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
    } catch (e) {
      // ignore config read error
    }
  }

  public getStatus() {
    return {
      symbol: this.currentSymbol,
      timeframe: this.currentTimeframe,
      historySpan: this.currentHistorySpan,
      candlesLoaded: this.candles.length,
      wsConnected: Boolean(this.ws && this.ws.readyState === WebSocket.OPEN),
      recentSignals: this.recentSignals.slice(0, 15),
    };
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

    try {
      if (this.ws) {
        try { this.ws.terminate(); } catch (e) {}
        this.ws = null;
      }

      const wsUrl = 'wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089';
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.isConnecting = false;
        console.log(`[LiveDerivDaemon] WebSocket connected. Subscribing to ${this.currentSymbol} ${this.currentTimeframe} (${this.currentHistorySpan}) live ticks...`);

        // Active 25-second ping keep-alive so Deriv never drops connection due to idle
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

          // Handle keep-alive pong
          if (msg.ping === 'pong') return;

          // 1. Initial Candles Batch (HISTORICAL on boot, or FAST RECONNECT check)
          if (msg.candles && Array.isArray(msg.candles)) {
            this.candles = msg.candles.map((c: any) => ({
              time: Number(c.epoch),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            }));

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
                  if (!this.alertedIds.has(id)) newlySeeded++;
                  this.alertedIds.add(id);
                  this.lastAlertId = id;
                }
              }

              this.hasCompletedInitialLoad = true;
              console.log(
                `[LiveDerivDaemon] History loaded (${this.candles.length} candles, reconnect=${isFastReconnect ? `${disconnectDurationSec.toFixed(1)}s` : 'boot'}). Seeded ${this.alertedIds.size} historical signals (+${newlySeeded}). Listening for LIVE breakout ticks.`
              );

              // If we reconnected within 10s, immediately evaluate without waiting for next tick
              if (isFastReconnect) {
                this.evaluateLiveMarket('live_tick');
              }
            } catch (err: any) {
              this.hasCompletedInitialLoad = true;
              console.error('[LiveDerivDaemon] Error seeding historical signals:', err.message);
            }
            return;
          }

          // 2. Real-Time Tick Update (OHLC streaming)
          if (msg.ohlc) {
            const ohlc = msg.ohlc;
            const candleEpoch = Number(ohlc.open_time || ohlc.epoch);
            const open = Number(ohlc.open);
            const high = Number(ohlc.high);
            const low = Number(ohlc.low);
            const close = Number(ohlc.close);

            if (this.candles.length > 0) {
              const lastCandle = this.candles[this.candles.length - 1];
              if (lastCandle.time === candleEpoch) {
                // Update live active candle
                lastCandle.high = Math.max(lastCandle.high, high);
                lastCandle.low = Math.min(lastCandle.low, low);
                lastCandle.close = close;
              } else if (candleEpoch > lastCandle.time) {
                // New candle opened
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

            // Real-time evaluation on live incoming tick!
            this.evaluateLiveMarket('live_tick');
          }
        } catch (err) {
          // ignore parsing error
        }
      });

      this.ws.on('error', (err) => {
        console.error('[LiveDerivDaemon] WebSocket error:', err.message);
        this.lastDisconnectedAtMs = Date.now();
        this.scheduleReconnect();
      });

      this.ws.on('close', () => {
        console.warn('[LiveDerivDaemon] WebSocket closed. Reconnecting in 2s...');
        this.lastDisconnectedAtMs = Date.now();
        this.scheduleReconnect();
      });
    } catch (e: any) {
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

  private logSkipOnce(uniqueSignalId: string, message: string) {
    if (!this.skippedLoggedIds.has(uniqueSignalId)) {
      this.skippedLoggedIds.add(uniqueSignalId);
      console.log(message);
    }
  }

  private async evaluateLiveMarket(triggerSource: string) {
    // CRITICAL: NEVER evaluate or execute on anything other than live ticks
    if (triggerSource !== 'live_tick') return;
    if (this.candles.length < 30) return;

    try {
      const config = loadAlertConfig();
      const options = this.getMergedOptions();
      const tf = this.currentTimeframe;
      const symbol = this.currentSymbol;

      const result = calculateMarketStructureTargetTracker(this.candles, options as any, symbol);
      const markers = result.signalMarkers || [];
      if (markers.length === 0) return;

      const recentMarker = markers[markers.length - 1];
      const lastCandleIdx = this.candles.length - 1;
      const activeCandle = this.candles[lastCandleIdx];
      const nowSec = Math.floor(Date.now() / 1000);
      const uniqueSignalId = `SIG_${symbol}_${tf}_${recentMarker.time}_${recentMarker.type}`;

      // CRITICAL GUARD 1: Only trade if signal is on the ACTIVE forming candle OR closed within 1-10 seconds
      if (recentMarker.barIndex < lastCandleIdx - 1) {
        return;
      }
      if (recentMarker.barIndex === lastCandleIdx - 1) {
        const candleCloseSec = recentMarker.time + this.granularity;
        const secondsSinceClose = nowSec - candleCloseSec;
        if (secondsSinceClose > 10) {
          this.logSkipOnce(uniqueSignalId, `[LiveDerivDaemon] ${uniqueSignalId} skipped: candle closed ${secondsSinceClose}s ago (> 10s fresh limit).`);
          this.alertedIds.add(uniqueSignalId);
          return;
        }
      }

      // CRITICAL GUARD 2: Fast In-Memory Lock - Ensure signal is not traded twice
      if (this.lastAlertId === uniqueSignalId || this.alertedIds.has(uniqueSignalId)) {
        return;
      }

      const isBull = recentMarker.type === 'bull';
      const action: 'BUY' | 'SELL' = isBull ? 'BUY' : 'SELL';
      const entryPrice = recentMarker.entryPrice || recentMarker.price || activeCandle.close;

      // CRITICAL GUARD 3: 20 Pips Max Slippage Guard
      // If price moved > 20 pips past entry, SKIP to prevent shifted TP distance!
      const pipsMovedPastEntry = isBull
        ? (activeCandle.close - entryPrice)
        : (entryPrice - activeCandle.close);

      if (pipsMovedPastEntry > 20) {
        this.logSkipOnce(uniqueSignalId, `[LiveDerivDaemon] ${uniqueSignalId} SKIPPED: Price moved ${pipsMovedPastEntry.toFixed(1)} pips past entry (> 20 pips limit). Chasing prevented.`);
        this.alertedIds.add(uniqueSignalId);
        return;
      }

      const slPips = Number(options.pointsSl || 165);
      const tp1Pips = Number(options.pointsTp1 || 607);
      const slPrice = recentMarker.slPrice || (isBull ? entryPrice - slPips : entryPrice + slPips);
      const tpPrice = recentMarker.tp1Price || (isBull ? entryPrice + tp1Pips : entryPrice - tp1Pips);

      // CRITICAL GUARD 4: Do not enter if price already surpassed TP1 or hit SL
      if (isBull) {
        if (activeCandle.close >= tpPrice || activeCandle.close <= slPrice) {
          this.logSkipOnce(uniqueSignalId, `[LiveDerivDaemon] ${uniqueSignalId} skipped: Price ${activeCandle.close} already past TP (${tpPrice}) or SL (${slPrice})`);
          this.alertedIds.add(uniqueSignalId);
          return;
        }
      } else {
        if (activeCandle.close <= tpPrice || activeCandle.close >= slPrice) {
          this.logSkipOnce(uniqueSignalId, `[LiveDerivDaemon] ${uniqueSignalId} skipped: Price ${activeCandle.close} already past TP (${tpPrice}) or SL (${slPrice})`);
          this.alertedIds.add(uniqueSignalId);
          return;
        }
      }

      // Claim lock IMMEDIATELY in-memory (<0.005ms) + shared atomic disk lock before sending order
      this.lastAlertId = uniqueSignalId;
      this.alertedIds.add(uniqueSignalId);
      if (!tryAcquireDaemonLock(uniqueSignalId)) {
        this.logSkipOnce(uniqueSignalId, `[LiveDerivDaemon] ${uniqueSignalId} lock already held by another worker. Skipping duplicate.`);
        return;
      }

      console.log(`[LiveDerivDaemon] ⚡ GENUINE LIVE BREAKOUT DETECTED: ${uniqueSignalId} at price ${activeCandle.close} (slippage: ${pipsMovedPastEntry.toFixed(1)} pips <= 20) in <200ms!`);

      const symbolName = getSymbolDisplayName(symbol);

      // 1. Instant Deriv Trade Execution (<200ms)
      const isAutoTradeEnabled = options.derivAutoTradeEnabled !== false;
      const token = (
        options.derivApiToken ||
        process.env.DERIV_API_TOKEN ||
        'pat_3bd79e08a0c497fd3850ea056cd21b67f4c249278925d700c8d6ab45fc832a93'
      ).trim();
      const appId = (
        options.derivAppId ||
        process.env.DERIV_APP_ID ||
        '34TqYcyq1e1ZVYR74xqTh'
      ).trim();
      const mode = (options.derivMode === 'real' ? 'real' : 'demo') as 'demo' | 'real';

      let execStatus: SignalExecutionLog['status'] = isAutoTradeEnabled ? 'DERIV_ERROR' : 'PAUSED';
      let execContractId: number | undefined;
      let execError: string | undefined;

      if (!isAutoTradeEnabled) {
        console.warn(`[LiveDerivDaemon] ⚠️ Auto-Trade is currently PAUSED in config (derivAutoTradeEnabled: false). Skipping Deriv buy for ${uniqueSignalId}.`);
      }

      let tradeExecutionReport = '';
      if (isAutoTradeEnabled && token && appId) {
        try {
          console.log(`[LiveDerivDaemon] Executing instant ${mode.toUpperCase()} ${action} on Deriv (${symbol})...`);
          const tradeRes = await executeDerivMultiplierTrade({
            token,
            appId,
            mode,
            action,
            symbol,
            stake: Number(options.derivStake || 2.0),
            multiplier: Number(options.derivMultiplier || 200),
            takeProfitUsd: Number(options.derivTakeProfitUsd || 6.68),
            stopLossUsd: Number(options.derivStopLossUsd || 2.0),
            maxConsecutiveLosses: Number(options.derivMaxConsecutiveLosses || 3),
          });

          if (tradeRes.ok) {
            execStatus = 'EXECUTED';
            execContractId = tradeRes.contractId;
            tradeExecutionReport =
              `\n\n⚡ <b>DERIV ${mode.toUpperCase()} ORDER PLACED!</b>\n` +
              `🆔 Contract: #${tradeRes.contractId}\n` +
              `💵 Stake: $${(tradeRes.stake ?? Number(options.derivStake || 2)).toFixed(2)} USD (${tradeRes.multiplier ?? 200}x)\n` +
              `🎯 TP: +$${(tradeRes.takeProfit ?? 6.68).toFixed(2)} | 🛑 SL: -$${(tradeRes.stopLoss ?? 2.0).toFixed(2)}\n` +
              (tradeRes.balanceAfter !== undefined ? `💰 Balance After: $${tradeRes.balanceAfter.toFixed(2)} USD\n` : '');
            console.log(`[LiveDerivDaemon] ✅ Deriv order placed successfully! Contract #${tradeRes.contractId}`);
          } else {
            execStatus = 'DERIV_ERROR';
            execError = tradeRes.error;
            tradeExecutionReport = `\n\n⚠️ <i>Deriv Execution Note: ${tradeRes.error}</i>`;
            console.warn(`[LiveDerivDaemon] ⚠️ Deriv trade result: ${tradeRes.error}`);
          }
        } catch (e: any) {
          execStatus = 'DERIV_ERROR';
          execError = e.message;
          tradeExecutionReport = `\n\n⚠️ <i>Deriv Trade Error: ${e.message}</i>`;
          console.error(`[LiveDerivDaemon] ❌ Deriv error:`, e.message);
        }
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
        contractId: execContractId,
        mode,
        error: execError,
        timestamp: new Date().toISOString(),
      };
      this.recentSignals = [logRecord, ...this.recentSignals.filter((r) => r.signalId !== uniqueSignalId)].slice(0, 20);
      appendSignalExecutionAsync(logRecord);

      // 2. Telegram Alert Dispatch
      const botToken = config.botToken || '';
      const chatId = config.chatId || '';
      if (botToken && chatId) {
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
