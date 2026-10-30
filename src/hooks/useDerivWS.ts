/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Candle, SymbolInfo, TimeframeId, HistorySpanId } from '../types';

export function getHistorySpanDays(span: HistorySpanId = 'all'): number {
  switch (span) {
    case 'all': return 0;
    case '1W': return 7;
    case '2W': return 14;
    case '3W': return 21;
    case '1M': return 30;
    case '2M': return 60;
    case '3M': return 90;
    default: return 0;
  }
}

/**
 * Normalizes history span start boundary to 00:00 UTC of the anchor day.
 * Prevents candle counts from oscillating or edge swings from disappearing across browser refreshes.
 */
export function getDeterministicTargetStartTime(span: HistorySpanId = 'all'): number {
  const targetDays = getHistorySpanDays(span);
  if (targetDays <= 0) return 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const startOfDaySec = Math.floor(nowSec / 86400) * 86400;
  return startOfDaySec - (targetDays * 86400);
}

const SOCKET_URLS = [
  'wss://api.derivws.com/trading/v1/options/ws/public',
  'wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089',
  'wss://api.derivws.com/trading/v1/options/ws/public?app_id=36544',
  'wss://red.derivws.com/websockets/v3?app_id=1089',
  'wss://api.derivws.com/trading/v1/options/ws/public?app_id=37075'
];

// In-memory cache for fast tab/timeframe switching within the same live session only
const globalCandleCache: Record<string, Candle[]> = {};

// Clean up any stale past candle caches from localStorage/sessionStorage so charts never show stale historical state
if (typeof window !== 'undefined') {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('mcharts_cache_')) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith('mcharts_cache_')) sessionStorage.removeItem(k);
    });
  } catch (e) {}
}

export function getCachedCandles(symbol: string, timeframe: TimeframeId): Candle[] | undefined {
  if (!symbol || !timeframe) return undefined;
  const cacheKey = `${symbol.toUpperCase()}_${timeframe}`;
  return globalCandleCache[cacheKey];
}

export function saveCachedCandles(symbol: string, timeframe: TimeframeId, candlesToCache: Candle[]): void {
  if (!symbol || !timeframe || !Array.isArray(candlesToCache) || candlesToCache.length === 0) return;
  const cacheKey = `${symbol.toUpperCase()}_${timeframe}`;
  globalCandleCache[cacheKey] = candlesToCache;
}

export const TIMEFRAMES = [
  { id: '1M', label: '1m', seconds: 60 },
  { id: '2M', label: '2m', seconds: 120 },
  { id: '5M', label: '5m', seconds: 300 },
  { id: '15M', label: '15m', seconds: 900 },
  { id: '30M', label: '30m', seconds: 1800 },
  { id: '1H', label: '1h', seconds: 3600 },
  { id: '4H', label: '4h', seconds: 14400 },
  { id: '1D', label: '1d', seconds: 86400 },
] as const;

