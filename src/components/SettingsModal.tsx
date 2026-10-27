/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChartSettings, HistorySpanId, HISTORY_SPANS, SMCInstanceConfig, ChartThemeId } from '../types';
import { THEME_PRESETS, ThemePreset, isDarkTheme, getThemePreset } from '../utils/themePresets';
import { X, Palette, LayoutGrid, Eye, Sun, Moon, ShieldCheck, Send, ExternalLink, MessageCircle, RotateCcw, Sparkles, Check, RefreshCw, Settings, Crown, Key, Power, Zap, ArrowUpRight, Smartphone, Download, Share2, PlusSquare, Clock, Calendar, CheckCircle2, Layers, Plus, Trash2, Copy, ChevronDown, ChevronUp, SlidersHorizontal, TrendingUp, Code2, Edit3 } from 'lucide-react';
import { AdminPanel } from './AdminPanel';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChartSettings;
  onUpdateSettings: (settings: ChartSettings) => void;
  initialTab?: 'candles' | 'appearance' | 'indicators' | 'added_indicators' | 'all_indicators' | 'connection' | 'pwa' | 'support' | 'admin';
  modalMode?: 'indicators' | 'settings';
  isMproPro?: boolean;
  mproAccessMode?: 'free' | 'demo' | 'pro';
  onOpenMproModal?: () => void;
  isMpro2Pro?: boolean;
  mpro2AccessMode?: 'free' | 'demo' | 'pro';
  onOpenMpro2Modal?: () => void;
  onActivatePro?: (token?: string) => void;
  onSwitchToFree?: () => void;
}

const INDICATOR_NAME_MAP: Record<string, string> = {
  mstt: 'Market Structure Target Tracker (MSTT) [MarkitTick]',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  initialTab = 'candles',
  modalMode,
  isMproPro = false,
  mproAccessMode = 'demo',
  onOpenMproModal,
  isMpro2Pro = false,
  mpro2AccessMode = 'demo',
  onOpenMpro2Modal,
  onActivatePro,
  onSwitchToFree,
}) => {
  const effectiveMode: 'indicators' | 'settings' = modalMode || (
    initialTab === 'indicators' || initialTab === 'added_indicators' || initialTab === 'all_indicators'
      ? 'indicators'
      : 'settings'
  );

  const [activeTab, setActiveTab] = useState<'candles' | 'appearance' | 'indicators' | 'connection' | 'pwa' | 'support' | 'admin'>('candles');
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [indicatorFilter, setIndicatorFilter] = useState<'all' | 'added' | 'not_added'>('added');
  const [showTgPasscodeModal, setShowTgPasscodeModal] = useState(false);
  const [tgPasscodeInput, setTgPasscodeInput] = useState('');
  const [tgPasscodeError, setTgPasscodeError] = useState('');
  const [isTgVerifying, setIsTgVerifying] = useState(false);

  // Telegram 24/7 Cloud Alert (cron-job.org) State & Handlers
  const [tgAlertTesting, setTgAlertTesting] = useState(false);
  const [tgAlertSyncing, setTgAlertSyncing] = useState(false);
  const [tgAlertMsg, setTgAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showTgTokenSecret, setShowTgTokenSecret] = useState(false);
  const [cronUrlCopied, setCronUrlCopied] = useState(false);

  const handleTestTgCloudAlert = async () => {
    const token = (settings.indicators.msttTgBotToken || '').trim();
    const chat = (settings.indicators.msttTgChatId || '').trim();
    if (!token || !chat) {
      setTgAlertMsg({ type: 'error', text: 'Bot Token እና Chat ID ሳያስገቡ መሞከር አይቻልም። እባክዎ መጀመሪያ ይሙሉ!' });
      return;
    }
    setTgAlertTesting(true);
    setTgAlertMsg(null);

    const testMsg = `🔔 <b>Telegram Alert Bot Connected!</b>\n\n` +
      `✅ Your 24/7 Cloud Monitoring connection is active and ready.\n` +
      `📊 <b>Pair:</b> <code>${settings.indicators.msttTgSymbol || '1HZ75V'}</code>\n` +
      `⏱ <b>Timeframe:</b> <code>${settings.indicators.msttTgTimeframe || '1H'}</code>\n` +
      `🎯 <b>Rule:</b> BOS Signals with Written SL (${settings.indicators.msttPointsSl || 220} pts) / TP1 (${settings.indicators.msttPointsTp1 || 1030} pts).\n\n` +
      `<i>Whenever cron-job.org checks the market, any new signal will be sent to this chat automatically!</i>`;

    let sentSuccess = false;
    let errorDetail = '';

    // Step 1: Attempt server endpoint first
    try {
      const res = await fetch('/api/cloud-alert-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          botToken: token,
          chatId: chat,
          symbol: settings.indicators.msttTgSymbol || '1HZ75V',
          timeframe: settings.indicators.msttTgTimeframe || '1H',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.ok) {
          sentSuccess = true;
        } else {
          errorDetail = data.error || data.message || '';
        }
      }
    } catch (srvErr) {
      // Server endpoint not yet reachable or errored; fallback to direct Telegram
    }

    // Step 2: Fallback to direct Telegram Bot API call (Telegram has open CORS)
    if (!sentSuccess) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat,
            text: testMsg,
            parse_mode: 'HTML',
          }),
        });
        const tgData = await tgRes.json();
        if (tgData.ok) {
          sentSuccess = true;
        } else {
          errorDetail = tgData.description || 'Bot Token ወይም Chat ID ትክክል አይደለም';
        }
      } catch (tgErr: any) {
        errorDetail = tgErr.message || 'Telegram API connection failed';
      }
    }

    if (sentSuccess) {
      setTgAlertMsg({ type: 'success', text: '✅ የሙከራ መልእክት (Test Message) ወደ Telegram Bot ተልኳል! Telegramዎን ይመልከቱ።' });
    } else {
      setTgAlertMsg({ type: 'error', text: `❌ ስህተት ተፈጥሯል: ${errorDetail || 'Token ወይም Chat ID የተሳሳተ ነው'}` });
    }
    setTgAlertTesting(false);
  };

  const handleSyncCloudSettings = async (customIndicators?: any) => {
    const ind = customIndicators || settings.indicators;
    setTgAlertSyncing(true);
    setTgAlertMsg(null);
    try {
      const payload = {
        botToken: (ind.msttTgBotToken || '').trim(),
        chatId: (ind.msttTgChatId || '').trim(),
        enabled: Boolean(ind.msttTgAlertsEnabled),
        symbol: ind.msttTgSymbol || '1HZ75V',
        timeframe: ind.msttTgTimeframe || '1H',
        options: {
          targetMode: ind.msttTargetMode ?? 'points',
          pointsSl: ind.msttPointsSl ?? 220,
          pointsTp1: ind.msttPointsTp1 ?? 1030,
          pointsTp2: ind.msttPointsTp2 ?? 2060,
          pointsTp3: ind.msttPointsTp3 ?? 3090,
          targetFocus: ind.msttTargetFocus ?? 'TP1',
          swingLen: ind.msttSwingLen ?? 5,
          useStructureFilter: ind.msttUseStructureFilter ?? true,
          structureTf: ind.msttStructureTf ?? '15',
          filterSwingLen: ind.msttFilterSwingLen ?? 5,
          useWickFilter: ind.msttUseWickFilter ?? true,
          maxWickRatio: ind.msttMaxWickRatio ?? 0.70,
          useSweepFilter: ind.msttUseSweepFilter ?? false,
          sweepLookback: ind.msttSweepLookback ?? 10,
          useBodyCloseFilter: ind.msttUseBodyCloseFilter ?? true,
          minBodyRatio: ind.msttMinBodyRatio ?? 0.50,
          useDisplacementFilter: ind.msttUseDisplacementFilter ?? true,
          minDisplacementAtr: ind.msttMinDisplacementAtr ?? 0.80,
          useFvgFilter: ind.msttUseFvgFilter ?? false,
          useVolumeFilter: ind.msttUseVolumeFilter ?? false,
          volumeLength: ind.msttVolumeLength ?? 20,
          volumeMultiplier: ind.msttVolumeMultiplier ?? 1.20,
          useScoreFilter: ind.msttUseScoreFilter ?? false,
          minContinuationScore: ind.msttMinContinuationScore ?? 60,
          useHtfFilter: ind.msttUseHtfFilter ?? false,
          htfRes: ind.msttHtfRes ?? '240',
          htfRsiLen: ind.msttHtfRsiLen ?? 14,
          slMulti: ind.msttSlMulti ?? 1.0,
          tp1Multi: ind.msttTp1Multi ?? 1.5,
          tp2Multi: ind.msttTp2Multi ?? 3.0,
          tp3Multi: ind.msttTp3Multi ?? 5.0,
          atrLen: ind.msttAtrLen ?? 14,
          preventLateEntry: ind.msttPreventLateEntry ?? true,
          maxBreakoutDelay: ind.msttMaxBreakoutDelay ?? 1,
        },
      };

      try {
        const res = await fetch('/api/cloud-alert-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.ok) {
            setTgAlertMsg({ type: 'success', text: '⚡ ሁሉም የ Setting ህጎች (SL/TP፣ ፊልተሮች) ወደ Cloud Alert በተሳካ ሁኔታ ተመሳስለዋል (Synced)!' });
            return;
          }
        }
      } catch (err) {
        // Fallback
      }

      // If serverless tmp sync is pending, UI settings & URL parameters are stored
      setTgAlertMsg({ type: 'success', text: '⚡ ሁሉም የ Setting ህጎች ተመሳስለዋል! (በ cron-job.org URL ውስጥም በራስ-ሰር ተካተዋል)' });
    } catch (e: any) {
      setTgAlertMsg({ type: 'error', text: `❌ ስህተት: ${e.message}` });
    } finally {
      setTgAlertSyncing(false);
    }
  };

  // State for confirming permanent indicator deletion
  const [indicatorToDelete, setIndicatorToDelete] = useState<{ id: string; name: string } | null>(null);

  const isVerifiedDevice = localStorage.getItem('tg_signals_device_verified') === 'true';

  // PRO Suite Setup & Licensing (Mpro · Mpro2 · Nexus)
  const PRO_ACTIVATION_CODE = 'Mcharts-Mihiretu-Jump10-2019';

  const [proMode, setProMode] = useState<'pro' | 'free'>(() => {
    const savedMode = localStorage.getItem('mcharts_pro_mode');
    if (savedMode === 'free') return 'free';
    return 'pro';
  });

  const [isProActivated, setIsProActivated] = useState<boolean>(() => {
    const savedToken = localStorage.getItem('mcharts_pro_suite_token');
    const savedMode = localStorage.getItem('mcharts_pro_mode');
    const hasCookie = typeof document !== 'undefined' && document.cookie.includes('is_mcharts_pro_user=true');
    if (savedMode === 'free') return false;
    return savedToken === PRO_ACTIVATION_CODE || hasCookie || !!savedToken || isMpro2Pro || isMproPro;
  });

  // User requirement: "pro code በblank አታሳይ። code ''Mcharts-Mihiretu-Jump10-2019''"
  const [proCodeInput, setProCodeInput] = useState<string>(PRO_ACTIVATION_CODE);
  const [proCodeSuccess, setProCodeSuccess] = useState<string>('');
  const [proCodeError, setProCodeError] = useState<string>('');

  const handleActivatePro = (customCode?: string) => {
    const codeToTest = (customCode || proCodeInput || PRO_ACTIVATION_CODE).trim();
    if (codeToTest.toLowerCase() === PRO_ACTIVATION_CODE.toLowerCase()) {
      localStorage.setItem('mcharts_pro_suite_token', PRO_ACTIVATION_CODE);
      localStorage.setItem('mcharts_pro_mode', 'pro');
      localStorage.setItem('is_mcharts_pro_user', 'true');
      localStorage.setItem('mpro2_signals_pro_token', PRO_ACTIVATION_CODE);
      localStorage.setItem('mpro_signals_pro_token', PRO_ACTIVATION_CODE);
      try {
        document.cookie = `is_mcharts_pro_user=true; path=/; max-age=${365 * 86400}; SameSite=Lax`;
        document.cookie = `mcharts_pro_suite_token=${PRO_ACTIVATION_CODE}; path=/; max-age=${365 * 86400}; SameSite=Lax`;
      } catch (e) {
        // Cookie fallback
      }
      setIsProActivated(true);
      setProMode('pro');
      setProCodeSuccess('👑 PRO Suite Activated! Mpro, Mpro2 & Nexus are now fully unlocked.');
      setProCodeError('');
      if (onActivatePro) {
        onActivatePro(PRO_ACTIVATION_CODE);
      }
      setTimeout(() => setProCodeSuccess(''), 4000);

      // Turn ON all PRO suite indicators
      onUpdateSettings({
        ...settings,
        indicators: {
          ...settings.indicators,
          showSrClassification: true,
          showEchoMpro: true,
          showMpro2Signal: true,
          showMasterDashboard: true,
          showNexusSuite: true,
          showOrderBlocksWithVolume: true,
          showProOrderBlocks: true,
        },
      });
    } else {
      setProCodeError('Invalid code. Please use: ' + PRO_ACTIVATION_CODE);
    }
  };

  const handleSwitchToFree = () => {
    setProMode('free');
    localStorage.setItem('mcharts_pro_mode', 'free');
    localStorage.removeItem('is_mcharts_pro_user');
    try {
      document.cookie = `is_mcharts_pro_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } catch (e) {}
    setIsProActivated(false);
    if (onSwitchToFree) {
      onSwitchToFree();
    }
    onUpdateSettings({
      ...settings,
      indicators: {
        ...settings.indicators,
        showSrClassification: false,
        showEchoMpro: false,
        showMpro2Signal: false,
        showMasterDashboard: false,
        showNexusSuite: false,
        showOrderBlocksWithVolume: false,
        showProOrderBlocks: false,
      },
    });
  };

  const handleSwitchToPro = () => {
    handleActivatePro(proCodeInput || PRO_ACTIVATION_CODE);
  };

  // Permanently deleted indicators registry
  const deletedSet = new Set<string>(settings.indicators.deletedIndicators || []);
  const isIndicatorDeleted = (id: string) => deletedSet.has(id);

  const isAutoChannelsActive = !isIndicatorDeleted('auto_price_channels') && (settings.indicators.showAutoPriceChannels ?? true);
  const isAutoSdcActive = !isIndicatorDeleted('auto_sdc') && (settings.indicators.showAutoSupplyDemandChannel ?? true);
  const isMAActive = !isIndicatorDeleted('ma') && (settings.indicators.showMA ?? false);
  const isGTAActive = !isIndicatorDeleted('gta') && (settings.indicators.showGTA ?? false);
  const isTWBActive = !isIndicatorDeleted('twb') && (settings.indicators.showTrendlinesWithBreaks ?? false);
  const isSMCActive = !isIndicatorDeleted('smc') && (settings.indicators.showSmartMoneyConcepts ?? false);
  const isSOActive = !isIndicatorDeleted('so') && (settings.indicators.showSignalsAndOverlays ?? false);
  const isFVGActive = !isIndicatorDeleted('fvg') && (settings.indicators.showConfluenceFVG ?? false);
  const isICTActive = !isIndicatorDeleted('ict') && (settings.indicators.showIctConcepts ?? false);
  const isMStatActive = !isIndicatorDeleted('mstat') && (settings.indicators.showMarketStructureToolkit ?? false);
  const isMSSActive = !isIndicatorDeleted('mss') && (settings.indicators.showMarketStructureSignals ?? true);
  const isPRActive = !isIndicatorDeleted('pr') && (settings.indicators.showPredictiveRanges ?? true);
  const isSRActive = !isIndicatorDeleted('sr') && (settings.indicators.showSrClassification ?? true);
  const isEchoActive = !isIndicatorDeleted('echo') && (settings.indicators.showEchoMpro ?? true);
  const isMpro2Active = !isIndicatorDeleted('mpro2') && (settings.indicators.showMpro2Signal ?? true);
  const isMasterActive = !isIndicatorDeleted('master') && (settings.indicators.showMasterDashboard ?? true);
  const isHvnActive = !isIndicatorDeleted('hvn') && (settings.indicators.showHvnProfile ?? true);
  const isNexusActive = !isIndicatorDeleted('nexus') && (settings.indicators.showNexusSuite ?? true);
  const isSessionFilterActive = !isIndicatorDeleted('session') && (settings.indicators.showSessionFilter ?? true);
  const isObvActive = !isIndicatorDeleted('obv') && (settings.indicators.showOrderBlocksWithVolume ?? true);
  const isProObActive = !isIndicatorDeleted('pro_ob') && (settings.indicators.showProOrderBlocks ?? true);
  const isMsttActive = !isIndicatorDeleted('mstt') && ((settings.indicators.showMarketTickTwo ?? settings.indicators.showMarketStructureTargetTracker) ?? true);
  const isVipScannerActive = !isIndicatorDeleted('vip_scanner') && (settings.indicators.showVipMarketScanner ?? true);
  const isDynamicTpSlActive = !isIndicatorDeleted('dynamic_tpsl') && (settings.indicators.showDynamicTpSlSignals ?? true);
  const isTradePlannerActive = !isIndicatorDeleted('trade_planner') && (settings.indicators.showTradePlanner ?? true);
  const isFibSwingActive = !isIndicatorDeleted('fib_swing') && (settings.indicators.showFibonacciSequenceSwing ?? true);
  const isMtfEmaActive = !isIndicatorDeleted('mtf_ema') && (settings.indicators.showMultiTimeframeEma ?? true);
  const isMrovTradeActive = !isIndicatorDeleted('mrov_trade') && (settings.indicators.showMrovOpeningRange ?? false);
  const isEma50100Active = !isIndicatorDeleted('ema_50_100') && (settings.indicators.showEma50100Trend ?? false);

  // Permanently delete indicator handler
  const handlePermanentlyDeleteIndicator = (indicatorId: string) => {
    const currentDeleted = settings.indicators.deletedIndicators || [];
    const nextDeleted = currentDeleted.includes(indicatorId) ? currentDeleted : [...currentDeleted, indicatorId];
    
    // Also disable toggle flags so calculation doesn't run anywhere
    const toggleUpdates: Partial<ChartSettings['indicators']> = {
      deletedIndicators: nextDeleted,
    };

    switch (indicatorId) {
      case 'auto_price_channels': toggleUpdates.showAutoPriceChannels = false; break;
      case 'auto_sdc': toggleUpdates.showAutoSupplyDemandChannel = false; break;
      case 'ma': toggleUpdates.showMA = false; break;
      case 'gta': toggleUpdates.showGTA = false; break;
      case 'twb': toggleUpdates.showTrendlinesWithBreaks = false; break;
      case 'smc': toggleUpdates.showSmartMoneyConcepts = false; break;
      case 'so': toggleUpdates.showSignalsAndOverlays = false; break;
      case 'fvg': toggleUpdates.showConfluenceFVG = false; break;
      case 'ict': toggleUpdates.showIctConcepts = false; break;
      case 'mstat': toggleUpdates.showMarketStructureToolkit = false; break;
      case 'mss': toggleUpdates.showMarketStructureSignals = false; break;
      case 'pr': toggleUpdates.showPredictiveRanges = false; break;
      case 'sr': toggleUpdates.showSrClassification = false; break;
      case 'echo': toggleUpdates.showEchoMpro = false; break;
      case 'mpro2': toggleUpdates.showMpro2Signal = false; break;
      case 'master': toggleUpdates.showMasterDashboard = false; toggleUpdates.showMasterSignal = false; break;
      case 'hvn': toggleUpdates.showHvnProfile = false; break;
      case 'nexus': toggleUpdates.showNexusSuite = false; break;
      case 'session': toggleUpdates.showSessionFilter = false; break;
      case 'obv': toggleUpdates.showOrderBlocksWithVolume = false; break;
      case 'pro_ob': toggleUpdates.showProOrderBlocks = false; break;
      case 'mstt': toggleUpdates.showMarketStructureTargetTracker = false; toggleUpdates.showMarketTickTwo = false; break;
      case 'vip_scanner': toggleUpdates.showVipMarketScanner = false; break;
      case 'dynamic_tpsl': toggleUpdates.showDynamicTpSlSignals = false; break;
      case 'trade_planner': toggleUpdates.showTradePlanner = false; break;
      case 'fib_swing': toggleUpdates.showFibonacciSequenceSwing = false; break;
      case 'mtf_ema': toggleUpdates.showMultiTimeframeEma = false; break;
      case 'mrov_trade': toggleUpdates.showMrovOpeningRange = false; break;
      case 'ema_50_100': toggleUpdates.showEma50100Trend = false; break;
    }

    onUpdateSettings({
      ...settings,
      indicators: {
        ...settings.indicators,
        ...toggleUpdates,
      },
    });

    setIndicatorToDelete(null);
  };

  const handleRestoreIndicator = (indicatorId: string) => {
    const currentDeleted = settings.indicators.deletedIndicators || [];
    const nextDeleted = currentDeleted.filter((id) => id !== indicatorId);
    onUpdateSettings({
      ...settings,
      indicators: {
        ...settings.indicators,
        deletedIndicators: nextDeleted,
      },
    });
  };

  const handleRestoreAllIndicators = () => {
    onUpdateSettings({
      ...settings,
      indicators: {
        ...settings.indicators,
        deletedIndicators: [],
      },
    });
  };

  // Safe color helper for HTML5 color inputs which strictly require #RRGGBB format
  const toHexColor = (col?: string, defaultHex = '#00c878'): string => {
    if (!col) return defaultHex;
    if (col.startsWith('#')) {
      if (col.length === 7) return col;
      if (col.length === 4) return `#${col[1]}${col[1]}${col[2]}${col[2]}${col[3]}${col[3]}`;
      return col.slice(0, 7);
    }
    const match = col.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (match) {
      const r = Math.min(255, Math.max(0, parseInt(match[1]))).toString(16).padStart(2, '0');
      const g = Math.min(255, Math.max(0, parseInt(match[2]))).toString(16).padStart(2, '0');
      const b = Math.min(255, Math.max(0, parseInt(match[3]))).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return defaultHex;
  };

  const FOREX_DEFAULT_CANDLES = {
    upColor: '#089981',
    downColor: '#f23645',
    borderUpColor: '#089981',
    borderDownColor: '#f23645',
    wickUpColor: '#089981',
    wickDownColor: '#f23645',
  };

  const CANDLE_PRESETS = [
    {
      id: 'forex-default',
      name: 'Original Forex Default',
      badge: 'Default',
      upColor: '#089981',
      downColor: '#f23645',
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
    },
    {
      id: 'tradingview',
      name: 'TradingView Classic',
      badge: 'Classic',
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    },
    {
      id: 'mt4-neon',
      name: 'MetaTrader Neon',
      badge: 'MT4/MT5',
      upColor: '#00c853',
      downColor: '#d50000',
      borderUpColor: '#00c853',
      borderDownColor: '#d50000',
      wickUpColor: '#00c853',
      wickDownColor: '#d50000',
    },
    {
      id: 'pro-blue',
      name: 'Classic Blue & Orange',
      badge: 'Pro',
      upColor: '#2563eb',
      downColor: '#ea580c',
      borderUpColor: '#2563eb',
      borderDownColor: '#ea580c',
      wickUpColor: '#2563eb',
      wickDownColor: '#ea580c',
    },
    {
      id: 'monochrome',
      name: 'Monochrome Clean (White/Slate)',
      badge: 'Mono',
      upColor: '#ffffff',
      downColor: '#1e293b',
      borderUpColor: '#334155',
      borderDownColor: '#1e293b',
      wickUpColor: '#334155',
      wickDownColor: '#1e293b',
    },
    {
      id: 'hollow-white',
      name: 'Japanese Hollow White',
      badge: 'Classic',
      upColor: '#ffffff',
      downColor: '#ef5350',
      borderUpColor: '#334155',
      borderDownColor: '#ef5350',
      wickUpColor: '#334155',
      wickDownColor: '#ef5350',
    },
  ];

  const isForexDefaultCandles =
    settings.candle.upColor.toLowerCase() === FOREX_DEFAULT_CANDLES.upColor.toLowerCase() &&
    settings.candle.downColor.toLowerCase() === FOREX_DEFAULT_CANDLES.downColor.toLowerCase() &&
    settings.candle.borderUpColor.toLowerCase() === FOREX_DEFAULT_CANDLES.borderUpColor.toLowerCase() &&
    settings.candle.borderDownColor.toLowerCase() === FOREX_DEFAULT_CANDLES.borderDownColor.toLowerCase() &&
    settings.candle.wickUpColor.toLowerCase() === FOREX_DEFAULT_CANDLES.wickUpColor.toLowerCase() &&
    settings.candle.wickDownColor.toLowerCase() === FOREX_DEFAULT_CANDLES.wickDownColor.toLowerCase();

  const handleApplyCandlePreset = (preset: typeof CANDLE_PRESETS[0]) => {
    onUpdateSettings({
      ...settings,
      candle: {
        upColor: preset.upColor,
        downColor: preset.downColor,
        borderUpColor: preset.borderUpColor,
        borderDownColor: preset.borderDownColor,
        wickUpColor: preset.wickUpColor,
        wickDownColor: preset.wickDownColor,
      },
    });
  };

  const handleResetForexDefaultCandles = () => {
    handleApplyCandlePreset(CANDLE_PRESETS[0]);
  };

  const addedCount = [
    isAutoChannelsActive,
    isAutoSdcActive,
    isMAActive,
    isGTAActive,
    isTWBActive,
    isSMCActive,
    isSOActive,
    isFVGActive,
    isICTActive,
    isMStatActive,
    isMSSActive,
    isPRActive,
    isSRActive,
    isEchoActive,
    isMpro2Active,
    isHvnActive,
    isNexusActive,
    isSessionFilterActive,
    isObvActive,
    isProObActive,
    isMsttActive,
    isVipScannerActive,
    isDynamicTpSlActive,
    isTradePlannerActive,
    isFibSwingActive,
    isMtfEmaActive,
    isMrovTradeActive,
    isEma50100Active,
  ].filter(Boolean).length;
  const totalCount = Math.max(0, 28 - deletedSet.size);
  const notAddedCount = Math.max(0, totalCount - addedCount);

  React.useEffect(() => {
    if (isOpen) {
      if (effectiveMode === 'indicators') {
        setActiveTab('indicators');
        if (initialTab === 'all_indicators') {
          setIndicatorFilter('all');
        } else if ((initialTab as string) === 'not_added') {
          setIndicatorFilter('not_added');
        } else {
          setIndicatorFilter('added');
        }
      } else {
        if (initialTab === 'indicators' || initialTab === 'added_indicators' || initialTab === 'all_indicators') {
          setActiveTab('candles');
        } else if (initialTab) {
          setActiveTab(initialTab as any);
        } else {
          setActiveTab('candles');
        }
      }
    }
  }, [isOpen, initialTab, effectiveMode]);

  if (!isOpen) return null;

  const handleUpdateCandle = (key: keyof ChartSettings['candle'], value: string) => {
    onUpdateSettings({
      ...settings,
      candle: {
        ...settings.candle,
        [key]: value,
      },
    });
  };

  const handleUpdateAppearance = (key: keyof ChartSettings['appearance'], value: string) => {
    onUpdateSettings({
      ...settings,
      appearance: {
        ...settings.appearance,
        [key]: value,
      },
    });
  };

  const handleUpdateIndicators = (key: keyof ChartSettings['indicators'], value: any) => {
    onUpdateSettings({
      ...settings,
      indicators: {
        ...settings.indicators,
        [key]: value,
      },
    });
  };

  const handleUpdateMultipleIndicators = (updates: Partial<ChartSettings['indicators']>) => {
    onUpdateSettings({
      ...settings,
      indicators: {
        ...settings.indicators,
        ...updates,
      },
    });
  };

  const handleUpdateConnection = (key: keyof NonNullable<ChartSettings['connection']>, value: string) => {
    onUpdateSettings({
      ...settings,
      connection: {
        customServer: '',
        customAppId: '',
        ...settings.connection,
        [key]: value,
      },
    });
  };

  const handleApplyTheme = (preset: ThemePreset) => {
    onUpdateSettings({
      ...settings,
      theme: preset.id,
      appearance: {
        ...settings.appearance,
        backgroundColor: preset.backgroundColor,
        gridColor: preset.gridColor,
        crosshairColor: preset.crosshairColor,
      },
    });
  };

  const toggleTheme = () => {
    const isDark = isDarkTheme(settings.theme);
    const nextTheme: ChartThemeId = isDark ? 'offlight-white' : 'blue-dark';
    const preset = getThemePreset(nextTheme);

    onUpdateSettings({
      ...settings,
      theme: nextTheme,
      appearance: {
        ...settings.appearance,
        backgroundColor: preset.backgroundColor,
        gridColor: preset.gridColor,
        crosshairColor: preset.crosshairColor,
      },
    });
  };

  // Predefined color presets
  const colorPresets = [
    '#26a69a', // Emerald Green
    '#ef5350', // Bright Red
    '#2196f3', // Blue
    '#ff9800', // Orange
    '#9c27b0', // Purple
    '#ffffff', // White
    '#000000', // Dark Charcoal
    '#00e676', // Bright Green
    '#e91e63', // Pink
  ];

  const isDark = isDarkTheme(settings.theme);
  const preset = getThemePreset(settings.theme);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 select-none backdrop-blur-sm ${
      isDark ? 'bg-black/75' : 'bg-slate-900/40'
    }`}>
      <div 
        id="settings-modal"
        className={`w-full ${effectiveMode === 'indicators' || activeTab === 'admin' ? 'max-w-2xl' : 'max-w-lg'} rounded-xl shadow-2xl flex flex-col transition-all border ${
          isDark 
            ? 'bg-neutral-950 border-neutral-800 text-white' 
            : 'bg-white border-neutral-200 text-slate-900'
        }`}
        style={{
          backgroundColor: isDark ? preset.surfaceColor || '#0c0c0e' : '#ffffff',
          borderColor: isDark ? preset.borderColor : '#e2e8f0',
          color: isDark ? preset.textColor : '#0f172a',
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
          {effectiveMode === 'indicators' ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <span className="font-serif italic font-black text-base select-none">ƒx</span>
              </div>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Indicators &amp; Strategies
                </h3>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                  {addedCount} Added (Active) • {notAddedCount} Inactive
                </p>
              </div>
            </div>
          ) : (
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Settings className="w-5 h-5 text-blue-400" />
              Chart Settings &amp; Preferences
            </h3>
          )}
          <button 
            id="close-settings-modal"
            onClick={onClose} 
            className={`p-1 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-900 text-gray-400 hover:text-white' : 'hover:bg-neutral-100 text-slate-400 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        {effectiveMode === 'indicators' ? (
          <div className={`flex items-center justify-between border-b px-4 py-2 gap-2 flex-wrap ${
            isDark ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-neutral-100/70'
          }`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-settings-tab-added-indicators"
                onClick={() => {
                  setActiveTab('indicators');
                  setIndicatorFilter('added');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  indicatorFilter === 'added'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-neutral-900' : 'text-emerald-700 hover:text-emerald-800 hover:bg-neutral-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${indicatorFilter === 'added' ? 'bg-white' : 'bg-emerald-400 animate-pulse'}`} />
                <span>Added Indicators (ON)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  indicatorFilter === 'added' ? 'bg-black/30 text-white' : isDark ? 'bg-neutral-850 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {addedCount}
                </span>
              </button>

              <button
                type="button"
                id="btn-settings-tab-not-added-indicators"
                onClick={() => {
                  setActiveTab('indicators');
                  setIndicatorFilter('not_added');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  indicatorFilter === 'not_added'
                    ? 'bg-neutral-700 text-white shadow-md'
                    : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-900' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200'
                }`}
              >
                <span>Not Added (OFF)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  indicatorFilter === 'not_added' ? 'bg-black/30 text-white' : isDark ? 'bg-neutral-850 text-neutral-400' : 'bg-neutral-200 text-slate-600'
                }`}>
                  {notAddedCount}
                </span>
              </button>

              <button
                type="button"
                id="btn-settings-tab-all-indicators"
                onClick={() => {
                  setActiveTab('indicators');
                  setIndicatorFilter('all');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  indicatorFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-900' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200'
                }`}
              >
                <span>All Indicators</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  indicatorFilter === 'all' ? 'bg-black/30 text-white' : isDark ? 'bg-neutral-850 text-neutral-300' : 'bg-neutral-200 text-slate-700'
                }`}>
                  {totalCount}
                </span>
              </button>
            </div>

            <div className={`text-[11px] font-mono hidden sm:flex items-center gap-1.5 ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              <span className="text-emerald-500 font-bold">{addedCount}</span>
              <span>of</span>
              <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalCount}</span>
              <span>Active</span>
            </div>
          </div>
        ) : (
          <div className={`flex border-b px-4 py-1.5 gap-2 overflow-x-auto scrollbar-none ${
            isDark ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-neutral-100/70'
          }`}>
            <button
              id="btn-settings-tab-candles"
              onClick={() => setActiveTab('candles')}
              className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'candles' 
                  ? isDark ? 'bg-neutral-800 text-white' : 'bg-white text-slate-900 shadow-xs border border-neutral-200' 
                  : isDark ? 'text-gray-400 hover:text-white hover:bg-neutral-900/50' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200/60'
              }`}
            >
              Candles (OHLC)
            </button>
            <button
              id="btn-settings-tab-appearance"
              onClick={() => setActiveTab('appearance')}
              className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'appearance' 
                  ? isDark ? 'bg-neutral-800 text-white' : 'bg-white text-slate-900 shadow-xs border border-neutral-200' 
                  : isDark ? 'text-gray-400 hover:text-white hover:bg-neutral-900/50' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200/60'
              }`}
            >
              Canvas Styling
            </button>
            <button
              id="btn-settings-tab-connection"
              onClick={() => setActiveTab('connection')}
              className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all ${
                activeTab === 'connection' 
                  ? isDark ? 'bg-neutral-800 text-white' : 'bg-white text-slate-900 shadow-xs border border-neutral-200' 
                  : isDark ? 'text-gray-400 hover:text-white hover:bg-neutral-900/50' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200/60'
              }`}
            >
              Server &amp; Connection
            </button>
            <button
              id="btn-settings-tab-pwa"
              onClick={() => setActiveTab('pwa')}
              className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pwa' 
                  ? 'bg-sky-600 text-white font-bold shadow-md' 
                  : isDark ? 'text-sky-400 hover:text-sky-300 hover:bg-neutral-900/50' : 'text-sky-600 hover:text-sky-700 hover:bg-neutral-200/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Add to Home (PWA)</span>
            </button>
            <button
              id="btn-settings-tab-support"
              onClick={() => setActiveTab('support')}
              className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'support' 
                  ? 'bg-blue-600 text-white font-bold shadow-md' 
                  : isDark ? 'text-gray-400 hover:text-white hover:bg-neutral-900/50' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200/60'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              Support
            </button>
            <button
              id="btn-settings-tab-admin"
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'admin' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' 
                  : isDark ? 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/30' : 'text-amber-700 hover:text-amber-800 hover:bg-amber-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Admin Panel
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[55vh] overflow-y-auto">
          
          {/* TAB 1: CANDLES COLOR SELECTION */}
          {activeTab === 'candles' && (
            <div className="space-y-5">
              {/* Candlestick History Span Configuration */}
              <div className="p-4 bg-gradient-to-br from-blue-950/30 via-neutral-900 to-neutral-950 rounded-xl border border-blue-900/40 space-y-3 shadow-inner">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Candlestick History Horizon & Limit</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-600/50 rounded-full font-mono">
                          {settings.historySpan === 'all' ? 'Default (All)' : (settings.historySpan ? `${settings.historySpan} Limit` : 'Default (All)')}
                        </span>
                      </h4>
                      <p className="text-xs text-neutral-400">
                        Controls historical candle depth. Selecting a specific duration locks the boundary and strictly stops scrolling. Choose &quot;Default (All)&quot; for unlimited scroll.
                      </p>
                    </div>
                  </div>
                </div>

                {/* History Span Selector Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {HISTORY_SPANS.map((span) => {
                    const isSelected = (settings.historySpan || 'all') === span.id;
                    return (
                      <button
                        key={span.id}
                        id={`btn-history-span-${span.id}`}
                        type="button"
                        onClick={() => {
                          onUpdateSettings({
                            ...settings,
                            historySpan: span.id,
                          });
                        }}
                        className={`flex flex-col p-2.5 rounded-lg text-left transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                            : 'bg-neutral-950/60 hover:bg-neutral-900 border-neutral-850 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            <span>{span.label}</span>
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                        <span className="text-[10px] text-neutral-400 mt-1">{span.description}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Synchronization info banner */}
                <div className="flex items-start gap-2 p-2.5 bg-neutral-950/90 rounded-lg border border-neutral-800 text-[11px] text-neutral-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-neutral-100">Multi-Timeframe Duration Alignment:</strong> When a span is selected (e.g. 1 Month), the chart aligns and locks that exact historical range across all timeframes (1M, 5M, 15M, 30M, 1H). Scrolling back strictly stops at that limit unless <strong className="text-white">Default (All)</strong> is active.
                  </p>
                </div>
              </div>

              {/* Top Banner: Quick Reset to Original Forex Default Colors */}
              <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-neutral-950 rounded-xl border border-emerald-800/40 space-y-3.5 shadow-inner">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-emerald-600/20 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Original Forex Default Colors</span>
                        {isForexDefaultCandles ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-600/50 rounded-full flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3 text-emerald-400" /> Default Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/50 rounded-full font-mono">
                            Custom Colors
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        Standard Forex market scheme: Emerald Green (#089981) Bullish & Vivid Red (#f23645) Bearish
                      </p>
                    </div>
                  </div>

                  {/* Reset Button with Symbol */}
                  <button
                    id="btn-reset-forex-default-candles"
                    type="button"
                    onClick={handleResetForexDefaultCandles}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                      isForexDefaultCandles
                        ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-emerald-950/50 hover:scale-[1.02]'
                    }`}
                    title="Change all candle bodies, borders, and wicks back to original Forex default colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Forex Default</span>
                  </button>
                </div>

                {/* Live Candlestick Preview Box */}
                <div className="flex items-center justify-between p-3 bg-neutral-950/80 rounded-lg border border-neutral-850">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-neutral-300">Live OHLC Visual Preview</span>
                    <span className="text-[11px] text-neutral-500">Real-time preview of current body, border, and wick styles</span>
                  </div>

                  {/* Miniature Candle Graphic */}
                  <div className="flex items-center gap-6 px-4 py-1.5 bg-neutral-900 rounded-md border border-neutral-800">
                    {/* Bullish Mini Candle */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-[1.5px] h-2" style={{ backgroundColor: settings.candle.wickUpColor }} />
                      <div
                        className="w-3.5 h-6 rounded-[1px]"
                        style={{
                          backgroundColor: settings.candle.upColor,
                          border: `1.5px solid ${settings.candle.borderUpColor}`,
                        }}
                      />
                      <div className="w-[1.5px] h-2" style={{ backgroundColor: settings.candle.wickUpColor }} />
                      <span className="text-[9px] font-mono font-bold mt-1 text-emerald-400">BULL</span>
                    </div>

                    {/* Bearish Mini Candle */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-[1.5px] h-2" style={{ backgroundColor: settings.candle.wickDownColor }} />
                      <div
                        className="w-3.5 h-6 rounded-[1px]"
                        style={{
                          backgroundColor: settings.candle.downColor,
                          border: `1.5px solid ${settings.candle.borderDownColor}`,
                        }}
                      />
                      <div className="w-[1.5px] h-2" style={{ backgroundColor: settings.candle.wickDownColor }} />
                      <span className="text-[9px] font-mono font-bold mt-1 text-rose-400">BEAR</span>
                    </div>
                  </div>
                </div>

                {/* Quick Color Presets */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Quick Presets</span>
                    <span className="text-[10px] text-neutral-500">1-click popular color themes</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CANDLE_PRESETS.map((preset) => {
                      const isSelected =
                        settings.candle.upColor.toLowerCase() === preset.upColor.toLowerCase() &&
                        settings.candle.downColor.toLowerCase() === preset.downColor.toLowerCase();
                      return (
                        <button
                          key={preset.id}
                          id={`btn-candle-preset-${preset.id}`}
                          type="button"
                          onClick={() => handleApplyCandlePreset(preset)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-all text-left border cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-800 border-blue-500/80 text-white shadow-sm'
                              : 'bg-neutral-950/60 hover:bg-neutral-900 border-neutral-850 text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {/* Color Swatch Dots */}
                            <div className="flex items-center -space-x-1 shrink-0">
                              <span className="w-3 h-3 rounded-full border border-black/50" style={{ backgroundColor: preset.upColor }} />
                              <span className="w-3 h-3 rounded-full border border-black/50" style={{ backgroundColor: preset.downColor }} />
                            </div>
                            <span className="truncate text-[11px]">{preset.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Granular OHLC Color Adjustments */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Granular OHLC Customization</span>
                  <button
                    type="button"
                    onClick={handleResetForexDefaultCandles}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset All to Forex Default</span>
                  </button>
                </div>

                {/* 1. Body Colors */}
                <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Candlestick Bodies</span>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200">Bullish Body Color</span>
                      <span className="text-[11px] text-gray-500">Color for upward close &gt; open candles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="candle-up-color"
                        type="color"
                        value={settings.candle.upColor}
                        onChange={(e) => handleUpdateCandle('upColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                      />
                      <span className="text-xs font-mono text-gray-300 uppercase w-16 text-center">{settings.candle.upColor}</span>
                      {settings.candle.upColor.toLowerCase() !== FOREX_DEFAULT_CANDLES.upColor.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCandle('upColor', FOREX_DEFAULT_CANDLES.upColor)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-emerald-400 transition-colors"
                          title="Reset to Forex Default (#089981)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200">Bearish Body Color</span>
                      <span className="text-[11px] text-gray-500">Color for downward close &lt; open candles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="candle-down-color"
                        type="color"
                        value={settings.candle.downColor}
                        onChange={(e) => handleUpdateCandle('downColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                      />
                      <span className="text-xs font-mono text-gray-300 uppercase w-16 text-center">{settings.candle.downColor}</span>
                      {settings.candle.downColor.toLowerCase() !== FOREX_DEFAULT_CANDLES.downColor.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCandle('downColor', FOREX_DEFAULT_CANDLES.downColor)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-rose-400 transition-colors"
                          title="Reset to Forex Default (#f23645)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Border Colors */}
                <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Candlestick Borders</span>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200">Bullish Border Color</span>
                      <span className="text-[11px] text-gray-500">Outline border for bullish bars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="candle-border-up-color"
                        type="color"
                        value={settings.candle.borderUpColor}
                        onChange={(e) => handleUpdateCandle('borderUpColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                      />
                      <span className="text-xs font-mono text-gray-300 uppercase w-16 text-center">{settings.candle.borderUpColor}</span>
                      {settings.candle.borderUpColor.toLowerCase() !== FOREX_DEFAULT_CANDLES.borderUpColor.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCandle('borderUpColor', FOREX_DEFAULT_CANDLES.borderUpColor)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-emerald-400 transition-colors"
                          title="Reset to Forex Default (#089981)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200">Bearish Border Color</span>
                      <span className="text-[11px] text-gray-500">Outline border for bearish bars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="candle-border-down-color"
                        type="color"
                        value={settings.candle.borderDownColor}
                        onChange={(e) => handleUpdateCandle('borderDownColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                      />
                      <span className="text-xs font-mono text-gray-300 uppercase w-16 text-center">{settings.candle.borderDownColor}</span>
                      {settings.candle.borderDownColor.toLowerCase() !== FOREX_DEFAULT_CANDLES.borderDownColor.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCandle('borderDownColor', FOREX_DEFAULT_CANDLES.borderDownColor)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-rose-400 transition-colors"
                          title="Reset to Forex Default (#f23645)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Wick Colors */}
                <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Candlestick Wicks & Shadows</span>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200">Bullish Wick Color</span>
                      <span className="text-[11px] text-gray-500">High / low shadow line for bullish bars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="candle-wick-up-color"
                        type="color"
                        value={settings.candle.wickUpColor}
                        onChange={(e) => handleUpdateCandle('wickUpColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                      />
                      <span className="text-xs font-mono text-gray-300 uppercase w-16 text-center">{settings.candle.wickUpColor}</span>
                      {settings.candle.wickUpColor.toLowerCase() !== FOREX_DEFAULT_CANDLES.wickUpColor.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCandle('wickUpColor', FOREX_DEFAULT_CANDLES.wickUpColor)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-emerald-400 transition-colors"
                          title="Reset to Forex Default (#089981)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200">Bearish Wick Color</span>
                      <span className="text-[11px] text-gray-500">High / low shadow line for bearish bars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="candle-wick-down-color"
                        type="color"
                        value={settings.candle.wickDownColor}
                        onChange={(e) => handleUpdateCandle('wickDownColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                      />
                      <span className="text-xs font-mono text-gray-300 uppercase w-16 text-center">{settings.candle.wickDownColor}</span>
                      {settings.candle.wickDownColor.toLowerCase() !== FOREX_DEFAULT_CANDLES.wickDownColor.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCandle('wickDownColor', FOREX_DEFAULT_CANDLES.wickDownColor)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-rose-400 transition-colors"
                          title="Reset to Forex Default (#f23645)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE CUSTOMIZATION */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              {/* Theme quicktoggle & Header */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-900/90 rounded-xl border border-neutral-800">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-200">Active Theme</span>
                    <span className="text-xs font-bold text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                      {getThemePreset(settings.theme).name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 mt-0.5">Toggle light/dark or select a specialized trader palette below</span>
                </div>
                <button
                  id="btn-settings-toggle-theme"
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 text-blue-400 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-neutral-700"
                >
                  {isDarkTheme(settings.theme) ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-400" /> Off-Light White
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-blue-400" /> Dark Mode
                    </>
                  )}
                </button>
              </div>

              {/* Professional Themes Grid */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Professional Themes</span>
                  <span className="text-[11px] text-gray-400">Eye comfort & institutional setups</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {THEME_PRESETS.map((preset) => {
                    const isSelected = settings.theme === preset.id;
                    return (
                      <button
                        key={preset.id}
                        id={`btn-theme-preset-${preset.id}`}
                        type="button"
                        onClick={() => handleApplyTheme(preset)}
                        className={`flex flex-col p-3 rounded-xl text-left border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-neutral-800/90 border-blue-500 text-white shadow-md ring-1 ring-blue-500/40'
                            : 'bg-neutral-900/60 hover:bg-neutral-850/80 border-neutral-800 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div className="flex items-center gap-2">
                            {/* Color preview dots */}
                            <div className="flex items-center -space-x-1 shrink-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                                style={{ backgroundColor: preset.backgroundColor }}
                                title="Canvas Background"
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                                style={{ backgroundColor: preset.surfaceColor }}
                                title="Panel Surface"
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                                style={{ backgroundColor: preset.accentColor }}
                                title="Accent"
                              />
                            </div>
                            <span className="text-xs font-bold text-white tracking-wide">{preset.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {preset.badge && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                  isSelected
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                    : 'bg-neutral-800 text-neutral-400 border-neutral-700/60'
                                }`}
                              >
                                {preset.badge}
                              </span>
                            )}
                            {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                          </div>
                        </div>

                        <p className="text-[11px] text-neutral-400 leading-snug line-clamp-1">{preset.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Canvas & Grid Customization */}
              <div className="space-y-3 pt-2 border-t border-neutral-800">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Granular Appearance Options</span>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Grid Lines Type</span>
                  <select
                    id="settings-select-grid-type"
                    value={settings.appearance.gridType}
                    onChange={(e) => handleUpdateAppearance('gridType', e.target.value)}
                    className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-850 rounded text-xs focus:outline-none focus:border-blue-500 text-white"
                  >
                    <option value="both">Both Vertical & Horizontal</option>
                    <option value="horizontal">Horizontal Only</option>
                    <option value="vertical">Vertical Only</option>
                    <option value="none">No Grid Lines</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Grid Style</span>
                  <select
                    id="settings-select-grid-style"
                    value={settings.appearance.gridStyle}
                    onChange={(e) => handleUpdateAppearance('gridStyle', e.target.value as any)}
                    className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-850 rounded text-xs focus:outline-none focus:border-blue-500 text-white"
                  >
                    <option value="dashed">Dashed Lines</option>
                    <option value="solid">Solid Lines</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Crosshair Laser Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.appearance.crosshairColor}
                      onChange={(e) => handleUpdateAppearance('crosshairColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                    />
                    <span className="text-xs font-mono text-gray-400 uppercase">{settings.appearance.crosshairColor}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-300">Custom Canvas Background</span>
                    <span className="text-[11px] text-gray-500">Fine-tune chart background color</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.appearance.backgroundColor}
                      onChange={(e) => handleUpdateAppearance('backgroundColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                    />
                    <span className="text-xs font-mono text-gray-400 uppercase">{settings.appearance.backgroundColor}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-300">Grid Lines Color</span>
                    <span className="text-[11px] text-gray-500">Fine-tune grid lines tone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.appearance.gridColor}
                      onChange={(e) => handleUpdateAppearance('gridColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-neutral-700 bg-neutral-900"
                    />
                    <span className="text-xs font-mono text-gray-400 uppercase">{settings.appearance.gridColor}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FUTURE INDICATOR SETTINGS */}
          {activeTab === 'indicators' && (
            <div className="space-y-4">
              {/* TOP PRO / FREE SUITE CONTROLLER (Mpro2 · Master System · Nexus) */}
              <div className="p-4 bg-gradient-to-br from-neutral-900 via-neutral-900/95 to-neutral-950 border border-amber-500/35 rounded-xl space-y-3.5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-500" />

                {/* Top Row: Title + Status + PRO/FREE Switch */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          Mcharts PRO Suite
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          proMode === 'pro' && isProActivated
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}>
                          {proMode === 'pro' && isProActivated ? '👑 PRO ACTIVE' : 'FREE MODE'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Unified PRO Suite: Mpro · Mpro2 · Nexus Smart Money (All others are FREE)
                      </p>
                    </div>
                  </div>

                  {/* PRO / FREE Switch Buttons */}
                  <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                    <button
                      type="button"
                      id="btn-mode-free"
                      onClick={handleSwitchToFree}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        proMode === 'free'
                          ? 'bg-neutral-700 text-white shadow font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      FREE
                    </button>
                    <button
                      type="button"
                      id="btn-mode-pro"
                      onClick={handleSwitchToPro}
                      className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        proMode === 'pro'
                          ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-md'
                          : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <Crown className="w-3 h-3" />
                      <span>PRO</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Active Controls & Master Turn-All Switch */}
                  <div className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800 flex items-center justify-between flex-wrap gap-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        <span>PRO Suite Fully Unlocked</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Full institutional access to Mpro, Mpro2, Nexus Suite, and Order Blocks with Volume Delta.
                      </p>
                    </div>

                    {/* Master Switch to Turn ALL PRO ON or OFF together */}
                    <button
                      type="button"
                      id="btn-toggle-all-pro-suite"
                      onClick={() => {
                        const nextState = !(isSRActive && isMpro2Active && isNexusActive && isObvActive);
                        onUpdateSettings({
                          ...settings,
                          indicators: {
                            ...settings.indicators,
                            showSrClassification: nextState,
                            showEchoMpro: nextState,
                            showMpro2Signal: nextState,
                            showMasterDashboard: nextState,
                            showNexusSuite: nextState,
                            showOrderBlocksWithVolume: nextState,
                            showProOrderBlocks: nextState,
                          },
                        });
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow ${
                        (isSRActive && isMpro2Active && isNexusActive && isObvActive && isProObActive)
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{(isSRActive && isMpro2Active && isNexusActive && isObvActive && isProObActive) ? 'All PRO ON (Turn OFF All)' : '⚡ Turn ON All PRO Suite'}</span>
                    </button>
                  </div>

                    {/* Quick 5-Pack Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      {/* Mpro */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                        isSRActive
                          ? 'bg-neutral-900/90 border-emerald-500/40'
                          : 'bg-neutral-950/60 border-neutral-800'
                      }`}>
                        <div className="text-left">
                          <div className="text-xs font-bold text-white">Mpro Signals</div>
                          <div className="text-[10px] text-neutral-400">Market Structure &amp; R:R</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSRActive}
                            onChange={(e) => {
                              handleUpdateIndicators('showSrClassification', e.target.checked);
                              handleUpdateIndicators('showEchoMpro', e.target.checked);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Mpro2 */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                        isMpro2Active
                          ? 'bg-neutral-900/90 border-emerald-500/40'
                          : 'bg-neutral-950/60 border-neutral-800'
                      }`}>
                        <div className="text-left">
                          <div className="text-xs font-bold text-white">Mpro2 Signal</div>
                          <div className="text-[10px] text-neutral-400">Trend &amp; Fib Levels</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isMpro2Active}
                            onChange={(e) => handleUpdateIndicators('showMpro2Signal', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Nexus Suite */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                        isNexusActive
                          ? 'bg-neutral-900/90 border-emerald-500/40'
                          : 'bg-neutral-950/60 border-neutral-800'
                      }`}>
                        <div className="text-left">
                          <div className="text-xs font-bold text-white">Nexus Suite</div>
                          <div className="text-[10px] text-neutral-400">Smart Money Engine</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isNexusActive}
                            onChange={(e) => handleUpdateIndicators('showNexusSuite', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Order Blocks with Volume Delta (cTrader) */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                        isObvActive
                          ? 'bg-neutral-900/90 border-emerald-500/40'
                          : 'bg-neutral-950/60 border-neutral-800'
                      }`}>
                        <div className="text-left">
                          <div className="text-xs font-bold text-white">Order Blocks Vol</div>
                          <div className="text-[10px] text-neutral-400">cTrader Volume Delta</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isObvActive}
                            onChange={(e) => handleUpdateIndicators('showOrderBlocksWithVolume', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* PRO Order Blocks (Live & Shadow) */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                        isProObActive
                          ? 'bg-neutral-900/90 border-emerald-500/40'
                          : 'bg-neutral-950/60 border-neutral-800'
                      }`}>
                        <div className="text-left">
                          <div className="text-xs font-bold text-white">PRO Order Blocks</div>
                          <div className="text-[10px] text-neutral-400">Live 8-Score &amp; Shadow</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isProObActive}
                            onChange={(e) => handleUpdateIndicators('showProOrderBlocks', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                {proCodeSuccess && (
                  <div className="p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{proCodeSuccess}</span>
                  </div>
                )}
              </div>
              {/* Added vs All Filter Bar (Only shown if opened from full settings, since indicators mode has top filter bar) */}
              {effectiveMode !== 'indicators' && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-neutral-900 border border-neutral-850 rounded-xl">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-filter-added-indicators"
                      onClick={() => setIndicatorFilter('added')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                        indicatorFilter === 'added'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-emerald-400 hover:text-emerald-300 hover:bg-neutral-800/80'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${indicatorFilter === 'added' ? 'bg-white' : 'bg-emerald-400 animate-pulse'}`} />
                      <span>Added Indicators (ON)</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        indicatorFilter === 'added' ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-emerald-400'
                      }`}>
                        {addedCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-filter-all-indicators"
                      onClick={() => setIndicatorFilter('all')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                        indicatorFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80'
                      }`}
                    >
                      <span>All Indicators</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        indicatorFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {totalCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-filter-not-added-indicators"
                      onClick={() => setIndicatorFilter('not_added')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                        indicatorFilter === 'not_added'
                          ? 'bg-neutral-700 text-white shadow'
                          : 'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/60'
                      }`}
                    >
                      <span>OFF ({notAddedCount})</span>
                    </button>
                  </div>

                  <div className="text-[11px] font-medium text-neutral-400 pr-1 hidden sm:flex items-center gap-1.5 font-mono">
                    <span className="text-emerald-400 font-bold">{addedCount}</span>
                    <span>of</span>
                    <span className="text-white font-bold">{totalCount}</span>
                    <span>Active</span>
                  </div>
                </div>
              )}

              {indicatorFilter === 'added' ? (
                <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/30 text-xs text-emerald-300 rounded-lg flex items-center justify-between">
                  <span>Showing only active (ON) indicators added to your chart ({addedCount} active).</span>
                  <button
                    type="button"
                    onClick={() => setIndicatorFilter('all')}
                    className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                  >
                    View All ({totalCount})
                  </button>
                </div>
              ) : indicatorFilter === 'not_added' ? (
                <div className="p-2.5 bg-neutral-900 border border-neutral-850 text-xs text-neutral-400 rounded-lg flex items-center justify-between">
                  <span>Showing indicators currently turned OFF ({notAddedCount} inactive).</span>
                  <button
                    type="button"
                    onClick={() => setIndicatorFilter('added')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                  >
                    View Added ({addedCount})
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-blue-950/20 border border-blue-900/30 text-xs text-blue-300 rounded-lg flex items-center justify-between">
                  <span>Showing all {totalCount} platform indicators. Toggle switches to add or remove indicators.</span>
                  <button
                    type="button"
                    onClick={() => setIndicatorFilter('added')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                  >
                    View Added Only ({addedCount})
                  </button>
                </div>
              )}

              {/* Empty state when Added Indicators filter is active but none are ON */}
              {indicatorFilter === 'added' && addedCount === 0 && (
                <div className="p-8 text-center bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-neutral-800/80 flex items-center justify-center text-neutral-400">
                    <Sparkles className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="text-sm font-semibold text-neutral-200">No Indicators Currently Added</div>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    All indicators are currently turned OFF. Switch to the <strong>All Indicators</strong> view to activate indicators for your chart.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIndicatorFilter('all')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
                  >
                    Browse All Indicators ({totalCount})
                  </button>
                </div>
              )}

              {/* Indicator 1: Auto Price Channels (4H) */}
              {!isIndicatorDeleted('auto_price_channels') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isAutoChannelsActive) || (indicatorFilter === 'not_added' && !isAutoChannelsActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-200">Auto Price Channels (4H)</span>
                        <span className="text-[10px] bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded font-mono font-normal">Strict 4H TF</span>
                        {isAutoChannelsActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Auto detects price channels, trend direction & breakouts (Only active on 4H)</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-auto-price-channels"
                        type="checkbox"
                        checked={isAutoChannelsActive}
                        onChange={(e) => handleUpdateIndicators('showAutoPriceChannels', e.target.checked)}
                        className="w-4 h-4 text-sky-600 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'auto_price_channels', name: 'Auto Price Channels (4H)' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isAutoChannelsActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-sky-800/50 pt-1">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Channel Line Color</span>
                        <input
                          id="settings-color-channels"
                          type="color"
                          value={settings.indicators.autoPriceChannelsColor ?? '#38bdf8'}
                          onChange={(e) => handleUpdateIndicators('autoPriceChannelsColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Line Thickness (px)</span>
                        <input
                          id="settings-width-channels"
                          type="number"
                          min={1}
                          max={6}
                          value={settings.indicators.autoPriceChannelsLineWidth ?? 2}
                          onChange={(e) => handleUpdateIndicators('autoPriceChannelsLineWidth', parseInt(e.target.value) || 2)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-sky-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Breakout Signals</span>
                          <span className="text-xs text-gray-500">Marks channel breakout points on candle closes</span>
                        </div>
                        <input
                          id="settings-toggle-channel-breakouts"
                          type="checkbox"
                          checked={settings.indicators.autoPriceChannelsShowBreakouts ?? true}
                          onChange={(e) => handleUpdateIndicators('autoPriceChannelsShowBreakouts', e.target.checked)}
                          className="w-4 h-4 text-sky-600 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 1B: Institutional Auto Supply/Demand Order Blocks & Parallel Channel */}
              {!isIndicatorDeleted('auto_sdc') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isAutoSdcActive) || (indicatorFilter === 'not_added' && !isAutoSdcActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-200">Auto Supply & Demand + Parallel Channel</span>
                        <span className="text-[10px] bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded font-mono font-normal">SMC & Channel</span>
                        {isAutoSdcActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Auto detects Cyan/Blue Supply-Demand zones, Sloped Parallel Trend Channels & Right-Side Projection Blocks</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-auto-sdc"
                        type="checkbox"
                        checked={isAutoSdcActive}
                        onChange={(e) => handleUpdateIndicators('showAutoSupplyDemandChannel', e.target.checked)}
                        className="w-4 h-4 text-sky-600 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'auto_sdc', name: 'Auto Supply & Demand + Parallel Channel' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isAutoSdcActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-sky-800/50 pt-1">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Theme Color</span>
                        <input
                          id="settings-color-sdc"
                          type="color"
                          value={settings.indicators.autoSdcColor ?? '#0ea5e9'}
                          onChange={(e) => handleUpdateIndicators('autoSdcColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Supply & Demand Bands</span>
                        <input
                          id="settings-toggle-sdc-zones"
                          type="checkbox"
                          checked={settings.indicators.autoSdcShowSupplyDemand ?? true}
                          onChange={(e) => handleUpdateIndicators('autoSdcShowSupplyDemand', e.target.checked)}
                          className="w-4 h-4 text-sky-600 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Parallel Trend Channel</span>
                        <input
                          id="settings-toggle-sdc-channel"
                          type="checkbox"
                          checked={settings.indicators.autoSdcShowChannel ?? true}
                          onChange={(e) => handleUpdateIndicators('autoSdcShowChannel', e.target.checked)}
                          className="w-4 h-4 text-sky-600 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Right-Hand Projection Gaps</span>
                        <input
                          id="settings-toggle-sdc-fvg"
                          type="checkbox"
                          checked={settings.indicators.autoSdcShowFVGProjections ?? true}
                          onChange={(e) => handleUpdateIndicators('autoSdcShowFVGProjections', e.target.checked)}
                          className="w-4 h-4 text-sky-600 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {(settings.indicators.autoSdcShowFVGProjections ?? true) && (
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <div className="flex items-center justify-between p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                              <span className="text-xs font-medium text-gray-300">Buy FVG</span>
                            </div>
                            <input
                              id="settings-color-sdc-fvg-buy"
                              type="color"
                              value={settings.indicators.autoSdcFvgBuyColor || '#10b981'}
                              onChange={(e) => handleUpdateIndicators('autoSdcFvgBuyColor', e.target.value)}
                              className="w-8 h-6 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                              <span className="text-xs font-medium text-gray-300">Sell FVG</span>
                            </div>
                            <input
                              id="settings-color-sdc-fvg-sell"
                              type="color"
                              value={settings.indicators.autoSdcFvgSellColor || '#f43f5e'}
                              onChange={(e) => handleUpdateIndicators('autoSdcFvgSellColor', e.target.value)}
                              className="w-8 h-6 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 2: Simple Moving Average (SMA) */}
              {!isIndicatorDeleted('ma') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMAActive) || (indicatorFilter === 'not_added' && !isMAActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-200">Simple Moving Average (SMA)</span>
                        {isMAActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Calculates and renders an SMA line on chart candles</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-ma"
                        type="checkbox"
                        checked={isMAActive}
                        onChange={(e) => handleUpdateIndicators('showMA', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'ma', name: 'Simple Moving Average (SMA)' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isMAActive && (
                    <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                      <span className="text-sm font-medium text-gray-300">SMA Period (Length)</span>
                      <input
                        id="settings-input-ma-period"
                        type="number"
                        min={2}
                        max={500}
                        value={settings.indicators.maPeriod}
                        onChange={(e) => handleUpdateIndicators('maPeriod', parseInt(e.target.value) || 20)}
                        className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 3: Grand Trend Alignment (GTA) Filter */}
              {!isIndicatorDeleted('gta') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isGTAActive) || (indicatorFilter === 'not_added' && !isGTAActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-200">Grand Trend Alignment (GTA) Filter</span>
                        {isGTAActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Triple-smoothed EMA momentum overlay (Green/Red/Neutral States)</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-gta"
                        type="checkbox"
                        checked={isGTAActive}
                        onChange={(e) => handleUpdateIndicators('showGTA', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'gta', name: 'Grand Trend Alignment (GTA) Filter' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isGTAActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-neutral-800 pt-1">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Short Period (Velocity)</span>
                        <input
                          id="settings-input-gta-short"
                          type="number"
                          min={1}
                          max={100}
                          value={settings.indicators.gtaShortPeriod}
                          onChange={(e) => handleUpdateIndicators('gtaShortPeriod', parseInt(e.target.value) || 6)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Medium Period (Baseline)</span>
                        <input
                          id="settings-input-gta-mid"
                          type="number"
                          min={1}
                          max={200}
                          value={settings.indicators.gtaMidPeriod}
                          onChange={(e) => handleUpdateIndicators('gtaMidPeriod', parseInt(e.target.value) || 13)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Long Period (Anchor)</span>
                        <input
                          id="settings-input-gta-long"
                          type="number"
                          min={1}
                          max={500}
                          value={settings.indicators.gtaLongPeriod}
                          onChange={(e) => handleUpdateIndicators('gtaLongPeriod', parseInt(e.target.value) || 21)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Arrow Placement Offset</span>
                          <span className="text-xs text-gray-500">Spacing height multiplier</span>
                        </div>
                        <input
                          id="settings-input-gta-offset"
                          type="number"
                          step={0.01}
                          min={0.01}
                          max={0.5}
                          value={settings.indicators.gtaArrowOffset}
                          onChange={(e) => handleUpdateIndicators('gtaArrowOffset', parseFloat(e.target.value) || 0.10)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show GTA EMAs on Chart</span>
                          <span className="text-xs text-gray-500">Render the three underlying EMA lines</span>
                        </div>
                        <input
                          id="settings-toggle-gta-emas"
                          type="checkbox"
                          checked={settings.indicators.showGTAEMAs}
                          onChange={(e) => handleUpdateIndicators('showGTAEMAs', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show GTA Buy/Sell Arrows</span>
                          <span className="text-xs text-gray-500">Render trend signal arrows on chart</span>
                        </div>
                        <input
                          id="settings-toggle-gta-arrows"
                          type="checkbox"
                          checked={settings.indicators.gtaShowArrows ?? true}
                          onChange={(e) => handleUpdateIndicators('gtaShowArrows', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">GTA Candle Color Changes</span>
                          <span className="text-xs text-gray-500">Color candles based on GTA trend direction</span>
                        </div>
                        <input
                          id="settings-toggle-gta-color-candles"
                          type="checkbox"
                          checked={settings.indicators.gtaColorCandles ?? true}
                          onChange={(e) => handleUpdateIndicators('gtaColorCandles', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-neutral-900 my-2" />

              {/* Indicator 4: LuxAlgo Trendlines with Breaks */}
              {!isIndicatorDeleted('twb') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isTWBActive) || (indicatorFilter === 'not_added' && !isTWBActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-200">LuxAlgo Trendlines with Breaks</span>
                        {isTWBActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Pivots and slope-calculated breakout signals</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-twb"
                        type="checkbox"
                        checked={isTWBActive}
                        onChange={(e) => handleUpdateIndicators('showTrendlinesWithBreaks', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'twb', name: 'LuxAlgo Trendlines with Breaks' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isTWBActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-neutral-800 pt-1">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Pivot Lookback Period (Length)</span>
                        <input
                          id="settings-input-twb-length"
                          type="number"
                          min={2}
                          max={100}
                          value={settings.indicators.twbLength}
                          onChange={(e) => handleUpdateIndicators('twbLength', parseInt(e.target.value) || 14)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Slope Multiplier</span>
                        <input
                          id="settings-input-twb-slope"
                          type="number"
                          step={0.1}
                          min={0.1}
                          max={10}
                          value={settings.indicators.twbSlopeMultiplier}
                          onChange={(e) => handleUpdateIndicators('twbSlopeMultiplier', parseFloat(e.target.value) || 1.6)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Slope Calculation Method</span>
                        <select
                          id="settings-select-twb-method"
                          value={settings.indicators.twbSlopeMethod}
                          onChange={(e) => handleUpdateIndicators('twbSlopeMethod', e.target.value)}
                          className="w-28 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        >
                          <option value="atr">ATR</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Breakout Signals</span>
                          <span className="text-xs text-gray-500">Draw "B" arrows on the chart upon breakout</span>
                        </div>
                        <input
                          id="settings-toggle-twb-signals"
                          type="checkbox"
                          checked={settings.indicators.twbShowSignals ?? true}
                          onChange={(e) => handleUpdateIndicators('twbShowSignals', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 5: Smart Money Concepts (SMC) */}
              {!isIndicatorDeleted('smc') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isSMCActive) || (indicatorFilter === 'not_added' && !isSMCActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-200">Smart Money Concepts (SMC)</span>
                        {isSMCActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">BOS, CHoCH structural breaks & Order Blocks (Live Candles, No Noise)</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-smc"
                        type="checkbox"
                        checked={isSMCActive}
                        onChange={(e) => handleUpdateIndicators('showSmartMoneyConcepts', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'smc', name: 'Smart Money Concepts (SMC)' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isSMCActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-neutral-800 pt-1">
                      {/* Swing Lookback Period with 720, 168, 24 Quick Presets */}
                      <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Swing Lookback Period</span>
                            <span className="text-xs text-gray-500">720 (Monthly OBs) • 168 (Weekly OBs) • 24 (Daily OBs) • 5 (Intraday)</span>
                          </div>
                          <input
                            id="settings-input-smc-lookback"
                            type="number"
                            min={2}
                            max={5000}
                            value={settings.indicators.smcSwingLookback ?? 5}
                            onChange={(e) => handleUpdateIndicators('smcSwingLookback', parseInt(e.target.value) || 5)}
                            className="w-24 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono font-bold"
                          />
                        </div>
                        {/* Quick Presets for Lookback */}
                        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleUpdateIndicators('smcSwingLookback', 720)}
                            className={
                              settings.indicators.smcSwingLookback === 720
                                ? 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-cyan-600 text-white border border-cyan-400 shadow-sm'
                                : 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-neutral-950 text-neutral-300 border border-neutral-800 hover:bg-neutral-800'
                            }
                          >
                            720 (Monthly)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateIndicators('smcSwingLookback', 168)}
                            className={
                              settings.indicators.smcSwingLookback === 168
                                ? 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-blue-600 text-white border border-blue-400 shadow-sm'
                                : 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-neutral-950 text-neutral-300 border border-neutral-800 hover:bg-neutral-800'
                            }
                          >
                            168 (Weekly)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateIndicators('smcSwingLookback', 24)}
                            className={
                              settings.indicators.smcSwingLookback === 24
                                ? 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-purple-600 text-white border border-purple-400 shadow-sm'
                                : 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-neutral-950 text-neutral-300 border border-neutral-800 hover:bg-neutral-800'
                            }
                          >
                            24 (Daily)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateIndicators('smcSwingLookback', 5)}
                            className={
                              settings.indicators.smcSwingLookback === 5
                                ? 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-emerald-600 text-white border border-emerald-400 shadow-sm'
                                : 'px-2.5 py-1 text-xs font-mono font-semibold rounded bg-neutral-950 text-neutral-300 border border-neutral-800 hover:bg-neutral-800'
                            }
                          >
                            5 (Intraday)
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Structure Line Style</span>
                          <span className="text-xs text-gray-500">Style for CHoCH & BOS market structure lines</span>
                        </div>
                        <select
                          id="settings-select-smc-structure-line-style"
                          value={settings.indicators.smcStructureLineStyle ?? 'dotted'}
                          onChange={(e) => handleUpdateIndicators('smcStructureLineStyle', e.target.value as 'dashed' | 'solid' | 'dotted')}
                          className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                        >
                          <option value="dotted">Dotted Lines</option>
                          <option value="dashed">Dashed Lines</option>
                          <option value="solid">Solid Lines</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Break of Structure (BOS)</span>
                        <input
                          id="settings-toggle-smc-bos"
                          type="checkbox"
                          checked={settings.indicators.smcShowBOS}
                          onChange={(e) => handleUpdateIndicators('smcShowBOS', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Change of Character (CHoCH)</span>
                        <input
                          id="settings-toggle-smc-choch"
                          type="checkbox"
                          checked={settings.indicators.smcShowCHoCH}
                          onChange={(e) => handleUpdateIndicators('smcShowCHoCH', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Order Blocks (OB)</span>
                          <span className="text-xs text-gray-500">Price ካለፈ በኃላ አይወጣም (Only active unmitigated OBs show)</span>
                        </div>
                        <input
                          id="settings-toggle-smc-ob"
                          type="checkbox"
                          checked={settings.indicators.smcShowOrderBlocks}
                          onChange={(e) => handleUpdateIndicators('smcShowOrderBlocks', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {settings.indicators.smcShowOrderBlocks && (
                        <div className="space-y-3 pl-3 border-l-2 border-neutral-800 ml-2">
                          <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-300">Order Blocks Filter Mode</span>
                              <span className="text-xs text-gray-500">Strong Order Blocks (Breakout origin) vs All Blocks</span>
                            </div>
                            <select
                              id="settings-select-smc-ob-mode"
                              value={settings.indicators.smcObMode ?? 'strong'}
                              onChange={(e) => handleUpdateIndicators('smcObMode', e.target.value as 'strong' | 'all')}
                              className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                            >
                              <option value="strong">Strong Blocks Only</option>
                              <option value="all">All Order Blocks</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-sm font-medium text-gray-300">Max Order Blocks Count</span>
                            <input
                              id="settings-input-smc-oblimit"
                              type="number"
                              min={1}
                              max={20}
                              value={settings.indicators.smcObLimit}
                              onChange={(e) => handleUpdateIndicators('smcObLimit', parseInt(e.target.value) || 5)}
                              className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-300">Order Blocks Shades Visibility</span>
                              <span className="text-xs text-gray-500">Shade opacity intensity for Supply & Demand zones</span>
                            </div>
                            <select
                              id="settings-select-smc-ob-shades"
                              value={settings.indicators.smcObOpacityMultiplier ?? 2}
                              onChange={(e) => handleUpdateIndicators('smcObOpacityMultiplier', parseFloat(e.target.value) as 1 | 2 | 2.5)}
                              className="px-3 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer font-mono"
                            >
                              <option value={1}>1x (Normal Shade)</option>
                              <option value={2}>2x (Vivid Shade)</option>
                              <option value={2.5}>2.5x (High Visibility)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Multi-Instance SMC: Add indicator multiple times with different lookbacks/settings */}
                      <div className="pt-3 border-t border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-xs font-semibold text-gray-200">Multi-Instance SMC Layers</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                                {settings.indicators.smcInstances?.length || 0} Layers
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400">
                              አንዱን SMC indicator በተደጋጋሚ በተለያየ Lookback (720, 168, 24, 5) እና Timeframe Add ያድርጉ
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const currentInstances = settings.indicators.smcInstances || [];
                              const newId = `smc-${Date.now()}`;
                              const presetCount = currentInstances.length;
                              // Smart default rotation: 720 Monthly, 168 Weekly, 24 Daily, 5 Intraday
                              const presets = [
                                { name: 'SMC #1 (720 Monthly)', lookback: 720, tag: '720M', color: '#06b6d4' },
                                { name: 'SMC #2 (168 Weekly)', lookback: 168, tag: '168W', color: '#3b82f6' },
                                { name: 'SMC #3 (24 Daily)', lookback: 24, tag: '24D', color: '#a855f7' },
                                { name: 'SMC #4 (5 Intraday)', lookback: 5, tag: '5H', color: '#10b981' },
                              ];
                              const p = presets[presetCount % presets.length];
                              const newInstance: SMCInstanceConfig = {
                                id: newId,
                                name: p.name,
                                enabled: true,
                                timeframe: 'chart',
                                historyCandlesLimit: p.lookback,
                                swingLookback: p.lookback,
                                showBOS: true,
                                showCHoCH: true,
                                showOrderBlocks: true,
                                obMode: 'strong',
                                obLimit: 5,
                                obOpacityMultiplier: 2,
                                structureLineStyle: 'dotted',
                                bullishColor: '#10b981',
                                bearishColor: '#ef4444',
                                tagBadge: p.tag,
                              };
                              handleUpdateIndicators('smcInstances', [...currentInstances, newInstance]);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Another SMC</span>
                          </button>
                        </div>

                        {/* List of active SMC instances */}
                        {settings.indicators.smcInstances && settings.indicators.smcInstances.length > 0 && (
                          <div className="space-y-2.5">
                            {settings.indicators.smcInstances.map((inst, idx) => (
                              <div
                                key={inst.id}
                                className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800 space-y-2.5 transition-all"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={inst.enabled}
                                      onChange={(e) => {
                                        const updated = (settings.indicators.smcInstances || []).map((item) =>
                                          item.id === inst.id ? { ...item, enabled: e.target.checked } : item
                                        );
                                        handleUpdateIndicators('smcInstances', updated);
                                      }}
                                      className="w-4 h-4 text-cyan-600 bg-neutral-900 rounded border-neutral-700 cursor-pointer"
                                    />
                                    <input
                                      type="text"
                                      value={inst.name}
                                      onChange={(e) => {
                                        const updated = (settings.indicators.smcInstances || []).map((item) =>
                                          item.id === inst.id ? { ...item, name: e.target.value } : item
                                        );
                                        handleUpdateIndicators('smcInstances', updated);
                                      }}
                                      className="bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-cyan-500 text-xs font-semibold text-white px-1 py-0.5 outline-none font-mono"
                                    />
                                    {inst.tagBadge && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                                        {inst.tagBadge}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filtered = (settings.indicators.smcInstances || []).filter(
                                          (item) => item.id !== inst.id
                                        );
                                        handleUpdateIndicators('smcInstances', filtered);
                                      }}
                                      className="p-1 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                                      title="Remove this SMC instance"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {inst.enabled && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-neutral-850">
                                    {/* Lookback input & quick presets */}
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-medium text-neutral-400 uppercase">Lookback Candles</span>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min={2}
                                          max={5000}
                                          value={inst.swingLookback}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 5;
                                            const updated = (settings.indicators.smcInstances || []).map((item) =>
                                              item.id === inst.id ? { ...item, swingLookback: val, historyCandlesLimit: val } : item
                                            );
                                            handleUpdateIndicators('smcInstances', updated);
                                          }}
                                          className="w-16 px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono font-bold"
                                        />
                                        <div className="flex gap-1">
                                          {[720, 168, 24, 5].map((presetLb) => (
                                            <button
                                              key={presetLb}
                                              type="button"
                                              onClick={() => {
                                                const updated = (settings.indicators.smcInstances || []).map((item) =>
                                                  item.id === inst.id
                                                    ? {
                                                        ...item,
                                                        swingLookback: presetLb,
                                                        historyCandlesLimit: presetLb,
                                                        tagBadge: presetLb === 720 ? '720M' : presetLb === 168 ? '168W' : presetLb === 24 ? '24D' : '5H',
                                                      }
                                                    : item
                                                );
                                                handleUpdateIndicators('smcInstances', updated);
                                              }}
                                              className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                                                inst.swingLookback === presetLb
                                                  ? 'bg-cyan-600 text-white font-bold'
                                                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
                                              }`}
                                            >
                                              {presetLb}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    {/* OB Limit & Mode */}
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-medium text-neutral-400 uppercase">OBs Limit & Mode</span>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min={1}
                                          max={20}
                                          value={inst.obLimit}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 5;
                                            const updated = (settings.indicators.smcInstances || []).map((item) =>
                                              item.id === inst.id ? { ...item, obLimit: val } : item
                                            );
                                            handleUpdateIndicators('smcInstances', updated);
                                          }}
                                          className="w-12 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                                        />
                                        <select
                                          value={inst.obMode || 'strong'}
                                          onChange={(e) => {
                                            const updated = (settings.indicators.smcInstances || []).map((item) =>
                                              item.id === inst.id ? { ...item, obMode: e.target.value as any } : item
                                            );
                                            handleUpdateIndicators('smcInstances', updated);
                                          }}
                                          className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-white outline-none cursor-pointer"
                                        >
                                          <option value="strong">Strong Only</option>
                                          <option value="all">All Blocks</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* Toggle OB, BOS, CHoCH */}
                                    <div className="flex items-center gap-3 pt-3">
                                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-neutral-300">
                                        <input
                                          type="checkbox"
                                          checked={inst.showOrderBlocks}
                                          onChange={(e) => {
                                            const updated = (settings.indicators.smcInstances || []).map((item) =>
                                              item.id === inst.id ? { ...item, showOrderBlocks: e.target.checked } : item
                                            );
                                            handleUpdateIndicators('smcInstances', updated);
                                          }}
                                          className="w-3 h-3 text-cyan-600 rounded"
                                        />
                                        <span>OB</span>
                                      </label>
                                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-neutral-300">
                                        <input
                                          type="checkbox"
                                          checked={inst.showBOS}
                                          onChange={(e) => {
                                            const updated = (settings.indicators.smcInstances || []).map((item) =>
                                              item.id === inst.id ? { ...item, showBOS: e.target.checked } : item
                                            );
                                            handleUpdateIndicators('smcInstances', updated);
                                          }}
                                          className="w-3 h-3 text-cyan-600 rounded"
                                        />
                                        <span>BOS</span>
                                      </label>
                                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-neutral-300">
                                        <input
                                          type="checkbox"
                                          checked={inst.showCHoCH}
                                          onChange={(e) => {
                                            const updated = (settings.indicators.smcInstances || []).map((item) =>
                                              item.id === inst.id ? { ...item, showCHoCH: e.target.checked } : item
                                            );
                                            handleUpdateIndicators('smcInstances', updated);
                                          }}
                                          className="w-3 h-3 text-cyan-600 rounded"
                                        />
                                        <span>CHoCH</span>
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 6: LuxAlgo® - Signals & Overlays™ */}
              {!isIndicatorDeleted('so') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isSOActive) || (indicatorFilter === 'not_added' && !isSOActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-200">LuxAlgo® - Signals & Overlays™</span>
                        {isSOActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Flagship trend tracker ribbon & buy/sell signals</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-so"
                        type="checkbox"
                        checked={isSOActive}
                        onChange={(e) => handleUpdateIndicators('showSignalsAndOverlays', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'so', name: 'LuxAlgo® - Signals & Overlays™' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isSOActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-neutral-800 pt-1">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Signal Mode</span>
                        <select
                          id="settings-select-so-mode"
                          value={settings.indicators.soSignalMode}
                          onChange={(e) => handleUpdateIndicators('soSignalMode', e.target.value as any)}
                          className="w-32 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        >
                          <option value="confirmation">Confirmation</option>
                          <option value="contrarian">Contrarian</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Sensitivity</span>
                          <span className="text-xs text-gray-500">Lower = more signals, Higher = slower</span>
                        </div>
                        <input
                          id="settings-input-so-sensitivity"
                          type="number"
                          min={1}
                          max={50}
                          value={settings.indicators.soSensitivity}
                          onChange={(e) => handleUpdateIndicators('soSensitivity', parseInt(e.target.value) || 12)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Trend Ribbon</span>
                        <input
                          id="settings-toggle-so-ribbon"
                          type="checkbox"
                          checked={settings.indicators.soShowRibbon}
                          onChange={(e) => handleUpdateIndicators('soShowRibbon', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Exit Signals</span>
                        <input
                          id="settings-toggle-so-exits"
                          type="checkbox"
                          checked={settings.indicators.soShowExitSignals}
                          onChange={(e) => handleUpdateIndicators('soShowExitSignals', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Strong Signals</span>
                        <input
                          id="settings-toggle-so-strong"
                          type="checkbox"
                          checked={settings.indicators.soShowStrongSignals}
                          onChange={(e) => handleUpdateIndicators('soShowStrongSignals', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Show Signal Arrows (Buy / Sell)</span>
                        <input
                          id="settings-toggle-so-arrows"
                          type="checkbox"
                          checked={settings.indicators.soShowSignalArrows ?? true}
                          onChange={(e) => handleUpdateIndicators('soShowSignalArrows', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confluence FVG Finder | ProjectSyndicate */}
              {!isIndicatorDeleted('fvg') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isFVGActive) || (indicatorFilter === 'not_added' && !isFVGActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-200">Confluence FVG Finder | ProjectSyndicate</span>
                      <span className="text-xs text-gray-500">LuxAlgo style multi-timeframe confluence zones</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-fvg"
                        type="checkbox"
                        checked={settings.indicators.showConfluenceFVG}
                        onChange={(e) => handleUpdateIndicators('showConfluenceFVG', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'fvg', name: 'Confluence FVG Finder' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {settings.indicators.showConfluenceFVG && (
                <div className="space-y-3.5 pl-3 border-l-2 border-neutral-800">
                  {/* Multi-Timeframes Selectors */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">TF 1 (Anchor)</span>
                      <select
                        id="settings-select-fvg-tf1"
                        value={settings.indicators.fvgTf1}
                        onChange={(e) => handleUpdateIndicators('fvgTf1', e.target.value)}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none"
                      >
                        <option value="1M">1M</option>
                        <option value="2M">2M</option>
                        <option value="5M">5M</option>
                        <option value="15M">15M</option>
                        <option value="30M">30M</option>
                        <option value="1H">1H</option>
                        <option value="4H">4H</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">TF 2</span>
                      <select
                        id="settings-select-fvg-tf2"
                        value={settings.indicators.fvgTf2}
                        onChange={(e) => handleUpdateIndicators('fvgTf2', e.target.value)}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none"
                      >
                        <option value="1M">1M</option>
                        <option value="2M">2M</option>
                        <option value="5M">5M</option>
                        <option value="15M">15M</option>
                        <option value="30M">30M</option>
                        <option value="1H">1H</option>
                        <option value="4H">4H</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">TF 3</span>
                      <select
                        id="settings-select-fvg-tf3"
                        value={settings.indicators.fvgTf3}
                        onChange={(e) => handleUpdateIndicators('fvgTf3', e.target.value)}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none"
                      >
                        <option value="1M">1M</option>
                        <option value="2M">2M</option>
                        <option value="5M">5M</option>
                        <option value="15M">15M</option>
                        <option value="30M">30M</option>
                        <option value="1H">1H</option>
                        <option value="4H">4H</option>
                      </select>
                    </div>
                  </div>

                  {/* Display Mode & Color Controls */}
                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-300">FVG Display Style</span>
                      <span className="text-xs text-gray-500">Render as bold line level or rectangle zone</span>
                    </div>
                    <select
                      id="settings-select-fvg-displaymode"
                      value={settings.indicators.fvgDisplayMode ?? 'Line'}
                      onChange={(e) => handleUpdateIndicators('fvgDisplayMode', e.target.value as any)}
                      className="w-36 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Line">Bold Line</option>
                      <option value="Zone">Rectangle Zone</option>
                    </select>
                  </div>

                  {/* FVG Custom Colors */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-300">Bullish Color</span>
                      <input
                        id="settings-color-fvg-bullish"
                        type="color"
                        value={settings.indicators.fvgBullishColor || '#089981'}
                        onChange={(e) => {
                          handleUpdateIndicators('fvgBullishColor', e.target.value);
                          handleUpdateIndicators('fvgBullishBorderColor', e.target.value);
                        }}
                        className="w-8 h-8 rounded border border-neutral-700 bg-neutral-950 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-300">Bearish Color</span>
                      <input
                        id="settings-color-fvg-bearish"
                        type="color"
                        value={settings.indicators.fvgBearishColor || '#f23645'}
                        onChange={(e) => {
                          handleUpdateIndicators('fvgBearishColor', e.target.value);
                          handleUpdateIndicators('fvgBearishBorderColor', e.target.value);
                        }}
                        className="w-8 h-8 rounded border border-neutral-700 bg-neutral-950 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <span className="text-sm font-medium text-gray-300">Line / Border Thickness</span>
                    <input
                      id="settings-input-fvg-width"
                      type="number"
                      min={1}
                      max={10}
                      value={settings.indicators.fvgBorderWidth ?? 2}
                      onChange={(e) => handleUpdateIndicators('fvgBorderWidth', parseInt(e.target.value) || 2)}
                      className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                    />
                  </div>

                  {/* General Config */}
                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <span className="text-sm font-medium text-gray-300">Show Bullish Zones</span>
                    <input
                      id="settings-toggle-fvg-bullish"
                      type="checkbox"
                      checked={settings.indicators.fvgShowBullish}
                      onChange={(e) => handleUpdateIndicators('fvgShowBullish', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <span className="text-sm font-medium text-gray-300">Show Bearish Zones</span>
                    <input
                      id="settings-toggle-fvg-bearish"
                      type="checkbox"
                      checked={settings.indicators.fvgShowBearish}
                      onChange={(e) => handleUpdateIndicators('fvgShowBearish', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                    />
                  </div>

                  {/* Limits and Filters */}
                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-300">Max Zones Per Direction</span>
                      <span className="text-xs text-gray-500">Cap maximum displayed boxes</span>
                    </div>
                    <input
                      id="settings-input-fvg-max"
                      type="number"
                      min={1}
                      max={50}
                      value={settings.indicators.fvgMaxZones}
                      onChange={(e) => handleUpdateIndicators('fvgMaxZones', parseInt(e.target.value) || 8)}
                      className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-300">Minimum Confluence Count</span>
                      <span className="text-xs text-gray-500">Require matching levels across TFs (1-3)</span>
                    </div>
                    <input
                      id="settings-input-fvg-confluence"
                      type="number"
                      min={1}
                      max={3}
                      value={settings.indicators.fvgMinConfluence}
                      onChange={(e) => handleUpdateIndicators('fvgMinConfluence', parseInt(e.target.value) || 2)}
                      className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-300">Proximity ATR Mult</span>
                      <span className="text-xs text-gray-500">Confluence grouping proximity multiplier</span>
                    </div>
                    <input
                      id="settings-input-fvg-proximity"
                      type="number"
                      step={0.1}
                      min={0.5}
                      max={15}
                      value={settings.indicators.fvgProximityAtrMult}
                      onChange={(e) => handleUpdateIndicators('fvgProximityAtrMult', parseFloat(e.target.value) || 5.0)}
                      className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-300">Strength Rating Rating</span>
                      <span className="text-xs text-gray-500">Enable score filters on gaps</span>
                    </div>
                    <input
                      id="settings-toggle-fvg-rating"
                      type="checkbox"
                      checked={settings.indicators.fvgEnableStrengthRating}
                      onChange={(e) => handleUpdateIndicators('fvgEnableStrengthRating', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                    />
                  </div>

                  {settings.indicators.fvgEnableStrengthRating && (
                    <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850 ml-3 border-l-2 border-neutral-800">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-300">Min Strength Score Filter</span>
                        <span className="text-xs text-gray-500">Only show zones scored above threshold</span>
                      </div>
                      <input
                        id="settings-input-fvg-minstrength"
                        type="number"
                        step={0.1}
                        min={0.1}
                        max={10}
                        value={settings.indicators.fvgMinStrengthFilter}
                        onChange={(e) => handleUpdateIndicators('fvgMinStrengthFilter', parseFloat(e.target.value) || 3.0)}
                        className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                      />
                    </div>
                  )}

                  {/* Mitigation Settings */}
                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <span className="text-sm font-medium text-gray-300">Mitigation Type</span>
                    <select
                      id="settings-select-fvg-mitigation"
                      value={settings.indicators.fvgMitigationType}
                      onChange={(e) => handleUpdateIndicators('fvgMitigationType', e.target.value)}
                      className="w-28 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none"
                    >
                      <option value="Touch">Touch</option>
                      <option value="Full Fill">Full Fill</option>
                      <option value="50% Fill">50% Fill</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <span className="text-sm font-medium text-gray-300">Show Mitigated FVG Zones</span>
                    <input
                      id="settings-toggle-fvg-mitigated"
                      type="checkbox"
                      checked={settings.indicators.fvgShowMitigated}
                      onChange={(e) => handleUpdateIndicators('fvgShowMitigated', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                    />
                  </div>

                  {/* Normalization Settings */}
                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-300">Normalize Zone Heights</span>
                      <span className="text-xs text-gray-500">Unifies zone block sizes symmetrically</span>
                    </div>
                    <input
                      id="settings-toggle-fvg-normalize"
                      type="checkbox"
                      checked={settings.indicators.fvgUseNormalizedZones}
                      onChange={(e) => handleUpdateIndicators('fvgUseNormalizedZones', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                    />
                  </div>

                  {settings.indicators.fvgUseNormalizedZones && (
                    <div className="space-y-3 pl-3 border-l-2 border-neutral-800 ml-3">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Height Method</span>
                        <select
                          id="settings-select-fvg-hm"
                          value={settings.indicators.fvgZoneHeightMethod}
                          onChange={(e) => handleUpdateIndicators('fvgZoneHeightMethod', e.target.value)}
                          className="w-32 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none"
                        >
                          <option value="ATR Based">ATR Based</option>
                          <option value="Fixed Percentage">Fixed %</option>
                        </select>
                      </div>

                      {settings.indicators.fvgZoneHeightMethod === 'ATR Based' ? (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-sm font-medium text-gray-300">Height ATR Mult</span>
                          <input
                            id="settings-input-fvg-height-atr"
                            type="number"
                            step={0.05}
                            min={0.1}
                            max={3.0}
                            value={settings.indicators.fvgZoneHeightAtrMult}
                            onChange={(e) => handleUpdateIndicators('fvgZoneHeightAtrMult', parseFloat(e.target.value) || 0.75)}
                            className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none text-center font-mono"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-sm font-medium text-gray-300">Height % of Price</span>
                          <input
                            id="settings-input-fvg-height-pct"
                            type="number"
                            step={0.05}
                            min={0.05}
                            max={2.0}
                            value={settings.indicators.fvgZoneHeightPercent}
                            onChange={(e) => handleUpdateIndicators('fvgZoneHeightPercent', parseFloat(e.target.value) || 0.3)}
                            className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none text-center font-mono"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Texts in Zone with ON/OFF (As requested) */}
                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-300">Show Texts in Zone</span>
                      <span className="text-xs text-gray-500">Render indicators info metrics inside FVG block</span>
                    </div>
                    <input
                      id="settings-toggle-fvg-info"
                      type="checkbox"
                      checked={settings.indicators.fvgShowInfo}
                      onChange={(e) => handleUpdateIndicators('fvgShowInfo', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                    />
                  </div>

                  {settings.indicators.fvgShowInfo && (
                    <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850 ml-3 border-l-2 border-neutral-800">
                      <span className="text-sm font-medium text-gray-300">Info Text Size</span>
                      <select
                        id="settings-select-fvg-size"
                        value={settings.indicators.fvgInfoTextSize}
                        onChange={(e) => handleUpdateIndicators('fvgInfoTextSize', e.target.value)}
                        className="w-28 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none"
                      >
                        <option value="Tiny">Tiny</option>
                        <option value="Small">Small</option>
                        <option value="Normal">Normal</option>
                        <option value="Large">Large</option>
                        <option value="Huge">Huge</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <span className="text-sm font-medium text-gray-300">Show Bull/Bear Simple Labels</span>
                    <input
                      id="settings-toggle-fvg-labels"
                      type="checkbox"
                      checked={settings.indicators.fvgShowLabels}
                      onChange={(e) => handleUpdateIndicators('fvgShowLabels', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-neutral-900 my-2" />

              {/* Pure Price Action Liquidity Sweeps [LuxAlgo] */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-200">Pure Price Action Liquidity Sweeps [LuxAlgo]</span>
                  <span className="text-xs text-gray-500">Detects multi-level liquidity sweeps with level origin lines and sweep zones</span>
                </div>
                <input
                  id="settings-toggle-pure-liquidity-sweeps"
                  type="checkbox"
                  checked={settings.indicators.showPureLiquiditySweeps ?? true}
                  onChange={(e) => handleUpdateIndicators('showPureLiquiditySweeps', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                />
              </div>

              {(settings.indicators.showPureLiquiditySweeps ?? true) && (
                <div className="space-y-3 pl-3 border-l-2 border-emerald-500/40 bg-neutral-900/30 p-3 rounded-r-lg border border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Detection Level</span>
                    <select
                      id="settings-select-pure-liquidity-detection"
                      value={settings.indicators.pureLiquidityDetection ?? 'Long Term'}
                      onChange={(e) => handleUpdateIndicators('pureLiquidityDetection', e.target.value)}
                      className="w-40 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none"
                    >
                      <option value="Short Term">Short Term (1)</option>
                      <option value="Intermediate Term">Intermediate Term (2)</option>
                      <option value="Long Term">Long Term (3)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-neutral-800/80 pt-3">
                    <div className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800">
                      <span className="text-xs font-medium text-gray-300">Bullish Level</span>
                      <input
                        type="color"
                        value={settings.indicators.pureLiquidityBullishColor ?? '#089981'}
                        onChange={(e) => handleUpdateIndicators('pureLiquidityBullishColor', e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800">
                      <span className="text-xs font-medium text-gray-300">Bullish Sweep Box</span>
                      <input
                        type="color"
                        value={settings.indicators.pureLiquidityBullishSweepColor ?? '#08998180'}
                        onChange={(e) => handleUpdateIndicators('pureLiquidityBullishSweepColor', e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800">
                      <span className="text-xs font-medium text-gray-300">Bearish Level</span>
                      <input
                        type="color"
                        value={settings.indicators.pureLiquidityBearishColor ?? '#f23645'}
                        onChange={(e) => handleUpdateIndicators('pureLiquidityBearishColor', e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800">
                      <span className="text-xs font-medium text-gray-300">Bearish Sweep Box</span>
                      <input
                        type="color"
                        value={settings.indicators.pureLiquidityBearishSweepColor ?? '#f2364580'}
                        onChange={(e) => handleUpdateIndicators('pureLiquidityBearishSweepColor', e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
                </div>
              )}

              {/* Market Structure Signals | ProjectSyndicate */}
              {!isIndicatorDeleted('mss') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMSSActive) || (indicatorFilter === 'not_added' && !isMSSActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-200">Market Structure Signals | ProjectSyndicate</span>
                      <span className="text-xs text-gray-500">Non-repainting BOS/CHoCH breakouts, ADR10 targets (TP1/TP2/SL) & SMC Dashboard</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-mss"
                        type="checkbox"
                        checked={settings.indicators.showMarketStructureSignals ?? true}
                        onChange={(e) => handleUpdateIndicators('showMarketStructureSignals', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'mss', name: 'Market Structure Signals' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {(settings.indicators.showMarketStructureSignals ?? true) && (
                <div className="space-y-4 pl-3 border-l-2 border-neutral-800 my-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">Lookback Period</span>
                      <input
                        id="settings-input-mss-length"
                        type="number"
                        min={5}
                        max={100}
                        value={settings.indicators.mssSwingLength ?? 25}
                        onChange={(e) => handleUpdateIndicators('mssSwingLength', parseInt(e.target.value) || 25)}
                        className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">BOS Confirmation</span>
                      <select
                        id="settings-select-mss-bos-confirmation"
                        value={settings.indicators.mssBosConfirmation ?? 'Close'}
                        onChange={(e) => handleUpdateIndicators('mssBosConfirmation', e.target.value as 'Close' | 'Wick')}
                        className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-medium cursor-pointer"
                      >
                        <option value="Close">Close</option>
                        <option value="Wick">Wick</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">Show CHoCH Labels</span>
                      <input
                        id="settings-toggle-mss-choch"
                        type="checkbox"
                        checked={settings.indicators.mssShowCHoCH ?? true}
                        onChange={(e) => handleUpdateIndicators('mssShowCHoCH', e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">Dashboard Text Size</span>
                      <select
                        id="settings-select-mss-dash-size"
                        value={settings.indicators.mssDashboardTextSize ?? 'Normal'}
                        onChange={(e) => handleUpdateIndicators('mssDashboardTextSize', e.target.value as any)}
                        className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-medium cursor-pointer"
                      >
                        <option value="Tiny">Tiny</option>
                        <option value="Small">Small</option>
                        <option value="Normal">Normal</option>
                        <option value="Large">Large</option>
                        <option value="Huge">Huge</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">TP1 % of ADR10</span>
                      <input
                        id="settings-input-mss-tp1"
                        type="number"
                        min={1}
                        step={1}
                        value={settings.indicators.mssTp1Percent ?? 20.0}
                        onChange={(e) => handleUpdateIndicators('mssTp1Percent', parseFloat(e.target.value) || 20.0)}
                        className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">TP2 % of ADR10</span>
                      <input
                        id="settings-input-mss-tp2"
                        type="number"
                        min={1}
                        step={1}
                        value={settings.indicators.mssTp2Percent ?? 30.0}
                        onChange={(e) => handleUpdateIndicators('mssTp2Percent', parseFloat(e.target.value) || 30.0)}
                        className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">SL % of ADR10</span>
                      <input
                        id="settings-input-mss-sl"
                        type="number"
                        min={1}
                        step={1}
                        value={settings.indicators.mssSlPercent ?? 20.0}
                        onChange={(e) => handleUpdateIndicators('mssSlPercent', parseFloat(e.target.value) || 20.0)}
                        className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">Bullish / Bearish Colors</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={settings.indicators.mssColorBullish ?? '#21c997'}
                          onChange={(e) => handleUpdateIndicators('mssColorBullish', e.target.value)}
                          className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                        />
                        <input
                          type="color"
                          value={settings.indicators.mssColorBearish ?? '#cc24e2'}
                          onChange={(e) => handleUpdateIndicators('mssColorBearish', e.target.value)}
                          className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <span className="text-xs text-neutral-300">TP1 / TP2 / SL Colors</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={settings.indicators.mssColorTP1 ?? '#26a69a'}
                          onChange={(e) => handleUpdateIndicators('mssColorTP1', e.target.value)}
                          className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                        />
                        <input
                          type="color"
                          value={settings.indicators.mssColorTP2 ?? '#00897b'}
                          onChange={(e) => handleUpdateIndicators('mssColorTP2', e.target.value)}
                          className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                        />
                        <input
                          type="color"
                          value={settings.indicators.mssColorSL ?? '#b71c1c'}
                          onChange={(e) => handleUpdateIndicators('mssColorSL', e.target.value)}
                          className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900 col-span-1 md:col-span-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Send Signals to Telegram Channel
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Automatically broadcasts buy/sell signals with exact SL & TP1/TP2 targets to your Telegram channel (-1004295328271)
                        </span>
                      </div>
                      <input
                        id="settings-toggle-mss-telegram"
                        type="checkbox"
                        checked={settings.indicators.mssSendTelegramSignals ?? false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            if (isVerifiedDevice) {
                              handleUpdateIndicators('mssSendTelegramSignals', true);
                            } else {
                              setShowTgPasscodeModal(true);
                              setTgPasscodeError('');
                              setTgPasscodeInput('');
                            }
                          } else {
                            handleUpdateIndicators('mssSendTelegramSignals', false);
                          }
                        }}
                        className="w-4 h-4 text-emerald-500 bg-neutral-800 rounded border-neutral-700 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Passcode Verification Modal */}
              {showTgPasscodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs">
                  <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-lg w-full max-w-sm space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Verify Device Passcode
                      </h3>
                      <button
                        onClick={() => setShowTgPasscodeModal(false)}
                        className="text-gray-400 hover:text-white text-xs cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-gray-300">
                      Enter the owner passcode to pair and authorize this device/browser for automated Telegram signal broadcasting:
                    </p>

                    <div>
                      <input
                        type="password"
                        placeholder="Enter Passcode..."
                        value={tgPasscodeInput}
                        onChange={(e) => {
                          setTgPasscodeInput(e.target.value);
                          setTgPasscodeError('');
                        }}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      {tgPasscodeError && (
                        <p className="text-[11px] text-red-400 mt-1">{tgPasscodeError}</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowTgPasscodeModal(false)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-xs text-gray-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={isTgVerifying}
                        onClick={async () => {
                          setIsTgVerifying(true);
                          try {
                            const res = await fetch('/api/telegram', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'verify_passcode',
                                passcode: tgPasscodeInput,
                              }),
                            });
                            const data = await res.json();
                            if (data.verified) {
                              localStorage.setItem('tg_signals_device_verified', 'true');
                              handleUpdateIndicators('mssSendTelegramSignals', true);
                              setShowTgPasscodeModal(false);
                            } else {
                              setTgPasscodeError('Incorrect passcode. Access denied.');
                            }
                          } catch (err: any) {
                            setTgPasscodeError('Verification failed. Try again.');
                          } finally {
                            setIsTgVerifying(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white font-medium flex items-center gap-1 cursor-pointer"
                      >
                        {isTgVerifying ? 'Verifying...' : 'Authorize Device'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
                </div>
              )}

              {/* ICT Concepts (LuxAlgo) | ProjectSyndicate */}
              {!isIndicatorDeleted('ict') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isICTActive) || (indicatorFilter === 'not_added' && !isICTActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-200">Smart Money & ICT Concepts (LuxAlgo) | ProjectSyndicate</span>
                      <span className="text-xs text-gray-500">Premium market structure, order blocks, liquidities, volume imbalances, & FVG</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-ict-concepts"
                        type="checkbox"
                        checked={settings.indicators.showIctConcepts}
                        onChange={(e) => handleUpdateIndicators('showIctConcepts', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'ict', name: 'Smart Money & ICT Concepts (LuxAlgo)' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {settings.indicators.showIctConcepts && (
                <div className="space-y-4 pl-3 border-l-2 border-neutral-800">
                  
                  {/* Mode & Universal Settings */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Universal Settings</span>
                    
                    <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                      <span className="text-sm font-medium text-gray-300">Analysis Mode</span>
                      <select
                        id="settings-select-ict-mode"
                        value={settings.indicators.ictMode}
                        onChange={(e) => handleUpdateIndicators('ictMode', e.target.value)}
                        className="w-32 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none"
                      >
                        <option value="Present">Present (500 Bars)</option>
                        <option value="Historical">Historical (Full)</option>
                      </select>
                    </div>
                  </div>

                  {/* Market Structure (MSS & BOS) */}
                  <div className="space-y-2 border-t border-neutral-900 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Market Structure (MSS & BOS)</span>
                      <input
                        id="settings-toggle-ict-ms"
                        type="checkbox"
                        checked={settings.indicators.ictShowMarketStructure}
                        onChange={(e) => handleUpdateIndicators('ictShowMarketStructure', e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500"
                      />
                    </div>

                    {settings.indicators.ictShowMarketStructure && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-2.5">
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Swing Point Length</span>
                          <input
                            id="settings-input-ict-ms-length"
                            type="number"
                            min={2}
                            max={50}
                            value={settings.indicators.ictMsLength}
                            onChange={(e) => handleUpdateIndicators('ictMsLength', parseInt(e.target.value) || 8)}
                            className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900 col-span-1 md:col-span-2">
                          <span className="text-xs font-semibold text-neutral-200">Structure Line Style</span>
                          <select
                            id="settings-select-ict-structure-line-style"
                            value={settings.indicators.ictStructureLineStyle ?? 'dashed'}
                            onChange={(e) => handleUpdateIndicators('ictStructureLineStyle', e.target.value as 'dashed' | 'solid' | 'dotted')}
                            className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                          >
                            <option value="dashed">Dashed Lines</option>
                            <option value="dotted">Dotted Lines</option>
                            <option value="solid">Solid Lines</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Shift Label Naming</span>
                          <select
                            id="settings-select-ict-structure-label-mode"
                            value={settings.indicators.ictStructureLabelMode ?? 'CHoCH'}
                            onChange={(e) => handleUpdateIndicators('ictStructureLabelMode', e.target.value as 'CHoCH' | 'MSS')}
                            className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-medium cursor-pointer"
                          >
                            <option value="CHoCH">CHoCH</option>
                            <option value="MSS">MSS</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Show CHoCH / MSS</span>
                          <input
                            id="settings-toggle-ict-mss"
                            type="checkbox"
                            checked={settings.indicators.ictShowMSS}
                            onChange={(e) => handleUpdateIndicators('ictShowMSS', e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Show Break of Structure (BOS)</span>
                          <input
                            id="settings-toggle-ict-bos"
                            type="checkbox"
                            checked={settings.indicators.ictShowBOS}
                            onChange={(e) => handleUpdateIndicators('ictShowBOS', e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">CHoCH/MSS Colors</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="settings-color-ict-mss-bull"
                              type="color"
                              value={settings.indicators.ictMssColorBullish}
                              onChange={(e) => handleUpdateIndicators('ictMssColorBullish', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                            <input
                              id="settings-color-ict-mss-bear"
                              type="color"
                              value={settings.indicators.ictMssColorBearish}
                              onChange={(e) => handleUpdateIndicators('ictMssColorBearish', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">BOS Bull/Bear Colors</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="settings-color-ict-bos-bull"
                              type="color"
                              value={settings.indicators.ictBosColorBullish}
                              onChange={(e) => handleUpdateIndicators('ictBosColorBullish', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                            <input
                              id="settings-color-ict-bos-bear"
                              type="color"
                              value={settings.indicators.ictBosColorBearish}
                              onChange={(e) => handleUpdateIndicators('ictBosColorBearish', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Blocks (OB) */}
                  <div className="space-y-2 border-t border-neutral-900 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Order Blocks (OB)</span>
                      <input
                        id="settings-toggle-ict-ob"
                        type="checkbox"
                        checked={settings.indicators.ictShowOrderBlocks}
                        onChange={(e) => handleUpdateIndicators('ictShowOrderBlocks', e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                      />
                    </div>

                    {settings.indicators.ictShowOrderBlocks && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-2.5">
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900 col-span-1 md:col-span-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-neutral-200">Order Blocks Filter Mode</span>
                            <span className="text-[10px] text-neutral-500">Strong Order Blocks (CHoCH origin / Expansion) vs All Blocks</span>
                          </div>
                          <select
                            id="settings-select-ict-ob-mode"
                            value={settings.indicators.ictObMode ?? 'strong'}
                            onChange={(e) => handleUpdateIndicators('ictObMode', e.target.value as 'strong' | 'all')}
                            className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                          >
                            <option value="strong">Strong Blocks Only</option>
                            <option value="all">All Order Blocks</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Lookback Period</span>
                          <input
                            id="settings-input-ict-ob-lookback"
                            type="number"
                            min={1}
                            max={20}
                            value={settings.indicators.ictObLookback}
                            onChange={(e) => handleUpdateIndicators('ictObLookback', parseInt(e.target.value) || 5)}
                            className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Max Rendered Blocks</span>
                          <input
                            id="settings-input-ict-ob-max"
                            type="number"
                            min={1}
                            max={20}
                            value={settings.indicators.ictObMaxCount}
                            onChange={(e) => handleUpdateIndicators('ictObMaxCount', parseInt(e.target.value) || 5)}
                            className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Bull/Bear Colors</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="settings-color-ict-ob-bull"
                              type="color"
                              value={settings.indicators.ictObBullishColor}
                              onChange={(e) => handleUpdateIndicators('ictObBullishColor', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                            <input
                              id="settings-color-ict-ob-bear"
                              type="color"
                              value={settings.indicators.ictObBearishColor}
                              onChange={(e) => handleUpdateIndicators('ictObBearishColor', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Liquidity (BSL & SSL) */}
                  <div className="space-y-2 border-t border-neutral-900 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Buyside & Sellside Liquidity</span>
                      <input
                        id="settings-toggle-ict-liq"
                        type="checkbox"
                        checked={settings.indicators.ictShowLiquidity}
                        onChange={(e) => handleUpdateIndicators('ictShowLiquidity', e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                      />
                    </div>

                    {settings.indicators.ictShowLiquidity && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-2.5">
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900 col-span-1 md:col-span-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-neutral-200">Liquidity Zones Filter Mode</span>
                            <span className="text-[10px] text-neutral-500">Strong Zones (Equal Highs/Lows & Major Swings) vs All Zones</span>
                          </div>
                          <select
                            id="settings-select-ict-liq-mode"
                            value={settings.indicators.ictLiqMode ?? 'strong'}
                            onChange={(e) => handleUpdateIndicators('ictLiqMode', e.target.value as 'strong' | 'all')}
                            className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                          >
                            <option value="strong">Strong Zones Only</option>
                            <option value="all">All Zones</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Sensitivity Multiplier</span>
                          <input
                            id="settings-input-ict-liq-sens"
                            type="number"
                            step={0.1}
                            min={0.5}
                            max={10}
                            value={settings.indicators.ictLiqSensitivity}
                            onChange={(e) => handleUpdateIndicators('ictLiqSensitivity', parseFloat(e.target.value) || 2.3)}
                            className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Max Visibility Cap</span>
                          <input
                            id="settings-input-ict-liq-max"
                            type="number"
                            min={5}
                            max={100}
                            value={settings.indicators.ictLiqMaxBoxes}
                            onChange={(e) => handleUpdateIndicators('ictLiqMaxBoxes', parseInt(e.target.value) || 50)}
                            className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">SSL (Bullish) / BSL (Bearish) Colors</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="settings-color-ict-liq-bull"
                              type="color"
                              value={settings.indicators.ictLiqBullishColor}
                              onChange={(e) => handleUpdateIndicators('ictLiqBullishColor', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                            <input
                              id="settings-color-ict-liq-bear"
                              type="color"
                              value={settings.indicators.ictLiqBearishColor}
                              onChange={(e) => handleUpdateIndicators('ictLiqBearishColor', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Volume Imbalances */}
                  <div className="space-y-2 border-t border-neutral-900 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Volume Imbalances</span>
                      <input
                        id="settings-toggle-ict-vi"
                        type="checkbox"
                        checked={settings.indicators.ictShowVolumeImbalance}
                        onChange={(e) => handleUpdateIndicators('ictShowVolumeImbalance', e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                      />
                    </div>

                    {settings.indicators.ictShowVolumeImbalance && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-2.5">
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Max Boxes Limit</span>
                          <input
                            id="settings-input-ict-vi-max"
                            type="number"
                            min={5}
                            max={200}
                            value={settings.indicators.ictViMaxBoxes}
                            onChange={(e) => handleUpdateIndicators('ictViMaxBoxes', parseInt(e.target.value) || 100)}
                            className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                          <span className="text-xs text-neutral-400">Bull/Bear Colors</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="settings-color-ict-vi-bull"
                              type="color"
                              value={settings.indicators.ictViBullishColor}
                              onChange={(e) => handleUpdateIndicators('ictViBullishColor', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                            <input
                              id="settings-color-ict-vi-bear"
                              type="color"
                              value={settings.indicators.ictViBearishColor}
                              onChange={(e) => handleUpdateIndicators('ictViBearishColor', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FVG, IFVG, & BPR */}
                  <div className="space-y-2 border-t border-neutral-900 pt-3">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Imbalances (FVG, IFVG & BPR)</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-2.5">
                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-xs text-neutral-400">Imbalance Option</span>
                        <select
                          id="settings-select-ict-fvg-opt"
                          value={settings.indicators.ictFvgOption}
                          onChange={(e) => handleUpdateIndicators('ictFvgOption', e.target.value)}
                          className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white"
                        >
                          <option value="FVG">Standard FVG</option>
                          <option value="IFVG">Inverted FVG (IFVG)</option>
                          <option value="NONE">None</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-xs text-neutral-400">Max Boxes Count</span>
                        <input
                          id="settings-input-ict-fvg-max"
                          type="number"
                          min={5}
                          max={100}
                          value={settings.indicators.ictFvgMaxCount}
                          onChange={(e) => handleUpdateIndicators('ictFvgMaxCount', parseInt(e.target.value) || 20)}
                          className="w-16 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-xs text-neutral-400">Show Bullish FVG</span>
                        <input
                          id="settings-toggle-ict-fvg-bullish"
                          type="checkbox"
                          checked={settings.indicators.ictFvgShowBullish}
                          onChange={(e) => handleUpdateIndicators('ictFvgShowBullish', e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-xs text-neutral-400">Show Bearish FVG</span>
                        <input
                          id="settings-toggle-ict-fvg-bearish"
                          type="checkbox"
                          checked={settings.indicators.ictFvgShowBearish}
                          onChange={(e) => handleUpdateIndicators('ictFvgShowBearish', e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-xs text-neutral-400">Balanced Price Range (BPR)</span>
                        <input
                          id="settings-toggle-ict-fvg-bpr"
                          type="checkbox"
                          checked={settings.indicators.ictFvgBalancePriceRange}
                          onChange={(e) => handleUpdateIndicators('ictFvgBalancePriceRange', e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-xs text-neutral-400">Bull/Bear Colors</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            id="settings-color-ict-fvg-bull"
                            type="color"
                            value={settings.indicators.ictFvgBullishColor}
                            onChange={(e) => handleUpdateIndicators('ictFvgBullishColor', e.target.value)}
                            className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                          />
                          <input
                            id="settings-color-ict-fvg-bear"
                            type="color"
                            value={settings.indicators.ictFvgBearishColor}
                            onChange={(e) => handleUpdateIndicators('ictFvgBearishColor', e.target.value)}
                            className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Displacement Highlight */}
                  <div className="space-y-2 border-t border-neutral-900 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Highlight Displacement</span>
                      <input
                        id="settings-toggle-ict-disp"
                        type="checkbox"
                        checked={settings.indicators.ictShowDisplacement}
                        onChange={(e) => handleUpdateIndicators('ictShowDisplacement', e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-neutral-800 rounded border-neutral-700"
                      />
                    </div>
                  </div>

                </div>
              )}
                </div>
              )}

            {/* 9. ZEIIERMAN MARKET STRUCTURE & PRICE ACTION TOOLKIT */}
            {!isIndicatorDeleted('mstat') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMStatActive) || (indicatorFilter === 'not_added' && !isMStatActive)) && (
              <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>Market Structure & Price Action Toolkit</span>
                      <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono font-bold">Zeiierman</span>
                    </h4>
                    <p className="text-xs text-neutral-400">Zeiierman Real-Time Fractal Order Block & Support/Resistance Grid Zones</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      id="settings-toggle-mstat"
                      type="checkbox"
                      checked={isMStatActive}
                      onChange={(e) => handleUpdateIndicators('showMarketStructureToolkit', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIndicatorToDelete({ id: 'mstat', name: 'Market Structure & Price Action Toolkit (Zeiierman)' })}
                      title="Permanently delete indicator from platform code & settings"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Permanently Delete</span>
                    </button>
                  </div>
                </div>

                {isMStatActive && (
                  <div className="pt-2 border-t border-neutral-800/60 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-400">Pivot Lookback</span>
                        <input
                          id="settings-input-mstat-pivot"
                          type="number"
                          min={2}
                          max={30}
                          value={settings.indicators.mstatPivotLength ?? 8}
                          onChange={(e) => handleUpdateIndicators('mstatPivotLength', parseInt(e.target.value) || 8)}
                          className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-400">Max Active Zones</span>
                        <input
                          id="settings-input-mstat-oblimit"
                          type="number"
                          min={1}
                          max={15}
                          value={settings.indicators.mstatMaxZones ?? 6}
                          onChange={(e) => handleUpdateIndicators('mstatMaxZones', parseInt(e.target.value) || 6)}
                          className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-mstat-projections"
                          type="checkbox"
                          checked={settings.indicators.mstatShowDashedProjections ?? true}
                          onChange={(e) => handleUpdateIndicators('mstatShowDashedProjections', e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded"
                        />
                        <span className="text-neutral-300">Dashed Projection Lines</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-mstat-badges"
                          type="checkbox"
                          checked={settings.indicators.mstatShowHeightBadges ?? true}
                          onChange={(e) => handleUpdateIndicators('mstatShowHeightBadges', e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded"
                        />
                        <span className="text-neutral-300">Height / Spread Badges</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Indicator 12: Predictive Ranges [LuxAlgo] */}
            {!isIndicatorDeleted('pr') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isPRActive) || (indicatorFilter === 'not_added' && !isPRActive)) && (
              <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-200">Predictive Ranges [LuxAlgo]</span>
                      <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-normal">LuxAlgo Original</span>
                      {isPRActive ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                          Not Added
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Calculates dynamic adaptive step volatility ranges with 5 key levels: Upper 2, Upper 1, Central Average, Lower 1, Lower 2 with shaded zones</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      id="settings-toggle-predictive-ranges"
                      type="checkbox"
                      checked={isPRActive}
                      onChange={(e) => handleUpdateIndicators('showPredictiveRanges', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 bg-neutral-800 rounded border-neutral-700 focus:ring-indigo-500 focus:ring-2 cursor-pointer shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => setIndicatorToDelete({ id: 'pr', name: 'Predictive Ranges [LuxAlgo]' })}
                      title="Permanently delete indicator from platform code & settings"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Permanently Delete</span>
                    </button>
                  </div>
                </div>

                {isPRActive && (
                  <div className="space-y-3.5 pl-3 border-l-2 border-indigo-800/50 pt-1">
                    {/* Input parameters: Length and Mult */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Length</span>
                          <span className="text-xs text-gray-500">ATR lookback period (default 200)</span>
                        </div>
                        <input
                          id="settings-input-pr-length"
                          type="number"
                          min={2}
                          max={500}
                          value={settings.indicators.prLength ?? 200}
                          onChange={(e) => handleUpdateIndicators('prLength', Math.max(2, parseInt(e.target.value) || 200))}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-right"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Factor</span>
                          <span className="text-xs text-gray-500">Multiplier factor (default 6.0)</span>
                        </div>
                        <input
                          id="settings-input-pr-mult"
                          type="number"
                          step={0.5}
                          min={0.5}
                          max={20}
                          value={settings.indicators.prMult ?? 6.0}
                          onChange={(e) => handleUpdateIndicators('prMult', Math.max(0.1, parseFloat(e.target.value) || 6.0))}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-right"
                        />
                      </div>
                    </div>

                    {/* Color controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center justify-between p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                          <span className="text-xs font-medium text-gray-300">Resistance Shade (R1-R2)</span>
                        </div>
                        <input
                          id="settings-color-pr-upper"
                          type="color"
                          value={settings.indicators.prUpperColor || '#f23645'}
                          onChange={(e) => handleUpdateIndicators('prUpperColor', e.target.value)}
                          className="w-8 h-6 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                          <span className="text-xs font-medium text-gray-300">Support Shade (P1-P2)</span>
                        </div>
                        <input
                          id="settings-color-pr-lower"
                          type="color"
                          value={settings.indicators.prLowerColor || '#089981'}
                          onChange={(e) => handleUpdateIndicators('prLowerColor', e.target.value)}
                          className="w-8 h-6 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Visual styling toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Fill Opacity (%)</span>
                          <span className="text-xs text-gray-500">Zone shading transparency</span>
                        </div>
                        <input
                          id="settings-input-pr-opacity"
                          type="number"
                          min={0}
                          max={50}
                          value={settings.indicators.prFillOpacity ?? 10}
                          onChange={(e) => handleUpdateIndicators('prFillOpacity', Math.max(0, Math.min(50, parseInt(e.target.value) || 10)))}
                          className="w-16 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-right"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Line Width</span>
                          <span className="text-xs text-gray-500">Stroke thickness</span>
                        </div>
                        <select
                          id="settings-select-pr-linewidth"
                          value={settings.indicators.prLineWidth ?? 1.5}
                          onChange={(e) => handleUpdateIndicators('prLineWidth', parseFloat(e.target.value) || 1.5)}
                          className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                        >
                          <option value={1}>1.0 px</option>
                          <option value={1.5}>1.5 px (Default)</option>
                          <option value={2}>2.0 px</option>
                          <option value={2.5}>2.5 px</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-pr-extend-right"
                          type="checkbox"
                          checked={settings.indicators.prExtendRight ?? true}
                          onChange={(e) => handleUpdateIndicators('prExtendRight', e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span className="text-neutral-300">Extend Active Shelf to Right Margin</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-pr-show-labels"
                          type="checkbox"
                          checked={settings.indicators.prShowLabels ?? true}
                          onChange={(e) => handleUpdateIndicators('prShowLabels', e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span className="text-neutral-300">Show Price Badges & Labels</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-pr-touch-markers"
                          type="checkbox"
                          checked={settings.indicators.prShowTouchMarkers ?? true}
                          onChange={(e) => handleUpdateIndicators('prShowTouchMarkers', e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span className="text-neutral-300">Reversal Signals (🔺/🔻)</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-pr-breakout-markers"
                          type="checkbox"
                          checked={settings.indicators.prShowBreakoutMarkers ?? true}
                          onChange={(e) => handleUpdateIndicators('prShowBreakoutMarkers', e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span className="text-neutral-300">Breakout &apos;B&apos; Badges (🟢/🔴 B)</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-pr-highlight-active"
                          type="checkbox"
                          checked={settings.indicators.prHighlightActiveTouch ?? true}
                          onChange={(e) => handleUpdateIndicators('prHighlightActiveTouch', e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span className="text-neutral-300">Active Touch Line Glow</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 13. MPRO SIGNALS (PAID / DEMO INDICATOR) */}
            {!isIndicatorDeleted('sr') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isSRActive) || (indicatorFilter === 'not_added' && !isSRActive)) && (
              <div className="p-4 bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-neutral-900/90 border border-emerald-500/20 rounded-xl space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Mpro Signals</span>
                      </h4>
                      {isMproPro ? (
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded font-mono font-bold">
                          PRO ACTIVE ✓
                        </span>
                      ) : mproAccessMode === 'demo' ? (
                        <button
                          onClick={onOpenMproModal}
                          className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono font-bold hover:bg-amber-500/30 transition-colors"
                        >
                          DEMO MODE — UNLOCK PRO ($20)
                        </button>
                      ) : (
                        <button
                          onClick={onOpenMproModal}
                          className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-mono font-bold hover:bg-purple-500/30 transition-colors"
                        >
                          PRO REQUIRED ($20)
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">Professional Market Structure & Signal Engine with 1:1.5 Risk/Reward Analysis</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {onOpenMproModal && (
                      <button
                        type="button"
                        onClick={onOpenMproModal}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors hidden sm:inline-block"
                      >
                        {isMproPro ? 'License Details' : 'Unlock PRO / Demo'}
                      </button>
                    )}
                    <input
                      id="settings-toggle-sr-classification"
                      type="checkbox"
                      checked={isSRActive}
                      onChange={(e) => handleUpdateIndicators('showSrClassification', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 bg-neutral-800 rounded border-neutral-700 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIndicatorToDelete({ id: 'sr', name: 'Mpro Signals (Support & Resistance Classification)' })}
                      title="Permanently delete indicator from platform code & settings"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Permanently Delete</span>
                    </button>
                  </div>
                </div>

                {isSRActive && (
                  <div className="pt-2 border-t border-neutral-800/60 space-y-4 text-xs">
                    {/* General Settings */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="flex flex-col gap-1 p-2 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-[11px] text-neutral-400">Lookback (Bars)</span>
                        <input
                          id="settings-input-sr-lookback"
                          type="number"
                          min={20}
                          max={3000}
                          value={settings.indicators.srLookback ?? 100}
                          onChange={(e) => handleUpdateIndicators('srLookback', parseInt(e.target.value) || 100)}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1 p-2 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-[11px] text-neutral-400">Fade (Breaks)</span>
                        <input
                          id="settings-input-sr-fade"
                          type="number"
                          min={1}
                          max={20}
                          value={settings.indicators.srFade ?? 5}
                          onChange={(e) => handleUpdateIndicators('srFade', parseInt(e.target.value) || 5)}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1 p-2 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-[11px] text-neutral-400">Line Width</span>
                        <select
                          id="settings-select-sr-linewidth"
                          value={settings.indicators.srLineWidth ?? 1.5}
                          onChange={(e) => handleUpdateIndicators('srLineWidth', parseFloat(e.target.value) || 1.5)}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-mono"
                        >
                          <option value={1}>1.0 px</option>
                          <option value={1.5}>1.5 px (Default)</option>
                          <option value={2}>2.0 px</option>
                          <option value={2.5}>2.5 px</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 p-2 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-[11px] text-neutral-400">Breaks Mode</span>
                        <select
                          id="settings-select-sr-opt"
                          value={settings.indicators.srOpt ?? 'line'}
                          onChange={(e) => handleUpdateIndicators('srOpt', e.target.value)}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-mono"
                        >
                          <option value="line">Line (Default)</option>
                          <option value="value">Value</option>
                        </select>
                      </div>
                    </div>

                    {/* Line Extension Mode (Anchored vs Full Chart) */}
                    <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-neutral-200">Line Extension Mode</span>
                        <span className="text-[10px] text-neutral-400">
                          Anchored to Cycle starts at the swing range &amp; projects forward into live price (recommended for Jump 10)
                        </span>
                      </div>
                      <select
                        id="settings-select-sr-line-extension"
                        value={settings.indicators.srLineExtension ?? 'Anchored'}
                        onChange={(e) => handleUpdateIndicators('srLineExtension', e.target.value as any)}
                        className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-medium"
                      >
                        <option value="Anchored">Anchored to Cycle (Original Math)</option>
                        <option value="FullChart">Full Chart (All History)</option>
                      </select>
                    </div>

                    {/* Level Display Mode: Rectangle Shadow vs Original Lines */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-neutral-200">S/R Visual Mode</span>
                          <span className="text-[10px] text-neutral-400">Shadow replaces sharp lines with soft zones</span>
                        </div>
                        <select
                          id="settings-select-sr-display-mode"
                          value={settings.indicators.srDisplayMode ?? 'shadow'}
                          onChange={(e) => handleUpdateIndicators('srDisplayMode', e.target.value as any)}
                          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-medium"
                        >
                          <option value="shadow">Rectangle Shadow (Clean)</option>
                          <option value="lines">Original Lines (Sharp)</option>
                          <option value="both">Shadow + Lines (Combined)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-neutral-200">Shadow Visibility</span>
                          <span className="text-[10px] text-neutral-400">Opacity intensity multiplier</span>
                        </div>
                        <select
                          id="settings-select-sr-shadow-visibility"
                          value={settings.indicators.srShadowVisibility ?? '1x'}
                          onChange={(e) => handleUpdateIndicators('srShadowVisibility', e.target.value as any)}
                          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-medium font-mono"
                        >
                          <option value="0.5x">0.5x (Subtle)</option>
                          <option value="1x">1x (Standard)</option>
                          <option value="2x">2x (Enhanced)</option>
                          <option value="3x">3x (Vivid)</option>
                        </select>
                      </div>
                    </div>

                    {/* Colors & Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-neutral-400">Support / Resistance Colors</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-emerald-400">Sup:</span>
                            <input
                              id="settings-color-sr-colu"
                              type="color"
                              value={settings.indicators.srColU ?? '#22c55e'}
                              onChange={(e) => handleUpdateIndicators('srColU', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-rose-400">Res:</span>
                            <input
                              id="settings-color-sr-cold"
                              type="color"
                              value={settings.indicators.srColD ?? '#ef4444'}
                              onChange={(e) => handleUpdateIndicators('srColD', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-cyan-400">Mid:</span>
                            <input
                              id="settings-color-sr-midline"
                              type="color"
                              value={settings.indicators.srMidlineColor ?? '#06b6d4'}
                              onChange={(e) => handleUpdateIndicators('srMidlineColor', e.target.value)}
                              className="w-6 h-5 bg-transparent border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900">
                        <span className="text-neutral-400">Swings Pivot Strength (L/R)</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            id="settings-input-sr-left"
                            type="number"
                            min={1}
                            max={20}
                            value={settings.indicators.srLeft ?? 10}
                            onChange={(e) => handleUpdateIndicators('srLeft', parseInt(e.target.value) || 10)}
                            className="w-12 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                          <span className="text-neutral-500">/</span>
                          <input
                            id="settings-input-sr-right"
                            type="number"
                            min={1}
                            max={10}
                            value={settings.indicators.srRight ?? 1}
                            onChange={(e) => handleUpdateIndicators('srRight', parseInt(e.target.value) || 1)}
                            className="w-12 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-sr-center-shadows"
                          type="checkbox"
                          checked={settings.indicators.srShowCenterShadows ?? false}
                          onChange={(e) => handleUpdateIndicators('srShowCenterShadows', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span className="text-neutral-300 font-medium">Inside Center Shadows</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-sr-strong-shadows"
                          type="checkbox"
                          checked={settings.indicators.srShowStrongShadows ?? true}
                          onChange={(e) => handleUpdateIndicators('srShowStrongShadows', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span className="text-neutral-300 font-medium">Higher & Lower Shadows</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-sr-midline"
                          type="checkbox"
                          checked={settings.indicators.srShowMidline ?? true}
                          onChange={(e) => handleUpdateIndicators('srShowMidline', e.target.checked)}
                          className="w-3.5 h-3.5 text-cyan-500 rounded"
                        />
                        <span className="text-neutral-300 font-medium text-cyan-400">Middle Line (50% Midline)</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-sr-showsignals"
                          type="checkbox"
                          checked={settings.indicators.srShowSignals ?? true}
                          onChange={(e) => handleUpdateIndicators('srShowSignals', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span className="text-neutral-300 font-medium text-emerald-400">Buy / Sell Signals</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-sr-showlabels"
                          type="checkbox"
                          checked={settings.indicators.srShowLabels ?? false}
                          onChange={(e) => handleUpdateIndicators('srShowLabels', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span className="text-neutral-300">Show Text Labels</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-sr-showpp"
                          type="checkbox"
                          checked={settings.indicators.srShowPP ?? false}
                          onChange={(e) => handleUpdateIndicators('srShowPP', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span className="text-neutral-300">Show Pivot Markers</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-sr-showbreaks"
                          type="checkbox"
                          checked={settings.indicators.srShowBreaks ?? false}
                          onChange={(e) => handleUpdateIndicators('srShowBreaks', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span className="text-neutral-300">Show Break Counts</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-900 cursor-pointer">
                        <input
                          id="settings-toggle-show-center-entry-line"
                          type="checkbox"
                          checked={settings.indicators.showCenterEntryLine ?? true}
                          onChange={(e) => handleUpdateIndicators('showCenterEntryLine', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span className="text-neutral-300">Center Entry Line</span>
                      </label>
                    </div>

                    {/* Mpro Middle Line Mode & Width */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-900 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-cyan-300">Middle Line (Equilibrium) Mode</span>
                        <span className="text-[10px] text-neutral-400">
                          Central line between Upper &amp; Lower shadows, adapting to chart history (e.g. Monthly)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          id="settings-select-sr-midline-type"
                          value={settings.indicators.srMidlineType ?? 'both'}
                          onChange={(e) => handleUpdateIndicators('srMidlineType', e.target.value as any)}
                          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-medium"
                        >
                          <option value="both">Both (Equilibrium + Dynamic Path)</option>
                          <option value="equilibrium">50% Horizontal Equilibrium</option>
                          <option value="dynamic">Dynamic History Path</option>
                        </select>
                        <select
                          id="settings-select-sr-midline-width"
                          value={settings.indicators.srMidlineWidth ?? 1.5}
                          onChange={(e) => handleUpdateIndicators('srMidlineWidth', parseFloat(e.target.value) || 1.5)}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-mono"
                        >
                          <option value={1}>1.0 px</option>
                          <option value={1.5}>1.5 px</option>
                          <option value={2}>2.0 px</option>
                          <option value={2.5}>2.5 px</option>
                        </select>
                      </div>
                    </div>

                    {/* 9 SET Slots Configuration */}
                    <div className="space-y-2 pt-2 border-t border-neutral-900">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">SET Slots (N° – Type – Length – Mult – HTF)</span>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {[
                          { num: 1, chcKey: 'srChc1', lenKey: 'srLen1', mltKey: 'srMlt1', resKey: 'srRes1', dChc: 'SMA', dLen: 50, dMlt: 2, dRes: 'D' },
                          { num: 2, chcKey: 'srChc2', lenKey: 'srLen2', mltKey: 'srMlt2', resKey: 'srRes2', dChc: 'SMA', dLen: 100, dMlt: 2, dRes: 'D' },
                          { num: 3, chcKey: 'srChc3', lenKey: 'srLen3', mltKey: 'srMlt3', resKey: 'srRes3', dChc: 'SMA', dLen: 20, dMlt: 2, dRes: 'W' },
                          { num: 4, chcKey: 'srChc4', lenKey: 'srLen4', mltKey: 'srMlt4', resKey: 'srRes4', dChc: 'Previous High', dLen: 20, dMlt: 2, dRes: 'W' },
                          { num: 5, chcKey: 'srChc5', lenKey: 'srLen5', mltKey: 'srMlt5', resKey: 'srRes5', dChc: 'Previous Low', dLen: 20, dMlt: 2, dRes: 'W' },
                          { num: 6, chcKey: 'srChc6', lenKey: 'srLen6', mltKey: 'srMlt6', resKey: 'srRes6', dChc: 'Upper', dLen: 20, dMlt: 2, dRes: 'D' },
                          { num: 7, chcKey: 'srChc7', lenKey: 'srLen7', mltKey: 'srMlt7', resKey: 'srRes7', dChc: 'Lower', dLen: 20, dMlt: 2, dRes: 'D' },
                          { num: 8, chcKey: 'srChc8', lenKey: 'srLen8', mltKey: 'srMlt8', resKey: 'srRes8', dChc: 'Swings', dLen: 20, dMlt: 2, dRes: 'D' },
                          { num: 9, chcKey: 'srChc9', lenKey: 'srLen9', mltKey: 'srMlt9', resKey: 'srRes9', dChc: 'Fibonacci', dLen: 20, dMlt: 2, dRes: 'W' },
                        ].map((s) => (
                          <div key={s.num} className="flex items-center gap-1.5 p-1.5 bg-neutral-950 rounded border border-neutral-900 text-xs">
                            <span className="w-5 font-mono font-bold text-neutral-400 text-center">{s.num}</span>
                            <select
                              value={(settings.indicators as any)[s.chcKey] ?? s.dChc}
                              onChange={(e) => handleUpdateIndicators(s.chcKey as any, e.target.value)}
                              className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white flex-1"
                            >
                              <option value="NONE">NONE</option>
                              <option value="SMA">SMA</option>
                              <option value="Upper">Upper (BB)</option>
                              <option value="Lower">Lower (BB)</option>
                              <option value="Previous High">Previous High</option>
                              <option value="Previous Low">Previous Low</option>
                              <option value="Swings">Swings</option>
                              <option value="Fibonacci">Fibonacci</option>
                            </select>

                            <input
                              type="number"
                              min={1}
                              max={500}
                              placeholder="Len"
                              value={(settings.indicators as any)[s.lenKey] ?? s.dLen}
                              onChange={(e) => handleUpdateIndicators(s.lenKey as any, parseInt(e.target.value) || s.dLen)}
                              className="w-14 px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                              title="Length"
                            />

                            <input
                              type="number"
                              step={0.5}
                              min={0.1}
                              max={10}
                              placeholder="Mult"
                              value={(settings.indicators as any)[s.mltKey] ?? s.dMlt}
                              onChange={(e) => handleUpdateIndicators(s.mltKey as any, parseFloat(e.target.value) || s.dMlt)}
                              className="w-12 px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                              title="Multiplier"
                            />

                            <select
                              value={(settings.indicators as any)[s.resKey] ?? s.dRes}
                              onChange={(e) => handleUpdateIndicators(s.resKey as any, e.target.value)}
                              className="w-14 px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-mono text-center"
                              title="Timeframe"
                            >
                              <option value="M">M</option>
                              <option value="W">W</option>
                              <option value="D">D</option>
                              <option value="4H">4H</option>
                              <option value="1H">1H</option>
                              <option value="">Chart</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

              {/* Indicator 14: ECHO mpro (Echo Forecast [LuxAlgo]) */}
              {!isIndicatorDeleted('echo') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isEchoActive) || (indicatorFilter === 'not_added' && !isEchoActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-200">ECHO mpro</span>
                        <span className="text-[10px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded font-mono font-normal">LuxAlgo Echo Forecast</span>
                        {isEchoActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Autonomous pattern-matching forecast tool predicting future price trajectory via similarity analysis</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-echo-mpro"
                        type="checkbox"
                        checked={isEchoActive}
                        onChange={(e) => handleUpdateIndicators('showEchoMpro', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'echo', name: 'ECHO mpro (Echo Forecast [LuxAlgo])' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isEchoActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-blue-800/50 pt-1">
                      {/* Screen Shade On / Off Button */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-200">Screen Shade (Area Boxes)</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md font-mono ${
                              (settings.indicators.echoShowArea ?? true)
                                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}>
                              {(settings.indicators.echoShowArea ?? true) ? 'SHADE ON' : 'SHADE OFF'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">Displays evaluation, reference, and correlation window shaded backgrounds</span>
                        </div>
                        <button
                          type="button"
                          id="btn-toggle-screen-shade"
                          onClick={() => handleUpdateIndicators('echoShowArea', !(settings.indicators.echoShowArea ?? true))}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${
                            (settings.indicators.echoShowArea ?? true)
                              ? 'bg-blue-600 hover:bg-blue-500 text-white'
                              : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700'
                          }`}
                        >
                          {(settings.indicators.echoShowArea ?? true) ? 'Screen Shade: ON' : 'Screen Shade: OFF'}
                        </button>
                      </div>

                      {/* Evaluation Window (Length) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Evaluation Window</span>
                          <span className="text-xs text-gray-500">Historical lookback search range (0 - 200 bars)</span>
                        </div>
                        <input
                          id="settings-echo-length"
                          type="number"
                          min={0}
                          max={200}
                          value={settings.indicators.echoLength ?? 50}
                          onChange={(e) => handleUpdateIndicators('echoLength', Math.max(0, Math.min(200, parseInt(e.target.value) || 50)))}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      {/* Forecast Window (Fcast) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Forecast Window</span>
                          <span className="text-xs text-gray-500">Number of forward predicted bars into the future (1 - 200)</span>
                        </div>
                        <input
                          id="settings-echo-fcast"
                          type="number"
                          min={1}
                          max={200}
                          value={settings.indicators.echoFcast ?? 50}
                          onChange={(e) => handleUpdateIndicators('echoFcast', Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      {/* Forecast Mode */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Forecast Mode</span>
                          <span className="text-xs text-gray-500">Similarity (direct correlation) or Dissimilarity (inverse correlation)</span>
                        </div>
                        <select
                          id="settings-echo-fmode"
                          value={settings.indicators.echoFmode ?? 'Similarity'}
                          onChange={(e) => handleUpdateIndicators('echoFmode', e.target.value)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        >
                          <option value="Similarity">Similarity</option>
                          <option value="Dissimilarity">Dissimilarity</option>
                        </select>
                      </div>

                      {/* Forecast Construction */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Forecast Construction</span>
                          <span className="text-xs text-gray-500">Cumulative deltas, Mean average, or Linear Regression</span>
                        </div>
                        <select
                          id="settings-echo-cmode"
                          value={settings.indicators.echoCmode ?? 'Cumulative'}
                          onChange={(e) => handleUpdateIndicators('echoCmode', e.target.value)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        >
                          <option value="Cumulative">Cumulative</option>
                          <option value="Mean">Mean</option>
                          <option value="Linreg">Linreg</option>
                        </select>
                      </div>

                      {/* Price Source */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Price Source</span>
                        <select
                          id="settings-echo-src"
                          value={settings.indicators.echoSrc ?? 'close'}
                          onChange={(e) => handleUpdateIndicators('echoSrc', e.target.value)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        >
                          <option value="close">Close</option>
                          <option value="open">Open</option>
                          <option value="high">High</option>
                          <option value="low">Low</option>
                          <option value="hl2">HL2 (H+L)/2</option>
                          <option value="hlc3">HLC3 (H+L+C)/3</option>
                          <option value="ohlc4">OHLC4 (O+H+L+C)/4</option>
                        </select>
                      </div>

                      {/* Forecast Style: Color & Line Style */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Forecast Line Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            id="settings-echo-fcast-color"
                            type="color"
                            value={settings.indicators.echoFcastColor ?? '#2157f3'}
                            onChange={(e) => handleUpdateIndicators('echoFcastColor', e.target.value)}
                            className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                          />
                          <span className="text-xs font-mono text-gray-400 uppercase">{settings.indicators.echoFcastColor ?? '#2157f3'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Forecast Line Style</span>
                        <select
                          id="settings-echo-fcast-style"
                          value={settings.indicators.echoFcastStyle ?? 'dotted'}
                          onChange={(e) => handleUpdateIndicators('echoFcastStyle', e.target.value)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        >
                          <option value="dotted">· · · (Dotted)</option>
                          <option value="dashed">- - - (Dashed)</option>
                          <option value="solid">── (Solid)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <span className="text-sm font-medium text-gray-300">Line Thickness (px)</span>
                        <input
                          id="settings-echo-line-width"
                          type="number"
                          min={1}
                          max={6}
                          value={settings.indicators.echoLineWidth ?? 1.5}
                          onChange={(e) => handleUpdateIndicators('echoLineWidth', parseFloat(e.target.value) || 1.5)}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      {/* Area Colors */}
                      <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850 space-y-2.5">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Screen Shade Window Colors</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-850">
                            <span className="text-xs text-gray-400">Reference Window</span>
                            <input
                              type="color"
                              value={settings.indicators.echoRefAreaColor ?? '#ff5d00'}
                              onChange={(e) => handleUpdateIndicators('echoRefAreaColor', e.target.value)}
                              className="w-7 h-6 rounded cursor-pointer border-none bg-transparent"
                            />
                          </div>
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-850">
                            <span className="text-xs text-gray-400">Correlation Window</span>
                            <input
                              type="color"
                              value={settings.indicators.echoCorrAreaColor ?? '#089981'}
                              onChange={(e) => handleUpdateIndicators('echoCorrAreaColor', e.target.value)}
                              className="w-7 h-6 rounded cursor-pointer border-none bg-transparent"
                            />
                          </div>
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-850">
                            <span className="text-xs text-gray-400">Evaluation Window</span>
                            <input
                              type="color"
                              value={settings.indicators.echoEvalAreaColor ?? '#808080'}
                              onChange={(e) => handleUpdateIndicators('echoEvalAreaColor', e.target.value)}
                              className="w-7 h-6 rounded cursor-pointer border-none bg-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator: Mpro2 Signal */}
              {!isIndicatorDeleted('mpro2') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMpro2Active) || (indicatorFilter === 'not_added' && !isMpro2Active)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-blue-400 flex items-center gap-1.5">
                          🎯 Mpro2 Signal
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded font-mono">
                          Mpro2
                        </span>
                        {isMpro2Active ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        Multi-swing high-accuracy levels, Golden Pocket (0.618 - 0.65), level touch strength, full chart lines &amp; upper/lower line touch Buy/Sell signals
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-mpro2"
                        type="checkbox"
                        checked={isMpro2Active}
                        onChange={(e) => handleUpdateIndicators('showMpro2Signal', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'mpro2', name: 'Mpro2 Signal' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isMpro2Active && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-blue-500/30 pt-1">
                      {/* PRO / DEMO Status Banner */}
                      <div className="p-3 bg-neutral-950 rounded-lg border border-blue-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">Mpro2 Signal License</span>
                              {isMpro2Pro ? (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">
                                  PRO ACTIVE ✓
                                </span>
                              ) : mpro2AccessMode === 'demo' ? (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                                  DEMO MODE ($20)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">
                                  PRO REQUIRED
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              {isMpro2Pro
                                ? 'Full Real-time Confluence & Instant Reversal Alerts'
                                : 'Demo: Historical testing on past charts (Key required for live alerts)'}
                            </span>
                          </div>
                        </div>
                        {onOpenMpro2Modal && (
                          <button
                            type="button"
                            onClick={onOpenMpro2Modal}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors shadow-sm cursor-pointer shrink-0"
                          >
                            {isMpro2Pro ? 'License Details' : 'Unlock PRO / Demo'}
                          </button>
                        )}
                      </div>

                      {/* Range Calculation Source: All Chart High/Low vs Lookback */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-200">High / Low Calculation Range</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">
                              ACCURACY
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            Derived from all chart High &amp; Low in each timeframe for clear, reliable trades
                          </span>
                        </div>
                        <select
                          id="settings-mpro2-range-mode"
                          value={settings.indicators.mpro2RangeMode ?? 'WeeklyAnchor'}
                          onChange={(e) => handleUpdateIndicators('mpro2RangeMode', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                        >
                          <option value="WeeklyAnchor">Weekly Anchor &amp; Confirmed Swing Lock (Master Recommended)</option>
                          <option value="AllChart">All Chart High &amp; Low</option>
                          <option value="Lookback">Custom Lookback Window</option>
                        </select>
                      </div>

                      {/* Lookback Period & Delay (only needed when Lookback mode is chosen) */}
                      {(settings.indicators.mpro2RangeMode === 'Lookback') && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-850 flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-300">Period (Lookback)</span>
                            <input
                              type="number"
                              min={10}
                              max={1000}
                              value={settings.indicators.mpro2LookbackPeriod ?? 200}
                              onChange={(e) => handleUpdateIndicators('mpro2LookbackPeriod', parseInt(e.target.value) || 200)}
                              className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                          <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-850 flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-300">Delay Bars</span>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={settings.indicators.mpro2DelayBars ?? 5}
                              onChange={(e) => handleUpdateIndicators('mpro2DelayBars', parseInt(e.target.value) || 5)}
                              className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Line Extension Mode & Reverse */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Line Extension</span>
                          <span className="text-xs text-gray-500">Horizontal line span on chart</span>
                        </div>
                        <select
                          value={settings.indicators.mpro2LineExtensionMode ?? 'FullChart'}
                          onChange={(e) => handleUpdateIndicators('mpro2LineExtensionMode', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                        >
                          <option value="FullChart">Full Chart (Spans entire width)</option>
                          <option value="Both">Both (Left &amp; Right)</option>
                          <option value="Right">Right Extended</option>
                          <option value="Left">Left Extended</option>
                          <option value="None">None (Anchored to Swing)</option>
                        </select>
                      </div>

                      {/* Buy / Sell Touch Arrows Toggle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                            <span>Buy / Sell Reversal Arrows</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded">
                              SIGNAL
                            </span>
                          </span>
                          <span className="text-xs text-gray-500">
                            Plots ▲ BUY when price touches lower baseline/support, and ▼ SELL when touching upper baseline/resistance
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.indicators.mpro2ShowTouchArrows ?? true}
                          onChange={(e) => handleUpdateIndicators('mpro2ShowTouchArrows', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Screen Texts (On/Off toggle for HUD & Labels) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Screen Texts &amp; HUD Table</span>
                          <span className="text-xs text-gray-500">
                            On/Off master toggle for status table text, swing values, and level labels on screen
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.indicators.mpro2ShowScreenTexts ?? true}
                          onChange={(e) => handleUpdateIndicators('mpro2ShowScreenTexts', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Status Table Position */}
                      {settings.indicators.mpro2ShowScreenTexts !== false && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Status Table Position</span>
                            <span className="text-xs text-gray-500">Screen HUD overlay position</span>
                          </div>
                          <select
                            value={settings.indicators.mpro2TablePosition ?? 'Top Right'}
                            onChange={(e) => handleUpdateIndicators('mpro2TablePosition', e.target.value as any)}
                            className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                          >
                            <option value="Top Right">Top Right</option>
                            <option value="Top Left">Top Left</option>
                            <option value="Bottom Right">Bottom Right</option>
                            <option value="Bottom Left">Bottom Left</option>
                          </select>
                        </div>
                      )}

                      {/* Golden Pocket (0.618 - 0.650) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                            <span>Golden Pocket Shade (0.618 - 0.65)</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                          </span>
                          <span className="text-xs text-gray-500">Highlight high-probability reversal zone fill</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.indicators.mpro2GoldenPocketColor ?? '#FFB020'}
                            onChange={(e) => handleUpdateIndicators('mpro2GoldenPocketColor', e.target.value)}
                            className="w-7 h-6 rounded cursor-pointer border-none bg-transparent"
                          />
                          <input
                            type="checkbox"
                            checked={settings.indicators.mpro2ShowGoldenPocket ?? true}
                            onChange={(e) => handleUpdateIndicators('mpro2ShowGoldenPocket', e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Multi-Swing Confluence */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Multi-Swing Confluence (★)</span>
                          <span className="text-xs text-gray-500">Highlights levels aligned with prior swings</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.indicators.mpro2ShowConfluence ?? true}
                          onChange={(e) => handleUpdateIndicators('mpro2ShowConfluence', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Touch Counts on Labels */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Touch Counts (e.g. 3x)</span>
                          <span className="text-xs text-gray-500">Displays level test frequency &amp; strength score</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.indicators.mpro2ShowTouchCounts ?? true}
                          onChange={(e) => handleUpdateIndicators('mpro2ShowTouchCounts', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Mpro2 Visual Mode: Lines vs Rectangle Shadow */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-200 flex items-center gap-1.5">
                            <span>Visual Mode (የመስመር / የጥላ አቀራረብ)</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-semibold">Lines / Shadow</span>
                          </span>
                          <span className="text-xs text-gray-400">
                            Switch Mpro2 between sharp lines and soft Rectangle Shadow zones
                          </span>
                        </div>
                        <select
                          id="settings-select-mpro2-display-mode"
                          value={settings.indicators.mpro2DisplayMode ?? 'lines'}
                          onChange={(e) => handleUpdateIndicators('mpro2DisplayMode', e.target.value as any)}
                          className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="lines">Original Lines (Sharp)</option>
                          <option value="shadow">Rectangle Shadow (Clean)</option>
                          <option value="both">Shadow + Lines (Combined)</option>
                        </select>
                      </div>

                      {/* Mpro2 Rectangle Shadow Height & Intensity */}
                      {(settings.indicators.mpro2DisplayMode === 'shadow' || settings.indicators.mpro2DisplayMode === 'both') && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-200">Shadow Height &amp; Intensity</span>
                            <span className="text-xs text-gray-400">Rectangle shadow zone thickness multiplier</span>
                          </div>
                          <select
                            id="settings-select-mpro2-shadow-visibility"
                            value={settings.indicators.mpro2ShadowVisibility ?? '1x'}
                            onChange={(e) => handleUpdateIndicators('mpro2ShadowVisibility', e.target.value as any)}
                            className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-medium font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="0.5x">0.5x (Subtle &amp; Tight)</option>
                            <option value="1x">1x (Standard)</option>
                            <option value="2x">2x (Expanded Zone)</option>
                            <option value="3x">3x (Wide Macro Zone)</option>
                          </select>
                        </div>
                      )}

                      {/* Base Line Style & Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Base Lines (0.000 / 1.000)</span>
                          <span className="text-xs text-gray-500">Primary outer swing anchors</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.indicators.mpro2BaseLineColor ?? '#2962FF'}
                            onChange={(e) => handleUpdateIndicators('mpro2BaseLineColor', e.target.value)}
                            className="w-7 h-6 rounded cursor-pointer border-none bg-transparent"
                          />
                          <select
                            value={settings.indicators.mpro2BaseLineStyle ?? 'Solid'}
                            onChange={(e) => handleUpdateIndicators('mpro2BaseLineStyle', e.target.value as any)}
                            className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none"
                          >
                            <option value="Solid">Solid</option>
                            <option value="Dotted">Dotted</option>
                            <option value="Dashed">Dashed</option>
                          </select>
                        </div>
                      </div>

                      {/* Extension Lines Style & Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Extension Lines (0.236 - 0.786)</span>
                          <span className="text-xs text-gray-500">Intermediate retracement levels</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.indicators.mpro2ExtLineColor ?? '#787B86'}
                            onChange={(e) => handleUpdateIndicators('mpro2ExtLineColor', e.target.value)}
                            className="w-7 h-6 rounded cursor-pointer border-none bg-transparent"
                          />
                          <select
                            value={settings.indicators.mpro2ExtLineStyle ?? 'Dotted'}
                            onChange={(e) => handleUpdateIndicators('mpro2ExtLineStyle', e.target.value as any)}
                            className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none"
                          >
                            <option value="Dotted">Dotted</option>
                            <option value="Solid">Solid</option>
                            <option value="Dashed">Dashed</option>
                          </select>
                        </div>
                      </div>

                      {/* Center Dotted Lines (All Intermediate Retracements) On / Off Toggle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                            <span>Inside Lines & Dots (Intermediate Levels)</span>
                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block shadow-sm" />
                          </span>
                          <span className="text-xs text-gray-500">
                            When OFF (default), Mpro2 cleanly displays only the Two Higher and Lower Lines plus the Yellow Gold Golden Pocket (0.618 - 0.650)
                          </span>
                        </div>
                        <input
                          id="settings-mpro2-dotted-lines-toggle"
                          type="checkbox"
                          checked={settings.indicators.mpro2ShowDottedLines ?? false}
                          onChange={(e) => handleUpdateIndicators('mpro2ShowDottedLines', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Center White Line (0.500 Midpoint) On / Off Toggle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                            <span>Center Line (0.500 Midpoint)</span>
                            <span className="w-2 h-2 rounded-full bg-white inline-block shadow-sm" />
                          </span>
                          <span className="text-xs text-gray-500">
                            Equilibrium midpoint horizontal center line across chart at 50% retracement
                          </span>
                        </div>
                        <input
                          id="settings-mpro2-center-line-toggle"
                          type="checkbox"
                          checked={(settings.indicators.mpro2ShowExtLine3 ?? false) && (settings.indicators.mpro2ShowCenterLine ?? false)}
                          onChange={(e) => {
                            handleUpdateIndicators('mpro2ShowExtLine3', e.target.checked);
                            handleUpdateIndicators('mpro2ShowCenterLine', e.target.checked);
                          }}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Fibonacci Time Zones */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Fibonacci Time Zones</span>
                          <span className="text-xs text-gray-500">Vertical projected time cycle intervals</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.indicators.mpro2ShowTimeZones ?? false}
                          onChange={(e) => handleUpdateIndicators('mpro2ShowTimeZones', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator: Master Strategy System & Dashboard (Strictly Mpro2) */}
              {!isIndicatorDeleted('master') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMasterActive) || (indicatorFilter === 'not_added' && !isMasterActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-blue-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-blue-400 flex items-center gap-1.5">
                          🛡️ Master Strategy System
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded font-mono">
                          Mpro2 Exclusive
                        </span>
                        {isMasterActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Turned Off
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        1:3 RR Gatekeeper, Micro-Trigger, and Trade Attribution HUD. Operates strictly on Mpro2 (Weekly Anchor, 0.000 / 1.000 Lines, &amp; Golden Pocket). Mpro is completely disabled.
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-master-dashboard"
                        type="checkbox"
                        checked={isMasterActive}
                        onChange={(e) => {
                          handleUpdateMultipleIndicators({
                            showMasterDashboard: e.target.checked,
                            showMasterSignal: e.target.checked,
                          });
                        }}
                        className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'master', name: 'Master Strategy System & Dashboard' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isMasterActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-blue-500/30 pt-1">
                      {/* Master HUD on chart toggle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Master Dashboard on Chart (የዳሽቦርድ ማሳያ)</span>
                          <span className="text-xs text-gray-500">Display real-time Master Gatekeeper HUD, Floating R counter, and Win/Loss tracker</span>
                        </div>
                        <input
                          id="settings-toggle-master-hud-visible"
                          type="checkbox"
                          checked={settings.indicators.showMasterDashboard ?? true}
                          onChange={(e) => {
                            handleUpdateMultipleIndicators({
                              showMasterDashboard: e.target.checked,
                              showMasterSignal: e.target.checked,
                            });
                          }}
                          className="w-4 h-4 text-blue-600 bg-neutral-800 rounded border-neutral-700 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Rule Clarification Card */}
                      <div className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                          <span>✓ Exclusive Mpro2 Strategy Connected</span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          Master የሚሰራው በ Mpro2 (Higher/Lower Base Lines, Weekly Anchor PWH/PWL, እና Golden Pocket 0.618-0.650) ላይ ብቻ ነው። Mpro በዚህ ስትራቴጂ ውስጥ ሙሉ በሙሉ እንዳይሰራ ተደርጓል።
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 16: HVN Profile (ATAS Market Profile by ProfitPro) */}
              {!isIndicatorDeleted('hvn') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isHvnActive) || (indicatorFilter === 'not_added' && !isHvnActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-200">HVN Profile</span>
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-1.5 py-0.5 rounded font-mono font-semibold">
                          ATAS • ProfitPro
                        </span>
                        {isHvnActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        Order flow High Volume Node (HVN) projection zones with POC levels and period volume profile silhouettes
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-hvn-profile"
                        type="checkbox"
                        checked={isHvnActive}
                        onChange={(e) => handleUpdateIndicators('showHvnProfile', e.target.checked)}
                        className="w-4 h-4 text-amber-500 bg-neutral-800 rounded border-neutral-700 focus:ring-amber-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'hvn', name: 'HVN Profile (ATAS Market Profile)' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isHvnActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-amber-600/50 pt-1">
                      {/* Period Length (Bars per Segment) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Period Length (Bars)</span>
                          <span className="text-xs text-gray-500">Number of candles per profile segment (Default: 60)</span>
                        </div>
                        <input
                          id="settings-hvn-period-bars"
                          type="number"
                          min={15}
                          max={300}
                          step={5}
                          value={settings.indicators.hvnPeriodBars ?? 60}
                          onChange={(e) => handleUpdateIndicators('hvnPeriodBars', parseInt(e.target.value) || 60)}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500 font-mono text-right"
                        />
                      </div>

                      {/* Zone Projection Extension Mode */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">HVN Zone Extension</span>
                          <span className="text-xs text-gray-500">How far the amber reaction zones project across price</span>
                        </div>
                        <select
                          id="settings-hvn-extension-mode"
                          value={settings.indicators.hvnExtensionMode ?? 'Mitigation'}
                          onChange={(e) => handleUpdateIndicators('hvnExtensionMode', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                        >
                          <option value="Mitigation">Until Mitigated / Retested</option>
                          <option value="NextPeriod">Until Next Period</option>
                          <option value="FullRight">Full Chart (Extend to Right)</option>
                        </select>
                      </div>

                      {/* Mitigation Condition */}
                      {(settings.indicators.hvnExtensionMode ?? 'Mitigation') === 'Mitigation' && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Mitigation Trigger</span>
                            <span className="text-xs text-gray-500">Whether a wick touch or candle close terminates projection</span>
                          </div>
                          <select
                            id="settings-hvn-mitigation-type"
                            value={settings.indicators.hvnMitigationType ?? 'Touch'}
                            onChange={(e) => handleUpdateIndicators('hvnMitigationType', e.target.value as any)}
                            className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                          >
                            <option value="Touch">Wick Touch (High / Low)</option>
                            <option value="Close">Candle Body Close</option>
                          </select>
                        </div>
                      )}

                      {/* Zone Thickness (% of Range) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Zone Thickness (%)</span>
                          <span className="text-xs text-gray-500">Vertical height tolerance around the HVN peak (Default: 3.0%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={8}
                            step={0.5}
                            value={settings.indicators.hvnZoneThicknessPct ?? 3.0}
                            onChange={(e) => handleUpdateIndicators('hvnZoneThicknessPct', parseFloat(e.target.value))}
                            className="w-24 accent-amber-500 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-amber-300 w-10 text-right">
                            {(settings.indicators.hvnZoneThicknessPct ?? 3.0).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Volume Profile Silhouette Toggle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Profile Silhouette</span>
                          <span className="text-xs text-gray-500">Dark curved volume profile histogram behind candles</span>
                        </div>
                        <input
                          id="settings-toggle-hvn-silhouette"
                          type="checkbox"
                          checked={settings.indicators.hvnShowSilhouette ?? true}
                          onChange={(e) => handleUpdateIndicators('hvnShowSilhouette', e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-neutral-800 rounded border-neutral-700 focus:ring-amber-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Screen Labels & Price Badges */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Screen Labels &amp; Badges</span>
                          <span className="text-xs text-gray-500">Show price and POC badge tags at the right of active zones</span>
                        </div>
                        <input
                          id="settings-toggle-hvn-labels"
                          type="checkbox"
                          checked={settings.indicators.hvnShowLabels ?? true}
                          onChange={(e) => handleUpdateIndicators('hvnShowLabels', e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-neutral-800 rounded border-neutral-700 focus:ring-amber-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Secondary HVN Nodes */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Secondary HVN Nodes</span>
                          <span className="text-xs text-gray-500">Detect and project secondary high-volume nodes in addition to POC</span>
                        </div>
                        <input
                          id="settings-toggle-hvn-secondary"
                          type="checkbox"
                          checked={settings.indicators.hvnShowSecondaryNodes ?? false}
                          onChange={(e) => handleUpdateIndicators('hvnShowSecondaryNodes', e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-neutral-800 rounded border-neutral-700 focus:ring-amber-500 focus:ring-2 cursor-pointer"
                        />
                      </div>

                      {/* Color Palette Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-850 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-300">Zone Fill</span>
                          <input
                            type="color"
                            value={settings.indicators.hvnZoneColor ?? '#f59e0b'}
                            onChange={(e) => handleUpdateIndicators('hvnZoneColor', e.target.value)}
                            className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
                          />
                        </div>
                        <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-850 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-300">POC Line</span>
                          <input
                            type="color"
                            value={settings.indicators.hvnPocLineColor ?? '#fbbf24'}
                            onChange={(e) => handleUpdateIndicators('hvnPocLineColor', e.target.value)}
                            className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
                          />
                        </div>
                        <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-850 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-300">Silhouette</span>
                          <input
                            type="color"
                            value={settings.indicators.hvnProfileColor ?? '#1e3a8a'}
                            onChange={(e) => handleUpdateIndicators('hvnProfileColor', e.target.value)}
                            className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 17: NEXUS SMART MONEY SUITE [BullByte] */}
              {!isIndicatorDeleted('nexus') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isNexusActive) || (indicatorFilter === 'not_added' && !isNexusActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-cyan-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-cyan-400 flex items-center gap-1.5">
                          ⚡ NEXUS: SMART MONEY SUITE
                        </span>
                        <span className="text-[10px] bg-cyan-950/90 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.5 rounded font-mono font-semibold">
                          BullByte Institutional
                        </span>
                        {isProActivated || isMpro2Pro || isMproPro ? (
                          <span className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded font-mono font-bold">
                            👑 PRO ACTIVE ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSwitchToPro}
                            className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono font-bold hover:bg-amber-500/30 transition-colors"
                          >
                            PRO ONLY (ACTIVATE)
                          </button>
                        )}
                        {isNexusActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Turned Off
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        Unified SMC institutional framework featuring Market Structure (BOS, CHoCH, SMS), Scored Order Blocks, Fair Value Gaps (CE 50%), Liquidity Sweeps, Temporal Memory, Nexus Pulse &amp; Trade Management Engine.
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-nexus-suite"
                        type="checkbox"
                        checked={isNexusActive}
                        onChange={(e) => handleUpdateIndicators('showNexusSuite', e.target.checked)}
                        className="w-4 h-4 text-cyan-500 bg-neutral-800 rounded border-neutral-700 focus:ring-cyan-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'nexus', name: 'NEXUS: SMART MONEY SUITE' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isNexusActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-cyan-500/30 pt-1">
                      {/* Master HUD & Narrative Visibility */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">NEXUS HUD Dashboard</span>
                          <input
                            type="checkbox"
                            checked={settings.indicators.nexusShowDashboard ?? true}
                            onChange={(e) => handleUpdateIndicators('nexusShowDashboard', e.target.checked)}
                            className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded border-neutral-750 cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Market Narrative Box</span>
                          <input
                            type="checkbox"
                            checked={settings.indicators.nexusShowMarketNarrative ?? true}
                            onChange={(e) => handleUpdateIndicators('nexusShowMarketNarrative', e.target.checked)}
                            className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded border-neutral-750 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Trading Mode & Signal Filter */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5 p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Trading Mode Profile</span>
                          <select
                            value={settings.indicators.nexusTradingMode ?? 'AUTO'}
                            onChange={(e) => handleUpdateIndicators('nexusTradingMode', e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                          >
                            <option value="AUTO">AUTO (Adaptive by Timeframe)</option>
                            <option value="SCALPER">SCALPER (1M-5M Fast Reaction)</option>
                            <option value="SWING">SWING (15M-1H Balanced)</option>
                            <option value="POSITION">POSITION (4H-1D Major Swings)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5 p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Signal Confluence Filter</span>
                          <select
                            value={settings.indicators.nexusSignalFilter ?? 'A_PLUS_AND_A'}
                            onChange={(e) => handleUpdateIndicators('nexusSignalFilter', e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                          >
                            <option value="A_PLUS_ONLY">A+ Only (Score ≥ 50)</option>
                            <option value="A_PLUS_AND_A">A+ and A (Score ≥ 40)</option>
                            <option value="B_AND_ABOVE">B and Above (Score ≥ 25)</option>
                            <option value="ALL">Show All Signals</option>
                          </select>
                        </div>
                      </div>

                      {/* Execution & Risk Management */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-950 rounded border border-neutral-850">
                          <span className="text-[11px] text-gray-400">Entry Mode</span>
                          <select
                            value={settings.indicators.nexusEntryMode ?? 'BOTH'}
                            onChange={(e) => handleUpdateIndicators('nexusEntryMode', e.target.value)}
                            className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-mono"
                          >
                            <option value="BOTH">Both (Break + Retest)</option>
                            <option value="RETEST">Retest Only (High Precision)</option>
                            <option value="BREAK">Direct Break</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-950 rounded border border-neutral-850">
                          <span className="text-[11px] text-gray-400">Stop Loss Method</span>
                          <select
                            value={settings.indicators.nexusStopLossMode ?? 'ATR'}
                            onChange={(e) => handleUpdateIndicators('nexusStopLossMode', e.target.value)}
                            className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-mono"
                          >
                            <option value="ATR">ATR Dynamic</option>
                            <option value="SWING">Structural Swing Point</option>
                            <option value="PERCENT">Fixed Percent</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-950 rounded border border-neutral-850">
                          <span className="text-[11px] text-gray-400">ATR SL Multiplier</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="5.0"
                            value={settings.indicators.nexusAtrMultiplierSL ?? 2.0}
                            onChange={(e) => handleUpdateIndicators('nexusAtrMultiplierSL', parseFloat(e.target.value) || 2.0)}
                            className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-white font-mono text-center"
                          />
                        </div>
                      </div>

                      {/* SMC Modules Sub-Toggles */}
                      <div className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-850 space-y-2.5">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Active Analytical Modules</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Market Structure (BOS / CHoCH / SMS)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowMarketStructure ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowMarketStructure', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Order Blocks (Scored 1-5)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowOrderBlocks ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowOrderBlocks', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Breaker Blocks (Mitigated OBs)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowBreakerBlocks ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowBreakerBlocks', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Fair Value Gaps &amp; 50% CE</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowFVG ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowFVG', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Inverted FVGs (iFVG)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowInvertedFVG ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowInvertedFVG', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Liquidity Pools &amp; Sweeps (BSL/SSL)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowLiquidityPools ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowLiquidityPools', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Premium / Discount / Equilibrium</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowPremiumDiscount ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowPremiumDiscount', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-800/80 cursor-pointer">
                            <span className="text-gray-300">Density-Weighted S/R with Touch Glow</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowSRGlow ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowSRGlow', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Institutional VWAP &amp; Bands</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowVWAP ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowVWAP', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Key Levels (PDH, PDL, PDO, PWH, PWL)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowKeyLevels ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowKeyLevels', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Smart Trendlines &amp; Breaks</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowTrendlines ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowTrendlines', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Signal Arrows &amp; Targets (Long / Short)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowSignals ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowSignals', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Trend-Colored Candles</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusColorCandles ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusColorCandles', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Sessions &amp; Kill Zones (LDN/NY KZ)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusShowSessions ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusShowSessions', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-900/60 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Confirmation Bar (Wait for Close)</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.nexusConfirmationBar ?? true}
                              onChange={(e) => handleUpdateIndicators('nexusConfirmationBar', e.target.checked)}
                              className="w-3.5 h-3.5 text-cyan-500 bg-neutral-850 rounded"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 18: Session Filter (Free Indicator) */}
              {!isIndicatorDeleted('session') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isSessionFilterActive) || (indicatorFilter === 'not_added' && !isSessionFilterActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-200">Session Filter</span>
                        <span className="text-[10px] bg-sky-950/80 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded font-mono font-semibold">
                          FREE • MCHARTS
                        </span>
                        {isSessionFilterActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        Noise-free off-light dotted, solid, or dashed vertical session dividers for Asian, London, and New York trading sessions with clean top labels
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-session-filter"
                        type="checkbox"
                        checked={isSessionFilterActive}
                        onChange={(e) => handleUpdateIndicators('showSessionFilter', e.target.checked)}
                        className="w-4 h-4 text-sky-500 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'session', name: 'Session Filter' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isSessionFilterActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-sky-600/50 pt-1">
                      {/* Line Style (Dotted / Solid / Dashed) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Line Style</span>
                          <span className="text-xs text-gray-500">Dotted, solid, or dashed vertical separator lines</span>
                        </div>
                        <select
                          id="settings-session-line-style"
                          value={settings.indicators.sessionFilterLineStyle ?? 'dotted'}
                          onChange={(e) => handleUpdateIndicators('sessionFilterLineStyle', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-sky-500"
                        >
                          <option value="dotted">Dotted (Off-light)</option>
                          <option value="solid">Solid Line</option>
                          <option value="dashed">Dashed Line</option>
                        </select>
                      </div>

                      {/* Line Opacity */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Line Opacity (Zero Noise)</span>
                          <span className="text-xs text-gray-500">Subtle off-light transparency (Default: 35%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="settings-session-line-opacity"
                            type="range"
                            min={15}
                            max={100}
                            step={5}
                            value={settings.indicators.sessionFilterLineOpacity ?? 35}
                            onChange={(e) => handleUpdateIndicators('sessionFilterLineOpacity', Number(e.target.value))}
                            className="w-24 accent-sky-500 cursor-pointer"
                          />
                          <span className="text-xs text-neutral-400 font-mono w-9 text-right">
                            {settings.indicators.sessionFilterLineOpacity ?? 35}%
                          </span>
                        </div>
                      </div>

                      {/* Line Width */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Line Thickness</span>
                          <span className="text-xs text-gray-500">Subtle 1px boundary width (Default: 1px)</span>
                        </div>
                        <select
                          id="settings-session-line-width"
                          value={settings.indicators.sessionFilterLineWidth ?? 1}
                          onChange={(e) => handleUpdateIndicators('sessionFilterLineWidth', Number(e.target.value))}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-sky-500"
                        >
                          <option value={1}>1px (Minimalist)</option>
                          <option value={1.5}>1.5px</option>
                          <option value={2}>2px</option>
                        </select>
                      </div>

                      {/* Sessions to Filter */}
                      <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850 space-y-2.5">
                        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                          Filter Market Sessions
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="flex items-center justify-between p-2.5 bg-neutral-950/80 rounded border border-neutral-800 cursor-pointer hover:border-neutral-700">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-sky-400">Asian Session</span>
                              <span className="text-[10px] text-neutral-500 font-mono">00:00 - 08:00 UTC</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={settings.indicators.sessionFilterShowAsia ?? true}
                              onChange={(e) => handleUpdateIndicators('sessionFilterShowAsia', e.target.checked)}
                              className="w-3.5 h-3.5 text-sky-500 bg-neutral-900 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2.5 bg-neutral-950/80 rounded border border-neutral-800 cursor-pointer hover:border-neutral-700">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-amber-400">London Session</span>
                              <span className="text-[10px] text-neutral-500 font-mono">07:00 - 16:00 UTC</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={settings.indicators.sessionFilterShowLondon ?? true}
                              onChange={(e) => handleUpdateIndicators('sessionFilterShowLondon', e.target.checked)}
                              className="w-3.5 h-3.5 text-amber-500 bg-neutral-900 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2.5 bg-neutral-950/80 rounded border border-neutral-800 cursor-pointer hover:border-neutral-700">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-emerald-400">New York Session</span>
                              <span className="text-[10px] text-neutral-500 font-mono">13:00 - 21:00 UTC</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={settings.indicators.sessionFilterShowNewYork ?? true}
                              onChange={(e) => handleUpdateIndicators('sessionFilterShowNewYork', e.target.checked)}
                              className="w-3.5 h-3.5 text-emerald-500 bg-neutral-900 rounded"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Display Boundaries & Labels */}
                      <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850 space-y-2">
                        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                          Boundaries &amp; Labels
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <label className="flex items-center justify-between p-2 bg-neutral-950/80 rounded border border-neutral-800 cursor-pointer">
                            <span className="text-gray-300">Session Start Vertical Line</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.sessionFilterShowStartLine ?? true}
                              onChange={(e) => handleUpdateIndicators('sessionFilterShowStartLine', e.target.checked)}
                              className="w-3.5 h-3.5 text-sky-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-950/80 rounded border border-neutral-800 cursor-pointer">
                            <span className="text-gray-300">Session End Vertical Line</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.sessionFilterShowEndLine ?? true}
                              onChange={(e) => handleUpdateIndicators('sessionFilterShowEndLine', e.target.checked)}
                              className="w-3.5 h-3.5 text-sky-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-950/80 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Top Session Name Label</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.sessionFilterShowLabels ?? true}
                              onChange={(e) => handleUpdateIndicators('sessionFilterShowLabels', e.target.checked)}
                              className="w-3.5 h-3.5 text-sky-500 bg-neutral-850 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2 bg-neutral-950/80 rounded border border-neutral-850 cursor-pointer">
                            <span className="text-gray-300">Subtle Session Colors</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.sessionFilterCustomColors ?? true}
                              onChange={(e) => handleUpdateIndicators('sessionFilterCustomColors', e.target.checked)}
                              className="w-3.5 h-3.5 text-sky-500 bg-neutral-850 rounded"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Label Font Size */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Top Label Size</span>
                          <span className="text-xs text-gray-500">Discreet tiny font to prevent noise (Default: Tiny 9px)</span>
                        </div>
                        <select
                          id="settings-session-label-size"
                          value={settings.indicators.sessionFilterLabelSize ?? 'tiny'}
                          onChange={(e) => handleUpdateIndicators('sessionFilterLabelSize', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-sky-500"
                        >
                          <option value="tiny">Tiny (9px - Zero Noise)</option>
                          <option value="small">Small (11px)</option>
                        </select>
                      </div>

                      {/* Background Shading (Optional) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Faint Session Background Tint</span>
                          <span className="text-xs text-gray-500">Optional whisper-light fill between lines (Default: Off)</span>
                        </div>
                        <input
                          id="settings-session-fill-bg"
                          type="checkbox"
                          checked={settings.indicators.sessionFilterFillBackground ?? false}
                          onChange={(e) => handleUpdateIndicators('sessionFilterFillBackground', e.target.checked)}
                          className="w-4 h-4 text-sky-500 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 19: Order Blocks with Volume Delta (cTrader Store / Pepperstone Specification) */}
              {!isIndicatorDeleted('obv') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isObvActive) || (indicatorFilter === 'not_added' && !isObvActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-200">Order Blocks with Volume Delta</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono font-bold">
                          PRO • cTrader Store
                        </span>
                        {isObvActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        Institutional Order Blocks split by Buy/Sell Volume Delta % with Total Volume labels &amp; mitigation tracking
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-obv"
                        type="checkbox"
                        checked={isObvActive}
                        onChange={(e) => handleUpdateIndicators('showOrderBlocksWithVolume', e.target.checked)}
                        className="w-4 h-4 text-emerald-500 bg-neutral-800 rounded border-neutral-700 focus:ring-emerald-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'obv', name: 'Order Blocks with Volume Delta' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isObvActive && (
                    <div className="space-y-4 pl-3 border-l-2 border-emerald-600/50 pt-1">
                      {/* TECHNICAL SETTINGS HEADER */}
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-neutral-800 pb-1">
                        Technical Settings
                      </div>

                      {/* Swing Length */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Swing Length</span>
                          <span className="text-xs text-gray-500">Bilateral fractal pivot lookback &amp; lookahead window (Default: 10)</span>
                        </div>
                        <input
                          id="settings-obv-swing-length"
                          type="number"
                          min={2}
                          max={50}
                          value={settings.indicators.obvSwingLength ?? 10}
                          onChange={(e) => handleUpdateIndicators('obvSwingLength', parseInt(e.target.value) || 10)}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-mono text-right"
                        />
                      </div>

                      {/* Invalidation Mode */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Invalidation</span>
                          <span className="text-xs text-gray-500">Trigger for zone invalidation when price breaks boundary</span>
                        </div>
                        <select
                          id="settings-obv-invalidation"
                          value={settings.indicators.obvInvalidation ?? 'Wick'}
                          onChange={(e) => handleUpdateIndicators('obvInvalidation', e.target.value as 'Wick' | 'Close')}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="Wick">Wick (High / Low Touch)</option>
                          <option value="Close">Close (Candle Body Close)</option>
                        </select>
                      </div>

                      {/* Show Nearest */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Nearest</span>
                          <span className="text-xs text-gray-500">Maximum nearest active order blocks to display (Default: 10)</span>
                        </div>
                        <input
                          id="settings-obv-show-nearest"
                          type="number"
                          min={1}
                          max={50}
                          value={settings.indicators.obvShowNearest ?? 10}
                          onChange={(e) => handleUpdateIndicators('obvShowNearest', parseInt(e.target.value) || 10)}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-mono text-right"
                        />
                      </div>

                      {/* Extend Zones */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Extend Zones</span>
                          <span className="text-xs text-gray-500">Number of forward bars to extend active unmitigated zones (Default: 10)</span>
                        </div>
                        <input
                          id="settings-obv-extend-zones"
                          type="number"
                          min={0}
                          max={100}
                          value={settings.indicators.obvExtendZones ?? 10}
                          onChange={(e) => handleUpdateIndicators('obvExtendZones', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-mono text-right"
                        />
                      </div>

                      {/* Hide Invalidated Zones */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Hide Invalidated Zones</span>
                          <span className="text-xs text-gray-500">Remove zones once price breaks through boundary (Default: Yes)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.obvHideInvalidatedZones ?? true}
                            onChange={(e) => handleUpdateIndicators('obvHideInvalidatedZones', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* VOLUME METRICS HEADER */}
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-400 border-b border-neutral-800 pb-1 pt-2">
                        Volume Metrics
                      </div>

                      {/* Enable Volume Delta */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Enable Volume Delta</span>
                          <span className="text-xs text-gray-500">Split zones into Buy Volume (Green) and Sell Volume (Red) (Default: Yes)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.obvEnableVolumeDelta ?? true}
                            onChange={(e) => handleUpdateIndicators('obvEnableVolumeDelta', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Display Total Volume */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Display Total Volume</span>
                          <span className="text-xs text-gray-500">Show institutional total volume label on right edge of zone (Default: Yes)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.obvDisplayTotalVolume ?? true}
                            onChange={(e) => handleUpdateIndicators('obvDisplayTotalVolume', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Show Delta % */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Delta %</span>
                          <span className="text-xs text-gray-500">Show centered Buy % and Sell % inside zone segments (Default: Yes)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.obvShowDeltaPercent ?? true}
                            onChange={(e) => handleUpdateIndicators('obvShowDeltaPercent', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* AESTHETICS & COLORS HEADER */}
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1 pt-2">
                        Aesthetics &amp; Colors
                      </div>

                      {/* Bullish Block Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Bullish Block Color</span>
                          <span className="text-xs text-gray-500">Color for Buy Volume / Bullish demand zone</span>
                        </div>
                        <input
                          id="settings-obv-bullish-color"
                          type="color"
                          value={settings.indicators.obvBullishColor ?? '#2e7d32'}
                          onChange={(e) => handleUpdateIndicators('obvBullishColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>

                      {/* Bearish Block Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Bearish Block Color</span>
                          <span className="text-xs text-gray-500">Color for Sell Volume / Bearish supply zone</span>
                        </div>
                        <input
                          id="settings-obv-bearish-color"
                          type="color"
                          value={settings.indicators.obvBearishColor ?? '#881337'}
                          onChange={(e) => handleUpdateIndicators('obvBearishColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>

                      {/* Total Vol Text Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Total Vol Text Color</span>
                          <span className="text-xs text-gray-500">Color for outside right volume text label</span>
                        </div>
                        <input
                          id="settings-obv-total-vol-color"
                          type="color"
                          value={settings.indicators.obvTotalVolColor ?? '#00aaff'}
                          onChange={(e) => handleUpdateIndicators('obvTotalVolColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>

                      {/* Delta % Text Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Delta % Text Color</span>
                          <span className="text-xs text-gray-500">Color for inside % text labels</span>
                        </div>
                        <input
                          id="settings-obv-delta-text-color"
                          type="color"
                          value={settings.indicators.obvDeltaTextColor ?? '#ffffff'}
                          onChange={(e) => handleUpdateIndicators('obvDeltaTextColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 20: PRO Order Blocks [Live 8-Score & Shadow] */}
              {!isIndicatorDeleted('pro_ob') && isProActivated && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isProObActive) || (indicatorFilter === 'not_added' && !isProObActive)) && (
                <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-200">PRO Order Blocks [Live 8-Score &amp; Shadow]</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                            PRO LIVE SMC
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Zero-lag live order blocks with forward shadow projection &amp; 8-factor confluence strength score (1-8 &amp; 0-100%).
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-pro-ob"
                        type="checkbox"
                        checked={isProObActive}
                        onChange={(e) => handleUpdateIndicators('showProOrderBlocks', e.target.checked)}
                        className="w-4 h-4 text-emerald-500 bg-neutral-800 rounded border-neutral-700 focus:ring-emerald-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'pro_ob', name: 'PRO Order Blocks [Live 8-Score & Shadow]' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isProObActive && (
                    <div className="pl-12 space-y-3 pt-2 border-t border-neutral-900">
                      {/* SHADOW & PROJECTION HEADER */}
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-neutral-800 pb-1">
                        Shadow &amp; Forward Projection
                      </div>

                      {/* Shadow Visibility Toggle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Shadow Visibility</span>
                          <span className="text-xs text-gray-500">Show luminous forward shadow zone across the chart (Default: ON)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-pro-ob-show-shadow"
                            type="checkbox"
                            checked={settings.indicators.proObShowShadow ?? true}
                            onChange={(e) => handleUpdateIndicators('proObShowShadow', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Shadow Opacity % */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Shadow Opacity</span>
                          <span className="text-xs text-gray-500">Soft luminous shadow intensity (Default: 25%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="settings-pro-ob-shadow-opacity"
                            type="range"
                            min="5"
                            max="70"
                            step="5"
                            value={settings.indicators.proObShadowOpacity ?? 25}
                            onChange={(e) => handleUpdateIndicators('proObShadowOpacity', parseInt(e.target.value))}
                            className="w-24 accent-emerald-500"
                          />
                          <span className="text-xs font-mono text-emerald-400 w-9 text-right font-bold">
                            {settings.indicators.proObShadowOpacity ?? 25}%
                          </span>
                        </div>
                      </div>

                      {/* Forward Projection Distance (Bars) */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Forward Shadow Projection</span>
                          <span className="text-xs text-gray-500">Number of bars into future space (Default: 20 bars)</span>
                        </div>
                        <input
                          id="settings-pro-ob-extend-bars"
                          type="number"
                          min="5"
                          max="60"
                          value={settings.indicators.proObExtendBars ?? 20}
                          onChange={(e) => handleUpdateIndicators('proObExtendBars', Math.max(5, parseInt(e.target.value) || 20))}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-right text-sm text-gray-200"
                        />
                      </div>

                      {/* 8-FACTOR SCORING & STRENGTH HEADER */}
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1 pt-2">
                        8-Factor Scoring &amp; Confluence Strength
                      </div>

                      {/* Minimum Score Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Minimum Confluence Score</span>
                          <span className="text-xs text-gray-500">Filter out weak blocks (1 = All, 4 = Standard, 6+ = High Conviction)</span>
                        </div>
                        <select
                          id="settings-pro-ob-min-score"
                          value={settings.indicators.proObMinScore ?? 4}
                          onChange={(e) => handleUpdateIndicators('proObMinScore', parseInt(e.target.value))}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-sm text-gray-200 cursor-pointer"
                        >
                          <option value="1">1 / 8 (Show All)</option>
                          <option value="2">2 / 8 (25%+ Strength)</option>
                          <option value="3">3 / 8 (38%+ Strength)</option>
                          <option value="4">4 / 8 (50%+ Standard)</option>
                          <option value="5">5 / 8 (63%+ Moderate)</option>
                          <option value="6">6 / 8 (75%+ Strong)</option>
                          <option value="7">7 / 8 (88%+ High Institutional)</option>
                          <option value="8">8 / 8 (100% Ultra Conviction)</option>
                        </select>
                      </div>

                      {/* Show Strength % Inside Shadow */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Display Strength % inside Shadow</span>
                          <span className="text-xs text-gray-500">Shows calculated strength percentage from 100% inside shadow</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-pro-ob-show-strength"
                            type="checkbox"
                            checked={settings.indicators.proObShowStrengthPercent ?? true}
                            onChange={(e) => handleUpdateIndicators('proObShowStrengthPercent', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Show [X/8] Score inside Shadow */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Display Score [1-8] inside Shadow</span>
                          <span className="text-xs text-gray-500">Shows [X/8] factor count inside the shadow zone</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-pro-ob-show-score"
                            type="checkbox"
                            checked={settings.indicators.proObShowScore ?? true}
                            onChange={(e) => handleUpdateIndicators('proObShowScore', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Show Only Unmitigated Blocks */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Only Fresh Unmitigated Blocks</span>
                          <span className="text-xs text-gray-500">Hide touched/mitigated blocks to prioritize virgin liquidity</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-pro-ob-unmitigated"
                            type="checkbox"
                            checked={settings.indicators.proObShowOnlyUnmitigated ?? false}
                            onChange={(e) => handleUpdateIndicators('proObShowOnlyUnmitigated', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* AESTHETICS & COLORS HEADER */}
                      <div className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b border-neutral-800 pb-1 pt-2">
                        Colors &amp; Styling
                      </div>

                      {/* Bullish Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Bullish Demand Color</span>
                          <span className="text-xs text-gray-500">Color for Bullish Order Block &amp; Shadow</span>
                        </div>
                        <input
                          id="settings-pro-ob-bull-color"
                          type="color"
                          value={settings.indicators.proObBullishColor ?? '#10b981'}
                          onChange={(e) => handleUpdateIndicators('proObBullishColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>

                      {/* Bearish Color */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Bearish Supply Color</span>
                          <span className="text-xs text-gray-500">Color for Bearish Order Block &amp; Shadow</span>
                        </div>
                        <input
                          id="settings-pro-ob-bear-color"
                          type="color"
                          value={settings.indicators.proObBearishColor ?? '#f43f5e'}
                          onChange={(e) => handleUpdateIndicators('proObBearishColor', e.target.value)}
                          className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 21: Market Tick Two [MarkitTick] — Enhanced Filters */}
              {!isIndicatorDeleted('mstt') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMsttActive) || (indicatorFilter === 'not_added' && !isMsttActive)) && (
                <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <SlidersHorizontal className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-200">Market Tick Two [MarkitTick]</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-mono">
                            PINE v6 ENHANCED FILTERS
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Market Structure Target Tracker — Enhanced Filters Edition: 15M Structure Bias Filter (HH/HL vs LH/LL), Extreme Wick Filter, Liquidity Sweep Filter, Dynamic BOS/CHoCH breakouts, Target Projections, Auto-Invalidation &amp; 17-Metric Live HUD.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-mstt"
                        type="checkbox"
                        checked={isMsttActive}
                        onChange={(e) => {
                          handleUpdateIndicators('showMarketStructureTargetTracker', e.target.checked);
                          handleUpdateIndicators('showMarketTickTwo', e.target.checked);
                        }}
                        className="w-4 h-4 text-amber-500 bg-neutral-800 rounded border-neutral-700 focus:ring-amber-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'mstt', name: 'Market Tick Two [MarkitTick]' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isMsttActive && (
                    <div className="pl-12 space-y-3 pt-2 border-t border-neutral-900">
                      {/* GROUP: BOS */}
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1">
                        BOS Settings
                      </div>

                      {/* Swing Length */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Swing Length</span>
                          <span className="text-xs text-gray-500">Pivot detection lookback bars (min: 3, max: 50, default: 5)</span>
                        </div>
                        <input
                          id="settings-mstt-swing-len"
                          type="number"
                          min={3}
                          max={50}
                          value={settings.indicators.msttSwingLen ?? 5}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              handleUpdateIndicators('msttSwingLen', 5);
                              return;
                            }
                            const val = parseInt(raw, 10);
                            if (!isNaN(val)) {
                              handleUpdateIndicators('msttSwingLen', Math.min(50, Math.max(3, val)));
                            }
                          }}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-amber-500 text-center font-mono"
                        />
                      </div>

                      {/* GROUP: ADVANCED FILTERS (Enhanced Filters Edition) */}
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-neutral-800 pb-1 pt-2">
                        Advanced Filters (Enhanced Filters Edition)
                      </div>

                      {/* 15M Structure Bias Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Structure Bias Filter (HH/HL vs LH/LL)</span>
                          <span className="text-xs text-gray-500">Only permit Bull BOS on higher highs/higher lows, Bear BOS on lower highs/lower lows</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-structure-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseStructureFilter ?? true}
                            onChange={(e) => handleUpdateIndicators('msttUseStructureFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Structure Timeframe & Swing Length */}
                      {(settings.indicators.msttUseStructureFilter ?? true) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-xs font-medium text-gray-300 block mb-1">Structure Timeframe</span>
                            <select
                              id="settings-mstt-structure-tf"
                              value={settings.indicators.msttStructureTf ?? '15'}
                              onChange={(e) => handleUpdateIndicators('msttStructureTf', e.target.value)}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                            >
                              <option value="5">5M (5 Minutes)</option>
                              <option value="15">15M (15 Minutes - Default)</option>
                              <option value="30">30M (30 Minutes)</option>
                              <option value="60">1H (60 Minutes)</option>
                              <option value="240">4H (240 Minutes)</option>
                            </select>
                          </div>
                          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-xs font-medium text-gray-300 block mb-1">Structure Swing Length</span>
                            <input
                              id="settings-mstt-filter-swing-len"
                              type="number"
                              min={2}
                              max={20}
                              value={settings.indicators.msttFilterSwingLen ?? 5}
                              onChange={(e) => handleUpdateIndicators('msttFilterSwingLen', Math.max(2, Math.min(20, parseInt(e.target.value) || 5)))}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Extreme Wick Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Extreme Wick Filter</span>
                          <span className="text-xs text-gray-500">Reject breakout candles with oversized counter-trend wicks</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-wick-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseWickFilter ?? true}
                            onChange={(e) => handleUpdateIndicators('msttUseWickFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Max Relevant Wick Ratio */}
                      {(settings.indicators.msttUseWickFilter ?? true) && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Max Relevant Wick / Candle Range</span>
                            <span className="text-xs text-gray-500">Maximum permitted wick ratio (0.10 - 0.95, default: 0.70)</span>
                          </div>
                          <input
                            id="settings-mstt-max-wick-ratio"
                            type="number"
                            step={0.05}
                            min={0.10}
                            max={0.95}
                            value={settings.indicators.msttMaxWickRatio ?? 0.70}
                            onChange={(e) => handleUpdateIndicators('msttMaxWickRatio', Math.max(0.10, Math.min(0.95, parseFloat(e.target.value) || 0.70)))}
                            className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-emerald-500 text-center font-mono"
                          />
                        </div>
                      )}

                      {/* Liquidity Sweep Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Liquidity Sweep Filter</span>
                          <span className="text-xs text-gray-500">Require recent sweep of prior high/low liquidity before breakout</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-sweep-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseSweepFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseSweepFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Sweep Lookback Bars */}
                      {(settings.indicators.msttUseSweepFilter ?? false) && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Sweep Lookback Bars</span>
                            <span className="text-xs text-gray-500">Maximum bars since liquidity sweep (min: 1, max: 50, default: 10)</span>
                          </div>
                          <input
                            id="settings-mstt-sweep-lookback"
                            type="number"
                            min={1}
                            max={50}
                            value={settings.indicators.msttSweepLookback ?? 10}
                            onChange={(e) => handleUpdateIndicators('msttSweepLookback', Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                            className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-emerald-500 text-center font-mono"
                          />
                        </div>
                      )}

                      {/* Candle Body Close Confirmation */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Candle Body Close Confirmation</span>
                          <span className="text-xs text-gray-500">Require close beyond swing level with minimum candle body-to-range ratio</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-body-close-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseBodyCloseFilter ?? true}
                            onChange={(e) => handleUpdateIndicators('msttUseBodyCloseFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Minimum Body / Candle Range */}
                      {(settings.indicators.msttUseBodyCloseFilter ?? true) && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Minimum Body / Candle Range</span>
                            <span className="text-xs text-gray-500">Minimum body ratio (0.10 - 0.95, default: 0.50)</span>
                          </div>
                          <input
                            id="settings-mstt-min-body-ratio"
                            type="number"
                            step={0.05}
                            min={0.10}
                            max={0.95}
                            value={settings.indicators.msttMinBodyRatio ?? 0.50}
                            onChange={(e) => handleUpdateIndicators('msttMinBodyRatio', Math.max(0.10, Math.min(0.95, parseFloat(e.target.value) || 0.50)))}
                            className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-emerald-500 text-center font-mono"
                          />
                        </div>
                      )}

                      {/* Displacement Candle Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Displacement Candle Filter</span>
                          <span className="text-xs text-gray-500">Require breakout candle body to exceed a minimum ATR multiple</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-displacement-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseDisplacementFilter ?? true}
                            onChange={(e) => handleUpdateIndicators('msttUseDisplacementFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Minimum Body Size (ATR x) */}
                      {(settings.indicators.msttUseDisplacementFilter ?? true) && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Minimum Body Size (ATR x)</span>
                            <span className="text-xs text-gray-500">Displacement threshold (0.10 - 3.0, default: 0.80 ATR)</span>
                          </div>
                          <input
                            id="settings-mstt-min-displacement-atr"
                            type="number"
                            step={0.10}
                            min={0.10}
                            max={3.0}
                            value={settings.indicators.msttMinDisplacementAtr ?? 0.80}
                            onChange={(e) => handleUpdateIndicators('msttMinDisplacementAtr', Math.max(0.10, Math.min(3.0, parseFloat(e.target.value) || 0.80)))}
                            className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-emerald-500 text-center font-mono"
                          />
                        </div>
                      )}

                      {/* Fair Value Gap (FVG) Confirmation */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Fair Value Gap (FVG) Confirmation</span>
                          <span className="text-xs text-gray-500">Require an active 3-candle FVG gap (bull: low &gt; high[2], bear: high &lt; low[2])</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-fvg-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseFvgFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseFvgFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Relative Volume Confirmation */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Relative Volume Confirmation</span>
                          <span className="text-xs text-gray-500">Gated by volume spike relative to moving average baseline</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-volume-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseVolumeFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseVolumeFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Volume Average Length & Volume Multiplier */}
                      {(settings.indicators.msttUseVolumeFilter ?? false) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-xs font-medium text-gray-300 block mb-1">Volume Average Length</span>
                            <input
                              id="settings-mstt-vol-len"
                              type="number"
                              min={2}
                              max={100}
                              value={settings.indicators.msttVolumeLength ?? 20}
                              onChange={(e) => handleUpdateIndicators('msttVolumeLength', Math.max(2, Math.min(100, parseInt(e.target.value) || 20)))}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                            />
                          </div>
                          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-xs font-medium text-gray-300 block mb-1">Volume vs Average (x)</span>
                            <input
                              id="settings-mstt-vol-mult"
                              type="number"
                              step={0.10}
                              min={1.0}
                              max={5.0}
                              value={settings.indicators.msttVolumeMultiplier ?? 1.20}
                              onChange={(e) => handleUpdateIndicators('msttVolumeMultiplier', Math.max(1.0, Math.min(5.0, parseFloat(e.target.value) || 1.20)))}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Continuation Confluence Score Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-300">Continuation Confluence Score Filter</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-300 rounded font-mono">0 - 100</span>
                          </div>
                          <span className="text-xs text-gray-500">Heuristic score: Body (+20), Displacement (+20), FVG (+20), Volume (+20), Sweep (+20)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-score-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseScoreFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseScoreFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Minimum Continuation Score (0-100) */}
                      {(settings.indicators.msttUseScoreFilter ?? false) && (
                        <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-300">Minimum Continuation Score</span>
                              <span className="text-xs text-gray-500">Required confluence threshold (20 - 100, default: 60)</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {settings.indicators.msttMinContinuationScore ?? 60} / 100 pts
                            </span>
                          </div>
                          <input
                            id="settings-mstt-min-score"
                            type="range"
                            min={20}
                            max={100}
                            step={10}
                            value={settings.indicators.msttMinContinuationScore ?? 60}
                            onChange={(e) => handleUpdateIndicators('msttMinContinuationScore', parseInt(e.target.value) || 60)}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                          <div className="grid grid-cols-5 gap-1 pt-1 text-[10px] text-center font-mono">
                            <span className="bg-neutral-950 p-1 rounded border border-neutral-800 text-neutral-400">Body +20</span>
                            <span className="bg-neutral-950 p-1 rounded border border-neutral-800 text-neutral-400">Disp +20</span>
                            <span className="bg-neutral-950 p-1 rounded border border-neutral-800 text-neutral-400">FVG +20</span>
                            <span className="bg-neutral-950 p-1 rounded border border-neutral-800 text-neutral-400">Vol +20</span>
                            <span className="bg-neutral-950 p-1 rounded border border-neutral-800 text-neutral-400">Sweep +20</span>
                          </div>
                        </div>
                      )}

                      {/* GROUP: SIGNAL FILTERS */}
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-neutral-800 pb-1 pt-2">
                        Signal Filters (Pine Script v6 Improved v2)
                      </div>

                      {/* EMA Trend Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">EMA Trend Filter</span>
                          <span className="text-xs text-gray-500">Only permit Bull BOS above EMA and Bear BOS below EMA</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-ema-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseEmaFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseEmaFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* EMA Length */}
                      {(settings.indicators.msttUseEmaFilter ?? false) && (
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">EMA Length</span>
                            <span className="text-xs text-gray-500">Trend baseline length (min: 20, max: 500, default: 200)</span>
                          </div>
                          <input
                            id="settings-mstt-ema-len"
                            type="number"
                            min={20}
                            max={500}
                            value={settings.indicators.msttEmaLen ?? 200}
                            onChange={(e) => handleUpdateIndicators('msttEmaLen', Math.max(20, Math.min(500, parseInt(e.target.value) || 200)))}
                            className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-emerald-500 text-center font-mono"
                          />
                        </div>
                      )}

                      {/* ADX + DI Filter */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">ADX + DI Filter</span>
                          <span className="text-xs text-gray-500">Require minimum trend strength (ADX) and directional index confirmation (+DI &gt; -DI)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-adx-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseAdxFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseAdxFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* ADX params */}
                      {(settings.indicators.msttUseAdxFilter ?? false) && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-xs font-medium text-gray-300 block mb-1">DI Length</span>
                            <input
                              type="number"
                              min={2}
                              max={50}
                              value={settings.indicators.msttDiLen ?? 14}
                              onChange={(e) => handleUpdateIndicators('msttDiLen', Math.max(2, Math.min(50, parseInt(e.target.value) || 14)))}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                            />
                          </div>
                          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-xs font-medium text-gray-300 block mb-1">ADX Smoothing</span>
                            <input
                              type="number"
                              min={2}
                              max={50}
                              value={settings.indicators.msttAdxSmooth ?? 14}
                              onChange={(e) => handleUpdateIndicators('msttAdxSmooth', Math.max(2, Math.min(50, parseInt(e.target.value) || 14)))}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                            />
                          </div>
                          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                            <span className="text-xs font-medium text-gray-300 block mb-1">Minimum ADX</span>
                            <input
                              type="number"
                              step={0.5}
                              min={5}
                              max={50}
                              value={settings.indicators.msttMinAdx ?? 18.0}
                              onChange={(e) => handleUpdateIndicators('msttMinAdx', Math.max(5, Math.min(50, parseFloat(e.target.value) || 18.0)))}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Strong Breakout Candle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Strong Breakout Candle</span>
                          <span className="text-xs text-gray-500">Require breakout candle body to exceed a fraction of ATR</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-candle-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseCandleFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseCandleFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Min Candle Body & Breakout Buffer */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300 block mb-1">Min Candle Body (ATR)</span>
                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            max={2}
                            value={settings.indicators.msttMinBodyAtr ?? 0.20}
                            onChange={(e) => handleUpdateIndicators('msttMinBodyAtr', Math.max(0, Math.min(2, parseFloat(e.target.value) || 0.20)))}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                          />
                        </div>
                        <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300 block mb-1">Breakout Buffer (ATR)</span>
                          <input
                            type="number"
                            step={0.01}
                            min={0}
                            max={0.50}
                            value={settings.indicators.msttBreakoutBufferAtr ?? 0.00}
                            onChange={(e) => handleUpdateIndicators('msttBreakoutBufferAtr', Math.max(0, Math.min(0.50, parseFloat(e.target.value) || 0.00)))}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* GROUP: VISIBILITY & APPEARANCE */}
                      <div className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b border-neutral-800 pb-1 pt-2">
                        Visibility &amp; Appearance
                      </div>

                      {/* Show BOS Triangle Markers */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show BOS Triangle Plotshapes</span>
                          <span className="text-xs text-gray-500">Display ▲ Bullish / ▼ Bearish BOS triangles under/above signal candles</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-show-markers"
                            type="checkbox"
                            checked={settings.indicators.msttShowSignalMarkers ?? true}
                            onChange={(e) => handleUpdateIndicators('msttShowSignalMarkers', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* Show BOS Line */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show BOS Line</span>
                          <span className="text-xs text-gray-500">Display dashed structural breakout line</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-show-bos-line"
                            type="checkbox"
                            checked={settings.indicators.msttShowBosLine ?? true}
                            onChange={(e) => handleUpdateIndicators('msttShowBosLine', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* Show Labels */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Labels</span>
                          <span className="text-xs text-gray-500">Display ▲ BOS / ▼ CHoCH structure labels</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-show-label"
                            type="checkbox"
                            checked={settings.indicators.msttShowLabel ?? true}
                            onChange={(e) => handleUpdateIndicators('msttShowLabel', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* Auto-Invalidate */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Auto-Invalidate</span>
                          <span className="text-xs text-gray-500">Automatically cancel active structure when price breaks opposite invalid swing</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-invalidate-mode"
                            type="checkbox"
                            checked={settings.indicators.msttInvalidateMode ?? true}
                            onChange={(e) => handleUpdateIndicators('msttInvalidateMode', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* Colors: Bull BOS, Bear BOS, Target, Target Hit */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Bull BOS Color</span>
                          <input
                            id="settings-mstt-col-bull-bos"
                            type="color"
                            value={toHexColor(settings.indicators.msttColBullBos, '#00c878')}
                            onChange={(e) => handleUpdateIndicators('msttColBullBos', e.target.value)}
                            className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Bear BOS Color</span>
                          <input
                            id="settings-mstt-col-bear-bos"
                            type="color"
                            value={toHexColor(settings.indicators.msttColBearBos, '#dc3232')}
                            onChange={(e) => handleUpdateIndicators('msttColBearBos', e.target.value)}
                            className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Target Color</span>
                          <input
                            id="settings-mstt-col-target"
                            type="color"
                            value={toHexColor(settings.indicators.msttColTarget, '#ffc800')}
                            onChange={(e) => handleUpdateIndicators('msttColTarget', e.target.value)}
                            className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Target Hit Color</span>
                          <input
                            id="settings-mstt-col-hit"
                            type="color"
                            value={toHexColor(settings.indicators.msttColHit, '#b464ff')}
                            onChange={(e) => handleUpdateIndicators('msttColHit', e.target.value)}
                            className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* GROUP: SL / TP */}
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-neutral-800 pb-1 pt-2">
                        SL &amp; TP Settings
                      </div>

                      {/* Show Entry/SL/TP */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Entry/SL/TP (Master)</span>
                          <span className="text-xs text-gray-500">Master switch for entry bracket, targets and shaded zones</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-show-tpsl"
                            type="checkbox"
                            checked={settings.indicators.msttShowTpSl ?? true}
                            onChange={(e) => handleUpdateIndicators('msttShowTpSl', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* TARGETS VISIBILITY (Each On/Off Method) */}
                      <div className="space-y-2 p-3 bg-neutral-900/80 rounded-lg border border-neutral-800">
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                          Target Visibility (On / Off)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* SL Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-rose-400">✕ SL</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-sl"
                                type="checkbox"
                                checked={settings.indicators.msttShowSl ?? true}
                                onChange={(e) => handleUpdateIndicators('msttShowSl', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500"></div>
                            </label>
                          </div>

                          {/* TP1 Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-emerald-400">● TP1</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-tp1"
                                type="checkbox"
                                checked={settings.indicators.msttShowTp1 ?? ((settings.indicators.msttTargetFocus ?? 'TP1') === 'TP1' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'TP1_AND_TP2' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'ALL')}
                                onChange={(e) => handleUpdateIndicators('msttShowTp1', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          {/* TP2 Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-teal-400">★ TP2</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-tp2"
                                type="checkbox"
                                checked={settings.indicators.msttShowTp2 ?? ((settings.indicators.msttTargetFocus ?? 'TP1') === 'TP2' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'TP1_AND_TP2' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'ALL')}
                                onChange={(e) => handleUpdateIndicators('msttShowTp2', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-500"></div>
                            </label>
                          </div>

                          {/* TP3 Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-cyan-400">◆ TP3</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-tp3"
                                type="checkbox"
                                checked={settings.indicators.msttShowTp3 ?? ((settings.indicators.msttTargetFocus ?? 'TP1') === 'TP3' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'ALL')}
                                onChange={(e) => handleUpdateIndicators('msttShowTp3', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* SHADES VISIBILITY (Each On/Off Method) */}
                      <div className="space-y-2 p-3 bg-neutral-900/80 rounded-lg border border-neutral-800">
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                          Shade Area Visibility (On / Off)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* SL Shade Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-rose-300">SL Shade</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-sl-shade"
                                type="checkbox"
                                checked={settings.indicators.msttShowSlShade ?? true}
                                onChange={(e) => handleUpdateIndicators('msttShowSlShade', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500"></div>
                            </label>
                          </div>

                          {/* TP1 Shade Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-emerald-300">TP1 Shade</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-tp1-shade"
                                type="checkbox"
                                checked={settings.indicators.msttShowTp1Shade ?? ((settings.indicators.msttTargetFocus ?? 'TP1') === 'TP1' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'TP1_AND_TP2' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'ALL')}
                                onChange={(e) => handleUpdateIndicators('msttShowTp1Shade', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          {/* TP2 Shade Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-teal-300">TP2 Shade</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-tp2-shade"
                                type="checkbox"
                                checked={settings.indicators.msttShowTp2Shade ?? ((settings.indicators.msttTargetFocus ?? 'TP1') === 'TP2' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'TP1_AND_TP2' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'ALL')}
                                onChange={(e) => handleUpdateIndicators('msttShowTp2Shade', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-500"></div>
                            </label>
                          </div>

                          {/* TP3 Shade Toggle */}
                          <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-cyan-300">TP3 Shade</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                id="settings-mstt-show-tp3-shade"
                                type="checkbox"
                                checked={settings.indicators.msttShowTp3Shade ?? ((settings.indicators.msttTargetFocus ?? 'TP1') === 'TP3' || (settings.indicators.msttTargetFocus ?? 'TP1') === 'ALL')}
                                onChange={(e) => handleUpdateIndicators('msttShowTp3Shade', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* CUSTOM COLORS & SHADE COLORS */}
                      <div className="space-y-2 p-3 bg-neutral-900/80 rounded-lg border border-neutral-800">
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                          Custom Line &amp; Shade Colors
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Entry Line Color */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-sky-400">► Entry Line</span>
                            <input
                              id="settings-mstt-col-entry"
                              type="color"
                              value={toHexColor(settings.indicators.msttColEntry, '#64b4ff')}
                              onChange={(e) => handleUpdateIndicators('msttColEntry', e.target.value)}
                              className="w-10 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                            />
                          </div>

                          {/* SL Line & Shade Colors */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-rose-400">✕ SL Line &amp; Shade</span>
                            <div className="flex items-center gap-2">
                              <input
                                id="settings-mstt-col-sl"
                                type="color"
                                title="SL Line Color"
                                value={toHexColor(settings.indicators.msttColSl, '#ff3c3c')}
                                onChange={(e) => handleUpdateIndicators('msttColSl', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                              <input
                                id="settings-mstt-col-sl-shade"
                                type="color"
                                title="SL Shade Color"
                                value={toHexColor(settings.indicators.msttColSlShade, '#ff3c3c')}
                                onChange={(e) => handleUpdateIndicators('msttColSlShade', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* TP1 Line & Shade Colors */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-emerald-400">● TP1 Line &amp; Shade</span>
                            <div className="flex items-center gap-2">
                              <input
                                id="settings-mstt-col-tp1"
                                type="color"
                                title="TP1 Line Color"
                                value={toHexColor(settings.indicators.msttColTp1, '#00dc82')}
                                onChange={(e) => handleUpdateIndicators('msttColTp1', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                              <input
                                id="settings-mstt-col-tp1-shade"
                                type="color"
                                title="TP1 Shade Color"
                                value={toHexColor(settings.indicators.msttColTp1Shade, '#00dc82')}
                                onChange={(e) => handleUpdateIndicators('msttColTp1Shade', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* TP2 Line & Shade Colors */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-teal-400">★ TP2 Line &amp; Shade</span>
                            <div className="flex items-center gap-2">
                              <input
                                id="settings-mstt-col-tp2"
                                type="color"
                                title="TP2 Line Color"
                                value={toHexColor(settings.indicators.msttColTp2, '#00ffb4')}
                                onChange={(e) => handleUpdateIndicators('msttColTp2', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                              <input
                                id="settings-mstt-col-tp2-shade"
                                type="color"
                                title="TP2 Shade Color"
                                value={toHexColor(settings.indicators.msttColTp2Shade, '#00ffb4')}
                                onChange={(e) => handleUpdateIndicators('msttColTp2Shade', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* TP3 Line & Shade Colors */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-800">
                            <span className="text-xs font-medium text-cyan-400">◆ TP3 Line &amp; Shade</span>
                            <div className="flex items-center gap-2">
                              <input
                                id="settings-mstt-col-tp3"
                                type="color"
                                title="TP3 Line Color"
                                value={toHexColor(settings.indicators.msttColTp3, '#00ffff')}
                                onChange={(e) => handleUpdateIndicators('msttColTp3', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                              <input
                                id="settings-mstt-col-tp3-shade"
                                type="color"
                                title="TP3 Shade Color"
                                value={toHexColor(settings.indicators.msttColTp3Shade, '#00ffff')}
                                onChange={(e) => handleUpdateIndicators('msttColTp3Shade', e.target.value)}
                                className="w-7 h-7 bg-neutral-950 border border-neutral-800 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Shade Opacities */}
                        <div className="pt-2 border-t border-neutral-800">
                          <span className="text-[11px] font-semibold text-gray-400 block mb-1">
                            Shade Opacity (%)
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                              <span className="text-[10px] text-gray-400">SL</span>
                              <input
                                id="settings-mstt-sl-alpha"
                                type="number"
                                min={1}
                                max={100}
                                value={Math.round((settings.indicators.msttSlShadeAlpha ?? 0.30) * 100)}
                                onChange={(e) => handleUpdateIndicators('msttSlShadeAlpha', Math.max(1, Math.min(100, parseInt(e.target.value) || 30)) / 100)}
                                className="w-12 px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-white text-center font-mono"
                              />
                            </div>
                            <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                              <span className="text-[10px] text-gray-400">TP1</span>
                              <input
                                id="settings-mstt-tp1-alpha"
                                type="number"
                                min={1}
                                max={100}
                                value={Math.round((settings.indicators.msttTp1ShadeAlpha ?? 0.30) * 100)}
                                onChange={(e) => handleUpdateIndicators('msttTp1ShadeAlpha', Math.max(1, Math.min(100, parseInt(e.target.value) || 30)) / 100)}
                                className="w-12 px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-white text-center font-mono"
                              />
                            </div>
                            <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                              <span className="text-[10px] text-gray-400">TP2</span>
                              <input
                                id="settings-mstt-tp2-alpha"
                                type="number"
                                min={1}
                                max={100}
                                value={Math.round((settings.indicators.msttTp2ShadeAlpha ?? 0.15) * 100)}
                                onChange={(e) => handleUpdateIndicators('msttTp2ShadeAlpha', Math.max(1, Math.min(100, parseInt(e.target.value) || 15)) / 100)}
                                className="w-12 px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-white text-center font-mono"
                              />
                            </div>
                            <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                              <span className="text-[10px] text-gray-400">TP3</span>
                              <input
                                id="settings-mstt-tp3-alpha"
                                type="number"
                                min={1}
                                max={100}
                                value={Math.round((settings.indicators.msttTp3ShadeAlpha ?? 0.05) * 100)}
                                onChange={(e) => handleUpdateIndicators('msttTp3ShadeAlpha', Math.max(1, Math.min(100, parseInt(e.target.value) || 5)) / 100)}
                                className="w-12 px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-white text-center font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Target Sizing Mode (ATR vs Written Points/Pips) */}
                      <div className="space-y-3 p-3 bg-neutral-900/80 rounded-lg border border-neutral-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                              SL &amp; TP Sizing Mode
                            </span>
                            <span className="text-[11px] text-gray-400">
                              Follow exact written Points / Pips or dynamic ATR volatility multipliers
                            </span>
                          </div>
                          <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800 gap-1 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleUpdateIndicators('msttTargetMode', 'points')}
                              className={`px-3 py-1 text-xs rounded font-medium transition-all ${(settings.indicators.msttTargetMode ?? 'atr') === 'points' ? 'bg-amber-500 text-neutral-950 font-bold shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                              Points / Pips
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateIndicators('msttTargetMode', 'atr')}
                              className={`px-3 py-1 text-xs rounded font-medium transition-all ${(settings.indicators.msttTargetMode ?? 'atr') === 'atr' ? 'bg-emerald-500 text-neutral-950 font-bold shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                              ATR Multiplier
                            </button>
                          </div>
                        </div>

                        {(settings.indicators.msttTargetMode ?? 'atr') === 'points' ? (
                          <div className="space-y-2">
                            <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                              ⚡ <strong>Written Points Mode Active:</strong> SL &amp; TP directly follow the exact numbers written below (e.g. 220 SL, 1030 TP1).
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-rose-500/30">
                                <span className="text-[11px] font-semibold text-rose-400">SL (Points/Pips)</span>
                                <input
                                  id="settings-mstt-points-sl"
                                  type="number"
                                  step={1}
                                  min={1}
                                  value={settings.indicators.msttPointsSl ?? 220}
                                  onChange={(e) => handleUpdateIndicators('msttPointsSl', Math.max(1, parseFloat(e.target.value) || 220))}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-rose-300 font-bold text-center font-mono focus:border-rose-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-emerald-500/30">
                                <span className="text-[11px] font-semibold text-emerald-400">TP1 (Points/Pips)</span>
                                <input
                                  id="settings-mstt-points-tp1"
                                  type="number"
                                  step={1}
                                  min={1}
                                  value={settings.indicators.msttPointsTp1 ?? 1030}
                                  onChange={(e) => handleUpdateIndicators('msttPointsTp1', Math.max(1, parseFloat(e.target.value) || 1030))}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-emerald-300 font-bold text-center font-mono focus:border-emerald-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-teal-500/30">
                                <span className="text-[11px] font-semibold text-teal-400">TP2 (Points/Pips)</span>
                                <input
                                  id="settings-mstt-points-tp2"
                                  type="number"
                                  step={1}
                                  min={1}
                                  value={settings.indicators.msttPointsTp2 ?? 2060}
                                  onChange={(e) => handleUpdateIndicators('msttPointsTp2', Math.max(1, parseFloat(e.target.value) || 2060))}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-teal-300 font-bold text-center font-mono focus:border-teal-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-cyan-500/30">
                                <span className="text-[11px] font-semibold text-cyan-400">TP3 (Points/Pips)</span>
                                <input
                                  id="settings-mstt-points-tp3"
                                  type="number"
                                  step={1}
                                  min={1}
                                  value={settings.indicators.msttPointsTp3 ?? 3090}
                                  onChange={(e) => handleUpdateIndicators('msttPointsTp3', Math.max(1, parseFloat(e.target.value) || 3090))}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-cyan-300 font-bold text-center font-mono focus:border-cyan-500"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-[11px] text-emerald-300 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                              📐 <strong>ATR Multiplier Mode Active:</strong> Target sizes scale dynamically with market volatility (ATR × multiplier).
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                                <span className="text-[11px] font-semibold text-rose-400">SL ATR Multi</span>
                                <input
                                  id="settings-mstt-sl-multi"
                                  type="number"
                                  step={0.1}
                                  min={0.1}
                                  max={10.0}
                                  value={settings.indicators.msttSlMulti ?? 1.0}
                                  onChange={(e) => handleUpdateIndicators('msttSlMulti', parseFloat(e.target.value) || 1.0)}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                                />
                              </div>
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                                <span className="text-[11px] font-semibold text-emerald-400">TP1 ATR Multi</span>
                                <input
                                  id="settings-mstt-tp1-multi"
                                  type="number"
                                  step={0.1}
                                  min={0.1}
                                  max={20.0}
                                  value={settings.indicators.msttTp1Multi ?? 1.5}
                                  onChange={(e) => handleUpdateIndicators('msttTp1Multi', parseFloat(e.target.value) || 1.5)}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                                />
                              </div>
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                                <span className="text-[11px] font-semibold text-teal-400">TP2 ATR Multi</span>
                                <input
                                  id="settings-mstt-tp2-multi"
                                  type="number"
                                  step={0.1}
                                  min={0.1}
                                  max={20.0}
                                  value={settings.indicators.msttTp2Multi ?? 3.0}
                                  onChange={(e) => handleUpdateIndicators('msttTp2Multi', parseFloat(e.target.value) || 3.0)}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                                />
                              </div>
                              <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                                <span className="text-[11px] font-semibold text-cyan-400">TP3 ATR Multi</span>
                                <input
                                  id="settings-mstt-tp3-multi"
                                  type="number"
                                  step={0.1}
                                  min={0.1}
                                  max={20.0}
                                  value={settings.indicators.msttTp3Multi ?? 5.0}
                                  onChange={(e) => handleUpdateIndicators('msttTp3Multi', parseFloat(e.target.value) || 5.0)}
                                  className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ATR Length */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">ATR Length</span>
                          <span className="text-xs text-gray-500">Period for volatility calculations (min: 1, max: 50, default: 14)</span>
                        </div>
                        <input
                          id="settings-mstt-atr-len"
                          type="number"
                          min={1}
                          max={50}
                          value={settings.indicators.msttAtrLen ?? 14}
                          onChange={(e) => handleUpdateIndicators('msttAtrLen', Math.min(50, Math.max(1, parseInt(e.target.value) || 14)))}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono"
                        />
                      </div>

                      {/* GROUP: HTF FILTER */}
                      <div className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-neutral-800 pb-1 pt-2">
                        Higher Timeframe (HTF) Filter
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">HTF Filter via RSI</span>
                          <span className="text-xs text-gray-500">Only take Bull BOS when HTF RSI &gt; 50, Bear BOS when HTF RSI &lt; 50</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-htf-filter"
                            type="checkbox"
                            checked={settings.indicators.msttUseHtfFilter ?? false}
                            onChange={(e) => handleUpdateIndicators('msttUseHtfFilter', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                        </label>
                      </div>

                      {/* HTF Resolution */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">HTF Timeframe (Res)</span>
                          <span className="text-xs text-gray-500">Higher timeframe resolution for macro trend filtering</span>
                        </div>
                        <select
                          id="settings-mstt-htf-res"
                          value={settings.indicators.msttHtfRes ?? '240'}
                          onChange={(e) => handleUpdateIndicators('msttHtfRes', e.target.value)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                        >
                          <option value="15">15M (15 Minutes)</option>
                          <option value="30">30M (30 Minutes)</option>
                          <option value="60">1H (60 Minutes)</option>
                          <option value="120">2H (120 Minutes)</option>
                          <option value="240">4H (240 Minutes - Default)</option>
                          <option value="1440">1D (Daily - 1440m)</option>
                        </select>
                      </div>

                      {/* HTF RSI Length */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">HTF RSI Length</span>
                          <span className="text-xs text-gray-500">Period for higher timeframe RSI calculation (min: 2, max: 100, default: 14)</span>
                        </div>
                        <input
                          id="settings-mstt-htf-rsi-len"
                          type="number"
                          min={2}
                          max={100}
                          value={settings.indicators.msttHtfRsiLen ?? 14}
                          onChange={(e) => handleUpdateIndicators('msttHtfRsiLen', Math.max(2, Math.min(100, parseInt(e.target.value) || 14)))}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white text-center font-mono focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* GROUP: DASHBOARD TABLE */}
                      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 border-b border-neutral-800 pb-1 pt-2">
                        Dashboard Table
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show HUD Dashboard</span>
                          <span className="text-xs text-gray-500">Display top-right table with trend, HTF RSI bar, target status &amp; R:R</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-show-dashboard"
                            type="checkbox"
                            checked={settings.indicators.msttShowDashboard ?? true}
                            onChange={(e) => handleUpdateIndicators('msttShowDashboard', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* GROUP: PERFORMANCE TRACKING & KEEPN */}
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-neutral-800 pb-1 pt-2">
                        Performance Tracking &amp; KeepN Audit Log
                      </div>

                      {/* KeepN Trades Setting */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">KeepN Trades Evaluated</span>
                          <span className="text-xs text-gray-500">Calculates Win Rate, Total Trades, Won/Loss, and Consec W/L for the last N trades (min: 0, max: 1000, default: 10)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="settings-mstt-keep-n"
                            type="number"
                            min={0}
                            max={1000}
                            value={settings.indicators.msttKeepN ?? 10}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              handleUpdateIndicators('msttKeepN', isNaN(parsed) ? 0 : Math.min(1000, Math.max(0, parsed)));
                            }}
                            className="w-24 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-emerald-400 font-bold text-center font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Target Focus Setting (TP1 / TP2 / TP3 / Both / ALL) */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-neutral-900 rounded-lg border border-emerald-500/30 gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-emerald-300">Win Target Benchmark &amp; Visibility</span>
                          <span className="text-xs text-gray-400">
                            Select which Target to show on Chart/HUD and evaluate as WIN (TP1 Only, TP2 Only, Both TP1 &amp; TP2, etc.)
                          </span>
                        </div>
                        <select
                          id="settings-mstt-target-focus"
                          value={settings.indicators.msttTargetFocus ?? 'TP1'}
                          onChange={(e) => {
                            const val = e.target.value as 'TP1' | 'TP2' | 'TP3' | 'TP1_AND_TP2' | 'ALL';
                            handleUpdateIndicators('msttTargetFocus', val);
                            if (val === 'TP1') {
                              handleUpdateIndicators('msttShowTp1', true);
                              handleUpdateIndicators('msttShowTp2', false);
                              handleUpdateIndicators('msttShowTp3', false);
                              handleUpdateIndicators('msttShowTp1Shade', true);
                              handleUpdateIndicators('msttShowTp2Shade', false);
                              handleUpdateIndicators('msttShowTp3Shade', false);
                            } else if (val === 'TP2') {
                              handleUpdateIndicators('msttShowTp1', false);
                              handleUpdateIndicators('msttShowTp2', true);
                              handleUpdateIndicators('msttShowTp3', false);
                              handleUpdateIndicators('msttShowTp1Shade', false);
                              handleUpdateIndicators('msttShowTp2Shade', true);
                              handleUpdateIndicators('msttShowTp3Shade', false);
                            } else if (val === 'TP1_AND_TP2') {
                              handleUpdateIndicators('msttShowTp1', true);
                              handleUpdateIndicators('msttShowTp2', true);
                              handleUpdateIndicators('msttShowTp3', false);
                              handleUpdateIndicators('msttShowTp1Shade', true);
                              handleUpdateIndicators('msttShowTp2Shade', true);
                              handleUpdateIndicators('msttShowTp3Shade', false);
                            } else if (val === 'TP3') {
                              handleUpdateIndicators('msttShowTp1', false);
                              handleUpdateIndicators('msttShowTp2', false);
                              handleUpdateIndicators('msttShowTp3', true);
                              handleUpdateIndicators('msttShowTp1Shade', false);
                              handleUpdateIndicators('msttShowTp2Shade', false);
                              handleUpdateIndicators('msttShowTp3Shade', true);
                            } else if (val === 'ALL') {
                              handleUpdateIndicators('msttShowTp1', true);
                              handleUpdateIndicators('msttShowTp2', true);
                              handleUpdateIndicators('msttShowTp3', true);
                              handleUpdateIndicators('msttShowTp1Shade', true);
                              handleUpdateIndicators('msttShowTp2Shade', true);
                              handleUpdateIndicators('msttShowTp3Shade', true);
                            }
                          }}
                          className="px-3 py-1.5 bg-neutral-950 border border-emerald-500/40 rounded text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 font-mono"
                        >
                          <option value="TP1">TP1 Only (Show Only TP1 &amp; Track TP1 Win)</option>
                          <option value="TP2">TP2 Only (Show Only TP2 &amp; Track TP2 Win)</option>
                          <option value="TP1_AND_TP2">Both (Show Both TP1 &amp; TP2 &amp; Track Both)</option>
                          <option value="TP3">TP3 Only (Show Only TP3 &amp; Track TP3 Win)</option>
                          <option value="ALL">ALL (Show TP1, TP2, TP3 &amp; Track All)</option>
                        </select>
                      </div>

                      {/* Show Historical Trade Brackets */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Historical Trade Brackets</span>
                          <span className="text-xs text-gray-500">Render entry, TP, SL brackets and outcome tags on chart for the last keepN trades</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-show-historical-trades"
                            type="checkbox"
                            checked={settings.indicators.msttShowHistoricalTrades ?? true}
                            onChange={(e) => handleUpdateIndicators('msttShowHistoricalTrades', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* GROUP: ANTI-LAG & LATE SIGNAL PREVENTION */}
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-400 border-b border-neutral-800 pb-1 pt-2">
                        Anti-Lag &amp; Late Signal Prevention
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Prevent Late &amp; Overextended Signals</span>
                          <span className="text-xs text-gray-500">
                            Stops signals from printing late (candles after breakout) or when price has already reached or is near TP1
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-mstt-prevent-late-entry"
                            type="checkbox"
                            checked={settings.indicators.msttPreventLateEntry ?? true}
                            onChange={(e) => handleUpdateIndicators('msttPreventLateEntry', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Max Breakout Delay (Bars)</span>
                          <span className="text-xs text-gray-500">
                            Maximum allowed delay between swing break and signal confirmation (0 = instant break candle only, 1 = default)
                          </span>
                        </div>
                        <input
                          id="settings-mstt-max-breakout-delay"
                          type="number"
                          min={0}
                          max={3}
                          value={settings.indicators.msttMaxBreakoutDelay ?? 1}
                          onChange={(e) => handleUpdateIndicators('msttMaxBreakoutDelay', Math.max(0, Math.min(3, parseInt(e.target.value) || 0)))}
                          className="w-20 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-rose-300 font-bold text-center font-mono focus:border-rose-500"
                        />
                      </div>

                      {/* GROUP: 24/7 CLOUD TELEGRAM ALERTS & CRON SYNC (cron-job.org) */}
                      <div className="mt-4 pt-3 border-t border-sky-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                              <span>🤖</span> 24/7 Cloud Telegram Alerts (cron-job.org)
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                              CLOUD SERVERLESS
                            </span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.msttTgAlertsEnabled ?? false}
                              onChange={(e) => {
                                const nextVal = e.target.checked;
                                handleUpdateIndicators('msttTgAlertsEnabled', nextVal);
                                handleSyncCloudSettings({ ...settings.indicators, msttTgAlertsEnabled: nextVal });
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500"></div>
                          </label>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed">
                          ስልክዎ ቢጠፋ፣ ኮምፒውተርዎ ቢዘጋ ወይም Internet ባይኖርም እንኳን <b>cron-job.org</b> ከደመና (Cloud API) ላይ Deriv candles እየፈተሸ አዲስ የ BOS Signal ሲወጣ ወዲያውኑ ወደ Telegram ቦትዎ ሙሉ SL &amp; TP መረጃ የያዘ መልእክት ይልካል።
                        </p>

                        {/* Telegram Bot Token Input */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <label className="font-medium text-gray-300">Telegram Bot Token</label>
                            <button
                              type="button"
                              onClick={() => setShowTgTokenSecret(!showTgTokenSecret)}
                              className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
                            >
                              {showTgTokenSecret ? 'ደብቅ (Hide)' : 'አሳይ (Show)'}
                            </button>
                          </div>
                          <input
                            type={showTgTokenSecret ? 'text' : 'password'}
                            value={settings.indicators.msttTgBotToken || ''}
                            onChange={(e) => handleUpdateIndicators('msttTgBotToken', e.target.value)}
                            placeholder="7123456789:AAHxxxxx..."
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-gray-200 focus:outline-none focus:border-sky-500 placeholder-neutral-600"
                          />
                        </div>

                        {/* Telegram Chat ID Input */}
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-300">Your Telegram Chat ID</label>
                          <input
                            type="text"
                            value={settings.indicators.msttTgChatId || ''}
                            onChange={(e) => handleUpdateIndicators('msttTgChatId', e.target.value)}
                            placeholder="e.g. 583920194 or @channel_username"
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-gray-200 focus:outline-none focus:border-sky-500 placeholder-neutral-600"
                          />
                        </div>

                        {/* Pair & Timeframe for Cloud Monitoring */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-400 mb-1">Target Pair / Symbol</label>
                            <input
                              type="text"
                              value={settings.indicators.msttTgSymbol || '1HZ75V'}
                              onChange={(e) => handleUpdateIndicators('msttTgSymbol', e.target.value)}
                              placeholder="1HZ75V"
                              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-sky-300 font-bold focus:outline-none focus:border-sky-500"
                            />
                            <span className="text-[10px] text-gray-500">1HZ75V = Volatility 75 (1s)</span>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-400 mb-1">Alert Timeframe</label>
                            <select
                              value={settings.indicators.msttTgTimeframe || '1H'}
                              onChange={(e) => handleUpdateIndicators('msttTgTimeframe', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                            >
                              <option value="1M">1 Minute (1M)</option>
                              <option value="5M">5 Minutes (5M)</option>
                              <option value="15M">15 Minutes (15M)</option>
                              <option value="30M">30 Minutes (30M)</option>
                              <option value="1H">1 Hour (1H)</option>
                              <option value="4H">4 Hours (4H)</option>
                            </select>
                            <span className="text-[10px] text-gray-500">Matches chart timeframe</span>
                          </div>
                        </div>

                        {/* Action Buttons: Test Connection & Sync Active Rules */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={tgAlertTesting}
                            onClick={handleTestTgCloudAlert}
                            className="flex-1 min-w-[130px] px-3 py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            <span>{tgAlertTesting ? '⏳ እየሞከረ ነው...' : '📨 Test Telegram Bot'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={tgAlertSyncing}
                            onClick={() => handleSyncCloudSettings()}
                            className="flex-1 min-w-[150px] px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            <span>{tgAlertSyncing ? '⏳ Sync እየተደረገ ነው...' : '🔄 Sync Settings to Cloud'}</span>
                          </button>
                        </div>

                        {/* Feedback message banner */}
                        {tgAlertMsg && (
                          <div
                            className={`p-2.5 rounded-lg text-xs font-medium border ${
                              tgAlertMsg.type === 'success'
                                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                                : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                            }`}
                          >
                            {tgAlertMsg.text}
                          </div>
                        )}

                        {/* Step-by-Step CRON-JOB.ORG URL Box */}
                        <div className="p-3 bg-neutral-950/90 rounded-lg border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                              <span>🔗</span> ወደ cron-job.org የምትገለብጠው URL:
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app';
                                const token = (settings.indicators.msttTgBotToken || '').trim();
                                const chat = (settings.indicators.msttTgChatId || '').trim();
                                const sym = settings.indicators.msttTgSymbol || '1HZ75V';
                                const tf = settings.indicators.msttTgTimeframe || '1H';
                                const sl = settings.indicators.msttPointsSl ?? 220;
                                const tp1 = settings.indicators.msttPointsTp1 ?? 1030;
                                const tfocus = settings.indicators.msttTargetFocus || 'TP1';

                                let cronUrl = `${origin}/api/cron-check`;
                                if (token && chat) {
                                  cronUrl += `?token=${encodeURIComponent(token)}&chat=${encodeURIComponent(chat)}&symbol=${encodeURIComponent(sym)}&tf=${encodeURIComponent(tf)}&sl=${sl}&tp1=${tp1}&targetFocus=${encodeURIComponent(tfocus)}`;
                                }
                                navigator.clipboard.writeText(cronUrl);
                                setCronUrlCopied(true);
                                setTimeout(() => setCronUrlCopied(false), 3000);
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-sky-400 rounded border border-neutral-700 transition-colors"
                            >
                              {cronUrlCopied ? '✅ ተገልብጧል (Copied)!' : 'ኮፒ አድርግ (Copy URL)'}
                            </button>
                          </div>
                          <div className="p-2 bg-neutral-900 rounded border border-neutral-850 text-[11px] font-mono text-amber-300 break-all select-all">
                            {(() => {
                              const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app';
                              const token = (settings.indicators.msttTgBotToken || '').trim();
                              const chat = (settings.indicators.msttTgChatId || '').trim();
                              const sym = settings.indicators.msttTgSymbol || '1HZ75V';
                              const tf = settings.indicators.msttTgTimeframe || '1H';
                              const sl = settings.indicators.msttPointsSl ?? 220;
                              const tp1 = settings.indicators.msttPointsTp1 ?? 1030;
                              const tfocus = settings.indicators.msttTargetFocus || 'TP1';

                              let url = `${origin}/api/cron-check`;
                              if (token && chat) {
                                url += `?token=${encodeURIComponent(token)}&chat=${encodeURIComponent(chat)}&symbol=${encodeURIComponent(sym)}&tf=${encodeURIComponent(tf)}&sl=${sl}&tp1=${tp1}&targetFocus=${encodeURIComponent(tfocus)}`;
                              }
                              return url;
                            })()}
                          </div>
                          <div className="text-[11px] text-gray-400 space-y-1">
                            <p><b>1.</b> በ <b>cron-job.org</b> ላይ <b>"CREATE CRONJOB"</b> የሚለውን ይጫኑ።</p>
                            <p><b>2.</b> ከላይ ያለውን URL <b>URL</b> በሚለው ሳጥን ውስጥ paste ያድርጉ።</p>
                            <p><b>3.</b> <b>Schedule</b> የሚለውን <b>"Every 1 minute"</b> ወይም <b>"Every 5 minutes"</b> ይምረጡ።</p>
                            <p><b>4.</b> <b>"CREATE"</b> ይበሉ። አበቃ! ከአሁን በኋላ ስልክ ቢዘጋም 24/7 signal ይላክልዎታል!</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator: VIP Market Scanner™ (VIP Algos) - Single Pair */}
              {!isIndicatorDeleted('vip_scanner') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isVipScannerActive) || (indicatorFilter === 'not_added' && !isVipScannerActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-sky-400 flex items-center gap-1.5">
                          ⚡ VIP Market Scanner™
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded font-mono">
                          VIP Algos
                        </span>
                        {isVipScannerActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        Multi-timeframe momentum, trend, volatility &amp; confluence matrix scanner for the active symbol (clean HUD without promotional watermarks)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-vip-scanner"
                        type="checkbox"
                        checked={isVipScannerActive}
                        onChange={(e) => handleUpdateIndicators('showVipMarketScanner', e.target.checked)}
                        className="w-4 h-4 text-sky-600 bg-neutral-800 rounded border-neutral-700 focus:ring-sky-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'vip_scanner', name: 'VIP Market Scanner™' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isVipScannerActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-sky-500/30 pt-1">
                      {/* Show Scanner HUD */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Scanner HUD Table</span>
                          <span className="text-xs text-gray-500">Displays multi-timeframe matrix table on chart</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id="settings-vip-show-hud"
                            type="checkbox"
                            checked={settings.indicators.vipScannerShowHud ?? true}
                            onChange={(e) => handleUpdateIndicators('vipScannerShowHud', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                      </div>

                      {/* Scanner HUD Position */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Scanner HUD Position</span>
                          <span className="text-xs text-gray-500">Placement anchor on chart canvas</span>
                        </div>
                        <select
                          id="settings-vip-position"
                          value={settings.indicators.vipScannerPosition ?? 'Top Left'}
                          onChange={(e) => handleUpdateIndicators('vipScannerPosition', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                        >
                          <option value="Top Left">Top Left</option>
                          <option value="Top Right">Top Right</option>
                          <option value="Bottom Left">Bottom Left</option>
                          <option value="Bottom Right">Bottom Right</option>
                        </select>
                      </div>

                      {/* Technical Periods Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">RSI Period</span>
                          <input
                            type="number"
                            min={2}
                            max={50}
                            value={settings.indicators.vipScannerRsiPeriod ?? 14}
                            onChange={(e) => handleUpdateIndicators('vipScannerRsiPeriod', parseInt(e.target.value) || 14)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Fast EMA</span>
                          <input
                            type="number"
                            min={2}
                            max={50}
                            value={settings.indicators.vipScannerFastEma ?? 9}
                            onChange={(e) => handleUpdateIndicators('vipScannerFastEma', parseInt(e.target.value) || 9)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Slow EMA</span>
                          <input
                            type="number"
                            min={5}
                            max={100}
                            value={settings.indicators.vipScannerSlowEma ?? 21}
                            onChange={(e) => handleUpdateIndicators('vipScannerSlowEma', parseInt(e.target.value) || 21)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Baseline EMA</span>
                          <input
                            type="number"
                            min={10}
                            max={200}
                            value={settings.indicators.vipScannerSignalEma ?? 50}
                            onChange={(e) => handleUpdateIndicators('vipScannerSignalEma', parseInt(e.target.value) || 50)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* Show Multi-TF Alignment Alerts */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Multi-TF Confluence Alerts</span>
                          <span className="text-xs text-gray-500">Alerts when 4 or more timeframes align direction</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.vipScannerShowSignals ?? true}
                            onChange={(e) => handleUpdateIndicators('vipScannerShowSignals', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator: Premium Signals with Dynamic TP & SL Optimization */}
              {!isIndicatorDeleted('dynamic_tpsl') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isDynamicTpSlActive) || (indicatorFilter === 'not_added' && !isDynamicTpSlActive)) && (
                <div className="p-3.5 bg-neutral-900/60 rounded-xl border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                          🎯 Premium Signals with Dynamic TP &amp; SL
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded font-mono">
                          Dual Channels + TP/SL
                        </span>
                        {isDynamicTpSlActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-950 text-neutral-500 border border-neutral-800 rounded-full">
                            Not Added
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        Dual dynamic volatility channels, strict 2-candle confirmation, 3 dynamic Take Profit levels (TP1/TP2/TP3), 50% TP3 volatility-adaptive Stop Loss, and real-time operation tracking
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        id="settings-toggle-dynamic-tpsl"
                        type="checkbox"
                        checked={isDynamicTpSlActive}
                        onChange={(e) => handleUpdateIndicators('showDynamicTpSlSignals', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 bg-neutral-800 rounded border-neutral-700 focus:ring-emerald-500 focus:ring-2 cursor-pointer shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'dynamic_tpsl', name: 'Premium Signals with Dynamic TP & SL Optimization' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isDynamicTpSlActive && (
                    <div className="space-y-3.5 pl-3 border-l-2 border-emerald-500/30 pt-1">
                      {/* GROUP: DUAL CHANNELS */}
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-400 border-b border-neutral-800 pb-1">
                        1️⃣ Dual Dynamic Channel Calculation
                      </div>

                      {/* Price Source */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Price Source</span>
                          <span className="text-xs text-gray-500">Applied source price for channel averages</span>
                        </div>
                        <select
                          value={settings.indicators.dynPriceSource ?? 'close'}
                          onChange={(e) => handleUpdateIndicators('dynPriceSource', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="close">Close</option>
                          <option value="open">Open</option>
                          <option value="high">High</option>
                          <option value="low">Low</option>
                          <option value="hl2">HL2 (High + Low) / 2</option>
                          <option value="hlc3">HLC3 (High + Low + Close) / 3</option>
                          <option value="ohlc4">OHLC4</option>
                        </select>
                      </div>

                      {/* Channel Periods & Multipliers */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-sky-300">Channel 1 Period</span>
                          <input
                            type="number"
                            min={3}
                            max={100}
                            value={settings.indicators.dynPeriod1 ?? 14}
                            onChange={(e) => handleUpdateIndicators('dynPeriod1', parseInt(e.target.value) || 14)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-sky-300">Channel 1 Mult</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            max={10}
                            value={settings.indicators.dynMultiplier1 ?? 1.5}
                            onChange={(e) => handleUpdateIndicators('dynMultiplier1', parseFloat(e.target.value) || 1.5)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-indigo-300">Channel 2 Period</span>
                          <input
                            type="number"
                            min={5}
                            max={200}
                            value={settings.indicators.dynPeriod2 ?? 34}
                            onChange={(e) => handleUpdateIndicators('dynPeriod2', parseInt(e.target.value) || 34)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-indigo-300">Channel 2 Mult</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            max={10}
                            value={settings.indicators.dynMultiplier2 ?? 2.5}
                            onChange={(e) => handleUpdateIndicators('dynMultiplier2', parseFloat(e.target.value) || 2.5)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* GROUP: DYNAMIC TP & SL OPTIMIZATION */}
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-neutral-800 pb-1 pt-2">
                        2️⃣ Dynamic TP &amp; SL Optimization
                      </div>

                      {/* TP1, TP2, TP3 factors & SL Ratio */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-emerald-300">TP1 Factor</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            max={10}
                            value={settings.indicators.dynTp1Factor ?? 1.0}
                            onChange={(e) => handleUpdateIndicators('dynTp1Factor', parseFloat(e.target.value) || 1.0)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-emerald-300">TP2 Factor</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            max={15}
                            value={settings.indicators.dynTp2Factor ?? 2.0}
                            onChange={(e) => handleUpdateIndicators('dynTp2Factor', parseFloat(e.target.value) || 2.0)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-emerald-300">TP3 Factor</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            max={20}
                            value={settings.indicators.dynTp3Factor ?? 3.0}
                            onChange={(e) => handleUpdateIndicators('dynTp3Factor', parseFloat(e.target.value) || 3.0)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-rose-300">SL Ratio (% of TP3)</span>
                          <input
                            type="number"
                            step={0.05}
                            min={0.1}
                            max={1.5}
                            value={settings.indicators.dynSlRatio ?? 0.50}
                            onChange={(e) => handleUpdateIndicators('dynSlRatio', parseFloat(e.target.value) || 0.50)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* Recent Amplitude Lookback */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Recent Price Range Lookback</span>
                          <span className="text-xs text-gray-500">Bars lookback to measure maximum/minimum range amplitude for TP/SL</span>
                        </div>
                        <input
                          type="number"
                          min={3}
                          max={50}
                          value={settings.indicators.dynRangeLookback ?? 10}
                          onChange={(e) => handleUpdateIndicators('dynRangeLookback', Math.max(3, parseInt(e.target.value) || 10))}
                          className="w-20 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-emerald-500 text-center font-mono"
                        />
                      </div>

                      {/* GROUP: REAL-TIME TRACKING & DISPLAY */}
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1 pt-2">
                        3️⃣ Real-Time Tracking &amp; Chart Displays
                      </div>

                      {/* Show Tracking Information Table */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Real-Time Tracking Table HUD</span>
                          <span className="text-xs text-gray-500">Quick view of active operation status, TP1/2/3 hits &amp; SL level</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.dynShowTable ?? true}
                            onChange={(e) => handleUpdateIndicators('dynShowTable', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Show Buy / Sell Signals */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show 2-Candle Confirmed Signals</span>
                          <span className="text-xs text-gray-500">Marks confirmed BUY 🟢 and SELL 🔴 entries on 2nd candle close</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.dynShowSignals ?? true}
                            onChange={(e) => handleUpdateIndicators('dynShowSignals', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Show TP & SL Lines */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Dynamic TP &amp; SL Target Lines</span>
                          <span className="text-xs text-gray-500">Draws TP1, TP2, TP3 and SL rays on active trade operation</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.dynShowTpSlLines ?? true}
                            onChange={(e) => handleUpdateIndicators('dynShowTpSlLines', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Show Dual Channels on Chart */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Show Dual Channels &amp; Fill</span>
                          <span className="text-xs text-gray-500">Renders Channel 1 &amp; Channel 2 boundary lines on canvas</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.dynShowChannels ?? true}
                            onChange={(e) => handleUpdateIndicators('dynShowChannels', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 24: Trade Planner Buy Sell Signals, Stop Loss, TP & Lot Size [LunqFX] */}
              {!isIndicatorDeleted('trade_planner') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isTradePlannerActive) || (indicatorFilter === 'not_added' && !isTradePlannerActive)) && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isTradePlannerActive
                    ? 'bg-neutral-900/60 border-neutral-750 shadow-md'
                    : 'bg-neutral-950/40 border-neutral-850 opacity-80 hover:opacity-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isTradePlannerActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        24
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-200">Trade Planner Buy Sell Signals, Stop Loss, TP &amp; Lot Size [LunqFX]</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-900/50 text-cyan-300 border border-cyan-700/50">
                            Pine Script v6
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Complete trade plan printed on bar close: Entry, ATR stop, 1R/2R/3R targets, account position sizing, and water-like value zone
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-md">
                        <span className={`w-1.5 h-1.5 rounded-full ${isTradePlannerActive ? 'bg-cyan-400 animate-pulse' : 'bg-neutral-600'}`} />
                        <span className={`text-[10px] font-mono font-bold ${isTradePlannerActive ? 'text-cyan-400' : 'text-neutral-500'}`}>
                          {isTradePlannerActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isTradePlannerActive}
                          onChange={(e) => handleUpdateIndicators('showTradePlanner', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'trade_planner', name: 'Trade Planner [LunqFX]' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isTradePlannerActive && (
                    <div className="mt-4 pt-4 border-t border-neutral-800 space-y-4">
                      {/* GROUP 1: SETUP & MOVING TREND */}
                      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 border-b border-neutral-800 pb-1">
                        1️⃣ Setup &amp; Trend Engine (Value Zone &amp; Moving EMA Lines)
                      </div>

                      {/* Signal Generation Mode & Touch Target */}
                      <div className="p-3 bg-neutral-900 rounded-lg border border-cyan-500/30 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
                          <div>
                            <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                              <span>🎯</span> Retest Signal Engine Mode
                            </div>
                            <div className="text-[10px] text-gray-400">
                              Choose how BUY/SELL signals trigger on EMA retests and pullbacks.
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateIndicators('tpRetestMode', 'retest_touch')}
                              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                                (settings.indicators.tpRetestMode ?? 'retest_touch') === 'retest_touch'
                                  ? 'bg-cyan-500 text-black font-semibold'
                                  : 'bg-neutral-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              Exact EMA Touch &amp; Reject (Recommended)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateIndicators('tpRetestMode', 'standard_pullback')}
                              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                                settings.indicators.tpRetestMode === 'standard_pullback'
                                  ? 'bg-cyan-500 text-black font-semibold'
                                  : 'bg-neutral-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              Classic Pullback
                            </button>
                          </div>
                        </div>

                        {/* Touch Line Target & Climax Protection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                          <div className="flex flex-col gap-1 p-2 bg-neutral-950/70 rounded border border-neutral-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                                <span>📍</span> Retest Touch Target
                              </span>
                              <span className="text-[10px] text-emerald-400">Excludes Fast-only touch</span>
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateIndicators('tpRetestTouchTarget', 'slow_ema')}
                                className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors text-center ${
                                  (settings.indicators.tpRetestTouchTarget ?? 'slow_ema') === 'slow_ema'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold'
                                    : 'bg-neutral-900 text-gray-400 hover:text-white border border-neutral-800'
                                }`}
                              >
                                Slow EMA Touch (User Setup)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateIndicators('tpRetestTouchTarget', 'both_emas')}
                                className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors text-center ${
                                  settings.indicators.tpRetestTouchTarget === 'both_emas'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold'
                                    : 'bg-neutral-900 text-gray-400 hover:text-white border border-neutral-800'
                                }`}
                              >
                                Either Fast or Slow EMA
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 p-2 bg-neutral-950/70 rounded border border-neutral-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1">
                                <span>🛡️</span> Climax Overextension &amp; Breakdown Shield
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateIndicators('tpExhaustionFilter', !(settings.indicators.tpExhaustionFilter ?? true))}
                                className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase transition-colors ${
                                  (settings.indicators.tpExhaustionFilter ?? true)
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : 'bg-neutral-800 text-gray-500 border border-neutral-700'
                                }`}
                              >
                                {(settings.indicators.tpExhaustionFilter ?? true) ? 'ON' : 'OFF'}
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                              <span>Max Runaway Climax Points:</span>
                              <input
                                type="number"
                                min={500}
                                step={500}
                                value={settings.indicators.tpMaxClimaxPoints ?? 5000}
                                onChange={(e) => handleUpdateIndicators('tpMaxClimaxPoints', Math.max(500, parseInt(e.target.value) || 5000))}
                                className="w-20 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-white text-center font-mono"
                              />
                            </div>
                            <span className="text-[9px] text-gray-500">
                              Blocks traps when 5,000+ pt moves collapse and smash through EMAs
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-gray-300">Fast EMA (Value Zone)</span>
                            <span className="text-[10px] text-gray-500 font-mono">3–500</span>
                          </div>
                          <input
                            type="number"
                            min={3}
                            max={500}
                            value={settings.indicators.tpFastLen ?? 21}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                handleUpdateIndicators('tpFastLen', '' as any);
                              } else {
                                const parsed = parseInt(val, 10);
                                if (!isNaN(parsed)) {
                                  handleUpdateIndicators('tpFastLen', Math.max(3, Math.min(500, parsed)));
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              if (isNaN(parsed) || parsed < 3) {
                                handleUpdateIndicators('tpFastLen', 3);
                              }
                            }}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-gray-300">Slow EMA (Trend)</span>
                            <span className="text-[10px] text-gray-500 font-mono">3–500</span>
                          </div>
                          <input
                            type="number"
                            min={3}
                            max={500}
                            value={settings.indicators.tpSlowLen ?? 50}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                handleUpdateIndicators('tpSlowLen', '' as any);
                              } else {
                                const parsed = parseInt(val, 10);
                                if (!isNaN(parsed)) {
                                  handleUpdateIndicators('tpSlowLen', Math.max(3, Math.min(500, parsed)));
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              if (isNaN(parsed) || parsed < 3) {
                                handleUpdateIndicators('tpSlowLen', 3);
                              }
                            }}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Momentum (RSI)</span>
                          <input
                            type="number"
                            min={2}
                            max={50}
                            value={settings.indicators.tpRsiLen ?? 14}
                            onChange={(e) => handleUpdateIndicators('tpRsiLen', Math.max(2, Math.min(50, parseInt(e.target.value) || 14)))}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Pullback Lookback (bars)</span>
                          <input
                            type="number"
                            min={2}
                            max={50}
                            value={settings.indicators.tpPbBars ?? 10}
                            onChange={(e) => handleUpdateIndicators('tpPbBars', Math.max(2, Math.min(50, parseInt(e.target.value) || 10)))}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-cyan-300">Zone Width (× ATR)</span>
                          <input
                            type="number"
                            step={0.05}
                            min={0.0}
                            max={2.0}
                            value={settings.indicators.tpZoneW ?? 0.25}
                            onChange={(e) => handleUpdateIndicators('tpZoneW', parseFloat(e.target.value) || 0.25)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-rose-300">Stop Buffer (× ATR)</span>
                          <input
                            type="number"
                            step={0.05}
                            min={0.0}
                            max={2.0}
                            value={settings.indicators.tpSlBuf ?? 0.20}
                            onChange={(e) => handleUpdateIndicators('tpSlBuf', parseFloat(e.target.value) || 0.20)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-rose-300">Min Stop (× ATR)</span>
                          <input
                            type="number"
                            step={0.05}
                            min={0.1}
                            max={3.0}
                            value={settings.indicators.tpMinStop ?? 0.50}
                            onChange={(e) => handleUpdateIndicators('tpMinStop', parseFloat(e.target.value) || 0.50)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-rose-300">Max Stop (× ATR)</span>
                          <input
                            type="number"
                            step={0.25}
                            min={0.5}
                            max={10.0}
                            value={settings.indicators.tpMaxStop ?? 3.0}
                            onChange={(e) => handleUpdateIndicators('tpMaxStop', parseFloat(e.target.value) || 3.0)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* GROUP 2: ACCOUNT & RISK */}
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1 pt-2">
                        2️⃣ Account &amp; Risk Sizing
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Account Balance</span>
                          <input
                            type="number"
                            min={1}
                            step={100}
                            value={settings.indicators.tpBalance ?? 10000}
                            onChange={(e) => handleUpdateIndicators('tpBalance', Math.max(1, parseFloat(e.target.value) || 10000))}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-amber-300">Risk per Trade %</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.01}
                            max={10}
                            value={settings.indicators.tpRiskPct ?? 1.0}
                            onChange={(e) => handleUpdateIndicators('tpRiskPct', parseFloat(e.target.value) || 1.0)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Account Currency</span>
                          <select
                            value={settings.indicators.tpAccCur ?? 'USD'}
                            onChange={(e) => handleUpdateIndicators('tpAccCur', e.target.value)}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-mono"
                          >
                            {['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'USDT'].map((cur) => (
                              <option key={cur} value={cur}>{cur}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Manual Lot Override (0=Auto)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.001}
                            value={settings.indicators.tpLotOver ?? 0}
                            onChange={(e) => handleUpdateIndicators('tpLotOver', Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* Deriv Broker & MT5 Contract Specifications */}
                      <div className="p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                          <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                            <span>⚡</span> Deriv Broker &amp; Standard MT5 Contract Engine
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">100 pips = $1.00 (V75)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <div className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-[11px] font-medium text-gray-300">Broker Asset Specification</span>
                            <select
                              value={settings.indicators.tpBrokerPreset ?? 'auto'}
                              onChange={(e) => handleUpdateIndicators('tpBrokerPreset', e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-mono focus:border-cyan-500"
                            >
                              <option value="deriv_v75">Deriv MT5 · Volatility 75 Index (100 pips = $1)</option>
                              <option value="auto">Deriv MT5 · Auto-Detect Symbol (V75, Boom/Crash, Step, Jump)</option>
                              <option value="deriv_boom_crash">Deriv MT5 · Boom &amp; Crash Indices (Min 0.20 lots)</option>
                              <option value="deriv_step">Deriv MT5 · Step Indices (Min 0.10 lots)</option>
                              <option value="forex">Standard MT5 · Forex Majors (1 Lot = 100,000)</option>
                              <option value="gold">Standard MT5 · Gold / Metals (1 Lot = 100 oz)</option>
                              <option value="custom">Custom Contract Specs</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-gray-300">Point Value ($/point)</span>
                            <input
                              type="number"
                              step={0.1}
                              min={0.01}
                              value={settings.indicators.tpPointValue ?? 1.0}
                              onChange={(e) => handleUpdateIndicators('tpPointValue', parseFloat(e.target.value) || 1.0)}
                              className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-cyan-500"
                            />
                            <span className="text-[9px] text-gray-500">$1.00 / pt (100 pips)</span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-gray-300">Min Lot Size (MT5)</span>
                            <input
                              type="number"
                              step={0.001}
                              min={0.001}
                              value={settings.indicators.tpMinLot ?? 0.001}
                              onChange={(e) => handleUpdateIndicators('tpMinLot', parseFloat(e.target.value) || 0.001)}
                              className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-cyan-500"
                            />
                            <span className="text-[9px] text-gray-500">Deriv V75 min = 0.001</span>
                          </div>
                        </div>

                        <div className="text-[10px] text-gray-400 bg-neutral-950/80 p-2 rounded border border-neutral-850">
                          💡 <strong className="text-gray-300">Deriv MT5 Precision:</strong> In Volatility 75 Index, 100 pips (1.00 full index point) are worth $1.00 per 1.0 lot. The position calculator calculates exact MT5 lots down to 0.001 lots to match your account balance and risk %.
                        </div>
                      </div>

                      {/* GROUP 3: TARGETS & MANAGEMENT */}
                      <div className="flex flex-col gap-2 border-b border-neutral-800 pb-2 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            3️⃣ Stop Loss &amp; Take Profit Targets
                          </span>
                          
                          {/* Target Mode Toggle Buttons */}
                          <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[10.5px]">
                            <button
                              type="button"
                              onClick={() => handleUpdateIndicators('tpTargetMode', 'r_multiple')}
                              className={`px-2 py-1 rounded transition-colors font-medium ${
                                (settings.indicators.tpTargetMode ?? 'r_multiple') === 'r_multiple'
                                  ? 'bg-neutral-800 text-emerald-400 shadow-sm'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              R-Multiple (Ratio)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateIndicators('tpTargetMode', 'cash_amount')}
                              className={`px-2 py-1 rounded transition-colors font-medium flex items-center gap-1 ${
                                settings.indicators.tpTargetMode === 'cash_amount'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50 shadow-sm'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              <span>💵</span> Fixed $ Amount
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateIndicators('tpTargetMode', 'pips')}
                              className={`px-2 py-1 rounded transition-colors font-medium flex items-center gap-1 ${
                                settings.indicators.tpTargetMode === 'pips'
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/50 shadow-sm'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              <span>📏</span> Exact Pips (220/1030)
                            </button>
                          </div>
                        </div>

                        {/* Quick Presets & Target Focus Header */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-neutral-950/70 p-2 rounded-lg border border-neutral-800 text-[10px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-gray-400 font-medium">Quick Presets:</span>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateIndicators('tpCashSl', 2.2);
                                handleUpdateIndicators('tpCashTp1', 10.3);
                                handleUpdateIndicators('tpCashTp2', 20.6);
                                handleUpdateIndicators('tpCashTp3', 30.9);
                                handleUpdateIndicators('tpPipsSl', 220);
                                handleUpdateIndicators('tpPipsTp1', 1030);
                                handleUpdateIndicators('tpPipsTp2', 2060);
                                handleUpdateIndicators('tpPipsTp3', 3090);
                              }}
                              className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-700/50 rounded font-mono font-semibold"
                            >
                              220 SL / 1030 TP1 ($2.2 / $10.3)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateIndicators('tpCashSl', 1.0);
                                handleUpdateIndicators('tpCashTp1', 1.0);
                                handleUpdateIndicators('tpCashTp2', 2.0);
                                handleUpdateIndicators('tpCashTp3', 3.0);
                                handleUpdateIndicators('tpPipsSl', 100);
                                handleUpdateIndicators('tpPipsTp1', 100);
                                handleUpdateIndicators('tpPipsTp2', 200);
                                handleUpdateIndicators('tpPipsTp3', 300);
                              }}
                              className="px-2 py-0.5 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/40 rounded font-mono"
                            >
                              $1 Fixed (100 Pips)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateIndicators('tpCashSl', 1.0);
                                handleUpdateIndicators('tpCashTp1', 2.0);
                                handleUpdateIndicators('tpCashTp2', 4.0);
                                handleUpdateIndicators('tpCashTp3', 6.0);
                                handleUpdateIndicators('tpPipsSl', 100);
                                handleUpdateIndicators('tpPipsTp1', 200);
                                handleUpdateIndicators('tpPipsTp2', 400);
                                handleUpdateIndicators('tpPipsTp3', 600);
                              }}
                              className="px-2 py-0.5 bg-neutral-850 hover:bg-neutral-800 text-gray-200 border border-neutral-750 rounded font-mono"
                            >
                              1:2 Ratio
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-amber-300 font-medium">Win Rate Focus:</span>
                            <select
                              value={settings.indicators.tpTargetFocus ?? 'TP1'}
                              onChange={(e) => handleUpdateIndicators('tpTargetFocus', e.target.value as any)}
                              className="px-2 py-0.5 bg-neutral-900 border border-amber-800/60 rounded text-[10px] text-amber-200 font-mono"
                            >
                              <option value="TP1">Target TP1 (Recommended)</option>
                              <option value="TP2">Target TP2</option>
                              <option value="TP3">Target TP3</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Mode A: Fixed Cash $ Amount Mode */}
                      {settings.indicators.tpTargetMode === 'cash_amount' ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* SL Cash $ */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-rose-900/60">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-rose-400">SL Loss ($)</span>
                                <span className="text-[9px] text-rose-500 font-mono">Exact Cash</span>
                              </div>
                              <div className="relative flex items-center">
                                <span className="absolute left-2.5 text-xs text-rose-400 font-mono font-bold">$</span>
                                <input
                                  type="number"
                                  step={0.1}
                                  min={0.01}
                                  max={1000}
                                  value={settings.indicators.tpCashSl ?? 1.0}
                                  onChange={(e) => handleUpdateIndicators('tpCashSl', Math.max(0.01, parseFloat(e.target.value) || 1.0))}
                                  className="w-full pl-6 pr-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-rose-500"
                                />
                              </div>
                              <span className="text-[9.5px] text-gray-400">Exact loss when SL hits</span>
                            </div>

                            {/* TP1 Cash $ */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-amber-900/50">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-amber-300">TP1 Win ($)</span>
                                <span className="text-[9px] text-amber-500 font-mono">Target 1</span>
                              </div>
                              <div className="relative flex items-center">
                                <span className="absolute left-2.5 text-xs text-amber-300 font-mono font-bold">$</span>
                                <input
                                  type="number"
                                  step={0.1}
                                  min={0.01}
                                  max={5000}
                                  value={settings.indicators.tpCashTp1 ?? 1.0}
                                  onChange={(e) => handleUpdateIndicators('tpCashTp1', Math.max(0.01, parseFloat(e.target.value) || 1.0))}
                                  className="w-full pl-6 pr-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-amber-500"
                                />
                              </div>
                              <span className="text-[9.5px] text-gray-400">Exact win when TP1 hits</span>
                            </div>

                            {/* TP2 Cash $ */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-emerald-900/50">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-emerald-300">TP2 Win ($)</span>
                                <span className="text-[9px] text-emerald-500 font-mono">Target 2</span>
                              </div>
                              <div className="relative flex items-center">
                                <span className="absolute left-2.5 text-xs text-emerald-300 font-mono font-bold">$</span>
                                <input
                                  type="number"
                                  step={0.1}
                                  min={0.01}
                                  max={5000}
                                  value={settings.indicators.tpCashTp2 ?? 2.0}
                                  onChange={(e) => handleUpdateIndicators('tpCashTp2', Math.max(0.01, parseFloat(e.target.value) || 2.0))}
                                  className="w-full pl-6 pr-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-emerald-500"
                                />
                              </div>
                              <span className="text-[9.5px] text-gray-400">Exact win when TP2 hits</span>
                            </div>

                            {/* TP3 Cash $ */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-cyan-900/50">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-cyan-300">TP3 Win ($)</span>
                                <span className="text-[9px] text-cyan-500 font-mono">Target 3</span>
                              </div>
                              <div className="relative flex items-center">
                                <span className="absolute left-2.5 text-xs text-cyan-300 font-mono font-bold">$</span>
                                <input
                                  type="number"
                                  step={0.1}
                                  min={0.01}
                                  max={5000}
                                  value={settings.indicators.tpCashTp3 ?? 3.0}
                                  onChange={(e) => handleUpdateIndicators('tpCashTp3', Math.max(0.01, parseFloat(e.target.value) || 3.0))}
                                  className="w-full pl-6 pr-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-cyan-500"
                                />
                              </div>
                              <span className="text-[9.5px] text-gray-400">Exact win when TP3 hits</span>
                            </div>
                          </div>

                          <div className="text-[10.5px] text-gray-300 bg-neutral-950/80 p-2.5 rounded-lg border border-emerald-900/30 flex items-start gap-2">
                            <span className="text-emerald-400 text-sm">💡</span>
                            <span>
                              <strong className="text-emerald-300">Exact Loss &amp; Win Price Engine:</strong> On Volatility 75 Index, 100 pips = $1.00. Setting <strong className="text-rose-400">-$2.20 SL</strong> is exactly 220 pips against entry, and <strong className="text-emerald-400">+$10.30 TP1</strong> is exactly 1030 pips in profit.
                            </span>
                          </div>
                        </>
                      ) : settings.indicators.tpTargetMode === 'pips' ? (
                        /* Mode C: Exact Pips Mode */
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* SL Pips */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-rose-900/60">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-rose-400">SL (Pips)</span>
                                <span className="text-[9px] text-rose-500 font-mono">220 Pips = $2.2</span>
                              </div>
                              <input
                                type="number"
                                step={10}
                                min={1}
                                max={50000}
                                value={settings.indicators.tpPipsSl ?? 220}
                                onChange={(e) => handleUpdateIndicators('tpPipsSl', Math.max(1, parseInt(e.target.value) || 220))}
                                className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-rose-500"
                              />
                              <span className="text-[9.5px] text-gray-400">Exact pips against entry for loss</span>
                            </div>

                            {/* TP1 Pips */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-amber-900/50">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-amber-300">TP1 (Pips)</span>
                                <span className="text-[9px] text-amber-500 font-mono">1030 Pips = $10.3</span>
                              </div>
                              <input
                                type="number"
                                step={10}
                                min={1}
                                max={100000}
                                value={settings.indicators.tpPipsTp1 ?? 1030}
                                onChange={(e) => handleUpdateIndicators('tpPipsTp1', Math.max(1, parseInt(e.target.value) || 1030))}
                                className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-amber-500"
                              />
                              <span className="text-[9.5px] text-gray-400">Exact pips in profit for win</span>
                            </div>

                            {/* TP2 Pips */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-emerald-900/50">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-emerald-300">TP2 (Pips)</span>
                                <span className="text-[9px] text-emerald-500 font-mono">Target 2</span>
                              </div>
                              <input
                                type="number"
                                step={10}
                                min={1}
                                max={100000}
                                value={settings.indicators.tpPipsTp2 ?? 2060}
                                onChange={(e) => handleUpdateIndicators('tpPipsTp2', Math.max(1, parseInt(e.target.value) || 2060))}
                                className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-emerald-500"
                              />
                              <span className="text-[9.5px] text-gray-400">Target 2 profit distance</span>
                            </div>

                            {/* TP3 Pips */}
                            <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-cyan-900/50">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-cyan-300">TP3 (Pips)</span>
                                <span className="text-[9px] text-cyan-500 font-mono">Target 3</span>
                              </div>
                              <input
                                type="number"
                                step={10}
                                min={1}
                                max={100000}
                                value={settings.indicators.tpPipsTp3 ?? 3090}
                                onChange={(e) => handleUpdateIndicators('tpPipsTp3', Math.max(1, parseInt(e.target.value) || 3090))}
                                className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-cyan-500"
                              />
                              <span className="text-[9.5px] text-gray-400">Target 3 profit distance</span>
                            </div>
                          </div>

                          <div className="text-[10.5px] text-gray-300 bg-neutral-950/80 p-2.5 rounded-lg border border-cyan-900/30 flex items-start gap-2">
                            <span className="text-cyan-400 text-sm">📏</span>
                            <span>
                              <strong className="text-cyan-300">Exact Pips Engine:</strong> Entry price is the opening price of the next candle after the arrow. The trade records a <strong className="text-rose-400">LOSS</strong> if price moves against it by {settings.indicators.tpPipsSl ?? 220} pips, or a <strong className="text-emerald-400">WIN</strong> if it moves in profit by {settings.indicators.tpPipsTp1 ?? 1030} pips!
                            </span>
                          </div>
                        </>
                      ) : (
                        /* Mode B: R-Multiple Ratio Mode */
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-rose-900/50">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-rose-400">SL Size (Multiplier)</span>
                              <span className="text-[9px] text-rose-500 font-mono">Stop R</span>
                            </div>
                            <input
                              type="number"
                              step={0.1}
                              min={0.1}
                              max={10}
                              value={settings.indicators.tpSlMult ?? 1.0}
                              onChange={(e) => handleUpdateIndicators('tpSlMult', parseFloat(e.target.value) || 1.0)}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-rose-500"
                            />
                            <span className="text-[9.5px] text-gray-400">1.0 = standard pullback stop</span>
                          </div>

                          <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-amber-900/40">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-amber-300">TP1 (R Multiple)</span>
                              <span className="text-[9px] text-amber-500 font-mono">Target 1</span>
                            </div>
                            <input
                              type="number"
                              step={0.25}
                              min={0.25}
                              max={20}
                              value={settings.indicators.tpR1 ?? 1.0}
                              onChange={(e) => handleUpdateIndicators('tpR1', parseFloat(e.target.value) || 1.0)}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-amber-500"
                            />
                            <span className="text-[9.5px] text-gray-400">Target 1 reward ratio</span>
                          </div>

                          <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-emerald-900/40">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-emerald-300">TP2 (R Multiple)</span>
                              <span className="text-[9px] text-emerald-500 font-mono">Target 2</span>
                            </div>
                            <input
                              type="number"
                              step={0.25}
                              min={0.25}
                              max={20}
                              value={settings.indicators.tpR2 ?? 2.0}
                              onChange={(e) => handleUpdateIndicators('tpR2', parseFloat(e.target.value) || 2.0)}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-emerald-500"
                            />
                            <span className="text-[9.5px] text-gray-400">Target 2 reward ratio</span>
                          </div>

                          <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-cyan-900/40">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-cyan-300">TP3 (R Multiple)</span>
                              <span className="text-[9px] text-cyan-500 font-mono">Target 3</span>
                            </div>
                            <input
                              type="number"
                              step={0.25}
                              min={0.25}
                              max={20}
                              value={settings.indicators.tpR3 ?? 3.0}
                              onChange={(e) => handleUpdateIndicators('tpR3', parseFloat(e.target.value) || 3.0)}
                              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white text-center font-mono focus:border-cyan-500"
                            />
                            <span className="text-[9.5px] text-gray-400">Target 3 reward ratio</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Move Stop to Entry After TP1</span>
                            <span className="text-xs text-gray-500">Breakeven protection once TP1 is secured</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpBeOn ?? false}
                              onChange={(e) => handleUpdateIndicators('tpBeOn', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Close on Opposite Signal</span>
                            <span className="text-xs text-gray-500">Auto-exit open plan if counter-trend signal fires</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpOppOn ?? true}
                              onChange={(e) => handleUpdateIndicators('tpOppOn', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>

                      {/* GROUP 4: QUALITY & TREND FILTERS (ON/OFF PRECISION SHIELD) */}
                      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 border-b border-neutral-800 pb-1 pt-2 flex items-center justify-between">
                        <span>4️⃣ Quality &amp; Trend Filters (On/Off Precision Shield)</span>
                        <span className="text-[10px] text-cyan-400/80 font-normal normal-case">Preserves ~4.55:1 R:R &amp; avoids sideways false entries</span>
                      </div>

                      {/* Strategy Context Callout */}
                      <div className="p-3 bg-neutral-950/80 border border-cyan-500/20 rounded-lg text-xs space-y-1.5">
                        <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          <span>Quantitative Edge &amp; Drawdown Shield:</span>
                        </div>
                        <p className="text-gray-300 text-[11px] leading-relaxed">
                          The main Trade Planner engine generates high-expectancy trend-pullback entries. However, during sideways or low-volatility conditions, oscillating prices can trigger avoidable losses.
                          These on/off filters prune out low-probability whipsaws while keeping the core 4.55:1 aggregate reward-to-risk ratio completely intact across hundreds of trades.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Filter 1: ADX Anti-Chop */}
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-gray-200">ADX Trend Strength Filter</span>
                            <span className="text-[11px] text-gray-400">Blocks entries when ADX(14) &lt; 20 (prunes sideways chop)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpFilterAdx ?? false}
                              onChange={(e) => handleUpdateIndicators('tpFilterAdx', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        {/* Filter 2: Slow EMA Slope Filter */}
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-gray-200">EMA Slope Angle Filter</span>
                            <span className="text-[11px] text-gray-400">Requires active Slow EMA trajectory (rejects flat consolidation)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpFilterSlope ?? false}
                              onChange={(e) => handleUpdateIndicators('tpFilterSlope', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        {/* Filter 3: RSI Exhaustion Guard */}
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-gray-200">RSI Exhaustion Guard</span>
                            <span className="text-[11px] text-gray-400">No BUY when RSI &gt; 70; no SELL when RSI &lt; 30 (prevents buying tops)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpFilterRsiExhaustion ?? false}
                              onChange={(e) => handleUpdateIndicators('tpFilterRsiExhaustion', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        {/* Filter 4: Candle Rejection Wick */}
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-gray-200">Rejection Wick Filter</span>
                            <span className="text-[11px] text-gray-400">Rejects entry candles with &gt;40% opposing wicks (anti-reversal)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpFilterWickRejection ?? false}
                              onChange={(e) => handleUpdateIndicators('tpFilterWickRejection', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        {/* Filter 5: Volatility Expansion */}
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-gray-200">Volatility Expansion Filter</span>
                            <span className="text-[11px] text-gray-400">Requires ATR &ge; 85% of baseline (avoids dead volume &amp; spreads)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpFilterVolatility ?? false}
                              onChange={(e) => handleUpdateIndicators('tpFilterVolatility', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        {/* Filter 6: Min Stop Distance Guard */}
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-gray-200">Min Stop Buffer Guard</span>
                            <span className="text-[11px] text-gray-400">Enforces min 0.75× ATR stop to protect against random market noise</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpFilterMinStopDist ?? false}
                              onChange={(e) => handleUpdateIndicators('tpFilterMinStopDist', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>
                      </div>

                      {/* GROUP 5: VISUALS, TOGGLES & HUD */}
                      <div className="text-xs font-bold uppercase tracking-wider text-pink-400 border-b border-neutral-800 pb-1 pt-2">
                        5️⃣ Visuals, Display Toggles &amp; HUD Panel
                      </div>

                      {/* Candle Palette */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Candle Palette</span>
                          <span className="text-xs text-gray-500">Choose custom neon or classic candle coloring</span>
                        </div>
                        <select
                          value={settings.indicators.tpCandSty ?? 'Neon Bloom'}
                          onChange={(e) => handleUpdateIndicators('tpCandSty', e.target.value as any)}
                          className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-mono"
                        >
                          {['Neon Bloom', 'Midnight Cyan', 'Vibrant Neon', 'Classic Soft', 'Cool Blue', 'Off'].map((sty) => (
                            <option key={sty} value={sty}>{sty}</option>
                          ))}
                        </select>
                      </div>

                      {/* Core On/Off Switches */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show Water-Like Value Zone</span>
                            <span className="text-xs text-gray-500">Translucent flowing ribbon along Fast EMA</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowZone ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowZone', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show EMA Moving Lines</span>
                            <span className="text-xs text-gray-500">Fast EMA (width 2) &amp; Slow EMA (width 1.2)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowEmaLines ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowEmaLines', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show Buy &amp; Sell Arrows</span>
                            <span className="text-xs text-gray-500">Clean entry arrows pointing up (BUY) &amp; down (SELL)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowSignals ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowSignals', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show BUY/SELL Pill Text</span>
                            <span className="text-xs text-gray-500">OFF removes "unit" and text badges, showing clean arrows only</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowEntryLabel ?? false}
                              onChange={(e) => handleUpdateIndicators('tpShowEntryLabel', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show Risk &amp; Reward Boxes</span>
                            <span className="text-xs text-gray-500">Shaded risk (red) and reward (cyan/pink) zones</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowPlans ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowPlans', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>
                      </div>

                      {/* Individual Target Toggles & Dotted Lines */}
                      <div className="p-3 bg-neutral-900/90 rounded-lg border border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-300">Individual Target Lines &amp; Tags</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-[11px] font-medium text-cyan-400">Show Dotted Level Lines</span>
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowDottedLines ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowDottedLines', e.target.checked)}
                              className="rounded text-cyan-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-850 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowSl ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowSl', e.target.checked)}
                              className="rounded text-rose-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                            />
                            <span className="text-xs font-mono text-rose-400">Show SL</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-850 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowTp1 ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowTp1', e.target.checked)}
                              className="rounded text-amber-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                            />
                            <span className="text-xs font-mono text-amber-300">Show TP1</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-850 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowTp2 ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowTp2', e.target.checked)}
                              className="rounded text-emerald-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                            />
                            <span className="text-xs font-mono text-emerald-300">Show TP2</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 bg-neutral-950 rounded border border-neutral-850 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowTp3 ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowTp3', e.target.checked)}
                              className="rounded text-cyan-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                            />
                            <span className="text-xs font-mono text-cyan-300">Show TP3</span>
                          </label>
                        </div>
                      </div>

                      {/* HUD Panel & Positioning */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show HUD Panel</span>
                            <span className="text-xs text-gray-500">Live position table &amp; scorecard</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.tpShowHud ?? true}
                              onChange={(e) => handleUpdateIndicators('tpShowHud', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">HUD Position</span>
                          <select
                            value={settings.indicators.tpHudPos ?? 'Top Right'}
                            onChange={(e) => handleUpdateIndicators('tpHudPos', e.target.value as any)}
                            className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-mono"
                          >
                            {['Top Right', 'Top Left', 'Bottom Right', 'Bottom Left', 'Middle Right'].map((pos) => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Level Tag Size</span>
                          <select
                            value={settings.indicators.tpTagSize ?? 'Normal'}
                            onChange={(e) => handleUpdateIndicators('tpTagSize', e.target.value as any)}
                            className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-mono"
                          >
                            {['Small', 'Normal', 'Large', 'Huge'].map((sz) => (
                              <option key={sz} value={sz}>{sz}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Plans kept on chart */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-300">Plans Kept on Chart (keepN)</span>
                          <span className="text-xs text-gray-500">How many recent completed trade plans remain drawn &amp; tracked in HUD (1–500)</span>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={settings.indicators.tpKeepN ?? 2}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              handleUpdateIndicators('tpKeepN', '' as any);
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed)) {
                                handleUpdateIndicators('tpKeepN', Math.max(1, Math.min(500, parsed)));
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            if (isNaN(parsed) || parsed < 1) {
                              handleUpdateIndicators('tpKeepN', 2);
                            }
                          }}
                          className="w-24 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-cyan-500 text-center font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 25: Fibonacci Sequence Swing [ChartPrime] */}
              {!isIndicatorDeleted('fib_swing') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isFibSwingActive) || (indicatorFilter === 'not_added' && !isFibSwingActive)) && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isFibSwingActive
                    ? 'bg-neutral-900/60 border-neutral-750 shadow-md'
                    : 'bg-neutral-950/40 border-neutral-850 opacity-80 hover:opacity-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isFibSwingActive ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        25
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-200">Fibonacci Sequence Swing [ChartPrime]</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                            ChartPrime Official
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          ZigZag swing projections with Fibonacci sequence (0, 1, 1, 2, 3, 5, 8, 13, 21), retest frequency gradient, and advance pivot tell arrows
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-md">
                        <span className={`w-1.5 h-1.5 rounded-full ${isFibSwingActive ? 'bg-indigo-400 animate-pulse' : 'bg-neutral-600'}`} />
                        <span className={`text-[10px] font-mono font-bold ${isFibSwingActive ? 'text-indigo-400' : 'text-neutral-500'}`}>
                          {isFibSwingActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFibSwingActive}
                          onChange={(e) => handleUpdateIndicators('showFibonacciSequenceSwing', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'fib_swing', name: 'Fibonacci Sequence Swing [ChartPrime]' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isFibSwingActive && (
                    <div className="mt-4 pt-4 border-t border-neutral-800 space-y-4">
                      {/* Section 1: Swing Core Inputs */}
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-neutral-800 pb-1">
                        1️⃣ Live Candle 0 Early Predictor &amp; Swing Depth
                      </div>

                      {/* Live Candle 0 Early Turn Predictor Toggle */}
                      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-200">Live Candle 0 Early Turn Predictor</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                              RECOMMENDED
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            Detects early reversal turns right on live candle 0, projecting advance tell arrows and Fibonacci levels BEFORE price completes the move
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={settings.indicators.fibEarlyTurnMode ?? true}
                            onChange={(e) => handleUpdateIndicators('fibEarlyTurnMode', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex flex-wrap items-center gap-2 p-2.5 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-xs font-semibold text-gray-400">Speed Presets:</span>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateIndicators('fibDepth', 10);
                            handleUpdateIndicators('fibEarlyDepth', 8);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                            (settings.indicators.fibDepth ?? 20) === 10
                              ? 'bg-indigo-600 text-white font-bold shadow'
                              : 'bg-neutral-850 text-gray-300 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          ⚡ Live Scalping (10)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateIndicators('fibDepth', 20);
                            handleUpdateIndicators('fibEarlyDepth', 12);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                            (settings.indicators.fibDepth ?? 20) === 20
                              ? 'bg-indigo-600 text-white font-bold shadow'
                              : 'bg-neutral-850 text-gray-300 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          🎯 Day Trading (20)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateIndicators('fibDepth', 150);
                            handleUpdateIndicators('fibEarlyDepth', 25);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                            (settings.indicators.fibDepth ?? 20) === 150
                              ? 'bg-indigo-600 text-white font-bold shadow'
                              : 'bg-neutral-850 text-gray-300 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          🏛 Macro ZigZag (150)
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">ZigZag Depth</span>
                          <span className="text-[10px] text-gray-500">Lookback bars for macro swings</span>
                          <input
                            type="number"
                            min={5}
                            max={500}
                            value={settings.indicators.fibDepth ?? 20}
                            onChange={(e) => handleUpdateIndicators('fibDepth', Math.max(5, Math.min(500, parseInt(e.target.value) || 20)))}
                            className="w-full mt-1 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-mono"
                          />
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-emerald-300">Early Sensitivity</span>
                          <span className="text-[10px] text-gray-500">Lookback for Candle 0 turns</span>
                          <input
                            type="number"
                            min={3}
                            max={50}
                            value={settings.indicators.fibEarlyDepth ?? 12}
                            onChange={(e) => handleUpdateIndicators('fibEarlyDepth', Math.max(3, Math.min(50, parseInt(e.target.value) || 12)))}
                            className="w-full mt-1 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-mono"
                          />
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">Retest Limit</span>
                          <span className="text-[10px] text-gray-500">Normalizes retest gradient</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={settings.indicators.fibMaxRetest ?? 30}
                            onChange={(e) => handleUpdateIndicators('fibMaxRetest', Math.max(1, Math.min(100, parseInt(e.target.value) || 30)))}
                            className="w-full mt-1 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* Section 2: Colors */}
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1 pt-2">
                        2️⃣ Color Customization
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-gray-300">ZigZag Color</span>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={toHexColor(settings.indicators.fibZigCol, '#9297a7')}
                              onChange={(e) => handleUpdateIndicators('fibZigCol', e.target.value)}
                              className="w-8 h-7 rounded border border-neutral-700 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-400 uppercase">
                              {toHexColor(settings.indicators.fibZigCol, '#9297a7')}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-emerald-400">Up Levels Color</span>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={toHexColor(settings.indicators.fibColUp, '#22c55e')}
                              onChange={(e) => handleUpdateIndicators('fibColUp', e.target.value)}
                              className="w-8 h-7 rounded border border-neutral-700 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-400 uppercase">
                              {toHexColor(settings.indicators.fibColUp, '#22c55e')}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 p-2.5 bg-neutral-900 rounded-lg border border-neutral-850">
                          <span className="text-[11px] font-semibold text-rose-400">Down Levels Color</span>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={toHexColor(settings.indicators.fibColDn, '#ef4444')}
                              onChange={(e) => handleUpdateIndicators('fibColDn', e.target.value)}
                              className="w-8 h-7 rounded border border-neutral-700 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-400 uppercase">
                              {toHexColor(settings.indicators.fibColDn, '#ef4444')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Visual Elements & Toggles */}
                      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 border-b border-neutral-800 pb-1 pt-2">
                        3️⃣ Chart Display &amp; Tell Arrow Toggles
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show Pivot Tell Arrows (▲ / ▼)</span>
                            <span className="text-xs text-gray-500">Advance swing signals printed before future price unfolds</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.fibShowArrows ?? true}
                              onChange={(e) => handleUpdateIndicators('fibShowArrows', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show Fibonacci Sequence Levels</span>
                            <span className="text-xs text-gray-500">0, 1, 1, 2, 3, 5, 8, 13, 21 harmonic grid lines</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.fibShowLevels ?? true}
                              onChange={(e) => handleUpdateIndicators('fibShowLevels', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show Retest Frequency Tags</span>
                            <span className="text-xs text-gray-500">Retest count badges projected to bar + 5 (e.g. 8 -◆- 14)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.fibShowLabels ?? true}
                              onChange={(e) => handleUpdateIndicators('fibShowLabels', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show ZigZag Dashed Trend</span>
                            <span className="text-xs text-gray-500">Connecting swing highs &amp; lows</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.fibShowZigZag ?? true}
                              onChange={(e) => handleUpdateIndicators('fibShowZigZag', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-850 sm:col-span-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-300">Show Historical Swings &amp; Levels</span>
                            <span className="text-xs text-gray-500">Preserves recent completed Fibonacci grids on chart</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.fibShowHistorical ?? true}
                              onChange={(e) => handleUpdateIndicators('fibShowHistorical', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 26: Multi-Timeframe EMA 15m 1H */}
              {!isIndicatorDeleted('mtf_ema') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMtfEmaActive) || (indicatorFilter === 'not_added' && !isMtfEmaActive)) && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isMtfEmaActive
                    ? 'bg-neutral-900/90 border-blue-500/40 shadow-lg'
                    : 'bg-neutral-900/50 border-neutral-850'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isMtfEmaActive ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-200">Multi-Timeframe EMA 15m 1H</span>
                          <span className="text-[10px] bg-blue-900/70 text-blue-300 px-2 py-0.5 rounded font-mono font-bold border border-blue-500/30">
                            Pine Script v6 Exact
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Smooth higher-timeframe-equivalent EMAs (15m: 3×, 1H: 12×) calculated on continuous candle data without stepping
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
                        <span className={`w-1.5 h-1.5 rounded-full ${isMtfEmaActive ? 'bg-blue-400 animate-pulse' : 'bg-neutral-600'}`} />
                        <span className={`text-[10px] font-mono font-bold ${isMtfEmaActive ? 'text-blue-400' : 'text-neutral-500'}`}>
                          {isMtfEmaActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isMtfEmaActive}
                          onChange={(e) => handleUpdateIndicators('showMultiTimeframeEma', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'mtf_ema', name: 'Multi-Timeframe EMA 15m 1H' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isMtfEmaActive && (
                    <div className="mt-4 pt-4 border-t border-neutral-800 space-y-4">
                      {/* Description & Pine Script Formula Callout */}
                      <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-lg text-xs text-blue-200/90 leading-relaxed font-mono">
                        <div className="text-[11px] font-bold text-blue-300 mb-1">PINE SCRIPT v6 FORMULA:</div>
                        <div>• 15-minute EMA = smooth_ema(close, length * 3)</div>
                        <div>• 1-hour EMA = smooth_ema(close, length * 12)</div>
                        <div className="text-[10px] text-gray-400 mt-1 font-sans">Preserves continuous, un-stepped smooth line behavior directly on your active chart.</div>
                      </div>

                      {/* Main Settings Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* EMA Length */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-300 flex items-center justify-between">
                            <span>EMA Length (Length)</span>
                            <span className="text-[10px] font-mono text-gray-500">minval: 1</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={settings.indicators.mtfEmaLength ?? 20}
                            onChange={(e) => handleUpdateIndicators('mtfEmaLength', Math.max(1, Math.min(500, parseInt(e.target.value) || 20)))}
                            className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>

                        {/* Pine Script v6 Exact Multipliers Callout */}
                        <div className="flex items-center justify-between p-2.5 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
                          <div>
                            <div className="text-xs font-medium text-gray-300">TradingView Pine Script Execution</div>
                            <div className="text-[10px] text-emerald-400 font-mono">
                              15m EMA: length × 3 (60) • 1H EMA: length × 12 (240)
                            </div>
                          </div>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold border border-emerald-500/30">
                            1:1 EXACT
                          </span>
                        </div>
                      </div>

                      {/* Visual Render Style Selector: Water Glaze vs Classic Line */}
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-gray-200">Line Visual Style (የላይኑ ስታይል)</div>
                            <div className="text-[11px] text-gray-400">Choose between the aesthetic Water Glaze or Classic Flat Line</div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                            (settings.indicators.mtfEmaRenderStyle ?? 'water_glaze') === 'water_glaze'
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                              : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          }`}>
                            {(settings.indicators.mtfEmaRenderStyle ?? 'water_glaze') === 'water_glaze' ? '💧 WATER GLAZE' : '📏 CLASSIC LINE'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {/* Option 1: Water Glaze */}
                          <button
                            type="button"
                            onClick={() => handleUpdateIndicators('mtfEmaRenderStyle', 'water_glaze')}
                            className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                              (settings.indicators.mtfEmaRenderStyle ?? 'water_glaze') === 'water_glaze'
                                ? 'bg-teal-950/40 border-teal-500/70 ring-1 ring-teal-500/50 shadow-sm'
                                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                                <span>💧</span> Water Glaze
                              </span>
                              {(settings.indicators.mtfEmaRenderStyle ?? 'water_glaze') === 'water_glaze' && (
                                <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-300 leading-tight">
                              Glossy Teal + Glazed Ceramic with luminous water body &amp; tiny edge boundary lines.
                            </span>
                          </button>

                          {/* Option 2: Classic Line */}
                          <button
                            type="button"
                            onClick={() => handleUpdateIndicators('mtfEmaRenderStyle', 'line')}
                            className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                              settings.indicators.mtfEmaRenderStyle === 'line'
                                ? 'bg-blue-950/40 border-blue-500/70 ring-1 ring-blue-500/50 shadow-sm'
                                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                                <span>📏</span> Classic Line
                              </span>
                              {settings.indicators.mtfEmaRenderStyle === 'line' && (
                                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-300 leading-tight">
                              Standard clean solid 2px line with customizable flat colors (#00008B / #FF0000).
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* 15m and 1H EMA Toggles & Color Controls */}
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800/80 space-y-3">
                        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Lines &amp; Visuals</div>

                        {/* 15-minute EMA */}
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.mtfEmaShow15min ?? true}
                                onChange={(e) => handleUpdateIndicators('mtfEmaShow15min', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-500"></div>
                            </label>
                            <span className="text-xs font-medium text-gray-300">Show 15-minute EMA (Fast Ribbon)</span>
                            <span className="text-[10px] text-gray-500 font-mono">({(settings.indicators.mtfEmaLength ?? 20) * 3} bars)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={toHexColor(settings.indicators.mtfEmaColor15min, '#0d9488')}
                              onChange={(e) => handleUpdateIndicators('mtfEmaColor15min', e.target.value)}
                              className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-gray-400 uppercase">
                              {toHexColor(settings.indicators.mtfEmaColor15min, '#0d9488')}
                            </span>
                          </div>
                        </div>

                        {/* 1-hour EMA */}
                        <div className="flex items-center justify-between py-1 border-t border-neutral-850">
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.mtfEmaShow60min ?? true}
                                onChange={(e) => handleUpdateIndicators('mtfEmaShow60min', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500"></div>
                            </label>
                            <span className="text-xs font-medium text-gray-300">Show 1-hour EMA (Slow Ribbon)</span>
                            <span className="text-[10px] text-gray-500 font-mono">({(settings.indicators.mtfEmaLength ?? 20) * 12} bars)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={toHexColor(settings.indicators.mtfEmaColor60min, '#0284c7')}
                              onChange={(e) => handleUpdateIndicators('mtfEmaColor60min', e.target.value)}
                              className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-gray-400 uppercase">
                              {toHexColor(settings.indicators.mtfEmaColor60min, '#0284c7')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Reset to Pine Script Defaults */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateIndicators('mtfEmaLength', 20);
                            handleUpdateIndicators('mtfEmaShow15min', true);
                            handleUpdateIndicators('mtfEmaShow60min', true);
                            handleUpdateIndicators('mtfEmaColor15min', '#00008B');
                            handleUpdateIndicators('mtfEmaColor60min', '#FF0000');
                            handleUpdateIndicators('mtfEmaAdaptiveTf', true);
                          }}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs text-gray-300 rounded-md transition-colors font-medium cursor-pointer"
                        >
                          Reset to Pine Script Defaults
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 27: Mrov Trade: Opening Range (Pine Script v6 Exact Implementation) */}
              {!isIndicatorDeleted('mrov_trade') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isMrovTradeActive) || (indicatorFilter === 'not_added' && !isMrovTradeActive)) && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isMrovTradeActive
                    ? 'bg-neutral-900/90 border-blue-500/40 shadow-lg'
                    : 'bg-neutral-900/50 border-neutral-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm">
                        OR
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">Mrov Trade: Opening Range</h4>
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                            Pine Script v6
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                            NY 09:30–10:00
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          High-precision New York 09:30–10:00 Opening Range with breakout signals, dynamic R:R trade grid &amp; real-time performance statistics
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
                        <span className={`w-1.5 h-1.5 rounded-full ${isMrovTradeActive ? 'bg-blue-400 animate-pulse' : 'bg-neutral-600'}`} />
                        <span className={`text-[10px] font-mono font-bold ${isMrovTradeActive ? 'text-blue-400' : 'text-neutral-500'}`}>
                          {isMrovTradeActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isMrovTradeActive}
                          onChange={(e) => handleUpdateIndicators('showMrovOpeningRange', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'mrov_trade', name: 'Mrov Trade: Opening Range' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isMrovTradeActive && (
                    <div className="mt-4 pt-4 border-t border-neutral-800 space-y-4">
                      {/* Group 1: Opening Range */}
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800/80 space-y-3">
                        <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>📦</span> Group: Opening Range (09:30–10:00 NY)
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Range Color */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Range Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={toHexColor(settings.indicators.mrovRangeColor, '#2979ff')}
                                onChange={(e) => handleUpdateIndicators('mrovRangeColor', e.target.value)}
                                className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-gray-400 uppercase">
                                {toHexColor(settings.indicators.mrovRangeColor, '#2979ff')}
                              </span>
                            </div>
                          </div>

                          {/* Range Transparency (0..100) */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Range Transparency</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.indicators.mrovFillTransparency ?? 88}
                                onChange={(e) => handleUpdateIndicators('mrovFillTransparency', parseInt(e.target.value))}
                                className="w-24 accent-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-mono text-gray-300 w-10 text-right">
                                {settings.indicators.mrovFillTransparency ?? 88}%
                              </span>
                            </div>
                          </div>

                          {/* Border Width (1..4) */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Border Width</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map((w) => (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={() => handleUpdateIndicators('mrovBorderWidth', w)}
                                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                    (settings.indicators.mrovBorderWidth ?? 2) === w
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-neutral-800 text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {w}px
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Level Width (1..4) */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Level Width</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map((w) => (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={() => handleUpdateIndicators('mrovLevelWidth', w)}
                                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                    (settings.indicators.mrovLevelWidth ?? 2) === w
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-neutral-800 text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {w}px
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Show Range Caption */}
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-850">
                          <span className="text-xs font-medium text-gray-300">Show Opening Range Label</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.indicators.mrovShowRangeCaption ?? true}
                              onChange={(e) => handleUpdateIndicators('mrovShowRangeCaption', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                          </label>
                        </div>
                      </div>

                      {/* Group 2: Signal */}
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800/80 space-y-3">
                        <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚡</span> Group: Signal
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* LONG Color */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">LONG Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={toHexColor(settings.indicators.mrovLongColor, '#00c878')}
                                onChange={(e) => handleUpdateIndicators('mrovLongColor', e.target.value)}
                                className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-gray-400 uppercase">
                                {toHexColor(settings.indicators.mrovLongColor, '#00c878')}
                              </span>
                            </div>
                          </div>

                          {/* SHORT Color */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">SHORT Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={toHexColor(settings.indicators.mrovShortColor, '#e64646')}
                                onChange={(e) => handleUpdateIndicators('mrovShortColor', e.target.value)}
                                className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-gray-400 uppercase">
                                {toHexColor(settings.indicators.mrovShortColor, '#e64646')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-neutral-850">
                          {/* Highlight Breakout Candle */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-300">Highlight Breakout Candle</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.mrovHighlightBreakout ?? true}
                                onChange={(e) => handleUpdateIndicators('mrovHighlightBreakout', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          {/* Show LONG / SHORT Labels */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-300">Show LONG / SHORT Labels</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.mrovShowSignalLabels ?? true}
                                onChange={(e) => handleUpdateIndicators('mrovShowSignalLabels', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          {/* Show Entry Marker */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-300">Show Entry Marker</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.mrovShowBreakoutMarker ?? true}
                                onChange={(e) => handleUpdateIndicators('mrovShowBreakoutMarker', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Group 3: Trade (Risk / Reward & Grid) */}
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800/80 space-y-3">
                        <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🎯</span> Group: Trade (Risk / Reward &amp; Grid)
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Risk / Reward ratio */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Risk / Reward (R:R)</span>
                            <div className="flex items-center gap-1">
                              {[1.5, 2.0, 3.0, 4.0, 5.0].map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleUpdateIndicators('mrovRR', val)}
                                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                    (settings.indicators.mrovRR ?? 3.0) === val
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-neutral-800 text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {val}R
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom R:R Input */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Custom R:R Ratio</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="20"
                              value={settings.indicators.mrovRR ?? 3.0}
                              onChange={(e) => handleUpdateIndicators('mrovRR', parseFloat(e.target.value) || 3.0)}
                              className="w-20 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs font-mono text-white text-right"
                            />
                          </div>

                          {/* Risk Zone Color */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Risk Zone Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={toHexColor(settings.indicators.mrovRiskColor, '#dc4155')}
                                onChange={(e) => handleUpdateIndicators('mrovRiskColor', e.target.value)}
                                className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-gray-400 uppercase">
                                {toHexColor(settings.indicators.mrovRiskColor, '#dc4155')}
                              </span>
                            </div>
                          </div>

                          {/* Reward Zone Color */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Reward Zone Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={toHexColor(settings.indicators.mrovRewardColor, '#00a078')}
                                onChange={(e) => handleUpdateIndicators('mrovRewardColor', e.target.value)}
                                className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-gray-400 uppercase">
                                {toHexColor(settings.indicators.mrovRewardColor, '#00a078')}
                              </span>
                            </div>
                          </div>

                          {/* Entry Color */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Entry Line Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={toHexColor(settings.indicators.mrovEntryColor, '#e6e6e6')}
                                onChange={(e) => handleUpdateIndicators('mrovEntryColor', e.target.value)}
                                className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-gray-400 uppercase">
                                {toHexColor(settings.indicators.mrovEntryColor, '#e6e6e6')}
                              </span>
                            </div>
                          </div>

                          {/* Zone Transparency (0..100) */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium text-gray-300">Zone Transparency</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.indicators.mrovZoneTransparency ?? 78}
                                onChange={(e) => handleUpdateIndicators('mrovZoneTransparency', parseInt(e.target.value))}
                                className="w-24 accent-amber-500 cursor-pointer"
                              />
                              <span className="text-xs font-mono text-gray-300 w-10 text-right">
                                {settings.indicators.mrovZoneTransparency ?? 78}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-neutral-850">
                          {/* Show Trade Grid */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-300">Show Trade Grid</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.mrovShowTradeGrid ?? true}
                                onChange={(e) => handleUpdateIndicators('mrovShowTradeGrid', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                          </div>

                          {/* Show Statistics Table HUD */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-300">Show Statistics Table HUD</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.mrovShowStatsTable ?? true}
                                onChange={(e) => handleUpdateIndicators('mrovShowStatsTable', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Reset to Pine Script Defaults */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateIndicators('mrovRangeColor', '#2979ff');
                            handleUpdateIndicators('mrovFillTransparency', 88);
                            handleUpdateIndicators('mrovBorderWidth', 2);
                            handleUpdateIndicators('mrovLevelWidth', 2);
                            handleUpdateIndicators('mrovShowRangeCaption', true);
                            handleUpdateIndicators('mrovLongColor', '#00c878');
                            handleUpdateIndicators('mrovShortColor', '#e64646');
                            handleUpdateIndicators('mrovHighlightBreakout', true);
                            handleUpdateIndicators('mrovShowSignalLabels', true);
                            handleUpdateIndicators('mrovShowBreakoutMarker', true);
                            handleUpdateIndicators('mrovRR', 3.0);
                            handleUpdateIndicators('mrovShowTradeGrid', true);
                            handleUpdateIndicators('mrovRiskColor', '#dc4155');
                            handleUpdateIndicators('mrovRewardColor', '#00a078');
                            handleUpdateIndicators('mrovEntryColor', '#e6e6e6');
                            handleUpdateIndicators('mrovZoneTransparency', 78);
                            handleUpdateIndicators('mrovShowStatsTable', true);
                          }}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs text-gray-300 rounded-md transition-colors font-medium cursor-pointer"
                        >
                          Reset to Pine Script Defaults
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator 28: EMA 50/100 + Candle Trend | Albert Setups (Pine Script v6 Exact Implementation) */}
              {!isIndicatorDeleted('ema_50_100') && (indicatorFilter === 'all' || (indicatorFilter === 'added' && isEma50100Active) || (indicatorFilter === 'not_added' && !isEma50100Active)) && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isEma50100Active
                    ? 'bg-neutral-900/90 border-emerald-500/40 shadow-lg'
                    : 'bg-neutral-900/50 border-neutral-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs font-mono">
                        50/100
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">EMA 50/100 + Candle Trend</h4>
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                            Albert Setups
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                            Pine Script v6
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Dual EMA 50/100 trend filter with confirmed crossover BUY/SELL signal labels, trend candle coloring (lime/red), and optional background cloud
                        </p>
                        {/* Quick EMA Line On/Off Toggles directly on the Card */}
                        <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-neutral-800/60">
                          <span className="text-[11px] font-semibold text-gray-400">Line Visibility:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateIndicators('ema50100ShowFastEma', !(settings.indicators.ema50100ShowFastEma ?? true));
                            }}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              (settings.indicators.ema50100ShowFastEma ?? true)
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30 shadow-sm'
                                : 'bg-neutral-950 text-gray-500 border border-neutral-800 line-through opacity-70 hover:opacity-100 hover:border-neutral-700'
                            }`}
                            title="Toggle Fast EMA line on/off"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: settings.indicators.ema50100FastColor || '#00e676' }} />
                            Fast EMA ({settings.indicators.ema50100FastLength ?? 50}): {(settings.indicators.ema50100ShowFastEma ?? true) ? 'ON' : 'OFF'}
                            <span className="text-[10px]">{(settings.indicators.ema50100ShowFastEma ?? true) ? '👁' : '✕'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateIndicators('ema50100ShowSlowEma', !(settings.indicators.ema50100ShowSlowEma ?? true));
                            }}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              (settings.indicators.ema50100ShowSlowEma ?? true)
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 shadow-sm'
                                : 'bg-neutral-950 text-gray-500 border border-neutral-800 line-through opacity-70 hover:opacity-100 hover:border-neutral-700'
                            }`}
                            title="Toggle Slow EMA line on/off"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: settings.indicators.ema50100SlowColor || '#ff9800' }} />
                            Slow EMA ({settings.indicators.ema50100SlowLength ?? 100}): {(settings.indicators.ema50100ShowSlowEma ?? true) ? 'ON' : 'OFF'}
                            <span className="text-[10px]">{(settings.indicators.ema50100ShowSlowEma ?? true) ? '👁' : '✕'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
                        <span className={`w-1.5 h-1.5 rounded-full ${isEma50100Active ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                        <span className={`text-[10px] font-mono font-bold ${isEma50100Active ? 'text-emerald-400' : 'text-neutral-500'}`}>
                          {isEma50100Active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEma50100Active}
                          onChange={(e) => handleUpdateIndicators('showEma50100Trend', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIndicatorToDelete({ id: 'ema_50_100', name: 'EMA 50/100 + Candle Trend' })}
                        title="Permanently delete indicator from platform code & settings"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Permanently Delete</span>
                      </button>
                    </div>
                  </div>

                  {isEma50100Active && (
                    <div className="mt-4 pt-4 border-t border-neutral-800 space-y-4">
                      {/* Description & Formula Pill */}
                      <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-xs text-emerald-200/90 leading-relaxed font-mono">
                        <div className="text-[11px] font-bold text-emerald-300 mb-1">PINE SCRIPT v6 FORMULA:</div>
                        <div>• Fast EMA: <strong>ta.ema(close, {settings.indicators.ema50100FastLength ?? 50})</strong> (color.lime)</div>
                        <div>• Slow EMA: <strong>ta.ema(close, {settings.indicators.ema50100SlowLength ?? 100})</strong> (color.orange)</div>
                        <div>• BUY Signal: <strong>ta.crossover(ema50, ema100)</strong> on confirmed bar</div>
                        <div>• SELL Signal: <strong>ta.crossunder(ema50, ema100)</strong> on confirmed bar</div>
                      </div>

                      {/* Settings Group */}
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800/80 space-y-3">
                        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Indicator Parameters
                        </div>

                        <div className="space-y-3 pt-1">
                          {/* Fast EMA Line (50) */}
                          <div className={`p-3 rounded-lg border transition-all ${
                            (settings.indicators.ema50100ShowFastEma ?? true)
                              ? 'bg-neutral-900/80 border-emerald-500/30 shadow-sm'
                              : 'bg-neutral-950/60 border-neutral-800/80 opacity-75'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.indicators.ema50100ShowFastEma ?? true}
                                    onChange={(e) => handleUpdateIndicators('ema50100ShowFastEma', e.target.checked)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-200">Fast EMA Line</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIndicators('ema50100ShowFastEma', !(settings.indicators.ema50100ShowFastEma ?? true))}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                        (settings.indicators.ema50100ShowFastEma ?? true)
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                          : 'bg-neutral-800 text-gray-400 border border-neutral-700'
                                      }`}
                                    >
                                      {(settings.indicators.ema50100ShowFastEma ?? true) ? '✓ ON (VISIBLE)' : '✕ OFF (HIDDEN)'}
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-gray-400">Plot line on chart &amp; badge on price scale</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-400 font-mono">Period:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    value={settings.indicators.ema50100FastLength ?? 50}
                                    onChange={(e) => handleUpdateIndicators('ema50100FastLength', parseInt(e.target.value) || 50)}
                                    className="w-16 px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-xs font-mono text-white text-right focus:border-emerald-500 outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-400 font-mono">Width:</span>
                                  <select
                                    value={settings.indicators.ema50100FastLineWidth ?? 2}
                                    onChange={(e) => handleUpdateIndicators('ema50100FastLineWidth', parseInt(e.target.value) || 2)}
                                    className="px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-xs font-mono text-white cursor-pointer focus:border-emerald-500 outline-none"
                                  >
                                    <option value={1}>1px</option>
                                    <option value={2}>2px</option>
                                    <option value={3}>3px</option>
                                    <option value={4}>4px</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="color"
                                    value={toHexColor(settings.indicators.ema50100FastColor, '#00e676')}
                                    onChange={(e) => handleUpdateIndicators('ema50100FastColor', e.target.value)}
                                    className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                                  />
                                  <span className="text-[10px] font-mono text-gray-400 uppercase w-14">
                                    {toHexColor(settings.indicators.ema50100FastColor, '#00e676')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Slow EMA Line (100) */}
                          <div className={`p-3 rounded-lg border transition-all ${
                            (settings.indicators.ema50100ShowSlowEma ?? true)
                              ? 'bg-neutral-900/80 border-amber-500/30 shadow-sm'
                              : 'bg-neutral-950/60 border-neutral-800/80 opacity-75'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.indicators.ema50100ShowSlowEma ?? true}
                                    onChange={(e) => handleUpdateIndicators('ema50100ShowSlowEma', e.target.checked)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                </label>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-200">Slow EMA Line</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIndicators('ema50100ShowSlowEma', !(settings.indicators.ema50100ShowSlowEma ?? true))}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                        (settings.indicators.ema50100ShowSlowEma ?? true)
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          : 'bg-neutral-800 text-gray-400 border border-neutral-700'
                                      }`}
                                    >
                                      {(settings.indicators.ema50100ShowSlowEma ?? true) ? '✓ ON (VISIBLE)' : '✕ OFF (HIDDEN)'}
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-gray-400">Plot line on chart &amp; badge on price scale</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-400 font-mono">Period:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="1000"
                                    value={settings.indicators.ema50100SlowLength ?? 100}
                                    onChange={(e) => handleUpdateIndicators('ema50100SlowLength', parseInt(e.target.value) || 100)}
                                    className="w-16 px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-xs font-mono text-white text-right focus:border-amber-500 outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-400 font-mono">Width:</span>
                                  <select
                                    value={settings.indicators.ema50100SlowLineWidth ?? 2}
                                    onChange={(e) => handleUpdateIndicators('ema50100SlowLineWidth', parseInt(e.target.value) || 2)}
                                    className="px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-xs font-mono text-white cursor-pointer focus:border-amber-500 outline-none"
                                  >
                                    <option value={1}>1px</option>
                                    <option value={2}>2px</option>
                                    <option value={3}>3px</option>
                                    <option value={4}>4px</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="color"
                                    value={toHexColor(settings.indicators.ema50100SlowColor, '#ff9800')}
                                    onChange={(e) => handleUpdateIndicators('ema50100SlowColor', e.target.value)}
                                    className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                                  />
                                  <span className="text-[10px] font-mono text-gray-400 uppercase w-14">
                                    {toHexColor(settings.indicators.ema50100SlowColor, '#ff9800')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-neutral-850">
                          {/* Show BUY / SELL */}
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-medium text-gray-300 block">Show BUY / SELL Signals</span>
                              <span className="text-[10px] text-gray-500">Displays shape.labelup &amp; shape.labeldown at confirmed crossover bars</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.ema50100ShowSignals ?? true}
                                onChange={(e) => handleUpdateIndicators('ema50100ShowSignals', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          {/* Color Candles by Trend */}
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-medium text-gray-300 block">Color Candles by Trend (barcolor)</span>
                              <span className="text-[10px] text-gray-500">Bullish = Lime Green, Bearish = Red, Neutral = Gray</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.ema50100ColorCandles ?? true}
                                onChange={(e) => handleUpdateIndicators('ema50100ColorCandles', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          {/* Show Trend Background (bgcolor) */}
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-medium text-gray-300 block">Show Trend Background (bgcolor)</span>
                              <span className="text-[10px] text-gray-500">Soft 90% transparent green/red tint behind active candles</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.indicators.ema50100ShowBackground ?? false}
                                onChange={(e) => handleUpdateIndicators('ema50100ShowBackground', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Reset to Pine Script Defaults */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateIndicators('ema50100FastLength', 50);
                            handleUpdateIndicators('ema50100SlowLength', 100);
                            handleUpdateIndicators('ema50100ShowFastEma', true);
                            handleUpdateIndicators('ema50100ShowSlowEma', true);
                            handleUpdateIndicators('ema50100ShowSignals', true);
                            handleUpdateIndicators('ema50100ColorCandles', true);
                            handleUpdateIndicators('ema50100ShowBackground', false);
                            handleUpdateIndicators('ema50100FastColor', '#00e676');
                            handleUpdateIndicators('ema50100SlowColor', '#ff9800');
                            handleUpdateIndicators('ema50100FastLineWidth', 2);
                            handleUpdateIndicators('ema50100SlowLineWidth', 2);
                          }}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs text-gray-300 rounded-md transition-colors font-medium cursor-pointer"
                        >
                          Reset to Pine Script Defaults
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* RESTORE DELETED INDICATORS (If any have been permanently deleted) */}
              {(settings.indicators.deletedIndicators?.length || 0) > 0 && (
                <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-3 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-neutral-200">
                        Permanently Deleted Indicators ({settings.indicators.deletedIndicators!.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRestoreAllIndicators}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore All</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.indicators.deletedIndicators!.map((id) => (
                      <div
                        key={id}
                        className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-300 flex items-center gap-2"
                      >
                        <span className="text-[11px] font-medium">{INDICATOR_NAME_MAP[id] || id}</span>
                        <button
                          type="button"
                          onClick={() => handleRestoreIndicator(id)}
                          title="Restore this indicator"
                          className="text-emerald-400 hover:text-emerald-300 transition-colors p-0.5 rounded cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

          </div>
        )}

          {/* TAB 4: SERVER & CONNECTION OVERRIDES */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 rounded-lg leading-relaxed">
                <strong>Connection Overrides:</strong> If the chart is stuck on &quot;Connecting&quot; or if you face security blocks or WebSocket timeout errors, you can override the target gateway server or enter your own App ID. Leave them empty to automatically rotate through global public gateways.
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Custom Server Domain</span>
                <input
                  id="connection-server-input"
                  type="text"
                  placeholder="e.g. ws.derivws.com (or green.binaryws.com)"
                  value={settings.connection?.customServer || ''}
                  onChange={(e) => handleUpdateConnection('customServer', e.target.value)}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 placeholder-neutral-700 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Registered App ID</span>
                <input
                  id="connection-appid-input"
                  type="text"
                  placeholder="e.g. 1089 (or your custom App ID)"
                  value={settings.connection?.customAppId || ''}
                  onChange={(e) => handleUpdateConnection('customAppId', e.target.value)}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-white focus:outline-none focus:border-blue-500 placeholder-neutral-700 font-mono"
                />
              </div>

              <div className="pt-2 text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-900">
                <p>💡 <strong>Note:</strong> Custom App IDs must be registered in the <a href="https://api.deriv.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Deriv Developer Portal</a> for your current domain origins.</p>
              </div>
            </div>
          )}

          {/* TAB: INSTALL APP / ADD TO HOME SCREEN (PWA) */}
          {activeTab === 'pwa' && (
            <div className="space-y-5">
              <div className="p-4 bg-gradient-to-br from-sky-950/40 via-neutral-900 to-neutral-950 border border-sky-900/40 rounded-xl space-y-3.5 shadow-inner">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-600/20 border border-sky-500/30 rounded-xl flex items-center justify-center text-sky-400 shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Add to Home Screen (PWA Application)</span>
                        {isInstalled ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-600/50 rounded-full flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3 text-emerald-400" /> Installed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-900/60 text-sky-300 border border-sky-600/50 rounded-full font-mono">
                            Stand-alone App
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        Use Mcharts as a full-screen, native-like standalone app on mobile and desktop without browser bars.
                      </p>
                    </div>
                  </div>

                  {isInstallable && (
                    <button
                      type="button"
                      id="btn-settings-install-pwa"
                      onClick={install}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Install App Now</span>
                    </button>
                  )}
                </div>

                {isInstalled && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Mcharts is currently installed and running as a standalone application!</span>
                  </div>
                )}
              </div>

              {/* Step-by-Step Instructions by Device */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Android / Chrome Guide */}
                <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                    <PlusSquare className="w-4 h-4" />
                    <span>Android / Chrome Instructions</span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-neutral-300 list-decimal list-inside leading-relaxed">
                    <li>
                      Click the <strong className="text-white">&quot;Install App Now&quot;</strong> button above, or tap the <strong className="text-white">three dots menu (⋮)</strong> in Chrome.
                    </li>
                    <li>
                      Select <strong className="text-white">&quot;Add to Home screen&quot;</strong> or <strong className="text-white">&quot;Install app&quot;</strong>.
                    </li>
                    <li>
                      Confirm by tapping <strong className="text-white">&quot;Install&quot;</strong> or <strong className="text-white">&quot;Add&quot;</strong> in the prompt.
                    </li>
                    <li>
                      Mcharts will now appear directly on your home screen or app drawer!
                    </li>
                  </ol>
                </div>

                {/* iPhone / Safari Guide */}
                <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                    <Share2 className="w-4 h-4" />
                    <span>iPhone & iPad (Safari) Instructions</span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-neutral-300 list-decimal list-inside leading-relaxed">
                    <li>
                      In Safari, tap the <strong className="text-white">Share button (⎋)</strong> at the bottom or top of the screen.
                    </li>
                    <li>
                      Scroll down and tap <strong className="text-white">&quot;Add to Home Screen&quot; (⊞)</strong>.
                    </li>
                    <li>
                      Tap <strong className="text-white">&quot;Add&quot;</strong> in the top-right corner.
                    </li>
                    <li>
                      Launch Mcharts from your home screen for full-screen, ultra-responsive trading!
                    </li>
                  </ol>
                </div>
              </div>

              {/* Force Update & Clear Cache Banner */}
              <div className="p-4 bg-gradient-to-r from-sky-950/40 via-neutral-900 to-neutral-950 rounded-xl border border-sky-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-sky-400 animate-spin-slow" />
                    <span className="text-xs font-bold text-white">App Updates & Cache Refresh</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-900/60 text-sky-300 border border-sky-700/50">
                    Latest Vercel Build
                  </span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  If you recently deployed new changes to GitHub/Vercel and your mobile phone browser is still displaying a cached older version, tap the button below to purge the local service worker cache and reload the latest release immediately.
                </p>
                <button
                  id="btn-force-clear-cache-update"
                  onClick={() => {
                    const win = typeof window !== 'undefined' ? (window as any) : null;
                    if (!win) return;
                    if (typeof win.__clearAppCacheAndReload === 'function') {
                      win.__clearAppCacheAndReload();
                      return;
                    }
                    if ('caches' in win) {
                      win.caches.keys().then((keys: string[]) => {
                        return Promise.all(keys.map((k) => win.caches.delete(k)));
                      }).finally(() => {
                        win.location.reload();
                      });
                    } else {
                      win.location.reload();
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>🔄 Force Update &amp; Clear Mobile Cache (አፕዴት ፈልግ እና Cache አጽዳ)</span>
                </button>
              </div>

              {/* Benefits Banner */}
              <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-850 space-y-2 text-xs">
                <span className="font-semibold text-neutral-300 block">PWA Application Advantages:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-neutral-400">
                  <div className="p-2 bg-neutral-900/60 rounded border border-neutral-800">
                    <strong className="text-sky-400 block mb-0.5">🚀 Fast 1-Click Launch</strong>
                    Opens immediately from your phone screen without typing URLs.
                  </div>
                  <div className="p-2 bg-neutral-900/60 rounded border border-neutral-800">
                    <strong className="text-emerald-400 block mb-0.5">📱 Full Screen Canvas</strong>
                    No browser tabs, URL bars, or address inputs wasting valuable chart space.
                  </div>
                  <div className="p-2 bg-neutral-900/60 rounded border border-neutral-800">
                    <strong className="text-purple-400 block mb-0.5">⚡ Offline Cache</strong>
                    Persists indicators, drawings, and chart templates directly on your device.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SUPPORT & TELEGRAM */}
          {activeTab === 'support' && (
            <div className="space-y-5">
              <div className="p-4 bg-gradient-to-br from-blue-950/40 via-neutral-900 to-neutral-950 border border-blue-900/40 rounded-xl space-y-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Mcharts Technical Support</h4>
                    <p className="text-xs text-neutral-400">Direct assistance, custom features & inquiries</p>
                  </div>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed pt-1">
                  Have questions, feature requests, or need technical help with Mcharts? Connect directly with support on Telegram.
                </p>

                <div className="pt-2">
                  <a
                    id="btn-telegram-support"
                    href="https://t.me/miihiretu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-950/50 transition-all hover:scale-[1.01]"
                  >
                    <Send className="w-4 h-4" />
                    <span>Contact Support on Telegram (@miihiretu)</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                </div>
              </div>

              <div className="p-3.5 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span>Support Info</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-400 font-mono text-[11px] pt-1">
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">Telegram Username</span>
                    <a 
                      href="https://t.me/miihiretu" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-400 hover:text-blue-300 font-bold hover:underline flex items-center gap-1 mt-0.5"
                    >
                      @miihiretu
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  </div>
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">Application</span>
                    <span className="text-white font-bold mt-0.5 block">Mcharts v2.0</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ADMIN PANEL & TELEMETRY */}
          {activeTab === 'admin' && (
            <AdminPanel />
          )}
        </div>

        {/* Footer OK closing button */}
        <div className={`px-6 py-4 border-t rounded-b-xl flex items-center justify-end ${
          isDark ? 'bg-neutral-950 border-neutral-900' : 'bg-neutral-50 border-neutral-200'
        }`}>
          <button
            id="btn-save-settings"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            Apply Changes
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Permanently Delete Indicator */}
      {indicatorToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-750 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanently Delete Indicator?</h3>
                <p className="text-xs text-neutral-400">Confirmation Required</p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-850 space-y-2">
              <p className="text-xs text-neutral-300 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-white font-semibold">&quot;{indicatorToDelete.name}&quot;</strong>?
              </p>
              <p className="text-[11px] text-rose-400/90 leading-relaxed font-mono">
                ⚠️ This will permanently remove the indicator from your active indicators list, platform settings, calculations, and chart HUD.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIndicatorToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePermanentlyDeleteIndicator(indicatorToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
