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

class LiveDerivDaemon {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private candles: Candle[] = [];
  private currentSymbol = 'R_75';
  private currentTimeframe = '1H';
  private granularity = 3600;
  private lastAlertId: string | null = null;
  private alertedIds = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private configWatchTimer: NodeJS.Timeout | null = null;
  private lastConfigMtime = 0;
  private daemonStartTimeSec = Math.floor(Date.now() / 1000);
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;

  public start() {
    this.daemonStartTimeSec = Math.floor(Date.now() / 1000);
    console.log(`======================================================================`);
    console.log(`[RENDER BACKEND] 🚀 24/7 STANDALONE ENGINE STARTED (No Browser Needed!)`);
    console.log(`[LiveDerivDaemon] Real-Time Tick Engine on Render (boot: ${new Date().toISOString()})...`);
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
      console.log(`[LiveDerivDaemon Heartbeat] 🟢 24/7 Backend Alive: ${this.currentSymbol} (${this.currentTimeframe}) | Live Price: ${priceStr} | Candles: ${this.candles.length} | Standalone Auto-Trade: READY`);
    }, 60000);
  }

  private getMergedOptions(): Record<string, any> {
    const config = loadAlertConfig();
    const options = config.options || {};
    return {
      targetMode: 'points',
      pointsSl: Number(options.pointsSl || 220),
      pointsTp1: Number(options.pointsTp1 || 450),
      pointsTp2: Number(options.pointsTp2 || 650),
      pointsTp3: Number(options.pointsTp3 || 1000),
      showTp1: options.showTp1 !== false,
      showTp2: Boolean(options.showTp2),
      showTp3: Boolean(options.showTp3),
      showSl: options.showSl !== false,
      targetFocus: options.targetFocus || 'TP1',
      swingLen: Number(options.swingLen || 3),
      filterSwingLen: Number(options.filterSwingLen || 3),
      useStructureFilter: options.useStructureFilter ?? true,
      structureTf: options.structureTf || '15',
      useWickFilter: options.useWickFilter ?? true,
      maxWickRatio: options.maxWickRatio ?? 0.70,
      useDisplacementFilter: options.useDisplacementFilter ?? true,
      minDisplacementAtr: options.minDisplacementAtr ?? 0.80,
      useBodyCloseFilter: options.useBodyCloseFilter ?? true,
      minBodyRatio: options.minBodyRatio ?? 0.50,
      useSweepFilter: options.useSweepFilter ?? false,
      sweepLookback: options.sweepLookback ?? 10,
      preventLateEntry: options.preventLateEntry ?? true,
      maxBreakoutDelay: options.maxBreakoutDelay ?? 1,
      usePremiumDiscountFilter: Boolean(options.usePremiumDiscountFilter),
      useInducementFilter: Boolean(options.useInducementFilter),
      useKillZonesFilter: Boolean(options.useKillZonesFilter),
      useTurtleSoupFilter: Boolean(options.useTurtleSoupFilter),
      useRetestConfirmation: Boolean(options.useRetestConfirmation),
      useAntiWhipsawFilter: Boolean(options.useAntiWhipsawFilter),
      ...options,
    };
  }

  private syncConfig(force: boolean) {
    try {
      const configPath = path.join(process.cwd(), '.cloud_alert_config.json');
      if (fs.existsSync(configPath)) {
        const stat = fs.statSync(configPath);
        if (force || stat.mtimeMs > this.lastConfigMtime) {
          this.lastConfigMtime = stat.mtimeMs;
          const config = loadAlertConfig();
          const newSymbol = config.symbol || 'R_75';
          const newTf = config.timeframe || '1H';

          if (newSymbol !== this.currentSymbol || newTf !== this.currentTimeframe) {
            console.log(`[LiveDerivDaemon] Symbol/TF changed: ${this.currentSymbol}/${this.currentTimeframe} -> ${newSymbol}/${newTf}`);
            this.currentSymbol = newSymbol;
            this.currentTimeframe = newTf;
            this.granularity = TIMEFRAME_SECONDS[newTf] || 3600;
            this.reconnect();
          }
        }
      }
    } catch (e) {
      // ignore config read error
    }
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
        console.log(`[LiveDerivDaemon] WebSocket connected. Subscribing to ${this.currentSymbol} ${this.currentTimeframe} live ticks...`);

        // Active 25-second ping keep-alive so Deriv never drops connection due to idle
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          try {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ ping: 1 }));
            }
          } catch {}
        }, 25000);

        const spanDays = 7; // 1W default
        const candleCount = Math.min(1000, Math.max(120, Math.ceil((spanDays * 86400) / this.granularity)));

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

          // 1. Initial Candles Batch (HISTORICAL - NEVER TRADE ON INITIAL BATCH)
          if (msg.candles && Array.isArray(msg.candles)) {
            this.candles = msg.candles.map((c: any) => ({
              time: Number(c.epoch),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            }));

            // SEED OLD historical markers into alertedIds so they are never executed.
            // A signal is ONLY fresh if on the active forming candle OR closed within 2-10 seconds!
            try {
              const options = this.getMergedOptions();
              const result = calculateMarketStructureTargetTracker(this.candles, options as any, this.currentSymbol);
              const markers = result.signalMarkers || [];
              const lastCandleIdx = this.candles.length - 1;
              const nowSec = Math.floor(Date.now() / 1000);
              for (const m of markers) {
                const candleCloseSec = m.time + this.granularity;
                const isJustClosed = m.barIndex === lastCandleIdx - 1 && (nowSec - candleCloseSec <= 10);
                const isCurrentBarJustOpened = m.barIndex === lastCandleIdx && (nowSec - m.time <= 10);
                const isFresh = isJustClosed || isCurrentBarJustOpened;
                if (!isFresh) {
                  const id = `SIG_${this.currentSymbol}_${this.currentTimeframe}_${m.time}_${m.type}`;
                  this.alertedIds.add(id);
                  this.lastAlertId = id;
                }
              }
              console.log(`[LiveDerivDaemon] Initial history loaded (${this.candles.length} candles). Seeded ${this.alertedIds.size} old historical signals. Daemon is listening for LIVE breakout ticks.`);
            } catch (err: any) {
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
                if (this.candles.length > 500) {
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
        this.scheduleReconnect();
      });

      this.ws.on('close', () => {
        console.warn('[LiveDerivDaemon] WebSocket closed. Reconnecting...');
        this.scheduleReconnect();
      });
    } catch (e: any) {
      console.error('[LiveDerivDaemon] Connection failed:', e.message);
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

      // CRITICAL GUARD 1: Only trade if signal is on the ACTIVE forming candle OR closed within 2-10 seconds
      if (recentMarker.barIndex < lastCandleIdx - 1) {
        return;
      }
      if (recentMarker.barIndex === lastCandleIdx - 1) {
        const candleCloseSec = recentMarker.time + this.granularity;
        const secondsSinceClose = nowSec - candleCloseSec;
        if (secondsSinceClose > 10) {
          console.log(`[LiveDerivDaemon] Signal skipped: candle closed ${secondsSinceClose}s ago (> 10s fresh limit).`);
          return;
        }
      }

      // CRITICAL GUARD 2: In-Memory Lock - Ensure signal is not traded twice
      const uniqueSignalId = `SIG_${symbol}_${tf}_${recentMarker.time}_${recentMarker.type}`;
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
        console.log(`[LiveDerivDaemon] ${uniqueSignalId} SKIPPED: Price moved ${pipsMovedPastEntry.toFixed(1)} pips past entry (> 20 pips limit). Chasing prevented.`);
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
          console.log(`[LiveDerivDaemon] ${uniqueSignalId} skipped: Price ${activeCandle.close} already past TP (${tpPrice}) or SL (${slPrice})`);
          this.alertedIds.add(uniqueSignalId);
          return;
        }
      } else {
        if (activeCandle.close <= tpPrice || activeCandle.close >= slPrice) {
          console.log(`[LiveDerivDaemon] ${uniqueSignalId} skipped: Price ${activeCandle.close} already past TP (${tpPrice}) or SL (${slPrice})`);
          this.alertedIds.add(uniqueSignalId);
          return;
        }
      }

      // Claim lock IMMEDIATELY in-memory (<0.005ms) before sending order
      this.lastAlertId = uniqueSignalId;
      this.alertedIds.add(uniqueSignalId);
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
            maxConsecutiveLosses: Number(options.derivMaxConsecutiveLosses || 2),
          });

          if (tradeRes.ok) {
            tradeExecutionReport =
              `\n\n⚡ <b>DERIV ${mode.toUpperCase()} ORDER PLACED!</b>\n` +
              `🆔 Contract: #${tradeRes.contractId}\n` +
              `💵 Stake: $${(tradeRes.stake ?? Number(options.derivStake || 2)).toFixed(2)} USD (${tradeRes.multiplier ?? 200}x)\n` +
              `🎯 TP: +$${(tradeRes.takeProfit ?? 6.68).toFixed(2)} | 🛑 SL: -$${(tradeRes.stopLoss ?? 2.0).toFixed(2)}\n` +
              (tradeRes.balanceAfter !== undefined ? `💰 Balance After: $${tradeRes.balanceAfter.toFixed(2)} USD\n` : '');
            console.log(`[LiveDerivDaemon] ✅ Deriv order placed successfully! Contract #${tradeRes.contractId}`);
          } else {
            tradeExecutionReport = `\n\n⚠️ <i>Deriv Execution Note: ${tradeRes.error}</i>`;
            console.warn(`[LiveDerivDaemon] ⚠️ Deriv trade result: ${tradeRes.error}`);
          }
        } catch (e: any) {
          tradeExecutionReport = `\n\n⚠️ <i>Deriv Trade Error: ${e.message}</i>`;
          console.error(`[LiveDerivDaemon] ❌ Deriv error:`, e.message);
        }
      }

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