export const ALIAS_GROUPS: Record<string, string[]> = {
  CRASH150: ['CRASH150', 'CRASH150N', 'CRASH_150', '1HZ150C', 'CRASH1501', 'CRASH_150_INDEX'],
  CRASH150N: ['CRASH150N', 'CRASH150', 'CRASH_150', '1HZ150C', 'CRASH1501', 'CRASH_150_INDEX'],
  BOOM300: ['BOOM300', 'BOOM300N', 'BOOM_300', '1HZ300B', 'BOOM3001', 'BOOM_300_INDEX'],
  BOOM300N: ['BOOM300N', 'BOOM300', 'BOOM_300', '1HZ300B', 'BOOM3001', 'BOOM_300_INDEX'],
  BOOM900: ['BOOM900', 'BOOM900N', 'BOOM_900', 'BOOM9001', 'BOOM_900_INDEX'],
  BOOM900N: ['BOOM900N', 'BOOM900', 'BOOM_900', 'BOOM9001', 'BOOM_900_INDEX'],
  BOOM1000: ['BOOM1000', 'BOOM1000N', 'BOOM_1000'],
  BOOM1000N: ['BOOM1000N', 'BOOM1000', 'BOOM_1000'],
  CRASH1000: ['CRASH1000', 'CRASH1000N', 'CRASH_1000'],
  CRASH1000N: ['CRASH1000N', 'CRASH1000', 'CRASH_1000'],
  BOOM500: ['BOOM500', 'BOOM500N', 'BOOM_500'],
  BOOM500N: ['BOOM500N', 'BOOM500', 'BOOM_500'],
  CRASH500: ['CRASH500', 'CRASH500N', 'CRASH_500'],
  CRASH500N: ['CRASH500N', 'CRASH500', 'CRASH_500'],
  CRASH300: ['CRASH300', 'CRASH300N', 'CRASH_300'],
  CRASH300N: ['CRASH300N', 'CRASH300', 'CRASH_300'],

  // Forex Majors Aliases (Deriv frx... code)
  AUDUSD: ['frxAUDUSD', 'AUDUSD'],
  FRXAUDUSD: ['frxAUDUSD', 'AUDUSD'],
  EURCAD: ['frxEURCAD', 'EURCAD'],
  FRXEURCAD: ['frxEURCAD', 'EURCAD'],
  EURCHF: ['frxEURCHF', 'EURCHF'],
  FRXEURCHF: ['frxEURCHF', 'EURCHF'],
  EURGBP: ['frxEURGBP', 'EURGBP'],
  FRXEURGBP: ['frxEURGBP', 'EURGBP'],
  EURJPY: ['frxEURJPY', 'EURJPY'],
  FRXEURJPY: ['frxEURJPY', 'EURJPY'],
  EURUSD: ['frxEURUSD', 'EURUSD'],
  FRXEURUSD: ['frxEURUSD', 'EURUSD'],
  GBPCAD: ['frxGBPCAD', 'GBPCAD'],
  FRXGBPCAD: ['frxGBPCAD', 'GBPCAD'],
  GBPCHF: ['frxGBPCHF', 'GBPCHF'],
  FRXGBPCHF: ['frxGBPCHF', 'GBPCHF'],
  GBPJPY: ['frxGBPJPY', 'GBPJPY'],
  FRXGBPJPY: ['frxGBPJPY', 'GBPJPY'],
  GBPUSD: ['frxGBPUSD', 'GBPUSD'],
  FRXGBPUSD: ['frxGBPUSD', 'GBPUSD'],
  NZDUSD: ['frxNZDUSD', 'NZDUSD'],
  FRXNZDUSD: ['frxNZDUSD', 'NZDUSD'],
  USDCAD: ['frxUSDCAD', 'USDCAD'],
  FRXUSDCAD: ['frxUSDCAD', 'USDCAD'],
  USDCHF: ['frxUSDCHF', 'USDCHF'],
  FRXUSDCHF: ['frxUSDCHF', 'USDCHF'],
  USDJPY: ['frxUSDJPY', 'USDJPY'],
  FRXUSDJPY: ['frxUSDJPY', 'USDJPY'],

  // Forex Minors Aliases (Selected: EURAUD, GBPAUD, GBPNZD, EURNZD)
  EURAUD: ['frxEURAUD', 'EURAUD'],
  FRXEURAUD: ['frxEURAUD', 'EURAUD'],
  EURNZD: ['frxEURNZD', 'EURNZD'],
  FRXEURNZD: ['frxEURNZD', 'EURNZD'],
  GBPAUD: ['frxGBPAUD', 'GBPAUD'],
  FRXGBPAUD: ['frxGBPAUD', 'GBPAUD'],
  GBPNZD: ['frxGBPNZD', 'GBPNZD'],
  FRXGBPNZD: ['frxGBPNZD', 'GBPNZD'],

  // Metals & Gold
  XAUUSD: ['frxXAUUSD', 'XAUUSD', 'GOLD'],
  FRXXAUUSD: ['frxXAUUSD', 'XAUUSD', 'GOLD'],
  GOLD: ['frxXAUUSD', 'XAUUSD', 'GOLD'],
  XAGUSD: ['frxXAGUSD', 'XAGUSD', 'SILVER'],
  FRXXAGUSD: ['frxXAGUSD', 'XAGUSD', 'SILVER'],
  XPDUSD: ['frxXPDUSD', 'XPDUSD'],
  FRXXPDUSD: ['frxXPDUSD', 'XPDUSD'],
  XPTUSD: ['frxXPTUSD', 'XPTUSD'],
  FRXXPTUSD: ['frxXPTUSD', 'XPTUSD'],

  // Crypto
  BTCUSD: ['cryBTCUSD', 'BTCUSD'],
  CRYBTCUSD: ['cryBTCUSD', 'BTCUSD'],
  ETHUSD: ['cryETHUSD', 'ETHUSD'],
  CRYETHUSD: ['cryETHUSD', 'ETHUSD'],
  LTCUSD: ['cryLTCUSD', 'LTCUSD'],
  CRYLTCUSD: ['cryLTCUSD', 'LTCUSD'],
  XRPUSD: ['cryXRPUSD', 'XRPUSD'],
  CRYXRPUSD: ['cryXRPUSD', 'XRPUSD'],
  BCHUSD: ['cryBCHUSD', 'BCHUSD'],
  CRYBCHUSD: ['cryBCHUSD', 'BCHUSD'],
};

export function getCategoryPriority(sym: SymbolInfo): number {
  const code = (sym.symbol || '').toUpperCase();
  const name = (sym.display_name || '').toUpperCase();
  const market = (sym.market || '').toLowerCase();
  const submarket = (sym.submarket_display_name || '').toUpperCase();

  // 1. Jump Indices
  if (code.startsWith('JD') || name.includes('JUMP') || submarket.includes('JUMP')) return 1;
  // 2. Volatility Indices
  if (code.startsWith('R_') || code.startsWith('1HZ') || name.includes('VOLATILITY') || submarket.includes('VOLATILITY')) return 2;
  // 3. Step Indices
  if (code.startsWith('STP') || name.includes('STEP') || submarket.includes('STEP')) return 3;
  // 4. Crash & Boom Indices
  if (code.includes('CRASH') || code.includes('BOOM') || name.includes('CRASH') || name.includes('BOOM') || submarket.includes('CRASH') || submarket.includes('BOOM')) return 4;
  
  // 7. Metals / Commodities (Check before general Forex so Gold/Silver don't get lumped into Majors)
  if (code.includes('XAU') || code.includes('XAG') || code.includes('XPD') || code.includes('XPT') || name.includes('GOLD') || name.includes('SILVER') || submarket.includes('METALS') || market === 'commodities') return 7;

  // 8. Crypto Pairs
  if (market === 'cryptocurrency' || code.startsWith('CRY') || code.includes('BTC') || code.includes('ETH') || code.includes('XRP') || code.includes('LTC') || code.includes('BCH')) return 8;

  // 5. Forex Majors
  const majorCodes = ['AUDUSD', 'EURCAD', 'EURCHF', 'EURGBP', 'EURJPY', 'EURUSD', 'GBPCAD', 'GBPCHF', 'GBPJPY', 'GBPUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDJPY'];
  if (submarket === 'FOREX MAJORS' || submarket === 'MAJOR_PAIRS' || submarket.includes('MAJOR') || majorCodes.some(c => code === c || code === `FRX${c}`)) return 5;
  
  // 6. Forex Minors (Strictly EURAUD, GBPAUD, GBPNZD, EURNZD)
  const minorCodes = ['EURAUD', 'GBPAUD', 'GBPNZD', 'EURNZD'];
  if (submarket === 'FOREX MINORS' || submarket === 'MINOR_PAIRS' || minorCodes.some(c => code === c || code === `FRX${c}`)) return 6;

  // General Forex fallback
  if (market === 'forex' || code.startsWith('FRX')) return 5;

  return 9;
}

export const STATIC_SYMBOLS: SymbolInfo[] = [
  { symbol: 'R_75', display_name: 'Volatility 75 Index', market: 'synthetic_index', market_display_name: 'Derived Indices', submarket_display_name: 'Volatility Indices' },
];

export const BASE_PRICES: Record<string, number> = {
  EURUSD: 1.0850,
  GBPUSD: 1.2950,
  AUDUSD: 0.6550,
  NZDUSD: 0.5920,
  USDCAD: 1.3650,
  USDCHF: 0.8850,
  USDJPY: 154.20,
  EURJPY: 167.30,
  GBPJPY: 199.70,
  EURGBP: 0.8380,
  EURCHF: 0.9600,
  EURCAD: 1.4810,
  GBPCAD: 1.7680,
  GBPCHF: 1.1460,
  EURAUD: 1.6560,
  EURNZD: 1.8320,
  GBPAUD: 1.9770,
  GBPNZD: 2.1870,
  XAUUSD: 2680.50,
  GOLD: 2680.50,
  XAGUSD: 31.40,
  BTCUSD: 96500.0,
  ETHUSD: 2750.0,
  LTCUSD: 110.0,
  XRPUSD: 2.45,
  BCHUSD: 440.0,
  JD10: 1200,
  JD25: 2500,
  JD50: 5000,
  JD75: 7500,
  JD100: 10000,
  R_10: 6800,
  R_25: 2100,
  R_50: 340,
  R_75: 850,
  R_100: 1250,
  '1HZ10V': 9500,
  '1HZ25V': 2400,
  '1HZ50V': 450,
  '1HZ75V': 1100,
  '1HZ100V': 1450,
  '1HZ150V': 1850,
  '1HZ200V': 2250,
  '1HZ250V': 2650,
  '1HZ300V': 3050,
  STPRNG: 8200,
  STPRNG2: 12400,
  STPRNG3: 16800,
  STPRNG4: 21000,
  STPRNG5: 25500,
  'STPRNG_0.1': 5400,
  'STPRNG_0.2': 7200,
  'STPRNG_0.5': 9800,
  CRASH150: 980,
  CRASH300: 1450,
  CRASH500: 2700,
  CRASH1000: 4200,
  BOOM300: 2400,
  BOOM500: 4800,
  BOOM900: 6500,
  BOOM1000: 8900
};

export function generateRealisticCandles(rawSymbol: string, timeframe: TimeframeId, count = 350): Candle[] {
  const clean = rawSymbol.toUpperCase().replace(/^(FRX|CRY)/, '');
  const base = BASE_PRICES[clean] || BASE_PRICES[rawSymbol.toUpperCase()] || 100.0;
  const granularity = TIMEFRAMES.find(t => t.id === timeframe)?.seconds || 60;
  const volatility = base * (base > 1000 ? 0.0018 : base < 10 ? 0.0006 : 0.0012);

  const now = Math.floor(Date.now() / 1000);
  const startTime = now - (count * granularity);
  const result: Candle[] = [];

  let currentPrice = base;
  for (let i = 0; i < count; i++) {
    const epoch = startTime + (i * granularity);
    // Pseudo-random random walk with mean reversion
    const drift = (base - currentPrice) * 0.015;
    const change = (Math.sin(i * 0.15) * 0.4 + (Math.random() - 0.48)) * volatility + drift;
    const open = currentPrice;
    const close = +(open + change).toFixed(base < 10 ? 5 : base < 1000 ? 3 : 2);
    const high = +(Math.max(open, close) + Math.random() * volatility * 0.8).toFixed(base < 10 ? 5 : base < 1000 ? 3 : 2);
    const low = +(Math.min(open, close) - Math.random() * volatility * 0.8).toFixed(base < 10 ? 5 : base < 1000 ? 3 : 2);

    result.push({
      time: epoch,
      open,
      high,
      low,
      close
    });

    currentPrice = close;
  }

  return result;
}

export function useDerivWS(
  selectedSymbol: string, 
  selectedTimeframe: TimeframeId,
  connectionSettings?: { customServer: string; customAppId: string },
  historySpan: HistorySpanId = '1M'
) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbols, setSymbols] = useState<SymbolInfo[]>(STATIC_SYMBOLS);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarketClosed, setIsMarketClosed] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);
  const selectedSymbolRef = useRef(selectedSymbol);
  const selectedTimeframeRef = useRef(selectedTimeframe);
  const historySpanRef = useRef<HistorySpanId>(historySpan);
  const urlIndexRef = useRef(0);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribeWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const symbolsRef = useRef<SymbolInfo[]>(STATIC_SYMBOLS);

  const liveFetchedSymbolsRef = useRef<SymbolInfo[]>([]);
  const currentSubscribedSymbolRef = useRef<string>('');
  const attemptedAliasIndexRef = useRef<Record<string, number>>({});

  const isConnectedRef = useRef(false);
  const candlesRef = useRef<Candle[]>([]);
  const isLoadingMoreRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);

  // Sync candles and isConnected to refs
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Reset pagination state when symbol or timeframe changes
  useEffect(() => {
    hasMoreHistoryRef.current = true;
    setHasMoreHistory(true);
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
  }, [selectedSymbol, selectedTimeframe]);

  // Compute active URLs based on current custom connection settings
  const getActiveUrls = useCallback(() => {
    const urls = [...SOCKET_URLS];
    if (connectionSettings?.customServer && connectionSettings?.customAppId) {
      const server = connectionSettings.customServer.trim().replace(/^wss?:\/\//, '');
      const appId = connectionSettings.customAppId.trim();
      if (server && appId) {
        // Prepend custom socket URL to the top so it is attempted first!
        urls.unshift(`wss://${server}/websockets/v3?app_id=${appId}`);
      }
    }
    return urls;
  }, [connectionSettings]);

  // Sync symbols state to ref to keep callback memoizations stable
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  // Update refs to prevent closure issues in async callbacks
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
    selectedTimeframeRef.current = selectedTimeframe;
  }, [selectedSymbol, selectedTimeframe]);

  const subscribe = useCallback((symbol: string, timeframe: TimeframeId) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Determine subscribable symbol mapping using live active_symbols list
    const getSubscribableSymbol = (rawSymbol: string) => {
      if (!rawSymbol) return '1HZ100V';
      const symbolUpper = rawSymbol.toUpperCase();

      // 1. Check live fetched symbols from Deriv active_symbols API first
      const liveList = liveFetchedSymbolsRef.current;
      if (liveList.length > 0) {
        const liveExact = liveList.find(s => s.symbol.toUpperCase() === symbolUpper);
        if (liveExact) return liveExact.symbol;

        const aliases = ALIAS_GROUPS[symbolUpper];
        if (aliases) {
          const liveAlias = liveList.find(s => aliases.includes(s.symbol.toUpperCase()));
          if (liveAlias) return liveAlias.symbol;
        }

        const liveNameMatch = liveList.find(s => {
          const dispUpper = (s.display_name || '').toUpperCase();
          const codeUpper = (s.symbol || '').toUpperCase();
          if (symbolUpper === 'CRASH150' || symbolUpper === 'CRASH150N') return dispUpper.includes('CRASH 150') || codeUpper.includes('CRASH150') || codeUpper.includes('150C');
          if (symbolUpper === 'BOOM300' || symbolUpper === 'BOOM300N') return dispUpper.includes('BOOM 300') || codeUpper.includes('BOOM300') || codeUpper.includes('300B');
          if (symbolUpper === 'BOOM900' || symbolUpper === 'BOOM900N') return dispUpper.includes('BOOM 900') || codeUpper.includes('BOOM900') || codeUpper.includes('900B');
          if (symbolUpper === 'BOOM1000' || symbolUpper === 'BOOM1000N') return dispUpper.includes('BOOM 1000') || codeUpper.includes('BOOM1000');
          if (symbolUpper === 'CRASH1000' || symbolUpper === 'CRASH1000N') return dispUpper.includes('CRASH 1000') || codeUpper.includes('CRASH1000');
          if (symbolUpper === 'BOOM500' || symbolUpper === 'BOOM500N') return dispUpper.includes('BOOM 500') || codeUpper.includes('BOOM500');
          return dispUpper.includes(symbolUpper) || symbolUpper.includes(dispUpper) || codeUpper.includes(symbolUpper);
        });
        if (liveNameMatch) return liveNameMatch.symbol;
      }

      // 2. Direct exact symbol code match in full catalog
      const exactMatch = symbolsRef.current.find(s => s.symbol.toUpperCase() === symbolUpper);
      if (exactMatch) return exactMatch.symbol;

      // 3. Display Name or symbol substring match in active symbols catalog
      const nameMatch = symbolsRef.current.find(s => {
        const dispUpper = (s.display_name || '').toUpperCase();
        const codeUpper = (s.symbol || '').toUpperCase();
        return dispUpper.includes(symbolUpper) || symbolUpper.includes(dispUpper) || codeUpper.includes(symbolUpper);
      });
      if (nameMatch) return nameMatch.symbol;

      // 4. Known aliases fallback
      const aliases = ALIAS_GROUPS[symbolUpper];
      if (aliases && aliases.length > 0) return aliases[0];

      // 5. Fallback prefix checks for Crypto (BTCUSD -> cryBTCUSD / BTCUSD), Gold, and Forex
      if (symbolUpper === 'BTCUSD' || symbolUpper === 'ETHUSD' || symbolUpper === 'LTCUSD') {
        const cryptoMatch = symbolsRef.current.find(s => s.symbol.toUpperCase() === `CRY${symbolUpper}` || s.symbol.toUpperCase() === symbolUpper);
        if (cryptoMatch) return cryptoMatch.symbol;
      }

      if (symbolUpper === 'XAUUSD' || symbolUpper === 'GOLD') {
        const goldMatch = symbolsRef.current.find(s => s.symbol.toUpperCase() === 'FRXXAUUSD' || s.symbol.toUpperCase() === 'XAUUSD' || s.display_name.toUpperCase().includes('GOLD'));
        if (goldMatch) return goldMatch.symbol;
      }

      if (symbolUpper.length === 6 && !symbolUpper.startsWith('FRX')) {
        const forexMatch = symbolsRef.current.find(s => s.symbol.toUpperCase() === `FRX${symbolUpper}` || s.symbol.toUpperCase() === symbolUpper);
        if (forexMatch) return forexMatch.symbol;
      }

      return rawSymbol;
    };

    const apiSymbol = getSubscribableSymbol(symbol);
    currentSubscribedSymbolRef.current = apiSymbol;

    // Check if the current symbol is marked as closed in symbol list
    const currentSymInfo = symbolsRef.current.find(s => s.symbol.toUpperCase() === symbol.toUpperCase() || s.symbol.toUpperCase() === apiSymbol.toUpperCase());
    setIsMarketClosed(Boolean(currentSymInfo?.is_closed));

    // Forget all existing subscriptions first
    ws.send(JSON.stringify({
      forget_all: ['candles', 'ohlc']
    }));

    const granularity = TIMEFRAMES.find(t => t.id === timeframe)?.seconds || 60;

    // Send history request & subscribe (Max 5,000 candles from Deriv server)
    ws.send(JSON.stringify({
      ticks_history: apiSymbol,
      adjust_start_time: 1,
      count: 5000,
      end: 'latest',
      start: 1,
      style: 'candles',
      granularity: granularity,
      subscribe: 1
    }));

    // Safety Watchdog: If server does not reply with candles in 3 seconds, re-request history
    if (subscribeWatchdogRef.current) clearTimeout(subscribeWatchdogRef.current);
    subscribeWatchdogRef.current = setTimeout(() => {
      const activeWs = socketRef.current;
      if (activeWs && activeWs.readyState === WebSocket.OPEN && candlesRef.current.length === 0) {
        console.warn(`Deriv history response delayed for ${apiSymbol}, retrying request...`);
        activeWs.send(JSON.stringify({
          ticks_history: apiSymbol,
          adjust_start_time: 1,
          count: 5000,
          end: 'latest',
          start: 1,
          style: 'candles',
          granularity: granularity,
          subscribe: 1
        }));
      }
    }, 3000);
  }, []);

  // Continuous / Infinite History Pagination: Fetches up to 5,000 earlier candles without disturbing live stream
  const loadMoreHistory = useCallback(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (isLoadingMoreRef.current || !hasMoreHistoryRef.current) return;

    const currentCandles = candlesRef.current;
    if (!currentCandles || currentCandles.length === 0) return;

    const oldestCandle = currentCandles[0];
    if (!oldestCandle || typeof oldestCandle.time !== 'number') return;

    // If a specific history span is selected (e.g. 1W, 2W, 3W, 1M, 2M, 3M) and NOT 'all':
    if (historySpanRef.current && historySpanRef.current !== 'all') {
      const targetDays = getHistorySpanDays(historySpanRef.current);
      if (targetDays > 0) {
        const targetStartTime = getDeterministicTargetStartTime(historySpanRef.current);
        if (oldestCandle.time <= targetStartTime) {
          // Strict boundary reached! Stop and do NOT fetch further.
          hasMoreHistoryRef.current = false;
          setHasMoreHistory(false);
          return;
        }
      }
    }

    const currentApiSymbol = currentSubscribedSymbolRef.current || selectedSymbolRef.current;
    const granularity = TIMEFRAMES.find(t => t.id === selectedTimeframeRef.current)?.seconds || 60;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    ws.send(JSON.stringify({
      ticks_history: currentApiSymbol,
      adjust_start_time: 1,
      count: 5000,
      end: oldestCandle.time - 1,
      start: 1,
      style: 'candles',
      granularity: granularity,
      passthrough: {
        action: 'load_more_history',
        symbol: currentApiSymbol,
        timeframe: selectedTimeframeRef.current,
        oldestEpoch: oldestCandle.time
      }
    }));
  }, []);

  // Sync historySpan and enforce strict boundary or trigger older history fetch
  useEffect(() => {
    historySpanRef.current = historySpan;
    const currentCandles = candlesRef.current;
    if (currentCandles && currentCandles.length > 0) {
      if (historySpan !== 'all') {
        const targetDays = getHistorySpanDays(historySpan);
        if (targetDays > 0) {
          const targetStartTime = getDeterministicTargetStartTime(historySpan);
          
          // 1. If currently loaded candles already extend older than targetStartTime, TRIM strictly to the boundary!
          if (currentCandles[0].time < targetStartTime) {
            setCandles((prev) => {
              const trimmed = prev.filter(c => c.time >= targetStartTime);
              const cacheKey = `${selectedSymbolRef.current}_${selectedTimeframeRef.current}`;
              globalCandleCache[cacheKey] = trimmed;
              return trimmed;
            });
            hasMoreHistoryRef.current = false;
            setHasMoreHistory(false);
            return;
          }

          // 2. If current candles do not yet reach targetStartTime (e.g. 1M or 5M needing earlier candles), fetch earlier
          if (currentCandles[0].time > targetStartTime && !isLoadingMoreRef.current) {
            hasMoreHistoryRef.current = true;
            setHasMoreHistory(true);
            loadMoreHistory();
          } else {
            hasMoreHistoryRef.current = false;
            setHasMoreHistory(false);
          }
        }
      } else {
        // 'all' mode: infinite history pagination allowed on scroll
        hasMoreHistoryRef.current = true;
        setHasMoreHistory(true);
      }
    }
  }, [historySpan, loadMoreHistory]);

  const connect = useCallback(() => {
    // Clear any pending timers
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    const activeUrls = getActiveUrls();
    if (urlIndexRef.current >= activeUrls.length) {
      urlIndexRef.current = 0;
    }
    const currentUrl = activeUrls[urlIndexRef.current];
    console.log(`WebSocket: Connecting to ${currentUrl} (Index ${urlIndexRef.current}/${activeUrls.length})`);

    const ws = new WebSocket(currentUrl);
    socketRef.current = ws;

    // Set connection timeout (fallback to next URL if not connected in 7 seconds for mobile networks)
    connectionTimeoutRef.current = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn(`WebSocket: Connection to ${currentUrl} timed out after 7s.`);
        setConnectionError(`Timeout connecting to ${currentUrl.split('/')[2].split('?')[0]}. Trying alternative server...`);
        // Move to next and retry
        urlIndexRef.current = (urlIndexRef.current + 1) % activeUrls.length;
        try {
          ws.close();
        } catch (e) {}
      }
    }, 7000);

    ws.onopen = () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      setIsConnected(true);
      setConnectionError(null);
      console.log(`WebSocket: Connected successfully to ${currentUrl}`);

      // 1. Fetch active symbols dynamically
      ws.send(JSON.stringify({
        active_symbols: 'brief',
        product_type: 'basic'
      }));

      // 2. Subscribe to current symbol & timeframe
      subscribe(selectedSymbolRef.current, selectedTimeframeRef.current);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle error payloads from the server
        if (data.error) {
          console.warn('Deriv API Error response:', data.error);

          // If error was on background history pagination, stop spinner quietly without disrupting chart
          if (data.echo_req?.passthrough?.action === 'load_more_history') {
            isLoadingMoreRef.current = false;
            setIsLoadingMore(false);
            hasMoreHistoryRef.current = false;
            setHasMoreHistory(false);
            return;
          }

          // Check if symbol failed and try available aliases automatically
          const activeRawSymbol = selectedSymbolRef.current;
          const symbolUpper = activeRawSymbol.toUpperCase();
          const currentApiSymbol = currentSubscribedSymbolRef.current || symbolUpper;
          const aliases = ALIAS_GROUPS[symbolUpper] || ALIAS_GROUPS[currentApiSymbol.toUpperCase()];

          if (aliases && aliases.length > 1) {
            const currentIdx = attemptedAliasIndexRef.current[activeRawSymbol] ?? aliases.indexOf(currentApiSymbol.toUpperCase());
            const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 1;

            if (nextIdx < aliases.length) {
              const nextAlias = aliases[nextIdx];
              attemptedAliasIndexRef.current[activeRawSymbol] = nextIdx;
              currentSubscribedSymbolRef.current = nextAlias;
              console.log(`Symbol ${currentApiSymbol} failed (${data.error.message}). Retrying with alias: ${nextAlias}`);

              const granularity = TIMEFRAMES.find(t => t.id === selectedTimeframeRef.current)?.seconds || 60;
              ws.send(JSON.stringify({
                ticks_history: nextAlias,
                adjust_start_time: 1,
                count: 5000,
                end: 'latest',
                start: 1,
                style: 'candles',
                granularity: granularity,
                subscribe: 1
              }));
              return;
            }
          }

          if (candlesRef.current.length > 0) {
            setIsLoading(false);
          }
          
          if (data.error.code === 'MarketIsClosed' || (data.error.message && data.error.message.toLowerCase().includes('closed'))) {
            setIsMarketClosed(true);
            setConnectionError(null);
            // If market is closed, fetch candles without live subscription so historical candles still render
            const granularity = TIMEFRAMES.find(t => t.id === selectedTimeframeRef.current)?.seconds || 60;
            ws.send(JSON.stringify({
              ticks_history: currentApiSymbol,
              adjust_start_time: 1,
              count: 5000,
              end: 'latest',
              start: 1,
              style: 'candles',
              granularity: granularity
            }));
            return;
          }

          if (data.error.code === 'InvalidAppId' || data.error.code === 'EndpointError') {
            // Force immediate fallback if app_id is invalid or endpoint has issues
            urlIndexRef.current = (urlIndexRef.current + 1) % activeUrls.length;
            try {
              ws.close();
            } catch (e) {}
          } else {
            setConnectionError(`Asset Status: ${data.error.message || 'Selected asset is not active in this market'}`);
          }
          return;
        }

        // Handle Active Symbols according to latest Deriv API schema
        if (data.msg_type === 'active_symbols' && Array.isArray(data.active_symbols)) {
          const fetched: SymbolInfo[] = data.active_symbols
            .map((sym: any) => {
              const code = sym.underlying_symbol || sym.symbol || '';
              const name = sym.underlying_symbol_name || sym.display_name || code;
              const market = sym.market || 'synthetic_index';
              const marketDisplay = sym.market_display_name || (market === 'synthetic_index' ? 'Derived Indices' : market === 'forex' ? 'Forex' : market === 'cryptocurrency' ? 'Cryptocurrency' : 'Markets');
              const isClosed = sym.exchange_is_open === 0 || sym.is_trading_suspended === 1;
              return {
                symbol: code,
                display_name: name,
                market: market,
                market_display_name: marketDisplay,
                submarket_display_name: sym.submarket_display_name || sym.submarket,
                pip: sym.pip_size || sym.pip || 0.01,
                is_closed: isClosed
              };
            })
            .filter((s: SymbolInfo) => Boolean(s.symbol));

          if (fetched.length > 0) {
            liveFetchedSymbolsRef.current = fetched;
            const merged = [...fetched];
            STATIC_SYMBOLS.forEach((s) => {
              if (!merged.some((m) => m.symbol.toUpperCase() === s.symbol.toUpperCase())) {
                merged.push(s);
              }
            });
            // Strictly order all pairs by Jump -> Volatility -> Step -> Crash&Boom -> Forex -> Crypto
            merged.sort((a, b) => getCategoryPriority(a) - getCategoryPriority(b));
            setSymbols(merged);
            symbolsRef.current = merged;

            // If not already subscribed on open, subscribe with the updated catalog
            if (!currentSubscribedSymbolRef.current) {
              subscribe(selectedSymbolRef.current, selectedTimeframeRef.current);
            }
          }
        }

        // Handle Historical Candle Data
        if (data.msg_type === 'candles' && data.candles) {
          // 1. Check if this is an older history pagination response
          if (data.echo_req?.passthrough?.action === 'load_more_history') {
            const rawOlder: any[] = data.candles;
            const oldestExpected = Number(data.echo_req.passthrough.oldestEpoch);

            if (!Array.isArray(rawOlder) || rawOlder.length === 0) {
              hasMoreHistoryRef.current = false;
              setHasMoreHistory(false);
              isLoadingMoreRef.current = false;
              setIsLoadingMore(false);
            } else {
              const parsedOlder: Candle[] = rawOlder
                .map((c: any) => ({
                  time: c.epoch,
                  open: parseFloat(c.open),
                  high: parseFloat(c.high),
                  low: parseFloat(c.low),
                  close: parseFloat(c.close)
                }))
                .filter((c) => c.time < oldestExpected);

              if (parsedOlder.length === 0) {
                hasMoreHistoryRef.current = false;
                setHasMoreHistory(false);
                isLoadingMoreRef.current = false;
                setIsLoadingMore(false);
              } else {
                let earliestTime = parsedOlder[0].time;
                const targetDays = getHistorySpanDays(historySpanRef.current);
                const isStrictSpan = historySpanRef.current !== 'all' && targetDays > 0;
                const targetStartTime = isStrictSpan ? getDeterministicTargetStartTime(historySpanRef.current) : 0;

                setCandles((prev) => {
                  const map = new Map<number, Candle>();
                  parsedOlder.forEach((c) => map.set(c.time, c));
                  prev.forEach((c) => map.set(c.time, c));
                  let combined = Array.from(map.values()).sort((a, b) => a.time - b.time);

                  // If strict span, trim anything older than targetStartTime
                  if (isStrictSpan) {
                    combined = combined.filter((c) => c.time >= targetStartTime);
                  }

                  // Keep memory bounded to 50,000 candles max
                  const bounded = combined.length > 50000 ? combined.slice(combined.length - 50000) : combined;

                  const cacheKey = `${selectedSymbolRef.current}_${selectedTimeframeRef.current}`;
                  globalCandleCache[cacheKey] = bounded;
                  if (bounded.length > 0) earliestTime = bounded[0].time;
                  return bounded;
                });

                if (isStrictSpan) {
                  if (earliestTime <= targetStartTime) {
                    hasMoreHistoryRef.current = false;
                    setHasMoreHistory(false);
                    isLoadingMoreRef.current = false;
                    setIsLoadingMore(false);
                    return;
                  }
                }

                // Auto continue fetching earlier batch if targetStartTime is not yet reached and server provided a good batch
                if (isStrictSpan && earliestTime > targetStartTime && rawOlder.length >= 100 && ws && ws.readyState === WebSocket.OPEN) {
                  setTimeout(() => {
                    if (ws && ws.readyState === WebSocket.OPEN && selectedTimeframeRef.current === data.echo_req.passthrough.timeframe) {
                      const currentApiSymbol = currentSubscribedSymbolRef.current || selectedSymbolRef.current;
                      const granularity = TIMEFRAMES.find(t => t.id === selectedTimeframeRef.current)?.seconds || 60;
                      isLoadingMoreRef.current = true;
                      setIsLoadingMore(true);
                      ws.send(JSON.stringify({
                        ticks_history: currentApiSymbol,
                        adjust_start_time: 1,
                        count: 5000,
                        end: earliestTime - 1,
                        start: 1,
                        style: 'candles',
                        granularity: granularity,
                        passthrough: {
                          action: 'load_more_history',
                          symbol: currentApiSymbol,
                          timeframe: selectedTimeframeRef.current,
                          oldestEpoch: earliestTime
                        }
                      }));
                    } else {
                      isLoadingMoreRef.current = false;
                      setIsLoadingMore(false);
                    }
                  }, 120);
                } else {
                  isLoadingMoreRef.current = false;
                  setIsLoadingMore(false);
                  if (isStrictSpan && earliestTime <= targetStartTime) {
                    hasMoreHistoryRef.current = false;
                    setHasMoreHistory(false);
                  }
                }
              }
            }
            return;
          }

          // 2. Primary / Initial 5,000 candles batch
          const historicalCandles: Candle[] = data.candles.map((c: any) => ({
            time: c.epoch,
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close)
          }));

          const cacheKey = `${selectedSymbolRef.current}_${selectedTimeframeRef.current}`;
          const existingCached = globalCandleCache[cacheKey];

          let finalCandles = historicalCandles;
          // If previous session already loaded older history beyond the initial 5,000, retain it seamlessly
          if (existingCached && existingCached.length > 0 && historicalCandles.length > 0 && existingCached[0].time < historicalCandles[0].time) {
            const map = new Map<number, Candle>();
            existingCached.forEach((c) => {
              if (c.time < historicalCandles[0].time) {
                map.set(c.time, c);
              }
            });
            historicalCandles.forEach((c) => map.set(c.time, c));
            finalCandles = Array.from(map.values()).sort((a, b) => a.time - b.time);
          }

          const targetDays = getHistorySpanDays(historySpanRef.current);
          const isStrictSpan = historySpanRef.current !== 'all' && targetDays > 0;
          const targetStartTime = isStrictSpan ? getDeterministicTargetStartTime(historySpanRef.current) : 0;

          if (isStrictSpan) {
            // Trim to strict boundary!
            finalCandles = finalCandles.filter((c) => c.time >= targetStartTime);
            if (finalCandles.length > 0 && finalCandles[0].time <= targetStartTime) {
              hasMoreHistoryRef.current = false;
              setHasMoreHistory(false);
            } else if (finalCandles.length > 0 && finalCandles[0].time > targetStartTime) {
              hasMoreHistoryRef.current = true;
              setHasMoreHistory(true);
            }
          } else {
            hasMoreHistoryRef.current = true;
            setHasMoreHistory(true);
          }

          if (subscribeWatchdogRef.current) clearTimeout(subscribeWatchdogRef.current);

          setCandles(finalCandles);
          setIsLoading(false);
          setConnectionError(null);

          // Save to local fast cache and session storage
          globalCandleCache[cacheKey] = finalCandles;
          saveCachedCandles(selectedSymbolRef.current, selectedTimeframeRef.current, finalCandles);

          // Check if requested history span extends earlier than initial 5,000 candles (e.g. 1M/5M needing more batches)
          if (isStrictSpan && finalCandles.length > 0) {
            if (finalCandles[0].time > targetStartTime && ws && ws.readyState === WebSocket.OPEN && !isLoadingMoreRef.current) {
              const currentApiSymbol = currentSubscribedSymbolRef.current || selectedSymbolRef.current;
              const granularity = TIMEFRAMES.find(t => t.id === selectedTimeframeRef.current)?.seconds || 60;
              isLoadingMoreRef.current = true;
              setIsLoadingMore(true);
              ws.send(JSON.stringify({
                ticks_history: currentApiSymbol,
                adjust_start_time: 1,
                count: 5000,
                end: finalCandles[0].time - 1,
                start: 1,
                style: 'candles',
                granularity: granularity,
                passthrough: {
                  action: 'load_more_history',
                  symbol: currentApiSymbol,
                  timeframe: selectedTimeframeRef.current,
                  oldestEpoch: finalCandles[0].time
                }
              }));
            }
          }
        }

        // Handle Real-Time Candle Updates
        if (data.msg_type === 'ohlc' && data.ohlc) {
          const ohlc = data.ohlc;
          // Support matches for symbol, and translated crypto/gold/forex equivalents
          const selectedUpper = selectedSymbolRef.current.toUpperCase();
          const incomingUpper = ohlc.symbol.toUpperCase();
          const matchesSymbol = ohlc.symbol === selectedSymbolRef.current || 
                                incomingUpper === `CRY${selectedUpper}` ||
                                (selectedUpper === 'XAUUSD' && incomingUpper === 'FRXXAUUSD') ||
                                (selectedUpper === 'EURUSD' && incomingUpper === 'FRXEURUSD') ||
                                (incomingUpper === `FRX${selectedUpper}`) ||
                                (selectedUpper === `FRX${incomingUpper}`);
          
          const timeframeSeconds = TIMEFRAMES.find(t => t.id === selectedTimeframeRef.current)?.seconds || 60;
          if (matchesSymbol && Number(ohlc.granularity) === timeframeSeconds) {
            const newCandle: Candle = {
              time: Number(ohlc.open_time),
              open: parseFloat(ohlc.open),
              high: parseFloat(ohlc.high),
              low: parseFloat(ohlc.low),
              close: parseFloat(ohlc.close)
            };

            setCandles((prev) => {
              if (prev.length === 0) return [newCandle];
              const lastCandle = prev[prev.length - 1];

              let updated = prev;
              if (lastCandle.time === newCandle.time) {
                // Update latest candle
                updated = [...prev];
                updated[updated.length - 1] = newCandle;
              } else if (newCandle.time > lastCandle.time) {
                // Append new candle and cap size at 50,000 to keep canvas rendering extremely performant without trimming user history
                updated = [...prev, newCandle];
                if (updated.length > 50000) {
                  updated = updated.slice(updated.length - 50000);
                }
              }

              // Update cache with the live stream candles
              const cacheKey = `${selectedSymbolRef.current}_${selectedTimeframeRef.current}`;
              globalCandleCache[cacheKey] = updated;

              return updated;
            });
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      console.warn(`WebSocket connection error on ${currentUrl}, attempting next server...`, err);
      setIsConnected(false);
      // Immediately increment the index so the next reconnect uses the next endpoint
      urlIndexRef.current = (urlIndexRef.current + 1) % activeUrls.length;
      try {
        ws.close();
      } catch (e) {}
    };

    ws.onclose = () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      const wasConnected = isConnectedRef.current;
      setIsConnected(false);
      
      // Fast 0.1s (100ms) reconnect delay for instant reconnect speed
      const delay = wasConnected ? 500 : 100;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [subscribe, getActiveUrls]);

  // Reconnect instantly when connection settings are changed
  useEffect(() => {
    urlIndexRef.current = 0;
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
    } else {
      connect();
    }
  }, [connectionSettings?.customServer, connectionSettings?.customAppId, connect]);

  // Sync on symbol or timeframe changes with instant memory & session caching
  useEffect(() => {
    const cached = getCachedCandles(selectedSymbol, selectedTimeframe);
    if (cached && cached.length > 0) {
      setCandles(cached);
      setIsLoading(false); // Instant load from real cache
    } else {
      setCandles([]);
      setIsLoading(true);
    }

    if (isConnected) {
      subscribe(selectedSymbol, selectedTimeframe);
    }
  }, [selectedSymbol, selectedTimeframe, isConnected, subscribe]);

  // Initial connect and teardown
  useEffect(() => {
    connect();
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (subscribeWatchdogRef.current) clearTimeout(subscribeWatchdogRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
      }
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    urlIndexRef.current = 0;
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
    } else {
      connect();
    }
  }, [connect]);

  return {
    candles,
    symbols,
    isConnected,
    isLoading,
    isMarketClosed,
    connectionError,
    reconnect,
    loadMoreHistory,
    hasMoreHistory,
    isLoadingMore
  };
}
