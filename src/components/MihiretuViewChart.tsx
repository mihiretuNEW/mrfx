/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Candle, Drawing, DrawingPoint, DrawingType, ChartSettings, RiskRewardConfig, TimeframeId, SMCInstanceConfig } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, Trash2, ArrowUpRight, ArrowDownRight, Eye, EyeOff, SlidersHorizontal, Layers, Palette, Check } from 'lucide-react';
import { TIMEFRAMES } from '../hooks/useDerivWS';
import { calculateGTATrend } from '../utils/gtaIndicator';
import { calculateTrendlinesWithBreaks, calculateSmartMoneyConcepts, calculateSmartMoneyConceptsForInstance, calculateSignalsAndOverlays, calculateConfluenceFVG, FVGZone, calculateIctConcepts, calculateMarketStructureToolkit, calculatePureLiquiditySweeps } from '../utils/premiumIndicators';
import { calculateAutoPriceChannels4H } from '../utils/priceChannelsIndicator';
import { calculateAutoSupplyDemandChannel, SupplyDemandZone } from '../utils/autoSupplyDemandChannel';
import { calculateMarketStructureSignals } from '../utils/marketStructureSignals';
import { calculatePredictiveRanges } from '../utils/predictiveRanges';
import { calculateEchoMpro } from '../utils/echoIndicator';
import { calculateMpro2Signals } from '../utils/mpro2Signals';
import { calculateSupportResistanceClassification, SRChoiceType, SRSignal, calculateMproSignalRR, MproSignalRR } from '../utils/supportResistanceClassification';
import { calculateFixedRangeVolumeProfile } from '../utils/volumeProfile';
import { calculateHvnProfile } from '../utils/hvnProfile';
import { calculateOrderBlocksWithVolume, formatOrderBlockVolume } from '../utils/orderBlocksWithVolume';
import { calculateProOrderBlocks, ProOrderBlock } from '../utils/proOrderBlocks';
import { calculateSessionFilter, SessionFilterInterval } from '../utils/sessionFilterEngine';
import { calculateMarketStructureTargetTracker, MsttResult } from '../utils/marketStructureTargetTracker';
import { calculateVipMarketScanner, VipScannerResult } from '../utils/vipMarketScanner';
import { calculatePremiumDynamicTpSlSignals, DynamicTpSlResults, DynamicSignalOperation } from '../utils/premiumDynamicTpSlSignals';
import { calculateTradePlanner, TradePlannerResult, RecentTradeAudit, LUNQ_PALETTE } from '../utils/tradePlannerLunqFX';
import { calculateFibonacciSequenceSwing, FibSwingResult } from '../utils/fibonacciSequenceSwing';
import { calculateMultiTimeframeEma, MtfEmaResult } from '../utils/multiTimeframeEma';
import { calculateMrovTradeOpeningRange, MrovTradeResult } from '../utils/mrovTradeOpeningRange';
import { calculateEma50100CandleTrend, Ema50100Result } from '../utils/ema50100CandleTrend';
import { VipMarketScannerHUD } from './VipMarketScannerHUD';
import { DynamicTpSlTableHUD } from './DynamicTpSlTableHUD';
import { TradePlannerHUD } from './TradePlannerHUD';
import { getSymbolSpec, calculateProfitLoss, calculateStopPriceFromRisk, calculateTargetPriceFromReward, createDefaultRiskReward } from '../utils/symbolSpecs';
import { MasterGatekeeperHUD } from './MasterGatekeeperHUD';
import { MasterTradeLoggerModal } from './MasterTradeLoggerModal';
import { MasterJournalModal } from './MasterJournalModal';
import { evaluateNexusSuite } from '../utils/nexusSystem';
import { NexusDashboardHUD } from './NexusDashboardHUD';
import { 
  evaluateMasterSetup, 
  getLoggedTrades, 
  syncOpenTradesWithCandles, 
  LoggedTrade, 
  PreTradeContext 
} from '../utils/masterSystem';
import { isDarkTheme, getThemePreset, isLightColor } from '../utils/themePresets';

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex) return `rgba(128, 128, 128, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 128;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 128;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 128;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const distToSegment = (
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number => {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
};

interface MihiretuViewChartProps {
  candles: Candle[];
  symbolName: string;
  activeTool: DrawingType;
  setActiveTool: (tool: DrawingType) => void;
  drawings: Drawing[];
  setDrawings: React.Dispatch<React.SetStateAction<Drawing[]>>;
  settings: ChartSettings;
  timeframe: TimeframeId;
  isMagnetActive?: boolean;
  isMproPro?: boolean;
  mproAccessMode?: 'free' | 'demo' | 'pro';
  onOpenMproModal?: () => void;
  isMpro2Pro?: boolean;
  mpro2AccessMode?: 'free' | 'demo' | 'pro';
  onOpenMpro2Modal?: () => void;
  selectedMproRRSignal?: SRSignal | null;
  onSelectMproRRSignal?: (signal: SRSignal | null) => void;
  onToggleIndicator?: (key: keyof ChartSettings['indicators']) => void;
  onUpdateIndicator?: <K extends keyof ChartSettings['indicators']>(key: K, value: ChartSettings['indicators'][K]) => void;
  onOpenSettingsModal?: (tab?: string) => void;
  onOpenRiskRewardModal?: (setup?: {
    isLong: boolean;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    lotSize: number;
    drawingId?: string;
  }) => void;
  rrPlacementMode?: {
    isLong: boolean;
    slPips: number;
    ratio: number;
  } | null;
  onCompleteRRPlacement?: (price: number, time: number) => void;
  onLoadMoreHistory?: () => void;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
}

export const MihiretuViewChart: React.FC<MihiretuViewChartProps> = ({
  candles,
  symbolName,
  activeTool,
  setActiveTool,
  drawings,
  setDrawings,
  settings,
  timeframe,
  isMagnetActive = true,
  isMproPro = false,
  mproAccessMode = 'demo',
  onOpenMproModal,
  isMpro2Pro = false,
  mpro2AccessMode = 'demo',
  onOpenMpro2Modal,
  selectedMproRRSignal = null,
  onSelectMproRRSignal,
  onToggleIndicator,
  onUpdateIndicator,
  onOpenSettingsModal,
  onOpenRiskRewardModal,
  rrPlacementMode = null,
  onCompleteRRPlacement,
  onLoadMoreHistory,
  isLoadingMoreHistory = false,
  hasMoreHistory = true,
}) => {
  // Guarantee selectedSymbol is available as an alias for symbolName across the entire component
  const selectedSymbol = symbolName;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active Symbol Specification
  const activeSymbolSpec = useMemo(() => {
    return getSymbolSpec(symbolName);
  }, [symbolName]);

  // Canvas Dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Zoom & Pan State
  const [candleWidth, setCandleWidth] = useState(8); // Width of each candle in pixels
  const [scrollOffset, setScrollOffset] = useState(0); // Offset in pixels from the right-most edge
  const [priceScaleRatio, setPriceScaleRatio] = useState(1.0); // Vertical price scale height ratio (TradingView / MT5 style)
  const [verticalPanPixels, setVerticalPanPixels] = useState(0); // Vertical price pan offset in pixels (TradingView style UP/DOWN free pan)
  const hasDraggedRef = useRef<boolean>(false); // Track whether mouse moved during right-click or drag to suppress context menu

  // Interactivity State
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDrawingInProgress, setIsDrawingInProgress] = useState(false);
  const [newDrawingPoints, setNewDrawingPoints] = useState<DrawingPoint[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [isRrSettingsOpen, setIsRrSettingsOpen] = useState(false);
  const [rrSettingsTab, setRrSettingsTab] = useState<'style' | 'presets'>('style');
  const [draggedDrawingId, setDraggedDrawingId] = useState<string | null>(null);
  const [draggedHandleIndex, setDraggedHandleIndex] = useState<number | null>(null); // -1 for dragging body, >=0 for handle
  const [dragOffset, setDragOffset] = useState<{ time: number; price: number } | null>(null);

  // Snapping state
  const [snappedPoint, setSnappedPoint] = useState<DrawingPoint | null>(null);

  // Trade Planner Audit Inspection Focus state
  const [selectedTradePlannerTradeId, setSelectedTradePlannerTradeId] = useState<number | null>(null);

  // Touch gesture refs for mobile support
  const touchStartRef = useRef<{ startX: number; startY: number; startScrollOffset: number; isDraggingDrawing: boolean } | null>(null);
  const touchPinchRef = useRef<{ startDist: number; startCandleWidth: number; startScrollOffset: number; centerX: number; indexAtCenter: number } | null>(null);

  // Helper to check if an indicator has been permanently deleted
  const isIndicatorDeleted = (id: string) => {
    return settings.indicators.deletedIndicators?.includes(id) ?? false;
  };

  // Compute GTA Trend Filter results
  const gtaResults = useMemo(() => {
    if (isIndicatorDeleted('gta') || !settings.indicators.showGTA || candles.length === 0) return [];
    return calculateGTATrend(
      candles,
      settings.indicators.gtaLongPeriod ?? 21,
      settings.indicators.gtaMidPeriod ?? 13,
      settings.indicators.gtaShortPeriod ?? 6,
      settings.indicators.gtaArrowOffset ?? 0.10
    );
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showGTA,
    settings.indicators.gtaLongPeriod,
    settings.indicators.gtaMidPeriod,
    settings.indicators.gtaShortPeriod,
    settings.indicators.gtaArrowOffset,
  ]);

  // Compute Trendlines with Breaks (TWB)
  const twbResults = useMemo(() => {
    if (isIndicatorDeleted('twb') || !settings.indicators.showTrendlinesWithBreaks || candles.length === 0) return null;
    return calculateTrendlinesWithBreaks(
      candles,
      settings.indicators.twbLength ?? 14,
      settings.indicators.twbSlopeMultiplier ?? 1.6,
      settings.indicators.twbSlopeMethod ?? 'atr'
    );
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showTrendlinesWithBreaks,
    settings.indicators.twbLength,
    settings.indicators.twbSlopeMultiplier,
    settings.indicators.twbSlopeMethod,
  ]);

  // Compute Smart Money Concepts (SMC) directly on live candles
  const smcResults = useMemo(() => {
    if (isIndicatorDeleted('smc') || !settings.indicators.showSmartMoneyConcepts || candles.length === 0) return null;
    return calculateSmartMoneyConcepts(
      candles,
      settings.indicators.smcSwingLookback ?? 5,
      settings.indicators.smcObLimit ?? 5,
      settings.indicators.smcObMode ?? 'strong'
    );
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showSmartMoneyConcepts,
    settings.indicators.smcSwingLookback,
    settings.indicators.smcObLimit,
    settings.indicators.smcObMode,
  ]);

  // Compute multi-instance Smart Money Concepts (SMC) (e.g. 720 candles, Weekly HTF, Daily HTF)
  const smcInstancesResults = useMemo(() => {
    if (isIndicatorDeleted('smc')) return [];
    const instances = settings.indicators.smcInstances;
    if (!instances || !Array.isArray(instances) || instances.length === 0 || candles.length === 0) {
      return [];
    }
    return instances
      .filter((inst) => inst.enabled)
      .map((inst) => ({
        instance: inst,
        result: calculateSmartMoneyConceptsForInstance(candles, inst),
      }));
  }, [candles, settings.indicators.smcInstances]);

  // Compute Signals & Overlays (SO)
  const soResults = useMemo(() => {
    if (isIndicatorDeleted('so') || !settings.indicators.showSignalsAndOverlays || candles.length === 0) return null;
    return calculateSignalsAndOverlays(
      candles,
      settings.indicators.soSensitivity ?? 12,
      settings.indicators.soSignalMode ?? 'confirmation'
    );
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showSignalsAndOverlays,
    settings.indicators.soSensitivity,
    settings.indicators.soSignalMode,
  ]);

  // Compute Confluence FVG Finder
  const fvgResults = useMemo(() => {
    if (isIndicatorDeleted('fvg') || !settings.indicators.showConfluenceFVG || candles.length === 0) return null;
    return calculateConfluenceFVG(candles, timeframe, settings.indicators);
  }, [candles, timeframe, settings.indicators.deletedIndicators, settings.indicators.showConfluenceFVG, settings.indicators]);

  // Compute ICT Concepts
  const ictResults = useMemo(() => {
    if (isIndicatorDeleted('ict') || !settings.indicators.showIctConcepts || candles.length === 0) return null;
    return calculateIctConcepts(candles, settings.indicators);
  }, [candles, settings.indicators.deletedIndicators, settings.indicators.showIctConcepts, settings.indicators]);

  // Compute Auto Price Channels (4H Breakout & Trend Indicator - Strictly 4H Timeframe Enforced)
  const priceChannelsResults = useMemo(() => {
    if (isIndicatorDeleted('auto_price_channels') || (settings.indicators.showAutoPriceChannels ?? true) === false || candles.length === 0) return null;
    return calculateAutoPriceChannels4H(candles, timeframe, {
      lineColor: settings.indicators.autoPriceChannelsColor ?? '#38bdf8',
    });
  }, [candles, timeframe, settings.indicators.deletedIndicators, settings.indicators.showAutoPriceChannels, settings.indicators.autoPriceChannelsColor]);

  // Compute Zeiierman Market Structure & Price Action Toolkit
  const mstatResults = useMemo(() => {
    if (isIndicatorDeleted('mstat') || !settings.indicators.showMarketStructureToolkit || candles.length === 0) return null;
    return calculateMarketStructureToolkit(candles, settings.indicators);
  }, [candles, settings.indicators.deletedIndicators, settings.indicators.showMarketStructureToolkit, settings.indicators]);

  // Compute Pure Price Action Liquidity Sweeps [LuxAlgo]
  const pureLiquidityResults = useMemo(() => {
    if ((settings.indicators.showPureLiquiditySweeps ?? true) === false || candles.length === 0) return null;
    return calculatePureLiquiditySweeps(candles, {
      detectionMode: settings.indicators.pureLiquidityDetection ?? 'Long Term',
    });
  }, [candles, settings.indicators.showPureLiquiditySweeps, settings.indicators.pureLiquidityDetection]);

  // Compute Auto Supply & Demand Order Blocks + Parallel Trend Channel Indicator
  const autoSdcResults = useMemo(() => {
    if (isIndicatorDeleted('auto_sdc') || (settings.indicators.showAutoSupplyDemandChannel ?? true) === false || candles.length === 0) return null;
    return calculateAutoSupplyDemandChannel(candles);
  }, [candles, settings.indicators.deletedIndicators, settings.indicators.showAutoSupplyDemandChannel]);

  // Compute Market Structure Signals | ProjectSyndicate
  const mssResults = useMemo(() => {
    if (isIndicatorDeleted('mss') || (settings.indicators.showMarketStructureSignals ?? true) === false || candles.length === 0) return null;
    return calculateMarketStructureSignals(candles, {
      swingLength: settings.indicators.mssSwingLength ?? 25,
      bosConfirmation: settings.indicators.mssBosConfirmation ?? 'Close',
      showCHoCH: settings.indicators.mssShowCHoCH ?? true,
      tp1Percent: settings.indicators.mssTp1Percent ?? 20.0,
      tp2Percent: settings.indicators.mssTp2Percent ?? 30.0,
      slPercent: settings.indicators.mssSlPercent ?? 20.0,
      colorBullish: settings.indicators.mssColorBullish ?? '#21c997',
      colorBearish: settings.indicators.mssColorBearish ?? '#cc24e2',
      colorTP1: settings.indicators.mssColorTP1 ?? '#26a69a',
      colorTP2: settings.indicators.mssColorTP2 ?? '#00897b',
      colorSL: settings.indicators.mssColorSL ?? '#b71c1c',
      boxTransparency: settings.indicators.mssBoxTransparency ?? 85,
      borderTransparency: settings.indicators.mssBorderTransparency ?? 50,
      dashboardTextSize: settings.indicators.mssDashboardTextSize ?? 'Normal',
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showMarketStructureSignals,
    settings.indicators.mssSwingLength,
    settings.indicators.mssBosConfirmation,
    settings.indicators.mssShowCHoCH,
    settings.indicators.mssTp1Percent,
    settings.indicators.mssTp2Percent,
    settings.indicators.mssSlPercent,
    settings.indicators.mssColorBullish,
    settings.indicators.mssColorBearish,
    settings.indicators.mssColorTP1,
    settings.indicators.mssColorTP2,
    settings.indicators.mssColorSL,
    settings.indicators.mssBoxTransparency,
    settings.indicators.mssBorderTransparency,
    settings.indicators.mssDashboardTextSize,
  ]);

  // Compute Predictive Ranges [LuxAlgo]
  const predictiveRangesResults = useMemo(() => {
    if (isIndicatorDeleted('pr') || (settings.indicators.showPredictiveRanges ?? true) === false || candles.length === 0) return null;
    return calculatePredictiveRanges(candles, {
      length: settings.indicators.prLength ?? 200,
      mult: settings.indicators.prMult ?? 6.0,
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showPredictiveRanges,
    settings.indicators.prLength,
    settings.indicators.prMult,
  ]);

  // Compute Support Resistance Classification [LuxAlgo] / Mpro Signals
  const srClassificationResults = useMemo(() => {
    if (isIndicatorDeleted('sr') || (settings.indicators.showSrClassification ?? true) === false || candles.length === 0) return null;
    
    // In Demo mode, calculate strictly on historical past data and leave the latest 300+ candles completely free of lines/signals
    const DEMO_LOCKED_CANDLES = 300;
    const effectiveCandles = isMproPro
      ? candles
      : candles.slice(0, Math.max(20, candles.length - DEMO_LOCKED_CANDLES));

    return calculateSupportResistanceClassification(
      effectiveCandles,
      {
        isPro: isMproPro,
        lineExtension: settings.indicators.srLineExtension ?? 'Anchored',
        lookback: settings.indicators.srLookback ?? 100,
        fade: settings.indicators.srFade ?? 5,
        opt: settings.indicators.srOpt ?? 'line',
        colU: settings.indicators.srColU ?? '#22c55e',
        colD: settings.indicators.srColD ?? '#ef4444',
        left: settings.indicators.srLeft ?? 10,
        right: settings.indicators.srRight ?? 1,
        showPP: settings.indicators.srShowPP ?? false,
        showBreaks: settings.indicators.srShowBreaks ?? false,
        sets: [
          {
            choice: (settings.indicators.srChc1 as SRChoiceType) || 'SMA',
            length: settings.indicators.srLen1 ?? 50,
            mult: settings.indicators.srMlt1 ?? 2,
            res: settings.indicators.srRes1 || 'D',
          },
          {
            choice: (settings.indicators.srChc2 as SRChoiceType) || 'SMA',
            length: settings.indicators.srLen2 ?? 100,
            mult: settings.indicators.srMlt2 ?? 2,
            res: settings.indicators.srRes2 || 'D',
          },
          {
            choice: (settings.indicators.srChc3 as SRChoiceType) || 'SMA',
            length: settings.indicators.srLen3 ?? 20,
            mult: settings.indicators.srMlt3 ?? 2,
            res: settings.indicators.srRes3 || 'W',
          },
          {
            choice: (settings.indicators.srChc4 as SRChoiceType) || 'Previous High',
            length: settings.indicators.srLen4 ?? 20,
            mult: settings.indicators.srMlt4 ?? 2,
            res: settings.indicators.srRes4 || 'W',
          },
          {
            choice: (settings.indicators.srChc5 as SRChoiceType) || 'Previous Low',
            length: settings.indicators.srLen5 ?? 20,
            mult: settings.indicators.srMlt5 ?? 2,
            res: settings.indicators.srRes5 || 'W',
          },
          {
            choice: (settings.indicators.srChc6 as SRChoiceType) || 'Upper',
            length: settings.indicators.srLen6 ?? 20,
            mult: settings.indicators.srMlt6 ?? 2,
            res: settings.indicators.srRes6 || 'D',
          },
          {
            choice: (settings.indicators.srChc7 as SRChoiceType) || 'Lower',
            length: settings.indicators.srLen7 ?? 20,
            mult: settings.indicators.srMlt7 ?? 2,
            res: settings.indicators.srRes7 || 'D',
          },
          {
            choice: (settings.indicators.srChc8 as SRChoiceType) || 'Swings',
            length: settings.indicators.srLen8 ?? 20,
            mult: settings.indicators.srMlt8 ?? 2,
            res: settings.indicators.srRes8 || 'D',
          },
          {
            choice: (settings.indicators.srChc9 as SRChoiceType) || 'Fibonacci',
            length: settings.indicators.srLen9 ?? 20,
            mult: settings.indicators.srMlt9 ?? 2,
            res: settings.indicators.srRes9 || 'W',
          },
        ],
      },
      timeframe
    );
  }, [
    candles,
    isMproPro,
    timeframe,
    settings.indicators.showSrClassification,
    settings.indicators.srLineExtension,
    settings.indicators.srDisplayMode,
    settings.indicators.srShadowVisibility,
    settings.indicators.srLookback,
    settings.indicators.srFade,
    settings.indicators.srOpt,
    settings.indicators.srColU,
    settings.indicators.srColD,
    settings.indicators.srLeft,
    settings.indicators.srRight,
    settings.indicators.srShowPP,
    settings.indicators.srShowBreaks,
    settings.indicators.srChc1,
    settings.indicators.srLen1,
    settings.indicators.srMlt1,
    settings.indicators.srRes1,
    settings.indicators.srChc2,
    settings.indicators.srLen2,
    settings.indicators.srMlt2,
    settings.indicators.srRes2,
    settings.indicators.srChc3,
    settings.indicators.srLen3,
    settings.indicators.srMlt3,
    settings.indicators.srRes3,
    settings.indicators.srChc4,
    settings.indicators.srLen4,
    settings.indicators.srMlt4,
    settings.indicators.srRes4,
    settings.indicators.srChc5,
    settings.indicators.srLen5,
    settings.indicators.srMlt5,
    settings.indicators.srRes5,
    settings.indicators.srChc6,
    settings.indicators.srLen6,
    settings.indicators.srMlt6,
    settings.indicators.srRes6,
    settings.indicators.srChc7,
    settings.indicators.srLen7,
    settings.indicators.srMlt7,
    settings.indicators.srRes7,
    settings.indicators.srChc8,
    settings.indicators.srLen8,
    settings.indicators.srMlt8,
    settings.indicators.srRes8,
    settings.indicators.srChc9,
    settings.indicators.srLen9,
    settings.indicators.srMlt9,
    settings.indicators.srRes9,
    settings.indicators.srShowMidline,
    settings.indicators.srMidlineType,
    settings.indicators.srMidlineColor,
    settings.indicators.srMidlineWidth,
  ]);

  // Compute ECHO mpro (Echo Forecast [LuxAlgo])
  const echoResults = useMemo(() => {
    if (isIndicatorDeleted('echo') || (settings.indicators.showEchoMpro ?? true) === false || candles.length === 0) return null;
    return calculateEchoMpro(candles, {
      length: settings.indicators.echoLength ?? 50,
      fcast: settings.indicators.echoFcast ?? 50,
      fmode: settings.indicators.echoFmode ?? 'Similarity',
      cmode: settings.indicators.echoCmode ?? 'Cumulative',
      src: settings.indicators.echoSrc ?? 'close',
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showEchoMpro,
    settings.indicators.echoLength,
    settings.indicators.echoFcast,
    settings.indicators.echoFmode,
    settings.indicators.echoCmode,
    settings.indicators.echoSrc,
  ]);

  // Compute Mpro2 Signal (Fibonacci Confluence Suite)
  const mpro2Results = useMemo(() => {
    const isMasterActive = !isIndicatorDeleted('master') && (settings.indicators.showMasterDashboard ?? true);
    if ((isIndicatorDeleted('mpro2') && !isMasterActive) || ((settings.indicators.showMpro2Signal ?? true) === false && !isMasterActive) || candles.length === 0) return null;
    return calculateMpro2Signals(candles, {
      isPro: isMpro2Pro,
      accessMode: mpro2AccessMode,
      rangeMode: settings.indicators.mpro2RangeMode ?? 'WeeklyAnchor',
      lookbackPeriod: settings.indicators.mpro2LookbackPeriod ?? 200,
      delayBars: settings.indicators.mpro2DelayBars ?? 5,
      lineExtensionMode: settings.indicators.mpro2LineExtensionMode ?? 'FullChart',
      reverseDirection: settings.indicators.mpro2ReverseDirection ?? false,
      showBaseLine0000: settings.indicators.mpro2ShowBaseLine0000 ?? true,
      showBaseLine1000: settings.indicators.mpro2ShowBaseLine1000 ?? true,
      baseLineColor: settings.indicators.mpro2BaseLineColor ?? '#2962FF',
      baseLineStyle: settings.indicators.mpro2BaseLineStyle ?? 'Solid',
      baseLineWidth: settings.indicators.mpro2BaseLineWidth ?? 2,
      showDottedLines: settings.indicators.mpro2ShowDottedLines ?? true,
      showExtLine1: settings.indicators.mpro2ShowExtLine1 ?? true,
      extLineRatio1: settings.indicators.mpro2ExtLineRatio1 ?? 0.236,
      showExtLine2: settings.indicators.mpro2ShowExtLine2 ?? true,
      extLineRatio2: settings.indicators.mpro2ExtLineRatio2 ?? 0.382,
      showExtLine3: settings.indicators.mpro2ShowExtLine3 ?? true,
      extLineRatio3: settings.indicators.mpro2ExtLineRatio3 ?? 0.500,
      showExtLine4: settings.indicators.mpro2ShowExtLine4 ?? true,
      extLineRatio4: settings.indicators.mpro2ExtLineRatio4 ?? 0.618,
      showExtLine5: settings.indicators.mpro2ShowExtLine5 ?? true,
      extLineRatio5: settings.indicators.mpro2ExtLineRatio5 ?? 0.786,
      showExtLine6: settings.indicators.mpro2ShowExtLine6 ?? false,
      extLineRatio6: settings.indicators.mpro2ExtLineRatio6 ?? 1.272,
      showExtLine7: settings.indicators.mpro2ShowExtLine7 ?? false,
      extLineRatio7: settings.indicators.mpro2ExtLineRatio7 ?? 1.414,
      showExtLine8: settings.indicators.mpro2ShowExtLine8 ?? false,
      extLineRatio8: settings.indicators.mpro2ExtLineRatio8 ?? 1.618,
      showExtLine9: settings.indicators.mpro2ShowExtLine9 ?? false,
      extLineRatio9: settings.indicators.mpro2ExtLineRatio9 ?? 2.000,
      extLineColor: settings.indicators.mpro2ExtLineColor ?? '#787B86',
      extLineStyle: settings.indicators.mpro2ExtLineStyle ?? 'Dotted',
      extLineWidth: settings.indicators.mpro2ExtLineWidth ?? 1,
      showGoldenPocket: settings.indicators.mpro2ShowGoldenPocket ?? true,
      goldenPocketColor: settings.indicators.mpro2GoldenPocketColor ?? '#FFB020',
      showTouchCounts: settings.indicators.mpro2ShowTouchCounts ?? true,
      showScreenTexts: settings.indicators.mpro2ShowScreenTexts ?? true,
      showLevelLabels: settings.indicators.mpro2ShowLevelLabels ?? true,
      showConfluence: settings.indicators.mpro2ShowConfluence ?? true,
      priorSwingCount: settings.indicators.mpro2PriorSwingCount ?? 2,
      confluenceTolerancePct: settings.indicators.mpro2ConfluenceTolerancePct ?? 0.15,
      confluenceWidthBoost: settings.indicators.mpro2ConfluenceWidthBoost ?? 2,
      confluenceMarker: settings.indicators.mpro2ConfluenceMarker ?? '★',
      useAdaptiveDetection: settings.indicators.mpro2UseAdaptiveDetection ?? false,
      atrLength: settings.indicators.mpro2AtrLength ?? 14,
      atrBaselineLength: settings.indicators.mpro2AtrBaselineLength ?? 100,
      showTimeZones: settings.indicators.mpro2ShowTimeZones ?? false,
      timeZoneCount: settings.indicators.mpro2TimeZoneCount ?? 5,
      timeZoneColor: settings.indicators.mpro2TimeZoneColor ?? '#D4AF37',
      useMultiColorZones: settings.indicators.mpro2UseMultiColorZones ?? true,
      showTimeZoneLabels: settings.indicators.mpro2ShowTimeZoneLabels ?? false,
      showStatusTable: settings.indicators.mpro2ShowStatusTable ?? true,
      tablePosition: settings.indicators.mpro2TablePosition ?? 'Top Right',
      bullColor: settings.indicators.mpro2BullColor ?? '#26A69A',
      bearColor: settings.indicators.mpro2BearColor ?? '#EF5350',
      showTouchArrows: settings.indicators.mpro2ShowTouchArrows ?? true,
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showMasterDashboard,
    settings.indicators.showMpro2Signal,
    settings.indicators.mpro2RangeMode,
    settings.indicators.mpro2LookbackPeriod,
    settings.indicators.mpro2DelayBars,
    settings.indicators.mpro2LineExtensionMode,
    settings.indicators.mpro2ReverseDirection,
    settings.indicators.mpro2ShowBaseLine0000,
    settings.indicators.mpro2ShowBaseLine1000,
    settings.indicators.mpro2BaseLineColor,
    settings.indicators.mpro2BaseLineStyle,
    settings.indicators.mpro2BaseLineWidth,
    settings.indicators.mpro2ShowDottedLines,
    settings.indicators.mpro2ShowExtLine1,
    settings.indicators.mpro2ExtLineRatio1,
    settings.indicators.mpro2ShowExtLine2,
    settings.indicators.mpro2ExtLineRatio2,
    settings.indicators.mpro2ShowExtLine3,
    settings.indicators.mpro2ExtLineRatio3,
    settings.indicators.mpro2ShowExtLine4,
    settings.indicators.mpro2ExtLineRatio4,
    settings.indicators.mpro2ShowExtLine5,
    settings.indicators.mpro2ExtLineRatio5,
    settings.indicators.mpro2ShowExtLine6,
    settings.indicators.mpro2ExtLineRatio6,
    settings.indicators.mpro2ShowExtLine7,
    settings.indicators.mpro2ExtLineRatio7,
    settings.indicators.mpro2ShowExtLine8,
    settings.indicators.mpro2ExtLineRatio8,
    settings.indicators.mpro2ShowExtLine9,
    settings.indicators.mpro2ExtLineRatio9,
    settings.indicators.mpro2ExtLineColor,
    settings.indicators.mpro2ExtLineStyle,
    settings.indicators.mpro2ExtLineWidth,
    settings.indicators.mpro2ShowGoldenPocket,
    settings.indicators.mpro2GoldenPocketColor,
    settings.indicators.mpro2ShowTouchCounts,
    settings.indicators.mpro2ShowScreenTexts,
    settings.indicators.mpro2ShowLevelLabels,
    settings.indicators.mpro2ShowConfluence,
    settings.indicators.mpro2PriorSwingCount,
    settings.indicators.mpro2ConfluenceTolerancePct,
    settings.indicators.mpro2ConfluenceWidthBoost,
    settings.indicators.mpro2ConfluenceMarker,
    settings.indicators.mpro2UseAdaptiveDetection,
    settings.indicators.mpro2AtrLength,
    settings.indicators.mpro2AtrBaselineLength,
    settings.indicators.mpro2ShowTimeZones,
    settings.indicators.mpro2TimeZoneCount,
    settings.indicators.mpro2TimeZoneColor,
    settings.indicators.mpro2UseMultiColorZones,
    settings.indicators.mpro2ShowTimeZoneLabels,
    settings.indicators.mpro2ShowStatusTable,
    settings.indicators.mpro2TablePosition,
    settings.indicators.mpro2BullColor,
    settings.indicators.mpro2BearColor,
    settings.indicators.mpro2ShowTouchArrows,
    isMpro2Pro,
    mpro2AccessMode,
  ]);

  // Compute HVN Profile (ATAS Market Profile by ProfitPro)
  const hvnResults = useMemo(() => {
    if (isIndicatorDeleted('hvn') || (settings.indicators.showHvnProfile ?? true) === false || candles.length === 0) return null;
    return calculateHvnProfile(candles, {
      periodBars: settings.indicators.hvnPeriodBars ?? 60,
      numBins: settings.indicators.hvnNumBins ?? 40,
      zoneThicknessPct: settings.indicators.hvnZoneThicknessPct ?? 3.0,
      extensionMode: settings.indicators.hvnExtensionMode ?? 'Mitigation',
      mitigationType: settings.indicators.hvnMitigationType ?? 'Touch',
      showSecondaryNodes: settings.indicators.hvnShowSecondaryNodes ?? false,
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showHvnProfile,
    settings.indicators.hvnPeriodBars,
    settings.indicators.hvnNumBins,
    settings.indicators.hvnZoneThicknessPct,
    settings.indicators.hvnExtensionMode,
    settings.indicators.hvnMitigationType,
    settings.indicators.hvnShowSecondaryNodes,
  ]);

  // Compute Nexus: Smart Money Suite [BullByte]
  const nexusResults = useMemo(() => {
    if (isIndicatorDeleted('nexus') || (settings.indicators.showNexusSuite ?? true) === false || candles.length === 0) return null;
    return evaluateNexusSuite(candles, timeframe, settings.indicators);
  }, [candles, timeframe, settings.indicators.deletedIndicators, settings.indicators]);

  // Compute Session Filter (Intraday Market Sessions: Asia, London, New York)
  const sessionFilterIntervals = useMemo(() => {
    if (isIndicatorDeleted('session') || (settings.indicators.showSessionFilter ?? true) === false || candles.length === 0) return [];
    if (timeframe === '1D') return [];
    return calculateSessionFilter(candles, settings.indicators);
  }, [candles, timeframe, settings.indicators.deletedIndicators, settings.indicators]);

  // Compute Order Blocks with Volume Delta (cTrader Store / Pepperstone Specification)
  const orderBlocksWithVolumeResult = useMemo(() => {
    if (isIndicatorDeleted('obv') || (settings.indicators.showOrderBlocksWithVolume ?? true) === false || candles.length === 0) return null;
    return calculateOrderBlocksWithVolume(candles, {
      swingLength: settings.indicators.obvSwingLength ?? 10,
      invalidation: settings.indicators.obvInvalidation ?? 'Wick',
      showNearest: settings.indicators.obvShowNearest ?? 10,
      extendZones: settings.indicators.obvExtendZones ?? 10,
      hideInvalidatedZones: settings.indicators.obvHideInvalidatedZones ?? true,
      enableVolumeDelta: settings.indicators.obvEnableVolumeDelta ?? true,
      displayTotalVolume: settings.indicators.obvDisplayTotalVolume ?? true,
      showDeltaPercent: settings.indicators.obvShowDeltaPercent ?? true,
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showOrderBlocksWithVolume,
    settings.indicators.obvSwingLength,
    settings.indicators.obvInvalidation,
    settings.indicators.obvShowNearest,
    settings.indicators.obvExtendZones,
    settings.indicators.obvHideInvalidatedZones,
    settings.indicators.obvEnableVolumeDelta,
    settings.indicators.obvDisplayTotalVolume,
    settings.indicators.obvShowDeltaPercent,
  ]);

  // Compute PRO Institutional Order Blocks (Live 8-Factor Strength & Shadow Engine)
  const proOrderBlocksResult = useMemo(() => {
    if (isIndicatorDeleted('pro_ob') || (settings.indicators.showProOrderBlocks ?? true) === false || candles.length === 0) return null;
    return calculateProOrderBlocks(candles, {
      minScore: settings.indicators.proObMinScore ?? 4,
      showShadow: settings.indicators.proObShowShadow ?? true,
      shadowOpacity: settings.indicators.proObShadowOpacity ?? 25,
      extendBars: settings.indicators.proObExtendBars ?? 20,
      showStrengthPercent: settings.indicators.proObShowStrengthPercent ?? true,
      showScore: settings.indicators.proObShowScore ?? true,
      showOnlyUnmitigated: settings.indicators.proObShowOnlyUnmitigated ?? false,
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showProOrderBlocks,
    settings.indicators.proObMinScore,
    settings.indicators.proObShowShadow,
    settings.indicators.proObShadowOpacity,
    settings.indicators.proObExtendBars,
    settings.indicators.proObShowStrengthPercent,
    settings.indicators.proObShowScore,
    settings.indicators.proObShowOnlyUnmitigated,
  ]);

  // Compute Market Tick Two [MarkitTick] — Enhanced Filters (Market Structure Target Tracker)
  const msttResults: MsttResult | null = useMemo(() => {
    const isMsttEnabled = !isIndicatorDeleted('mstt') && ((settings.indicators.showMarketTickTwo ?? settings.indicators.showMarketStructureTargetTracker) ?? true);
    if (!isMsttEnabled || candles.length === 0) return null;
    return calculateMarketStructureTargetTracker(candles, {
      swingLen: settings.indicators.msttSwingLen ?? 5,
      // Enhanced Filters Edition Options
      useStructureFilter: settings.indicators.msttUseStructureFilter ?? true,
      structureTf: settings.indicators.msttStructureTf ?? '15',
      filterSwingLen: settings.indicators.msttFilterSwingLen ?? 5,
      useWickFilter: settings.indicators.msttUseWickFilter ?? true,
      maxWickRatio: settings.indicators.msttMaxWickRatio ?? 0.70,
      useSweepFilter: settings.indicators.msttUseSweepFilter ?? false,
      sweepLookback: settings.indicators.msttSweepLookback ?? 10,
      // Enhanced Filters v2 Edition
      useBodyCloseFilter: settings.indicators.msttUseBodyCloseFilter ?? true,
      minBodyRatio: settings.indicators.msttMinBodyRatio ?? 0.50,
      useDisplacementFilter: settings.indicators.msttUseDisplacementFilter ?? true,
      minDisplacementAtr: settings.indicators.msttMinDisplacementAtr ?? 0.80,
      useFvgFilter: settings.indicators.msttUseFvgFilter ?? false,
      useVolumeFilter: settings.indicators.msttUseVolumeFilter ?? false,
      volumeLength: settings.indicators.msttVolumeLength ?? 20,
      volumeMultiplier: settings.indicators.msttVolumeMultiplier ?? 1.20,
      useScoreFilter: settings.indicators.msttUseScoreFilter ?? false,
      minContinuationScore: settings.indicators.msttMinContinuationScore ?? 60,
      // Vis & Alerts
      showBosLine: settings.indicators.msttShowBosLine ?? true,
      showLabel: settings.indicators.msttShowLabel ?? true,
      invalidateMode: settings.indicators.msttInvalidateMode ?? true,
      colBullBos: settings.indicators.msttColBullBos ?? 'rgb(0, 200, 120)',
      colBearBos: settings.indicators.msttColBearBos ?? 'rgb(220, 50, 50)',
      colTarget: settings.indicators.msttColTarget ?? 'rgb(255, 200, 0)',
      colHit: settings.indicators.msttColHit ?? 'rgb(180, 100, 255)',
      showTpSl: settings.indicators.msttShowTpSl ?? true,
      slMulti: settings.indicators.msttSlMulti ?? 1.0,
      tp1Multi: settings.indicators.msttTp1Multi ?? 1.5,
      tp2Multi: settings.indicators.msttTp2Multi ?? 2.5,
      tp3Multi: settings.indicators.msttTp3Multi ?? 5.0,
      atrLen: settings.indicators.msttAtrLen ?? 14,
      colEntry: settings.indicators.msttColEntry ?? 'rgb(100, 180, 255)',
      colSl: settings.indicators.msttColSl ?? 'rgb(255, 60, 60)',
      colTp1: settings.indicators.msttColTp1 ?? 'rgb(0, 220, 130)',
      colTp2: settings.indicators.msttColTp2 ?? 'rgb(0, 255, 180)',
      colTp3: settings.indicators.msttColTp3 ?? 'rgb(0, 255, 255)',
      showSl: settings.indicators.msttShowSl,
      showTp1: settings.indicators.msttShowTp1,
      showTp2: settings.indicators.msttShowTp2,
      showTp3: settings.indicators.msttShowTp3,
      showSlShade: settings.indicators.msttShowSlShade,
      showTp1Shade: settings.indicators.msttShowTp1Shade,
      showTp2Shade: settings.indicators.msttShowTp2Shade,
      showTp3Shade: settings.indicators.msttShowTp3Shade,
      htfRes: settings.indicators.msttHtfRes ?? '240',
      useHtfFilter: settings.indicators.msttUseHtfFilter ?? true,
      htfRsiLen: settings.indicators.msttHtfRsiLen ?? 14,
      keepN: settings.indicators.msttKeepN ?? 10,
      targetFocus: settings.indicators.msttTargetFocus ?? 'TP1',
      targetMode: settings.indicators.msttTargetMode ?? 'atr',
      pointsSl: settings.indicators.msttPointsSl ?? 220,
      pointsTp1: settings.indicators.msttPointsTp1 ?? 1030,
      pointsTp2: settings.indicators.msttPointsTp2 ?? 2060,
      pointsTp3: settings.indicators.msttPointsTp3 ?? 3090,
      preventLateEntry: settings.indicators.msttPreventLateEntry ?? true,
      maxBreakoutDelay: settings.indicators.msttMaxBreakoutDelay ?? 1,
      // EMA, ADX Regime Engine, and Strong Breakout Candle Filters
      useEmaFilter: settings.indicators.msttUseEmaFilter ?? false,
      emaLen: settings.indicators.msttEmaLen ?? 200,
      useAdxFilter: settings.indicators.msttUseAdxFilter ?? true,
      diLen: settings.indicators.msttDiLen ?? 14,
      adxSmooth: settings.indicators.msttAdxSmooth ?? 14,
      minAdx: settings.indicators.msttMinAdx ?? 20.0,
      useCandleFilter: settings.indicators.msttUseCandleFilter ?? false,
      minBodyAtr: settings.indicators.msttMinBodyAtr ?? 0.20,
      breakoutBufferAtr: settings.indicators.msttBreakoutBufferAtr ?? 0.00,
    }, (symbolName || 'MARKET').replace(/^(FRX|CRY|OTC|DERIV)_?/i, ''));
  }, [
    candles,
    symbolName,
    settings.indicators.showMarketStructureTargetTracker,
    settings.indicators.showMarketTickTwo,
    settings.indicators.msttSwingLen,
    settings.indicators.msttUseStructureFilter,
    settings.indicators.msttStructureTf,
    settings.indicators.msttFilterSwingLen,
    settings.indicators.msttUseWickFilter,
    settings.indicators.msttMaxWickRatio,
    settings.indicators.msttUseSweepFilter,
    settings.indicators.msttSweepLookback,
    settings.indicators.msttUseBodyCloseFilter,
    settings.indicators.msttMinBodyRatio,
    settings.indicators.msttUseDisplacementFilter,
    settings.indicators.msttMinDisplacementAtr,
    settings.indicators.msttUseFvgFilter,
    settings.indicators.msttUseVolumeFilter,
    settings.indicators.msttVolumeLength,
    settings.indicators.msttVolumeMultiplier,
    settings.indicators.msttUseScoreFilter,
    settings.indicators.msttMinContinuationScore,
    settings.indicators.msttShowBosLine,
    settings.indicators.msttShowLabel,
    settings.indicators.msttInvalidateMode,
    settings.indicators.msttColBullBos,
    settings.indicators.msttColBearBos,
    settings.indicators.msttColTarget,
    settings.indicators.msttColHit,
    settings.indicators.msttShowTpSl,
    settings.indicators.msttSlMulti,
    settings.indicators.msttTp1Multi,
    settings.indicators.msttTp2Multi,
    settings.indicators.msttTp3Multi,
    settings.indicators.msttAtrLen,
    settings.indicators.msttColEntry,
    settings.indicators.msttColSl,
    settings.indicators.msttColTp1,
    settings.indicators.msttColTp2,
    settings.indicators.msttColTp3,
    settings.indicators.msttShowSl,
    settings.indicators.msttShowTp1,
    settings.indicators.msttShowTp2,
    settings.indicators.msttShowTp3,
    settings.indicators.msttShowSlShade,
    settings.indicators.msttShowTp1Shade,
    settings.indicators.msttShowTp2Shade,
    settings.indicators.msttShowTp3Shade,
    settings.indicators.msttHtfRes,
    settings.indicators.msttUseHtfFilter,
    settings.indicators.msttHtfRsiLen,
    settings.indicators.msttKeepN,
    settings.indicators.msttTargetFocus,
    settings.indicators.msttTargetMode,
    settings.indicators.msttPointsSl,
    settings.indicators.msttPointsTp1,
    settings.indicators.msttPointsTp2,
    settings.indicators.msttPointsTp3,
    settings.indicators.msttPreventLateEntry,
    settings.indicators.msttMaxBreakoutDelay,
    settings.indicators.msttUseEmaFilter,
    settings.indicators.msttEmaLen,
    settings.indicators.msttUseAdxFilter,
    settings.indicators.msttDiLen,
    settings.indicators.msttAdxSmooth,
    settings.indicators.msttMinAdx,
    settings.indicators.msttUseCandleFilter,
    settings.indicators.msttMinBodyAtr,
    settings.indicators.msttBreakoutBufferAtr,
  ]);

  // Compute VIP Market Scanner™ (Single Pair Matrix Engine)
  const vipScannerResults: VipScannerResult | null = useMemo(() => {
    if (isIndicatorDeleted('vip_scanner') || (settings.indicators.showVipMarketScanner ?? true) === false || candles.length === 0) return null;
    return calculateVipMarketScanner(candles, timeframe, symbolName, {
      rsiPeriod: settings.indicators.vipScannerRsiPeriod ?? 14,
      fastEma: settings.indicators.vipScannerFastEma ?? 9,
      slowEma: settings.indicators.vipScannerSlowEma ?? 21,
      signalEma: settings.indicators.vipScannerSignalEma ?? 50,
      showAlignmentSignals: settings.indicators.vipScannerShowSignals ?? true,
    });
  }, [
    candles,
    timeframe,
    symbolName,
    settings.indicators.deletedIndicators,
    settings.indicators.showVipMarketScanner,
    settings.indicators.vipScannerRsiPeriod,
    settings.indicators.vipScannerFastEma,
    settings.indicators.vipScannerSlowEma,
    settings.indicators.vipScannerSignalEma,
    settings.indicators.vipScannerShowSignals,
  ]);

  // Compute Premium Signals with Dynamic TP & SL Optimization
  const dynamicTpSlResults: DynamicTpSlResults | null = useMemo(() => {
    if (isIndicatorDeleted('dynamic_tpsl') || (settings.indicators.showDynamicTpSlSignals ?? true) === false || candles.length === 0) return null;
    return calculatePremiumDynamicTpSlSignals(candles, {
      period1: settings.indicators.dynPeriod1 ?? 14,
      multiplier1: settings.indicators.dynMultiplier1 ?? 1.5,
      period2: settings.indicators.dynPeriod2 ?? 34,
      multiplier2: settings.indicators.dynMultiplier2 ?? 2.5,
      priceSource: settings.indicators.dynPriceSource ?? 'close',
      tp1Factor: settings.indicators.dynTp1Factor ?? 1.0,
      tp2Factor: settings.indicators.dynTp2Factor ?? 2.0,
      tp3Factor: settings.indicators.dynTp3Factor ?? 3.0,
      slRatio: settings.indicators.dynSlRatio ?? 0.50,
      rangeLookback: settings.indicators.dynRangeLookback ?? 10,
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showDynamicTpSlSignals,
    settings.indicators.dynPeriod1,
    settings.indicators.dynMultiplier1,
    settings.indicators.dynPeriod2,
    settings.indicators.dynMultiplier2,
    settings.indicators.dynPriceSource,
    settings.indicators.dynTp1Factor,
    settings.indicators.dynTp2Factor,
    settings.indicators.dynTp3Factor,
    settings.indicators.dynSlRatio,
    settings.indicators.dynRangeLookback,
  ]);

  // Compute Trade Planner Buy Sell Signals, Stop Loss, TP & Lot Size [LunqFX]
  const tradePlannerResults: TradePlannerResult | null = useMemo(() => {
    if (isIndicatorDeleted('trade_planner') || (settings.indicators.showTradePlanner ?? true) === false || candles.length === 0) return null;
    return calculateTradePlanner(
      candles,
      {
        balance: settings.indicators.tpBalance ?? 10000,
        riskPct: settings.indicators.tpRiskPct ?? 1.0,
        accCur: settings.indicators.tpAccCur ?? 'USD',
        lotOver: settings.indicators.tpLotOver ?? 0,
        fastLen: Number(settings.indicators.tpFastLen) >= 3 ? Number(settings.indicators.tpFastLen) : 21,
        slowLen: Number(settings.indicators.tpSlowLen) >= 3 ? Number(settings.indicators.tpSlowLen) : 50,
        rsiLen: settings.indicators.tpRsiLen ?? 14,
        zoneW: settings.indicators.tpZoneW ?? 0.25,
        slBuf: settings.indicators.tpSlBuf ?? 0.20,
        minStop: settings.indicators.tpMinStop ?? 0.50,
        maxStop: settings.indicators.tpMaxStop ?? 3.0,
        retestMode: settings.indicators.tpRetestMode ?? 'retest_touch',
        retestTouchTarget: settings.indicators.tpRetestTouchTarget ?? 'slow_ema',
        exhaustionFilter: settings.indicators.tpExhaustionFilter ?? true,
        maxClimaxPoints: settings.indicators.tpMaxClimaxPoints ?? 5000,
        targetMode: settings.indicators.tpTargetMode ?? 'r_multiple',
        cashSl: settings.indicators.tpCashSl ?? 1.0,
        cashTp1: settings.indicators.tpCashTp1 ?? 1.0,
        cashTp2: settings.indicators.tpCashTp2 ?? 2.0,
        cashTp3: settings.indicators.tpCashTp3 ?? 3.0,
        pipsSl: settings.indicators.tpPipsSl ?? 220,
        pipsTp1: settings.indicators.tpPipsTp1 ?? 1030,
        pipsTp2: settings.indicators.tpPipsTp2 ?? 2060,
        pipsTp3: settings.indicators.tpPipsTp3 ?? 3090,
        targetFocus: settings.indicators.tpTargetFocus ?? 'TP1',
        slMult: settings.indicators.tpSlMult ?? 1.0,
        r1: settings.indicators.tpR1 ?? 1.0,
        r2: settings.indicators.tpR2 ?? 2.0,
        r3: settings.indicators.tpR3 ?? 3.0,
        brokerPreset: settings.indicators.tpBrokerPreset ?? 'auto',
        pointValue: settings.indicators.tpPointValue ?? 1.0,
        minLot: settings.indicators.tpMinLot ?? 0.001,
        lotStep: settings.indicators.tpLotStep ?? 0.001,
        beOn: settings.indicators.tpBeOn ?? false,
        oppOn: settings.indicators.tpOppOn ?? true,
        candSty: settings.indicators.tpCandSty ?? 'Neon Bloom',
        showZone: settings.indicators.tpShowZone ?? true,
        tagSize: settings.indicators.tpTagSize ?? 'Normal',
        keepN: settings.indicators.tpKeepN ?? 2,
        showHUD: settings.indicators.tpShowHud ?? true,
        hudPos: settings.indicators.tpHudPos ?? 'Top Right',
        hudSize: settings.indicators.tpHudSize ?? 'Normal',
        showSignals: settings.indicators.tpShowSignals ?? true,
        showEntryLabel: settings.indicators.tpShowEntryLabel ?? false,
        showPlanBoxes: settings.indicators.tpShowPlans ?? true,
        showEmaLines: settings.indicators.tpShowEmaLines ?? true,
        showSl: settings.indicators.tpShowSl ?? true,
        showTp1: settings.indicators.tpShowTp1 ?? true,
        showTp2: settings.indicators.tpShowTp2 ?? true,
        showTp3: settings.indicators.tpShowTp3 ?? true,
        showDottedLines: settings.indicators.tpShowDottedLines ?? true,
        filterAdx: settings.indicators.tpFilterAdx ?? false,
        filterSlope: settings.indicators.tpFilterSlope ?? false,
        filterRsiExhaustion: settings.indicators.tpFilterRsiExhaustion ?? false,
        filterWickRejection: settings.indicators.tpFilterWickRejection ?? false,
        filterVolatility: settings.indicators.tpFilterVolatility ?? false,
        filterMinStopDist: settings.indicators.tpFilterMinStopDist ?? false,
      },
      symbolName
    );
  }, [
    candles,
    symbolName,
    settings.indicators.deletedIndicators,
    settings.indicators.showTradePlanner,
    settings.indicators.tpBalance,
    settings.indicators.tpRiskPct,
    settings.indicators.tpAccCur,
    settings.indicators.tpLotOver,
    settings.indicators.tpFastLen,
    settings.indicators.tpSlowLen,
    settings.indicators.tpRsiLen,
    settings.indicators.tpZoneW,
    settings.indicators.tpSlBuf,
    settings.indicators.tpMinStop,
    settings.indicators.tpMaxStop,
    settings.indicators.tpPbBars,
    settings.indicators.tpRetestMode,
    settings.indicators.tpRetestTouchTarget,
    settings.indicators.tpExhaustionFilter,
    settings.indicators.tpMaxClimaxPoints,
    settings.indicators.tpTargetMode,
    settings.indicators.tpCashSl,
    settings.indicators.tpCashTp1,
    settings.indicators.tpCashTp2,
    settings.indicators.tpCashTp3,
    settings.indicators.tpPipsSl,
    settings.indicators.tpPipsTp1,
    settings.indicators.tpPipsTp2,
    settings.indicators.tpPipsTp3,
    settings.indicators.tpTargetFocus,
    settings.indicators.tpSlMult,
    settings.indicators.tpR1,
    settings.indicators.tpR2,
    settings.indicators.tpR3,
    settings.indicators.tpBrokerPreset,
    settings.indicators.tpPointValue,
    settings.indicators.tpMinLot,
    settings.indicators.tpLotStep,
    settings.indicators.tpBeOn,
    settings.indicators.tpOppOn,
    settings.indicators.tpCandSty,
    settings.indicators.tpShowZone,
    settings.indicators.tpTagSize,
    settings.indicators.tpKeepN,
    settings.indicators.tpShowHud,
    settings.indicators.tpHudPos,
    settings.indicators.tpHudSize,
    settings.indicators.tpShowSignals,
    settings.indicators.tpShowEntryLabel,
    settings.indicators.tpShowPlans,
    settings.indicators.tpShowEmaLines,
    settings.indicators.tpShowSl,
    settings.indicators.tpShowTp1,
    settings.indicators.tpShowTp2,
    settings.indicators.tpShowTp3,
    settings.indicators.tpShowDottedLines,
    settings.indicators.tpFilterAdx,
    settings.indicators.tpFilterSlope,
    settings.indicators.tpFilterRsiExhaustion,
    settings.indicators.tpFilterWickRejection,
    settings.indicators.tpFilterVolatility,
    settings.indicators.tpFilterMinStopDist,
  ]);

  // Compute Fibonacci Sequence Swing [ChartPrime]
  const fibSwingResults: FibSwingResult | null = useMemo(() => {
    if (isIndicatorDeleted('fib_swing') || (settings.indicators.showFibonacciSequenceSwing ?? true) === false || candles.length === 0) return null;
    return calculateFibonacciSequenceSwing(candles, {
      depth: settings.indicators.fibDepth ?? 20,
      zigCol: settings.indicators.fibZigCol ?? 'rgb(146, 151, 167)',
      colUp: settings.indicators.fibColUp ?? '#22c55e',
      colDn: settings.indicators.fibColDn ?? '#ef4444',
      maxRetest: settings.indicators.fibMaxRetest ?? 30,
      showZigZag: settings.indicators.fibShowZigZag ?? true,
      showLevels: settings.indicators.fibShowLevels ?? true,
      showLabels: settings.indicators.fibShowLabels ?? true,
      showArrows: settings.indicators.fibShowArrows ?? true,
      showHistorical: settings.indicators.fibShowHistorical ?? true,
      earlyTurnMode: settings.indicators.fibEarlyTurnMode ?? true,
      earlyDepth: settings.indicators.fibEarlyDepth ?? 12,
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showFibonacciSequenceSwing,
    settings.indicators.fibDepth,
    settings.indicators.fibZigCol,
    settings.indicators.fibColUp,
    settings.indicators.fibColDn,
    settings.indicators.fibMaxRetest,
    settings.indicators.fibShowZigZag,
    settings.indicators.fibShowLevels,
    settings.indicators.fibShowLabels,
    settings.indicators.fibShowArrows,
    settings.indicators.fibShowHistorical,
    settings.indicators.fibEarlyTurnMode,
    settings.indicators.fibEarlyDepth,
  ]);

  // Compute Multi-Timeframe EMA 15m 1H [Pine Script v6 Exact Port]
  const mtfEmaResults: MtfEmaResult | null = useMemo(() => {
    if (isIndicatorDeleted('mtf_ema') || (settings.indicators.showMultiTimeframeEma ?? true) === false || candles.length === 0) return null;
    return calculateMultiTimeframeEma(
      candles,
      {
        length: settings.indicators.mtfEmaLength ?? 20,
        show15min: settings.indicators.mtfEmaShow15min ?? true,
        show60min: settings.indicators.mtfEmaShow60min ?? true,
        color15min: settings.indicators.mtfEmaColor15min ?? '#00008B',
        color60min: settings.indicators.mtfEmaColor60min ?? '#FF0000',
        adaptiveTf: settings.indicators.mtfEmaAdaptiveTf ?? false,
      },
      timeframe
    );
  }, [
    candles,
    timeframe,
    settings.indicators.deletedIndicators,
    settings.indicators.showMultiTimeframeEma,
    settings.indicators.mtfEmaLength,
    settings.indicators.mtfEmaShow15min,
    settings.indicators.mtfEmaShow60min,
    settings.indicators.mtfEmaColor15min,
    settings.indicators.mtfEmaColor60min,
    settings.indicators.mtfEmaAdaptiveTf,
  ]);

  // Compute Mrov Trade: Opening Range (Pine Script v6 Exact Port)
  const mrovTradeResults: MrovTradeResult | null = useMemo(() => {
    if (isIndicatorDeleted('mrov_trade') || !settings.indicators.showMrovOpeningRange || candles.length === 0) return null;
    return calculateMrovTradeOpeningRange(candles, timeframe, {
      rangeColor: settings.indicators.mrovRangeColor,
      fillTransparency: settings.indicators.mrovFillTransparency,
      borderWidth: settings.indicators.mrovBorderWidth,
      levelWidth: settings.indicators.mrovLevelWidth,
      showRangeCaption: settings.indicators.mrovShowRangeCaption,
      longColor: settings.indicators.mrovLongColor,
      shortColor: settings.indicators.mrovShortColor,
      highlightBreakout: settings.indicators.mrovHighlightBreakout,
      showSignalLabels: settings.indicators.mrovShowSignalLabels,
      showBreakoutMarker: settings.indicators.mrovShowBreakoutMarker,
      rr: settings.indicators.mrovRR,
      showTradeGrid: settings.indicators.mrovShowTradeGrid,
      riskColor: settings.indicators.mrovRiskColor,
      rewardColor: settings.indicators.mrovRewardColor,
      entryColor: settings.indicators.mrovEntryColor,
      zoneTransparency: settings.indicators.mrovZoneTransparency,
      showStatsTable: settings.indicators.mrovShowStatsTable,
    });
  }, [
    candles,
    timeframe,
    settings.indicators.deletedIndicators,
    settings.indicators.showMrovOpeningRange,
    settings.indicators.mrovRangeColor,
    settings.indicators.mrovFillTransparency,
    settings.indicators.mrovBorderWidth,
    settings.indicators.mrovLevelWidth,
    settings.indicators.mrovShowRangeCaption,
    settings.indicators.mrovLongColor,
    settings.indicators.mrovShortColor,
    settings.indicators.mrovHighlightBreakout,
    settings.indicators.mrovShowSignalLabels,
    settings.indicators.mrovShowBreakoutMarker,
    settings.indicators.mrovRR,
    settings.indicators.mrovShowTradeGrid,
    settings.indicators.mrovRiskColor,
    settings.indicators.mrovRewardColor,
    settings.indicators.mrovEntryColor,
    settings.indicators.mrovZoneTransparency,
    settings.indicators.mrovShowStatsTable,
  ]);

  // Compute EMA 50/100 + Candle Trend | Albert Setups (Pine Script v6 Exact Port)
  const ema50100Results: Ema50100Result | null = useMemo(() => {
    if (isIndicatorDeleted('ema_50_100') || !settings.indicators.showEma50100Trend || candles.length === 0) return null;
    return calculateEma50100CandleTrend(candles, {
      fastLength: settings.indicators.ema50100FastLength ?? 50,
      slowLength: settings.indicators.ema50100SlowLength ?? 100,
      showFastEma: settings.indicators.ema50100ShowFastEma ?? true,
      showSlowEma: settings.indicators.ema50100ShowSlowEma ?? true,
      fastLineWidth: settings.indicators.ema50100FastLineWidth ?? 2,
      slowLineWidth: settings.indicators.ema50100SlowLineWidth ?? 2,
      showSignals: settings.indicators.ema50100ShowSignals ?? true,
      colorCandles: settings.indicators.ema50100ColorCandles ?? true,
      showBackground: settings.indicators.ema50100ShowBackground ?? false,
      fastColor: settings.indicators.ema50100FastColor ?? '#00e676',
      slowColor: settings.indicators.ema50100SlowColor ?? '#ff9800',
    });
  }, [
    candles,
    settings.indicators.deletedIndicators,
    settings.indicators.showEma50100Trend,
    settings.indicators.ema50100FastLength,
    settings.indicators.ema50100SlowLength,
    settings.indicators.ema50100ShowFastEma,
    settings.indicators.ema50100ShowSlowEma,
    settings.indicators.ema50100FastLineWidth,
    settings.indicators.ema50100SlowLineWidth,
    settings.indicators.ema50100ShowSignals,
    settings.indicators.ema50100ColorCandles,
    settings.indicators.ema50100ShowBackground,
    settings.indicators.ema50100FastColor,
    settings.indicators.ema50100SlowColor,
  ]);

  // Master System State & Hooks (Strictly operates on Mpro2)
  const isMasterPro = true; // Fully unlocked for the user's trading setup
  const isMasterDashboardVisible = !isIndicatorDeleted('master') && (settings.indicators.showMasterDashboard ?? true);
  const [loggedTrades, setLoggedTrades] = useState<LoggedTrade[]>(() => getLoggedTrades());
  const [isTradeLoggerOpen, setIsTradeLoggerOpen] = useState<boolean>(false);
  const [isJournalOpen, setIsJournalOpen] = useState<boolean>(false);

  // Listen for remote device trade syncs (e.g. Phone takes/closes trade -> PC updates immediately)
  useEffect(() => {
    const handleRemoteTradeSync = () => {
      setLoggedTrades(getLoggedTrades());
    };
    window.addEventListener('mihiretu_trades_synced', handleRemoteTradeSync);
    return () => window.removeEventListener('mihiretu_trades_synced', handleRemoteTradeSync);
  }, []);

  // Sync open trades with live candles to auto-detect TP (+3R) or SL (-1R)
  useEffect(() => {
    if (candles.length > 0) {
      const { updatedCount, updatedTrades } = syncOpenTradesWithCandles(candles);
      if (updatedCount > 0) {
        setLoggedTrades(updatedTrades);
        window.dispatchEvent(new Event('mihiretu_trades_updated'));
      }
    }
  }, [candles]);

  // Compute Master Gatekeeper Analysis (Slope, 1:3 Room, Rejection, Mpro2 Midline, 5M/15M Micro-Trigger)
  // Master operates strictly and exclusively on Mpro2 (Mpro disabled)
  const masterContext: PreTradeContext | null = useMemo(() => {
    if (!isMasterDashboardVisible) return null;
    const liveClose = candles.length > 0 ? candles[candles.length - 1].close : undefined;
    return evaluateMasterSetup(
      candles,
      null, // Mpro is completely disabled for Master
      null, // Mpro levels disabled for Master
      mpro2Results,
      168,
      timeframe,
      liveClose
    );
  }, [
    candles,
    mpro2Results,
    timeframe,
    isMasterDashboardVisible,
  ]);

  // Refs for tracking broadcasted signals, timeframe, & stats timer
  const lastBroadcastedSignalRef = useRef<string | null>(null);
  const isBroadcastingActiveRef = useRef<boolean>(false);
  const lastTimeframeRef = useRef<string | null>(null);
  const lastSymbolRef = useRef<string | null>(null);
  const last24hReportTimeRef = useRef<number>(Date.now());

  // Clean symbol display name helper (e.g. BTC/USD, EUR/USD, XAU/USD)
  const formatSymbolDisplayName = (rawSymbol: string) => {
    if (!rawSymbol) return 'BTC/USD';
    let s = rawSymbol.toUpperCase().trim();
    // Strip prefixes like frx, cry, otc, deriv
    s = s.replace(/^(FRX|CRY|OTC|DERIV)_/i, '');
    s = s.replace(/^(FRX|CRY|OTC|DERIV)/i, '');
    if (s.includes('USD') && !s.includes('/')) {
      s = s.replace('USD', '/USD');
    } else if (s.includes('EUR') && !s.includes('/')) {
      s = s.replace('EUR', '/EUR');
    }
    return s || rawSymbol;
  };

  // Telegram Automated Signal Broadcasting Effect
  useEffect(() => {
    const isTgEnabled = settings.indicators.mssSendTelegramSignals ?? false;
    const isVerifiedDevice = localStorage.getItem('tg_signals_device_verified') === 'true';

    // Only authorized device/browser sends Telegram signals!
    if (!isTgEnabled || !isVerifiedDevice || !mssResults) return;

    const displayPair = formatSymbolDisplayName(symbolName);
    const activeTf = timeframe.toUpperCase();

    // 1. Send Activation Notice or Timeframe/Symbol Update Notice
    if (!isBroadcastingActiveRef.current) {
      isBroadcastingActiveRef.current = true;
      lastTimeframeRef.current = activeTf;
      lastSymbolRef.current = displayPair;

      // Seed lastBroadcastedSignalRef with existing latest trade so past historical signals are not sent
      if (mssResults.tradeSetups.length > 0) {
        const existingLatest = mssResults.tradeSetups[mssResults.tradeSetups.length - 1];
        lastBroadcastedSignalRef.current = `${activeTf}_${existingLatest.direction}_${existingLatest.entryBarIndex}_${existingLatest.entryPrice}_${existingLatest.tp1Price}_${existingLatest.slPrice}`;
      }

      const activationMsg = `🟢 <b>SMC SIGNALS ACTIVE & ANALYZING</b>\n\n` +
        `<b>Pair:</b> ${displayPair}\n` +
        `<b>Timeframe:</b> ${activeTf}\n` +
        `<b>Status:</b> Actively monitoring live market structure breakouts on ${activeTf}.\n` +
        `<b>ADR10 Targets:</b> TP1: ${settings.indicators.mssTp1Percent}% | TP2: ${settings.indicators.mssTp2Percent}% | SL: ${settings.indicators.mssSlPercent}%\n\n` +
        `<i>Signals for ${activeTf} will be automatically broadcasted as breakouts trigger.</i>`;

      fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_message', text: activationMsg }),
      }).catch(console.error);
    } else if (lastTimeframeRef.current !== activeTf || lastSymbolRef.current !== displayPair) {
      lastTimeframeRef.current = activeTf;
      lastSymbolRef.current = displayPair;

      // Seed lastBroadcastedSignalRef with existing latest trade of the new symbol/timeframe
      if (mssResults.tradeSetups.length > 0) {
        const existingLatest = mssResults.tradeSetups[mssResults.tradeSetups.length - 1];
        lastBroadcastedSignalRef.current = `${activeTf}_${existingLatest.direction}_${existingLatest.entryBarIndex}_${existingLatest.entryPrice}_${existingLatest.tp1Price}_${existingLatest.slPrice}`;
      }

      const stats = mssResults.stats;
      const updateMsg = `🔄 <b>CHART TIMEFRAME / PAIR UPDATED</b>\n\n` +
        `<b>Pair:</b> ${displayPair}\n` +
        `<b>New Timeframe:</b> ${activeTf}\n` +
        `<b>${activeTf} Win Rate (TP1):</b> ${stats.tp1WinRate.toFixed(1)}%\n` +
        `<b>${activeTf} Win Rate (TP2):</b> ${stats.tp2WinRate.toFixed(1)}%\n` +
        `<b>Total Signals on ${activeTf}:</b> ${stats.totalSignals}\n\n` +
        `<i>Now broadcasting live signals matching ${activeTf} chart analysis.</i>`;

      fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_message', text: updateMsg }),
      }).catch(console.error);
    }

    // 2. Check for NEW live trade setup signals on the active timeframe
    if (mssResults.tradeSetups.length > 0) {
      const latestTrade = mssResults.tradeSetups[mssResults.tradeSetups.length - 1];
      const signalKey = `${activeTf}_${latestTrade.direction}_${latestTrade.entryBarIndex}_${latestTrade.entryPrice}_${latestTrade.tp1Price}_${latestTrade.slPrice}`;

      if (lastBroadcastedSignalRef.current !== signalKey) {
        lastBroadcastedSignalRef.current = signalKey;

        const dirEmoji = latestTrade.direction === 'LONG' ? '🚀 <b>BUY SIGNAL</b>' : '🔻 <b>SELL SIGNAL</b>';
        const signalMsg = `${dirEmoji}\n\n` +
          `<b>Pair:</b> ${displayPair}\n` +
          `<b>Timeframe:</b> ${activeTf}\n` +
          `<b>Entry Price:</b> ${latestTrade.entryPrice.toFixed(4)}\n\n` +
          `🎯 <b>TP1 Target:</b> ${latestTrade.tp1Price.toFixed(4)}\n` +
          `🎯 <b>TP2 Target:</b> ${latestTrade.tp2Price.toFixed(4)}\n` +
          `🛑 <b>Stop Loss (SL):</b> ${latestTrade.slPrice.toFixed(4)}\n\n` +
          `<b>Risk Parameters:</b> TP1 (${settings.indicators.mssTp1Percent}%) | TP2 (${settings.indicators.mssTp2Percent}%) | SL (${settings.indicators.mssSlPercent}%)\n\n` +
          `<i>Smart Market Structure System | ProjectSyndicate</i>`;

        fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_message', text: signalMsg }),
        }).catch(console.error);
      }
    }

    // 3. Automated 24-Hour Win/Loss Statistics Report Timer for active timeframe
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (now - last24hReportTimeRef.current >= twentyFourHours) {
      last24hReportTimeRef.current = now;
      const stats = mssResults.stats;
      const reportMsg = `📊 <b>24-HOUR SMC SIGNALS PERFORMANCE REPORT</b>\n\n` +
        `<b>Pair:</b> ${displayPair}\n` +
        `<b>Timeframe:</b> ${activeTf}\n` +
        `<b>Total Signals (${activeTf}):</b> ${stats.totalSignals}\n` +
        `<b>Total Closed Trades:</b> ${stats.totalClosedTrades}\n` +
        `✅ <b>TP1 Wins:</b> ${stats.tp1Wins}\n` +
        `🎯 <b>TP2 Wins:</b> ${stats.tp2Wins}\n` +
        `❌ <b>SL Losses:</b> ${stats.slLosses}\n\n` +
        `🔥 <b>TP1 Win Rate (${activeTf}):</b> ${stats.tp1WinRate.toFixed(1)}%\n` +
        `🔥 <b>TP2 Win Rate (${activeTf}):</b> ${stats.tp2WinRate.toFixed(1)}%\n` +
        `⚡ <b>Overall Win Rate:</b> ${stats.overallWinRate.toFixed(1)}%\n\n` +
        `<i>24-Hour Automated Performance Summary</i>`;

      fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_message', text: reportMsg }),
      }).catch(console.error);
    }
  }, [
    mssResults,
    symbolName,
    timeframe,
    settings.indicators.mssSendTelegramSignals,
    settings.indicators.mssTp1Percent,
    settings.indicators.mssTp2Percent,
    settings.indicators.mssSlPercent,
  ]);

  const RIGHT_SCALE_WIDTH = 75;
  const BOTTOM_SCALE_HEIGHT = 28;

  const chartWidth = dimensions.width - RIGHT_SCALE_WIDTH;
  const chartHeight = dimensions.height - BOTTOM_SCALE_HEIGHT;

  // Track size changes on the container
  useEffect(() => {
    if (!containerRef.current) return;

    const initialRect = containerRef.current.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      setDimensions({
        width: Math.max(initialRect.width, 300),
        height: Math.max(initialRect.height, 200),
      });
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        requestAnimationFrame(() => {
          setDimensions((prev) => {
            const nextW = Math.max(width, 300);
            const nextH = Math.max(height, 200);
            if (Math.abs(prev.width - nextW) < 1 && Math.abs(prev.height - nextH) < 1) return prev;
            return { width: nextW, height: nextH };
          });
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Trade Planner Audit jump and focus handler
  const handleSelectTradePlannerTrade = useCallback((trade: RecentTradeAudit) => {
    setSelectedTradePlannerTradeId(trade.id);
    if (candles.length > 0 && trade.entryBar >= 0) {
      const paddingRight = 50;
      const targetScroll = (candles.length - 1 - trade.entryBar) * candleWidth + paddingRight - chartWidth / 2;
      setScrollOffset(Math.max(-200, targetScroll));
      setVerticalPanPixels(0);
    }
  }, [candles.length, candleWidth, chartWidth]);

  // Compute indices range of visible candles
  const visibleRange = useMemo(() => {
    if (candles.length === 0) return { start: 0, end: 0, minPrice: 0, maxPrice: 100 };

    const paddingRight = 50; // px padding on right before the latest candle
    // We render from right to left
    // x = chartWidth - paddingRight - (candles.length - 1 - i) * candleWidth + scrollOffset
    // We want to find i such that x is between 0 and chartWidth

    // Let's compute min & max index that fits inside chartWidth
    // For i:
    // x(i) = chartWidth - paddingRight + scrollOffset - (candles.length - 1 - i) * candleWidth
    // To be on screen:
    // 0 <= x(i) <= chartWidth
    
    let startIdx = 0;
    let endIdx = candles.length - 1;

    // We can iterate or do direct math
    const rightmostX = chartWidth - paddingRight + scrollOffset;
    
    // Find the index of the candle at the rightmost edge of screen
    const rightmostCandleFloat = (candles.length - 1) - (chartWidth - paddingRight + scrollOffset - chartWidth) / candleWidth;
    const leftmostCandleFloat = (candles.length - 1) - rightmostX / candleWidth;

    startIdx = Math.max(0, Math.floor(leftmostCandleFloat) - 2);
    endIdx = Math.min(candles.length - 1, Math.ceil(rightmostCandleFloat) + 2);

    // Filter visible candles to find min/max price for auto-scaling
    const visibleCandles = candles.slice(startIdx, endIdx + 1);
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    if (visibleCandles.length > 0) {
      visibleCandles.forEach((c) => {
        if (c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
      });
    } else {
      minPrice = 0;
      maxPrice = 100;
    }

    // Add 10% breathing space padding to top/bottom
    const priceDiff = maxPrice - minPrice || 1.0;
    minPrice -= priceDiff * 0.08;
    maxPrice += priceDiff * 0.08;

    const baseRange = maxPrice - minPrice;
    const scaledHalfRange = (baseRange / 2) * priceScaleRatio;
    const baseMid = (minPrice + maxPrice) / 2;

    // Convert vertical pan in pixels to price shift (TradingView 2D free vertical pan)
    // Positive verticalPanPixels (dragging down) shifts visible price range up so candles move down
    const pricePerPixel = (scaledHalfRange * 2) / Math.max(1, chartHeight);
    const midPrice = baseMid + (verticalPanPixels * pricePerPixel);

    return {
      start: startIdx,
      end: endIdx,
      minPrice: midPrice - scaledHalfRange,
      maxPrice: midPrice + scaledHalfRange,
    };
  }, [
    candles,
    candleWidth,
    scrollOffset,
    chartWidth,
    chartHeight,
    priceScaleRatio,
    verticalPanPixels,
  ]);

  // Automatically request older history from Deriv when scrolling near the earliest loaded candles
  const lastLoadMoreTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!onLoadMoreHistory || !hasMoreHistory || isLoadingMoreHistory) return;
    // When the user pans/scrolls backwards to within 120 candles of the earliest loaded data
    if (visibleRange.start <= 120 && candles.length >= 80) {
      const now = Date.now();
      if (now - lastLoadMoreTimeRef.current > 1200) {
        lastLoadMoreTimeRef.current = now;
        onLoadMoreHistory();
      }
    }
  }, [visibleRange.start, hasMoreHistory, isLoadingMoreHistory, onLoadMoreHistory, candles.length]);

  // Coordinates Mapping
  const getXFromIndex = (index: number) => {
    const paddingRight = 50;
    return chartWidth - paddingRight + scrollOffset - (candles.length - 1 - index) * candleWidth;
  };

  const getIndexFromX = (x: number) => {
    const paddingRight = 50;
    // x = chartWidth - paddingRight + scrollOffset - (candles.length - 1 - index) * candleWidth
    // (candles.length - 1 - index) * candleWidth = chartWidth - paddingRight + scrollOffset - x
    const candlesFromRight = (chartWidth - paddingRight + scrollOffset - x) / candleWidth;
    return Math.round(candles.length - 1 - candlesFromRight);
  };

  const getPriceFromY = (y: number) => {
    const { minPrice, maxPrice } = visibleRange;
    return maxPrice - (y / chartHeight) * (maxPrice - minPrice);
  };

  const getYFromPrice = (price: number) => {
    const { minPrice, maxPrice } = visibleRange;
    return ((maxPrice - price) / (maxPrice - minPrice)) * chartHeight;
  };

  // Convert (time, price) space to canvas pixel coordinates
  const getCanvasCoords = (point: DrawingPoint) => {
    // Find index of the closest candle with this timestamp
    let index = candles.findIndex((c) => c.time === point.time);
    if (index === -1) {
      // If candle timestamp is missing (e.g. gap or before/after range), interpolate index
      if (candles.length > 0) {
        if (point.time < candles[0].time) {
          // Extrapolate left
          const diffSec = candles[0].time - point.time;
          const avgCandleSec = candles.length > 1 ? (candles[1].time - candles[0].time) : 60;
          index = -Math.round(diffSec / avgCandleSec);
        } else {
          // Extrapolate right
          const diffSec = point.time - candles[candles.length - 1].time;
          const avgCandleSec = candles.length > 1 ? (candles[candles.length - 1].time - candles[candles.length - 2].time) : 60;
          index = candles.length - 1 + Math.round(diffSec / avgCandleSec);
        }
      } else {
        index = 0;
      }
    }
    return {
      x: getXFromIndex(index),
      y: getYFromPrice(point.price),
    };
  };

  // Convert canvas pixel coordinates to (time, price) space
  const getSpaceCoords = (x: number, y: number) => {
    const price = getPriceFromY(y);
    const index = getIndexFromX(x);
    let time = 0;

    if (candles.length > 0) {
      if (index >= 0 && index < candles.length) {
        time = candles[index].time;
      } else if (index < 0) {
        const diffIndex = -index;
        const avgCandleSec = candles.length > 1 ? (candles[1].time - candles[0].time) : 60;
        time = candles[0].time - diffIndex * avgCandleSec;
      } else {
        const diffIndex = index - (candles.length - 1);
        const avgCandleSec = candles.length > 1 ? (candles[candles.length - 1].time - candles[candles.length - 2].time) : 60;
        time = candles[candles.length - 1].time + diffIndex * avgCandleSec;
      }
    } else {
      time = Math.round(Date.now() / 1000);
    }

    return { time, price };
  };

  // Reset zoom and pan to fit latest data perfectly
  const resetZoomPan = () => {
    setCandleWidth(8);
    setScrollOffset(0);
    setPriceScaleRatio(1.0);
    setVerticalPanPixels(0);
  };

  // Trigger repaint on state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and set sizes
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const isDark = isDarkTheme(settings.theme);
    const themePreset = getThemePreset(settings.theme);
    const bg = settings.appearance.backgroundColor || themePreset.backgroundColor;
    const borderCol = themePreset.borderColor || (isDark ? '#2a2e39' : '#e0e3eb');
    const textCol = themePreset.textColor || (isDark ? '#d1d4dc' : '#131722');
    const gridColor = settings.appearance.gridColor || themePreset.gridColor;

    // Set canvas resolution for crisp lines
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Draw background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    if (candles.length === 0) {
      return;
    }

    // 1. Draw Grid Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;

    const { minPrice, maxPrice, start, end } = visibleRange;

    // Vertical grid lines (Time indices)
    const labelSpacing = Math.max(1, Math.floor(60 / candleWidth)); // Show labels dynamically based on zoom
    for (let i = start; i <= end; i++) {
      if (i % (labelSpacing * 5) === 0) {
        const x = getXFromIndex(i);
        if (x >= 0 && x <= chartWidth && settings.appearance.gridType !== 'horizontal' && settings.appearance.gridType !== 'none') {
          ctx.beginPath();
          if (settings.appearance.gridStyle === 'dashed') {
            ctx.setLineDash([4, 4]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.moveTo(x, 0);
          ctx.lineTo(x, chartHeight);
          ctx.stroke();
        }
      }
    }

    // Horizontal grid lines (Price levels)
    const priceRange = maxPrice - minPrice;
    const priceStep = getNicePriceStep(priceRange);
    const startPrice = Math.ceil(minPrice / priceStep) * priceStep;

    ctx.setLineDash(settings.appearance.gridStyle === 'dashed' ? [4, 4] : []);
    for (let p = startPrice; p <= maxPrice; p += priceStep) {
      const y = getYFromPrice(p);
      if (y >= 0 && y <= chartHeight && settings.appearance.gridType !== 'vertical' && settings.appearance.gridType !== 'none') {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]); // Reset dash

    // Helper: format clean display name for watermark (e.g., Jump 10, Volatility 75, not jd10)
    const getCleanWatermarkName = (sym: string): string => {
      const trimmed = (sym || '').trim();
      const upper = trimmed.toUpperCase();
      
      // Jump Indices (Jump 10, Jump 25, Jump 50, Jump 75, Jump 100)
      if (upper.includes('JUMP 10') || upper === 'JD10') return 'Jump 10';
      if (upper.includes('JUMP 25') || upper === 'JD25') return 'Jump 25';
      if (upper.includes('JUMP 50') || upper === 'JD50') return 'Jump 50';
      if (upper.includes('JUMP 75') || upper === 'JD75') return 'Jump 75';
      if (upper.includes('JUMP 100') || upper === 'JD100') return 'Jump 100';
      if (upper.startsWith('JD')) {
        return `Jump ${upper.replace(/^JD/, '')}`;
      }
      if (upper.startsWith('JUMP')) {
        const num = upper.replace(/^JUMP_?/, '').replace(/\s*INDEX$/, '');
        return `Jump ${num.trim()}`;
      }
      if (upper.startsWith('R_')) {
        return `Volatility ${upper.replace(/^R_/, '')}`;
      }
      if (upper.startsWith('1HZ')) {
        return `Volatility ${upper.replace(/^1HZ/, '').replace(/V$/, '')} (1s)`;
      }
      if (upper.startsWith('BOOM')) {
        return `Boom ${upper.replace(/^BOOM/, '').replace(/\s*INDEX$/, '')}`;
      }
      if (upper.startsWith('CRASH')) {
        return `Crash ${upper.replace(/^CRASH/, '').replace(/\s*INDEX$/, '')}`;
      }
      if (upper.startsWith('STPRNG') || upper.includes('STEP')) {
        const num = upper.replace(/^STPRNG_?/, '').replace(/[^0-9]/g, '');
        return `Step Index ${num || '100'}`;
      }
      if (upper.includes('XAU') || upper.includes('GOLD')) {
        return 'GOLD (XAU/USD)';
      }
      if (upper.startsWith('FRX')) {
        const raw = upper.replace(/^FRX/, '');
        if (raw.length === 6) return `${raw.slice(0, 3)}/${raw.slice(3)}`;
        return raw;
      }
      if (upper.startsWith('CRY')) {
        const raw = upper.replace(/^CRY/, '');
        if (raw.length === 6) return `${raw.slice(0, 3)}/${raw.slice(3)}`;
        return raw;
      }
      return trimmed.replace(/\s*Index$/i, '');
    };

    const cleanWatermarkName = getCleanWatermarkName(symbolName);

    // 1.5. Draw Massive Background Pair Symbol Watermark (TradingView / cTrader Pro style)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Target width for massive pair symbol: occupies up to 72% of screen width
    const maxTargetWidth = Math.max(300, chartWidth * 0.72);
    // Base font size scaled to viewport height & width (between 85px and 190px)
    let symbolFontSize = Math.min(190, Math.max(85, Math.floor(Math.min(chartHeight * 0.32, chartWidth * 0.18))));

    ctx.font = `900 ${symbolFontSize}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let measuredW = ctx.measureText(cleanWatermarkName).width;

    if (measuredW > maxTargetWidth && measuredW > 0) {
      symbolFontSize = Math.max(52, Math.floor(symbolFontSize * (maxTargetWidth / measuredW)));
      ctx.font = `900 ${symbolFontSize}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }

    const centerY = chartHeight / 2;
    const tfFontSize = Math.max(26, Math.min(52, Math.floor(symbolFontSize * 0.34)));

    // Big Background Pair Symbol (e.g. Jump 10, GOLD, etc.)
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.085)' : 'rgba(0, 0, 0, 0.075)';
    ctx.fillText(cleanWatermarkName, chartWidth / 2, centerY - (tfFontSize * 0.45));

    // Timeframe underneath
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(0, 0, 0, 0.045)';
    ctx.font = `bold ${tfFontSize}px "Inter", monospace`;
    ctx.fillText(timeframe, chartWidth / 2, centerY + (symbolFontSize * 0.42));
    ctx.restore();

    // 1B. Draw Risk/Reward Tool Authentic Shading & Glow Behind Candlesticks
    // (TradingView Architecture: Visible shaded zones sit as background behind candles so candles & wicks stay 100% visible)
    (drawings || []).forEach((drawing) => {
      if (!drawing || drawing.type !== 'risk_reward' || !drawing.riskReward || !drawing.points || drawing.points.length < 1) return;
      const config = drawing.riskReward;
      const isSelected = drawing.id === selectedDrawingId;
      const entryY = getYFromPrice(config.entryPrice);
      const targetY = getYFromPrice(config.targetPrice);
      const stopY = getYFromPrice(config.stopPrice);

      const targetColor = config.targetColor || '#089981';
      const stopColor = config.stopColor || '#f23645';
      const baseOpacity = config.fillOpacity !== undefined ? config.fillOpacity : 0.38;

      const leftX = getCanvasCoords(drawing.points[0]).x;
      let rightX = drawing.points[1] ? getCanvasCoords(drawing.points[1]).x : leftX + 220;
      if (rightX < leftX + 40) rightX = leftX + 40;
      const boxWidth = rightX - leftX;

      const targetTop = Math.min(entryY, targetY);
      const targetHeight = Math.max(1, Math.abs(entryY - targetY));
      const stopTop = Math.min(entryY, stopY);
      const stopHeight = Math.max(1, Math.abs(entryY - stopY));

      const topYBoundary = Math.min(targetY, stopY);
      const botYBoundary = Math.max(targetY, stopY);
      const totalHeight = Math.abs(botYBoundary - topYBoundary);

      // Price touch detection: checks if current price or live candle touches/enters the zones
      const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
      const currentPrice = latestCandle ? latestCandle.close : config.entryPrice;
      const latestHigh = latestCandle ? latestCandle.high : currentPrice;
      const latestLow = latestCandle ? latestCandle.low : currentPrice;

      const isLong = config.targetPrice >= config.entryPrice;
      const targetMin = Math.min(config.entryPrice, config.targetPrice);
      const targetMax = Math.max(config.entryPrice, config.targetPrice);
      const stopMin = Math.min(config.entryPrice, config.stopPrice);
      const stopMax = Math.max(config.entryPrice, config.stopPrice);

      // Active touch: price touches or is within target or stop zone
      const isTargetTouched = (latestHigh >= targetMin && latestLow <= targetMax) ||
        (isLong ? currentPrice >= config.entryPrice : currentPrice <= config.entryPrice);

      const isStopTouched = (latestHigh >= stopMin && latestLow <= stopMax) ||
        (isLong ? currentPrice <= config.entryPrice : currentPrice >= config.entryPrice);

      // A. Ambient soft drop shadow (TradingView backdrop depth)
      ctx.save();
      if (isSelected) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(leftX, topYBoundary, boxWidth, totalHeight);
      }
      ctx.restore();

      // B. Authentic Visible Shading with TradingView Custom Color Support:
      // "price በነካ ቁጥር ይደምቃል፥ ካልነካም በትንሹ ይደምቃል"
      // 1. Target (Profit) Shaded Zone
      ctx.save();
      if (isTargetTouched) {
        // Price touches target: Vivid, luminous highlighted glow
        const targetGrad = ctx.createLinearGradient(leftX, targetTop, leftX, targetTop + targetHeight);
        const topAlpha = Math.min(0.85, baseOpacity + 0.20);
        const botAlpha = Math.min(0.75, baseOpacity + 0.08);
        if (isLong) {
          targetGrad.addColorStop(0, hexToRgba(targetColor, topAlpha));
          targetGrad.addColorStop(1, hexToRgba(targetColor, botAlpha));
        } else {
          targetGrad.addColorStop(0, hexToRgba(targetColor, botAlpha));
          targetGrad.addColorStop(1, hexToRgba(targetColor, topAlpha));
        }
        ctx.fillStyle = targetGrad;
        ctx.fillRect(leftX, targetTop, boxWidth, targetHeight);

        // Luminous highlight accent on touch
        ctx.fillStyle = hexToRgba(targetColor, 0.32);
        ctx.fillRect(leftX, targetTop, boxWidth, Math.min(6, targetHeight));
      } else {
        // Price hasn't touched: Deep, rich, authentic TradingView solid shade with custom color
        const alpha = isSelected ? Math.min(0.65, baseOpacity + 0.06) : baseOpacity;
        ctx.fillStyle = hexToRgba(targetColor, alpha);
        ctx.fillRect(leftX, targetTop, boxWidth, targetHeight);
      }
      ctx.restore();

      // 2. Stop (Loss) Shaded Zone
      ctx.save();
      if (isStopTouched) {
        // Price touches stop: Vivid, luminous highlighted glow
        const stopGrad = ctx.createLinearGradient(leftX, stopTop, leftX, stopTop + stopHeight);
        const baseAlpha = Math.min(0.75, baseOpacity + 0.08);
        const radAlpha = Math.min(0.85, baseOpacity + 0.20);
        if (isLong) {
          stopGrad.addColorStop(0, hexToRgba(stopColor, baseAlpha));
          stopGrad.addColorStop(1, hexToRgba(stopColor, radAlpha));
        } else {
          stopGrad.addColorStop(0, hexToRgba(stopColor, radAlpha));
          stopGrad.addColorStop(1, hexToRgba(stopColor, baseAlpha));
        }
        ctx.fillStyle = stopGrad;
        ctx.fillRect(leftX, stopTop, boxWidth, stopHeight);

        // Luminous highlight accent on touch
        ctx.fillStyle = hexToRgba(stopColor, 0.32);
        ctx.fillRect(leftX, isLong ? (stopTop + stopHeight - 6) : stopTop, boxWidth, Math.min(6, stopHeight));
      } else {
        // Price hasn't touched: Deep, rich, authentic TradingView solid shade with custom color
        const alpha = isSelected ? Math.min(0.65, baseOpacity + 0.06) : baseOpacity;
        ctx.fillStyle = hexToRgba(stopColor, alpha);
        ctx.fillRect(leftX, stopTop, boxWidth, stopHeight);
      }
      ctx.restore();
    });

    // 2. Draw Candlesticks
    const drawUpArrow = (ax: number, ay: number, size = 6) => {
      ctx.fillStyle = '#10b981'; // Vivid Green
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - size, ay + size);
      ctx.lineTo(ax - size / 2, ay + size);
      ctx.lineTo(ax - size / 2, ay + size * 2);
      ctx.lineTo(ax + size / 2, ay + size * 2);
      ctx.lineTo(ax + size / 2, ay + size);
      ctx.lineTo(ax + size, ay + size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    const drawDownArrow = (ax: number, ay: number, size = 6) => {
      ctx.fillStyle = '#ef4444'; // Vivid Red
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - size, ay - size);
      ctx.lineTo(ax - size / 2, ay - size);
      ctx.lineTo(ax - size / 2, ay - size * 2);
      ctx.lineTo(ax + size / 2, ay - size * 2);
      ctx.lineTo(ax + size / 2, ay - size);
      ctx.lineTo(ax + size, ay - size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // ==========================================
    // Render Session Filter (Asian, London, New York Intraday Sessions)
    // Completely noise-free, off-light dotted/dashed/solid vertical separators
    // ==========================================
    if ((settings.indicators.showSessionFilter ?? true) && sessionFilterIntervals.length > 0) {
      ctx.save();
      const sLineStyle = settings.indicators.sessionFilterLineStyle ?? 'dotted';
      const sLineWidth = settings.indicators.sessionFilterLineWidth ?? 1;
      const sLineOpacity = Math.max(0.1, Math.min(1, (settings.indicators.sessionFilterLineOpacity ?? 35) / 100));
      const sShowStart = settings.indicators.sessionFilterShowStartLine ?? true;
      const sShowEnd = settings.indicators.sessionFilterShowEndLine ?? true;
      const sShowLabels = settings.indicators.sessionFilterShowLabels ?? true;
      const sLabelFontSize = (settings.indicators.sessionFilterLabelSize ?? 'tiny') === 'tiny' ? 9 : 11;
      const sFillBg = settings.indicators.sessionFilterFillBackground ?? false;
      const sFillOpacity = Math.max(0.01, Math.min(0.2, (settings.indicators.sessionFilterFillOpacity ?? 3) / 100));

      sessionFilterIntervals.forEach((sess) => {
        const startX = getXFromIndex(sess.startIndex);
        const endX = sess.endIndex !== null ? getXFromIndex(sess.endIndex) : null;

        // Skip if outside horizontal viewport
        if (sess.endIndex !== null && sess.endIndex < start && endX !== null && endX < -50) return;
        if (sess.startIndex > end && startX > chartWidth + 50) return;

        const strokeColor = hexToRgba(sess.color, sLineOpacity);
        const textColor = sess.color;

        // 1. Optional faint background shading (default off for zero noise)
        if (sFillBg && endX !== null) {
          const bgCol = hexToRgba(sess.color, sFillOpacity);
          const xLeft = Math.max(0, startX);
          const xRight = Math.min(chartWidth, endX);
          if (xRight > xLeft) {
            ctx.fillStyle = bgCol;
            ctx.fillRect(xLeft, 0, xRight - xLeft, chartHeight);
          }
        }

        // Configure line style (dotted, dashed, solid)
        if (sLineStyle === 'dotted') {
          ctx.setLineDash([2, 3]);
        } else if (sLineStyle === 'dashed') {
          ctx.setLineDash([6, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = sLineWidth;

        // 2. Start Vertical Line
        if (sShowStart && startX >= -10 && startX <= chartWidth + 10) {
          ctx.beginPath();
          ctx.moveTo(startX, 24);
          ctx.lineTo(startX, chartHeight);
          ctx.stroke();
        }

        // 3. End Vertical Line (Only drawn for past completed sessions; omitted for active session)
        if (sess.endIndex !== null && endX !== null && sShowEnd && endX >= -10 && endX <= chartWidth + 10) {
          ctx.beginPath();
          ctx.moveTo(endX, 24);
          ctx.lineTo(endX, chartHeight);
          ctx.stroke();
        }

        // Reset dash for labels
        ctx.setLineDash([]);

        // 4. Clean, noise-free top label
        if (sShowLabels) {
          let labelText = sess.shortName;
          if (sess.isActive) {
            labelText = `● ${sess.shortName} (ACTIVE)`;
          }

          ctx.font = `600 ${sLabelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const textMetrics = ctx.measureText(labelText);
          const padX = 5;
          const pillH = sLabelFontSize + 6;
          const pillW = textMetrics.width + padX * 2;

          let pillX = startX + 3;
          if (pillX < 4) {
            if (endX !== null && endX > 20) {
              pillX = Math.min(chartWidth - pillW - 4, 8);
            } else if (sess.isActive) {
              pillX = 8;
            }
          }
          pillX = Math.min(chartWidth - pillW - 4, pillX);

          if (pillX >= 0 && pillX + pillW <= chartWidth + 20) {
            const pillY = 6;
            ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(248, 250, 252, 0.92)';
            ctx.strokeStyle = hexToRgba(sess.color, Math.min(0.5, sLineOpacity * 1.4));
            ctx.lineWidth = 1;

            if (typeof ctx.roundRect === 'function') {
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillW, pillH, 3);
              ctx.fill();
              ctx.stroke();
            } else {
              ctx.fillRect(pillX, pillY, pillW, pillH);
              ctx.strokeRect(pillX, pillY, pillW, pillH);
            }

            ctx.fillStyle = textColor;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(labelText, pillX + padX, pillY + pillH / 2);
          }
        }
      });

      ctx.restore();
    }

    candles.forEach((c, idx) => {
      if (idx < start - 2 || idx > end + 2) return; // Skip off-screen candles

      const x = getXFromIndex(idx);
      const openY = getYFromPrice(c.open);
      const closeY = getYFromPrice(c.close);
      const highY = getYFromPrice(c.high);
      const lowY = getYFromPrice(c.low);

      const isBullish = c.close >= c.open;
      let bodyColor = isBullish ? settings.candle.upColor : settings.candle.downColor;
      let borderColor = isBullish ? settings.candle.borderUpColor : settings.candle.borderDownColor;
      let wickColor = isBullish ? settings.candle.wickUpColor : settings.candle.wickDownColor;

      // EMA 50/100 + Candle Trend: Background Coloring (Pine Script v6 bgcolor)
      if (
        (settings.indicators.showEma50100Trend ?? false) &&
        (settings.indicators.ema50100ShowBackground ?? false) &&
        ema50100Results
      ) {
        if (ema50100Results.bullTrend[idx]) {
          ctx.save();
          ctx.fillStyle = 'rgba(0, 200, 83, 0.10)';
          ctx.fillRect(x - candleWidth / 2, 0, candleWidth, chartHeight);
          ctx.restore();
        } else if (ema50100Results.bearTrend[idx]) {
          ctx.save();
          ctx.fillStyle = 'rgba(244, 67, 54, 0.10)';
          ctx.fillRect(x - candleWidth / 2, 0, candleWidth, chartHeight);
          ctx.restore();
        }
      }

      // GTA State Override (if candle coloring toggle ON)
      if (settings.indicators.showGTA && (settings.indicators.gtaColorCandles ?? true) && gtaResults && gtaResults[idx]) {
        const gta = gtaResults[idx];
        if (gta.colorState === 0) {
          bodyColor = '#10b981'; // Green
          borderColor = '#047857';
          wickColor = '#047857';
        } else if (gta.colorState === 1) {
          bodyColor = '#ef4444'; // Red
          borderColor = '#b91c1c';
          wickColor = '#b91c1c';
        } else if (gta.colorState === 2) {
          const neutralCol = isDark ? '#64748b' : '#94a3b8'; // Slate Grey accent
          bodyColor = neutralCol;
          borderColor = isDark ? '#475569' : '#cbd5e1';
          wickColor = isDark ? '#475569' : '#cbd5e1';
        }
      }

      // Nexus Smart Money Suite Candle Coloring (if enabled)
      if (
        (settings.indicators.showNexusSuite ?? true) &&
        (settings.indicators.nexusColorCandles ?? true) &&
        nexusResults &&
        nexusResults.candleColors &&
        nexusResults.candleColors[idx]
      ) {
        const nCol = nexusResults.candleColors[idx].color;
        bodyColor = nCol;
        borderColor = nCol;
        wickColor = nCol;
      }

      // LunqFX Trade Planner Candle Palette (Neon Bloom, Midnight Cyan, Vibrant Neon, etc.)
      if (
        (settings.indicators.showTradePlanner ?? true) &&
        tradePlannerResults &&
        tradePlannerResults.candleColors.applied
      ) {
        const isBull = c.close >= c.open;
        const tpCol = isBull ? tradePlannerResults.candleColors.bull : tradePlannerResults.candleColors.bear;
        wickColor = tpCol;
      }

      // Mrov Trade: Opening Range Breakout Candle Highlight (Pine Script v6)
      if (
        (settings.indicators.showMrovOpeningRange ?? false) &&
        (settings.indicators.mrovHighlightBreakout ?? true) &&
        mrovTradeResults &&
        mrovTradeResults.breakoutCandleIndices.has(idx)
      ) {
        const bo = mrovTradeResults.breakoutCandleIndices.get(idx)!;
        bodyColor = bo.color;
        borderColor = bo.color;
        wickColor = bo.color;
      }

      // EMA 50/100 + Candle Trend: Candle Coloring (Pine Script v6 barcolor)
      if (
        (settings.indicators.showEma50100Trend ?? false) &&
        (settings.indicators.ema50100ColorCandles ?? true) &&
        ema50100Results &&
        ema50100Results.candleColors[idx]
      ) {
        const col = ema50100Results.candleColors[idx];
        bodyColor = col;
        borderColor = col;
        wickColor = col;
      }

      // White candle visibility protection:
      // When on Light or Off-Light theme, or if the background is light/white,
      // candles with white bodies or borders must remain clearly visible.
      // Auto-apply crisp dark slate borders and wicks so white candles stand out like classic Japanese hollow candles.
      if (!isDark || isLightColor(bg)) {
        if (isLightColor(bodyColor)) {
          if (isLightColor(borderColor) || borderColor === bodyColor || borderColor.toLowerCase() === bg.toLowerCase()) {
            borderColor = '#334155'; // Dark slate border for pristine definition
          }
          if (isLightColor(wickColor) || wickColor === bodyColor || wickColor.toLowerCase() === bg.toLowerCase()) {
            wickColor = '#334155'; // Dark slate wick
          }
        }
      }

      // Draw Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw Candle Body
      const bodyWidth = Math.max(1, candleWidth - 2);
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;

      const rectY = Math.min(openY, closeY);
      const rectHeight = Math.max(1, Math.abs(openY - closeY));

      ctx.fillRect(x - bodyWidth / 2, rectY, bodyWidth, rectHeight);
      ctx.strokeRect(x - bodyWidth / 2, rectY, bodyWidth, rectHeight);

      // Draw Signal Arrows (if enabled in GTA settings)
      if (settings.indicators.showGTA && (settings.indicators.gtaShowArrows ?? true) && gtaResults && gtaResults[idx]) {
        const gta = gtaResults[idx];
        if (gta.buyArrow !== null) {
          drawUpArrow(x, getYFromPrice(gta.buyArrow), 6);
        }
        if (gta.sellArrow !== null) {
          drawDownArrow(x, getYFromPrice(gta.sellArrow), 6);
        }
      }
    });

    // 3. Render Technical Indicator (Moving Average Placeholder)
    if (!isIndicatorDeleted('ma') && settings.indicators.showMA) {
      const period = settings.indicators.maPeriod;
      ctx.strokeStyle = '#2962ff'; // Custom blue color for MA
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;

      for (let i = start; i <= end; i++) {
        if (i < period - 1) continue;
        
        // Simple Moving Average
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += candles[i - j].close;
        }
        const maVal = sum / period;
        const x = getXFromIndex(i);
        const y = getYFromPrice(maVal);

        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Render GTA EMAs (if enabled and toggled ON)
    if (settings.indicators.showGTA && settings.indicators.showGTAEMAs && gtaResults && gtaResults.length > 0) {
      const drawEMALine = (key: 'emaShort' | 'emaMid' | 'emaLong', color: string, width = 1.25) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        let first = true;
        
        for (let i = start; i <= end; i++) {
          if (i < 0 || i >= gtaResults.length) continue;
          const val = gtaResults[i][key];
          if (isNaN(val)) continue;
          
          const x = getXFromIndex(i);
          const y = getYFromPrice(val);
          
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      };

      drawEMALine('emaLong', '#f59e0b', 1.5); // Warm Gold/Amber for Anchor Line
      drawEMALine('emaMid', '#a855f7', 1.25); // Purple for Baseline
      drawEMALine('emaShort', '#06b6d4', 1.25); // Vibrant Cyan for Velocity Line
    }

    // ==========================================
    // Render Auto Price Channels (4H Breakout & Trend Indicator)
    // STRICT TIMEFRAME ENFORCEMENT: ONLY executes & displays on 4H
    // ==========================================
    if ((settings.indicators.showAutoPriceChannels ?? true) && timeframe === '4H' && priceChannelsResults) {
      const lineColor = settings.indicators.autoPriceChannelsColor ?? '#38bdf8';
      const lineWidth = settings.indicators.autoPriceChannelsLineWidth ?? 2;
      const showBreakouts = settings.indicators.autoPriceChannelsShowBreakouts ?? true;
      const doFill = settings.indicators.autoPriceChannelsFill ?? true;

      ctx.save();
      ctx.lineWidth = lineWidth;

      priceChannelsResults.channels.forEach((ch) => {
        // Skip channels outside visible window
        if (ch.endIndex < start || ch.startIndex > end) return;

        const x1 = getXFromIndex(ch.startIndex);
        const x2 = getXFromIndex(ch.endIndex);

        const y1_upper = getYFromPrice(ch.upperStartPrice);
        const y2_upper = getYFromPrice(ch.upperEndPrice);

        const y1_lower = getYFromPrice(ch.lowerStartPrice);
        const y2_lower = getYFromPrice(ch.lowerEndPrice);

        // 1. Optional translucent channel shading between upper and lower lines
        if (doFill) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
          ctx.beginPath();
          ctx.moveTo(x1, y1_upper);
          ctx.lineTo(x2, y2_upper);
          ctx.lineTo(x2, y2_lower);
          ctx.lineTo(x1, y1_lower);
          ctx.closePath();
          ctx.fill();
        }

        // 2. Draw Upper Resistance Trendline
        ctx.strokeStyle = lineColor;
        ctx.beginPath();
        ctx.moveTo(x1, y1_upper);
        ctx.lineTo(x2, y2_upper);
        ctx.stroke();

        // 3. Draw Lower Support Trendline
        ctx.beginPath();
        ctx.moveTo(x1, y1_lower);
        ctx.lineTo(x2, y2_lower);
        ctx.stroke();

        // 3b. Optional Trend Angle/Slope Label on Channel Center
        const midX = (x1 + x2) / 2;
        const midY = (y1_upper + y2_lower) / 2;
        if (midX >= 0 && midX <= chartWidth) {
          ctx.font = 'bold 10px "Inter", sans-serif';
          ctx.fillStyle = ch.trend === 'UP' ? '#38bdf8' : '#38bdf8';
          ctx.textAlign = 'center';
          const dirArrow = ch.trend === 'UP' ? '↗ 4H Uptrend' : ch.trend === 'DOWN' ? '↘ 4H Downtrend' : '↔ 4H Range';
          const slopeText = ch.slopePercentage ? ` (${ch.slopePercentage.toFixed(1)}%)` : '';
          ctx.fillText(`${dirArrow}${slopeText}`, midX, midY);
        }

        // 4. Breakout Marker (if breakout occurred)
        if (showBreakouts && ch.hasBreakout && ch.breakoutIndex !== null && ch.breakoutPrice !== null) {
          const bx = getXFromIndex(ch.breakoutIndex);
          const by = getYFromPrice(ch.breakoutPrice);

          if (bx >= 0 && bx <= chartWidth) {
            const isBull = ch.breakoutType === 'BULLISH';
            ctx.fillStyle = isBull ? '#10b981' : '#ef4444';
            ctx.beginPath();
            ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label text
            ctx.font = 'bold 9px "Inter", sans-serif';
            ctx.fillStyle = isBull ? '#34d399' : '#f87171';
            ctx.textAlign = 'center';
            const labelY = isBull ? by - 12 : by + 16;
            ctx.fillText(isBull ? 'Breakout ↑' : 'Breakout ↓', bx, labelY);
          }
        }
      });

      ctx.restore();
    }

    // ==========================================
    // Render Auto Supply & Demand Order Blocks + Parallel Trend Channel Indicator
    // ==========================================
    if ((settings.indicators.showAutoSupplyDemandChannel ?? true) && autoSdcResults) {
      const mainColor = settings.indicators.autoSdcColor ?? '#0ea5e9';
      const showZones = settings.indicators.autoSdcShowSupplyDemand ?? true;
      const showChannel = settings.indicators.autoSdcShowChannel ?? true;
      const showFVG = settings.indicators.autoSdcShowFVGProjections ?? true;

      ctx.save();

      // 1. Render Parallel Trend Channel
      if (showChannel && autoSdcResults.channel) {
        const ch = autoSdcResults.channel;
        const futureIndex = ch.endIndex + (ch.futureBarCount || 30);

        // Skip if channel is completely outside visible chart range
        if (futureIndex < start || ch.startIndex > end + 100) {
          // outside visible bounds
        } else {
          // Strictly anchor coordinates to candle index to maintain 100% precision when panning/zooming
          const x1 = getXFromIndex(ch.startIndex);
          const x2 = getXFromIndex(futureIndex);

          const y1_upper = getYFromPrice(ch.upperStartPrice);
          const y2_upper = getYFromPrice(ch.upperFuturePrice ?? ch.upperEndPrice);
          const y1_lower = getYFromPrice(ch.lowerStartPrice);
          const y2_lower = getYFromPrice(ch.lowerFuturePrice ?? ch.lowerEndPrice);

          // Fill area between channel boundaries
          ctx.fillStyle = hexToRgba(mainColor, 0.08);
          ctx.beginPath();
          ctx.moveTo(x1, y1_upper);
          ctx.lineTo(x2, y2_upper);
          ctx.lineTo(x2, y2_lower);
          ctx.lineTo(x1, y1_lower);
          ctx.closePath();
          ctx.fill();

          // Upper Boundary
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x1, y1_upper);
          ctx.lineTo(x2, y2_upper);
          ctx.stroke();

          // Lower Boundary
          ctx.beginPath();
          ctx.moveTo(x1, y1_lower);
          ctx.lineTo(x2, y2_lower);
          ctx.stroke();

          // Dashed Center Median Line
          const y1_mid = (y1_upper + y1_lower) / 2;
          const y2_mid = (y2_upper + y2_lower) / 2;
          ctx.strokeStyle = hexToRgba(mainColor, 0.45);
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x1, y1_mid);
          ctx.lineTo(x2, y2_mid);
          ctx.stroke();

          // Channel Tag Badge anchored near visible section
          const visibleX = Math.min(chartWidth - 80, Math.max(30, (x1 + x2) / 2));
          const visibleProgress = Math.min(1, Math.max(0, (visibleX - x1) / (x2 - x1 || 1)));
          const tagY = (y1_upper + visibleProgress * (y2_upper - y1_upper)) - 10;

          ctx.setLineDash([]);
          ctx.font = 'bold 9px "Inter", sans-serif';
          ctx.fillStyle = mainColor;
          ctx.textAlign = 'center';
          ctx.fillText('PARALLEL CHANNEL (LIVE)', visibleX, tagY);
        }
      }

      // 2. Render Supply & Demand Order Block Bands (Solid Cyan/Blue Shaded Horizontal Bands)
      if (showZones) {
        const renderZone = (z: SupplyDemandZone, isSupply: boolean) => {
          const xStart = getXFromIndex(z.startBarIndex);
          const xEnd = z.endBarIndex !== null ? getXFromIndex(z.endBarIndex) : chartWidth + 20;

          // Skip if completely off-screen
          if (xEnd < -20 || xStart > chartWidth + 20) return;

          const yTop = getYFromPrice(z.topPrice);
          const yBottom = getYFromPrice(z.bottomPrice);
          const renderXStart = Math.max(-50, xStart);
          const renderXEnd = Math.min(chartWidth + 50, xEnd);
          const w = Math.max(4, renderXEnd - renderXStart);
          const h = Math.max(4, yBottom - yTop);

          const isUnmitigated = !z.isMitigated;
          const fillAlpha = isUnmitigated ? 0.22 : 0.08;
          const strokeAlpha = isUnmitigated ? 0.85 : 0.35;

          ctx.fillStyle = hexToRgba(mainColor, fillAlpha);
          ctx.strokeStyle = hexToRgba(mainColor, strokeAlpha);
          ctx.lineWidth = isUnmitigated ? 1.5 : 1;

          if (!isUnmitigated) ctx.setLineDash([3, 3]);
          else ctx.setLineDash([]);

          ctx.fillRect(renderXStart, yTop, w, h);
          ctx.strokeRect(renderXStart, yTop, w, h);

          // Label Badge
          if (isUnmitigated || (renderXEnd - renderXStart > 45)) {
            ctx.fillStyle = mainColor;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';
            const tag = isSupply ? 'SUPPLY' : 'DEMAND';
            const statusTag = isUnmitigated ? 'LIVE' : 'FILLED';
            const priceVal = isSupply ? z.topPrice : z.bottomPrice;
            ctx.fillText(`${tag} (${priceVal.toFixed(2)}) [${statusTag}]`, Math.max(renderXStart + 6, 10), isSupply ? yTop + 11 : yBottom - 5);
          }
        };

        autoSdcResults.supplyZones.forEach((z) => renderZone(z, true));
        autoSdcResults.demandZones.forEach((z) => renderZone(z, false));
      }

      // 3. Render Right-Side Projection Blocks / Fair Value Gaps (Small Blocks with distinct Buy/Sell 2-Color styling)
      if (showFVG && autoSdcResults.fvgProjections.length > 0) {
        const buyColor = settings.indicators.autoSdcFvgBuyColor || '#10b981'; // Green for Bullish / Buy FVG
        const sellColor = settings.indicators.autoSdcFvgSellColor || '#f43f5e'; // Red for Bearish / Sell FVG

        autoSdcResults.fvgProjections.forEach((fvg) => {
          const isVeryStrong = fvg.isVeryStrong ?? false;
          const isBull = fvg.isBullish;
          const fvgColor = isBull ? buyColor : sellColor;
          
          // Display strictly as a small, compact block at the exact candle formation window
          const startBar = Math.max(0, fvg.startIndex - 2);
          const endBar = Math.min(candles.length - 1, fvg.startIndex);
          const xStart = getXFromIndex(startBar) - (candleWidth * 0.4);
          const xEnd = getXFromIndex(endBar) + (candleWidth * 0.4);

          // Skip if completely off-screen
          if (xEnd < -20 || xStart > chartWidth + 20) return;

          const yTop = getYFromPrice(fvg.topPrice);
          const yBottom = getYFromPrice(fvg.bottomPrice);
          const renderXStart = Math.max(-50, xStart);
          const renderXEnd = Math.min(chartWidth + 50, xEnd);
          const w = Math.max(4, renderXEnd - renderXStart);
          const h = Math.max(3, yBottom - yTop);

          const isUnmitigated = !fvg.isFilled;

          if (isVeryStrong) {
            // Strong FVG Small Block: High contrast 2-color border + distinct bold badge
            const fillAlpha = isUnmitigated ? 0.35 : 0.12;
            const strokeAlpha = isUnmitigated ? 0.98 : 0.45;

            ctx.fillStyle = hexToRgba(fvgColor, fillAlpha);
            ctx.strokeStyle = hexToRgba(fvgColor, strokeAlpha);
            ctx.lineWidth = isUnmitigated ? 1.5 : 1;
            ctx.setLineDash([]);

            ctx.fillRect(renderXStart, yTop, w, h);
            ctx.strokeRect(renderXStart, yTop, w, h);

            if (w >= 14 && h >= 7) {
              ctx.fillStyle = isUnmitigated ? '#ffffff' : hexToRgba(fvgColor, 0.90);
              ctx.font = 'bold 8px monospace';
              ctx.textAlign = 'center';
              const blockLabel = isBull ? '★BUY FVG' : '★SELL FVG';
              ctx.fillText(blockLabel, (renderXStart + renderXEnd) / 2, yTop + (h / 2) + 3);
            }
          } else {
            // Standard FVG Small Block: 2-color fill & outline
            const fillAlpha = isUnmitigated ? 0.22 : 0.08;
            const strokeAlpha = isUnmitigated ? 0.85 : 0.30;

            ctx.fillStyle = hexToRgba(fvgColor, fillAlpha);
            ctx.strokeStyle = hexToRgba(fvgColor, strokeAlpha);
            ctx.lineWidth = 1;
            ctx.setLineDash([]);

            ctx.fillRect(renderXStart, yTop, w, h);
            ctx.strokeRect(renderXStart, yTop, w, h);

            // Clean compact 2-color label for one-time block
            if (w >= 14 && h >= 7) {
              ctx.fillStyle = isUnmitigated ? (isBull ? '#34d399' : '#fb7185') : hexToRgba(fvgColor, 0.90);
              ctx.font = 'bold 8px monospace';
              ctx.textAlign = 'center';
              const blockLabel = isBull ? 'BUY FVG' : 'SELL FVG';
              ctx.fillText(blockLabel, (renderXStart + renderXEnd) / 2, yTop + (h / 2) + 3);
            }
          }
        });
      }

      ctx.restore();
    }

    // Render LuxAlgo Trendlines with Breaks (TWB)
    if (settings.indicators.showTrendlinesWithBreaks && twbResults) {
      // 1. Draw upper resistance line
      ctx.strokeStyle = '#ef4444'; // Red resistance
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let firstUpper = true;
      for (let i = start; i <= end; i++) {
        if (i < 0 || i >= twbResults.upperLine.length) continue;
        const val = twbResults.upperLine[i];
        if (val === null) {
          if (!firstUpper) {
            ctx.stroke();
            ctx.beginPath();
            firstUpper = true;
          }
          continue;
        }
        const x = getXFromIndex(i);
        const y = getYFromPrice(val);
        if (firstUpper) {
          ctx.moveTo(x, y);
          firstUpper = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 2. Draw lower support line
      ctx.strokeStyle = '#10b981'; // Green support
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let firstLower = true;
      for (let i = start; i <= end; i++) {
        if (i < 0 || i >= twbResults.lowerLine.length) continue;
        const val = twbResults.lowerLine[i];
        if (val === null) {
          if (!firstLower) {
            ctx.stroke();
            ctx.beginPath();
            firstLower = true;
          }
          continue;
        }
        const x = getXFromIndex(i);
        const y = getYFromPrice(val);
        if (firstLower) {
          ctx.moveTo(x, y);
          firstLower = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 3. Draw breakout signals (Arrows & Labels)
      if (settings.indicators.twbShowSignals ?? true) {
        for (let i = start; i <= end; i++) {
          if (i < 0 || i >= candles.length) continue;
          const x = getXFromIndex(i);
          const c = candles[i];
          
          if (twbResults.buyBreaks[i]) {
            drawUpArrow(x, getYFromPrice(c.low) - 14, 7);
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('B', x, getYFromPrice(c.low) - 26);
          }
          if (twbResults.sellBreaks[i]) {
            drawDownArrow(x, getYFromPrice(c.high) + 14, 7);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('B', x, getYFromPrice(c.high) + 26);
          }
        }
      }
    }

    // Render Smart Money Concepts (SMC)
    if (settings.indicators.showSmartMoneyConcepts && smcResults) {
      const activeObLimit = settings.indicators.smcObLimit ?? 5;
      const bullColor = '#10b981';
      const bearColor = '#ef4444';
      const lineStyle = settings.indicators.smcStructureLineStyle ?? 'dotted';

      // 1. Draw Order Blocks (OB) Shaded Rectangles
      // "price ካለፈ በኃላ አይወጣም" - strictly active unmitigated order blocks where price hasn't violated/passed through
      if (settings.indicators.smcShowOrderBlocks) {
        const activeOBs = smcResults.orderBlocks
          .filter((ob) => ob.endIndex === null || ob.endIndex >= start)
          .sort((a, b) => b.startIndex - a.startIndex)
          .slice(0, activeObLimit);

        activeOBs.forEach((ob) => {
          const startIdx = ob.startIndex;
          if (startIdx > end) return;

          const xStart = getXFromIndex(Math.max(start, startIdx));
          const xEnd = ob.endIndex !== null
            ? getXFromIndex(Math.min(end, ob.endIndex))
            : Math.max(getXFromIndex(candles.length - 1) + 40, chartWidth - 5);

          const yTop = getYFromPrice(ob.top);
          const yBottom = getYFromPrice(ob.bottom);

          const rectY = Math.min(yTop, yBottom);
          const rectH = Math.max(4, Math.abs(yBottom - yTop));
          const rectW = Math.max(16, xEnd - xStart);

          const isStrong = ob.isStrong ?? false;
          const tagLabel = ob.typeLabel ?? (ob.isBullish ? '+OB' : '-OB');

          // Styling with dynamic shades multiplier (1x, 2x, 2.5x)
          const mult = settings.indicators.smcObOpacityMultiplier ?? 2;
          const strongAlpha = Math.min(0.55, 0.16 * mult);
          const normalAlpha = Math.min(0.40, 0.10 * mult);
          const strongStroke = Math.min(0.95, 0.65 * Math.min(1.5, mult));
          const normalStroke = Math.min(0.85, 0.40 * Math.min(1.5, mult));
          const targetColor = ob.isBullish ? bullColor : bearColor;

          ctx.save();
          ctx.fillStyle = isStrong ? hexToRgba(targetColor, strongAlpha) : hexToRgba(targetColor, normalAlpha);
          ctx.strokeStyle = isStrong ? hexToRgba(targetColor, strongStroke) : hexToRgba(targetColor, normalStroke);
          ctx.lineWidth = isStrong ? (mult > 1 ? 2 : 1.5) : (mult > 1 ? 1.5 : 1);
          ctx.setLineDash([4, 2]);

          // Draw OB Rectangle
          ctx.fillRect(xStart, rectY, rectW, rectH);
          ctx.strokeRect(xStart, rectY, rectW, rectH);

          // If unmitigated, draw right-side badge
          if (xEnd >= chartWidth - 100) {
            const badgeText = `${tagLabel} ${ob.bottom.toFixed(1)} - ${ob.top.toFixed(1)}`;
            ctx.font = 'bold 9px monospace';
            const badgeW = ctx.measureText(badgeText).width + 8;
            ctx.fillStyle = isDark ? hexToRgba(targetColor, 0.35) : hexToRgba(targetColor, 0.2);
            ctx.fillRect(chartWidth - badgeW - 6, rectY + (rectH - 14) / 2, badgeW, 14);
            ctx.strokeStyle = targetColor;
            ctx.strokeRect(chartWidth - badgeW - 6, rectY + (rectH - 14) / 2, badgeW, 14);
            ctx.fillStyle = isDark ? '#ffffff' : '#000000';
            ctx.textAlign = 'right';
            ctx.fillText(badgeText, chartWidth - 10, rectY + (rectH + 6) / 2);
          }

          // Draw OB indicator tag
          ctx.restore();
          ctx.fillStyle = targetColor;
          ctx.font = isStrong ? 'bold 9px monospace' : '8px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(tagLabel, xStart + 4, rectY + Math.min(rectH - 2, 11));
        });
      }

      // 2. Draw BOS & CHoCH structural lines
      smcResults.bosChochLines.forEach((line) => {
        // Hide lines completely if toggled OFF
        if (line.type === 'BOS' && !settings.indicators.smcShowBOS) return;
        if (line.type === 'CHoCH' && !settings.indicators.smcShowCHoCH) return;

        // Only draw if line overlaps with visible window
        if (line.startIndex > end || line.endIndex < start) return;

        const xStart = getXFromIndex(Math.max(start, line.startIndex));
        const xEnd = getXFromIndex(Math.min(end, line.endIndex));
        const y = getYFromPrice(line.level);
        const targetColor = line.isBullish ? bullColor : bearColor;

        ctx.save();
        ctx.strokeStyle = targetColor;
        ctx.lineWidth = 1.25;

        if (lineStyle === 'dashed') {
          ctx.setLineDash([4, 4]);
        } else if (lineStyle === 'dotted') {
          ctx.setLineDash([2, 3]);
        } else {
          ctx.setLineDash([]);
        }

        // Draw line
        ctx.beginPath();
        ctx.moveTo(xStart, y);
        ctx.lineTo(xEnd, y);
        ctx.stroke();

        // Label string
        const labelText = line.type; // "BOS" or "CHoCH"
        ctx.restore();
        ctx.fillStyle = targetColor;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        // Draw small solid label background
        const labelWidth = ctx.measureText(labelText).width + 6;
        const labelX = (xStart + xEnd) / 2;
        ctx.fillStyle = isDark ? '#000000' : '#ffffff';
        ctx.fillRect(labelX - labelWidth / 2, y - 5, labelWidth, 10);
        
        ctx.fillStyle = targetColor;
        ctx.fillText(labelText, labelX, y + 3);
      });
    }

    // Render Multi-Instance SMC (e.g. 720 candles, Weekly HTF, Daily HTF, etc.)
    if (smcInstancesResults && smcInstancesResults.length > 0) {
      smcInstancesResults.forEach(({ instance, result }) => {
        const bullColor = instance.bullishColor || '#10b981';
        const bearColor = instance.bearishColor || '#ef4444';
        const lineStyle = instance.structureLineStyle || 'dotted';
        const activeObLimit = instance.obLimit || 5;

        // 1. Draw Instance Order Blocks
        if (instance.showOrderBlocks && result.orderBlocks) {
          const activeOBs = result.orderBlocks
            .filter((ob) => ob.endIndex === null || ob.endIndex >= start)
            .sort((a, b) => b.startIndex - a.startIndex)
            .slice(0, activeObLimit);

          activeOBs.forEach((ob) => {
            const startIdx = ob.startIndex;
            if (startIdx > end) return;

            const xStart = getXFromIndex(Math.max(start, startIdx));
            const xEnd = ob.endIndex !== null
              ? getXFromIndex(Math.min(end, ob.endIndex))
              : Math.max(getXFromIndex(candles.length - 1) + 40, chartWidth - 5);

            const yTop = getYFromPrice(ob.top);
            const yBottom = getYFromPrice(ob.bottom);

            const rectY = Math.min(yTop, yBottom);
            const rectH = Math.max(4, Math.abs(yBottom - yTop));
            const rectW = Math.max(16, xEnd - xStart);

            const isStrong = ob.isStrong ?? false;
            const tagLabel = ob.typeLabel ?? (ob.isBullish ? '+OB' : '-OB');

            const mult = instance.obOpacityMultiplier ?? 2;
            const strongAlpha = Math.min(0.55, 0.16 * mult);
            const normalAlpha = Math.min(0.40, 0.10 * mult);
            const strongStroke = Math.min(0.95, 0.65 * Math.min(1.5, mult));
            const normalStroke = Math.min(0.85, 0.40 * Math.min(1.5, mult));
            const targetColor = ob.isBullish ? bullColor : bearColor;

            ctx.save();
            ctx.fillStyle = isStrong ? hexToRgba(targetColor, strongAlpha) : hexToRgba(targetColor, normalAlpha);
            ctx.strokeStyle = isStrong ? hexToRgba(targetColor, strongStroke) : hexToRgba(targetColor, normalStroke);
            ctx.lineWidth = isStrong ? (mult > 1 ? 2 : 1.5) : (mult > 1 ? 1.5 : 1);
            ctx.setLineDash([4, 2]);

            ctx.fillRect(xStart, rectY, rectW, rectH);
            ctx.strokeRect(xStart, rectY, rectW, rectH);

            if (xEnd >= chartWidth - 100) {
              const badgeText = `${tagLabel} ${ob.bottom.toFixed(1)} - ${ob.top.toFixed(1)}`;
              ctx.font = 'bold 9px monospace';
              const badgeW = ctx.measureText(badgeText).width + 8;
              ctx.fillStyle = isDark ? hexToRgba(targetColor, 0.35) : hexToRgba(targetColor, 0.2);
              ctx.fillRect(chartWidth - badgeW - 6, rectY + (rectH - 14) / 2, badgeW, 14);
              ctx.strokeStyle = targetColor;
              ctx.strokeRect(chartWidth - badgeW - 6, rectY + (rectH - 14) / 2, badgeW, 14);
              ctx.fillStyle = isDark ? '#ffffff' : '#000000';
              ctx.textAlign = 'right';
              ctx.fillText(badgeText, chartWidth - 10, rectY + (rectH + 6) / 2);
            }

            ctx.restore();
            ctx.fillStyle = targetColor;
            ctx.font = isStrong ? 'bold 9px monospace' : '8px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(tagLabel, xStart + 4, rectY + Math.min(rectH - 2, 11));
          });
        }

        // 2. Draw Instance BOS / CHoCH lines
        if (result.bosChochLines) {
          result.bosChochLines.forEach((line) => {
            if (line.type === 'BOS' && !instance.showBOS) return;
            if (line.type === 'CHoCH' && !instance.showCHoCH) return;
            if (line.startIndex > end || line.endIndex < start) return;

            const xStart = getXFromIndex(Math.max(start, line.startIndex));
            const xEnd = getXFromIndex(Math.min(end, line.endIndex));
            const y = getYFromPrice(line.level);
            const targetColor = line.isBullish ? bullColor : bearColor;

            ctx.save();
            ctx.strokeStyle = targetColor;
            ctx.lineWidth = 1.25;

            if (lineStyle === 'dashed') {
              ctx.setLineDash([4, 4]);
            } else if (lineStyle === 'dotted') {
              ctx.setLineDash([2, 3]);
            } else {
              ctx.setLineDash([]);
            }

            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(xEnd, y);
            ctx.stroke();

            const badge = instance.tagBadge ? ` [${instance.tagBadge}]` : '';
            const labelText = `${line.type}${badge}`;
            ctx.restore();
            ctx.fillStyle = targetColor;
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            const labelWidth = ctx.measureText(labelText).width + 6;
            const labelX = (xStart + xEnd) / 2;
            ctx.fillStyle = isDark ? '#000000' : '#ffffff';
            ctx.fillRect(labelX - labelWidth / 2, y - 5, labelWidth, 10);
            ctx.fillStyle = targetColor;
            ctx.fillText(labelText, labelX, y + 3);
          });
        }
      });
    }

    // Render LuxAlgo® - Signals & Overlays™
    if (settings.indicators.showSignalsAndOverlays && soResults) {
      // 1. Render Shaded Ribbon
      if (settings.indicators.soShowRibbon) {
        ctx.save();
        for (let i = start; i < end; i++) {
          if (i < 0 || i >= soResults.fastFilter.length - 1) continue;
          const x1 = getXFromIndex(i);
          const x2 = getXFromIndex(i + 1);
          
          const fastY1 = getYFromPrice(soResults.fastFilter[i]);
          const fastY2 = getYFromPrice(soResults.fastFilter[i + 1]);
          
          const slowY1 = getYFromPrice(soResults.slowFilter[i]);
          const slowY2 = getYFromPrice(soResults.slowFilter[i + 1]);
          
          const isBullish = soResults.fastFilter[i] > soResults.slowFilter[i];
          ctx.fillStyle = isBullish ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
          
          ctx.beginPath();
          ctx.moveTo(x1, fastY1);
          ctx.lineTo(x2, fastY2);
          ctx.lineTo(x2, slowY2);
          ctx.lineTo(x1, slowY1);
          ctx.closePath();
          ctx.fill();
        }

        // Render the Fast Filter Line (glowing boundary)
        ctx.lineWidth = 1.5;
        for (let i = start; i < end; i++) {
          if (i < 0 || i >= soResults.fastFilter.length - 1) continue;
          const x1 = getXFromIndex(i);
          const x2 = getXFromIndex(i + 1);
          const y1 = getYFromPrice(soResults.fastFilter[i]);
          const y2 = getYFromPrice(soResults.fastFilter[i + 1]);
          const isBullish = soResults.fastFilter[i] > soResults.slowFilter[i];
          ctx.strokeStyle = isBullish ? '#10b981' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Render Confirmation / Contrarian Buy/Sell Signals
      const showSOSignals = settings.indicators.soShowSignalArrows ?? true;
      if (showSOSignals && soResults.signals) {
        soResults.signals.forEach((sig) => {
          if (sig.index < start || sig.index > end) return;
          const x = getXFromIndex(sig.index);
          const c = candles[sig.index];

          if (sig.type === 'buy' || sig.type === 'strong_buy') {
            const isStrong = sig.type === 'strong_buy';
            if (isStrong && !settings.indicators.soShowStrongSignals) return;

            // Arrow below the low of the candle
            const arrowY = getYFromPrice(c.low) - 15;
            drawUpArrow(x, arrowY, isStrong ? 9 : 7);

            ctx.fillStyle = isStrong ? '#10b981' : '#34d399';
            ctx.font = isStrong ? 'bold 10px monospace' : 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(isStrong ? 'STRONG BUY' : 'BUY', x, arrowY - 12);
          } else if (sig.type === 'sell' || sig.type === 'strong_sell') {
            const isStrong = sig.type === 'strong_sell';
            if (isStrong && !settings.indicators.soShowStrongSignals) return;

            // Arrow above the high of the candle
            const arrowY = getYFromPrice(c.high) + 15;
            drawDownArrow(x, arrowY, isStrong ? 9 : 7);

            ctx.fillStyle = isStrong ? '#ef4444' : '#f87171';
            ctx.font = isStrong ? 'bold 10px monospace' : 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(isStrong ? 'STRONG SELL' : 'SELL', x, arrowY + 18);
          }
        });
      }

      // 3. Render Exit Signals (+ or x tags)
      if (settings.indicators.soShowExitSignals && soResults.exits) {
        soResults.exits.forEach((ex) => {
          if (ex.index < start || ex.index > end) return;
          const x = getXFromIndex(ex.index);
          const c = candles[ex.index];

          if (ex.type === 'exit_buy') {
            const y = getYFromPrice(c.high) + 12;
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('×', x, y);
            ctx.font = '7px monospace';
            ctx.fillText('EXIT L', x, y + 8);
          } else if (ex.type === 'exit_sell') {
            const y = getYFromPrice(c.low) - 12;
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('+', x, y);
            ctx.font = '7px monospace';
            ctx.fillText('EXIT S', x, y - 6);
          }
        });
      }
    }

    // Render Confluence FVG Finder
    if (settings.indicators.showConfluenceFVG && fvgResults) {
      ctx.save();
      
      const drawZone = (z: FVGZone, isBullish: boolean) => {
        const baseColorHex = isBullish ? settings.indicators.fvgBullishColor : settings.indicators.fvgBearishColor;
        const borderColorHex = isBullish ? settings.indicators.fvgBullishBorderColor : settings.indicators.fvgBearishBorderColor;
        
        const hexToRgba = (hex: string, alpha: number) => {
          const cleanHex = hex.replace('#', '');
          const r = parseInt(cleanHex.substring(0, 2), 16) || 128;
          const g = parseInt(cleanHex.substring(2, 4), 16) || 128;
          const b = parseInt(cleanHex.substring(4, 6), 16) || 128;
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        const startX = getCanvasCoords({ time: z.formTime, price: 0 }).x;
        const topY = getYFromPrice(z.top);
        const botY = getYFromPrice(z.bot);
        const midY = (topY + botY) / 2;
        const height = botY - topY;

        let endX = chartWidth;
        if (z.isMitigated && z.mitigatedAtTime) {
          endX = getCanvasCoords({ time: z.mitigatedAtTime, price: 0 }).x;
        }

        if (startX > chartWidth || (z.isMitigated && z.mitigatedAtTime && endX < 0)) return;

        const isLineMode = (settings.indicators.fvgDisplayMode ?? 'Line') === 'Line';
        const activeColor = z.isMitigated ? (settings.indicators.fvgMitigatedColor || '#8b8b8b') : baseColorHex;
        const strokeColor = z.isMitigated ? 'rgba(139, 139, 139, 0.4)' : hexToRgba(borderColorHex || activeColor, 0.9);

        if (isLineMode) {
          // ONE BOLD LINE MODE at FVG price level
          ctx.beginPath();
          ctx.moveTo(startX, midY);
          ctx.lineTo(endX, midY);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(2, settings.indicators.fvgBorderWidth ?? 2.5);
          if (z.isMitigated) {
            ctx.setLineDash([4, 4]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // RECTANGLE ZONE BOX MODE
          let fillStyle = z.isMitigated ? 'rgba(139, 139, 139, 0.04)' : hexToRgba(baseColorHex, 0.08);
          let strokeStyle = z.isMitigated ? 'rgba(139, 139, 139, 0.15)' : hexToRgba(borderColorHex, 0.6);

          ctx.fillStyle = fillStyle;
          ctx.fillRect(startX, topY, endX - startX, height);

          ctx.beginPath();
          ctx.moveTo(startX, topY);
          ctx.lineTo(endX, topY);
          ctx.moveTo(startX, botY);
          ctx.lineTo(endX, botY);
          ctx.moveTo(startX, topY);
          ctx.lineTo(startX, botY);
          if (z.isMitigated) {
            ctx.moveTo(endX, topY);
            ctx.lineTo(endX, botY);
          }
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = settings.indicators.fvgBorderWidth ?? 1.5;
          ctx.stroke();
        }

        // 3. Draw Pill Label
        if (settings.indicators.fvgShowLabels && !z.isMitigated) {
          ctx.save();
          const labelText = isBullish ? 'Bull FVG' : 'Bear FVG';
          ctx.font = 'bold 9px "Inter", sans-serif';
          const textWidth = ctx.measureText(labelText).width;
          const pillW = textWidth + 12;
          const pillH = 15;
          
          const pillX = startX + 10;
          const pillY = midY - pillH / 2;

          ctx.beginPath();
          const pillRadius = 3;
          if (ctx.roundRect) {
            ctx.roundRect(pillX, pillY, pillW, pillH, pillRadius);
          } else {
            ctx.rect(pillX, pillY, pillW, pillH);
          }
          ctx.fillStyle = isBullish ? '#063d27' : '#54151a';
          ctx.fill();

          ctx.strokeStyle = activeColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = isBullish ? '#34d399' : '#f87171';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pillX + pillW / 2, pillY + pillH / 2 + 0.5);
          ctx.restore();
        }

        // 4. Draw Right Label "M" (LuxAlgo style active mitigation indicator)
        if (!z.isMitigated) {
          ctx.save();
          ctx.fillStyle = hexToRgba(activeColor, 0.85);
          ctx.font = 'bold 11px "Inter", sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText('M', endX - 8, midY);
          ctx.restore();
        }

        // 5. Draw Info Metrics (if enabled)
        if (settings.indicators.fvgShowInfo && !z.isMitigated) {
          ctx.fillStyle = activeColor;
          
          const sizeMap = {
            'Tiny': '7px',
            'Small': '8px',
            'Normal': '10px',
            'Large': '11px',
            'Huge': '13px'
          };
          const fontSize = sizeMap[settings.indicators.fvgInfoTextSize ?? 'Large'] ?? '11px';
          ctx.font = `500 ${fontSize} monospace`;
          ctx.textAlign = 'left';

          const textX = Math.max(5, startX + 5);
          const infoY = isLineMode ? midY - 10 : midY + 4;

          const infoText = `TF Confluence: ${z.confluenceCount} | Strength: ${z.strength.toFixed(1)}/10 | Session: ${z.session} | Age: ${z.ageBars} bars | Pips: ${z.pips}`;
          
          ctx.save();
          const textWidth = ctx.measureText(infoText).width;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(textX - 2, infoY - 10, textWidth + 4, 14);
          ctx.restore();

          ctx.fillStyle = isBullish ? '#34d399' : '#f87171';
          ctx.fillText(infoText, textX, infoY);
        }
      };

      fvgResults.bullZones.forEach(z => drawZone(z, true));
      fvgResults.bearZones.forEach(z => drawZone(z, false));

      ctx.restore();
    }

    // ==========================================
    // Render ICT Concepts (LuxAlgo)
    // ==========================================
    if (settings.indicators.showIctConcepts && ictResults) {
      ctx.save();

      // Helper to convert hex to RGBA
      const hexToRgba = (hex: string, alpha: number) => {
        const cleanHex = hex.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) || 128;
        const g = parseInt(cleanHex.substring(2, 4), 16) || 128;
        const b = parseInt(cleanHex.substring(4, 6), 16) || 128;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      // 1. Draw Volume Imbalances (VI)
      if (settings.indicators.ictShowVolumeImbalance) {
        ictResults.volumeImbalances.forEach((vi) => {
          const startX = getCanvasCoords({ time: vi.time, price: 0 }).x;
          const topY = getYFromPrice(vi.top);
          const botY = getYFromPrice(vi.bottom);
          const height = botY - topY;

          let endX = chartWidth;
          if (vi.endTime !== null) {
            endX = getCanvasCoords({ time: vi.endTime, price: 0 }).x;
          }

          if (startX > chartWidth || (vi.endTime !== null && endX < 0)) return;

          const baseColor = vi.isBullish ? settings.indicators.ictViBullishColor : settings.indicators.ictViBearishColor;
          ctx.fillStyle = hexToRgba(baseColor, 0.12);
          ctx.strokeStyle = hexToRgba(baseColor, 0.35);
          ctx.lineWidth = 1;

          ctx.fillRect(startX, topY, endX - startX, height);
          ctx.strokeRect(startX, topY, endX - startX, height);

          // Draw label "VI" inside
          if (vi.endTime === null && startX < chartWidth - 30) {
            ctx.fillStyle = baseColor;
            ctx.font = 'bold 8px "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('VI', startX + 5, (topY + botY) / 2 + 3);
          }
        });
      }

      // 2. Draw Buyside / Sellside Liquidity (BSL & SSL)
      if (settings.indicators.ictShowLiquidity) {
        ictResults.liquidityZones.forEach((lz) => {
          const startX = getCanvasCoords({ time: lz.time, price: 0 }).x;
          const y = getYFromPrice(lz.price);

          let endX = chartWidth;
          if (lz.endTime !== null) {
            endX = getCanvasCoords({ time: lz.endTime, price: 0 }).x;
          }

          if (startX > chartWidth || (lz.endTime !== null && endX < 0)) return;

          const isBsl = lz.isBuyside;
          const isStrong = lz.isStrong ?? false;
          const baseColor = isBsl ? settings.indicators.ictLiqBearishColor : settings.indicators.ictLiqBullishColor; // Red for BSL, Blue/Cyan for SSL
          
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = isStrong ? (lz.endTime === null ? 2.0 : 1.25) : (lz.endTime === null ? 1.5 : 1.0);
          ctx.setLineDash(lz.endTime === null ? [] : [3, 3]);

          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Shading band
          ctx.fillStyle = hexToRgba(baseColor, isStrong ? 0.08 : 0.04);
          const bandHeight = isStrong ? 8 : 6;
          ctx.fillRect(startX, isBsl ? y - bandHeight : y, endX - startX, bandHeight);

          // Text labels "Buyside Liquidity" / "Sellside Liquidity" / "EQH BSL" / "EQL SSL"
          if (lz.endTime === null && startX < chartWidth - 80) {
            ctx.fillStyle = baseColor;
            ctx.font = isStrong ? 'bold 10px "Inter", sans-serif' : 'bold 9px "Inter", sans-serif';
            ctx.textAlign = 'left';

            let labelText = lz.typeLabel;
            if (!labelText) {
              labelText = isBsl ? 'Buyside Liquidity' : 'Sellside Liquidity';
            }

            ctx.fillText(labelText, startX + 10, isBsl ? y - 4 : y + 10);
          }
        });
      }

      // 3. Draw Order Blocks (OB)
      if (settings.indicators.ictShowOrderBlocks) {
        ictResults.orderBlocks.forEach((ob) => {
          const startX = getCanvasCoords({ time: ob.time, price: 0 }).x;
          const topY = getYFromPrice(ob.top);
          const botY = getYFromPrice(ob.bottom);
          const height = botY - topY;

          let endX = chartWidth;
          if (ob.endTime !== null) {
            endX = getCanvasCoords({ time: ob.endTime, price: 0 }).x;
          }

          if (startX > chartWidth || (ob.endTime !== null && endX < 0)) return;

          const isStrong = ob.isStrong ?? false;
          const baseColor = ob.isBullish ? settings.indicators.ictObBullishColor : settings.indicators.ictObBearishColor;
          ctx.fillStyle = hexToRgba(baseColor, isStrong ? 0.16 : 0.08);
          ctx.strokeStyle = hexToRgba(baseColor, isStrong ? 0.65 : 0.35);
          ctx.lineWidth = isStrong ? (ob.endTime === null ? 2.0 : 1.2) : (ob.endTime === null ? 1.5 : 1.0);

          ctx.fillRect(startX, topY, endX - startX, height);
          ctx.strokeRect(startX, topY, endX - startX, height);

          // OB Label
          if (ob.endTime === null && startX < chartWidth - 50) {
            ctx.fillStyle = baseColor;
            ctx.font = isStrong ? 'bold 10px "Inter", sans-serif' : 'bold 9px "Inter", sans-serif';
            ctx.textAlign = 'left';
            const labelText = ob.typeLabel ?? (ob.isBullish ? '+OB' : '-OB');
            ctx.fillText(labelText, startX + 6, topY + 11);
          }
        });
      }

      // 4. Draw Fair Value Gaps (FVG), Inverted FVGs (IFVGs) & Balanced Price Ranges (BPR)
      if (settings.indicators.ictFvgOption !== 'NONE') {
        ictResults.fvgs.forEach((f) => {
          const startX = getCanvasCoords({ time: f.time, price: 0 }).x;
          const topY = getYFromPrice(f.top);
          const botY = getYFromPrice(f.bottom);
          const height = botY - topY;

          let endX = chartWidth;
          if (f.endTime !== null) {
            endX = getCanvasCoords({ time: f.endTime, price: 0 }).x;
          }

          if (startX > chartWidth || (f.endTime !== null && endX < 0)) return;

          let baseColor = f.isBullish ? settings.indicators.ictFvgBullishColor : settings.indicators.ictFvgBearishColor;
          let label = f.isBullish ? 'Bull FVG' : 'Bear FVG';
          let fillOpacity = 0.08;

          if (f.isBpr) {
            baseColor = '#d27d2d'; // Golden bronze for Balanced Price Range
            label = 'BPR';
            fillOpacity = 0.15;
          } else if (f.isInverted) {
            label = f.isBullish ? 'Bull IFVG' : 'Bear IFVG';
            fillOpacity = 0.05;
          }

          ctx.fillStyle = hexToRgba(baseColor, fillOpacity);
          ctx.strokeStyle = hexToRgba(baseColor, f.endTime === null ? 0.45 : 0.2);
          ctx.lineWidth = f.endTime === null ? 1.25 : 1.0;

          ctx.fillRect(startX, topY, endX - startX, height);
          ctx.strokeRect(startX, topY, endX - startX, height);

          // Draw label inside FVG/IFVG/BPR
          if (f.endTime === null && startX < chartWidth - 50) {
            ctx.fillStyle = baseColor;
            ctx.font = 'bold 9px "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(label, startX + 8, topY + 11);
          }
        });
      }

      // 5. Draw Market Structure Shift (MSS/CHoCH) and Break of Structure (BOS)
      if (settings.indicators.ictShowMarketStructure) {
        ictResults.marketStructures.forEach((ms) => {
          if (ms.type === 'MSS' && !settings.indicators.ictShowMSS) return;
          if (ms.type === 'BOS' && !settings.indicators.ictShowBOS) return;

          const startX = getCanvasCoords({ time: ms.time, price: 0 }).x;
          const breakX = getCanvasCoords({ time: ms.breakTime, price: 0 }).x;
          const y = getYFromPrice(ms.price);

          if (startX > chartWidth || breakX < 0) return;

          const isBull = ms.isBullish;
          let color = '#ffffff';

          if (ms.type === 'MSS') {
            color = isBull ? settings.indicators.ictMssColorBullish : settings.indicators.ictMssColorBearish;
          } else {
            color = isBull ? settings.indicators.ictBosColorBullish : settings.indicators.ictBosColorBearish;
          }

          // Line dash based on setting
          const lineStyle = settings.indicators.ictStructureLineStyle ?? 'dashed';
          if (lineStyle === 'dashed') {
            ctx.setLineDash([4, 4]);
          } else if (lineStyle === 'dotted') {
            ctx.setLineDash([2, 2]);
          } else {
            ctx.setLineDash([]);
          }

          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(breakX, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw a small circle at the swing point
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(startX, y, 2.5, 0, 2 * Math.PI);
          ctx.fill();

          // Draw "CHoCH" / "MSS" or "BOS" text label neatly floating above/below line
          const labelMode = settings.indicators.ictStructureLabelMode ?? 'CHoCH';
          let labelText = ms.type;
          if (ms.type === 'MSS') {
            labelText = labelMode === 'CHoCH' ? 'CHoCH' : 'MSS';
          }

          ctx.font = 'bold 9px "Inter", sans-serif';
          const textW = ctx.measureText(labelText).width;
          const labelX = (startX + breakX) / 2;
          const labelY = isBull ? y - 6 : y + 9;

          // Draw small background block for high contrast
          ctx.fillStyle = 'rgba(19, 23, 34, 0.75)';
          ctx.fillRect(labelX - textW / 2 - 3, labelY - 8, textW + 6, 11);

          // Draw label text
          ctx.fillStyle = color;
          ctx.textAlign = 'center';
          ctx.fillText(labelText, labelX, labelY);
        });
      }

      // 6. Highlight Displacement Candlesticks
      if (settings.indicators.ictShowDisplacement) {
        ictResults.displacements.forEach((time) => {
          const x = getCanvasCoords({ time, price: 0 }).x;
          if (x < 0 || x > chartWidth) return;

          // Draw a neat subtle vertical background highlight or cyan tick
          ctx.fillStyle = 'rgba(0, 230, 118, 0.05)';
          ctx.fillRect(x - candleWidth / 2, 0, candleWidth, chartHeight);

          // Draw a small elegant displacement marker at the top/bottom of the cell
          ctx.fillStyle = '#00e676';
          ctx.font = 'bold 8px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('DISP', x, 14);
        });
      }

      ctx.restore();
    }

    // Render Zeiierman Market Structure & Price Action Toolkit
    if (mstatResults && settings.indicators.showMarketStructureToolkit) {
      ctx.save();

      const bullCol = settings.indicators.mstatBullishColor ?? '#10b981';
      const bearCol = settings.indicators.mstatBearishColor ?? '#ef4444';
      const intCol = settings.indicators.mstatInternalColor ?? '#3b82f6';

      // 0. Render Zeiierman Order Block Zones (Compact Small Rectangles above/below candles)
      if (mstatResults.zones && mstatResults.zones.length > 0) {
        mstatResults.zones.forEach((z) => {
          const topY = getYFromPrice(z.top);
          const botY = getYFromPrice(z.bottom);

          // Small compact rectangle parameters (76px width, 11px height)
          const blockTotalWidth = 76;
          const heightPx = 11;

          // Supply (Bearish) appears ABOVE candle high (topY)
          // Demand (Bullish) appears BELOW candle low (botY)
          const rectY = z.isSupply ? Math.min(topY, botY) - heightPx - 4 : Math.max(topY, botY) + 4;

          const pivotX = getCanvasCoords({ time: z.startTime, price: 0 }).x;
          if (pivotX < -100 || pivotX > chartWidth + 100) return;

          const rectX = Math.max(10, Math.min(chartWidth - blockTotalWidth - 10, pivotX - blockTotalWidth / 2));

          const greenW = blockTotalWidth * z.greenLengthRatio;
          const redW = blockTotalWidth * z.redLengthRatio;

          // Draw Green Block portion
          ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
          ctx.fillRect(rectX, rectY, greenW, heightPx);

          // Draw Red Block portion
          ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.fillRect(rectX + greenW, rectY, redW, heightPx);

          // Outer crisp border
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.strokeRect(rectX, rectY, blockTotalWidth, heightPx);
        });
      }

      ctx.restore();
    }

    // Render Pure Price Action Liquidity Sweeps [LuxAlgo]
    if (pureLiquidityResults && (settings.indicators.showPureLiquiditySweeps ?? true)) {
      ctx.save();

      const bullLevelCol = settings.indicators.pureLiquidityBullishColor ?? '#089981';
      const bullSweepCol = settings.indicators.pureLiquidityBullishSweepColor ?? 'rgba(8, 153, 129, 0.5)';
      const bearLevelCol = settings.indicators.pureLiquidityBearishColor ?? '#f23645';
      const bearSweepCol = settings.indicators.pureLiquidityBearishSweepColor ?? 'rgba(242, 54, 69, 0.5)';

      // 1. Render Completed Sweeps (Level Line from pivot index to sweep index + Sweep Box)
      pureLiquidityResults.sweeps.forEach((sweep) => {
        const { pivotIndex, sweepIndex, level, boxHigh, boxLow, isBullish } = sweep;

        // Skip if outside visible bar window
        if (pivotIndex > end || sweepIndex < start) return;

        const xPivot = getXFromIndex(Math.max(start, pivotIndex));
        const xSweep = getXFromIndex(Math.min(end, sweepIndex));
        const yLevel = getYFromPrice(level);

        // Draw level line from pivot origin to sweep bar
        ctx.strokeStyle = isBullish ? bullLevelCol : bearLevelCol;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(xPivot, yLevel);
        ctx.lineTo(xSweep, yLevel);
        ctx.stroke();

        // Draw sweep box around the sweep wick at sweepIndex
        const xSweepLeft = getXFromIndex(Math.max(start, sweepIndex - 1));
        const xSweepRight = getXFromIndex(Math.min(end, sweepIndex + 1));
        const yBoxTop = getYFromPrice(boxHigh);
        const yBoxBottom = getYFromPrice(boxLow);

        const boxW = Math.max(6, xSweepRight - xSweepLeft);
        const boxH = Math.max(2, Math.abs(yBoxBottom - yBoxTop));
        const boxX = xSweep - boxW / 2;
        const boxY = Math.min(yBoxTop, yBoxBottom);

        ctx.fillStyle = isBullish ? bullSweepCol : bearSweepCol;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = isBullish ? bullLevelCol : bearLevelCol;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
      });

      // 2. Render Active Unmitigated & Unswept Levels extending to right edge
      pureLiquidityResults.activeLevels.forEach((active) => {
        const { pivotIndex, level, isBullish } = active;
        if (pivotIndex > end) return;

        const xPivot = getXFromIndex(Math.max(start, pivotIndex));
        const xEnd = chartWidth;
        const yLevel = getYFromPrice(level);

        ctx.strokeStyle = isBullish ? bullLevelCol : bearLevelCol;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(xPivot, yLevel);
        ctx.lineTo(xEnd, yLevel);
        ctx.stroke();
      });

      ctx.restore();
    }

    // Render Predictive Ranges [LuxAlgo]
    if (predictiveRangesResults && (settings.indicators.showPredictiveRanges ?? true)) {
      ctx.save();

      const upperColor = settings.indicators.prUpperColor ?? '#f23645';
      const lowerColor = settings.indicators.prLowerColor ?? '#089981';
      const fillOpacity = Math.max(0.04, Math.min(1, (settings.indicators.prFillOpacity ?? 15) / 100));
      const extendRight = settings.indicators.prExtendRight ?? true;
      const showLabels = settings.indicators.prShowLabels ?? true;

      predictiveRangesResults.shelves.forEach((shelf) => {
        const shelfStart = shelf.startIndex;
        const shelfEnd = shelf.endIndex;

        // Skip if outside visible window
        if (shelfStart > end) return;
        if (!shelf.isCurrent && shelfEnd < start) return;

        const x1 = getXFromIndex(shelfStart);
        let x2: number;
        if (shelf.isCurrent && extendRight) {
          x2 = chartWidth;
        } else {
          x2 = getXFromIndex(Math.min(candles.length - 1, shelfEnd + 1));
        }

        const drawX1 = Math.max(-50, x1);
        const drawX2 = Math.min(chartWidth + 50, x2);
        if (drawX2 < drawX1) return;

        const yU2 = getYFromPrice(shelf.pru2);
        const yU1 = getYFromPrice(shelf.pru1);
        const yS1 = getYFromPrice(shelf.prs1);
        const yS2 = getYFromPrice(shelf.prs2);

        // 1. Upper Resistance Zone Shade (Between R1 and R2)
        const topFillY = Math.min(yU2, yU1);
        const fillHeightU = Math.max(2, Math.abs(yU1 - yU2));
        
        const isR2LiveTouch = shelf.isCurrent && predictiveRangesResults.isLiveR2Touch && (settings.indicators.prHighlightActiveTouch ?? true);
        const isS2LiveTouch = shelf.isCurrent && predictiveRangesResults.isLiveS2Touch && (settings.indicators.prHighlightActiveTouch ?? true);

        // Fill R1 - R2 Upper Shade
        ctx.fillStyle = hexToRgba(upperColor, isR2LiveTouch ? Math.min(0.35, fillOpacity * 1.8) : fillOpacity);
        ctx.fillRect(drawX1, topFillY, drawX2 - drawX1, fillHeightU);

        // 2. Lower Support Zone Shade (Between P1/S1 and P2/S2)
        const botFillY = Math.min(yS1, yS2);
        const fillHeightS = Math.max(2, Math.abs(yS2 - yS1));

        // Fill P1/S1 - P2/S2 Lower Shade
        ctx.fillStyle = hexToRgba(lowerColor, isS2LiveTouch ? Math.min(0.35, fillOpacity * 1.8) : fillOpacity);
        ctx.fillRect(drawX1, botFillY, drawX2 - drawX1, fillHeightS);

        // 3. Draw current live price level labels on the right edge if enabled (without average line)
        if (shelf.isCurrent && showLabels && drawX2 >= chartWidth - 100) {
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'right';

          const drawLevelBadge = (label: string, price: number, y: number, color: string, isPulsing = false) => {
            if (y < 0 || y > chartHeight) return;
            const text = `${label} ${price.toFixed(price > 100 ? 2 : 4)}`;
            const badgeW = ctx.measureText(text).width + 8;
            const badgeH = 12;
            const badgeX = chartWidth - 6;
            const badgeY = y - badgeH / 2;

            ctx.fillStyle = isPulsing 
              ? (isDark ? 'rgba(60, 20, 20, 0.95)' : 'rgba(255, 230, 230, 0.95)')
              : (isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)');
            ctx.fillRect(badgeX - badgeW, badgeY, badgeW, badgeH);

            ctx.strokeStyle = color;
            ctx.lineWidth = isPulsing ? 2 : 1;
            ctx.strokeRect(badgeX - badgeW, badgeY, badgeW, badgeH);

            ctx.fillStyle = color;
            ctx.fillText(text, badgeX - 4, y + 3);
          };

          drawLevelBadge('PR R2', shelf.pru2, yU2, upperColor, isR2LiveTouch);
          drawLevelBadge('PR R1', shelf.pru1, yU1, upperColor);
          drawLevelBadge('PR P1', shelf.prs1, yS1, lowerColor);
          drawLevelBadge('PR P2', shelf.prs2, yS2, lowerColor, isS2LiveTouch);
        }
      });

      // 7. Render R2/S2 Touch, Rejection & Breakout 'B' Signal Markers
      const showTouchMarkers = settings.indicators.prShowTouchMarkers ?? true;
      const showBreakoutMarkers = settings.indicators.prShowBreakoutMarkers ?? true;

      if ((showTouchMarkers || showBreakoutMarkers) && predictiveRangesResults.signals.length > 0) {
        predictiveRangesResults.signals.forEach((sig) => {
          if (sig.index < start || sig.index > end) return;
          const x = getXFromIndex(sig.index);
          const c = candles[sig.index];
          if (!c) return;

          // --- 7A. Bullish R2 Breakout ('B' badge above candle) ---
          if (sig.type === 'r2_breakout') {
            if (!showBreakoutMarkers) return;
            const y = getYFromPrice(c.high);
            const badgeY = y - 18;
            if (badgeY < 12) return;

            // Draw upward breakout arrow icon & badge
            const badgeW = 18;
            const badgeH = 14;
            const badgeX = x - badgeW / 2;

            // Pill with emerald/cyan accent
            ctx.fillStyle = isDark ? '#064e3b' : '#d1fae5';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
            ctx.fill();
            ctx.stroke();

            // Upward pointer indicator
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.moveTo(x, y - 2);
            ctx.lineTo(x - 4, badgeY + badgeH);
            ctx.lineTo(x + 4, badgeY + badgeH);
            ctx.closePath();
            ctx.fill();

            // Bold "B" text
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = isDark ? '#34d399' : '#047857';
            ctx.fillText('B', x, badgeY + 10);
          }
          // --- 7B. Bearish S2 Breakout ('B' badge below candle) ---
          else if (sig.type === 's2_breakout') {
            if (!showBreakoutMarkers) return;
            const y = getYFromPrice(c.low);
            const badgeY = y + 6;
            if (badgeY > chartHeight - 18) return;

            const badgeW = 18;
            const badgeH = 14;
            const badgeX = x - badgeW / 2;

            // Pill with rose accent
            ctx.fillStyle = isDark ? '#4c0519' : '#ffe4e6';
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
            ctx.fill();
            ctx.stroke();

            // Downward pointer indicator
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(x, y + 2);
            ctx.lineTo(x - 4, badgeY);
            ctx.lineTo(x + 4, badgeY);
            ctx.closePath();
            ctx.fill();

            // Bold "B" text
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = isDark ? '#fb7185' : '#be123c';
            ctx.fillText('B', x, badgeY + 10);
          }
          // --- 7C. Bearish R2 Rejection (🔻 R2) ---
          else if (sig.type === 'r2_rejection') {
            if (!showTouchMarkers) return;
            const y = getYFromPrice(c.high);
            const markerY = y - 10;
            if (markerY < 10) return;

            // Draw Downward Rejection Triangle & Tag
            ctx.fillStyle = upperColor;
            ctx.beginPath();
            ctx.moveTo(x, y - 2);
            ctx.lineTo(x - 5, y - 9);
            ctx.lineTo(x + 5, y - 9);
            ctx.closePath();
            ctx.fill();

            // Badge text "R2"
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            const text = 'R2';
            const tw = ctx.measureText(text).width + 6;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
            ctx.fillRect(x - tw / 2, y - 20, tw, 10);
            ctx.strokeStyle = upperColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(x - tw / 2, y - 20, tw, 10);
            ctx.fillStyle = upperColor;
            ctx.fillText(text, x, y - 12);
          }
          // --- 7D. Bullish S2 Rejection (🔺 S2) ---
          else if (sig.type === 's2_rejection') {
            if (!showTouchMarkers) return;
            const y = getYFromPrice(c.low);
            const markerY = y + 10;
            if (markerY > chartHeight - 10) return;

            // Draw Upward Rejection Triangle & Tag
            ctx.fillStyle = lowerColor;
            ctx.beginPath();
            ctx.moveTo(x, y + 2);
            ctx.lineTo(x - 5, y + 9);
            ctx.lineTo(x + 5, y + 9);
            ctx.closePath();
            ctx.fill();

            // Badge text "S2"
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            const text = 'S2';
            const tw = ctx.measureText(text).width + 6;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
            ctx.fillRect(x - tw / 2, y + 11, tw, 10);
            ctx.strokeStyle = lowerColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(x - tw / 2, y + 11, tw, 10);
            ctx.fillStyle = lowerColor;
            ctx.fillText(text, x, y + 19);
          }
        });
      }

      ctx.restore();
    }

    // --- 3H. MPRO SIGNALS ENGINE (PRO / DEMO) RENDERING ---
    if ((settings.indicators.showSrClassification ?? true) && srClassificationResults && srClassificationResults.levels.length > 0) {
      ctx.save();
      const sr = srClassificationResults;
      const decimals = activeSymbolSpec.decimals || 2;
      const isDemo = !isMproPro;
      const DEMO_RESTRICTED_CANDLES = 300;
      const demoCutoffIndex = Math.max(sr.startBarIndex, candles.length - DEMO_RESTRICTED_CANDLES);

      const isAnchored = (settings.indicators.srLineExtension ?? 'Anchored') === 'Anchored';
      const xStart = (isMproPro && !isAnchored) ? getXFromIndex(0) : getXFromIndex(sr.startBarIndex);
      const rightEdge = Math.max(chartWidth, getXFromIndex(candles.length - 1 + 8));
      const fullXEnd = isMproPro ? rightEdge : getXFromIndex(sr.endBarIndex);
      const xEnd = isDemo ? Math.min(fullXEnd, getXFromIndex(demoCutoffIndex)) : fullXEnd;
      const lineWidth = settings.indicators.srLineWidth ?? 1.5;
      const displayMode = settings.indicators.srDisplayMode ?? 'shadow';
      const shadowVis = settings.indicators.srShadowVisibility ?? '1x';
      const shadowMultiplier = shadowVis === '0.5x' ? 0.5 : shadowVis === '2x' ? 2.0 : shadowVis === '3x' ? 3.0 : 1.0;

      const isShadowMode = displayMode === 'shadow' || displayMode === 'both';
      const isLineMode = displayMode === 'lines' || displayMode === 'both';
      const showCenterShadows = settings.indicators.srShowCenterShadows ?? false;
      const showStrongShadows = settings.indicators.srShowStrongShadows ?? true;
      const showMidline = settings.indicators.srShowMidline ?? true;

      // 1. Draw Range Boxes (Higher Shadow, Lower Shadow, and Middle Equilibrium Line)
      if ((isMproPro || isDemo) && (showStrongShadows || showMidline)) {
        const topY1 = getYFromPrice(sr.topBox.top);
        const topY2 = getYFromPrice(sr.topBox.bottom);
        const btmY1 = getYFromPrice(sr.bottomBox.top);
        const btmY2 = getYFromPrice(sr.bottomBox.bottom);

        const midPrice = sr.midline ?? (sr.topBox.top + sr.bottomBox.bottom) / 2;
        const midY = getYFromPrice(midPrice);
        const midH = Math.max(3, Math.abs(topY2 - topY1) * 0.5);

        const drawBoxW = Math.max(0, xEnd - xStart);

        if (drawBoxW > 0) {
          if (showStrongShadows) {
            // Top Resistance Box (Higher Shadow)
            const topH = Math.max(4, topY2 - topY1);
            const topGrad = ctx.createLinearGradient(0, topY1, 0, topY1 + topH);
            topGrad.addColorStop(0, hexToRgba(sr.topBox.color, Math.min(0.40, 0.16 * shadowMultiplier)));
            topGrad.addColorStop(1, hexToRgba(sr.topBox.color, Math.min(0.12, 0.04 * shadowMultiplier)));
            ctx.fillStyle = topGrad;
            ctx.fillRect(xStart, topY1, drawBoxW, topH);
            ctx.strokeStyle = hexToRgba(sr.topBox.color, Math.min(0.80, 0.35 * shadowMultiplier));
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.strokeRect(xStart, topY1, drawBoxW, topH);

            // Bottom Support Box (Lower Shadow)
            const btmH = Math.max(4, btmY2 - btmY1);
            const btmGrad = ctx.createLinearGradient(0, btmY1, 0, btmY1 + btmH);
            btmGrad.addColorStop(0, hexToRgba(sr.bottomBox.color, Math.min(0.12, 0.04 * shadowMultiplier)));
            btmGrad.addColorStop(1, hexToRgba(sr.bottomBox.color, Math.min(0.40, 0.16 * shadowMultiplier)));
            ctx.fillStyle = btmGrad;
            ctx.fillRect(xStart, btmY1, drawBoxW, btmH);
            ctx.strokeStyle = hexToRgba(sr.bottomBox.color, Math.min(0.80, 0.35 * shadowMultiplier));
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.strokeRect(xStart, btmY1, drawBoxW, btmH);

            // Distinct labels for Higher Shadow and Lower Shadow
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = sr.topBox.color;
            ctx.textAlign = 'left';
            ctx.fillText(`Higher Shadow (Resistance) · ${sr.topBox.top.toFixed(decimals)}`, xStart + 8, topY1 + 12);
            ctx.fillStyle = sr.bottomBox.color;
            ctx.fillText(`Lower Shadow (Support) · ${sr.bottomBox.bottom.toFixed(decimals)}`, xStart + 8, btmY1 + btmH - 6);
          }

          // Middle Equilibrium Line (መሃል መስመር) between Upper and Lower
          if (showMidline) {
            const midColor = settings.indicators.srMidlineColor || '#06b6d4';
            const midLineWidth = settings.indicators.srMidlineWidth ?? 1.5;
            const midType = settings.indicators.srMidlineType || 'both';

            // 1. Dynamic Moving Midline (Historical movement in the middle across chart history)
            if ((midType === 'dynamic' || midType === 'both') && sr.dynamicMidline && sr.dynamicMidline.length > 1) {
              ctx.save();
              ctx.beginPath();
              let firstPoint = true;
              for (let d = 0; d < sr.dynamicMidline.length; d++) {
                const pt = sr.dynamicMidline[d];
                if (isDemo && pt.barIndex > demoCutoffIndex) break;
                const ptX = getXFromIndex(pt.barIndex);
                const ptY = getYFromPrice(pt.price);
                if (firstPoint) {
                  ctx.moveTo(ptX, ptY);
                  firstPoint = false;
                } else {
                  ctx.lineTo(ptX, ptY);
                }
              }
              // Soft outer glow behind dynamic moving midline path
              ctx.strokeStyle = hexToRgba(midColor, 0.35);
              ctx.lineWidth = midLineWidth + 2.5;
              ctx.setLineDash([]);
              ctx.stroke();

              // Crisp dynamic history midline
              ctx.strokeStyle = midColor;
              ctx.lineWidth = midLineWidth;
              ctx.stroke();
              ctx.restore();
            }

            // 2. 50% Horizontal Equilibrium Midline
            if (midType === 'equilibrium' || midType === 'both') {
              // Subtle Mid Shadow Gradient
              const midBoxTopY = midY - midH / 2;
              const midGrad = ctx.createLinearGradient(0, midBoxTopY, 0, midBoxTopY + midH);
              midGrad.addColorStop(0, hexToRgba(midColor, Math.min(0.20, 0.05 * shadowMultiplier)));
              midGrad.addColorStop(0.5, hexToRgba(midColor, Math.min(0.35, 0.12 * shadowMultiplier)));
              midGrad.addColorStop(1, hexToRgba(midColor, Math.min(0.20, 0.05 * shadowMultiplier)));
              ctx.fillStyle = midGrad;
              ctx.fillRect(xStart, midBoxTopY, drawBoxW, midH);

              // Primary Crisp Midline (50% Equilibrium)
              ctx.strokeStyle = midColor;
              ctx.lineWidth = midLineWidth;
              ctx.setLineDash([6, 4]); // Clean dash pattern
              ctx.beginPath();
              ctx.moveTo(xStart, midY);
              ctx.lineTo(xEnd, midY);
              ctx.stroke();
              ctx.setLineDash([]);

              // Midline Label Badge
              ctx.font = 'bold 9px monospace';
              ctx.textAlign = 'left';
              const midLabel = `Mpro Midline (50% Equilibrium) · ${midPrice.toFixed(decimals)}`;
              const midTextWidth = ctx.measureText(midLabel).width;
              const badgeW = midTextWidth + 12;
              const badgeH = 15;
              const badgeX = xStart + 8;
              const badgeY = midY - badgeH / 2;

              // Badge Background Pill
              ctx.fillStyle = isDark ? 'rgba(8, 14, 26, 0.88)' : 'rgba(255, 255, 255, 0.92)';
              ctx.beginPath();
              ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
              ctx.fill();

              // Badge Border
              ctx.strokeStyle = hexToRgba(midColor, 0.7);
              ctx.lineWidth = 1;
              ctx.stroke();

              // Badge Text
              ctx.fillStyle = midColor;
              ctx.fillText(midLabel, badgeX + 6, midY + 3.5);
            }
          }
        }
      }

      // 2. Draw S/R Levels (Inside Intermediate Shadows / Lines) - Only if showCenterShadows is ON
      const showLabels = settings.indicators.srShowLabels ?? false;

      if ((isMproPro || isDemo) && (showCenterShadows || isLineMode)) {
        const drawBoxW = Math.max(0, xEnd - xStart);
        const priceSpan = Math.abs(sr.topBox.top - sr.bottomBox.bottom);
        const zonePriceDelta = Math.max(0.0001, (priceSpan / 20) * 0.40);

        sr.levels.forEach((lvl) => {
          const y = getYFromPrice(lvl.value);
          if (y < -30 || y > chartHeight + 30) return;

          // 2a. RECTANGLE SHADOW MODE (Anchored from xStart to xEnd) - Center Intermediate Shadows
          if (isShadowMode && showCenterShadows && drawBoxW > 0) {
            const shadowTopY = getYFromPrice(lvl.value + zonePriceDelta);
            const shadowBtmY = getYFromPrice(lvl.value - zonePriceDelta);
            const shadowH = Math.max(5, Math.min(22, Math.abs(shadowBtmY - shadowTopY)));
            const shadowY = y - shadowH / 2;

            const baseShadowAlpha = Math.min(0.50, 0.09 * lvl.alpha * shadowMultiplier);

            // Soft vertical gradient for smooth shadow effect
            const grad = ctx.createLinearGradient(0, shadowY, 0, shadowY + shadowH);
            grad.addColorStop(0, hexToRgba(lvl.color, baseShadowAlpha * 0.15));
            grad.addColorStop(0.5, hexToRgba(lvl.color, baseShadowAlpha));
            grad.addColorStop(1, hexToRgba(lvl.color, baseShadowAlpha * 0.15));

            ctx.fillStyle = grad;
            ctx.fillRect(xStart, shadowY, drawBoxW, shadowH);

            // Subtle perimeter border for rectangle shadow
            ctx.strokeStyle = hexToRgba(lvl.color, Math.min(0.60, baseShadowAlpha * 1.6));
            ctx.lineWidth = 0.75;
            ctx.setLineDash([2, 3]);
            ctx.strokeRect(xStart, shadowY, drawBoxW, shadowH);
            ctx.setLineDash([]);
          }

          // 2b. LINE MODE (Original sharp lines)
          if (isLineMode) {
            ctx.strokeStyle = hexToRgba(lvl.color, lvl.alpha);
            ctx.lineWidth = lineWidth;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(xEnd, y);
            ctx.stroke();
          }

          // Classification Label / Badge at front / right edge (optional)
          if (showLabels && drawBoxW > 0) {
            const labelX = xEnd + (lvl.e * 3.5);
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';

            const text = `${lvl.txt}`;
            const tw = ctx.measureText(text).width + 8;
            const th = 13;
            const badgeY = y - th / 2;

            ctx.fillStyle = isDark ? 'rgba(10, 10, 15, 0.88)' : 'rgba(255, 255, 255, 0.92)';
            ctx.fillRect(labelX, badgeY, tw, th);
            ctx.strokeStyle = hexToRgba(lvl.color, lvl.alpha);
            ctx.lineWidth = 1;
            ctx.strokeRect(labelX, badgeY, tw, th);

            ctx.fillStyle = lvl.color;
            ctx.fillText(text, labelX + 4, y + 3.5);
          }
        });
      }

      // 3. Draw Swing Pivots only if showPP is explicitly enabled
      if (isMproPro && (settings.indicators.srShowPP ?? false) && sr.swingPivots.length > 0) {
        sr.swingPivots.forEach((sp) => {
          const spX = getXFromIndex(sp.barIndex);
          const spY = getYFromPrice(sp.price);
          if (spY < 0 || spY > chartHeight) return;

          ctx.strokeStyle = sp.isHigh ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(spX, spY);
          ctx.lineTo(xEnd, spY);
          ctx.stroke();

          ctx.fillStyle = sp.isHigh ? '#ef4444' : '#22c55e';
          ctx.beginPath();
          ctx.arc(spX, spY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 4. Draw BUY and SELL Signals (In Demo mode, only past historical data is shown; latest 300+ candles are hidden)
      const showSrSignals = settings.indicators.srShowSignals ?? true;
      if (showSrSignals && sr.signals && sr.signals.length > 0) {
        ctx.setLineDash([]);
        
        // Exact symbol name formatting (e.g. BTC/USD, XAUUSD, EURUSD, R_100)
        const formatExactSignalSymbol = (sym: string): string => {
          if (!sym) return 'MARKET';
          const clean = sym.trim();
          const upper = clean.toUpperCase();
          if (upper === 'FRXXAUUSD' || upper === 'XAUUSD' || upper === 'GOLD') return 'XAUUSD';
          if (upper === 'CRYBTCUSD' || upper === 'BTCUSD' || upper === 'BTC/USD') return 'BTC/USD';
          if (upper === 'CRYETHUSD' || upper === 'ETHUSD' || upper === 'ETH/USD') return 'ETH/USD';
          if (upper === 'FRXEURUSD' || upper === 'EURUSD') return 'EURUSD';
          if (upper === 'FRXGBPUSD' || upper === 'GBPUSD') return 'GBPUSD';
          if (upper === 'FRXUSDJPY' || upper === 'USDJPY') return 'USDJPY';
          if (upper === 'FRXAUDUSD' || upper === 'AUDUSD') return 'AUDUSD';
          if (upper === 'FRXUSDCAD' || upper === 'USDCAD') return 'USDCAD';
          if (upper === 'FRXUSDCHF' || upper === 'USDCHF') return 'USDCHF';
          if (upper === 'FRXNZDUSD' || upper === 'NZDUSD') return 'NZDUSD';
          
          const stripped = upper.replace(/^(FRX|CRY|IND|SYN|OTC)/, '');
          if (/^[A-Z]{6}$/.test(stripped)) {
            return stripped;
          }
          return stripped || clean;
        };

        const exactSymbol = formatExactSignalSymbol(symbolName);
        const showMproSignals = settings.indicators.mproShowArrows ?? true;

        if (showMproSignals) {
          sr.signals.forEach((sig) => {
          // In Demo mode, completely hide signals on the latest 300+ candles
          if (isDemo && sig.index > demoCutoffIndex) return;

          if (sig.index < start || sig.index > end) return;
          const x = getXFromIndex(sig.index);
          const c = candles[sig.index];
          if (!c) return;

          const isSelected = selectedMproRRSignal && selectedMproRRSignal.index === sig.index && selectedMproRRSignal.type === sig.type;

          if (sig.type === 'buy') {
            // BUY Signal: Below candle low at the bottom green support zone
            const y = getYFromPrice(c.low);
            const arrowTipY = y + 4;
            const arrowBaseY = y + 16;

            // Highlight ring if selected for 1:1.5 RR
            if (isSelected) {
              ctx.strokeStyle = '#22c55e';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x, y + 10, 16, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Draw Upward Pointing Green Arrow (▲)
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(x, arrowTipY);
            ctx.lineTo(x - 6, arrowBaseY);
            ctx.lineTo(x + 6, arrowBaseY);
            ctx.closePath();
            ctx.fill();

            // Draw "BUY" or "STRONG BUY" Pill Badge below the arrow
            const isStrong = sig.strength === 'strong' || sig.isLastLineTouch;
            ctx.font = isStrong ? 'bold 9.5px monospace' : 'bold 9px monospace';
            ctx.textAlign = 'center';
            const labelText = isStrong ? `STRONG BUY ${exactSymbol}` : `BUY ${exactSymbol}`;
            const textWidth = ctx.measureText(labelText).width;
            const badgeW = textWidth + 10;
            const badgeH = 15;
            const badgeX = x - badgeW / 2;
            const badgeY = arrowBaseY + 3;

            // Badge Background
            ctx.fillStyle = isDark
              ? (isStrong ? 'rgba(5, 150, 105, 0.96)' : 'rgba(6, 78, 59, 0.95)')
              : (isStrong ? 'rgba(167, 243, 208, 0.98)' : 'rgba(209, 250, 229, 0.95)');
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
            ctx.fill();

            // Badge Border
            ctx.strokeStyle = isSelected ? '#a7f3d0' : (isStrong ? '#34d399' : '#22c55e');
            ctx.lineWidth = isSelected ? 2.0 : (isStrong ? 1.6 : 1.2);
            ctx.stroke();

            // Badge Text
            ctx.fillStyle = isDark
              ? (isStrong ? '#ffffff' : '#4ade80')
              : (isStrong ? '#064e3b' : '#15803d');
            ctx.fillText(labelText, x, badgeY + 11);
          } else if (sig.type === 'sell') {
            // SELL Signal: Above candle high at the top red resistance zone
            const y = getYFromPrice(c.high);
            const arrowTipY = y - 4;
            const arrowBaseY = y - 16;

            // Highlight ring if selected for 1:1.5 RR
            if (isSelected) {
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x, y - 10, 16, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Draw Downward Pointing Red Arrow (▼)
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(x, arrowTipY);
            ctx.lineTo(x - 6, arrowBaseY);
            ctx.lineTo(x + 6, arrowBaseY);
            ctx.closePath();
            ctx.fill();

            // Draw "SELL" or "STRONG SELL" Pill Badge above the arrow
            const isStrong = sig.strength === 'strong' || sig.isLastLineTouch;
            ctx.font = isStrong ? 'bold 9.5px monospace' : 'bold 9px monospace';
            ctx.textAlign = 'center';
            const labelText = isStrong ? `STRONG SELL ${exactSymbol}` : `SELL ${exactSymbol}`;
            const textWidth = ctx.measureText(labelText).width;
            const badgeW = textWidth + 10;
            const badgeH = 15;
            const badgeX = x - badgeW / 2;
            const badgeY = arrowBaseY - badgeH - 3;

            // Badge Background
            ctx.fillStyle = isDark
              ? (isStrong ? 'rgba(190, 18, 60, 0.96)' : 'rgba(76, 5, 25, 0.95)')
              : (isStrong ? 'rgba(254, 205, 211, 0.98)' : 'rgba(254, 226, 226, 0.95)');
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
            ctx.fill();

            // Badge Border
            ctx.strokeStyle = isSelected ? '#fecdd3' : (isStrong ? '#fb7185' : '#ef4444');
            ctx.lineWidth = isSelected ? 2.0 : (isStrong ? 1.6 : 1.2);
            ctx.stroke();

            // Badge Text
            ctx.fillStyle = isDark
              ? (isStrong ? '#ffffff' : '#f87171')
              : (isStrong ? '#881337' : '#b91c1c');
            ctx.fillText(labelText, x, badgeY + 11);
          }
        });
        }
      }

      // 6. DEMO MODE CUTOFF BARRIER & RESTRICTION NOTIFICATION
      if (isDemo && candles.length > 0) {
        const cutoffX = getXFromIndex(demoCutoffIndex);

        // Draw vertical demo cutoff line if within chart canvas
        if (cutoffX > 0 && cutoffX < chartWidth) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cutoffX, 0);
          ctx.lineTo(cutoffX, chartHeight);
          ctx.stroke();

          // Cutoff Padlock Badge at the top of the divider
          ctx.setLineDash([]);
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          const barrierText = '🔒 DEMO CUTOFF: HISTORICAL DATA ONLY (300+ RECENT CANDLES LOCKED)';
          const bTw = ctx.measureText(barrierText).width + 14;
          const bTh = 20;
          const bY = 24;

          ctx.fillStyle = isDark ? 'rgba(30, 20, 5, 0.94)' : 'rgba(254, 243, 199, 0.96)';
          ctx.beginPath();
          ctx.roundRect(cutoffX - bTw / 2, bY, bTw, bTh, 4);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
          ctx.fillText(barrierText, cutoffX, bY + 13.5);
        }
      }

      // 6. AUTOMATIC 1:1.5 RISK/REWARD VISUALIZATION (ON DEMO SIGNALS & SELECTED PRO SIGNALS)
      const renderSignalRRTool = (sig: SRSignal, isSelected: boolean, customEndBarIndex?: number) => {
        const rr = calculateMproSignalRR(sig, candles, sr.highest, sr.lowest, customEndBarIndex);
        const startX = getXFromIndex(rr.startBarIndex);
        const endX = getXFromIndex(isDemo ? Math.min(demoCutoffIndex, rr.endBarIndex) : rr.endBarIndex);
        const boxWidth = Math.max(60, endX - startX);

        if (startX + boxWidth < 0 || startX > chartWidth) return;

        const yEntry = getYFromPrice(rr.entry);
        const ySL = getYFromPrice(rr.stopLoss);
        const yTP = getYFromPrice(rr.takeProfit);
        const decimals = activeSymbolSpec.decimals || 2;

        if (rr.direction === 'buy') {
          // Green Reward Box (Entry up to Take Profit)
          const rewardH = Math.max(2, yEntry - yTP);
          ctx.fillStyle = isSelected ? 'rgba(34, 197, 94, 0.28)' : 'rgba(34, 197, 94, 0.16)';
          ctx.fillRect(startX, yTP, boxWidth, rewardH);
          ctx.strokeStyle = isSelected ? '#22c55e' : 'rgba(34, 197, 94, 0.7)';
          ctx.lineWidth = isSelected ? 1.6 : 1.0;
          ctx.strokeRect(startX, yTP, boxWidth, rewardH);

          // Red Risk Box (Entry down to Stop Loss)
          const riskH = Math.max(2, ySL - yEntry);
          ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.16)';
          ctx.fillRect(startX, yEntry, boxWidth, riskH);
          ctx.strokeStyle = isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.7)';
          ctx.lineWidth = isSelected ? 1.6 : 1.0;
          ctx.strokeRect(startX, yEntry, boxWidth, riskH);
        } else {
          // Red Risk Box (Entry up to Stop Loss)
          const riskH = Math.max(2, yEntry - ySL);
          ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.16)';
          ctx.fillRect(startX, ySL, boxWidth, riskH);
          ctx.strokeStyle = isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.7)';
          ctx.lineWidth = isSelected ? 1.6 : 1.0;
          ctx.strokeRect(startX, ySL, boxWidth, riskH);

          // Green Reward Box (Entry down to Take Profit)
          const rewardH = Math.max(2, yTP - yEntry);
          ctx.fillStyle = isSelected ? 'rgba(34, 197, 94, 0.28)' : 'rgba(34, 197, 94, 0.16)';
          ctx.fillRect(startX, yEntry, boxWidth, rewardH);
          ctx.strokeStyle = isSelected ? '#22c55e' : 'rgba(34, 197, 94, 0.7)';
          ctx.lineWidth = isSelected ? 1.6 : 1.0;
          ctx.strokeRect(startX, yEntry, boxWidth, rewardH);
        }

        // Center Entry Divider Line
        if (settings.indicators.showCenterEntryLine ?? true) {
          ctx.beginPath();
          ctx.moveTo(startX, yEntry);
          ctx.lineTo(startX + boxWidth, yEntry);
          ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 1:1.5 R:R Ratio Badge
        const centerX = startX + boxWidth / 2;
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        const badgeText = `R:R 1 : 1.5`;
        const tw = ctx.measureText(badgeText).width + 10;
        const th = 15;

        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(centerX - tw / 2, yEntry - th / 2, tw, th, 3);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
        ctx.fillText(badgeText, centerX, yEntry + 3);

        // Price Labels on the right side of the RR box
        const labelX = startX + boxWidth + 3;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';

        // Take Profit Tag
        ctx.fillStyle = '#22c55e';
        ctx.fillText(`TP: ${rr.takeProfit.toFixed(decimals)}`, labelX, yTP + 3);

        // Stop Loss Tag
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`SL: ${rr.stopLoss.toFixed(decimals)}`, labelX, ySL + 3);
      };

      // In Demo mode: group repeated touches / nearby arrows of the same zone into one long Risk/Reward tool box
      if (isDemo && showSrSignals && sr.signals && sr.signals.length > 0) {
        const NEAR_SIGNAL_DISTANCE = 18;
        interface SignalGroup {
          mainSignal: SRSignal;
          allSignals: SRSignal[];
          endBarIndex: number;
          direction: 'buy' | 'sell';
        }
        const signalGroups: SignalGroup[] = [];

        sr.signals.forEach((sig) => {
          if (sig.index > demoCutoffIndex) return;

          const lastGroup = signalGroups[signalGroups.length - 1];
          if (
            lastGroup &&
            lastGroup.direction === sig.type &&
            (sig.index <= lastGroup.endBarIndex || sig.index - lastGroup.allSignals[lastGroup.allSignals.length - 1].index <= NEAR_SIGNAL_DISTANCE)
          ) {
            // Repeated touch in the same bounce zone: combine into the current group and extend its span
            lastGroup.allSignals.push(sig);
            lastGroup.endBarIndex = Math.min(
              candles.length - 1,
              Math.max(lastGroup.endBarIndex, sig.index + 14)
            );
          } else {
            // New separate signal cluster
            signalGroups.push({
              mainSignal: sig,
              allSignals: [sig],
              endBarIndex: Math.min(candles.length - 1, sig.index + 16),
              direction: sig.type,
            });
          }
        });

        signalGroups.forEach((group) => {
          const isSelected = !!selectedMproRRSignal && group.allSignals.some(
            (s) => s.index === selectedMproRRSignal.index && s.type === selectedMproRRSignal.type
          );
          renderSignalRRTool(group.mainSignal, isSelected, group.endBarIndex);
        });
      } else if (selectedMproRRSignal) {
        // In PRO mode, render on the actively selected signal
        renderSignalRRTool(selectedMproRRSignal, true);
      }

      ctx.restore();
    }

    // ==========================================
    // 3G. Render ECHO mpro (Echo Forecast [LuxAlgo])
    // ==========================================
    if (echoResults && (settings.indicators.showEchoMpro ?? true)) {
      ctx.save();

      const showArea = settings.indicators.echoShowArea ?? true;
      const refAreaCol = settings.indicators.echoRefAreaColor ?? '#ff5d00';
      const corrAreaCol = settings.indicators.echoCorrAreaColor ?? '#089981';
      const evalAreaCol = settings.indicators.echoEvalAreaColor ?? '#808080';
      const fcastCol = settings.indicators.echoFcastColor ?? '#2157f3';
      const fcastStyle = settings.indicators.echoFcastStyle ?? 'dotted';
      const fcastWidth = settings.indicators.echoLineWidth ?? 1.5;

      const yTop = getYFromPrice(echoResults.top);
      const yBtm = getYFromPrice(echoResults.btm);
      const areaH = Math.max(4, Math.abs(yBtm - yTop));
      const areaY = Math.min(yTop, yBtm);

      // --- 1. Screen Shade Areas (Evaluation, Reference, Correlation Windows) ---
      if (showArea) {
        // A. Evaluation Window (Gray Search Canvas)
        const xEvalLeft = getXFromIndex(echoResults.evalWindow.leftIndex);
        const xEvalRight = getXFromIndex(echoResults.evalWindow.rightIndex);
        const evalW = Math.max(2, xEvalRight - xEvalLeft);

        if (xEvalRight >= 0 && xEvalLeft <= chartWidth) {
          ctx.fillStyle = hexToRgba(evalAreaCol, isDark ? 0.12 : 0.08);
          ctx.fillRect(xEvalLeft, areaY, evalW, areaH);

          ctx.strokeStyle = hexToRgba(evalAreaCol, 0.35);
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(xEvalLeft, areaY);
          ctx.lineTo(xEvalLeft + evalW, areaY);
          ctx.moveTo(xEvalLeft, areaY + areaH);
          ctx.lineTo(xEvalLeft + evalW, areaY + areaH);
          ctx.stroke();
          ctx.setLineDash([]);

          // Evaluation Window Label Badge
          if (xEvalLeft + 120 < chartWidth) {
            ctx.font = 'bold 8.5px monospace';
            ctx.textAlign = 'left';
            const evalText = 'EVALUATION WINDOW';
            const tw = ctx.measureText(evalText).width + 8;
            const th = 13;
            const badgeX = Math.max(10, xEvalLeft + 6);
            const badgeY = areaY + 6;

            ctx.fillStyle = isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(240, 240, 240, 0.9)';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, tw, th, 3);
            ctx.fill();
            ctx.strokeStyle = hexToRgba(evalAreaCol, 0.6);
            ctx.stroke();

            ctx.fillStyle = isDark ? '#9ca3af' : '#4b5563';
            ctx.fillText(evalText, badgeX + 4, badgeY + 9.5);
          }
        }

        // B. Correlation / Best Matched Pattern Window (Teal/Green)
        const xCorrLeft = getXFromIndex(echoResults.corrWindow.leftIndex);
        const xCorrRight = getXFromIndex(echoResults.corrWindow.rightIndex);
        const corrW = Math.max(2, xCorrRight - xCorrLeft);

        if (xCorrRight >= 0 && xCorrLeft <= chartWidth) {
          ctx.fillStyle = hexToRgba(corrAreaCol, isDark ? 0.22 : 0.16);
          ctx.fillRect(xCorrLeft, areaY, corrW, areaH);

          ctx.strokeStyle = corrAreaCol;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(xCorrLeft, areaY, corrW, areaH);
          ctx.setLineDash([]);

          // Correlation Window Label Badge
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'left';
          const rStr = echoResults.bestCorrelation >= 0
            ? `+${echoResults.bestCorrelation.toFixed(2)}`
            : echoResults.bestCorrelation.toFixed(2);
          const corrText = `MATCHED PATTERN (r = ${rStr})`;
          const tw = ctx.measureText(corrText).width + 10;
          const th = 14;
          const badgeX = Math.max(10, xCorrLeft + 6);
          const badgeY = areaY + 6;

          ctx.fillStyle = isDark ? 'rgba(6, 78, 59, 0.92)' : 'rgba(209, 250, 229, 0.95)';
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, tw, th, 3);
          ctx.fill();
          ctx.strokeStyle = corrAreaCol;
          ctx.stroke();

          ctx.fillStyle = isDark ? '#34d399' : '#065f46';
          ctx.fillText(corrText, badgeX + 5, badgeY + 10);
        }

        // C. Reference Window (Orange/Amber)
        const xRefLeft = getXFromIndex(echoResults.refWindow.leftIndex);
        const xRefRight = getXFromIndex(echoResults.refWindow.rightIndex);
        const refW = Math.max(2, xRefRight - xRefLeft);

        if (xRefRight >= 0 && xRefLeft <= chartWidth) {
          ctx.fillStyle = hexToRgba(refAreaCol, isDark ? 0.20 : 0.15);
          ctx.fillRect(xRefLeft, areaY, refW, areaH);

          ctx.strokeStyle = refAreaCol;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(xRefLeft, areaY, refW, areaH);
          ctx.setLineDash([]);

          // Reference Window Label Badge
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'left';
          const refText = 'REFERENCE WINDOW';
          const tw = ctx.measureText(refText).width + 10;
          const th = 14;
          const badgeX = Math.max(10, xRefLeft + 6);
          const badgeY = areaY + 6;

          ctx.fillStyle = isDark ? 'rgba(67, 20, 7, 0.92)' : 'rgba(254, 215, 170, 0.95)';
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, tw, th, 3);
          ctx.fill();
          ctx.strokeStyle = refAreaCol;
          ctx.stroke();

          ctx.fillStyle = isDark ? '#fb923c' : '#9a3412';
          ctx.fillText(refText, badgeX + 5, badgeY + 10);
        }
      }

      // --- 2. Render ECHO Forecast Curve Line ---
      if (echoResults.forecastSegments.length > 0) {
        ctx.strokeStyle = fcastCol;
        ctx.lineWidth = fcastWidth;

        if (fcastStyle === 'dotted') {
          ctx.setLineDash([2, 4]);
        } else if (fcastStyle === 'dashed') {
          ctx.setLineDash([6, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        let isStarted = false;

        echoResults.forecastSegments.forEach((seg) => {
          const x1 = getXFromIndex(seg.x1Index);
          const y1 = getYFromPrice(seg.y1Price);
          const x2 = getXFromIndex(seg.x2Index);
          const y2 = getYFromPrice(seg.y2Price);

          if (!isStarted) {
            ctx.moveTo(x1, y1);
            isStarted = true;
          }
          ctx.lineTo(x2, y2);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // --- 3. Forecast Endpoint & Projected Price Tag ---
        const lastSeg = echoResults.forecastSegments[echoResults.forecastSegments.length - 1];
        if (lastSeg) {
          const endX = getXFromIndex(lastSeg.x2Index);
          const endY = getYFromPrice(lastSeg.y2Price);

          if (endX >= -20 && endX <= chartWidth + 100 && endY >= -20 && endY <= chartHeight + 20) {
            // Pulsing target circle
            ctx.fillStyle = fcastCol;
            ctx.beginPath();
            ctx.arc(endX, endY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Projection Tag Badge
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';
            const decimals = activeSymbolSpec.decimals || 2;
            const deltaSign = echoResults.forecastChangePercent >= 0 ? '+' : '';
            const tagText = `ECHO: ${lastSeg.y2Price.toFixed(decimals)} (${deltaSign}${echoResults.forecastChangePercent.toFixed(2)}%)`;
            const tW = ctx.measureText(tagText).width + 10;
            const tH = 16;
            const tagX = Math.min(chartWidth - tW - 6, endX + 8);
            const tagY = Math.max(10, Math.min(chartHeight - tH - 4, endY - tH / 2));

            ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
            ctx.beginPath();
            ctx.roundRect(tagX, tagY, tW, tH, 3);
            ctx.fill();
            ctx.strokeStyle = fcastCol;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = fcastCol;
            ctx.fillText(tagText, tagX + 5, tagY + 11.5);
          }
        }
      }

      ctx.restore();
    }

    // ==========================================
    // 3H. Render Mpro2 Signal (PRO / DEMO)
    // ==========================================
    if (mpro2Results && (settings.indicators.showMpro2Signal ?? true)) {
      ctx.save();

      const decimals = activeSymbolSpec.decimals || 2;
      const { levels, signals, timeZones, goldenPocket, statusData, lineStartBarIndex, weeklyAnchor } = mpro2Results;
      const isMpro2Demo = !isMpro2Pro;
      const DEMO_RESTRICTED_CANDLES = 300;
      const demoCutoffIndex = Math.max(0, candles.length - DEMO_RESTRICTED_CANDLES);
      const demoCutoffX = getXFromIndex(demoCutoffIndex);

      const lineExtMode = settings.indicators.mpro2LineExtensionMode ?? 'FullChart';
      const isFullChart = lineExtMode === 'FullChart' || lineExtMode === 'Both';
      const showScreenTexts = settings.indicators.mpro2ShowScreenTexts ?? true;
      const showLevelLabels = settings.indicators.mpro2ShowLevelLabels ?? true;
      const showConfluence = settings.indicators.mpro2ShowConfluence ?? true;
      const showTouchCounts = settings.indicators.mpro2ShowTouchCounts ?? true;
      const showGoldenPocket = settings.indicators.mpro2ShowGoldenPocket ?? true;
      const goldenPocketCol = settings.indicators.mpro2GoldenPocketColor ?? '#FFB020';
      const showTimeZones = settings.indicators.mpro2ShowTimeZones ?? false;
      const showTimeZoneLabels = settings.indicators.mpro2ShowTimeZoneLabels ?? false;
      const showTouchArrows = settings.indicators.mpro2ShowTouchArrows ?? true;
      const bullCol = settings.indicators.mpro2BullColor ?? '#26A69A';
      const bearCol = settings.indicators.mpro2BearColor ?? '#EF5350';
      const showDottedLines = settings.indicators.mpro2ShowDottedLines ?? false;

      const displayMode = settings.indicators.mpro2DisplayMode ?? 'lines';
      const shadowVis = settings.indicators.mpro2ShadowVisibility ?? '1x';
      const shadowMultiplier = shadowVis === '0.5x' ? 0.5 : shadowVis === '2x' ? 2.0 : shadowVis === '3x' ? 3.0 : 1.0;
      const isShadowMode = displayMode === 'shadow' || displayMode === 'both';
      const isLineMode = displayMode === 'lines' || displayMode === 'both';

      const sampleSize = Math.min(candles.length, 50);
      const avgCandleRange = sampleSize > 0
        ? candles.slice(-sampleSize).reduce((acc, c) => acc + (c.high - c.low), 0) / sampleSize
        : 1;
      const shadowZonePriceDelta = Math.max(0.0001, avgCandleRange * 0.40 * shadowMultiplier);

      const fullLineEndX = chartWidth;
      const lineStartX = isFullChart ? 0 : Math.max(0, getXFromIndex(lineStartBarIndex));
      const lineEndX = isMpro2Demo ? Math.min(fullLineEndX, demoCutoffX) : fullLineEndX;

      // 1. Render Golden Pocket Zone (0.618 - 0.650) - ALWAYS KEEP YELLOW GOLD ONE!
      if ((isMpro2Pro || isMpro2Demo) && showGoldenPocket && goldenPocket) {
        const yGP1 = getYFromPrice(goldenPocket.high);
        const yGP2 = getYFromPrice(goldenPocket.low);
        const yTop = Math.min(yGP1, yGP2);
        const gpHeight = Math.max(2, Math.abs(yGP2 - yGP1));
        const gpStartX = isFullChart ? 0 : Math.max(0, getXFromIndex(lineStartBarIndex));
        const gpWidth = Math.max(0, lineEndX - gpStartX);

        if (gpWidth > 0 && gpStartX <= chartWidth && yTop + gpHeight >= 0 && yTop <= chartHeight) {
          ctx.fillStyle = hexToRgba(goldenPocketCol, isDark ? 0.22 : 0.16);
          ctx.fillRect(gpStartX, yTop, gpWidth, gpHeight);

          // Solid clean yellow gold borders (no dots or dashes)
          ctx.strokeStyle = hexToRgba(goldenPocketCol, 0.75);
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(gpStartX, yTop);
          ctx.lineTo(lineEndX, yTop);
          ctx.moveTo(gpStartX, yTop + gpHeight);
          ctx.lineTo(lineEndX, yTop + gpHeight);
          ctx.stroke();

          // Golden Pocket Tag in yellow gold
          if (showScreenTexts && showLevelLabels) {
            ctx.font = 'bold 9.5px monospace';
            ctx.textAlign = 'right';
            ctx.fillStyle = goldenPocketCol;
            ctx.fillText('★ Golden Pocket (0.618 - 0.650)', Math.max(gpStartX + 120, lineEndX - 8), yTop + gpHeight / 2 + 3.5);
          }
        }
      }

      // 2. Render Fibonacci Time Zones - Only when showDottedLines is enabled
      if (isMpro2Pro && showTimeZones && timeZones && timeZones.length > 0 && showDottedLines) {
        timeZones.forEach((tz) => {
          const tzX = getXFromIndex(tz.barIndex);
          if (tzX >= 0 && tzX <= lineEndX) {
            ctx.strokeStyle = hexToRgba(tz.color, 0.35);
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(tzX, 0);
            ctx.lineTo(tzX, chartHeight);
            ctx.stroke();
            ctx.setLineDash([]);

            if (showScreenTexts && showTimeZoneLabels) {
              ctx.font = 'bold 9px monospace';
              ctx.fillStyle = tz.color;
              ctx.textAlign = 'center';
              ctx.fillText(`TZ ${tz.offset}`, tzX, 16);
            }
          }
        });
      }

      // 3. Render Fibonacci Base Lines (PRO: full width, DEMO: up to cutoff)
      if (isMpro2Pro || isMpro2Demo) {
        levels.forEach((lvl) => {
          if (!lvl.isShown) return;
          // STRICT FILTER: When showDottedLines is false, ONLY allow the Two Higher and Lower Base Lines
          if (!showDottedLines && !lvl.isBaseLine) return;
          const y = getYFromPrice(lvl.price);
          if (y < -20 || y > chartHeight + 20) return;

          const drawW = Math.max(0, lineEndX - lineStartX);
          if (drawW <= 0) return;

          // -------------------------------------------------------------
          // RECTANGLE SHADOW MODE FOR MPRO2
          // -------------------------------------------------------------
          if (isShadowMode) {
            const shadowTopY = getYFromPrice(lvl.price + shadowZonePriceDelta);
            const shadowBtmY = getYFromPrice(lvl.price - shadowZonePriceDelta);
            const shadowH = Math.max(6, Math.min(32, Math.abs(shadowBtmY - shadowTopY)));
            const shadowY = y - shadowH / 2;

            const baseShadowAlpha = lvl.isBaseLine
              ? Math.min(0.46, 0.18 * shadowMultiplier)
              : Math.min(0.28, 0.10 * shadowMultiplier);

            // Smooth linear vertical gradient for rectangle shadow
            const grad = ctx.createLinearGradient(0, shadowY, 0, shadowY + shadowH);
            grad.addColorStop(0, hexToRgba(lvl.color, baseShadowAlpha * 0.15));
            grad.addColorStop(0.5, hexToRgba(lvl.color, baseShadowAlpha));
            grad.addColorStop(1, hexToRgba(lvl.color, baseShadowAlpha * 0.15));

            ctx.fillStyle = grad;
            ctx.fillRect(lineStartX, shadowY, drawW, shadowH);

            // Subtle perimeter border for the rectangle shadow zone
            ctx.strokeStyle = hexToRgba(lvl.color, Math.min(0.75, baseShadowAlpha * 1.8));
            ctx.lineWidth = lvl.isBaseLine ? 1.2 : 0.8;
            if (lvl.isBaseLine || !showDottedLines) {
              ctx.setLineDash([]);
            } else {
              ctx.setLineDash([3, 3]);
            }
            ctx.strokeRect(lineStartX, shadowY, drawW, shadowH);
            ctx.setLineDash([]);
          }

          // -------------------------------------------------------------
          // CRISP LINE MODE FOR MPRO2
          // -------------------------------------------------------------
          if (isLineMode) {
            // Draw Confluence Ambient Glow if level is confluent and confluence enabled
            if (lvl.confluent && showConfluence && showDottedLines) {
              ctx.strokeStyle = hexToRgba(lvl.color, 0.28);
              ctx.lineWidth = lvl.width + 4;
              ctx.beginPath();
              ctx.moveTo(lineStartX, y);
              ctx.lineTo(lineEndX, y);
              ctx.stroke();
            }

            // Base Lines are strictly Solid (no dots or dashes)
            ctx.strokeStyle = lvl.color;
            ctx.lineWidth = lvl.isBaseLine ? Math.max(1.5, lvl.width) : lvl.width;
            if (lvl.isBaseLine || !showDottedLines) {
              ctx.setLineDash([]);
            } else if (lvl.style === 'Solid') {
              ctx.setLineDash([]);
            } else if (lvl.style === 'Dashed') {
              ctx.setLineDash([6, 4]);
            } else {
              ctx.setLineDash([2, 3]);
            }
            ctx.beginPath();
            ctx.moveTo(lineStartX, y);
            ctx.lineTo(lineEndX, y);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Render Level Labels on the right side if screen texts is enabled
          if (showScreenTexts && showLevelLabels) {
            ctx.font = 'bold 9.5px monospace';
            ctx.textAlign = 'right';

            const priceStr = lvl.price.toFixed(decimals);
            const isHigher = lvl.ratio === 0.000 || lvl.price >= Math.max(...levels.filter(l => l.isBaseLine).map(l => l.price));
            const shadowSuffix = isShadowMode && !isLineMode ? 'Shadow' : 'Line';
            let lineName = lvl.isBaseLine ? (isHigher ? `Higher ${shadowSuffix}` : `Lower ${shadowSuffix}`) : `${lvl.ratio.toFixed(3)}`;
            if (lvl.isBaseLine && weeklyAnchor) {
              lineName = isHigher ? `Higher ${shadowSuffix} (PWH)` : `Lower ${shadowSuffix} (PWL)`;
            }
            const touchStr = showTouchCounts && lvl.touchCount > 0 ? ` · ${lvl.touchCount}x` : '';
            const starStr = (lvl.confluent && showDottedLines) ? ` ${settings.indicators.mpro2ConfluenceMarker || '★'}` : '';
            const labelText = `${lineName} · ${priceStr}${touchStr}${starStr}`;

            const tw = ctx.measureText(labelText).width + 8;
            const th = 13;
            const badgeX = lineEndX - tw - 4;
            const badgeY = y - th / 2;

            if (badgeX >= lineStartX) {
              ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.94)';
              ctx.fillRect(badgeX, badgeY, tw, th);
              ctx.strokeStyle = hexToRgba(lvl.color, 0.6);
              ctx.lineWidth = 1;
              ctx.strokeRect(badgeX, badgeY, tw, th);

              ctx.fillStyle = lvl.color;
              ctx.fillText(labelText, lineEndX - 8, y + 3.5);
            }
          }
        });
      }

      // 4. Render Buy & Sell Touch Arrows on Upper and Lower Lines (Historical past charts only in Demo mode)
      if (showTouchArrows && signals && signals.length > 0) {
        signals.forEach((sig) => {
          // In Demo mode, strictly hide signals on latest 300+ candles
          if (isMpro2Demo && sig.index > demoCutoffIndex) return;

          const sigX = getXFromIndex(sig.index);
          if (sigX < -20 || sigX > chartWidth + 20) return;

          const c = candles[sig.index];
          const isBuy = sig.type === 'BUY';
          const sigCol = isBuy ? bullCol : bearCol;
          const basePrice = c ? (isBuy ? c.low : c.high) : sig.price;
          const sigY = getYFromPrice(basePrice);

          ctx.save();
          if (isBuy) {
            // BUY SIGNAL (Arrow pointing UP below the candle)
            const arrowTipY = sigY + 6;
            const arrowBaseY = arrowTipY + 14;
            const arrowHeadW = 12;

            // Green Triangle Arrow with Outline & Glow
            ctx.shadowColor = 'rgba(38, 166, 154, 0.6)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = sigCol;
            ctx.beginPath();
            ctx.moveTo(sigX, arrowTipY);
            ctx.lineTo(sigX - arrowHeadW / 2, arrowBaseY);
            ctx.lineTo(sigX + arrowHeadW / 2, arrowBaseY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // BUY Badge (Support Reversal or Retest Continuation)
            if (showScreenTexts) {
              const labelY = arrowBaseY + 4;
              ctx.font = 'bold 9px monospace';
              const text = sig.message || `▲ BUY · ${sig.price.toFixed(decimals)}`;
              const tw = ctx.measureText(text).width + 10;
              const th = 15;
              const bx = sigX - tw / 2;

              const isRetest = sig.subType === 'RETEST_CONTINUATION_BUY';
              ctx.fillStyle = isRetest
                ? (isDark ? 'rgba(6, 95, 70, 0.95)' : 'rgba(204, 251, 241, 0.98)')
                : (isDark ? 'rgba(6, 78, 59, 0.95)' : 'rgba(209, 250, 229, 0.98)');
              ctx.beginPath();
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(bx, labelY, tw, th, 3);
              } else {
                ctx.rect(bx, labelY, tw, th);
              }
              ctx.fill();
              ctx.strokeStyle = isRetest ? '#10b981' : sigCol;
              ctx.lineWidth = 1.2;
              ctx.stroke();

              ctx.fillStyle = isRetest ? (isDark ? '#6ee7b7' : '#047857') : (isDark ? '#34d399' : '#047857');
              ctx.textAlign = 'center';
              ctx.fillText(text, sigX, labelY + 10.5);
            }
          } else {
            // SELL SIGNAL (Arrow pointing DOWN above the candle)
            const arrowTipY = sigY - 6;
            const arrowBaseY = arrowTipY - 14;
            const arrowHeadW = 12;

            // Red Triangle Arrow with Outline & Glow
            ctx.shadowColor = 'rgba(239, 83, 80, 0.6)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = sigCol;
            ctx.beginPath();
            ctx.moveTo(sigX, arrowTipY);
            ctx.lineTo(sigX - arrowHeadW / 2, arrowBaseY);
            ctx.lineTo(sigX + arrowHeadW / 2, arrowBaseY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // SELL Badge (Resistance Reversal or Retest Continuation)
            if (showScreenTexts) {
              const th = 15;
              const labelY = arrowBaseY - th - 4;
              ctx.font = 'bold 9px monospace';
              const text = sig.message || `▼ SELL · ${sig.price.toFixed(decimals)}`;
              const tw = ctx.measureText(text).width + 10;
              const bx = sigX - tw / 2;

              const isRetest = sig.subType === 'RETEST_CONTINUATION_SELL';
              ctx.fillStyle = isRetest
                ? (isDark ? 'rgba(88, 28, 36, 0.95)' : 'rgba(254, 226, 226, 0.98)')
                : (isDark ? 'rgba(76, 5, 25, 0.95)' : 'rgba(255, 228, 230, 0.98)');
              ctx.beginPath();
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(bx, labelY, tw, th, 3);
              } else {
                ctx.rect(bx, labelY, tw, th);
              }
              ctx.fill();
              ctx.strokeStyle = isRetest ? '#f43f5e' : sigCol;
              ctx.lineWidth = 1.2;
              ctx.stroke();

              ctx.fillStyle = isRetest ? (isDark ? '#fda4af' : '#b91c1c') : (isDark ? '#fb7185' : '#b91c1c');
              ctx.textAlign = 'center';
              ctx.fillText(text, sigX, labelY + 10.5);
            }
          }
          ctx.restore();
        });
      }

      // 5. DEMO MODE CUTOFF BARRIER & RESTRICTION NOTIFICATION
      if (isMpro2Demo && candles.length > 0) {
        const cutoffX = getXFromIndex(demoCutoffIndex);

        // Draw vertical demo cutoff line if within chart canvas
        if (cutoffX > 0 && cutoffX < chartWidth) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cutoffX, 0);
          ctx.lineTo(cutoffX, chartHeight);
          ctx.stroke();

          // Cutoff Padlock Badge at the top of the divider
          ctx.setLineDash([]);
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          const barrierText = '🔒 MPRO2 DEMO CUTOFF: HISTORICAL CHARTS ONLY (300+ RECENT CANDLES LOCKED)';
          const bTw = ctx.measureText(barrierText).width + 14;
          const bTh = 20;
          const bY = 24;

          ctx.fillStyle = isDark ? 'rgba(30, 20, 5, 0.94)' : 'rgba(254, 243, 199, 0.96)';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(cutoffX - bTw / 2, bY, bTw, bTh, 4);
          } else {
            ctx.rect(cutoffX - bTw / 2, bY, bTw, bTh);
          }
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
          ctx.fillText(barrierText, cutoffX, bY + 13.5);
        }
      }

      // 6. Render Screen Texts Status Table HUD
      const showStatusTable = settings.indicators.mpro2ShowStatusTable ?? true;
      if (showScreenTexts && showStatusTable && statusData) {
        const tableW = 185;
        const rowH = 18;
        const totalRows = 6;
        const tableH = 26 + (totalRows * rowH) + 6;
        const tablePos = settings.indicators.mpro2TablePosition || 'Top Right';
        
        let tableX = chartWidth - tableW - 12;
        let tableY = 40;
        if (tablePos === 'Top Left') {
          tableX = 12;
          tableY = 40;
        } else if (tablePos === 'Bottom Right') {
          tableX = chartWidth - tableW - 12;
          tableY = chartHeight - tableH - 30;
        } else if (tablePos === 'Bottom Left') {
          tableX = 12;
          tableY = chartHeight - tableH - 30;
        }

        ctx.save();
        // Glassmorphic background
        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(tableX, tableY, tableW, tableH, 6);
        } else {
          ctx.rect(tableX, tableY, tableW, tableH);
        }
        ctx.fill();

        ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Table Header
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#3b82f6';
        ctx.textAlign = 'left';
        ctx.fillText('◆ Mpro2 Signal', tableX + 8, tableY + 16);

        // Tier badge in top right of table
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'right';
        if (isMpro2Pro) {
          ctx.fillStyle = '#22c55e';
          ctx.fillText('PRO ✓', tableX + tableW - 8, tableY + 16);
        } else if (mpro2AccessMode === 'demo') {
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('DEMO', tableX + tableW - 8, tableY + 16);
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.fillText('LOCKED', tableX + tableW - 8, tableY + 16);
        }

        // Header Divider
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX + 6, tableY + 24);
        ctx.lineTo(tableX + tableW - 6, tableY + 24);
        ctx.stroke();

        // Rows Data Helper
        let curY = tableY + 38;
        const drawTableRow = (label: string, value: string, valCol?: string) => {
          ctx.font = '9px monospace';
          ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)';
          ctx.textAlign = 'left';
          ctx.fillText(label, tableX + 8, curY);

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = valCol || (isDark ? '#f8fafc' : '#0f172a');
          ctx.textAlign = 'right';
          ctx.fillText(value, tableX + tableW - 8, curY);
          curY += rowH;
        };

        const tierLabel = isMpro2Pro ? 'PRO ACTIVE' : mpro2AccessMode === 'demo' ? 'DEMO (PAST)' : 'KEY REQ';
        const tierCol = isMpro2Pro ? '#22c55e' : mpro2AccessMode === 'demo' ? '#f59e0b' : '#ef4444';
        drawTableRow('License Tier', tierLabel, tierCol);

        const trendLabel = statusData.trend === 'Bullish' ? 'Bullish ▲' : 'Bearish ▼';
        const trendCol = statusData.trend === 'Bullish' ? bullCol : bearCol;
        drawTableRow('Trend', trendLabel, trendCol);
        const isWeekly = (settings.indicators.mpro2RangeMode ?? 'WeeklyAnchor') === 'WeeklyAnchor';
        drawTableRow(isWeekly ? 'Weekly High (PWH)' : 'Chart High (Upper)', statusData.swingHigh.toFixed(decimals));
        drawTableRow(isWeekly ? 'Weekly Low (PWL)' : 'Chart Low (Lower)', statusData.swingLow.toFixed(decimals));
        const nearestVal = statusData.nearestLevelRatio !== null && statusData.nearestLevelPrice !== null
          ? `${statusData.nearestLevelRatio.toFixed(3)} (${statusData.nearestLevelPrice.toFixed(decimals)})`
          : 'N/A';
        drawTableRow('Nearest Level', nearestVal);
        const strongestVal = statusData.strongestLevelRatio !== null
          ? `${statusData.strongestLevelRatio.toFixed(3)} (${statusData.strongestTouchCount}x)`
          : 'N/A';
        drawTableRow('Strongest Level', strongestVal, '#f59e0b');
        if (isWeekly && weeklyAnchor) {
          drawTableRow('Range Mode', 'Weekly Anchor 🔒');
          drawTableRow('Weekly Stage', weeklyAnchor.stageTitle, weeklyAnchor.currentStage === 'RETEST_ACTIVE' ? '#22c55e' : '#38bdf8');
        } else {
          drawTableRow('Range Mode', (settings.indicators.mpro2RangeMode ?? 'WeeklyAnchor') === 'AllChart' ? `All Chart (${candles.length}b)` : `Lookback (${statusData.periodUsed}b)`);
        }

        ctx.restore();
      }

      // 7. Watermark Badge at bottom
      if (showScreenTexts) {
        ctx.save();
        ctx.font = 'bold 10px monospace';
        const wmStatus = isMpro2Pro ? 'PRO ACTIVE' : mpro2AccessMode === 'demo' ? 'DEMO MODE (PAST ONLY)' : 'PRO REQUIRED';
        const wmText = `◆ Mpro2 Signal [${wmStatus}]`;
        const wmW = ctx.measureText(wmText).width + 16;
        const wmH = 18;
        const wmX = (chartWidth - wmW) / 2;
        const wmY = chartHeight - 24;

        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(wmX, wmY, wmW, wmH, 4);
        } else {
          ctx.rect(wmX, wmY, wmW, wmH);
        }
        ctx.fill();

        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(wmText, chartWidth / 2, wmY + 12.5);
        ctx.restore();
      }

      ctx.restore();
    }

    // ==========================================
    // 3I. Render HVN Profile (ATAS Market Profile by ProfitPro)
    // ==========================================
    if (hvnResults && (settings.indicators.showHvnProfile ?? true)) {
      ctx.save();
      const decimals = activeSymbolSpec.decimals || 2;
      const zoneCol = settings.indicators.hvnZoneColor ?? '#f59e0b';
      const borderCol = settings.indicators.hvnZoneBorderColor ?? '#d97706';
      const pocLineCol = settings.indicators.hvnPocLineColor ?? '#fbbf24';
      const profileCol = settings.indicators.hvnProfileColor ?? '#1e3a8a';
      const showSilhouette = settings.indicators.hvnShowSilhouette ?? true;
      const showLabels = settings.indicators.hvnShowLabels ?? true;

      // 1. Draw Volume Profile Silhouettes behind candles for each period segment
      if (showSilhouette) {
        hvnResults.segments.forEach((seg) => {
          const segStartX = getXFromIndex(seg.startBarIndex);
          const segEndX = getXFromIndex(seg.endBarIndex);
          const segWidth = Math.max(20, Math.abs(segEndX - segStartX));
          const maxProfileWidth = Math.min(180, Math.max(35, segWidth * 0.45));

          // Draw dark smooth curved volume profile silhouette
          ctx.save();
          ctx.beginPath();
          const leftX = segStartX;
          ctx.moveTo(leftX, getYFromPrice(seg.minPrice));

          // Build stepped/curved silhouette path along right edge of profile
          seg.bins.forEach((bin) => {
            const yTop = getYFromPrice(bin.priceHigh);
            const yBot = getYFromPrice(bin.priceLow);
            const yMid = (yTop + yBot) / 2;
            const barW = (bin.volume / seg.maxBinVolume) * maxProfileWidth;
            ctx.lineTo(leftX + barW, yMid);
          });

          ctx.lineTo(leftX, getYFromPrice(seg.maxPrice));
          ctx.closePath();

          // Fill with rich dark navy/slate translucent silhouette (ATAS style)
          ctx.fillStyle = hexToRgba(profileCol, 0.35);
          ctx.fill();

          // Outline with subtle glowing border
          ctx.strokeStyle = hexToRgba(profileCol, 0.65);
          ctx.lineWidth = 1;
          ctx.stroke();

          // Highlight Value Area (VAH to VAL) with slight accent
          const vahY = getYFromPrice(seg.vahPrice);
          const valY = getYFromPrice(seg.valPrice);
          const vaHeight = Math.abs(valY - vahY);
          const vaTop = Math.min(vahY, valY);

          ctx.fillStyle = hexToRgba(profileCol, 0.15);
          ctx.fillRect(leftX, vaTop, maxProfileWidth * 0.7, vaHeight);

          // Mark segment start with a subtle, very faint vertical divider line (ATAS period separator)
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(leftX, 0);
          ctx.lineTo(leftX, chartHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.restore();
        });
      }

      // 2. Draw High Volume Node (HVN) Amber / Gold Reaction Zones
      hvnResults.allZones.forEach((zone) => {
        const topY = getYFromPrice(zone.priceTop);
        const botY = getYFromPrice(zone.priceBottom);
        const centerY = getYFromPrice(zone.price);
        const zoneY = Math.min(topY, botY);
        const zoneHeight = Math.max(3, Math.abs(botY - topY));

        const startX = getXFromIndex(zone.startBarIndex);
        const isLive = zone.endBarIndex >= candles.length - 1;
        // If unmitigated and live, project all the way into right active price edge!
        const endX = isLive ? chartWidth : getXFromIndex(zone.endBarIndex);

        if (endX <= startX) return;

        ctx.save();

        // Amber/Gold glowing translucent zone fill
        const fillGradient = ctx.createLinearGradient(startX, 0, endX, 0);
        fillGradient.addColorStop(0, hexToRgba(zoneCol, 0.28));
        fillGradient.addColorStop(isLive ? 0.7 : 1, hexToRgba(zoneCol, 0.22));
        if (isLive) {
          fillGradient.addColorStop(1, hexToRgba(zoneCol, 0.12));
        }

        ctx.fillStyle = fillGradient;
        ctx.fillRect(startX, zoneY, endX - startX, zoneHeight);

        // Top & Bottom crisp Amber boundary lines
        ctx.strokeStyle = hexToRgba(borderCol, 0.85);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(startX, zoneY);
        ctx.lineTo(endX, zoneY);
        ctx.moveTo(startX, zoneY + zoneHeight);
        ctx.lineTo(endX, zoneY + zoneHeight);
        ctx.stroke();

        // Central High Volume POC golden line
        ctx.strokeStyle = pocLineCol;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX, centerY);
        ctx.lineTo(endX, centerY);
        ctx.stroke();

        // Mitigation termination marker (if mitigated in the past)
        if (zone.isMitigated && zone.mitigatedBarIndex !== null) {
          const mitX = getXFromIndex(zone.mitigatedBarIndex);
          ctx.strokeStyle = hexToRgba(borderCol, 0.9);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(mitX, zoneY - 2);
          ctx.lineTo(mitX, zoneY + zoneHeight + 2);
          ctx.stroke();
        }

        // Screen Labels & Price Badges (ATAS pill style at right edge)
        if (showLabels && isLive) {
          const badgeText = `${zone.isPoc ? 'POC' : 'HVN'} ${zone.price.toFixed(decimals)}`;
          ctx.font = 'bold 9px monospace';
          const textMetrics = ctx.measureText(badgeText);
          const badgeW = textMetrics.width + 10;
          const badgeH = 16;
          const badgeX = Math.min(chartWidth - badgeW - 6, endX - badgeW);
          const badgeY = centerY - badgeH / 2;

          ctx.fillStyle = isDark ? 'rgba(24, 18, 10, 0.90)' : 'rgba(255, 250, 240, 0.92)';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
          } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.fill();

          ctx.strokeStyle = hexToRgba(borderCol, 0.9);
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = pocLineCol;
          ctx.textAlign = 'left';
          ctx.fillText(badgeText, badgeX + 5, badgeY + 11.5);
        }

        ctx.restore();
      });

      ctx.restore();
    }

    // ==========================================
    // 3J. Render Nexus: Smart Money Suite [BullByte]
    // ==========================================
    if (nexusResults && (settings.indicators.showNexusSuite ?? true)) {
      ctx.save();
      const decimals = candles.length > 0 ? Math.min(5, Math.max(2, (candles[candles.length - 1].close.toString().split('.')[1]?.length || 2))) : 2;

      // 1. SESSIONS & KILL ZONES (Asia, London LDN KZ, New York NY KZ)
      if (settings.indicators.nexusShowSessions ?? true) {
        nexusResults.sessions.forEach((sess) => {
          if (sess.endIndex < start || sess.startIndex > end) return;
          const x1 = Math.max(0, getXFromIndex(sess.startIndex));
          const x2 = Math.min(chartWidth, getXFromIndex(sess.endIndex));
          const w = Math.max(2, x2 - x1);

          const yTop = getYFromPrice(sess.high);
          const yBot = getYFromPrice(sess.low);
          const h = Math.max(4, Math.abs(yBot - yTop));
          const boxY = Math.min(yTop, yBot);

          let fillCol = 'rgba(148, 163, 184, 0.04)';
          let borderCol = 'rgba(148, 163, 184, 0.15)';
          let tagCol = '#94a3b8';

          if (sess.name === 'Asia') {
            fillCol = 'rgba(168, 85, 247, 0.05)';
            borderCol = 'rgba(168, 85, 247, 0.25)';
            tagCol = '#c084fc';
          } else if (sess.name === 'London') {
            fillCol = 'rgba(56, 189, 248, 0.05)';
            borderCol = 'rgba(56, 189, 248, 0.25)';
            tagCol = '#38bdf8';
          } else if (sess.name === 'New York') {
            fillCol = 'rgba(245, 158, 11, 0.05)';
            borderCol = 'rgba(245, 158, 11, 0.25)';
            tagCol = '#fbbf24';
          }

          if (sess.isKillZone) {
            fillCol = sess.name === 'London' ? 'rgba(56, 189, 248, 0.10)' : 'rgba(245, 158, 11, 0.10)';
            borderCol = sess.name === 'London' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(245, 158, 11, 0.45)';
          }

          ctx.fillStyle = fillCol;
          ctx.fillRect(x1, boxY, w, h);
          ctx.strokeStyle = borderCol;
          ctx.lineWidth = 1;
          ctx.setLineDash(sess.isKillZone ? [4, 2] : [2, 2]);
          ctx.strokeRect(x1, boxY, w, h);
          ctx.setLineDash([]);

          // Session open line
          const yOpen = getYFromPrice(sess.openPrice);
          ctx.strokeStyle = borderCol;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x1, yOpen);
          ctx.lineTo(x2, yOpen);
          ctx.stroke();
          ctx.setLineDash([]);

          // Session tag
          const label = sess.killZoneName ? `${sess.name.toUpperCase()} (${sess.killZoneName})` : sess.name.toUpperCase();
          ctx.font = 'bold 8.5px monospace';
          ctx.fillStyle = tagCol;
          ctx.textAlign = 'left';
          ctx.fillText(label, x1 + 4, boxY + 10);
        });
      }

      // 2. PREMIUM / DISCOUNT / EQUILIBRIUM
      if (settings.indicators.nexusShowPremiumDiscount ?? true) {
        const pHighY = getYFromPrice(nexusResults.premiumHigh);
        const dLowY = getYFromPrice(nexusResults.discountLow);
        const eqY = getYFromPrice(nexusResults.equilibriumPrice);

        const totalH = Math.abs(dLowY - pHighY);
        if (totalH > 15) {
          const topBoxY = Math.min(pHighY, dLowY);
          const premH = totalH * 0.25;
          const discH = totalH * 0.25;
          const discBoxY = topBoxY + totalH * 0.75;

          // Premium Zone (Top 25%)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
          ctx.fillRect(0, topBoxY, chartWidth, premH);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, topBoxY + premH);
          ctx.lineTo(chartWidth, topBoxY + premH);
          ctx.stroke();

          // Premium Badge
          ctx.font = 'bold 8.5px monospace';
          ctx.fillStyle = '#ef4444';
          ctx.textAlign = 'right';
          ctx.fillText('PREMIUM [0.75-1.00]', chartWidth - 10, topBoxY + 11);

          // Discount Zone (Bottom 25%)
          ctx.fillStyle = 'rgba(34, 197, 94, 0.06)';
          ctx.fillRect(0, discBoxY, chartWidth, discH);
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, discBoxY);
          ctx.lineTo(chartWidth, discBoxY);
          ctx.stroke();

          // Discount Badge
          ctx.font = 'bold 8.5px monospace';
          ctx.fillStyle = '#22c55e';
          ctx.textAlign = 'right';
          ctx.fillText('DISCOUNT [0.00-0.25]', chartWidth - 10, discBoxY + discH - 4);

          // Equilibrium Line (50% midpoint)
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, eqY);
          ctx.lineTo(chartWidth, eqY);
          ctx.stroke();
          ctx.setLineDash([]);

          // EQ Tag
          ctx.fillStyle = '#f59e0b';
          ctx.textAlign = 'right';
          ctx.fillText(`EQ 0.500 · ${nexusResults.equilibriumPrice.toFixed(decimals)}`, chartWidth - 10, eqY - 3);
        }
      }

      // 3. ORDER BLOCKS & BREAKER BLOCKS
      if (settings.indicators.nexusShowOrderBlocks ?? true) {
        nexusResults.orderBlocks.forEach((ob) => {
          const showBreaker = settings.indicators.nexusShowBreakerBlocks ?? true;
          if (ob.isBreaker && !showBreaker) return;

          const startX = getXFromIndex(ob.originIndex);
          const endBar = ob.isMitigated ? (ob.mitigatedIndex ?? candles.length - 1) : candles.length + 15;
          const endX = Math.min(chartWidth + 30, getXFromIndex(endBar));
          const width = Math.max(10, endX - startX);

          const yTop = getYFromPrice(ob.topPrice);
          const yBot = getYFromPrice(ob.bottomPrice);
          const h = Math.max(3, Math.abs(yBot - yTop));
          const boxY = Math.min(yTop, yBot);

          const isBull = ob.type === 'BULLISH';
          const baseCol = isBull ? '#10b981' : '#f43f5e';

          if (ob.isBreaker) {
            ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)';
            ctx.fillRect(startX, boxY, width, h);
            ctx.strokeStyle = baseCol;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.strokeRect(startX, boxY, width, h);
            ctx.setLineDash([]);

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = baseCol;
            ctx.textAlign = 'left';
            ctx.fillText(`BRK MIT · ${ob.score}★`, startX + 4, boxY + 9);
          } else if (ob.isMitigated) {
            ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.06)' : 'rgba(244, 63, 94, 0.06)';
            ctx.fillRect(startX, boxY, width, h);
            ctx.strokeStyle = isBull ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(startX, boxY, width, h);
            ctx.setLineDash([]);

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.7)' : 'rgba(244, 63, 94, 0.7)';
            ctx.textAlign = 'left';
            ctx.fillText(`MITIGATED [${ob.score}★]`, startX + 4, boxY + 9);
          } else {
            ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.16)' : 'rgba(244, 63, 94, 0.16)';
            ctx.fillRect(startX, boxY, width, h);
            ctx.strokeStyle = baseCol;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([]);
            ctx.strokeRect(startX, boxY, width, h);

            ctx.font = 'bold 8.5px monospace';
            ctx.fillStyle = isBull ? '#34d399' : '#fb7185';
            ctx.textAlign = 'left';
            const stars = '★'.repeat(ob.score);
            ctx.fillText(`${isBull ? 'BULL OB' : 'BEAR OB'} [${stars}]`, startX + 4, boxY + 10);
          }
        });
      }

      // 4. FAIR VALUE GAPS (FVG) & INVERTED FVGs (iFVG)
      if (settings.indicators.nexusShowFVG ?? true) {
        nexusResults.fvgs.forEach((fvg) => {
          const showIFVG = settings.indicators.nexusShowInvertedFVG ?? true;
          if (fvg.isInverted && !showIFVG) return;

          const startX = getXFromIndex(fvg.candleIndex);
          const endBar = fvg.isFilled ? (fvg.filledIndex ?? candles.length - 1) : candles.length + 15;
          const endX = Math.min(chartWidth + 30, getXFromIndex(endBar));
          const width = Math.max(10, endX - startX);

          const yTop = getYFromPrice(fvg.topPrice);
          const yBot = getYFromPrice(fvg.bottomPrice);
          const h = Math.max(2, Math.abs(yBot - yTop));
          const boxY = Math.min(yTop, yBot);

          const isBull = fvg.type === 'BULLISH';

          if (fvg.isInverted) {
            ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
            ctx.fillRect(startX, boxY, width, h);
            ctx.strokeStyle = isBull ? '#34d399' : '#f87171';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(startX, boxY, width, h);
            ctx.setLineDash([]);

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = isBull ? '#34d399' : '#f87171';
            ctx.textAlign = 'left';
            ctx.fillText('iFVG', startX + 4, boxY + 8);
          } else if (fvg.isFilled) {
            ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)';
            ctx.fillRect(startX, boxY, width, h);
            ctx.strokeStyle = isBull ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(startX, boxY, width, h);
            ctx.setLineDash([]);
          } else {
            ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)';
            ctx.fillRect(startX, boxY, width, h);
            ctx.strokeStyle = isBull ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(startX, boxY, width, h);

            // 50% Consequent Encroachment (CE) Line
            const ceY = getYFromPrice(fvg.cePrice);
            ctx.strokeStyle = isBull ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(startX, ceY);
            ctx.lineTo(startX + width, ceY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = isBull ? '#34d399' : '#f87171';
            ctx.textAlign = 'left';
            ctx.fillText(fvg.isCeTouched ? 'FVG CE' : 'FVG', startX + 4, boxY + 8);
          }
        });
      }

      // 5. LIQUIDITY POOLS & SWEEPS (BSL / SSL)
      if (settings.indicators.nexusShowLiquidityPools ?? true) {
        nexusResults.liquidityPools.forEach((pool) => {
          const startX = getXFromIndex(pool.startIndex);
          const endBar = pool.isSwept ? (pool.sweptIndex ?? candles.length - 1) : candles.length + 15;
          const endX = Math.min(chartWidth + 30, getXFromIndex(endBar));
          const y = getYFromPrice(pool.price);

          const isBSL = pool.type === 'BSL';
          const lineCol = '#f59e0b';

          ctx.strokeStyle = lineCol;
          ctx.lineWidth = 1.3;
          ctx.setLineDash(pool.isSwept ? [3, 3] : []);
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'right';
          ctx.fillText(`${pool.type} x${pool.touchCount}`, endX - 4, y - 3);

          if (pool.isSwept && pool.sweptIndex !== undefined) {
            const sweepX = getXFromIndex(pool.sweptIndex);
            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.arc(sweepX, y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = '#c084fc';
            ctx.textAlign = 'center';
            ctx.fillText(`${pool.type} SWEPT`, sweepX, isBSL ? y - 8 : y + 12);
          }
        });

        // Additional detected sweeps
        nexusResults.sweeps.forEach((sw) => {
          const swX = getXFromIndex(sw.index);
          if (swX < -20 || swX > chartWidth + 20) return;
          const y = getYFromPrice(sw.price);
          const isBSL = sw.type === 'BSL';

          ctx.fillStyle = '#c084fc';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`⚡ ${sw.type} SWEEP`, swX, isBSL ? y - 10 : y + 14);
        });
      }

      // 6. DENSITY-WEIGHTED S/R WITH TOUCH GLOW
      if (settings.indicators.nexusShowSRGlow ?? true) {
        nexusResults.srLevels.forEach((sr) => {
          const y = getYFromPrice(sr.price);
          if (y < -20 || y > chartHeight + 20) return;

          const isSup = sr.type === 'SUPPORT';
          const col = isSup ? '#10b981' : '#ef4444';

          ctx.save();
          if (sr.glowIntensity > 0.4) {
            ctx.shadowColor = col;
            ctx.shadowBlur = sr.glowIntensity * 8;
          }

          ctx.strokeStyle = col;
          ctx.lineWidth = Math.min(3, Math.max(1, sr.lineWidth));
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(chartWidth, y);
          ctx.stroke();

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = col;
          ctx.textAlign = 'left';
          ctx.fillText(`${isSup ? 'S' : 'R'} x${sr.touchCount} · ${sr.price.toFixed(decimals)}`, 10, y - 3);
          ctx.restore();
        });
      }

      // 7. INSTITUTIONAL VWAP & BANDS
      if ((settings.indicators.nexusShowVWAP ?? true) && nexusResults.vwap) {
        const vwapY = getYFromPrice(nexusResults.vwap.vwap);
        const upY = getYFromPrice(nexusResults.vwap.upperBand1);
        const lowY = getYFromPrice(nexusResults.vwap.lowerBand1);

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, vwapY);
        ctx.lineTo(chartWidth, vwapY);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, upY);
        ctx.lineTo(chartWidth, upY);
        ctx.moveTo(0, lowY);
        ctx.lineTo(chartWidth, lowY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#06b6d4';
        ctx.textAlign = 'left';
        ctx.fillText('VWAP', chartWidth - 45, vwapY - 3);
      }

      // 8. KEY LEVELS (PDH, PDL, PDO, PWH, PWL)
      if (settings.indicators.nexusShowKeyLevels ?? true) {
        const kl = nexusResults.keyLevels;
        const renderKeyLevel = (price: number | null, label: string, color: string, isDashed: boolean = false) => {
          if (price === null) return;
          const y = getYFromPrice(price);
          if (y < 0 || y > chartHeight) return;

          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash(isDashed ? [4, 3] : []);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(chartWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = color;
          ctx.textAlign = 'left';
          ctx.fillText(`${label} · ${price.toFixed(decimals)}`, 60, y - 3);
        };

        renderKeyLevel(kl.pdh, 'PDH', '#f59e0b');
        renderKeyLevel(kl.pdl, 'PDL', '#f59e0b');
        renderKeyLevel(kl.pdo, 'PDO', '#94a3b8', true);
        renderKeyLevel(kl.pwh, 'PWH', '#38bdf8');
        renderKeyLevel(kl.pwl, 'PWL', '#38bdf8');
      }

      // 9. SMART TRENDLINES (Image 6: Active glow & extension, broken fades to gray with TL BREAK)
      if (settings.indicators.nexusShowTrendlines ?? true) {
        nexusResults.trendlines.forEach((tl) => {
          const p1Idx = tl.p1.index;
          const p2Idx = tl.p2.index;
          const deltaIdx = p2Idx - p1Idx;
          if (deltaIdx <= 0) return;

          const slope = (tl.p2.price - tl.p1.price) / deltaIdx;
          const isAsc = tl.type === 'ASCENDING';
          const lineCol = isAsc ? '#10b981' : '#ef4444';

          const x1 = getXFromIndex(p1Idx);
          const y1 = getYFromPrice(tl.p1.price);
          const xPivot2 = getXFromIndex(p2Idx);
          const yPivot2 = getYFromPrice(tl.p2.price);

          if (tl.isBroken) {
            // Broken trendline: extension stops at break candle and fades to gray
            const breakIdx = tl.breakIndex ?? tl.endIndex;
            const xBreak = getXFromIndex(breakIdx);
            const priceAtBreak = tl.p1.price + slope * (breakIdx - p1Idx);
            const yBreak = getYFromPrice(priceAtBreak);

            ctx.save();
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(xBreak, yBreak);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // TL BREAK badge at break point
            const badgeW = 54;
            const badgeH = 16;
            const bx = xBreak + 4;
            const by = yBreak - badgeH / 2;

            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(bx, by, badgeW, badgeH, 3);
            } else {
              ctx.rect(bx, by, badgeW, badgeH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 8.5px monospace';
            ctx.fillStyle = '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TL BREAK', bx + badgeW / 2, by + badgeH / 2);
          } else {
            // Active trendline: connects pivots, glows and extends forward
            const extIdx = Math.min(candles.length + 10, tl.endIndex + 10);
            const xExt = getXFromIndex(extIdx);
            const priceAtExt = tl.p1.price + slope * (extIdx - p1Idx);
            const yExt = getYFromPrice(priceAtExt);

            ctx.save();
            ctx.shadowColor = lineCol;
            ctx.shadowBlur = Math.min(14, tl.touchCount * 3 + 4);
            ctx.strokeStyle = lineCol;
            ctx.lineWidth = 1.5;

            // Anchor ray
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(xPivot2, yPivot2);
            ctx.stroke();

            // Projected extension ray (dashed)
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xPivot2, yPivot2);
            ctx.lineTo(xExt, yExt);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Pivot touch points (subtle dots)
            ctx.fillStyle = lineCol;
            ctx.beginPath();
            ctx.arc(x1, y1, 2.5, 0, Math.PI * 2);
            ctx.arc(xPivot2, yPivot2, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Active TL touch pill badge (e.g. TL x2, TL x3)
            const tlBadge = `TL x${tl.touchCount}`;
            const badgeW = 38;
            const badgeH = 15;
            const bx = xExt + 4;
            const by = yExt - badgeH / 2;

            ctx.save();
            ctx.shadowColor = lineCol;
            ctx.shadowBlur = 6;
            ctx.fillStyle = lineCol;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(bx, by, badgeW, badgeH, 3);
            } else {
              ctx.rect(bx, by, badgeW, badgeH);
            }
            ctx.fill();
            ctx.restore();

            ctx.font = 'bold 8.5px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tlBadge, bx + badgeW / 2, by + badgeH / 2);
          }
        });
      }

      // 10. MARKET STRUCTURE (Swings & Structure Breaks: BOS, CHoCH, SMS)
      if (settings.indicators.nexusShowMarketStructure ?? true) {
        // Swings
        nexusResults.swings.forEach((sw) => {
          if (sw.index < start - 2 || sw.index > end + 2) return;
          const x = getXFromIndex(sw.index);
          const y = getYFromPrice(sw.price);
          const isHigh = sw.type === 'HH' || sw.type === 'LH';

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = isHigh ? '#38bdf8' : '#f59e0b';
          ctx.textAlign = 'center';
          ctx.fillText(sw.type, x, isHigh ? y - 7 : y + 14);
        });

        // Structure Breaks
        nexusResults.structureBreaks.forEach((sb) => {
          const x1 = getXFromIndex(sb.startIndex);
          const x2 = getXFromIndex(sb.breakIndex);
          const y = getYFromPrice(sb.breakPrice);

          const isBull = sb.direction === 'BULLISH';
          const breakCol = isBull ? '#0ea5e9' : '#f97316';

          ctx.strokeStyle = breakCol;
          ctx.lineWidth = sb.type === 'BOS' ? 1.5 : 1.2;
          ctx.setLineDash(sb.type === 'BOS' ? [] : sb.type === 'CHoCH' ? [4, 3] : [2, 2]);
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
          ctx.setLineDash([]);

          const midX = (x1 + x2) / 2;
          const pillText = sb.type;
          ctx.font = 'bold 8px monospace';
          const tw = ctx.measureText(pillText).width;
          const pillW = tw + 8;
          const pillH = 12;

          ctx.fillStyle = isBull ? 'rgba(14, 165, 233, 0.95)' : 'rgba(249, 115, 22, 0.95)';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(midX - pillW / 2, y - pillH / 2, pillW, pillH, 2);
          } else {
            ctx.rect(midX - pillW / 2, y - pillH / 2, pillW, pillH);
          }
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(pillText, midX, y + 3);
        });
      }

      // 11. SIGNALS & ACTIVE TRADE TARGETS
      const showNexusSignals = settings.indicators.nexusShowSignals ?? true;
      if (showNexusSignals) {
        nexusResults.signals.forEach((sig) => {
        if (sig.barIndex < start - 2 || sig.barIndex > end + 2) return;
        const x = getXFromIndex(sig.barIndex);
        const y = getYFromPrice(sig.price);
        const isLong = sig.type === 'LONG';
        const is4HTimeframe = timeframe === '4H';

        if (is4HTimeframe) {
          // On 4H: show full "LONG / SHORT" text badge
          const arrowY = isLong ? y + 18 : y - 18;
          const badgeText = `${sig.type} ${sig.grade} [${sig.score}]`;

          ctx.font = 'bold 9px monospace';
          const tw = ctx.measureText(badgeText).width;
          const bW = tw + 10;
          const bH = 16;
          const bY = isLong ? arrowY + 6 : arrowY - bH - 6;

          ctx.fillStyle = isLong
            ? (sig.grade === 'A+' ? 'rgba(5, 150, 105, 0.96)' : 'rgba(16, 185, 129, 0.90)')
            : (sig.grade === 'A+' ? 'rgba(225, 29, 72, 0.96)' : 'rgba(239, 68, 68, 0.90)');
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x - bW / 2, bY, bW, bH, 3);
          } else {
            ctx.rect(x - bW / 2, bY, bW, bH);
          }
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(badgeText, x, bY + 11);
        } else {
          // Below 4H (1H, 30m, 15m, 5m): Show clean GREEN (LONG) and RED (SHORT) Arrow!
          const c = candles[sig.barIndex];
          const candleLowY = c ? getYFromPrice(c.low) : y;
          const candleHighY = c ? getYFromPrice(c.high) : y;

          ctx.save();
          if (isLong) {
            // GREEN UP ARROW below candle low
            const tipY = candleLowY + 5;
            const arrowHeadW = 12;
            const arrowHeadH = 8;
            const stemW = 4;
            const stemH = 8;

            ctx.shadowColor = 'rgba(34, 197, 94, 0.6)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#22c55e';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(x, tipY);
            ctx.lineTo(x + arrowHeadW / 2, tipY + arrowHeadH);
            ctx.lineTo(x + stemW / 2, tipY + arrowHeadH);
            ctx.lineTo(x + stemW / 2, tipY + arrowHeadH + stemH);
            ctx.lineTo(x - stemW / 2, tipY + arrowHeadH + stemH);
            ctx.lineTo(x - stemW / 2, tipY + arrowHeadH);
            ctx.lineTo(x - arrowHeadW / 2, tipY + arrowHeadH);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            // RED DOWN ARROW above candle high
            const tipY = candleHighY - 5;
            const arrowHeadW = 12;
            const arrowHeadH = 8;
            const stemW = 4;
            const stemH = 8;

            ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#ef4444';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(x, tipY);
            ctx.lineTo(x + arrowHeadW / 2, tipY - arrowHeadH);
            ctx.lineTo(x + stemW / 2, tipY - arrowHeadH);
            ctx.lineTo(x + stemW / 2, tipY - arrowHeadH - stemH);
            ctx.lineTo(x - stemW / 2, tipY - arrowHeadH - stemH);
            ctx.lineTo(x - stemW / 2, tipY - arrowHeadH);
            ctx.lineTo(x - arrowHeadW / 2, tipY - arrowHeadH);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }

        if (nexusResults.activeTrade && nexusResults.activeTrade.id === sig.id) {
          const t = nexusResults.activeTrade;
          const endTradeX = Math.min(chartWidth, getXFromIndex(candles.length + 10));

          // SL Line
          const slY = getYFromPrice(t.stopLoss);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x, slY);
          ctx.lineTo(endTradeX, slY);
          ctx.stroke();
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#ef4444';
          ctx.textAlign = 'left';
          ctx.fillText(`SL: ${t.stopLoss.toFixed(decimals)}`, endTradeX - 60, slY - 3);

          // TP1 Line
          const tp1Y = getYFromPrice(t.tp1);
          ctx.strokeStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(x, tp1Y);
          ctx.lineTo(endTradeX, tp1Y);
          ctx.stroke();
          ctx.fillStyle = '#22c55e';
          ctx.fillText(`TP1 (${t.tp1Hit ? 'HIT' : '1:1.5'}): ${t.tp1.toFixed(decimals)}`, endTradeX - 90, tp1Y - 3);

          // TP2 Line
          const tp2Y = getYFromPrice(t.tp2);
          ctx.beginPath();
          ctx.moveTo(x, tp2Y);
          ctx.lineTo(endTradeX, tp2Y);
          ctx.stroke();
          ctx.fillText(`TP2 (${t.tp2Hit ? 'HIT' : '1:2.5'}): ${t.tp2.toFixed(decimals)}`, endTradeX - 90, tp2Y - 3);

          // TP3 Line
          const tp3Y = getYFromPrice(t.tp3);
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x, tp3Y);
          ctx.lineTo(endTradeX, tp3Y);
          ctx.stroke();
          ctx.fillText(`TP3 (${t.tp3Hit ? 'HIT' : '1:4.0'}): ${t.tp3.toFixed(decimals)}`, endTradeX - 90, tp3Y - 3);
        }
      });
      }

      ctx.restore();
    }

    // ==========================================
    // 3K. Render Order Blocks with Volume Delta (cTrader Store / Pepperstone Specification)
    // ==========================================
    if (orderBlocksWithVolumeResult && (settings.indicators.showOrderBlocksWithVolume ?? true)) {
      ctx.save();
      const zones = orderBlocksWithVolumeResult.zones;
      const bullishColor = settings.indicators.obvBullishColor ?? '#2e7d32';
      const bearishColor = settings.indicators.obvBearishColor ?? '#881337';
      const totalVolColor = settings.indicators.obvTotalVolColor ?? '#00aaff';
      const deltaTextColor = settings.indicators.obvDeltaTextColor ?? '#ffffff';
      const enableVolumeDelta = settings.indicators.obvEnableVolumeDelta ?? true;
      const displayTotalVolume = settings.indicators.obvDisplayTotalVolume ?? true;
      const showDeltaPercent = settings.indicators.obvShowDeltaPercent ?? true;
      const extendZonesCount = settings.indicators.obvExtendZones ?? 10;

      zones.forEach((zone) => {
        const startX = getXFromIndex(zone.startBarIndex);
        const isLive = !zone.isInvalidated;
        const endBar = isLive
          ? Math.max(zone.endBarIndex, candles.length - 1 + extendZonesCount)
          : (zone.invalidatedBarIndex ?? zone.endBarIndex);
        const endX = getXFromIndex(endBar);

        // Visibility checks
        if (endX < 0 || startX > chartWidth) return;
        const boxW = Math.max(4, endX - startX);

        const topY = getYFromPrice(zone.topPrice);
        const botY = getYFromPrice(zone.bottomPrice);
        const boxY = Math.min(topY, botY);
        const boxH = Math.max(10, Math.abs(botY - topY));

        ctx.save();

        if (enableVolumeDelta) {
          // Horizontal proportional division: Left (Buy Delta %) & Right (Sell Delta %)
          const buyRatio = zone.buyPct / 100;
          const buyW = Math.max(1, boxW * buyRatio);
          const sellW = Math.max(1, boxW - buyW);

          // 1. Buy Delta Block (Bullish Green)
          ctx.fillStyle = hexToRgba(bullishColor, 0.85);
          ctx.fillRect(startX, boxY, buyW, boxH);

          // 2. Sell Delta Block (Bearish Red)
          ctx.fillStyle = hexToRgba(bearishColor, 0.85);
          ctx.fillRect(startX + buyW, boxY, sellW, boxH);

          // 3. Central Partition Line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX + buyW, boxY);
          ctx.lineTo(startX + buyW, boxY + boxH);
          ctx.stroke();

          // 4. Outer Boundary Stroke
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(startX, boxY, boxW, boxH);

          // 5. Delta % Centered Labels inside segments
          if (showDeltaPercent && boxH >= 11) {
            ctx.fillStyle = deltaTextColor;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const centerY = boxY + boxH / 2;

            if (buyW >= 24) {
              ctx.fillText(`${zone.buyPct}%`, startX + buyW / 2, centerY);
            }
            if (sellW >= 24) {
              ctx.fillText(`${zone.sellPct}%`, startX + buyW + sellW / 2, centerY);
            }
          }
        } else {
          // Single uniform fill
          const baseCol = zone.type === 'bullish' ? bullishColor : bearishColor;
          ctx.fillStyle = hexToRgba(baseCol, 0.85);
          ctx.fillRect(startX, boxY, boxW, boxH);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(startX, boxY, boxW, boxH);
        }

        // 6. Outside Right Institutional Total Volume Label (cTrader Cyan text)
        if (displayTotalVolume && isLive) {
          const volText = formatOrderBlockVolume(zone.totalVolume);
          ctx.fillStyle = totalVolColor;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(volText, endX + 6, boxY + boxH / 2);
        }

        // 7. Subtle 50% Mean Equilibrium Dotted Line
        const midY = getYFromPrice(zone.midPrice);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, midY);
        ctx.lineTo(endX, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
      });

      ctx.restore();
    }

    // ==========================================
    // 3L. Render PRO Institutional Order Blocks (Live 8-Factor Strength & Shadow Engine)
    // ==========================================
    if (proOrderBlocksResult && (settings.indicators.showProOrderBlocks ?? true)) {
      ctx.save();
      const blocks = proOrderBlocksResult.orderBlocks;
      const bullColor = settings.indicators.proObBullishColor ?? '#10b981';
      const bearColor = settings.indicators.proObBearishColor ?? '#f43f5e';
      const showShadow = settings.indicators.proObShowShadow ?? true;
      const shadowOpacity = (settings.indicators.proObShadowOpacity ?? 25) / 100;
      const showScore = settings.indicators.proObShowScore ?? true;
      const showStrength = settings.indicators.proObShowStrengthPercent ?? true;

      blocks.forEach((ob) => {
        const startX = getXFromIndex(ob.originIndex);
        const endX = getXFromIndex(ob.endBarIndex);
        if (endX < 0 || startX > chartWidth) return;

        const originW = Math.max(8, candleWidth);
        const shadowW = Math.max(14, endX - startX);
        const topY = getYFromPrice(ob.topPrice);
        const botY = getYFromPrice(ob.bottomPrice);
        const boxY = Math.min(topY, botY);
        const boxH = Math.max(12, Math.abs(botY - topY));

        const isBull = ob.type === 'BULLISH';
        const baseColor = isBull ? bullColor : bearColor;

        ctx.save();

        // 1. Render Forward Shadow Projection
        if (showShadow) {
          const shadowGrad = ctx.createLinearGradient(startX, 0, endX, 0);
          shadowGrad.addColorStop(0, hexToRgba(baseColor, shadowOpacity * 1.35));
          shadowGrad.addColorStop(0.65, hexToRgba(baseColor, shadowOpacity * 0.9));
          shadowGrad.addColorStop(1, hexToRgba(baseColor, shadowOpacity * 0.25));

          ctx.fillStyle = shadowGrad;
          ctx.fillRect(startX, boxY, shadowW, boxH);

          // Shadow rail boundary lines (Top & Bottom)
          ctx.strokeStyle = hexToRgba(baseColor, ob.isMitigated ? 0.35 : 0.65);
          ctx.lineWidth = 1;
          ctx.setLineDash(ob.isMitigated ? [4, 4] : [5, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, boxY);
          ctx.lineTo(endX, boxY);
          ctx.moveTo(startX, boxY + boxH);
          ctx.lineTo(endX, boxY + boxH);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 2. Render Origin Order Block Box
        ctx.fillStyle = hexToRgba(baseColor, 0.45);
        ctx.fillRect(startX, boxY, originW, boxH);
        ctx.strokeStyle = hexToRgba(baseColor, 0.95);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(startX, boxY, originW, boxH);

        // 3. Subtle 50% Equilibrium Dotted Midline
        const midY = getYFromPrice(ob.midPrice);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, midY);
        ctx.lineTo(endX, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 4. Render Strength from 100 & Score [1-8] inside Shadow
        let textParts: string[] = [];
        if (ob.isLive) {
          textParts.push('● LIVE');
        }
        textParts.push(isBull ? 'BULL OB' : 'BEAR OB');

        if (showScore) {
          textParts.push(`[${ob.score}/8]`);
        }
        if (showStrength) {
          textParts.push(`• ${ob.strength}%`);
        }
        if (ob.isMitigated) {
          textParts.push('(MIT)');
        }

        const labelText = textParts.join(' ');
        ctx.font = 'bold 10px monospace';
        const textWidth = ctx.measureText(labelText).width;
        const centerY = boxY + boxH / 2;

        // Draw pill inside shadow near origin
        if (shadowW >= textWidth + 20) {
          const pillX = startX + originW + 4;
          const pillY = centerY - 8;
          const pillH = 16;
          const pillW = textWidth + 12;

          ctx.fillStyle = 'rgba(10, 15, 25, 0.88)';
          ctx.fillRect(pillX, pillY, pillW, pillH);
          ctx.strokeStyle = hexToRgba(baseColor, 0.7);
          ctx.lineWidth = 1;
          ctx.strokeRect(pillX, pillY, pillW, pillH);

          ctx.fillStyle = isBull ? '#34d399' : '#fb7185';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pillX + pillW / 2, centerY);
        }

        // Also draw live forward edge tag if shadow extends forward past live candles
        if (showShadow && endX > chartWidth - 180 && !ob.isMitigated) {
          const liveTagX = Math.min(chartWidth - 70, endX - 8);
          const liveTagText = `${ob.strength}%`;
          ctx.fillStyle = hexToRgba(baseColor, 0.95);
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(liveTagText, liveTagX, centerY);
        }

        ctx.restore();
      });

      ctx.restore();
    }

    // 4. Draw Drawings (Trend Lines, Horizontal Lines, Risk/Reward)
    (drawings || []).forEach((drawing) => {
      if (!drawing || !Array.isArray(drawing.points) || drawing.points.length === 0) return;
      const isSelected = drawing.id === selectedDrawingId;
      ctx.lineWidth = isSelected ? (drawing.lineWidth || 1) + 1 : (drawing.lineWidth || 1);
      ctx.strokeStyle = drawing.color || '#3b82f6';

      if (drawing.type === 'trend' && drawing.points.length >= 2) {
        const p1 = getCanvasCoords(drawing.points[0]);
        const p2 = getCanvasCoords(drawing.points[1]);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        if (isSelected) {
          drawHandle(ctx, p1.x, p1.y, drawing.color);
          drawHandle(ctx, p2.x, p2.y, drawing.color);
        }
      } else if (drawing.type === 'arrow' && drawing.points.length >= 2) {
        const p1 = getCanvasCoords(drawing.points[0]);
        const p2 = getCanvasCoords(drawing.points[1]);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Draw Arrowhead at p2
        const headLength = 12;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        ctx.fillStyle = drawing.color;
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle - Math.PI / 6),
          p2.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle + Math.PI / 6),
          p2.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        if (isSelected) {
          drawHandle(ctx, p1.x, p1.y, drawing.color);
          drawHandle(ctx, p2.x, p2.y, drawing.color);
        }
      } else if (drawing.type === 'brush' && drawing.points.length >= 2) {
        ctx.beginPath();
        const startP = getCanvasCoords(drawing.points[0]);
        ctx.moveTo(startP.x, startP.y);
        for (let i = 1; i < drawing.points.length; i++) {
          const pt = getCanvasCoords(drawing.points[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        if (isSelected) {
          // Draw start and end handles
          const endP = getCanvasCoords(drawing.points[drawing.points.length - 1]);
          drawHandle(ctx, startP.x, startP.y, drawing.color);
          drawHandle(ctx, endP.x, endP.y, drawing.color);
        }
      } else if (drawing.type === 'path' && drawing.points.length >= 2) {
        ctx.beginPath();
        const startP = getCanvasCoords(drawing.points[0]);
        ctx.moveTo(startP.x, startP.y);
        for (let i = 1; i < drawing.points.length; i++) {
          const pt = getCanvasCoords(drawing.points[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Draw arrow head on the last segment of path
        const lastIdx = drawing.points.length - 1;
        const prevP = getCanvasCoords(drawing.points[lastIdx - 1]);
        const endP = getCanvasCoords(drawing.points[lastIdx]);
        const headLength = 12;
        const angle = Math.atan2(endP.y - prevP.y, endP.x - prevP.x);
        ctx.fillStyle = drawing.color;
        ctx.beginPath();
        ctx.moveTo(endP.x, endP.y);
        ctx.lineTo(
          endP.x - headLength * Math.cos(angle - Math.PI / 6),
          endP.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endP.x - headLength * Math.cos(angle + Math.PI / 6),
          endP.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        if (isSelected) {
          drawing.points.forEach((pt) => {
            const cp = getCanvasCoords(pt);
            drawHandle(ctx, cp.x, cp.y, drawing.color);
          });
        }
      } else if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
        const p1 = getCanvasCoords(drawing.points[0]);
        const p2 = getCanvasCoords(drawing.points[1]);
        const left = Math.min(p1.x, p2.x);
        const top = Math.min(p1.y, p2.y);
        const width = Math.abs(p2.x - p1.x);
        const height = Math.abs(p2.y - p1.y);

        ctx.fillStyle = hexToRgba(drawing.color, 0.18);
        ctx.fillRect(left, top, width, height);
        ctx.strokeStyle = drawing.color;
        ctx.strokeRect(left, top, width, height);

        if (isSelected) {
          drawHandle(ctx, left, top, drawing.color);
          drawHandle(ctx, left + width, top, drawing.color);
          drawHandle(ctx, left, top + height, drawing.color);
          drawHandle(ctx, left + width, top + height, drawing.color);
        }
      } else if (drawing.type === 'horizontal' && drawing.points.length >= 1) {
        const p1 = getCanvasCoords(drawing.points[0]);
        ctx.beginPath();
        ctx.moveTo(0, p1.y);
        ctx.lineTo(chartWidth, p1.y);
        ctx.stroke();

        if (isSelected) {
          drawHandle(ctx, chartWidth / 2, p1.y, drawing.color);
        }
      } else if (drawing.type === 'risk_reward' && drawing.points.length >= 1) {
        const config = drawing.riskReward;
        if (config) {
          const entryY = getYFromPrice(config.entryPrice);
          const targetY = getYFromPrice(config.targetPrice);
          const stopY = getYFromPrice(config.stopPrice);

          const leftX = getCanvasCoords(drawing.points[0]).x;
          let rightX = drawing.points[1] ? getCanvasCoords(drawing.points[1]).x : leftX + 220;
          if (rightX < leftX + 40) rightX = leftX + 40;
          const boxWidth = rightX - leftX;
          const centerX = (leftX + rightX) / 2;

          const isLong = config.targetPrice >= config.entryPrice;

          const targetTop = Math.min(entryY, targetY);
          const targetHeight = Math.abs(entryY - targetY);
          const stopTop = Math.min(entryY, stopY);
          const stopHeight = Math.abs(entryY - stopY);

          const topYBoundary = Math.min(targetY, stopY);
          const botYBoundary = Math.max(targetY, stopY);
          const totalHeight = Math.abs(botYBoundary - topYBoundary);

          // Price touch detection
          const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
          const currentPrice = latestCandle ? latestCandle.close : config.entryPrice;
          const latestHigh = latestCandle ? latestCandle.high : currentPrice;
          const latestLow = latestCandle ? latestCandle.low : currentPrice;

          const targetMin = Math.min(config.entryPrice, config.targetPrice);
          const targetMax = Math.max(config.entryPrice, config.targetPrice);
          const stopMin = Math.min(config.entryPrice, config.stopPrice);
          const stopMax = Math.max(config.entryPrice, config.stopPrice);

          const isTargetTouched = (latestHigh >= targetMin && latestLow <= targetMax) ||
            (isLong ? currentPrice >= config.entryPrice : currentPrice <= config.entryPrice);
          const isStopTouched = (latestHigh >= stopMin && latestLow <= stopMax) ||
            (isLong ? currentPrice <= config.entryPrice : currentPrice >= config.entryPrice);

          const targetColor = config.targetColor || '#089981';
          const stopColor = config.stopColor || '#f23645';
          const entryColor = config.entryColor || '#2962ff';

          // 1. Render Crisp Boundary Borders (TradingView style)
          // Target boundary line
          ctx.lineWidth = isTargetTouched ? 2 : 1.5;
          ctx.strokeStyle = isTargetTouched ? hexToRgba(targetColor, 1) : targetColor;
          ctx.beginPath();
          ctx.moveTo(leftX, targetY);
          ctx.lineTo(rightX, targetY);
          ctx.stroke();

          // Stop boundary line
          ctx.lineWidth = isStopTouched ? 2 : 1.5;
          ctx.strokeStyle = isStopTouched ? hexToRgba(stopColor, 1) : stopColor;
          ctx.beginPath();
          ctx.moveTo(leftX, stopY);
          ctx.lineTo(rightX, stopY);
          ctx.stroke();

          // Side vertical borders
          ctx.lineWidth = 1;
          ctx.strokeStyle = hexToRgba(targetColor, 0.55);
          ctx.beginPath();
          ctx.moveTo(leftX, targetTop);
          ctx.lineTo(leftX, targetTop + targetHeight);
          ctx.moveTo(rightX, targetTop);
          ctx.lineTo(rightX, targetTop + targetHeight);
          ctx.stroke();

          ctx.strokeStyle = hexToRgba(stopColor, 0.55);
          ctx.beginPath();
          ctx.moveTo(leftX, stopTop);
          ctx.lineTo(leftX, stopTop + stopHeight);
          ctx.moveTo(rightX, stopTop);
          ctx.lineTo(rightX, stopTop + stopHeight);
          ctx.stroke();

          // 4. Center Entry Divider Line
          ctx.beginPath();
          ctx.moveTo(leftX, entryY);
          ctx.lineTo(rightX, entryY);
          ctx.strokeStyle = isSelected ? entryColor : 'rgba(120, 123, 134, 0.85)';
          ctx.lineWidth = isSelected ? 1.5 : 1;
          ctx.stroke();

          // 5. Calculations
          const targetPips = Math.abs(config.targetPrice - config.entryPrice);
          const stopPips = Math.abs(config.entryPrice - config.stopPrice);
          const rrRatio = stopPips > 0 ? (targetPips / stopPips).toFixed(2) : '0.00';

          // 6. Centered TradingView Risk/Reward Ratio Pill on Entry Line (Only visible when selected)
          if (isSelected) {
            ctx.save();
            const rrText = `Risk/Reward Ratio: ${rrRatio}`;
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            const rrW = ctx.measureText(rrText).width + 16;
            const rrH = 18;
            const rrX = centerX - rrW / 2;
            const rrY = entryY - rrH / 2;

            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = '#131722';
            ctx.strokeStyle = entryColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(rrX, rrY, rrW, rrH, 4);
            } else {
              ctx.rect(rrX, rrY, rrW, rrH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(rrText, centerX, entryY);
            ctx.restore();
          }

          // 7. TRADINGVIEW CIRCULAR BLUE HANDLES IN TAP / SELECTION MODE
          if (isSelected) {
            const drawTvCircleHandle = (hx: number, hy: number) => {
              ctx.save();
              ctx.shadowColor = 'rgba(0, 0, 0, 0.60)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetY = 1.5;
              ctx.beginPath();
              ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
              ctx.fillStyle = '#2962ff';
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#ffffff';
              ctx.stroke();
              ctx.restore();
            };

            // Target level (left, center, right)
            drawTvCircleHandle(leftX, targetY);
            drawTvCircleHandle(centerX, targetY);
            drawTvCircleHandle(rightX, targetY);

            // Entry level (left, center, right)
            drawTvCircleHandle(leftX, entryY);
            drawTvCircleHandle(centerX, entryY);
            drawTvCircleHandle(rightX, entryY);

            // Stop level (left, center, right)
            drawTvCircleHandle(leftX, stopY);
            drawTvCircleHandle(centerX, stopY);
            drawTvCircleHandle(rightX, stopY);
          }
        }
      } else if (drawing.type === 'fixed_range_volume_profile' && drawing.points.length >= 2) {
        // --- FIXED RANGE VOLUME PROFILE (FRVP) ---
        const p1 = getCanvasCoords(drawing.points[0]);
        const p2 = getCanvasCoords(drawing.points[1]);
        const leftX = Math.min(p1.x, p2.x);
        const rightX = Math.max(p1.x, p2.x);
        const topY = Math.min(p1.y, p2.y);
        const bottomY = Math.max(p1.y, p2.y);
        const boxWidth = rightX - leftX;
        const boxHeight = bottomY - topY;

        const vpConfig = drawing.volumeProfile || {
          numRows: 24,
          vaPercent: 0.70,
          upColor: '#26a69a',
          downColor: '#ef5350',
          pocColor: '#f59e0b',
          vahValColor: '#38bdf8',
          showLabels: true,
        };

        const tStart = Math.min(drawing.points[0].time, drawing.points[1].time);
        const tEnd = Math.max(drawing.points[0].time, drawing.points[1].time);

        const vp = calculateFixedRangeVolumeProfile(
          candles,
          tStart,
          tEnd,
          vpConfig.numRows || 24,
          vpConfig.vaPercent || 0.70
        );

        if (vp && vp.bins.length > 0 && boxWidth > 10) {
          // 1. Subtle Boundary Box Frame
          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.25)' : 'rgba(241, 245, 249, 0.4)';
          ctx.fillRect(leftX, topY, boxWidth, boxHeight);
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(leftX, topY, boxWidth, boxHeight);
          ctx.setLineDash([]);

          // 2. Horizontal Volume Profile Histogram Bars
          const maxBarWidth = boxWidth * 0.85;

          vp.bins.forEach((bin) => {
            const yTop = getYFromPrice(bin.priceHigh);
            const yBot = getYFromPrice(bin.priceLow);
            const barY = Math.min(yTop, yBot);
            const barH = Math.max(1.5, Math.abs(yBot - yTop) - 0.5);

            if (bin.totalVolume > 0 && vp.maxTotalVolume > 0) {
              const buyWidth = (bin.buyVolume / vp.maxTotalVolume) * maxBarWidth;
              const sellWidth = (bin.sellVolume / vp.maxTotalVolume) * maxBarWidth;

              const isInsideVA = bin.priceMid >= vp.valPrice && bin.priceMid <= vp.vahPrice;
              const buyAlpha = isInsideVA ? 0.75 : 0.35;
              const sellAlpha = isInsideVA ? 0.75 : 0.35;

              // Up/Buy Volume Bar (Emerald)
              ctx.fillStyle = hexToRgba(vpConfig.upColor || '#26a69a', buyAlpha);
              ctx.fillRect(leftX, barY, buyWidth, barH);

              // Down/Sell Volume Bar (Rose)
              ctx.fillStyle = hexToRgba(vpConfig.downColor || '#ef5350', sellAlpha);
              ctx.fillRect(leftX + buyWidth, barY, sellWidth, barH);
            }
          });

          // 3. Point of Control (POC) Line (Long Extended Golden Accent Line)
          const yPoc = getYFromPrice(vp.pocPrice);
          const shouldExtendPoc = vpConfig.extendPocRight !== false;
          const pocEndX = shouldExtendPoc ? chartWidth : rightX;

          // Subtle ambient glow behind POC ray
          ctx.strokeStyle = hexToRgba(vpConfig.pocColor || '#f59e0b', 0.25);
          ctx.lineWidth = 6;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(leftX, yPoc);
          ctx.lineTo(pocEndX, yPoc);
          ctx.stroke();

          // Main solid POC ray (Inside the profile + extended across the chart)
          ctx.strokeStyle = vpConfig.pocColor || '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(leftX, yPoc);
          ctx.lineTo(pocEndX, yPoc);
          ctx.stroke();

          // 4. Value Area High (VAH) and Value Area Low (VAL) Lines
          const yVah = getYFromPrice(vp.vahPrice);
          const yVal = getYFromPrice(vp.valPrice);
          const shouldExtendVahVal = vpConfig.extendVahValRight ?? false;
          const vahValEndX = shouldExtendVahVal ? chartWidth : rightX;

          ctx.strokeStyle = vpConfig.vahValColor || '#38bdf8';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);

          // VAH Line
          ctx.beginPath();
          ctx.moveTo(leftX, yVah);
          ctx.lineTo(vahValEndX, yVah);
          ctx.stroke();

          // VAL Line
          ctx.beginPath();
          ctx.moveTo(leftX, yVal);
          ctx.lineTo(vahValEndX, yVal);
          ctx.stroke();
          ctx.setLineDash([]);

          // 5. FRVP Labels & Badges
          if (vpConfig.showLabels ?? true) {
            ctx.font = 'bold 9px monospace';
            const decimals = vp.pocPrice > 100 ? 2 : 4;

            // Long POC Badge at the chart's right price scale if extended
            if (shouldExtendPoc) {
              const rightPocText = `POC ${vp.pocPrice.toFixed(decimals)}`;
              const rightPocW = ctx.measureText(rightPocText).width + 8;
              const rightPocX = chartWidth - 6;
              ctx.textAlign = 'right';
              ctx.fillStyle = isDark ? 'rgba(20, 14, 4, 0.95)' : 'rgba(254, 243, 199, 0.95)';
              ctx.fillRect(rightPocX - rightPocW, yPoc - 7, rightPocW, 14);
              ctx.strokeStyle = vpConfig.pocColor || '#f59e0b';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(rightPocX - rightPocW, yPoc - 7, rightPocW, 14);
              ctx.fillStyle = vpConfig.pocColor || '#f59e0b';
              ctx.fillText(rightPocText, rightPocX - 4, yPoc + 3);
            }

            // FRVP Box POC Badge
            ctx.textAlign = 'right';
            const pocText = `POC ${vp.pocPrice.toFixed(decimals)}`;
            const pocW = ctx.measureText(pocText).width + 8;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
            ctx.fillRect(rightX - pocW - 2, yPoc - 7, pocW, 14);
            ctx.strokeStyle = vpConfig.pocColor || '#f59e0b';
            ctx.lineWidth = 1;
            ctx.strokeRect(rightX - pocW - 2, yPoc - 7, pocW, 14);
            ctx.fillStyle = vpConfig.pocColor || '#f59e0b';
            ctx.fillText(pocText, rightX - 6, yPoc + 3);

            // VAH Badge
            const vahText = `VAH ${vp.vahPrice.toFixed(decimals)}`;
            const vahW = ctx.measureText(vahText).width + 8;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
            ctx.fillRect(rightX - vahW - 2, yVah - 7, vahW, 14);
            ctx.strokeStyle = vpConfig.vahValColor || '#38bdf8';
            ctx.lineWidth = 1;
            ctx.strokeRect(rightX - vahW - 2, yVah - 7, vahW, 14);
            ctx.fillStyle = vpConfig.vahValColor || '#38bdf8';
            ctx.fillText(vahText, rightX - 6, yVah + 3);

            // VAL Badge
            const valText = `VAL ${vp.valPrice.toFixed(decimals)}`;
            const valW = ctx.measureText(valText).width + 8;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
            ctx.fillRect(rightX - valW - 2, yVal - 7, valW, 14);
            ctx.strokeStyle = vpConfig.vahValColor || '#38bdf8';
            ctx.lineWidth = 1;
            ctx.strokeRect(rightX - valW - 2, yVal - 7, valW, 14);
            ctx.fillStyle = vpConfig.vahValColor || '#38bdf8';
            ctx.fillText(valText, rightX - 6, yVal + 3);

            // Top Header Info
            ctx.font = 'bold 9px "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(`FRVP (${vpConfig.numRows} Rows | VA 70%)`, leftX + 6, topY + 12);
          }

          if (isSelected) {
            drawHandle(ctx, leftX, topY, '#f59e0b');
            drawHandle(ctx, rightX, topY, '#f59e0b');
            drawHandle(ctx, leftX, bottomY, '#f59e0b');
            drawHandle(ctx, rightX, bottomY, '#f59e0b');
            drawHandle(ctx, leftX, yPoc, '#f59e0b');
            drawHandle(ctx, rightX, yPoc, '#f59e0b');
          }
        }
      }
    });

    // 5. Draw Active In-Progress drawing
    if (isDrawingInProgress && newDrawingPoints.length > 0) {
      ctx.lineWidth = 2;

      if (activeTool === 'trend') {
        ctx.strokeStyle = '#2196f3';
        const p1 = getCanvasCoords(newDrawingPoints[0]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
      } else if (activeTool === 'fixed_range_volume_profile') {
        ctx.strokeStyle = '#f59e0b';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        const p1 = getCanvasCoords(newDrawingPoints[0]);
        const p2 = mousePos;
        const left = Math.min(p1.x, p2.x);
        const top = Math.min(p1.y, p2.y);
        const width = Math.abs(p2.x - p1.x);
        const height = Math.abs(p2.y - p1.y);

        ctx.fillRect(left, top, width, height);
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(left, top, width, height);
        ctx.setLineDash([]);

        // Preview POC line extended across chart
        const previewPocY = top + height / 2;
        ctx.strokeStyle = hexToRgba('#f59e0b', 0.3);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(left, previewPocY);
        ctx.lineTo(chartWidth, previewPocY);
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left, previewPocY);
        ctx.lineTo(chartWidth, previewPocY);
        ctx.stroke();

        ctx.font = 'bold 9px "Inter", sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'left';
        ctx.fillText('Fixed Range Volume Profile (Release to finalize)', left + 6, top + 14);

        // Right preview POC badge
        ctx.textAlign = 'right';
        ctx.fillText('Extended POC Ray', chartWidth - 8, previewPocY - 4);

        drawHandle(ctx, p1.x, p1.y, '#f59e0b');
        drawHandle(ctx, p2.x, p2.y, '#f59e0b');
      } else if (activeTool === 'arrow') {
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = '#10b981';
        const p1 = getCanvasCoords(newDrawingPoints[0]);
        const p2 = mousePos;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const headLength = 12;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle - Math.PI / 6),
          p2.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle + Math.PI / 6),
          p2.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (activeTool === 'rectangle') {
        ctx.strokeStyle = '#818cf8';
        ctx.fillStyle = 'rgba(129, 140, 248, 0.18)';
        const p1 = getCanvasCoords(newDrawingPoints[0]);
        const p2 = mousePos;
        const left = Math.min(p1.x, p2.x);
        const top = Math.min(p1.y, p2.y);
        const width = Math.abs(p2.x - p1.x);
        const height = Math.abs(p2.y - p1.y);

        ctx.fillRect(left, top, width, height);
        ctx.strokeRect(left, top, width, height);
        drawHandle(ctx, p1.x, p1.y, '#818cf8');
        drawHandle(ctx, p2.x, p2.y, '#818cf8');
      } else if (activeTool === 'brush') {
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        const startP = getCanvasCoords(newDrawingPoints[0]);
        ctx.moveTo(startP.x, startP.y);
        for (let i = 1; i < newDrawingPoints.length; i++) {
          const pt = getCanvasCoords(newDrawingPoints[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
      } else if (activeTool === 'path') {
        ctx.strokeStyle = '#06b6d4';
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        const startP = getCanvasCoords(newDrawingPoints[0]);
        ctx.moveTo(startP.x, startP.y);
        for (let i = 1; i < newDrawingPoints.length; i++) {
          const pt = getCanvasCoords(newDrawingPoints[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();

        // Draw preview arrow head from latest fixed point towards cursor
        const lastPt = getCanvasCoords(newDrawingPoints[newDrawingPoints.length - 1]);
        const headLength = 12;
        const angle = Math.atan2(mousePos.y - lastPt.y, mousePos.x - lastPt.x);
        ctx.beginPath();
        ctx.moveTo(mousePos.x, mousePos.y);
        ctx.lineTo(
          mousePos.x - headLength * Math.cos(angle - Math.PI / 6),
          mousePos.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          mousePos.x - headLength * Math.cos(angle + Math.PI / 6),
          mousePos.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Draw markers on committed points
        newDrawingPoints.forEach((pt) => {
          const cp = getCanvasCoords(pt);
          drawHandle(ctx, cp.x, cp.y, '#06b6d4');
        });
      }
    }

    // Render Market Structure Signals | ProjectSyndicate
    if ((settings.indicators.showMarketStructureSignals ?? true) && mssResults) {
      const colorBullish = settings.indicators.mssColorBullish ?? '#21c997';
      const colorBearish = settings.indicators.mssColorBearish ?? '#cc24e2';
      const colorTP1 = settings.indicators.mssColorTP1 ?? '#26a69a';
      const colorTP2 = settings.indicators.mssColorTP2 ?? '#00897b';
      const colorSL = settings.indicators.mssColorSL ?? '#b71c1c';
      const boxAlpha = (100 - (settings.indicators.mssBoxTransparency ?? 85)) / 100;
      const borderAlpha = (100 - (settings.indicators.mssBorderTransparency ?? 50)) / 100;

      // 1. Draw Breakout Lines (BOS / CHoCH)
      mssResults.lines.forEach((line) => {
        const startX = getXFromIndex(line.startBarIndex);
        const endX = getXFromIndex(line.endBarIndex);
        const y = getYFromPrice(line.level);

        if (endX < 0 || startX > chartWidth || y < 0 || y > chartHeight) return;

        const lineCol = line.isBullish ? colorBullish : colorBearish;

        ctx.save();
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, startX), y);
        ctx.lineTo(Math.min(chartWidth, endX), y);
        ctx.stroke();

        // Draw Label: BOS or CHoCH
        const labelX = getXFromIndex(line.labelBarIndex);
        if (labelX >= 0 && labelX <= chartWidth) {
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          const textW = ctx.measureText(line.type).width;
          const padX = 6;
          const labelY = line.isBullish ? y - 16 : y + 4;

          ctx.fillStyle = hexToRgba(lineCol, 0.85);
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(labelX - textW / 2 - padX, labelY, textW + padX * 2, 14, 3);
          } else {
            ctx.rect(labelX - textW / 2 - padX, labelY, textW + padX * 2, 14);
          }
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(line.type, labelX, labelY + 7);
        }
        ctx.restore();
      });

      // 2. Draw Trade Setups (Clean Small Lines for Entry, TP1, TP2, SL)
      mssResults.tradeSetups.forEach((trade) => {
        const startX = getXFromIndex(trade.entryBarIndex);
        const endX = getXFromIndex(trade.endBarIndex);
        const renderXStart = Math.max(0, startX);
        const renderXEnd = Math.min(chartWidth, Math.max(startX + 48, endX));

        if (renderXEnd < 0 || renderXStart > chartWidth) return;

        const yEntry = getYFromPrice(trade.entryPrice);
        const ySL = getYFromPrice(trade.slPrice);
        const yTP1 = getYFromPrice(trade.tp1Price);
        const yTP2 = getYFromPrice(trade.tp2Price);

        ctx.save();

        const drawSmallSignalLine = (price: number, labelStr: string, colorHex: string, yPos: number, isDashed = true) => {
          if (yPos < 0 || yPos > chartHeight) return;
          ctx.save();
          ctx.strokeStyle = colorHex;
          ctx.lineWidth = 1.5;
          if (isDashed) {
            ctx.setLineDash([4, 3]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.beginPath();
          ctx.moveTo(renderXStart, yPos);
          ctx.lineTo(renderXEnd, yPos);
          ctx.stroke();

          // Small tag label at the end of the line
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          const fullText = `${labelStr}: ${price.toFixed(2)}`;
          const tw = ctx.measureText(fullText).width;
          const badgeX = Math.min(chartWidth - tw - 10, renderXEnd + 2);
          const badgeY = yPos - 7;

          ctx.fillStyle = hexToRgba(colorHex, 0.92);
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, tw + 8, 14, 2);
            ctx.fill();
          } else {
            ctx.fillRect(badgeX, badgeY, tw + 8, 14);
          }

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(fullText, badgeX + 4, yPos);
          ctx.restore();
        };

        const entryCol = trade.direction === 'LONG' ? colorBullish : colorBearish;
        drawSmallSignalLine(trade.entryPrice, `${trade.direction === 'LONG' ? 'Buy' : 'Sell'} Entry`, entryCol, yEntry, false);
        drawSmallSignalLine(trade.tp1Price, 'TP1', colorTP1, yTP1, true);
        drawSmallSignalLine(trade.tp2Price, 'TP2', colorTP2, yTP2, true);
        drawSmallSignalLine(trade.slPrice, 'SL', colorSL, ySL, true);

        ctx.restore();
      });

      // 3. Draw SMC SIGNALS DASHBOARD Table
      const stats = mssResults.stats;
      ctx.save();

      const dashTextSize = settings.indicators.mssDashboardTextSize ?? 'Normal';
      let fontHeader = 'bold 11px JetBrains Mono, monospace';
      let fontBody = '10px JetBrains Mono, monospace';
      let rowHeight = 18;
      let tableWidth = 190;

      if (dashTextSize === 'Tiny') {
        fontHeader = 'bold 9px JetBrains Mono, monospace';
        fontBody = '8px JetBrains Mono, monospace';
        rowHeight = 14;
        tableWidth = 150;
      } else if (dashTextSize === 'Small') {
        fontHeader = 'bold 10px JetBrains Mono, monospace';
        fontBody = '9px JetBrains Mono, monospace';
        rowHeight = 16;
        tableWidth = 170;
      } else if (dashTextSize === 'Large') {
        fontHeader = 'bold 12px JetBrains Mono, monospace';
        fontBody = '11px JetBrains Mono, monospace';
        rowHeight = 20;
        tableWidth = 210;
      } else if (dashTextSize === 'Huge') {
        fontHeader = 'bold 14px JetBrains Mono, monospace';
        fontBody = '12px JetBrains Mono, monospace';
        rowHeight = 23;
        tableWidth = 240;
      }

      // Position in top-right area of chart
      const dashX = chartWidth - tableWidth - 10;
      let dashY = 12;

      // Table Container background
      const totalRows = 12 + Math.min(stats.tradeHistory.length, 10);
      const tableHeight = totalRows * rowHeight + 10;

      ctx.fillStyle = 'rgba(30, 34, 45, 0.92)';
      ctx.strokeStyle = '#363a45';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(dashX, dashY, tableWidth, tableHeight, 6);
      } else {
        ctx.rect(dashX, dashY, tableWidth, tableHeight);
      }
      ctx.fill();
      ctx.stroke();

      let currentY = dashY + 4;

      // Header: SMC SIGNALS DASHBOARD
      ctx.fillStyle = 'rgba(41, 98, 255, 0.35)';
      ctx.fillRect(dashX + 2, currentY, tableWidth - 4, rowHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = fontHeader;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SMC SIGNALS DASHBOARD', dashX + tableWidth / 2, currentY + rowHeight / 2);
      currentY += rowHeight;

      const drawSectionHeader = (title: string) => {
        ctx.fillStyle = 'rgba(54, 58, 69, 0.8)';
        ctx.fillRect(dashX + 2, currentY, tableWidth - 4, rowHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = fontHeader;
        ctx.textAlign = 'left';
        ctx.fillText(title, dashX + 8, currentY + rowHeight / 2);
        currentY += rowHeight;
      };

      const drawDataRow = (label: string, val: string, valColor: string) => {
        ctx.font = fontBody;
        ctx.fillStyle = '#d1d4dc';
        ctx.textAlign = 'left';
        ctx.fillText(label, dashX + 8, currentY + rowHeight / 2);

        ctx.fillStyle = valColor;
        ctx.textAlign = 'right';
        ctx.fillText(val, dashX + tableWidth - 8, currentY + rowHeight / 2);
        currentY += rowHeight;
      };

      // STATISTICS
      drawSectionHeader('STATISTICS');
      drawDataRow('Total Signals', stats.totalSignals.toString(), '#21c997');
      drawDataRow('Closed Trades', stats.totalClosedTrades.toString(), '#21c997');
      drawDataRow('TP1 Wins', stats.tp1Wins.toString(), colorTP1);
      drawDataRow('TP2 Wins', stats.tp2Wins.toString(), colorTP2);
      drawDataRow('SL Losses', stats.slLosses.toString(), colorSL);

      // WIN RATES
      drawSectionHeader('WIN RATES');
      drawDataRow('TP1 Win Rate', `${stats.tp1WinRate.toFixed(1)}%`, colorTP1);
      drawDataRow('TP2 Win Rate', `${stats.tp2WinRate.toFixed(1)}%`, colorTP2);
      const overallColor = stats.overallWinRate >= 50 ? colorBullish : colorBearish;
      drawDataRow('Overall Win Rate', `${stats.overallWinRate.toFixed(1)}%`, overallColor);

      // LAST 10 TRADES
      drawSectionHeader('LAST 10 TRADES');
      if (stats.tradeHistory.length === 0) {
        ctx.font = fontBody;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('No trades yet', dashX + tableWidth / 2, currentY + rowHeight / 2);
      } else {
        stats.tradeHistory.slice(0, 10).forEach((result, idx) => {
          ctx.font = fontBody;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(`Trade ${idx + 1}`, dashX + 8, currentY + rowHeight / 2);

          let resColor = colorSL;
          if (result === 'TP2') resColor = colorTP2;
          else if (result === 'TP1') resColor = colorTP1;

          const badgeW = 50;
          const badgeH = rowHeight - 4;
          const badgeX = dashX + tableWidth - badgeW - 6;
          const badgeY = currentY + 2;

          ctx.fillStyle = hexToRgba(resColor, 0.25);
          ctx.strokeStyle = resColor;
          ctx.lineWidth = 1;
          ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
          ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

          ctx.fillStyle = resColor;
          ctx.textAlign = 'center';
          ctx.fillText(result, badgeX + badgeW / 2, currentY + rowHeight / 2);

          currentY += rowHeight;
        });
      }

      ctx.restore();
    }

    // Render Market Tick Two [MarkitTick] - Improved v2 (Market Structure Target Tracker)
    const isMsttActiveOnChart = (settings.indicators.showMarketTickTwo ?? settings.indicators.showMarketStructureTargetTracker) ?? true;
    if (isMsttActiveOnChart && msttResults) {
      ctx.save();

      // 0. Draw BOS Bull & Bear plotshape markers on candles (plotshape(bosBull,...), plotshape(bosBear,...))
      if ((settings.indicators.msttShowSignalMarkers ?? true) && msttResults.signalMarkers && msttResults.signalMarkers.length > 0) {
        msttResults.signalMarkers.forEach((sig) => {
          const x = getXFromIndex(sig.barIndex);
          if (x < -20 || x > chartWidth + 20) return;
          const y = getYFromPrice(sig.price);
          const isBull = sig.type === 'bull';
          const size = 5;
          const yPos = isBull ? y + 14 : y - 14;

          ctx.fillStyle = sig.color;
          ctx.beginPath();
          if (isBull) {
            ctx.moveTo(x, yPos - size);
            ctx.lineTo(x - size, yPos + size);
            ctx.lineTo(x + size, yPos + size);
          } else {
            ctx.moveTo(x, yPos + size);
            ctx.lineTo(x - size, yPos - size);
            ctx.lineTo(x + size, yPos - size);
          }
          ctx.closePath();
          ctx.fill();

          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillStyle = sig.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = isBull ? 'top' : 'bottom';
          ctx.fillText('BOS', x, isBull ? yPos + size + 1 : yPos - size - 1);
        });
      }

      // 1. Draw Shaded Linefills (slFill, tp1Fill, tp2Fill, tp3Fill)
      if (settings.indicators.msttShowTpSl ?? true) {
        const drawFill = (fill: typeof msttResults.slFill, alpha: number) => {
          if (!fill) return;
          const startX = getXFromIndex(fill.x1);
          const endX = getXFromIndex(fill.x2);
          const renderX1 = Math.max(0, startX);
          const renderX2 = Math.min(chartWidth, endX);
          if (renderX2 <= renderX1) return;

          const topY = Math.min(getYFromPrice(fill.y1), getYFromPrice(fill.y2));
          const botY = Math.max(getYFromPrice(fill.y1), getYFromPrice(fill.y2));
          const h = botY - topY;
          if (h <= 0) return;

          ctx.fillStyle = hexToRgba(fill.color.startsWith('rgb') ? fill.color : fill.color, alpha);
          ctx.fillRect(renderX1, topY, renderX2 - renderX1, h);
        };

        // Transparency matching Pine Script color.new or user custom opacity
        const slAlpha = settings.indicators.msttSlShadeAlpha ?? 0.30;
        const tp1Alpha = settings.indicators.msttTp1ShadeAlpha ?? 0.30;
        const tp2Alpha = settings.indicators.msttTp2ShadeAlpha ?? 0.15;
        const tp3Alpha = settings.indicators.msttTp3ShadeAlpha ?? 0.05;

        const effectiveShowSl = msttResults.dashboard.showSl;
        const effectiveShowTp1 = msttResults.dashboard.showTp1;
        const effectiveShowTp2 = msttResults.dashboard.showTp2;
        const effectiveShowTp3 = msttResults.dashboard.showTp3;

        if ((settings.indicators.msttShowSlShade ?? true) && effectiveShowSl) {
          drawFill(msttResults.slFill, slAlpha);
        }
        if ((settings.indicators.msttShowTp1Shade ?? true) && effectiveShowTp1) {
          drawFill(msttResults.tp1Fill, tp1Alpha);
        }
        if ((settings.indicators.msttShowTp2Shade ?? true) && effectiveShowTp2) {
          drawFill(msttResults.tp2Fill, tp2Alpha);
        }
        if ((settings.indicators.msttShowTp3Shade ?? true) && effectiveShowTp3) {
          drawFill(msttResults.tp3Fill, tp3Alpha);
        }
      }

      // 2. Draw BOS Line
      if ((settings.indicators.msttShowBosLine ?? true) && msttResults.bosLine) {
        const bl = msttResults.bosLine;
        const startX = getXFromIndex(bl.x1);
        const endX = getXFromIndex(bl.x2);
        const y = getYFromPrice(bl.y1);

        if (endX >= 0 && startX <= chartWidth && y >= 0 && y <= chartHeight) {
          ctx.strokeStyle = bl.color;
          ctx.lineWidth = bl.width;
          ctx.setLineDash(bl.style === 'dashed' ? [4, 4] : []);
          ctx.beginPath();
          ctx.moveTo(Math.max(0, startX), y);
          ctx.lineTo(Math.min(chartWidth, endX), y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 3. Draw BOS / CHoCH Label
      if ((settings.indicators.msttShowLabel ?? true) && msttResults.bosLabel) {
        const lbl = msttResults.bosLabel;
        const x = getXFromIndex(lbl.x);
        const y = getYFromPrice(lbl.y);

        if (x >= 0 && x <= chartWidth && y >= 0 && y <= chartHeight) {
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.fillStyle = lbl.textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = lbl.style === 'label_down' ? 'bottom' : 'top';
          const offsetY = lbl.style === 'label_down' ? -4 : 4;
          ctx.fillText(lbl.text, x, y + offsetY);
        }
      }

      // 4. Draw Entry / SL / TP1 / TP2 / TP3 Lines & Labels
      if (settings.indicators.msttShowTpSl ?? true) {
        const effectiveShowSl = msttResults.dashboard.showSl;
        const effectiveShowTp1 = msttResults.dashboard.showTp1;
        const effectiveShowTp2 = msttResults.dashboard.showTp2;
        const effectiveShowTp3 = msttResults.dashboard.showTp3;

        const linesToDraw: Array<{ line: typeof msttResults.entryLine; lbl: typeof msttResults.entryLabel; show: boolean }> = [
          { line: msttResults.entryLine, lbl: msttResults.entryLabel, show: true },
          { line: msttResults.slLine, lbl: msttResults.slLabel, show: (settings.indicators.msttShowSl ?? true) && effectiveShowSl },
          { line: msttResults.tp1Line, lbl: msttResults.tp1Label, show: (settings.indicators.msttShowTp1 ?? true) && effectiveShowTp1 },
          { line: msttResults.tp2Line, lbl: msttResults.tp2Label, show: (settings.indicators.msttShowTp2 ?? true) && effectiveShowTp2 },
          { line: msttResults.tp3Line, lbl: msttResults.tp3Label, show: (settings.indicators.msttShowTp3 ?? true) && effectiveShowTp3 },
        ];

        linesToDraw.forEach(({ line, lbl, show }) => {
          if (!line || !show) return;
          const startX = getXFromIndex(line.x1);
          const endX = getXFromIndex(line.x2);
          const y = getYFromPrice(line.y1);

          if (endX < 0 || startX > chartWidth || y < 0 || y > chartHeight) return;

          ctx.strokeStyle = line.color;
          ctx.lineWidth = line.width;
          ctx.setLineDash(line.style === 'dashed' ? [3, 3] : []);
          ctx.beginPath();
          ctx.moveTo(Math.max(0, startX), y);
          ctx.lineTo(Math.min(chartWidth, endX), y);
          ctx.stroke();
          ctx.setLineDash([]);

          if (lbl && endX >= 0 && endX <= chartWidth + 120) {
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            const padX = 5;
            const padY = 3;
            const textMetrics = ctx.measureText(lbl.text);
            const textW = textMetrics.width;
            const badgeW = textW + padX * 2;
            const badgeH = 16;
            const badgeX = Math.min(chartWidth - badgeW - 4, endX + 4);
            const badgeY = y - badgeH / 2;

            // Background pill (color.new(col, 70) => 0.3 opacity)
            ctx.fillStyle = hexToRgba(lbl.color, 0.3);
            ctx.strokeStyle = lbl.textColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
            } else {
              ctx.rect(badgeX, badgeY, badgeW, badgeH);
            }
            ctx.fill();
            ctx.stroke();

            // Label text
            ctx.fillStyle = lbl.textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(lbl.text, badgeX + padX, y);
          }
        });
      }

      // 4b. Draw Historical Trade Brackets on Chart (for last keepN trades)
      if ((settings.indicators.msttShowHistoricalTrades ?? true) && msttResults.stats && msttResults.stats.recentTrades.length > 0) {
        const showTp1 = msttResults.dashboard.showTp1;
        const showTp2 = msttResults.dashboard.showTp2;
        const showTp3 = msttResults.dashboard.showTp3;

        msttResults.stats.recentTrades.forEach((tr) => {
          const startX = getXFromIndex(tr.entryBar);
          const endX = getXFromIndex(tr.endBar);
          const renderX1 = Math.max(0, startX);
          const renderX2 = Math.min(chartWidth, endX);
          if (renderX2 <= renderX1) return;

          const yEntry = getYFromPrice(tr.entryPrice);
          const ySl = getYFromPrice(tr.slPrice);

          // Subtle shaded risk area
          const slTop = Math.min(yEntry, ySl);
          const slH = Math.abs(ySl - yEntry);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
          ctx.fillRect(renderX1, slTop, renderX2 - renderX1, slH);

          // TP1 Bracket & Fill if showTp1 is active
          if (showTp1) {
            const yTp1 = getYFromPrice(tr.tp1Price);
            const tp1Top = Math.min(yEntry, yTp1);
            const tp1H = Math.abs(yTp1 - yEntry);
            ctx.fillStyle = tr.isWin ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.04)';
            ctx.fillRect(renderX1, tp1Top, renderX2 - renderX1, tp1H);

            ctx.strokeStyle = '#00dc82';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(renderX1, yTp1);
            ctx.lineTo(renderX2, yTp1);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // TP2 Bracket & Fill if showTp2 is active
          if (showTp2) {
            const yTp2 = getYFromPrice(tr.tp2Price);
            const yBase = showTp1 ? getYFromPrice(tr.tp1Price) : yEntry;
            const tp2Top = Math.min(yBase, yTp2);
            const tp2H = Math.abs(yTp2 - yBase);
            ctx.fillStyle = tr.isWin ? 'rgba(0, 255, 180, 0.10)' : 'rgba(0, 255, 180, 0.03)';
            ctx.fillRect(renderX1, tp2Top, renderX2 - renderX1, tp2H);

            ctx.strokeStyle = '#00ffb4';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(renderX1, yTp2);
            ctx.lineTo(renderX2, yTp2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // TP3 Bracket & Fill if showTp3 is active
          if (showTp3) {
            const yTp3 = getYFromPrice(tr.tp3Price);
            const yBase = showTp2 ? getYFromPrice(tr.tp2Price) : showTp1 ? getYFromPrice(tr.tp1Price) : yEntry;
            const tp3Top = Math.min(yBase, yTp3);
            const tp3H = Math.abs(yTp3 - yBase);
            ctx.fillStyle = tr.isWin ? 'rgba(0, 255, 255, 0.08)' : 'rgba(0, 255, 255, 0.02)';
            ctx.fillRect(renderX1, tp3Top, renderX2 - renderX1, tp3H);

            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(renderX1, yTp3);
            ctx.lineTo(renderX2, yTp3);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Entry ray
          ctx.strokeStyle = tr.isWin ? '#22c55e' : '#ef4444';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(renderX1, yEntry);
          ctx.lineTo(renderX2, yEntry);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      // 5. Draw Dashboard Table (table.new(position.top_right, 2, 15))
      if (settings.indicators.msttShowDashboard ?? true) {
        const d = msttResults.dashboard;
        const colW0 = 95;
        const colW1 = Math.max(135, Math.min(240, Math.round(d.filterStr.length * 6.2 + 16)));
        const tableW = colW0 + colW1;
        const rowH = 17;

        const rows: Array<{
          c0: string;
          c1: string;
          c0Color?: string;
          c1Color: string;
          bg: string;
        }> = [
          { c0: d.ticker, c1: d.tag, c0Color: 'rgb(220,220,235)', c1Color: 'rgb(180,180,220)', bg: 'rgba(30,30,45,0.95)' },
          { c0: 'Trend', c1: d.trendStr, c1Color: d.trendCol, bg: 'rgba(10,10,18,0.95)' },
          { c0: 'HTF Dir', c1: d.htfStr, c1Color: d.htfDirCol, bg: 'rgba(20,20,25,0.95)' },
          { c0: 'HTF RSI', c1: d.htfBarStr, c1Color: d.htfBarCol, bg: 'rgba(10,10,18,0.95)' },
          { c0: 'Structure', c1: d.structStr, c1Color: d.structCol, bg: 'rgba(20,20,25,0.95)' },
          { c0: 'Filters', c1: d.filterStr === '' ? 'OFF' : d.filterStr, c1Color: 'rgb(220,220,235)', bg: 'rgba(10,10,18,0.95)' },
          { c0: 'BOS Lvl', c1: d.bosLvlStr, c1Color: 'rgb(200,200,60)', bg: 'rgba(20,20,25,0.95)' },
          { c0: 'Target', c1: d.tgtLvlStr, c1Color: 'rgb(200,200,60)', bg: 'rgba(10,10,18,0.95)' },
          { c0: 'Tgt Status', c1: d.tgtHitStr, c1Color: d.tgtHitCol, bg: 'rgba(20,20,25,0.95)' },
          { c0: '► Entry', c1: d.entryStr, c1Color: 'rgb(100,180,255)', bg: 'rgba(10,10,18,0.95)' },
          ...(d.showSl ? [{ c0: '✕ SL', c1: d.slStr, c1Color: 'rgb(255,60,60)', bg: 'rgba(20,20,25,0.95)' }] : []),
          ...(d.showTp1 ? [{ c0: '● TP1', c1: d.tp1Str, c1Color: 'rgb(0,220,130)', bg: 'rgba(10,10,18,0.95)' }] : []),
          ...(d.showTp2 ? [{ c0: '★ TP2', c1: d.tp2Str, c1Color: 'rgb(0,255,180)', bg: 'rgba(20,20,25,0.95)' }] : []),
          ...(d.showTp3 ? [{ c0: '◆ TP3', c1: d.tp3Str, c1Color: 'rgb(0,255,255)', bg: 'rgba(10,10,18,0.95)' }] : []),
          { c0: 'R:R', c1: d.rrStr, c1Color: d.rrCol, bg: 'rgba(20,20,25,0.95)' },
          { c0: 'Duration', c1: d.durationStr, c1Color: 'rgb(140,180,255)', bg: 'rgba(10,10,18,0.95)' },
          { c0: 'Total BOS', c1: d.totalStr, c1Color: 'rgb(180,180,220)', bg: 'rgba(30,30,45,0.95)' },
          // PERFORMANCE SCORECARD (Evaluated over keepN)
          { c0: `PERF (LAST ${d.keepN})`, c1: `${d.totalTradesStr}`, c0Color: '#38bdf8', c1Color: '#38bdf8', bg: 'rgba(15,40,70,0.95)' },
          { c0: 'Win / Loss', c1: d.winLossStr, c0Color: 'rgb(200,200,210)', c1Color: '#34d399', bg: 'rgba(10,10,18,0.95)' },
          { c0: 'Win Rate', c1: d.winRateStr, c0Color: 'rgb(200,200,210)', c1Color: d.winRateCol, bg: 'rgba(20,20,25,0.95)' },
          { c0: 'Consec W/L', c1: d.consecStr, c0Color: 'rgb(200,200,210)', c1Color: 'rgb(180,220,180)', bg: 'rgba(10,10,18,0.95)' },
        ];

        // Append Last keepN Trades Audit rows
        if (d.stats && d.stats.recentTrades.length > 0) {
          rows.push({
            c0: `TRADE LOG (LAST ${Math.min(d.stats.recentTrades.length, d.keepN)})`,
            c1: `${d.stats.wins}W · ${d.stats.losses}L`,
            c0Color: '#facc15',
            c1Color: '#facc15',
            bg: 'rgba(40,35,15,0.95)',
          });

          d.stats.recentTrades.slice(0, Math.min(d.keepN, 20)).forEach((tr, i) => {
            const badge = tr.isWin
              ? `✓ WIN (${tr.exitReason.includes('TP3') ? 'TP3' : tr.exitReason.includes('TP2') ? 'TP2' : 'TP1'})`
              : '✕ LOSS';
            const badgeCol = tr.isWin ? 'rgb(0, 220, 130)' : 'rgb(255, 60, 60)';
            const dirIcon = tr.dir === 'BULL' ? '▲' : '▼';
            rows.push({
              c0: `#${i + 1} ${dirIcon} ${tr.dir}`,
              c1: `${badge}`,
              c0Color: tr.dir === 'BULL' ? 'rgb(0, 200, 120)' : 'rgb(220, 50, 50)',
              c1Color: badgeCol,
              bg: i % 2 === 0 ? 'rgba(10,10,18,0.95)' : 'rgba(18,18,30,0.95)',
            });
          });
        }

        const numRows = rows.length;
        const tableH = rowH * numRows;

        // Position: Top Right (respecting right price scale and existing dashboards)
        const tableX = (settings.indicators.showMarketStructureSignals ?? false)
          ? chartWidth - tableW - 220
          : chartWidth - tableW - 12;
        const tableY = 40;

        // Frame and border (color.rgb(50,50,70,20), border_width=1)
        ctx.fillStyle = settings.indicators.msttDashBgColor ?? 'rgb(10,10,18)';
        ctx.strokeStyle = 'rgba(60,60,90,0.9)';
        ctx.lineWidth = 1;
        ctx.fillRect(tableX, tableY, tableW, tableH);
        ctx.strokeRect(tableX, tableY, tableW, tableH);

        ctx.font = '10px JetBrains Mono, monospace';
        const txtColorDefault = settings.indicators.msttDashTxtColor ?? 'rgb(220,220,235)';

        rows.forEach((r, idx) => {
          const rowY = tableY + idx * rowH;
          // Row background
          ctx.fillStyle = r.bg;
          ctx.fillRect(tableX, rowY, tableW, rowH);

          // Grid line
          ctx.strokeStyle = 'rgba(50,50,70,0.4)';
          ctx.strokeRect(tableX, rowY, tableW, rowH);

          // Column 0 (Left aligned)
          ctx.fillStyle = r.c0Color ?? txtColorDefault;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(r.c0, tableX + 6, rowY + rowH / 2);

          // Column 1 (Right aligned)
          ctx.fillStyle = r.c1Color;
          ctx.textAlign = 'right';
          ctx.fillText(r.c1, tableX + tableW - 6, rowY + rowH / 2);
        });
      }

      ctx.restore();
    }

    // ==========================================
    // 3M. Render Premium Signals with Dynamic TP & SL Optimization
    // ==========================================
    if (dynamicTpSlResults && (settings.indicators.showDynamicTpSlSignals ?? true)) {
      ctx.save();
      const ch1Color = settings.indicators.dynCh1Color ?? '#38bdf8';
      const ch2Color = settings.indicators.dynCh2Color ?? '#818cf8';
      const buyColor = settings.indicators.dynBuyColor ?? '#10b981';
      const sellColor = settings.indicators.dynSellColor ?? '#ef4444';
      const showChannels = settings.indicators.dynShowChannels ?? true;
      const showFill = settings.indicators.dynShowFill ?? true;
      const showSignals = settings.indicators.dynShowSignals ?? true;
      const showTpSlLines = settings.indicators.dynShowTpSlLines ?? true;

      const channelsData = dynamicTpSlResults.channels;

      // 1. Draw Channels & Shaded Band
      if (showChannels && channelsData.length > 0) {
        const visibleStart = Math.max(0, start - 5);
        const visibleEnd = Math.min(channelsData.length - 1, end + 5);

        if (showFill && visibleEnd > visibleStart) {
          // Fill Channel 1 Upper to Channel 2 Upper
          ctx.beginPath();
          for (let i = visibleStart; i <= visibleEnd; i++) {
            const x = getXFromIndex(i);
            const y = getYFromPrice(channelsData[i].upper1);
            if (i === visibleStart) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let i = visibleEnd; i >= visibleStart; i--) {
            const x = getXFromIndex(i);
            const y = getYFromPrice(channelsData[i].upper2);
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = hexToRgba(ch1Color, 0.06);
          ctx.fill();

          // Fill Channel 1 Lower to Channel 2 Lower
          ctx.beginPath();
          for (let i = visibleStart; i <= visibleEnd; i++) {
            const x = getXFromIndex(i);
            const y = getYFromPrice(channelsData[i].lower1);
            if (i === visibleStart) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let i = visibleEnd; i >= visibleStart; i--) {
            const x = getXFromIndex(i);
            const y = getYFromPrice(channelsData[i].lower2);
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = hexToRgba(ch2Color, 0.06);
          ctx.fill();
        }

        // Draw Channel 1 (Short-term)
        ctx.strokeStyle = hexToRgba(ch1Color, 0.85);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 2]);

        // Channel 1 Upper
        ctx.beginPath();
        for (let i = visibleStart; i <= visibleEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(channelsData[i].upper1);
          if (i === visibleStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Channel 1 Lower
        ctx.beginPath();
        for (let i = visibleStart; i <= visibleEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(channelsData[i].lower1);
          if (i === visibleStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw Channel 2 (Long-term Confirmation)
        ctx.strokeStyle = hexToRgba(ch2Color, 0.95);
        ctx.lineWidth = 1.6;
        ctx.setLineDash([]);

        // Channel 2 Upper
        ctx.beginPath();
        for (let i = visibleStart; i <= visibleEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(channelsData[i].upper2);
          if (i === visibleStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Channel 2 Lower
        ctx.beginPath();
        for (let i = visibleStart; i <= visibleEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(channelsData[i].lower2);
          if (i === visibleStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Draw Confirmed Signals (Strictly triggered on the 2nd confirmation candle!)
      if (showSignals) {
        dynamicTpSlResults.operations.forEach((op) => {
          if (op.startIndex < start - 3 || op.startIndex > end + 3) return;
          const x = getXFromIndex(op.startIndex);
          const candle = candles[op.startIndex];
          if (!candle) return;

          const isBuy = op.type === 'BUY';
          const signalY = isBuy ? getYFromPrice(candle.low) : getYFromPrice(candle.high);

          ctx.save();
          if (isBuy) {
            // GREEN UP ARROW & BADGE (Confirmed Buy 🟢)
            const arrowTipY = signalY + 4;
            ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = buyColor;
            ctx.beginPath();
            ctx.moveTo(x, arrowTipY);
            ctx.lineTo(x - 6, arrowTipY + 9);
            ctx.lineTo(x - 2.5, arrowTipY + 9);
            ctx.lineTo(x - 2.5, arrowTipY + 16);
            ctx.lineTo(x + 2.5, arrowTipY + 16);
            ctx.lineTo(x + 2.5, arrowTipY + 9);
            ctx.lineTo(x + 6, arrowTipY + 9);
            ctx.closePath();
            ctx.fill();

            // Text pill
            const text = 'BUY 🟢';
            ctx.font = 'bold 9px monospace';
            const tw = ctx.measureText(text).width;
            const bW = tw + 8;
            const bH = 15;
            const bY = arrowTipY + 18;

            ctx.fillStyle = 'rgba(5, 46, 22, 0.95)';
            ctx.strokeStyle = buyColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(x - bW / 2, bY, bW, bH, 3);
            } else {
              ctx.rect(x - bW / 2, bY, bW, bH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, bY + bH / 2);
          } else {
            // RED DOWN ARROW & BADGE (Confirmed Sell 🔴)
            const arrowTipY = signalY - 4;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = sellColor;
            ctx.beginPath();
            ctx.moveTo(x, arrowTipY);
            ctx.lineTo(x - 6, arrowTipY - 9);
            ctx.lineTo(x - 2.5, arrowTipY - 9);
            ctx.lineTo(x - 2.5, arrowTipY - 16);
            ctx.lineTo(x + 2.5, arrowTipY - 16);
            ctx.lineTo(x + 2.5, arrowTipY - 9);
            ctx.lineTo(x + 6, arrowTipY - 9);
            ctx.closePath();
            ctx.fill();

            // Text pill
            const text = 'SELL 🔴';
            ctx.font = 'bold 9px monospace';
            const tw = ctx.measureText(text).width;
            const bW = tw + 8;
            const bH = 15;
            const bY = arrowTipY - 18 - bH;

            ctx.fillStyle = 'rgba(76, 5, 25, 0.95)';
            ctx.strokeStyle = sellColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(x - bW / 2, bY, bW, bH, 3);
            } else {
              ctx.rect(x - bW / 2, bY, bW, bH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, bY + bH / 2);
          }
          ctx.restore();
        });
      }

      // 3. Draw Dynamic TP and SL Brackets on Active/Recent Operations
      if (showTpSlLines && dynamicTpSlResults.operations.length > 0) {
        // Draw brackets for active and up to 3 most recent operations
        const opsToDraw = dynamicTpSlResults.operations.slice(-3);

        opsToDraw.forEach((op) => {
          const startX = getXFromIndex(op.startIndex);
          const endBarIndex = op.endIndex ?? Math.min(candles.length + 15, op.startIndex + 40);
          const endX = Math.min(chartWidth, getXFromIndex(endBarIndex));
          if (endX < 0 || startX > chartWidth) return;

          const isBuy = op.type === 'BUY';
          const decimals = activeSymbolSpec.decimals || 2;
          const yEntry = getYFromPrice(op.entryPrice);
          const yTp1 = getYFromPrice(op.tp1Price);
          const yTp2 = getYFromPrice(op.tp2Price);
          const yTp3 = getYFromPrice(op.tp3Price);
          const ySl = getYFromPrice(op.slPrice);

          // Subtle shaded zones
          // TP zone (green tint)
          const tpTopY = Math.min(yEntry, yTp3);
          const tpH = Math.abs(yTp3 - yEntry);
          ctx.fillStyle = isBuy ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.05)';
          ctx.fillRect(startX, tpTopY, endX - startX, tpH);

          // SL zone (red tint)
          const slTopY = Math.min(yEntry, ySl);
          const slH = Math.abs(ySl - yEntry);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
          ctx.fillRect(startX, slTopY, endX - startX, slH);

          // Entry Ray
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, yEntry);
          ctx.lineTo(endX, yEntry);
          ctx.stroke();

          // TP1 Ray
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.moveTo(startX, yTp1);
          ctx.lineTo(endX, yTp1);
          ctx.stroke();

          // TP2 Ray
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(startX, yTp2);
          ctx.lineTo(endX, yTp2);
          ctx.stroke();

          // TP3 Ray (Full Target)
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(startX, yTp3);
          ctx.lineTo(endX, yTp3);
          ctx.stroke();

          // SL Ray (50% TP3)
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(startX, ySl);
          ctx.lineTo(endX, ySl);
          ctx.stroke();

          // Price Tag Badges at endX
          ctx.font = 'bold 8.5px monospace';
          ctx.textBaseline = 'middle';

          const drawTag = (price: number, label: string, color: string, yPos: number, isHit = false) => {
            const text = `${label} ${price.toFixed(decimals)}${isHit ? ' ✓' : ''}`;
            const tw = ctx.measureText(text).width;
            const bX = Math.min(chartWidth - tw - 8, endX + 4);
            ctx.fillStyle = hexToRgba(color, 0.95);
            ctx.fillRect(bX, yPos - 7, tw + 8, 14);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(text, bX + 4, yPos);
          };

          drawTag(op.tp3Price, 'TP3', '#10b981', yTp3, !!op.tp3HitIndex);
          drawTag(op.tp2Price, 'TP2', '#34d399', yTp2, !!op.tp2HitIndex);
          drawTag(op.tp1Price, 'TP1', '#38bdf8', yTp1, !!op.tp1HitIndex);
          drawTag(op.slPrice, 'SL', '#ef4444', ySl, !!op.slHitIndex);
        });
      }

      ctx.restore();
    }

    // ==========================================
    // 3N. Render VIP Market Scanner Alignment Badge
    // ==========================================
    if (vipScannerResults && (settings.indicators.showVipMarketScanner ?? true)) {
      if (vipScannerResults.alignmentAlert && (settings.indicators.vipScannerShowSignals ?? true)) {
        const latestIdx = candles.length - 1;
        if (latestIdx >= start && latestIdx <= end) {
          const x = getXFromIndex(latestIdx);
          const c = candles[latestIdx];
          const badgeY = 25;

          ctx.save();
          ctx.font = 'bold 9px monospace';
          const alertText = vipScannerResults.alignmentAlert;
          const tw = ctx.measureText(alertText).width;
          const bW = tw + 14;
          const bH = 18;

          ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x - bW / 2, badgeY, bW, bH, 4);
          } else {
            ctx.rect(x - bW / 2, badgeY, bW, bH);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(alertText, x, badgeY + bH / 2);
          ctx.restore();
        }
      }
    }

    // =========================================================================
    // 3O. Trade Planner Buy Sell Signals, Stop Loss, TP [LunqFX]
    // Exact TradingView Port: Water-like Value Zone, Moving EMA lines,
    // Risk/Reward Boxes, TP1/2/3 & SL target lines & badges, Buy/Sell signals
    // =========================================================================
    if ((settings.indicators.showTradePlanner ?? true) && tradePlannerResults) {
      ctx.save();
      const vZone = tradePlannerResults.valueZone;
      const vStart = Math.max(0, start - 3);
      const vEnd = Math.min(candles.length - 1, end + 3);

      // 1. Water-like Moving Value Zone Ribbon (fill between Fast EMA + zone and Fast EMA - zone)
      if ((settings.indicators.tpShowZone ?? true) && vZone.length > 0) {
        // Build wave polygon for the ribbon
        ctx.beginPath();
        // Top boundary
        for (let i = vStart; i <= vEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(vZone[i]?.zTop ?? candles[i].close);
          if (i === vStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // Bottom boundary reversed
        for (let i = vEnd; i >= vStart; i--) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(vZone[i]?.zBot ?? candles[i].close);
          ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Water-like translucent gradient/tint
        const latestZCol = vZone[candles.length - 1]?.color || LUNQ_PALETTE.MUTE;
        ctx.fillStyle = hexToRgba(latestZCol, 0.12);
        ctx.fill();

        // Boundary lines for the ribbon (water ripples)
        ctx.strokeStyle = hexToRgba(latestZCol, 0.28);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);

        // Top line
        ctx.beginPath();
        for (let i = vStart; i <= vEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(vZone[i]?.zTop ?? candles[i].close);
          if (i === vStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Bottom line
        ctx.beginPath();
        for (let i = vStart; i <= vEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(vZone[i]?.zBot ?? candles[i].close);
          if (i === vStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Fast EMA & Slow EMA Moving Lines ("line in scren")
      if ((settings.indicators.tpShowEmaLines ?? true) && vZone.length > 0) {
        // Fast EMA (lineWidth = 2)
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = vStart; i <= vEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(vZone[i]?.emaF ?? candles[i].close);
          const col = vZone[i]?.color || LUNQ_PALETTE.MUTE;
          ctx.strokeStyle = hexToRgba(col, 0.85);
          if (i === vStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Slow EMA (lineWidth = 1.2)
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = vStart; i <= vEnd; i++) {
          const x = getXFromIndex(i);
          const y = getYFromPrice(vZone[i]?.emaS ?? candles[i].close);
          const col = vZone[i]?.color || LUNQ_PALETTE.MUTE;
          ctx.strokeStyle = hexToRgba(col, 0.50);
          if (i === vStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 3. Trade Plans (Risk/Reward Boxes, Target Rays, Labels & Signals)
      const plans = tradePlannerResults.plans;
      const tagSize = settings.indicators.tpTagSize ?? 'Normal';
      const tagFontPx = tagSize === 'Small' ? 8 : tagSize === 'Large' ? 11 : tagSize === 'Huge' ? 13 : 9.5;
      const tagH = tagSize === 'Small' ? 14 : tagSize === 'Large' ? 18 : tagSize === 'Huge' ? 22 : 16;

      plans.forEach((plan) => {
        const x1 = getXFromIndex(plan.entryBar);
        const x2 = getXFromIndex(plan.endBar);
        const renderX1 = Math.max(0, x1);
        const renderX2 = Math.min(chartWidth, x2);
        if (renderX2 <= renderX1) return;

        const yEntry = getYFromPrice(plan.entryPrice);
        const ySL = getYFromPrice(plan.slPrice);
        const yTP1 = getYFromPrice(plan.tp1Price);
        const yTP2 = getYFromPrice(plan.tp2Price);
        const yTP3 = getYFromPrice(plan.tp3Price);

        // A. Risk & Reward Boxes (only drawn if enabled and target toggles active)
        if (settings.indicators.tpShowPlans ?? true) {
          // Risk Box (Entry to SL - only if tpShowSl is ON)
          if (settings.indicators.tpShowSl ?? true) {
            const riskTopY = Math.min(yEntry, ySL);
            const riskBotY = Math.max(yEntry, ySL);
            const riskH = Math.max(1, riskBotY - riskTopY);

            ctx.fillStyle = hexToRgba(LUNQ_PALETTE.RISK, 0.15);
            ctx.fillRect(renderX1, riskTopY, renderX2 - renderX1, riskH);
            ctx.strokeStyle = hexToRgba(LUNQ_PALETTE.RISK, 0.45);
            ctx.lineWidth = 1;
            ctx.strokeRect(renderX1, riskTopY, renderX2 - renderX1, riskH);
          }

          // Reward Box (Entry to highest active TP target: TP3 -> TP2 -> TP1)
          const targetTpY = (settings.indicators.tpShowTp3 ?? true)
            ? yTP3
            : (settings.indicators.tpShowTp2 ?? true)
            ? yTP2
            : (settings.indicators.tpShowTp1 ?? true)
            ? yTP1
            : null;

          if (targetTpY !== null) {
            const rewTopY = Math.min(yEntry, targetTpY);
            const rewBotY = Math.max(yEntry, targetTpY);
            const rewH = Math.max(1, rewBotY - rewTopY);
            const rewCol = plan.dir === 1 ? LUNQ_PALETTE.UP : LUNQ_PALETTE.DN;

            ctx.fillStyle = hexToRgba(rewCol, 0.12);
            ctx.fillRect(renderX1, rewTopY, renderX2 - renderX1, rewH);
            ctx.strokeStyle = hexToRgba(rewCol, 0.40);
            ctx.lineWidth = 1;
            ctx.strokeRect(renderX1, rewTopY, renderX2 - renderX1, rewH);
          }
        }

        // B. Target & SL Lines + Dotted Tracking Lines
        if (settings.indicators.tpShowPlans ?? true) {
          const showDotted = settings.indicators.tpShowDottedLines ?? true;

          // SL Line
          if (settings.indicators.tpShowSl ?? true) {
            ctx.strokeStyle = LUNQ_PALETTE.RISK;
            ctx.lineWidth = 1.4;
            if (showDotted) {
              ctx.setLineDash([3, 2]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.moveTo(renderX1, ySL);
            ctx.lineTo(renderX2, ySL);
            ctx.stroke();
          }

          // TP1 Line
          if (settings.indicators.tpShowTp1 ?? true) {
            ctx.strokeStyle = hexToRgba(LUNQ_PALETTE.GOLD, 0.95);
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 2]);
            ctx.beginPath();
            ctx.moveTo(renderX1, yTP1);
            ctx.lineTo(renderX2, yTP1);
            ctx.stroke();
          }

          // TP2 Line
          if (settings.indicators.tpShowTp2 ?? true) {
            ctx.strokeStyle = hexToRgba(LUNQ_PALETTE.UP, 0.95);
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 2]);
            ctx.beginPath();
            ctx.moveTo(renderX1, yTP2);
            ctx.lineTo(renderX2, yTP2);
            ctx.stroke();
          }

          // TP3 Line
          if (settings.indicators.tpShowTp3 ?? true) {
            ctx.strokeStyle = LUNQ_PALETTE.UP;
            ctx.lineWidth = 1.5;
            if (showDotted) {
              ctx.setLineDash([4, 2]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.moveTo(renderX1, yTP3);
            ctx.lineTo(renderX2, yTP3);
            ctx.stroke();
          }

          // Entry Level Dotted Line (when showDotted is enabled)
          if (showDotted) {
            ctx.strokeStyle = hexToRgba('#94A3B8', 0.45);
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(renderX1, yEntry);
            ctx.lineTo(renderX2, yEntry);
            ctx.stroke();
          }

          ctx.setLineDash([]);
        }

        // C. Level Tags at endBar
        const drawTagBadge = (text: string, priceY: number, col: string) => {
          ctx.font = `bold ${tagFontPx}px JetBrains Mono, monospace`;
          const tw = ctx.measureText(text).width;
          const bW = tw + 10;
          const bX = Math.min(chartWidth - bW - 4, renderX2 + 2);
          const bY = priceY - tagH / 2;

          ctx.fillStyle = LUNQ_PALETTE.CARD;
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(bX, bY, bW, tagH, 3);
          } else {
            ctx.rect(bX, bY, bW, tagH);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = col;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, bX + 5, priceY);
        };

        if (settings.indicators.tpShowPlans ?? true) {
          if (settings.indicators.tpShowSl ?? true) {
            drawTagBadge(plan.slLabelText, ySL, LUNQ_PALETTE.RISK);
          }
          if (settings.indicators.tpShowTp1 ?? true) {
            drawTagBadge(plan.tp1LabelText, yTP1, LUNQ_PALETTE.GOLD);
          }
          if (settings.indicators.tpShowTp2 ?? true) {
            drawTagBadge(plan.tp2LabelText, yTP2, LUNQ_PALETTE.UP);
          }
          if (settings.indicators.tpShowTp3 ?? true) {
            drawTagBadge(plan.tp3LabelText, yTP3, LUNQ_PALETTE.UP);
          }
        }
      });

      // 4. Buy / Sell Retest Entry Arrows (Rendered for ALL detected EMA retests across the chart!)
      if ((settings.indicators.tpShowSignals ?? true) && tradePlannerResults.signals) {
        tradePlannerResults.signals.forEach((sig) => {
          if (sig.barIndex < start - 2 || sig.barIndex > end + 2) return;
          const entryBarCandle = candles[sig.barIndex];
          if (!entryBarCandle) return;

          const x = getXFromIndex(sig.barIndex);
          const isBuy = sig.dir === 1;
          const sigCol = isBuy ? LUNQ_PALETTE.UP : LUNQ_PALETTE.DN;
          const signalY = isBuy ? getYFromPrice(entryBarCandle.low) : getYFromPrice(entryBarCandle.high);

          // Signal Arrow
          const arrowTipY = isBuy ? signalY + 4 : signalY - 4;
          ctx.save();
          ctx.fillStyle = sigCol;
          ctx.beginPath();
          if (isBuy) {
            ctx.moveTo(x, arrowTipY);
            ctx.lineTo(x - 6, arrowTipY + 9);
            ctx.lineTo(x - 2.5, arrowTipY + 9);
            ctx.lineTo(x - 2.5, arrowTipY + 15);
            ctx.lineTo(x + 2.5, arrowTipY + 15);
            ctx.lineTo(x + 2.5, arrowTipY + 9);
            ctx.lineTo(x + 6, arrowTipY + 9);
          } else {
            ctx.moveTo(x, arrowTipY);
            ctx.lineTo(x - 6, arrowTipY - 9);
            ctx.lineTo(x - 2.5, arrowTipY - 9);
            ctx.lineTo(x - 2.5, arrowTipY - 15);
            ctx.lineTo(x + 2.5, arrowTipY - 15);
            ctx.lineTo(x + 2.5, arrowTipY - 9);
            ctx.lineTo(x + 6, arrowTipY - 9);
          }
          ctx.closePath();
          ctx.fill();

          // Entry Text Pill: Only show if explicitly toggled ON (default: false, eliminates unit and text clutter)
          if (settings.indicators.tpShowEntryLabel ?? false) {
            const text = sig.labelText;
            ctx.font = `bold ${tagFontPx + 0.5}px JetBrains Mono, monospace`;
            const tw = ctx.measureText(text).width;
            const bW = tw + 10;
            const pillH = tagH + 2;
            const bY = isBuy ? arrowTipY + 17 : arrowTipY - 17 - pillH;

            ctx.fillStyle = LUNQ_PALETTE.CARD;
            ctx.strokeStyle = sigCol;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(x - bW / 2, bY, bW, pillH, 4);
            } else {
              ctx.rect(x - bW / 2, bY, bW, pillH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = sigCol;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, bY + pillH / 2);
          }
          ctx.restore();
        });
      }

      // 5. Audit Focus Highlight: When user clicks any trade in Trade Audit Log
      if (selectedTradePlannerTradeId) {
        const auditPlan =
          tradePlannerResults.plans.find((p) => p.id === selectedTradePlannerTradeId) ||
          tradePlannerResults.allHistoricalPlans?.find((p) => p.id === selectedTradePlannerTradeId);

        if (auditPlan) {
          const x1 = getXFromIndex(auditPlan.entryBar);
          const x2 = getXFromIndex(auditPlan.endBar);
          const renderX1 = Math.max(0, x1);
          const renderX2 = Math.min(chartWidth, x2);

          const yEntry = getYFromPrice(auditPlan.entryPrice);
          const ySL = getYFromPrice(auditPlan.slPrice);
          const yTP1 = getYFromPrice(auditPlan.tp1Price);

          ctx.save();
          const topBoxY = Math.min(yEntry, ySL, yTP1);
          const botBoxY = Math.max(yEntry, ySL, yTP1);
          const boxH = Math.max(28, botBoxY - topBoxY);
          const boxW = Math.max(48, renderX2 - renderX1);

          // Glowing animated focus frame
          ctx.strokeStyle = '#00F5D4';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(renderX1 - 4, topBoxY - 4, boxW + 8, boxH + 8);
          ctx.setLineDash([]);

          // Focus Badge
          const focusText = `📍 AUDIT FOCUS: Trade #${auditPlan.id} (${auditPlan.dir === 1 ? 'BUY' : 'SELL'}) · ${auditPlan.isWin ? '✓ WIN' : '✗ LOSS'} (${auditPlan.exitReason || 'running'})`;
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          const tw = ctx.measureText(focusText).width + 16;
          ctx.fillStyle = '#0E141D';
          ctx.fillRect(renderX1, topBoxY - 26, tw, 20);
          ctx.strokeStyle = auditPlan.isWin ? '#00F5D4' : '#FF4D6D';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(renderX1, topBoxY - 26, tw, 20);
          ctx.fillStyle = auditPlan.isWin ? '#00F5D4' : '#FF4D6D';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(focusText, renderX1 + 8, topBoxY - 16);
          ctx.restore();
        }
      }

      ctx.restore();
    }

    // =========================================================================
    // 3P. Fibonacci Sequence Swing [ChartPrime]
    // ZigZag Swings, Fibonacci Sequence (0, 1, 1, 2, 3, 5, 8, 13, 21),
    // Retest Frequency Counters, Dynamic Levels & Advance Pivot Tell Arrows
    // =========================================================================
    if ((settings.indicators.showFibonacciSequenceSwing ?? true) && fibSwingResults) {
      ctx.save();
      const zigCol = settings.indicators.fibZigCol ?? 'rgb(146, 151, 167)';
      const showZigZag = settings.indicators.fibShowZigZag ?? true;
      const showLevels = settings.indicators.fibShowLevels ?? true;
      const showLabels = settings.indicators.fibShowLabels ?? true;
      const showArrows = settings.indicators.fibShowArrows ?? true;
      const showHistorical = settings.indicators.fibShowHistorical ?? true;

      // 1. Draw ZigZag Dashed Segments
      if (showZigZag && fibSwingResults.zigzagSegments.length > 0) {
        ctx.strokeStyle = zigCol;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 3]);

        fibSwingResults.zigzagSegments.forEach((seg) => {
          const x1 = getXFromIndex(seg.x1);
          const y1 = getYFromPrice(seg.y1);
          const x2 = getXFromIndex(seg.x2);
          const y2 = getYFromPrice(seg.y2);

          if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > chartWidth) return;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // 2. Draw Historical Fibonacci Sequence Levels (completed past swings)
      if (showLevels && showHistorical && fibSwingResults.historicalLevels.length > 0) {
        fibSwingResults.historicalLevels.forEach((lvl) => {
          const x1 = getXFromIndex(lvl.x1);
          const x2 = getXFromIndex(lvl.x2);
          const y = getYFromPrice(lvl.price);

          if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > chartWidth || y < 0 || y > chartHeight) return;

          ctx.strokeStyle = lvl.color;
          ctx.lineWidth = lvl.width;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, x1), y);
          ctx.lineTo(Math.min(chartWidth, x2), y);
          ctx.stroke();

          // Small tag at end of historical level
          if (showLabels && x2 >= 0 && x2 <= chartWidth) {
            ctx.font = '8px JetBrains Mono, monospace';
            const tw = ctx.measureText(lvl.labelText).width;
            ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
            ctx.fillRect(x2 - tw - 4, y - 6, tw + 6, 12);
            ctx.fillStyle = lvl.color;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(lvl.labelText, x2 - 2, y);
          }
        });
      }

      // 3. Draw Active Live Fibonacci Sequence Levels (projected into future: bar_index + 5)
      if (showLevels && fibSwingResults.activeLevels.length > 0) {
        fibSwingResults.activeLevels.forEach((lvl) => {
          const x1 = getXFromIndex(lvl.x1);
          const x2 = getXFromIndex(lvl.x2);
          const y = getYFromPrice(lvl.price);

          if (y < 0 || y > chartHeight) return;

          const renderX1 = Math.max(0, x1);
          const renderX2 = Math.min(chartWidth + 30, x2);

          // Level Line with retest-frequency gradient color and width
          ctx.strokeStyle = lvl.color;
          ctx.lineWidth = lvl.width;
          ctx.beginPath();
          ctx.moveTo(renderX1, y);
          ctx.lineTo(renderX2, y);
          ctx.stroke();

          // Live Retest Badge / Tag at bar_index + 5 (projected ahead of price)
          if (showLabels) {
            ctx.font = 'bold 9px JetBrains Mono, monospace';
            const text = lvl.labelText;
            const tw = ctx.measureText(text).width;
            const bW = tw + 10;
            const bH = 15;
            const bX = Math.min(chartWidth - bW - 2, renderX2);
            const bY = y - bH / 2;

            ctx.fillStyle = 'rgba(14, 20, 29, 0.95)';
            ctx.strokeStyle = lvl.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(bX, bY, bW, bH, 3);
            } else {
              ctx.rect(bX, bY, bW, bH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = lvl.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, bX + 5, y);
          }
        });
      }

      // 4. Pivot Tell Arrows (▲ / ▼) printed at swings and projected ahead of price
      if (showArrows && fibSwingResults.pivotLabels.length > 0) {
        fibSwingResults.pivotLabels.forEach((p) => {
          const x = getXFromIndex(p.barIndex);
          const y = getYFromPrice(p.price);

          if (x < -50 || x > chartWidth + 50 || y < -30 || y > chartHeight + 30) return;

          const isUp = p.dir === 1;
          const arrowCol = isUp ? (settings.indicators.fibColUp ?? '#22c55e') : (settings.indicators.fibColDn ?? '#ef4444');

          ctx.save();
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          const lines = p.text.split('\n');
          const maxTw = Math.max(...lines.map((l) => ctx.measureText(l).width));
          const pW = maxTw + 12;
          const pH = 26;
          const pY = isUp ? y + 8 : y - pH - 8;

          // Background pill
          ctx.fillStyle = 'rgba(10, 15, 25, 0.92)';
          ctx.strokeStyle = arrowCol;
          ctx.lineWidth = p.isLive ? 1.5 : 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x - pW / 2, pY, pW, pH, 4);
          } else {
            ctx.rect(x - pW / 2, pY, pW, pH);
          }
          ctx.fill();
          ctx.stroke();

          // Render arrow and price lines
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (isUp) {
            // "▲\n" + price
            ctx.fillStyle = arrowCol;
            ctx.font = 'bold 11px JetBrains Mono, monospace';
            ctx.fillText('▲', x, pY + 7);
            ctx.fillStyle = zigCol;
            ctx.font = '9px JetBrains Mono, monospace';
            ctx.fillText(lines[1] || '', x, pY + 18);
          } else {
            // price + "\n▼"
            ctx.fillStyle = zigCol;
            ctx.font = '9px JetBrains Mono, monospace';
            ctx.fillText(lines[0] || '', x, pY + 8);
            ctx.fillStyle = arrowCol;
            ctx.font = 'bold 11px JetBrains Mono, monospace';
            ctx.fillText('▼', x, pY + 19);
          }

          ctx.restore();
        });
      }

      // 5. Live Candle 0 Early Turn Trajectory & Tell Badge
      if (showArrows && fibSwingResults.liveTurn) {
        const lt = fibSwingResults.liveTurn;
        const turnX = getXFromIndex(lt.barIndex);
        const turnY = getYFromPrice(lt.price);
        const candle0X = getXFromIndex(candles.length - 1);
        const targetY = getYFromPrice(lt.targetPrice);
        const isUp = lt.dir === 1;
        const liveCol = isUp ? (settings.indicators.fibColUp ?? '#22c55e') : (settings.indicators.fibColDn ?? '#ef4444');

        ctx.save();

        // Dashed trajectory ray from turn pivot towards target price ahead of candle 0
        ctx.strokeStyle = hexToRgba(liveCol, 0.70);
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(turnX, turnY);
        ctx.lineTo(candle0X + 30, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target Horizontal Level Tag
        ctx.strokeStyle = liveCol;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(turnX, targetY);
        ctx.lineTo(candle0X + 35, targetY);
        ctx.stroke();

        ctx.font = 'bold 9px JetBrains Mono, monospace';
        const targetText = `FIB 21 TARGET: ${lt.targetPrice.toFixed(2)}`;
        const tw = ctx.measureText(targetText).width;
        const tgX = Math.min(chartWidth - tw - 8, candle0X + 38);
        ctx.fillStyle = isUp ? 'rgba(6, 78, 59, 0.95)' : 'rgba(136, 19, 55, 0.95)';
        ctx.fillRect(tgX, targetY - 8, tw + 8, 16);
        ctx.strokeStyle = liveCol;
        ctx.strokeRect(tgX, targetY - 8, tw + 8, 16);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(targetText, tgX + 4, targetY);

        // Advance Tell Pill right on Live Candle 0
        const c0Y = isUp ? getYFromPrice(candles[candles.length - 1].low) + 16 : getYFromPrice(candles[candles.length - 1].high) - 16;
        const badgeText = isUp ? '▲ LIVE EARLY BUY TELL' : '▼ LIVE EARLY SELL TELL';
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        const btw = ctx.measureText(badgeText).width;
        const bX = candle0X - btw / 2 - 6;
        const bY = isUp ? c0Y + 4 : c0Y - 20;

        ctx.fillStyle = isUp ? 'rgba(5, 46, 22, 0.95)' : 'rgba(76, 5, 25, 0.95)';
        ctx.strokeStyle = liveCol;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bX, bY, btw + 12, 18, 4);
        } else {
          ctx.rect(bX, bY, btw + 12, 18);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = liveCol;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, candle0X, bY + 9);

        ctx.restore();
      }

      ctx.restore();
    }

    // =========================================================================
    // 3Q. Multi-Timeframe EMA 15m 1H [Pine Script v6 Exact Port]
    // Mathematical logic is 100% strictly preserved (zero change to Pine Script values).
    // Visual Styles:
    //  - 'water_glaze' (default): Orderblock-style contoured ribbon channel with
    //    two crisp tiny bounding border lines on each side + inner color water shadow / glow,
    //    responsive to the user's chosen color15min and color60min, with luminous
    //    crossover intersection beacons and depth contrast.
    //  - 'line': Classic clean solid Pine Script plot line.
    // =========================================================================
    if ((settings.indicators.showMultiTimeframeEma ?? true) && mtfEmaResults) {
      ctx.save();
      const startIndex = Math.max(0, start - 5);
      const endIndex = Math.min(candles.length - 1, end + 5);
      const renderStyle = settings.indicators.mtfEmaRenderStyle ?? 'water_glaze';

      const userColor15 = mtfEmaResults.color15 || '#0d9488';
      const userColor60 = mtfEmaResults.color60 || '#0284c7';

      if (renderStyle === 'water_glaze') {
        // Collect coordinate points along the visible screen range
        interface Pt { x: number; y: number }
        const pts15: Pt[] = [];
        const pts60: Pt[] = [];

        for (let i = startIndex; i <= endIndex; i++) {
          const x = getXFromIndex(i);
          if (mtfEmaResults.show15 && mtfEmaResults.ema15[i] !== undefined && !isNaN(mtfEmaResults.ema15[i])) {
            pts15.push({ x, y: getYFromPrice(mtfEmaResults.ema15[i]) });
          }
          if (mtfEmaResults.show60 && mtfEmaResults.ema60[i] !== undefined && !isNaN(mtfEmaResults.ema60[i])) {
            pts60.push({ x, y: getYFromPrice(mtfEmaResults.ema60[i]) });
          }
        }

        // Helper to render an Orderblock-style ribbon line:
        // - In the middle: Soft water shadow / glow (translucent color)
        // - On both edges: 2 crisp tiny boundary lines that frame the ribbon like a precision rail
        // - At the center: High-gloss crystalline accent strand
        const renderOrderblockRibbon = (
          pts: Pt[],
          baseColor: string,
          halfThickness: number,
          isFast: boolean
        ) => {
          if (pts.length < 2) return;

          // Compute perpendicular offset normal vectors for each segment to form smooth top & bottom edge rails
          const topPts: Pt[] = [];
          const botPts: Pt[] = [];

          for (let i = 0; i < pts.length; i++) {
            let dx = 0;
            let dy = 0;
            if (i === 0) {
              dx = pts[1].x - pts[0].x;
              dy = pts[1].y - pts[0].y;
            } else if (i === pts.length - 1) {
              dx = pts[i].x - pts[i - 1].x;
              dy = pts[i].y - pts[i - 1].y;
            } else {
              dx = pts[i + 1].x - pts[i - 1].x;
              dy = pts[i + 1].y - pts[i - 1].y;
            }

            const len = Math.hypot(dx, dy) || 1;
            // Perpendicular unit vector (-dy, dx)
            const nx = -dy / len;
            const ny = dx / len;

            topPts.push({ x: pts[i].x + nx * halfThickness, y: pts[i].y + ny * halfThickness });
            botPts.push({ x: pts[i].x - nx * halfThickness, y: pts[i].y - ny * halfThickness });
          }

          // 1. Fill Middle Water Shadow / Glaze Body (Orderblock style ribbon fill)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(topPts[0].x, topPts[0].y);
          for (let i = 1; i < topPts.length; i++) {
            ctx.lineTo(topPts[i].x, topPts[i].y);
          }
          for (let i = botPts.length - 1; i >= 0; i--) {
            ctx.lineTo(botPts[i].x, botPts[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = hexToRgba(baseColor, isFast ? 0.38 : 0.32);
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();

          // 2. Draw the 2 Tiny Crisp Boundary Edge Lines (Top Rail & Bottom Rail)
          ctx.save();
          ctx.lineWidth = 1.0;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = hexToRgba(baseColor, 0.95);
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 3;

          // Top rail
          ctx.beginPath();
          ctx.moveTo(topPts[0].x, topPts[0].y);
          for (let i = 1; i < topPts.length; i++) {
            ctx.lineTo(topPts[i].x, topPts[i].y);
          }
          ctx.stroke();

          // Bottom rail
          ctx.beginPath();
          ctx.moveTo(botPts[0].x, botPts[0].y);
          for (let i = 1; i < botPts.length; i++) {
            ctx.lineTo(botPts[i].x, botPts[i].y);
          }
          ctx.stroke();
          ctx.restore();

          // 3. Ultra-Fine Glossy Specular Centerline (Water Crest / Glaze Sheen)
          ctx.save();
          ctx.lineWidth = 0.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = 0.65;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
          ctx.restore();
        };

        // Render 1-Hour EMA first (base slow foundation)
        if (mtfEmaResults.show60 && pts60.length >= 2) {
          renderOrderblockRibbon(pts60, userColor60, 4.2, false);
        }

        // Render 15-Minute EMA on top (dynamic fast ribbon)
        if (mtfEmaResults.show15 && pts15.length >= 2) {
          renderOrderblockRibbon(pts15, userColor15, 3.2, true);
        }

        // =====================================================================
        // Distinct Cross Detection & High-Visibility Crossover Indicators
        // When 15m and 1H cross each other, highlight the intersection clearly!
        // =====================================================================
        if (mtfEmaResults.show15 && mtfEmaResults.show60) {
          for (let i = startIndex; i < endIndex; i++) {
            const v15_a = mtfEmaResults.ema15[i];
            const v60_a = mtfEmaResults.ema60[i];
            const v15_b = mtfEmaResults.ema15[i + 1];
            const v60_b = mtfEmaResults.ema60[i + 1];

            if (
              v15_a !== undefined && v60_a !== undefined &&
              v15_b !== undefined && v60_b !== undefined &&
              !isNaN(v15_a) && !isNaN(v60_a) && !isNaN(v15_b) && !isNaN(v60_b)
            ) {
              const diffA = v15_a - v60_a;
              const diffB = v15_b - v60_b;

              // Check if signs inverted (Crossover happened between bar i and i+1)
              if ((diffA <= 0 && diffB > 0) || (diffA >= 0 && diffB < 0)) {
                const isBullish = diffB > 0;
                // Linear interpolation to find the exact sub-pixel intersection point
                const denom = (diffA - diffB);
                const t = denom !== 0 ? Math.max(0, Math.min(1, diffA / denom)) : 0.5;

                const crossX = getXFromIndex(i) + (getXFromIndex(i + 1) - getXFromIndex(i)) * t;
                const crossPrice = v15_a + (v15_b - v15_a) * t;
                const crossY = getYFromPrice(crossPrice);

                ctx.save();
                // 1. Cross Aura Halo
                ctx.beginPath();
                ctx.arc(crossX, crossY, 8, 0, Math.PI * 2);
                ctx.fillStyle = isBullish ? 'rgba(52, 211, 153, 0.35)' : 'rgba(248, 113, 113, 0.35)';
                ctx.shadowColor = isBullish ? '#10b981' : '#ef4444';
                ctx.shadowBlur = 10;
                ctx.fill();

                // 2. Cross Outer Ring (Bold distinct marker)
                ctx.beginPath();
                ctx.arc(crossX, crossY, 4.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = isBullish ? '#059669' : '#dc2626';
                ctx.lineWidth = 2.2;
                ctx.fill();
                ctx.stroke();

                // 3. Cross Diamond Beacon Sparkle
                ctx.beginPath();
                ctx.arc(crossX, crossY, 1.8, 0, Math.PI * 2);
                ctx.fillStyle = isBullish ? '#10b981' : '#f43f5e';
                ctx.fill();
                ctx.restore();
              }
            }
          }
        }
      } else {
        // === CLASSIC LINE (Untouched Clean Pine Script Plot Line) ===
        // 1. Plot 15-minute EMA
        if (mtfEmaResults.show15 && mtfEmaResults.ema15.length > 0) {
          ctx.strokeStyle = userColor15;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.setLineDash([]);
          ctx.beginPath();
          let started15 = false;

          for (let i = startIndex; i <= endIndex; i++) {
            const val = mtfEmaResults.ema15[i];
            if (val === undefined || isNaN(val)) continue;
            const x = getXFromIndex(i);
            const y = getYFromPrice(val);
            if (!started15) {
              ctx.moveTo(x, y);
              started15 = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          if (started15) {
            ctx.stroke();
          }
        }

        // 2. Plot 1-hour EMA
        if (mtfEmaResults.show60 && mtfEmaResults.ema60.length > 0) {
          ctx.strokeStyle = userColor60;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.setLineDash([]);
          ctx.beginPath();
          let started60 = false;

          for (let i = startIndex; i <= endIndex; i++) {
            const val = mtfEmaResults.ema60[i];
            if (val === undefined || isNaN(val)) continue;
            const x = getXFromIndex(i);
            const y = getYFromPrice(val);
            if (!started60) {
              ctx.moveTo(x, y);
              started60 = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          if (started60) {
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    }

    // =========================================================================
    // Render Mrov Trade: Opening Range (Pine Script v6 1:1 Implementation)
    // =========================================================================
    if ((settings.indicators.showMrovOpeningRange ?? false) && mrovTradeResults) {
      ctx.save();

      // Check timeframe validity: if invalid, show helpful message banner
      if (!mrovTradeResults.validTimeframe) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1;
        const alertW = Math.min(chartWidth - 40, 520);
        const alertH = 28;
        const alertX = 20;
        const alertY = 16;
        ctx.beginPath();
        ctx.roundRect(alertX, alertY, alertW, alertH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          '⚠️ Mrov Trade: Incompatible timeframe. Use 1m, 2m, 3m, 5m, 15m, or 30m for NY 09:30–10:00.',
          alertX + 10,
          alertY + alertH / 2
        );
      } else {
        const rangeColor = settings.indicators.mrovRangeColor || '#2979ff';
        const fillAlpha = Math.max(0.02, Math.min(1, (100 - (settings.indicators.mrovFillTransparency ?? 88)) / 100));
        const borderWidth = Math.max(1, Math.min(4, settings.indicators.mrovBorderWidth ?? 2));
        const levelWidth = Math.max(1, Math.min(4, settings.indicators.mrovLevelWidth ?? 2));
        const showCaption = settings.indicators.mrovShowRangeCaption ?? true;

        const longColor = settings.indicators.mrovLongColor || '#00c878';
        const shortColor = settings.indicators.mrovShortColor || '#e64646';
        const showSignalLabels = settings.indicators.mrovShowSignalLabels ?? true;
        const showBreakoutMarker = settings.indicators.mrovShowBreakoutMarker ?? true;

        const showTradeGrid = settings.indicators.mrovShowTradeGrid ?? true;
        const riskColor = settings.indicators.mrovRiskColor || '#dc4155';
        const rewardColor = settings.indicators.mrovRewardColor || '#00a078';
        const entryColor = settings.indicators.mrovEntryColor || '#e6e6e6';
        const zoneAlpha = Math.max(0.02, Math.min(1, (100 - (settings.indicators.mrovZoneTransparency ?? 78)) / 100));

        // 1. Draw Opening Range Boxes & Level Lines
        mrovTradeResults.ranges.forEach((box) => {
          if (box.highLineEndIndex < start - 20 || box.startBarIndex > end + 20) return;

          const bx1 = getXFromIndex(box.startBarIndex);
          const bx2 = getXFromIndex(box.endBarIndex);
          const byTop = getYFromPrice(box.high);
          const byBottom = getYFromPrice(box.low);

          const boxWidth = Math.max(2, bx2 - bx1);
          const boxHeight = Math.max(2, byBottom - byTop);

          // Fill Box
          ctx.save();
          ctx.globalAlpha = fillAlpha;
          ctx.fillStyle = rangeColor;
          ctx.fillRect(bx1, byTop, boxWidth, boxHeight);
          ctx.restore();

          // Stroke Box
          ctx.save();
          ctx.strokeStyle = rangeColor;
          ctx.lineWidth = borderWidth;
          ctx.strokeRect(bx1, byTop, boxWidth, boxHeight);
          ctx.restore();

          // High / Low Level Lines extending right
          if (box.isComplete) {
            const hLineEnd = getXFromIndex(box.highLineEndIndex);
            const lLineEnd = getXFromIndex(box.lowLineEndIndex);

            ctx.save();
            ctx.strokeStyle = rangeColor;
            ctx.lineWidth = levelWidth;
            ctx.setLineDash([]);

            // Upper High Line
            ctx.beginPath();
            ctx.moveTo(bx2, byTop);
            ctx.lineTo(hLineEnd, byTop);
            ctx.stroke();

            // Lower Low Line
            ctx.beginPath();
            ctx.moveTo(bx2, byBottom);
            ctx.lineTo(lLineEnd, byBottom);
            ctx.stroke();

            ctx.restore();

            // Caption Label: "NY OPENING RANGE\n09:30–10:00"
            if (showCaption && bx2 >= 0 && bx2 <= chartWidth + 100) {
              const capY = getYFromPrice(box.high + (box.high - box.low) * 0.05);
              const capX = getXFromIndex(Math.max(box.startBarIndex, box.endBarIndex - 3));

              ctx.save();
              ctx.font = 'bold 9px JetBrains Mono, monospace';
              const text1 = 'NY OPENING RANGE';
              const text2 = '09:30–10:00';
              const tw = Math.max(ctx.measureText(text1).width, ctx.measureText(text2).width) + 12;
              const th = 26;

              // Draw Down-label style badge
              ctx.fillStyle = rangeColor;
              ctx.beginPath();
              ctx.roundRect(capX - tw / 2, capY - th - 5, tw, th, 4);
              ctx.fill();

              // Down pointer triangle
              ctx.beginPath();
              ctx.moveTo(capX - 4, capY - 5);
              ctx.lineTo(capX + 4, capY - 5);
              ctx.lineTo(capX, capY);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(text1, capX, capY - th - 3);
              ctx.fillText(text2, capX, capY - th + 9);
              ctx.restore();
            }
          }
        });

        // 2. Draw Trade Grids (Risk / Reward Zones, Entry, Stop, Target, Signals)
        if (showTradeGrid) {
          mrovTradeResults.trades.forEach((trade) => {
            if (trade.currentRightIndex < start - 20 || trade.breakoutBarIndex > end + 20) return;

            const tx1 = getXFromIndex(trade.breakoutBarIndex);
            const tx2 = getXFromIndex(trade.currentRightIndex);
            const gridWidth = Math.max(4, tx2 - tx1);

            const tEntryY = getYFromPrice(trade.entryPrice);
            const tStopY = getYFromPrice(trade.stopPrice);
            const tTargetY = getYFromPrice(trade.targetPrice);

            const isLong = trade.direction === 1;

            // Risk Zone Box
            const riskTopY = isLong ? tEntryY : tStopY;
            const riskBottomY = isLong ? tStopY : tEntryY;
            const riskHeight = Math.max(1, riskBottomY - riskTopY);

            ctx.save();
            ctx.globalAlpha = zoneAlpha;
            ctx.fillStyle = riskColor;
            ctx.fillRect(tx1, riskTopY, gridWidth, riskHeight);
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = riskColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(tx1, riskTopY, gridWidth, riskHeight);
            ctx.restore();

            // Reward Zone Box
            const rewTopY = isLong ? tTargetY : tEntryY;
            const rewBottomY = isLong ? tEntryY : tTargetY;
            const rewHeight = Math.max(1, rewBottomY - rewTopY);

            ctx.save();
            ctx.globalAlpha = zoneAlpha;
            ctx.fillStyle = rewardColor;
            ctx.fillRect(tx1, rewTopY, gridWidth, rewHeight);
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = rewardColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(tx1, rewTopY, gridWidth, rewHeight);
            ctx.restore();

            // Entry Line (Solid)
            ctx.save();
            ctx.strokeStyle = entryColor;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(tx1, tEntryY);
            ctx.lineTo(tx2, tEntryY);
            ctx.stroke();

            // Stop Line (Dashed)
            ctx.strokeStyle = riskColor;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(tx1, tStopY);
            ctx.lineTo(tx2, tStopY);
            ctx.stroke();

            // Target Line (Dashed)
            ctx.strokeStyle = rewardColor;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(tx1, tTargetY);
            ctx.lineTo(tx2, tTargetY);
            ctx.stroke();
            ctx.restore();

            // Breakout Marker Dot
            if (showBreakoutMarker) {
              ctx.save();
              ctx.fillStyle = isLong ? longColor : shortColor;
              ctx.beginPath();
              ctx.arc(tx1, tEntryY, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.restore();
            }

            // Signal Label (LONG / SHORT)
            if (showSignalLabels) {
              const candle = candles[trade.breakoutBarIndex];
              const sigPrice = isLong ? (candle ? candle.low : trade.stopPrice) : (candle ? candle.high : trade.stopPrice);
              const sigY = getYFromPrice(sigPrice);
              const labelY = isLong ? sigY + 14 : sigY - 14;

              ctx.save();
              ctx.font = 'bold 10px JetBrains Mono, monospace';
              const sigText = isLong ? 'LONG ▲' : 'SHORT ▼';
              const sigTw = ctx.measureText(sigText).width + 12;
              const sigTh = 18;

              ctx.fillStyle = isLong ? longColor : shortColor;
              ctx.beginPath();
              ctx.roundRect(tx1 - sigTw / 2, labelY - sigTh / 2, sigTw, sigTh, 4);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(sigText, tx1, labelY);
              ctx.restore();
            }

            // Exit Label if Trade Closed
            if (trade.status !== 'ACTIVE' && trade.exitBarIndex !== undefined && trade.exitPrice !== undefined) {
              const exitX = getXFromIndex(trade.exitBarIndex);
              const exitY = getYFromPrice(trade.exitPrice);
              const isWin = trade.status === 'TP';

              ctx.save();
              ctx.font = 'bold 9px JetBrains Mono, monospace';
              const exitText = isWin ? `TP (+${trade.rr}R) ✓` : 'SL (-1R) ✕';
              const eTw = ctx.measureText(exitText).width + 10;
              const eTh = 16;

              ctx.fillStyle = isWin ? 'rgba(0, 160, 120, 0.95)' : 'rgba(220, 65, 85, 0.95)';
              ctx.beginPath();
              ctx.roundRect(exitX - eTw / 2, exitY - eTh / 2, eTw, eTh, 4);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(exitText, exitX, exitY);
              ctx.restore();
            }
          });
        }

        // 3. Floating Statistics Table HUD (Matching Pine Script table.new(position.top_right, 2, 6))
        if ((settings.indicators.mrovShowStatsTable ?? true) && mrovTradeResults.stats) {
          const stats = mrovTradeResults.stats;
          const tableW = 190;
          const tableH = 130;
          const tableX = Math.max(10, chartWidth - tableW - 12);
          const tableY = 48;

          ctx.save();
          // Table Background: dark 85% transparent (color.new(color.black, 15))
          ctx.fillStyle = 'rgba(10, 14, 20, 0.88)';
          ctx.beginPath();
          ctx.roundRect(tableX, tableY, tableW, tableH, 6);
          ctx.fill();

          // Frame Border (color.new(color.white, 70))
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Header: "Mrov Trade: Opening Range"
          ctx.fillStyle = rangeColor;
          ctx.fillRect(tableX + 1, tableY + 1, tableW - 2, 22);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('Mrov Trade: Opening Range', tableX + 8, tableY + 12);

          const rows = [
            { label: 'Closed Trades', value: `${stats.closedTrades}`, col: '#ffffff' },
            { label: 'Winning Trades', value: `${stats.winningTrades}`, col: '#00c878' },
            { label: 'Losing Trades', value: `${stats.losingTrades}`, col: '#e64646' },
            { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, col: stats.winRate >= 50 ? '#00c878' : '#e64646' },
            { label: 'Total R', value: `${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(2)} R`, col: stats.totalR >= 0 ? '#00c878' : '#e64646' },
          ];

          ctx.font = '10px JetBrains Mono, monospace';
          rows.forEach((r, idx) => {
            const rowY = tableY + 28 + idx * 19;

            // Row subtle separator line
            if (idx > 0) {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
              ctx.beginPath();
              ctx.moveTo(tableX + 6, rowY - 5);
              ctx.lineTo(tableX + tableW - 6, rowY - 5);
              ctx.stroke();
            }

            // Label
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'left';
            ctx.fillText(r.label, tableX + 8, rowY + 3);

            // Value
            ctx.fillStyle = r.col;
            ctx.textAlign = 'right';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.fillText(r.value, tableX + tableW - 8, rowY + 3);
            ctx.font = '10px JetBrains Mono, monospace';
          });

          ctx.restore();
        }
      }

      ctx.restore();
    }

    // =========================================================================
    // Render EMA 50/100 + Candle Trend | Albert Setups (Pine Script v6 Exact Implementation)
    // =========================================================================
    if ((settings.indicators.showEma50100Trend ?? false) && ema50100Results) {
      ctx.save();
      const startIndex = Math.max(0, start - 5);
      const endIndex = Math.min(candles.length - 1, end + 5);

      const fastCol = ema50100Results.fastColor || '#00e676';
      const slowCol = ema50100Results.slowColor || '#ff9800';

      // 1. Plot Fast EMA (50) - linewidth=2, color.lime
      if (ema50100Results.showFastEma && ema50100Results.emaFast.length > 0) {
        ctx.strokeStyle = fastCol;
        ctx.lineWidth = ema50100Results.fastLineWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        let startedFast = false;

        for (let i = startIndex; i <= endIndex; i++) {
          const val = ema50100Results.emaFast[i];
          if (val === undefined || isNaN(val)) continue;
          const x = getXFromIndex(i);
          const y = getYFromPrice(val);
          if (!startedFast) {
            ctx.moveTo(x, y);
            startedFast = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (startedFast) {
          ctx.stroke();
        }
      }

      // 2. Plot Slow EMA (100) - linewidth=2, color.orange
      if (ema50100Results.showSlowEma && ema50100Results.emaSlow.length > 0) {
        ctx.strokeStyle = slowCol;
        ctx.lineWidth = ema50100Results.slowLineWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        let startedSlow = false;

        for (let i = startIndex; i <= endIndex; i++) {
          const val = ema50100Results.emaSlow[i];
          if (val === undefined || isNaN(val)) continue;
          const x = getXFromIndex(i);
          const y = getYFromPrice(val);
          if (!startedSlow) {
            ctx.moveTo(x, y);
            startedSlow = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (startedSlow) {
          ctx.stroke();
        }
      }

      // 3. BUY / SELL Signal Shapes (Pine Script plotshape: labelup / labeldown)
      if (ema50100Results.showSignals && ema50100Results.signals.length > 0) {
        ema50100Results.signals.forEach((sig) => {
          if (sig.barIndex < start - 2 || sig.barIndex > end + 2) return;

          const x = getXFromIndex(sig.barIndex);
          const isBuy = sig.type === 'BUY';

          ctx.save();
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          const text = isBuy ? 'BUY' : 'SELL';
          const tw = ctx.measureText(text).width + 12;
          const th = 18;

          if (isBuy) {
            // style=shape.labelup, location=location.belowbar, color=color.green, textcolor=color.white
            const lowY = getYFromPrice(sig.low);
            const py = lowY + 12;

            // Green label container
            ctx.fillStyle = ema50100Results.buyColor || '#00c853';
            ctx.beginPath();
            ctx.roundRect(x - tw / 2, py, tw, th, 4);
            ctx.fill();

            // Up pointer triangle
            ctx.beginPath();
            ctx.moveTo(x - 5, py);
            ctx.lineTo(x + 5, py);
            ctx.lineTo(x, py - 5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, py + th / 2);
          } else {
            // style=shape.labeldown, location=location.abovebar, color=color.red, textcolor=color.white
            const highY = getYFromPrice(sig.high);
            const py = highY - 12 - th;

            // Red label container
            ctx.fillStyle = ema50100Results.sellColor || '#d50000';
            ctx.beginPath();
            ctx.roundRect(x - tw / 2, py, tw, th, 4);
            ctx.fill();

            // Down pointer triangle
            ctx.beginPath();
            ctx.moveTo(x - 5, py + th);
            ctx.lineTo(x + 5, py + th);
            ctx.lineTo(x, py + th + 5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, py + th / 2);
          }

          ctx.restore();
        });
      }

      ctx.restore();
    }



    ctx.lineWidth = 1;
    ctx.strokeStyle = borderCol;

    // Right y-axis border
    ctx.beginPath();
    ctx.moveTo(chartWidth, 0);
    ctx.lineTo(chartWidth, chartHeight);
    ctx.stroke();

    // Bottom x-axis border
    ctx.beginPath();
    ctx.moveTo(0, chartHeight);
    ctx.lineTo(chartWidth, chartHeight);
    ctx.stroke();

    // 7. Render Price Scale Labels (Right Axis)
    ctx.fillStyle = textCol;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let p = startPrice; p <= maxPrice; p += priceStep) {
      const y = getYFromPrice(p);
      if (y >= 0 && y <= chartHeight) {
        ctx.fillText(p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 }), chartWidth + 6, y);
      }
    }

    // Current Price line and badge
    const latestCandle = candles[candles.length - 1];
    if (latestCandle) {
      const currentY = getYFromPrice(latestCandle.close);
      if (currentY >= 0 && currentY <= chartHeight) {
        // Draw dashed line to current price
        ctx.strokeStyle = settings.appearance.priceLineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(chartWidth, currentY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Draw badge container
        ctx.fillStyle = settings.appearance.priceLineColor;
        ctx.fillRect(chartWidth + 2, currentY - 8, RIGHT_SCALE_WIDTH - 4, 16);

        // Badge Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(latestCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }), chartWidth + 6, currentY);
      }
    }

    // Render Multi-Timeframe EMA Right Price Axis Badges (Exact TradingView behavior as seen in TB.png)
    if ((settings.indicators.showMultiTimeframeEma ?? true) && mtfEmaResults) {
      // 1. 15-minute EMA Right Scale Badge (Blue)
      if (mtfEmaResults.show15 && mtfEmaResults.currentEma15 !== null && !isNaN(mtfEmaResults.currentEma15)) {
        const y15 = getYFromPrice(mtfEmaResults.currentEma15);
        if (y15 >= 0 && y15 <= chartHeight) {
          ctx.fillStyle = mtfEmaResults.color15 || '#00008B';
          ctx.fillRect(chartWidth + 2, y15 - 8, RIGHT_SCALE_WIDTH - 4, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            mtfEmaResults.currentEma15.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            chartWidth + 6,
            y15
          );
        }
      }

      // 2. 1-hour EMA Right Scale Badge (Red)
      if (mtfEmaResults.show60 && mtfEmaResults.currentEma60 !== null && !isNaN(mtfEmaResults.currentEma60)) {
        const y60 = getYFromPrice(mtfEmaResults.currentEma60);
        if (y60 >= 0 && y60 <= chartHeight) {
          ctx.fillStyle = mtfEmaResults.color60 || '#FF0000';
          ctx.fillRect(chartWidth + 2, y60 - 8, RIGHT_SCALE_WIDTH - 4, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            mtfEmaResults.currentEma60.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            chartWidth + 6,
            y60
          );
        }
      }
    }

    // Render EMA 50/100 Scale Badges on Right Price Axis
    if ((settings.indicators.showEma50100Trend ?? false) && ema50100Results) {
      if (ema50100Results.showFastEma && ema50100Results.currentEmaFast !== null && !isNaN(ema50100Results.currentEmaFast)) {
        const yFast = getYFromPrice(ema50100Results.currentEmaFast);
        if (yFast >= 0 && yFast <= chartHeight) {
          ctx.fillStyle = ema50100Results.fastColor || '#00e676';
          ctx.fillRect(chartWidth + 2, yFast - 8, RIGHT_SCALE_WIDTH - 4, 16);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            ema50100Results.currentEmaFast.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            chartWidth + 5,
            yFast
          );
        }
      }
      if (ema50100Results.showSlowEma && ema50100Results.currentEmaSlow !== null && !isNaN(ema50100Results.currentEmaSlow)) {
        const ySlow = getYFromPrice(ema50100Results.currentEmaSlow);
        if (ySlow >= 0 && ySlow <= chartHeight) {
          ctx.fillStyle = ema50100Results.slowColor || '#ff9800';
          ctx.fillRect(chartWidth + 2, ySlow - 8, RIGHT_SCALE_WIDTH - 4, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            ema50100Results.currentEmaSlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            chartWidth + 5,
            ySlow
          );
        }
      }
    }

    // Render Risk/Reward Tool Price Level Badges on Right Price Axis
    (drawings || []).forEach((drawing) => {
      if (!drawing) return;
      if (drawing.type === 'risk_reward' && drawing.riskReward) {
        const config = drawing.riskReward;
        if (config.entryPrice === undefined || config.targetPrice === undefined || config.stopPrice === undefined) return;
        const entryY = getYFromPrice(config.entryPrice);
        const targetY = getYFromPrice(config.targetPrice);
        const stopY = getYFromPrice(config.stopPrice);

        const decimals = config.entryPrice !== undefined ? (config.entryPrice.toString().split('.')[1]?.length || 3) : 3;

        const targetColor = config.targetColor || '#089981';
        const stopColor = config.stopColor || '#f23645';
        const entryColor = config.entryColor || '#5d606b';

        // TP Badge
        if (targetY >= 0 && targetY <= chartHeight) {
          ctx.fillStyle = targetColor;
          ctx.fillRect(chartWidth + 2, targetY - 9, RIGHT_SCALE_WIDTH - 4, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${config.targetPrice.toFixed(decimals)}`, chartWidth + 6, targetY);
        }

        // Entry Badge
        if (entryY >= 0 && entryY <= chartHeight) {
          ctx.fillStyle = entryColor;
          ctx.fillRect(chartWidth + 2, entryY - 9, RIGHT_SCALE_WIDTH - 4, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${config.entryPrice.toFixed(decimals)}`, chartWidth + 6, entryY);
        }

        // SL Badge
        if (stopY >= 0 && stopY <= chartHeight) {
          ctx.fillStyle = stopColor;
          ctx.fillRect(chartWidth + 2, stopY - 9, RIGHT_SCALE_WIDTH - 4, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${config.stopPrice.toFixed(decimals)}`, chartWidth + 6, stopY);
        }
      }
    });

    // 8. Render Time Scale Labels (Bottom Axis)
    ctx.fillStyle = textCol;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = start; i <= end; i++) {
      if (i % (labelSpacing * 5) === 0) {
        const x = getXFromIndex(i);
        if (x >= 0 && x <= chartWidth) {
          const date = new Date(candles[i].time * 1000);
          const timeStr = formatLabelDate(date);
          ctx.fillText(timeStr, x, chartHeight + 6);
        }
      }
    }

    // 9. Draw interactive Snap Circle or Magnet dot
    if (snappedPoint) {
      const snapCoords = getCanvasCoords(snappedPoint);
      if (snapCoords.x >= 0 && snapCoords.x <= chartWidth && snapCoords.y >= 0 && snapCoords.y <= chartHeight) {
        ctx.fillStyle = '#2196f3';
        ctx.beginPath();
        ctx.arc(snapCoords.x, snapCoords.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 10. Draw Crosshair cursor
    if (mousePos.x >= 0 && mousePos.x <= chartWidth && mousePos.y >= 0 && mousePos.y <= chartHeight) {
      ctx.strokeStyle = settings.appearance.crosshairColor;
      ctx.lineWidth = 1;
      
      if (settings.appearance.crosshairStyle === 'dashed') {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      // Draw horizontal crosshair line
      ctx.beginPath();
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(chartWidth, mousePos.y);
      ctx.stroke();

      // Draw vertical crosshair line
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, chartHeight);
      ctx.stroke();
      
      ctx.setLineDash([]); // Reset

      // Crosshair Price Badge on Y-axis
      const currentCrosshairPrice = getPriceFromY(mousePos.y);
      ctx.fillStyle = isDark ? '#363c4e' : '#474f66';
      ctx.fillRect(chartWidth + 2, mousePos.y - 8, RIGHT_SCALE_WIDTH - 4, 16);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(currentCrosshairPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }), chartWidth + 6, mousePos.y);

      // Crosshair Date Badge on X-axis
      const activeIdx = getIndexFromX(mousePos.x);
      if (activeIdx >= 0 && activeIdx < candles.length) {
        const activeDate = new Date(candles[activeIdx].time * 1000);
        const dateStr = activeDate.toLocaleDateString() + ' ' + activeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        ctx.fillStyle = isDark ? '#363c4e' : '#474f66';
        ctx.fillRect(mousePos.x - 60, chartHeight + 2, 120, 16);

        ctx.fillStyle = '#ffffff';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, mousePos.x, chartHeight + 5);
      }
    }

    // 11. Draw Mcharts Watermark (matching screenshot)
    ctx.save();
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
    ctx.font = '900 28px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Mcharts', 24, chartHeight - 32);

    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.28)';
    ctx.font = 'bold 13px "Inter", monospace';
    ctx.fillText(`${cleanWatermarkName} • ${timeframe}`, 24, chartHeight - 14);
    ctx.restore();
  }, [
    dimensions,
    candles,
    candleWidth,
    scrollOffset,
    drawings,
    selectedDrawingId,
    mousePos,
    isDrawingInProgress,
    newDrawingPoints,
    activeTool,
    settings,
    snappedPoint,
    visibleRange,
    symbolName,
    timeframe,
    gtaResults,
    priceChannelsResults,
    mtfEmaResults,
    mrovTradeResults,
    ema50100Results,
  ]);

  // Helper: Get nice tick interval for price grid
  const getNicePriceStep = (range: number): number => {
    const rough = range / 6;
    if (rough === 0) return 1;
    const exponent = Math.floor(Math.log10(rough));
    const fraction = rough / Math.pow(10, exponent);
    
    let niceFraction = 1;
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;

    return niceFraction * Math.pow(10, exponent);
  };

  // Helper: draw handle dots for selected drawings
  const drawHandle = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Helper: Format bottom labels based on time gap
  const formatLabelDate = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (hours === '00' && minutes === '00') {
      // Return short month and day if it is start of day
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return timeStr;
  };

  // Snapping logic to OHLC prices of nearest candle (Magnet Mode)
  const calculateSnapping = (x: number, y: number): DrawingPoint | null => {
    if (!isMagnetActive || candles.length === 0) return null;
    const idx = getIndexFromX(x);
    if (idx < 0 || idx >= candles.length) return null;

    const candle = candles[idx];
    const candleX = getXFromIndex(idx);

    // If cursor is close horizontally to the candle center (within 1.8 * candleWidth or 24px)
    if (Math.abs(x - candleX) < Math.max(candleWidth * 1.8, 24)) {
      const prices = [candle.open, candle.high, candle.low, candle.close];
      let closestPrice = prices[0];
      let minDistance = Infinity;

      prices.forEach((p) => {
        const py = getYFromPrice(p);
        const dist = Math.abs(y - py);
        if (dist < minDistance) {
          minDistance = dist;
          closestPrice = p;
        }
      });

      // Snap within 26px vertical radius
      if (minDistance < 26) {
        return { time: candle.time, price: closestPrice };
      }
    }
    return null;
  };

  // Mouse Handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let activeCursor = 'crosshair';
    if (x > chartWidth && y <= chartHeight) {
      activeCursor = 'ns-resize';
    } else if (selectedDrawingId) {
      const selDrawing = (drawings || []).find((d) => d && d.id === selectedDrawingId);
      if (selDrawing && selDrawing.type === 'risk_reward' && selDrawing.riskReward && selDrawing.points && selDrawing.points.length >= 1) {
        const config = selDrawing.riskReward;
        const entryY = getYFromPrice(config.entryPrice);
        const targetY = getYFromPrice(config.targetPrice);
        const stopY = getYFromPrice(config.stopPrice);
        const leftX = getCanvasCoords(selDrawing.points[0]).x;
        let rightX = selDrawing.points[1] ? getCanvasCoords(selDrawing.points[1]).x : leftX + 220;
        if (rightX < leftX + 40) rightX = leftX + 40;
        const topY = Math.min(targetY, stopY);
        const botY = Math.max(targetY, stopY);

        if (Math.hypot(x - rightX, y - topY) < 18 || Math.hypot(x - leftX, y - botY) < 18) {
          activeCursor = 'nesw-resize';
        } else if (Math.hypot(x - leftX, y - topY) < 18 || Math.hypot(x - rightX, y - botY) < 18) {
          activeCursor = 'nwse-resize';
        } else if (Math.abs(y - targetY) < 16 && x >= leftX - 15 && x <= rightX + 15) {
          activeCursor = 'ns-resize';
        } else if (Math.abs(y - stopY) < 16 && x >= leftX - 15 && x <= rightX + 15) {
          activeCursor = 'ns-resize';
        } else if (Math.abs(x - rightX) < 16 && y >= topY - 10 && y <= botY + 10) {
          activeCursor = 'ew-resize';
        } else if (Math.abs(x - leftX) < 16 && y >= topY - 10 && y <= botY + 10) {
          activeCursor = 'ew-resize';
        } else if (Math.abs(y - entryY) < 14 && x >= leftX - 15 && x <= rightX + 15) {
          activeCursor = 'row-resize';
        } else if (x >= leftX && x <= rightX && y >= topY && y <= botY) {
          activeCursor = 'move';
        }
      }
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = activeCursor;
    }

    setMousePos({ x, y });

    // Calculate hover states for status display
    const idx = getIndexFromX(x);
    if (idx >= 0 && idx < candles.length) {
      setHoveredCandle(candles[idx]);
    } else {
      setHoveredCandle(null);
    }
    setHoveredPrice(getPriceFromY(y));
    setHoveredTime(getSpaceCoords(x, y).time);

    // Dynamic Magnet snapping on mouse move
    const snap = calculateSnapping(x, y);
    setSnappedPoint(snap);

    // Drawing-in-progress trendline/arrow/brush/path tracking
    if (isDrawingInProgress && activeTool === 'brush' && newDrawingPoints.length > 0) {
      // Append continuous space coordinate points when dragging brush
      const currentCoord = getSpaceCoords(x, y);
      const lastPoint = newDrawingPoints[newDrawingPoints.length - 1];
      // Only append if moved slightly to save point density
      if (lastPoint && (Math.abs(currentCoord.price - lastPoint.price) > 0.0001 || currentCoord.time !== lastPoint.time)) {
        setNewDrawingPoints((prev) => [...prev, currentCoord]);
      }
    }

    // Handle dragging/resizing interaction
    if (draggedDrawingId) {
      const drawingList = Array.isArray(drawings) ? drawings : [];
      const drawingIdx = drawingList.findIndex((d) => d && d.id === draggedDrawingId);
      if (drawingIdx !== -1) {
        const drawing = drawingList[drawingIdx];
        if (!drawing || !Array.isArray(drawing.points)) return;
        const currentCoord = snap || getSpaceCoords(x, y);

        if (draggedHandleIndex !== null && draggedHandleIndex >= 0) {
          // RESIZING A SPECIFIC HANDLE
          const updatedDrawings = [...drawingList];
          const updatedDrawing = { ...drawing };
          const updatedPoints = [...(updatedDrawing.points || [])];

          if ((drawing.type === 'trend' || drawing.type === 'arrow') && draggedHandleIndex < 2) {
            updatedPoints[draggedHandleIndex] = currentCoord;
          } else if ((drawing.type === 'rectangle' || drawing.type === 'fixed_range_volume_profile') && drawing.points.length >= 2) {
            const p0 = drawing.points[0];
            const p1 = drawing.points[1];
            if (draggedHandleIndex === 0) {
              updatedPoints[0] = currentCoord;
            } else if (draggedHandleIndex === 1) {
              updatedPoints[0] = { time: p0.time, price: currentCoord.price };
              updatedPoints[1] = { time: currentCoord.time, price: p1.price };
            } else if (draggedHandleIndex === 2) {
              updatedPoints[0] = { time: currentCoord.time, price: p0.price };
              updatedPoints[1] = { time: p1.time, price: currentCoord.price };
            } else if (draggedHandleIndex === 3) {
              updatedPoints[1] = currentCoord;
            }
          } else if (drawing.type === 'brush' || drawing.type === 'path') {
            if (draggedHandleIndex < updatedPoints.length) {
              updatedPoints[draggedHandleIndex] = currentCoord;
            }
          } else if (drawing.type === 'risk_reward' && drawing.riskReward) {
            const config = { ...drawing.riskReward };
            const isLong = config.targetPrice >= config.entryPrice;

            if (draggedHandleIndex === 0) {
              // Target level handle
              config.targetPrice = currentCoord.price;
            } else if (draggedHandleIndex === 1) {
              // Entry level handle
              config.entryPrice = currentCoord.price;
              if (updatedPoints[0]) updatedPoints[0] = { time: updatedPoints[0].time, price: config.entryPrice };
              if (updatedPoints[1]) updatedPoints[1] = { time: updatedPoints[1].time, price: config.entryPrice };
            } else if (draggedHandleIndex === 2) {
              // Stop loss level handle
              config.stopPrice = currentCoord.price;
            } else if (draggedHandleIndex === 3) {
              // Right width handle (stretch box to side)
              updatedPoints[1] = { time: currentCoord.time, price: config.entryPrice };
            } else if (draggedHandleIndex === 4) {
              // Left width handle
              updatedPoints[0] = { time: currentCoord.time, price: config.entryPrice };
            } else if (draggedHandleIndex === 5) {
              // Top-Right Corner
              updatedPoints[1] = { time: currentCoord.time, price: config.entryPrice };
              if (isLong) config.targetPrice = currentCoord.price;
              else config.stopPrice = currentCoord.price;
            } else if (draggedHandleIndex === 6) {
              // Top-Left Corner
              updatedPoints[0] = { time: currentCoord.time, price: config.entryPrice };
              if (isLong) config.targetPrice = currentCoord.price;
              else config.stopPrice = currentCoord.price;
            } else if (draggedHandleIndex === 7) {
              // Bottom-Right Corner
              updatedPoints[1] = { time: currentCoord.time, price: config.entryPrice };
              if (isLong) config.stopPrice = currentCoord.price;
              else config.targetPrice = currentCoord.price;
            } else if (draggedHandleIndex === 8) {
              // Bottom-Left Corner
              updatedPoints[0] = { time: currentCoord.time, price: config.entryPrice };
              if (isLong) config.stopPrice = currentCoord.price;
              else config.targetPrice = currentCoord.price;
            }

            updatedDrawing.riskReward = config;
          }

          updatedDrawing.points = updatedPoints;
          updatedDrawings[drawingIdx] = updatedDrawing;
          setDrawings(updatedDrawings);
        } else if (dragOffset) {
          // DRAGGING THE ENTIRE DRAWING BODY
          const updatedDrawings = [...drawings];
          const updatedDrawing = { ...drawing };

          if (drawing.type === 'horizontal') {
            updatedDrawing.points = [{
              time: currentCoord.time,
              price: currentCoord.price,
            }];
          } else if (drawing.type === 'trend' || drawing.type === 'arrow' || drawing.type === 'brush' || drawing.type === 'path' || drawing.type === 'rectangle' || drawing.type === 'fixed_range_volume_profile') {
            const deltaPrice = currentCoord.price - dragOffset.price;
            const targetTimeIndex = candles.findIndex(c => c.time === currentCoord.time);
            const sourceTimeIndex = candles.findIndex(c => c.time === dragOffset.time);
            
            let deltaIndex = 0;
            if (targetTimeIndex !== -1 && sourceTimeIndex !== -1) {
              deltaIndex = targetTimeIndex - sourceTimeIndex;
            }

            const updatedPoints = drawing.points.map((p) => {
              let pIdx = candles.findIndex(c => c.time === p.time);
              if (pIdx === -1) pIdx = 0;
              const newIdx = Math.max(0, Math.min(candles.length - 1, pIdx + deltaIndex));
              return {
                time: candles[newIdx].time,
                price: p.price + deltaPrice,
              };
            });

            updatedDrawing.points = updatedPoints;
            setDragOffset({ time: currentCoord.time, price: currentCoord.price });
          } else if (drawing.type === 'risk_reward' && drawing.riskReward) {
            const deltaTime = currentCoord.time - dragOffset.time;
            const deltaPrice = currentCoord.price - dragOffset.price;

            const config = { ...drawing.riskReward };
            config.entryPrice += deltaPrice;
            config.targetPrice += deltaPrice;
            config.stopPrice += deltaPrice;

            const updatedPoints = drawing.points.map((p) => ({
              time: p.time + deltaTime,
              price: p.price + deltaPrice,
            }));

            updatedDrawing.points = updatedPoints;
            updatedDrawing.riskReward = config;
            setDragOffset(currentCoord);
          }

          updatedDrawings[drawingIdx] = updatedDrawing;
          setDrawings(updatedDrawings);
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Right-Click Drag: Universal 2D chart panning (up/down and left/right, like TradingView)
    if (e.button === 2) {
      e.preventDefault();
      if (x <= chartWidth && y <= chartHeight) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startOffset = scrollOffset;
        const startVerticalPan = verticalPanPixels;

        const handleRightPanMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;

          if (Math.hypot(deltaX, deltaY) > 3) {
            hasDraggedRef.current = true;
          }

          // Horizontal pan (time forward/backward)
          const maxScroll = (candles.length + (hasMoreHistory ? 100 : 0)) * candleWidth;
          const minScroll = -chartWidth * 0.6;
          setScrollOffset(Math.max(minScroll, Math.min(maxScroll, startOffset + deltaX)));

          // Vertical pan (price up/down)
          setVerticalPanPixels(startVerticalPan + deltaY);
        };

        const handleRightPanMouseUp = () => {
          window.removeEventListener('mousemove', handleRightPanMouseMove);
          window.removeEventListener('mouseup', handleRightPanMouseUp);
          setTimeout(() => {
            hasDraggedRef.current = false;
          }, 60);
        };

        window.addEventListener('mousemove', handleRightPanMouseMove);
        window.addEventListener('mouseup', handleRightPanMouseUp);
      }
      return;
    }

    if (x > chartWidth && y <= chartHeight) {
      // User clicked on the right price scale to drag and scale vertical price scale height
      const startY = e.clientY;
      const startScale = priceScaleRatio;

      const handleScaleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        // Dragging UP (deltaY < 0): price scale range shrinks -> candles stretch vertically ("when to up gets wide")
        // Dragging DOWN (deltaY > 0): price scale range expands -> candles compress vertically ("when it be down then candles get near to each other")
        const scaleFactor = Math.pow(1.003, deltaY);
        const newRatio = Math.max(0.05, Math.min(20, startScale * scaleFactor));
        setPriceScaleRatio(newRatio);
      };

      const handleScaleMouseUp = () => {
        window.removeEventListener('mousemove', handleScaleMouseMove);
        window.removeEventListener('mouseup', handleScaleMouseUp);
      };

      window.addEventListener('mousemove', handleScaleMouseMove);
      window.addEventListener('mouseup', handleScaleMouseUp);
      return;
    }

    if (y > chartHeight) return; // User clicked bottom time scale

    const snap = calculateSnapping(x, y);
    const spaceCoord = snap || getSpaceCoords(x, y);

    // 0. QUICK RISK/REWARD TAP-TO-PLACE MODE ("tap anywhere on chart" to draw immediately)
    if (rrPlacementMode && onCompleteRRPlacement) {
      onCompleteRRPlacement(spaceCoord.price, spaceCoord.time);
      return;
    }

    // 1. ACTIVE DRAWING MODE
    if (activeTool !== 'cursor') {
      if (activeTool === 'trend') {
        if (!isDrawingInProgress) {
          // Start Trend Line
          setIsDrawingInProgress(true);
          setNewDrawingPoints([spaceCoord]);
        } else {
          // Finish Trend Line
          const finalPoints = [...newDrawingPoints, spaceCoord];
          const newDrawing: Drawing = {
            id: 'drawing_' + Date.now(),
            type: 'trend',
            points: finalPoints,
            color: '#2196f3',
            lineWidth: 2,
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setIsDrawingInProgress(false);
          setNewDrawingPoints([]);
          setActiveTool('cursor');
        }
      } else if (activeTool === 'arrow') {
        if (!isDrawingInProgress) {
          // Start Arrow
          setIsDrawingInProgress(true);
          setNewDrawingPoints([spaceCoord]);
        } else {
          // Finish Arrow
          const finalPoints = [...newDrawingPoints, spaceCoord];
          const newDrawing: Drawing = {
            id: 'drawing_' + Date.now(),
            type: 'arrow',
            points: finalPoints,
            color: '#10b981',
            lineWidth: 2,
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setIsDrawingInProgress(false);
          setNewDrawingPoints([]);
          setActiveTool('cursor');
        }
      } else if (activeTool === 'rectangle') {
        if (!isDrawingInProgress) {
          // Start Rectangle
          setIsDrawingInProgress(true);
          setNewDrawingPoints([spaceCoord]);
        } else {
          // Finish Rectangle
          const finalPoints = [...newDrawingPoints, spaceCoord];
          const newDrawing: Drawing = {
            id: 'drawing_' + Date.now(),
            type: 'rectangle',
            points: finalPoints,
            color: '#818cf8',
            lineWidth: 1.5,
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setIsDrawingInProgress(false);
          setNewDrawingPoints([]);
          setActiveTool('cursor');
        }
      } else if (activeTool === 'fixed_range_volume_profile') {
        if (!isDrawingInProgress) {
          // Start FRVP Range selection
          setIsDrawingInProgress(true);
          setNewDrawingPoints([spaceCoord]);
        } else {
          // Finish FRVP Range selection
          const finalPoints = [...newDrawingPoints, spaceCoord];
          const newDrawing: Drawing = {
            id: 'drawing_' + Date.now(),
            type: 'fixed_range_volume_profile',
            points: finalPoints,
            color: '#f59e0b',
            lineWidth: 1.5,
            volumeProfile: {
              numRows: 24,
              vaPercent: 0.70,
              upColor: '#26a69a',
              downColor: '#ef5350',
              pocColor: '#f59e0b',
              vahValColor: '#38bdf8',
              showLabels: true,
            },
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setSelectedDrawingId(newDrawing.id);
          setIsDrawingInProgress(false);
          setNewDrawingPoints([]);
          setActiveTool('cursor');
        }
      } else if (activeTool === 'brush') {
        // Start Brush freehand drawing
        setIsDrawingInProgress(true);
        setNewDrawingPoints([spaceCoord]);
      } else if (activeTool === 'path') {
        // Path (Polyline with arrowhead at end)
        if (!isDrawingInProgress) {
          setIsDrawingInProgress(true);
          setNewDrawingPoints([spaceCoord]);
        } else {
          // Check if user clicked very close to the last point to finalize path
          const lastPoint = newDrawingPoints[newDrawingPoints.length - 1];
          const lastCanvas = getCanvasCoords(lastPoint);
          const currentCanvas = { x, y };
          const distToLast = Math.hypot(currentCanvas.x - lastCanvas.x, currentCanvas.y - lastCanvas.y);

          if (distToLast < 14 || newDrawingPoints.length >= 20) {
            // Double click / close click to finish polyline path
            if (newDrawingPoints.length >= 2) {
              const newDrawing: Drawing = {
                id: 'drawing_' + Date.now(),
                type: 'path',
                points: newDrawingPoints,
                color: '#06b6d4',
                lineWidth: 2,
              };
              setDrawings((prev) => [...prev, newDrawing]);
            }
            setIsDrawingInProgress(false);
            setNewDrawingPoints([]);
            setActiveTool('cursor');
          } else {
            // Append waypoint to path
            setNewDrawingPoints((prev) => [...prev, spaceCoord]);
          }
        }
      } else if (activeTool === 'horizontal') {
        // Spawn Horizontal Line instantly
        const newDrawing: Drawing = {
          id: 'drawing_' + Date.now(),
          type: 'horizontal',
          points: [spaceCoord],
          color: '#e040fb',
          lineWidth: 2,
        };
        setDrawings((prev) => [...prev, newDrawing]);
        setActiveTool('cursor');
      } else if (activeTool === 'risk_reward') {
        // Spawn Risk/Reward tool instantly centered on clicked price with exact Deriv/Vol 75 formula:
        // SL = $2.2, TP = $10.3 at min lot 0.01 (224 movement = $2.24)
        const entryPrice = spaceCoord.price;
        const rrConfig = createDefaultRiskReward(
          entryPrice,
          symbolName,
          activeSymbolSpec,
          true,
          settings.indicators.rrDefaultSlDollar ?? 2.2,
          settings.indicators.rrDefaultTpDollar ?? 10.3,
          settings.indicators.rrDefaultLot ?? (activeSymbolSpec.cleanCode.includes('75') ? 0.01 : activeSymbolSpec.minLot)
        );

        const visibleCandlesCount = Math.max(10, Math.floor(chartWidth / (candleWidth || 8)));
        const defaultBoxCandles = Math.min(25, Math.max(8, Math.floor(visibleCandlesCount * 0.25)));

        const startIdx = candles.findIndex(c => c.time === spaceCoord.time);
        const effectiveStartIdx = startIdx !== -1 ? startIdx : (candles.length > 0 ? candles.length - 1 : 0);
        const endIdx = Math.min(candles.length - 1, effectiveStartIdx + defaultBoxCandles);
        const avgCandleSec = candles.length > 1 ? (candles[1].time - candles[0].time) : 60;
        const endTime = candles[endIdx] ? candles[endIdx].time : (spaceCoord.time + avgCandleSec * defaultBoxCandles);

        const newDrawing: Drawing = {
          id: 'drawing_' + Date.now(),
          type: 'risk_reward',
          points: [
            spaceCoord,
            { time: endTime, price: entryPrice }
          ],
          color: '#2196f3',
          lineWidth: 1.5,
          riskReward: {
            isLong: true,
            entryPrice,
            targetPrice: rrConfig.targetPrice,
            stopPrice: rrConfig.stopPrice,
            riskAmount: rrConfig.riskAmount,
            lotSize: rrConfig.lotSize,
          },
        };
        setDrawings((prev) => [...prev, newDrawing]);
        setSelectedDrawingId(newDrawing.id);
        setActiveTool('cursor');
      }
      return;
    }

    // 2. CURSOR/EDITING SELECTION MODE
    // Check if clicked close to handles first
    let foundHandle = false;
    const currentDrawings = Array.isArray(drawings) ? drawings : [];
    for (let i = currentDrawings.length - 1; i >= 0; i--) {
      const d = currentDrawings[i];
      if (!d || !Array.isArray(d.points) || d.points.length === 0) continue;
      if (d.id === selectedDrawingId) {
        if ((d.type === 'trend' || d.type === 'arrow') && d.points.length >= 2) {
          const p1 = getCanvasCoords(d.points[0]);
          const p2 = getCanvasCoords(d.points[1]);

          if (Math.hypot(x - p1.x, y - p1.y) < 12) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(0);
            foundHandle = true;
            break;
          }
          if (Math.hypot(x - p2.x, y - p2.y) < 12) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(1);
            foundHandle = true;
            break;
          }
        } else if (d.type === 'brush' && d.points.length >= 2) {
          const pStart = getCanvasCoords(d.points[0]);
          const pEnd = getCanvasCoords(d.points[d.points.length - 1]);
          if (Math.hypot(x - pStart.x, y - pStart.y) < 12) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(0);
            foundHandle = true;
            break;
          }
          if (Math.hypot(x - pEnd.x, y - pEnd.y) < 12) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(d.points.length - 1);
            foundHandle = true;
            break;
          }
        } else if (d.type === 'path' && d.points.length >= 2) {
          for (let pIdx = 0; pIdx < d.points.length; pIdx++) {
            const cp = getCanvasCoords(d.points[pIdx]);
            if (Math.hypot(x - cp.x, y - cp.y) < 12) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(pIdx);
              foundHandle = true;
              break;
            }
          }
          if (foundHandle) break;
        } else if (d.type === 'rectangle' && d.points.length >= 2) {
          const p1 = getCanvasCoords(d.points[0]);
          const p2 = getCanvasCoords(d.points[1]);
          const left = Math.min(p1.x, p2.x);
          const right = Math.max(p1.x, p2.x);
          const top = Math.min(p1.y, p2.y);
          const bottom = Math.max(p1.y, p2.y);

          const corners = [
            { x: left, y: top, idx: 0 },
            { x: right, y: top, idx: 1 },
            { x: left, y: bottom, idx: 2 },
            { x: right, y: bottom, idx: 3 },
          ];
          for (const corner of corners) {
            if (Math.hypot(x - corner.x, y - corner.y) < 12) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(corner.idx);
              foundHandle = true;
              break;
            }
          }
          if (foundHandle) break;
        } else if (d.type === 'fixed_range_volume_profile' && d.points.length >= 2) {
          const p1 = getCanvasCoords(d.points[0]);
          const p2 = getCanvasCoords(d.points[1]);
          const left = Math.min(p1.x, p2.x);
          const right = Math.max(p1.x, p2.x);
          const top = Math.min(p1.y, p2.y);
          const bottom = Math.max(p1.y, p2.y);

          const corners = [
            { x: left, y: top, idx: 0 },
            { x: right, y: top, idx: 1 },
            { x: left, y: bottom, idx: 2 },
            { x: right, y: bottom, idx: 3 },
          ];
          for (const corner of corners) {
            if (Math.hypot(x - corner.x, y - corner.y) < 12) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(corner.idx);
              foundHandle = true;
              break;
            }
          }
          if (foundHandle) break;
        } else if (d.type === 'horizontal') {
          const p1 = getCanvasCoords(d.points[0]);
          if (Math.hypot(x - chartWidth / 2, y - p1.y) < 12) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(0);
            foundHandle = true;
            break;
          }
        } else if (d.type === 'risk_reward' && d.riskReward) {
          const entryY = getYFromPrice(d.riskReward.entryPrice);
          const targetY = getYFromPrice(d.riskReward.targetPrice);
          const stopY = getYFromPrice(d.riskReward.stopPrice);
          const leftX = getCanvasCoords(d.points[0]).x;
          let rightX = d.points[1] ? getCanvasCoords(d.points[1]).x : leftX + 220;
          if (rightX < leftX + 40) rightX = leftX + 40;
          const centerX = (leftX + rightX) / 2;

          const topY = Math.min(targetY, stopY);
          const botY = Math.max(targetY, stopY);
          const r = 20;

          // 1. Top Corners (5: top-right, 6: top-left)
          if (Math.hypot(x - rightX, y - topY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(5);
            foundHandle = true;
            break;
          }
          if (Math.hypot(x - leftX, y - topY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(6);
            foundHandle = true;
            break;
          }

          // 2. Bottom Corners (7: bot-right, 8: bot-left)
          if (Math.hypot(x - rightX, y - botY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(7);
            foundHandle = true;
            break;
          }
          if (Math.hypot(x - leftX, y - botY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(8);
            foundHandle = true;
            break;
          }

          // 3. Target Level Drag (Handle 0: anywhere along target line within 18px vertical, or target circle handles)
          if ((Math.abs(y - targetY) < 18 && x >= leftX - 15 && x <= rightX + 15) ||
              Math.hypot(x - centerX, y - targetY) < r ||
              Math.hypot(x - leftX, y - targetY) < r ||
              Math.hypot(x - rightX, y - targetY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(0);
            foundHandle = true;
            break;
          }

          // 4. Stop Level Drag (Handle 2: anywhere along stop line within 18px vertical, or stop circle handles)
          if ((Math.abs(y - stopY) < 18 && x >= leftX - 15 && x <= rightX + 15) ||
              Math.hypot(x - centerX, y - stopY) < r ||
              Math.hypot(x - leftX, y - stopY) < r ||
              Math.hypot(x - rightX, y - stopY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(2);
            foundHandle = true;
            break;
          }

          // 5. Right Side Width Drag (Handle 3: anywhere along right edge within 18px horizontal)
          // "በቀላሉ ወደዛ ለማስፋፋት"
          if ((Math.abs(x - rightX) < 18 && y >= topY - 10 && y <= botY + 10) ||
              Math.hypot(x - rightX, y - entryY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(3);
            foundHandle = true;
            break;
          }

          // 6. Left Side Width Drag (Handle 4: anywhere along left edge within 18px horizontal)
          // "ወደዚህ ለማቅጠን"
          if ((Math.abs(x - leftX) < 18 && y >= topY - 10 && y <= botY + 10) ||
              Math.hypot(x - leftX, y - entryY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(4);
            foundHandle = true;
            break;
          }

          // 7. Center Entry Level Drag (Handle 1: along entry line within 14px)
          if ((Math.abs(y - entryY) < 14 && x >= leftX - 15 && x <= rightX + 15) ||
              Math.hypot(x - centerX, y - entryY) < r) {
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(1);
            foundHandle = true;
            break;
          }
        }
      }
    }

    if (foundHandle) return;

    // Check if clicked on a drawing's body to select or drag
    let foundBody = false;
    for (let i = currentDrawings.length - 1; i >= 0; i--) {
      const d = currentDrawings[i];
      if (!d || !Array.isArray(d.points) || d.points.length === 0) continue;
      if (d.type === 'horizontal') {
        const py = getYFromPrice(d.points[0].price);
        if (Math.abs(y - py) < 8) {
          setSelectedDrawingId(d.id);
          setDraggedDrawingId(d.id);
          setDraggedHandleIndex(null); // drag whole body
          setDragOffset(spaceCoord);
          foundBody = true;
          break;
        }
      } else if (d.type === 'trend' && d.points.length >= 2) {
        const p1 = getCanvasCoords(d.points[0]);
        const p2 = getCanvasCoords(d.points[1]);

        // Distance from point to line segment
        const dist = distToSegment({ x, y }, p1, p2);
        if (dist < 8) {
          setSelectedDrawingId(d.id);
          setDraggedDrawingId(d.id);
          setDraggedHandleIndex(null);
          setDragOffset(spaceCoord);
          foundBody = true;
          break;
        }
      } else if (d.type === 'arrow' && d.points.length >= 2) {
        const p1 = getCanvasCoords(d.points[0]);
        const p2 = getCanvasCoords(d.points[1]);

        const dist = distToSegment({ x, y }, p1, p2);
        if (dist < 10) {
          setSelectedDrawingId(d.id);
          setDraggedDrawingId(d.id);
          setDraggedHandleIndex(null);
          setDragOffset(spaceCoord);
          foundBody = true;
          break;
        }
      } else if ((d.type === 'brush' || d.type === 'path') && d.points.length >= 2) {
        let isHit = false;
        for (let i = 0; i < d.points.length - 1; i++) {
          const p1 = getCanvasCoords(d.points[i]);
          const p2 = getCanvasCoords(d.points[i + 1]);
          if (distToSegment({ x, y }, p1, p2) < 10) {
            isHit = true;
            break;
          }
        }
        if (isHit) {
          setSelectedDrawingId(d.id);
          setDraggedDrawingId(d.id);
          setDraggedHandleIndex(null);
          setDragOffset(spaceCoord);
          foundBody = true;
          break;
        }
      } else if ((d.type === 'rectangle' || d.type === 'fixed_range_volume_profile') && d.points.length >= 2) {
        const c1 = getCanvasCoords(d.points[0]);
        const c2 = getCanvasCoords(d.points[1]);
        const left = Math.min(c1.x, c2.x);
        const right = Math.max(c1.x, c2.x);
        const top = Math.min(c1.y, c2.y);
        const bottom = Math.max(c1.y, c2.y);

        if (x >= left - 6 && x <= right + 6 && y >= top - 6 && y <= bottom + 6) {
          setSelectedDrawingId(d.id);
          setDraggedDrawingId(d.id);
          setDraggedHandleIndex(null);
          setDragOffset(spaceCoord);
          foundBody = true;
          break;
        }
      } else if (d.type === 'risk_reward' && d.riskReward) {
        const config = d.riskReward;
        const entryY = getYFromPrice(config.entryPrice);
        const targetY = getYFromPrice(config.targetPrice);
        const stopY = getYFromPrice(config.stopPrice);
        const leftX = getCanvasCoords(d.points[0]).x;
        let rightX = d.points[1] ? getCanvasCoords(d.points[1]).x : leftX + 220;
        if (rightX < leftX + 40) rightX = leftX + 40;

        const left = leftX;
        const right = rightX;
        const topY = Math.min(targetY, stopY);
        const botY = Math.max(targetY, stopY);

        if (x >= left - 6 && x <= right + 6 && y >= topY - 12 && y <= botY + 12) {
          setSelectedDrawingId(d.id);
          setDraggedDrawingId(d.id);
          setDraggedHandleIndex(null);
          setDragOffset(spaceCoord);
          foundBody = true;
          break;
        }
      }
    }

    if (foundBody) return;

    // Check if user clicked on an Mpro Signal marker (for automatic 1:1.5 R:R visualization)
    if (srClassificationResults && srClassificationResults.signals && srClassificationResults.signals.length > 0) {
      const isPro = isMproPro;
      const clickedSignal = srClassificationResults.signals.find((sig) => {
        // In demo mode, only historical signals before the 300-candle cutoff are interactive
        if (!isPro && sig.index > Math.max(20, candles.length - 300)) return false;

        const sigX = getXFromIndex(sig.index);
        const c = candles[sig.index];
        if (!c) return false;
        const sigY = sig.type === 'buy' ? getYFromPrice(c.low) : getYFromPrice(c.high);
        // Distance check from signal location
        const dist = Math.hypot(x - sigX, y - sigY);
        return dist < 28;
      });

      if (clickedSignal) {
        if (onSelectMproRRSignal) {
          // If clicked the same one, toggle off, else select it
          if (selectedMproRRSignal && selectedMproRRSignal.index === clickedSignal.index && selectedMproRRSignal.type === clickedSignal.type) {
            onSelectMproRRSignal(null);
          } else {
            onSelectMproRRSignal(clickedSignal);
          }
        }
        return;
      }
    }

    // If nothing matches, deselect drawing and initiate panning
    setSelectedDrawingId(null);

    // Setup for panning (drag chart 2D: horizontal & vertical)
    const startX = e.clientX;
    const startY = e.clientY;
    const startOffset = scrollOffset;
    const startVerticalPan = verticalPanPixels;

    const handlePanMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (Math.hypot(deltaX, deltaY) > 3) {
        hasDraggedRef.current = true;
      }

      // Clamp scrolling so they don't scroll past data boundaries (allow slight overscroll if more history is available)
      const maxScroll = (candles.length + (hasMoreHistory ? 100 : 0)) * candleWidth;
      const minScroll = -chartWidth * 0.6;
      setScrollOffset(Math.max(minScroll, Math.min(maxScroll, startOffset + deltaX)));

      // Vertical pan: move chart UP and DOWN smoothly
      setVerticalPanPixels(startVerticalPan + deltaY);
    };

    const handlePanMouseUp = () => {
      window.removeEventListener('mousemove', handlePanMouseMove);
      window.removeEventListener('mouseup', handlePanMouseUp);
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 60);
    };

    window.addEventListener('mousemove', handlePanMouseMove);
    window.addEventListener('mouseup', handlePanMouseUp);
  };

  const handleMouseUp = () => {
    // If we were drawing freehand with the brush, commit it upon mouse release
    if (isDrawingInProgress && activeTool === 'brush') {
      if (newDrawingPoints.length >= 2) {
        const newDrawing: Drawing = {
          id: 'drawing_' + Date.now(),
          type: 'brush',
          points: newDrawingPoints,
          color: '#f59e0b',
          lineWidth: 2,
        };
        setDrawings((prev) => [...prev, newDrawing]);
      }
      setIsDrawingInProgress(false);
      setNewDrawingPoints([]);
      setActiveTool('cursor');
    }

    if (draggedDrawingId) {
      setDraggedDrawingId(null);
      setDraggedHandleIndex(null);
      setDragOffset(null);
      // Save drawings to persistence
      saveDrawingsToLocalStorage();
    }
  };

  const saveDrawingsToLocalStorage = () => {
    try {
      localStorage.setItem(`drawings_${symbolName}`, JSON.stringify(drawings));
    } catch (e) {
      console.error('Failed to save drawings to localstorage:', e);
    }
  };

  // Distance from point p to line segment v-w
  const distToSegment = (p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) => {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Mobile Touch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || candles.length === 0) return;
    
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (x > chartWidth && y <= chartHeight) {
        touchStartRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          startScrollOffset: scrollOffset,
          isDraggingDrawing: false,
          isDraggingScale: true,
          startPriceScaleRatio: priceScaleRatio,
        } as any;
        return;
      }

      if (y > chartHeight) return; // ignore bottom scale

      const snap = calculateSnapping(x, y);
      const spaceCoord = snap || getSpaceCoords(x, y);

      // 0. QUICK RISK/REWARD TAP-TO-PLACE MODE ("tap anywhere on chart" to draw immediately)
      if (rrPlacementMode && onCompleteRRPlacement) {
        onCompleteRRPlacement(spaceCoord.price, spaceCoord.time);
        return;
      }

      // 1. ACTIVE DRAWING MODE
      if (activeTool !== 'cursor') {
        if (activeTool === 'trend') {
          if (!isDrawingInProgress) {
            setIsDrawingInProgress(true);
            setNewDrawingPoints([spaceCoord]);
          } else {
            const finalPoints = [...newDrawingPoints, spaceCoord];
            const newDrawing: Drawing = {
              id: 'drawing_' + Date.now(),
              type: 'trend',
              points: finalPoints,
              color: '#2196f3',
              lineWidth: 2,
            };
            setDrawings((prev) => [...prev, newDrawing]);
            setIsDrawingInProgress(false);
            setNewDrawingPoints([]);
            setActiveTool('cursor');
          }
        } else if (activeTool === 'arrow') {
          if (!isDrawingInProgress) {
            setIsDrawingInProgress(true);
            setNewDrawingPoints([spaceCoord]);
          } else {
            const finalPoints = [...newDrawingPoints, spaceCoord];
            const newDrawing: Drawing = {
              id: 'drawing_' + Date.now(),
              type: 'arrow',
              points: finalPoints,
              color: '#10b981',
              lineWidth: 2,
            };
            setDrawings((prev) => [...prev, newDrawing]);
            setIsDrawingInProgress(false);
            setNewDrawingPoints([]);
            setActiveTool('cursor');
          }
        } else if (activeTool === 'brush') {
          setIsDrawingInProgress(true);
          setNewDrawingPoints([spaceCoord]);
        } else if (activeTool === 'path') {
          if (!isDrawingInProgress) {
            setIsDrawingInProgress(true);
            setNewDrawingPoints([spaceCoord]);
          } else {
            const lastPoint = newDrawingPoints[newDrawingPoints.length - 1];
            const lastCanvas = getCanvasCoords(lastPoint);
            const currentCanvas = { x, y };
            const distToLast = Math.hypot(currentCanvas.x - lastCanvas.x, currentCanvas.y - lastCanvas.y);
            if (distToLast < 20 || newDrawingPoints.length >= 20) {
              if (newDrawingPoints.length >= 2) {
                const newDrawing: Drawing = {
                  id: 'drawing_' + Date.now(),
                  type: 'path',
                  points: newDrawingPoints,
                  color: '#06b6d4',
                  lineWidth: 2,
                };
                setDrawings((prev) => [...prev, newDrawing]);
              }
              setIsDrawingInProgress(false);
              setNewDrawingPoints([]);
              setActiveTool('cursor');
            } else {
              setNewDrawingPoints((prev) => [...prev, spaceCoord]);
            }
          }
        } else if (activeTool === 'rectangle') {
          if (!isDrawingInProgress) {
            setIsDrawingInProgress(true);
            setNewDrawingPoints([spaceCoord]);
          } else {
            const finalPoints = [...newDrawingPoints, spaceCoord];
            const newDrawing: Drawing = {
              id: 'drawing_' + Date.now(),
              type: 'rectangle',
              points: finalPoints,
              color: '#818cf8',
              lineWidth: 1.5,
            };
            setDrawings((prev) => [...prev, newDrawing]);
            setIsDrawingInProgress(false);
            setNewDrawingPoints([]);
            setActiveTool('cursor');
          }
        } else if (activeTool === 'fixed_range_volume_profile') {
          if (!isDrawingInProgress) {
            setIsDrawingInProgress(true);
            setNewDrawingPoints([spaceCoord]);
          } else {
            const finalPoints = [...newDrawingPoints, spaceCoord];
            const newDrawing: Drawing = {
              id: 'drawing_' + Date.now(),
              type: 'fixed_range_volume_profile',
              points: finalPoints,
              color: '#f59e0b',
              lineWidth: 1.5,
              volumeProfile: {
                numRows: 24,
                vaPercent: 0.70,
                upColor: '#26a69a',
                downColor: '#ef5350',
                pocColor: '#f59e0b',
                vahValColor: '#38bdf8',
                showLabels: true,
              },
            };
            setDrawings((prev) => [...prev, newDrawing]);
            setSelectedDrawingId(newDrawing.id);
            setIsDrawingInProgress(false);
            setNewDrawingPoints([]);
            setActiveTool('cursor');
          }
        } else if (activeTool === 'horizontal') {
          const newDrawing: Drawing = {
            id: 'drawing_' + Date.now(),
            type: 'horizontal',
            points: [spaceCoord],
            color: '#e040fb',
            lineWidth: 2,
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setActiveTool('cursor');
        } else if (activeTool === 'risk_reward') {
          const entryPrice = spaceCoord.price;
          const rrConfig = createDefaultRiskReward(
            entryPrice,
            symbolName,
            activeSymbolSpec,
            true,
            settings.indicators.rrDefaultSlDollar ?? 2.2,
            settings.indicators.rrDefaultTpDollar ?? 10.3,
            settings.indicators.rrDefaultLot ?? (activeSymbolSpec.cleanCode.includes('75') ? 0.01 : activeSymbolSpec.minLot)
          );

          const visibleCandlesCount = Math.max(10, Math.floor(chartWidth / (candleWidth || 8)));
          const defaultBoxCandles = Math.min(25, Math.max(8, Math.floor(visibleCandlesCount * 0.25)));

          const startIdx = candles.findIndex(c => c.time === spaceCoord.time);
          const effectiveStartIdx = startIdx !== -1 ? startIdx : (candles.length > 0 ? candles.length - 1 : 0);
          const endIdx = Math.min(candles.length - 1, effectiveStartIdx + defaultBoxCandles);
          const avgCandleSec = candles.length > 1 ? (candles[1].time - candles[0].time) : 60;
          const endTime = candles[endIdx] ? candles[endIdx].time : (spaceCoord.time + avgCandleSec * defaultBoxCandles);

          const newDrawing: Drawing = {
            id: 'drawing_' + Date.now(),
            type: 'risk_reward',
            points: [
              spaceCoord,
              { time: endTime, price: entryPrice }
            ],
            color: '#2196f3',
            lineWidth: 1.5,
            riskReward: {
              isLong: true,
              entryPrice,
              targetPrice: rrConfig.targetPrice,
              stopPrice: rrConfig.stopPrice,
              riskAmount: rrConfig.riskAmount,
              lotSize: rrConfig.lotSize,
            },
          };
          setDrawings((prev) => [...prev, newDrawing]);
          setSelectedDrawingId(newDrawing.id);
          setActiveTool('cursor');
        }
        return;
      }

      // 2. CURSOR/EDITING SELECTION MODE
      // Check if clicked close to handles of selected drawing
      let foundHandle = false;
      const touchDrawings = Array.isArray(drawings) ? drawings : [];
      for (let i = touchDrawings.length - 1; i >= 0; i--) {
        const d = touchDrawings[i];
        if (!d || !Array.isArray(d.points) || d.points.length === 0) continue;
        if (d.id === selectedDrawingId) {
          if (d.type === 'trend') {
            const p1 = getCanvasCoords(d.points[0]);
            const p2 = getCanvasCoords(d.points[1]);

            if (Math.hypot(x - p1.x, y - p1.y) < 22) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(0);
              foundHandle = true;
              break;
            }
            if (Math.hypot(x - p2.x, y - p2.y) < 22) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(1);
              foundHandle = true;
              break;
            }
          } else if (d.type === 'horizontal') {
            const p1 = getCanvasCoords(d.points[0]);
            if (Math.hypot(x - chartWidth / 2, y - p1.y) < 22) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(0);
              foundHandle = true;
              break;
            }
          } else if (d.type === 'risk_reward' && d.riskReward) {
            const entryY = getYFromPrice(d.riskReward.entryPrice);
            const targetY = getYFromPrice(d.riskReward.targetPrice);
            const stopY = getYFromPrice(d.riskReward.stopPrice);
            const leftX = getCanvasCoords(d.points[0]).x;
            let rightX = d.points[1] ? getCanvasCoords(d.points[1]).x : leftX + 220;
            if (rightX < leftX + 40) rightX = leftX + 40;
            const centerX = (leftX + rightX) / 2;

            const topY = Math.min(targetY, stopY);
            const botY = Math.max(targetY, stopY);
            const r = 28; // Touch-friendly radius

            // 1. Top Corners (5: top-right, 6: top-left)
            if (Math.hypot(x - rightX, y - topY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(5);
              foundHandle = true;
              break;
            }
            if (Math.hypot(x - leftX, y - topY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(6);
              foundHandle = true;
              break;
            }

            // 2. Bottom Corners (7: bot-right, 8: bot-left)
            if (Math.hypot(x - rightX, y - botY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(7);
              foundHandle = true;
              break;
            }
            if (Math.hypot(x - leftX, y - botY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(8);
              foundHandle = true;
              break;
            }

            // 3. Target Level Drag (Handle 0: anywhere along target line, or circles)
            if ((Math.abs(y - targetY) < 22 && x >= leftX - 18 && x <= rightX + 18) ||
                Math.hypot(x - centerX, y - targetY) < r ||
                Math.hypot(x - leftX, y - targetY) < r ||
                Math.hypot(x - rightX, y - targetY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(0);
              foundHandle = true;
              break;
            }

            // 4. Stop Level Drag (Handle 2: anywhere along stop line, or circles)
            if ((Math.abs(y - stopY) < 22 && x >= leftX - 18 && x <= rightX + 18) ||
                Math.hypot(x - centerX, y - stopY) < r ||
                Math.hypot(x - leftX, y - stopY) < r ||
                Math.hypot(x - rightX, y - stopY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(2);
              foundHandle = true;
              break;
            }

            // 5. Right Side Width Drag (Handle 3: anywhere along right edge)
            // "በቀላሉ ወደዛ ለማስፋፋት"
            if ((Math.abs(x - rightX) < 22 && y >= topY - 14 && y <= botY + 14) ||
                Math.hypot(x - rightX, y - entryY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(3);
              foundHandle = true;
              break;
            }

            // 6. Left Side Width Drag (Handle 4: anywhere along left edge)
            // "ወደዚህ ለማቅጠን"
            if ((Math.abs(x - leftX) < 22 && y >= topY - 14 && y <= botY + 14) ||
                Math.hypot(x - leftX, y - entryY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(4);
              foundHandle = true;
              break;
            }

            // 7. Center Entry Level Drag (Handle 1)
            if ((Math.abs(y - entryY) < 18 && x >= leftX - 18 && x <= rightX + 18) ||
                Math.hypot(x - centerX, y - entryY) < r) {
              setDraggedDrawingId(d.id);
              setDraggedHandleIndex(1);
              foundHandle = true;
              break;
            }
          }
        }
      }

      if (foundHandle) {
        touchStartRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          startScrollOffset: scrollOffset,
          isDraggingDrawing: true,
        };
        return;
      }

      // Check if clicked on a drawing's body
      let foundBody = false;
      for (let i = touchDrawings.length - 1; i >= 0; i--) {
        const d = touchDrawings[i];
        if (!d || !Array.isArray(d.points) || d.points.length === 0) continue;
        if (d.type === 'horizontal') {
          const py = getYFromPrice(d.points[0].price);
          if (Math.abs(y - py) < 18) {
            setSelectedDrawingId(d.id);
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(null);
            setDragOffset(spaceCoord);
            foundBody = true;
            break;
          }
        } else if (d.type === 'trend' && d.points.length >= 2) {
          const p1 = getCanvasCoords(d.points[0]);
          const p2 = getCanvasCoords(d.points[1]);
          const dist = distToSegment({ x, y }, p1, p2);
          if (dist < 18) {
            setSelectedDrawingId(d.id);
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(null);
            setDragOffset(spaceCoord);
            foundBody = true;
            break;
          }
        } else if (d.type === 'risk_reward' && d.riskReward) {
          const config = d.riskReward;
          const entryY = getYFromPrice(config.entryPrice);
          const targetY = getYFromPrice(config.targetPrice);
          const stopY = getYFromPrice(config.stopPrice);
          const leftX = getCanvasCoords(d.points[0]).x;
          let rightX = d.points[1] ? getCanvasCoords(d.points[1]).x : leftX + 220;
          if (rightX < leftX + 40) rightX = leftX + 40;
          const topY = Math.min(targetY, stopY);
          const botY = Math.max(targetY, stopY);

          if (x >= leftX - 10 && x <= rightX + 10 && y >= topY - 14 && y <= botY + 14) {
            setSelectedDrawingId(d.id);
            setDraggedDrawingId(d.id);
            setDraggedHandleIndex(null);
            setDragOffset(spaceCoord);
            foundBody = true;
            break;
          }
        }
      }

      if (foundBody) {
        touchStartRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          startScrollOffset: scrollOffset,
          isDraggingDrawing: true,
        };
        return;
      }

      // Otherwise pan
      setSelectedDrawingId(null);
      touchStartRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startScrollOffset: scrollOffset,
        startVerticalPan: verticalPanPixels,
        isDraggingDrawing: false,
      };

      setHoveredCandle(candles[getIndexFromX(x)] || null);
      setHoveredPrice(getPriceFromY(y));
      setHoveredTime(getSpaceCoords(x, y).time);
      setMousePos({ x, y });
    } else if (e.touches.length === 2) {
      // Pinch to Zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      
      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const index = getIndexFromX(centerX);

      touchPinchRef.current = {
        startDist: dist,
        startCandleWidth: candleWidth,
        startScrollOffset: scrollOffset,
        centerX,
        indexAtCenter: index,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || candles.length === 0) return;

    if (e.touches.length === 1 && touchStartRef.current) {
      if ((touchStartRef.current as any).isDraggingScale) {
        const touch = e.touches[0];
        const deltaY = touch.clientY - touchStartRef.current.startY;
        const startScale = (touchStartRef.current as any).startPriceScaleRatio || priceScaleRatio;
        const scaleFactor = Math.pow(1.003, deltaY);
        const newRatio = Math.max(0.05, Math.min(20, startScale * scaleFactor));
        setPriceScaleRatio(newRatio);
        return;
      }

      const touch = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      const { startX, startScrollOffset, isDraggingDrawing } = touchStartRef.current;

      if (isDraggingDrawing) {
        const snap = calculateSnapping(x, y);
        const currentCoord = snap || getSpaceCoords(x, y);

        if (draggedDrawingId) {
          const drawingIdx = drawings.findIndex((d) => d.id === draggedDrawingId);
          if (drawingIdx !== -1) {
            const drawing = drawings[drawingIdx];

            if (draggedHandleIndex !== null && draggedHandleIndex >= 0) {
              const updatedDrawings = [...drawings];
              const updatedDrawing = { ...drawing };
              const updatedPoints = [...updatedDrawing.points];

              if (drawing.type === 'trend' && draggedHandleIndex < 2) {
                updatedPoints[draggedHandleIndex] = currentCoord;
              } else if (drawing.type === 'risk_reward' && drawing.riskReward) {
                const config = { ...drawing.riskReward };
                const isLong = config.targetPrice >= config.entryPrice;

                if (draggedHandleIndex === 0) {
                  // Target level handle
                  config.targetPrice = currentCoord.price;
                } else if (draggedHandleIndex === 1) {
                  // Entry level handle
                  config.entryPrice = currentCoord.price;
                  if (updatedPoints[0]) updatedPoints[0] = { time: updatedPoints[0].time, price: config.entryPrice };
                  if (updatedPoints[1]) updatedPoints[1] = { time: updatedPoints[1].time, price: config.entryPrice };
                } else if (draggedHandleIndex === 2) {
                  // Stop loss level handle
                  config.stopPrice = currentCoord.price;
                } else if (draggedHandleIndex === 3) {
                  // Right width handle (stretch box to right)
                  updatedPoints[1] = { time: currentCoord.time, price: config.entryPrice };
                } else if (draggedHandleIndex === 4) {
                  // Left width handle (stretch box to left)
                  updatedPoints[0] = { time: currentCoord.time, price: config.entryPrice };
                } else if (draggedHandleIndex === 5) {
                  // Top-Right Corner
                  updatedPoints[1] = { time: currentCoord.time, price: config.entryPrice };
                  if (isLong) config.targetPrice = currentCoord.price;
                  else config.stopPrice = currentCoord.price;
                } else if (draggedHandleIndex === 6) {
                  // Top-Left Corner
                  updatedPoints[0] = { time: currentCoord.time, price: config.entryPrice };
                  if (isLong) config.targetPrice = currentCoord.price;
                  else config.stopPrice = currentCoord.price;
                } else if (draggedHandleIndex === 7) {
                  // Bottom-Right Corner
                  updatedPoints[1] = { time: currentCoord.time, price: config.entryPrice };
                  if (isLong) config.stopPrice = currentCoord.price;
                  else config.targetPrice = currentCoord.price;
                } else if (draggedHandleIndex === 8) {
                  // Bottom-Left Corner
                  updatedPoints[0] = { time: currentCoord.time, price: config.entryPrice };
                  if (isLong) config.stopPrice = currentCoord.price;
                  else config.targetPrice = currentCoord.price;
                }

                updatedDrawing.riskReward = config;
              }

              updatedDrawing.points = updatedPoints;
              updatedDrawings[drawingIdx] = updatedDrawing;
              setDrawings(updatedDrawings);
            } else if (dragOffset) {
              const updatedDrawings = [...drawings];
              const updatedDrawing = { ...drawing };

              if (drawing.type === 'horizontal') {
                updatedDrawing.points = [{
                  time: currentCoord.time,
                  price: currentCoord.price,
                }];
              } else if (drawing.type === 'trend') {
                const deltaPrice = currentCoord.price - dragOffset.price;
                const targetTimeIndex = candles.findIndex(c => c.time === currentCoord.time);
                const sourceTimeIndex = candles.findIndex(c => c.time === dragOffset.time);
                
                let deltaIndex = 0;
                if (targetTimeIndex !== -1 && sourceTimeIndex !== -1) {
                  deltaIndex = targetTimeIndex - sourceTimeIndex;
                }

                const updatedPoints = drawing.points.map((p) => {
                  let pIdx = candles.findIndex(c => c.time === p.time);
                  if (pIdx === -1) pIdx = 0;
                  const newIdx = Math.max(0, Math.min(candles.length - 1, pIdx + deltaIndex));
                  return {
                    time: candles[newIdx].time,
                    price: p.price + deltaPrice,
                  };
                });

                updatedDrawing.points = updatedPoints;
                setDragOffset({ time: currentCoord.time, price: currentCoord.price });
              } else if (drawing.type === 'risk_reward' && drawing.riskReward) {
                const deltaTime = currentCoord.time - dragOffset.time;
                const deltaPrice = currentCoord.price - dragOffset.price;
                const config = { ...drawing.riskReward };
                config.entryPrice += deltaPrice;
                config.targetPrice += deltaPrice;
                config.stopPrice += deltaPrice;

                const movedPoints = (drawing.points || []).map((p) => ({
                  time: p.time + deltaTime,
                  price: p.price + deltaPrice,
                }));

                updatedDrawing.points = movedPoints;
                updatedDrawing.riskReward = config;
                setDragOffset(currentCoord);
              }

              updatedDrawings[drawingIdx] = updatedDrawing;
              setDrawings(updatedDrawings);
            }
          }
        }
      } else {
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - (touchStartRef.current.startY || 0);
        const maxScroll = (candles.length + (hasMoreHistory ? 100 : 0)) * candleWidth;
        const minScroll = -chartWidth * 0.6;
        setScrollOffset(Math.max(minScroll, Math.min(maxScroll, startScrollOffset + deltaX)));
        setVerticalPanPixels(((touchStartRef.current as any).startVerticalPan || 0) + deltaY);
      }

      setMousePos({ x, y });
      const idx = getIndexFromX(x);
      if (idx >= 0 && idx < candles.length) {
        setHoveredCandle(candles[idx]);
      } else {
        setHoveredCandle(null);
      }
      setHoveredPrice(getPriceFromY(y));
      setHoveredTime(getSpaceCoords(x, y).time);
      const snap = calculateSnapping(x, y);
      setSnappedPoint(snap);
    } else if (e.touches.length === 2 && touchPinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      const { startDist, startCandleWidth, startScrollOffset, centerX, indexAtCenter } = touchPinchRef.current;
      
      const ratio = dist / startDist;
      const newCandleWidth = Math.max(1.5, Math.min(80, startCandleWidth * ratio));

      if (newCandleWidth !== candleWidth) {
        const paddingRight = 50;
        const newScrollOffset = centerX - (chartWidth - paddingRight) + (candles.length - 1 - indexAtCenter) * newCandleWidth;

        setCandleWidth(newCandleWidth);
        setScrollOffset(newScrollOffset);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    touchPinchRef.current = null;
    if (draggedDrawingId) {
      setDraggedDrawingId(null);
      setDraggedHandleIndex(null);
      setDragOffset(null);
      saveDrawingsToLocalStorage();
    }
  };

  // Zooming with mouse wheel (towards cursor position)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    if (mouseX > chartWidth) {
      // Scrolling on right price scale:
      // UP (deltaY < 0): price scale shrinks -> candles stretch vertically ("when to up gets wide")
      // DOWN (deltaY > 0): price scale expands -> candles compress vertically ("when it be down then candles get near to each other")
      const factor = e.deltaY < 0 ? 0.88 : 1.14;
      setPriceScaleRatio((prev) => Math.max(0.05, Math.min(20, prev * factor)));
      return;
    }

    // Zoom multiplier
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    const newCandleWidth = Math.max(1.5, Math.min(80, candleWidth * factor));

    if (newCandleWidth === candleWidth) return;

    // Standard Zooming-towards-cursor logic
    const index = getIndexFromX(mouseX);
    const paddingRight = 50;
    
    const newScrollOffset = mouseX - (chartWidth - paddingRight) + (candles.length - 1 - index) * newCandleWidth;

    setCandleWidth(newCandleWidth);
    setScrollOffset(newScrollOffset);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    if (mouseX > chartWidth) {
      // Double click right price scale resets vertical price scale & vertical pan
      setPriceScaleRatio(1.0);
      setVerticalPanPixels(0);
    } else {
      // Double click chart canvas resets vertical offset & scale to default auto-fit
      setVerticalPanPixels(0);
      setPriceScaleRatio(1.0);
    }
  };

  // Delete drawing handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedDrawingId && (e.key === 'Backspace' || e.key === 'Delete')) {
        setDrawings((prev) => prev.filter((d) => d.id !== selectedDrawingId));
        setSelectedDrawingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, setDrawings]);

  // Flip Risk/Reward direction (Long <-> Short)
  const toggleRiskRewardDirection = () => {
    if (!selectedDrawingId) return;
    setDrawings((prev) =>
      prev.map((d) => {
        if (d.id === selectedDrawingId && d.type === 'risk_reward' && d.riskReward) {
          const isLong = !d.riskReward.isLong;
          const entryPrice = d.riskReward.entryPrice;
          
          // Re-invert target and stop distances
          const targetDist = Math.abs(d.riskReward.targetPrice - entryPrice);
          const stopDist = Math.abs(entryYStopDist() || (entryPrice * 0.01));

          function entryYStopDist() {
            if (!d.riskReward) return 0;
            return d.riskReward.entryPrice - d.riskReward.stopPrice;
          }

          const targetPrice = isLong ? entryPrice + targetDist : entryPrice - targetDist;
          const stopPrice = isLong ? entryPrice - stopDist : entryPrice + stopDist;

          return {
            ...d,
            riskReward: {
              ...d.riskReward,
              isLong,
              targetPrice,
              stopPrice,
            },
          };
        }
        return d;
      })
    );
  };

  const hasSelectedRiskReward = useMemo(() => {
    const active = (drawings || []).find((d) => d && d.id === selectedDrawingId);
    return active?.type === 'risk_reward';
  }, [drawings, selectedDrawingId]);

  const selectedRiskRewardDrawing = useMemo(() => {
    return (drawings || []).find((d) => d && d.id === selectedDrawingId && d.type === 'risk_reward');
  }, [drawings, selectedDrawingId]);

  const isDark = isDarkTheme(settings.theme);

  return (
    <div id="chart-panel-container" ref={containerRef} className="relative w-full h-full flex flex-col select-none">
      {/* MASTER SYSTEM GATEKEEPER HUD (PRO Filter for Jump 10 1H Mpro2 Exclusive) */}
      {isMasterDashboardVisible && (
        <MasterGatekeeperHUD
          context={masterContext}
          currentSymbol={symbolName}
          currentTimeframe={timeframe}
          currentPrice={candles.length > 0 ? candles[candles.length - 1].close : undefined}
          loggedTrades={loggedTrades}
          weeklyAnchor={mpro2Results?.weeklyAnchor || null}
          onOpenTradeLogger={() => setIsTradeLoggerOpen(true)}
          onOpenJournal={() => setIsJournalOpen(true)}
          onTradesUpdated={() => {
            setLoggedTrades(getLoggedTrades());
            window.dispatchEvent(new Event('mihiretu_trades_updated'));
          }}
          isPro={isMasterPro}
          onUpgradePro={() => {
            if (onOpenMpro2Modal) onOpenMpro2Modal();
          }}
          onTogglePower={() => {
            if (onUpdateIndicator) {
              onUpdateIndicator('showMasterDashboard', false);
            }
          }}
        />
      )}

      {/* NEXUS: SMART MONEY SUITE HUD DASHBOARD & MARKET NARRATIVE */}
      {nexusResults && !isIndicatorDeleted('nexus') && (settings.indicators.showNexusSuite ?? true) && (
        <NexusDashboardHUD
          results={nexusResults}
          visible={settings.indicators.nexusShowDashboard ?? true}
          showMarketNarrative={settings.indicators.nexusShowMarketNarrative ?? true}
          onToggleMaster={() => {
            if (onUpdateIndicator) {
              onUpdateIndicator('nexusShowDashboard', !(settings.indicators.nexusShowDashboard ?? true));
            }
          }}
        />
      )}

      {/* VIP MARKET SCANNER™ HUD (Single Pair Multi-TF & Confluence Matrix) */}
      {vipScannerResults && !isIndicatorDeleted('vip_scanner') && (settings.indicators.showVipMarketScanner ?? true) && (
        <VipMarketScannerHUD
          scannerResult={vipScannerResults}
          visible={settings.indicators.vipScannerShowHud ?? true}
          onClose={() => {
            if (onUpdateIndicator) {
              onUpdateIndicator('vipScannerShowHud', false);
            }
          }}
        />
      )}

      {/* PREMIUM SIGNALS REAL-TIME DYNAMIC TP & SL TRACKER TABLE HUD */}
      {dynamicTpSlResults && !isIndicatorDeleted('dynamic_tpsl') && (settings.indicators.showDynamicTpSlSignals ?? true) && (
        <DynamicTpSlTableHUD
          operation={dynamicTpSlResults.activeOperation}
          currentPrice={candles.length > 0 ? candles[candles.length - 1].close : 0}
          decimals={activeSymbolSpec.decimals || 2}
          visible={settings.indicators.dynShowTable ?? true}
          onClose={() => {
            if (onUpdateIndicator) {
              onUpdateIndicator('dynShowTable', false);
            }
          }}
        />
      )}

      {/* TRADE PLANNER BUY SELL SIGNALS, STOP LOSS, TP & LOT SIZE [LUNQFX] HUD */}
      {tradePlannerResults && !isIndicatorDeleted('trade_planner') && (settings.indicators.showTradePlanner ?? true) && (
        <TradePlannerHUD
          hud={tradePlannerResults.hud}
          visible={settings.indicators.tpShowHud ?? true}
          position={settings.indicators.tpHudPos ?? 'Top Right'}
          size={settings.indicators.tpHudSize ?? 'Normal'}
          onSelectTrade={handleSelectTradePlannerTrade}
          selectedTradeId={selectedTradePlannerTradeId}
          onClose={() => {
            if (onUpdateIndicator) {
              onUpdateIndicator('tpShowHud', false);
            }
          }}
        />
      )}

      {/* MASTER TRADE LOGGER MODAL */}
      <MasterTradeLoggerModal
        isOpen={isTradeLoggerOpen}
        onClose={() => setIsTradeLoggerOpen(false)}
        context={masterContext}
        currentSymbol={symbolName}
        currentTimeframe={timeframe}
        currentPrice={candles.length > 0 ? candles[candles.length - 1].close : 0}
        onTradeSaved={() => {
          setLoggedTrades(getLoggedTrades());
          window.dispatchEvent(new Event('mihiretu_trades_updated'));
        }}
      />

      {/* MASTER JOURNAL & ATTRIBUTION MODAL */}
      <MasterJournalModal
        isOpen={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
        trades={loggedTrades}
        onTradesUpdated={() => {
          setLoggedTrades(getLoggedTrades());
          window.dispatchEvent(new Event('mihiretu_trades_updated'));
        }}
        currentSymbol={symbolName}
      />


      {/* TradingView-Style Floating Toolbar for Risk/Reward Tool (Shown in Tap / Selected Mode) */}
      {selectedRiskRewardDrawing && selectedRiskRewardDrawing.riskReward && (() => {
        const config = selectedRiskRewardDrawing.riskReward;
        const spec = activeSymbolSpec;
        const currentLot = config.lotSize || spec.minLot;
        const entryPrice = config.entryPrice;
        const targetPrice = config.targetPrice;
        const stopPrice = config.stopPrice;
        const isLong = targetPrice >= entryPrice;

        const decimals = entryPrice !== undefined ? (entryPrice.toString().split('.')[1]?.length || 2) : 2;
        const clampedDecimals = Math.max(2, Math.min(5, decimals));

        const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : entryPrice;
        const tpPnl = calculateProfitLoss(entryPrice, targetPrice, currentLot, isLong, spec, lastPrice);
        const slPnl = calculateProfitLoss(entryPrice, stopPrice, currentLot, isLong, spec, lastPrice);

        const riskDist = Math.abs(entryPrice - stopPrice);
        const rewardDist = Math.abs(targetPrice - entryPrice);
        const rrRatio = riskDist > 0 ? (rewardDist / riskDist).toFixed(2) : '0.00';

        const formatVal = (val: number | null) => {
          if (val === null) return null;
          const absVal = Math.abs(val);
          return absVal >= 1000
            ? absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : absVal.toFixed(2);
        };

        const tpStr = formatVal(tpPnl);
        const slStr = formatVal(slPnl);

        const targetColor = config.targetColor || '#089981';
        const stopColor = config.stopColor || '#f23645';
        const entryColor = config.entryColor || '#2962ff';
        const fillOpacity = config.fillOpacity !== undefined ? config.fillOpacity : 0.38;

        const updateRrConfig = (updates: Partial<RiskRewardConfig>) => {
          setDrawings((prev) =>
            prev.map((d) =>
              d.id === selectedRiskRewardDrawing.id && d.riskReward
                ? { ...d, riskReward: { ...d.riskReward, ...updates } }
                : d
            )
          );
        };

        const handleLotChange = (newLot: number) => {
          const clamped = Math.max(spec.minLot, Number(newLot.toFixed(2)));
          updateRrConfig({ lotSize: clamped });
        };

        const TV_COLOR_THEMES = [
          { name: 'TV Classic', target: '#089981', stop: '#f23645', entry: '#2962ff', opacity: 0.38 },
          { name: 'Neon Glow', target: '#10b981', stop: '#ef4444', entry: '#3b82f6', opacity: 0.44 },
          { name: 'Mint & Coral', target: '#059669', stop: '#e11d48', entry: '#6366f1', opacity: 0.35 },
          { name: 'Cyber Cyan', target: '#06b6d4', stop: '#a855f7', entry: '#818cf8', opacity: 0.40 },
          { name: 'Gold & Red', target: '#eab308', stop: '#dc2626', entry: '#f59e0b', opacity: 0.36 },
          { name: 'Slate Minimal', target: '#0284c7', stop: '#64748b', entry: '#94a3b8', opacity: 0.30 },
        ];

        const TARGET_SWATCHES = [
          '#089981', '#10b981', '#22c55e', '#059669', '#06b6d4', '#3b82f6', '#8b5cf6', '#eab308'
        ];

        const STOP_SWATCHES = [
          '#f23645', '#ef4444', '#dc2626', '#e11d48', '#f97316', '#f59e0b', '#a855f7', '#64748b'
        ];

        return (
          <div
            id="risk-reward-floating-toolbar"
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 select-none animate-in fade-in duration-150 max-w-[98%]"
          >
            {/* Expandable TradingView Settings & Color Popover (Opens Upward from Bottom Bar) */}
            {isRrSettingsOpen && (
              <div 
                id="risk-reward-presets-popover"
                className="w-80 sm:w-96 bg-neutral-950/95 border border-neutral-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-white text-xs space-y-2.5 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                {/* Popover Header with TradingView-style Tabs */}
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setRrSettingsTab('style')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        rrSettingsTab === 'style'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Palette className="w-3 h-3" />
                      <span>Color & Style</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRrSettingsTab('presets')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        rrSettingsTab === 'presets'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Coordinates & Lots</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRrSettingsOpen(false)}
                    className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* TAB 1: TRADINGVIEW COLOR & STYLE CUSTOMIZATION */}
                {rrSettingsTab === 'style' && (
                  <div className="space-y-2.5 text-[11px]">
                    {/* Target (TP) Color Picker */}
                    <div className="space-y-1.5 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: targetColor }} />
                          Target (Profit) Color
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-neutral-400">{targetColor}</span>
                          <input
                            type="color"
                            value={targetColor}
                            onChange={(e) => updateRrConfig({ targetColor: e.target.value })}
                            title="Custom Target Color"
                            className="w-5 h-5 rounded cursor-pointer border border-neutral-700 bg-transparent p-0"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {TARGET_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateRrConfig({ targetColor: hex })}
                            className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                              targetColor.toLowerCase() === hex.toLowerCase()
                                ? 'border-white ring-2 ring-emerald-500 scale-105'
                                : 'border-neutral-750'
                            }`}
                            style={{ backgroundColor: hex }}
                            title={`Color: ${hex}`}
                          >
                            {targetColor.toLowerCase() === hex.toLowerCase() && (
                              <Check className="w-3 h-3 text-white drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stop (SL) Color Picker */}
                    <div className="space-y-1.5 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stopColor }} />
                          Stop (Loss) Color
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-neutral-400">{stopColor}</span>
                          <input
                            type="color"
                            value={stopColor}
                            onChange={(e) => updateRrConfig({ stopColor: e.target.value })}
                            title="Custom Stop Color"
                            className="w-5 h-5 rounded cursor-pointer border border-neutral-700 bg-transparent p-0"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {STOP_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateRrConfig({ stopColor: hex })}
                            className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                              stopColor.toLowerCase() === hex.toLowerCase()
                                ? 'border-white ring-2 ring-rose-500 scale-105'
                                : 'border-neutral-750'
                            }`}
                            style={{ backgroundColor: hex }}
                            title={`Color: ${hex}`}
                          >
                            {stopColor.toLowerCase() === hex.toLowerCase() && (
                              <Check className="w-3 h-3 text-white drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Shading Intensity / Opacity (ጥላ ድምቀት) Slider */}
                    <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-300 font-semibold">Shading Opacity (የጥላ ድምቀት):</span>
                        <span className="font-mono text-amber-300 font-bold">{Math.round(fillOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        step="2"
                        value={Math.round(fillOpacity * 100)}
                        onChange={(e) => updateRrConfig({ fillOpacity: Number(e.target.value) / 100 })}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex items-center justify-between gap-1 pt-1">
                        {[
                          { label: 'Light', val: 0.20 },
                          { label: 'Normal', val: 0.38 },
                          { label: 'Vivid', val: 0.55 },
                          { label: 'Solid', val: 0.75 },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => updateRrConfig({ fillOpacity: p.val })}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer flex-1 text-center border ${
                              Math.abs(fillOpacity - p.val) < 0.05
                                ? 'bg-blue-600 text-white border-blue-500'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* One-Click TradingView Theme Presets */}
                    <div className="pt-1 border-t border-neutral-800">
                      <div className="text-[10px] text-neutral-400 mb-1.5 font-semibold">TradingView Style Presets:</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {TV_COLOR_THEMES.map((theme) => {
                          const isActive =
                            targetColor.toLowerCase() === theme.target.toLowerCase() &&
                            stopColor.toLowerCase() === theme.stop.toLowerCase();
                          return (
                            <button
                              key={theme.name}
                              type="button"
                              onClick={() => {
                                updateRrConfig({
                                  targetColor: theme.target,
                                  stopColor: theme.stop,
                                  entryColor: theme.entry,
                                  fillOpacity: theme.opacity,
                                });
                              }}
                              className={`px-1.5 py-1 rounded-md text-[10px] flex items-center gap-1.5 transition-all cursor-pointer border text-left ${
                                isActive
                                  ? 'bg-neutral-800 border-blue-500 ring-1 ring-blue-500 font-bold text-white'
                                  : 'bg-neutral-900/80 hover:bg-neutral-800/80 border-neutral-800 text-neutral-300'
                              }`}
                            >
                              <div className="flex items-center -space-x-1 shrink-0">
                                <span className="w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: theme.target }} />
                                <span className="w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: theme.stop }} />
                              </div>
                              <span className="truncate">{theme.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: LEVEL PRESETS & COORDINATES */}
                {rrSettingsTab === 'presets' && (
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between pb-1 border-b border-neutral-800 text-[11px] text-gray-300 font-semibold">
                      <span>{spec.displayName}</span>
                      <span className="text-amber-400 font-mono">Min Lot: {spec.minLot}</span>
                    </div>

                    {/* Level details */}
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex justify-between text-emerald-400">
                        <span>TP Level: {targetPrice.toFixed(clampedDecimals)}</span>
                        <span>+{rewardDist.toFixed(clampedDecimals)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Entry: {entryPrice.toFixed(clampedDecimals)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>SL Level: {stopPrice.toFixed(clampedDecimals)}</span>
                        <span>-{riskDist.toFixed(clampedDecimals)}</span>
                      </div>
                    </div>

                    {/* Quick Target Presets */}
                    <div className="pt-2 border-t border-neutral-800">
                      <div className="text-[10px] text-neutral-400 mb-1.5">Quick Target Presets:</div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const res = createDefaultRiskReward(entryPrice, symbolName, spec, isLong, 2.2, 10.3, currentLot);
                            updateRrConfig({ targetPrice: res.targetPrice, stopPrice: res.stopPrice });
                          }}
                          className="px-2 py-1 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-700/50 rounded font-semibold text-[10px] transition-colors cursor-pointer flex-1 text-center"
                        >
                          SL $2.2 / TP $10.3
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const res = createDefaultRiskReward(entryPrice, symbolName, spec, isLong, 5.0, 15.0, currentLot);
                            updateRrConfig({ targetPrice: res.targetPrice, stopPrice: res.stopPrice });
                          }}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700 rounded font-semibold text-[10px] transition-colors cursor-pointer flex-1 text-center"
                        >
                          1:3 Ratio
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const res = createDefaultRiskReward(entryPrice, symbolName, spec, isLong, 3.0, 12.0, currentLot);
                            updateRrConfig({ targetPrice: res.targetPrice, stopPrice: res.stopPrice });
                          }}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700 rounded font-semibold text-[10px] transition-colors cursor-pointer flex-1 text-center"
                        >
                          1:4 Ratio
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sleek TradingView Floating Action Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1e222d]/95 hover:bg-[#1e222d] text-white px-2.5 py-1.5 rounded-lg border border-[#2a2e39] shadow-2xl backdrop-blur-md transition-all text-xs">
              {/* Direction Flip Button */}
              <button
                onClick={toggleRiskRewardDirection}
                title="Toggle Long / Short Direction"
                className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                  isLong 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                }`}
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>{isLong ? 'Long' : 'Short'}</span>
              </button>

              {/* R:R Ratio Badge */}
              <span 
                className="font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20 text-[11px]"
                title="Risk to Reward Ratio"
              >
                1 : {rrRatio}
              </span>

              {/* Lot Size Stepper */}
              <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-neutral-700/80">
                <button
                  onClick={() => handleLotChange(currentLot - spec.lotStep)}
                  disabled={currentLot <= spec.minLot}
                  className="w-5 h-5 flex items-center justify-center text-neutral-300 hover:text-white disabled:opacity-30 font-bold transition-colors cursor-pointer"
                  title="Decrease Lot"
                >
                  -
                </button>
                <span className="font-mono text-xs font-semibold text-amber-300 px-1">
                  {currentLot.toFixed(2)}L
                </span>
                <button
                  onClick={() => handleLotChange(currentLot + spec.lotStep)}
                  className="w-5 h-5 flex items-center justify-center text-neutral-300 hover:text-white font-bold transition-colors cursor-pointer"
                  title="Increase Lot"
                >
                  +
                </button>
              </div>

              {/* Compact P&L Overview */}
              <div className="flex items-center gap-1.5 font-mono text-[11px] px-1 border-l border-neutral-700/60">
                <span className="text-emerald-400 font-semibold" title="Take Profit Return">+${tpStr}</span>
                <span className="text-neutral-500">/</span>
                <span className="text-rose-400 font-semibold" title="Stop Loss Risk">-${slStr}</span>
              </div>

              {/* TradingView Quick Color Picker Button */}
              <button
                onClick={() => {
                  if (isRrSettingsOpen && rrSettingsTab === 'style') {
                    setIsRrSettingsOpen(false);
                  } else {
                    setRrSettingsTab('style');
                    setIsRrSettingsOpen(true);
                  }
                }}
                title="Change Colors like TradingView (Target / Stop colors & shading)"
                className={`px-2 py-1.5 rounded flex items-center gap-1.5 transition-colors border cursor-pointer ${
                  isRrSettingsOpen && rrSettingsTab === 'style'
                    ? 'bg-blue-600/40 text-blue-300 border-blue-500/70 ring-1 ring-blue-500'
                    : 'bg-neutral-800/80 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-blue-400" />
                <div className="flex items-center -space-x-1 shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-neutral-900 shadow-sm"
                    style={{ backgroundColor: targetColor }}
                    title={`Target: ${targetColor}`}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-neutral-900 shadow-sm"
                    style={{ backgroundColor: stopColor }}
                    title={`Stop: ${stopColor}`}
                  />
                </div>
              </button>

              {/* Presets / Coordinates Gear Toggle */}
              <button
                onClick={() => {
                  if (isRrSettingsOpen && rrSettingsTab === 'presets') {
                    setIsRrSettingsOpen(false);
                  } else {
                    setRrSettingsTab('presets');
                    setIsRrSettingsOpen(true);
                  }
                }}
                title="Coordinates & Level Presets"
                className={`p-1.5 rounded transition-colors border cursor-pointer ${
                  isRrSettingsOpen && rrSettingsTab === 'presets'
                    ? 'bg-blue-600/30 text-blue-400 border-blue-500/50 ring-1 ring-blue-500' 
                    : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>

              {/* Delete Button */}
              <button
                onClick={() => {
                  setDrawings((prev) => prev.filter((d) => d.id !== selectedRiskRewardDrawing.id));
                  setSelectedDrawingId(null);
                }}
                title="Delete Tool (Delete / Backspace)"
                className="p-1.5 bg-neutral-800/80 hover:bg-rose-900/60 text-neutral-300 hover:text-rose-300 rounded transition-colors border border-neutral-700 hover:border-rose-700/60 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Close Button */}
              <button
                onClick={() => setSelectedDrawingId(null)}
                title="Close Selection"
                className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })()}

      {/* MPRO SIGNALS DEMO RESTRICTION NOTIFICATION BANNER */}
      {!isMproPro && (settings.indicators.showSrClassification ?? true) && (
        <div 
          id="mpro-demo-mode-notice-banner"
          className="absolute bottom-3 left-4 z-20 hidden sm:flex items-center gap-3 px-3.5 py-2.5 bg-neutral-950/95 border border-amber-500/40 rounded-xl shadow-2xl backdrop-blur-md text-xs select-none max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-ping" />
            <div className="text-[11px] text-neutral-300 leading-tight">
              <span className="font-bold text-amber-400">Demo Mode: </span>
              Works on past market data only. Real-time live signals and future market analysis on the latest 300+ candles require <span className="font-semibold text-emerald-400">PRO</span>.
            </div>
          </div>
          <button
            id="btn-banner-unlock-mpro"
            onClick={onOpenMproModal}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[10px] font-bold shrink-0 transition-all shadow-md shadow-emerald-950/50 flex items-center gap-1"
          >
            <span>Unlock PRO</span>
            <span className="opacity-90">($20)</span>
          </button>
        </div>
      )}

      {/* MPRO SIGNAL 1:1.5 RISK/REWARD FLOATING CARD */}
      {selectedMproRRSignal && srClassificationResults && (
        (() => {
          const rr = calculateMproSignalRR(selectedMproRRSignal, candles, srClassificationResults.highest, srClassificationResults.lowest);
          const decimals = activeSymbolSpec.decimals || 2;
          const isBuy = rr.direction === 'buy';
          const isStrong = selectedMproRRSignal.strength === 'strong' || selectedMproRRSignal.isLastLineTouch;

          return (
            <div
              id="mpro-signal-rr-card"
              className="absolute top-12 right-4 z-20 w-72 bg-neutral-950/95 border border-emerald-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-white text-xs select-none space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                    {isStrong ? (isBuy ? 'STRONG BUY SIGNAL 🟢' : 'STRONG SELL SIGNAL 🔴') : (isBuy ? 'BUY SIGNAL 🟢' : 'SELL SIGNAL 🔴')}
                  </span>
                  <span className="font-bold text-gray-200">{symbolName}</span>
                </div>
                <button
                  onClick={() => onSelectMproRRSignal?.(null)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                  title="Close 1:1.5 R:R Analysis"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                {/* Take Profit */}
                <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between">
                  <span className="text-emerald-400 font-semibold">Take Profit (+1.5R)</span>
                  <span className="text-emerald-300 font-bold">{rr.takeProfit.toFixed(decimals)}</span>
                </div>

                {/* Entry Price */}
                <div className="p-2 bg-neutral-900/80 border border-neutral-800 rounded-lg flex items-center justify-between">
                  <span className="text-sky-400 font-semibold">Entry Level</span>
                  <span className="text-white font-bold">{rr.entry.toFixed(decimals)}</span>
                </div>

                {/* Stop Loss */}
                <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded-lg flex items-center justify-between">
                  <span className="text-rose-400 font-semibold">Stop Loss (-1.0R)</span>
                  <span className="text-rose-300 font-bold">{rr.stopLoss.toFixed(decimals)}</span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[10px] font-mono border-t border-neutral-800/80 text-gray-300">
                <span className="text-gray-400">Target Risk/Reward:</span>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold">
                  1 : 1.50 R:R
                </span>
              </div>
            </div>
          );
        })()
      )}

      {/* Main Interactive Canvas */}
      <canvas
        id="trading-chart-canvas"
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          // Suppress browser native context menu to allow seamless Right-Click 2D panning (like TradingView)
          e.preventDefault();
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full flex-grow cursor-crosshair block"
        style={{ touchAction: 'none' }}
      />

      {/* Background continuous history fetching pill */}
      {isLoadingMoreHistory && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 bg-neutral-950/85 border border-blue-500/30 rounded-full text-[11px] text-blue-300 font-mono backdrop-blur-md shadow-xl pointer-events-none transition-all">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          <span>Fetching earlier history ({candles.length.toLocaleString()} candles)...</span>
        </div>
      )}

      {/* Floating Bottom Scale Utility Actions (TradingView style controls) */}
      <div id="chart-controls" className="absolute bottom-3 right-24 z-20 flex items-center gap-1 p-1 bg-black/30 hover:bg-black/70 border border-neutral-800/40 rounded-lg shadow backdrop-blur-[2px] opacity-90 hover:opacity-100 transition-all">
        {(verticalPanPixels !== 0 || priceScaleRatio !== 1.0) && (
          <button
            id="btn-auto-fit-price"
            onClick={() => {
              setVerticalPanPixels(0);
              setPriceScaleRatio(1.0);
            }}
            title="Auto-Fit Price (Reset Vertical Pan & Scale to Default)"
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-extrabold uppercase tracking-wider transition-all shadow-md flex items-center gap-1"
          >
            Auto
          </button>
        )}
        <button
          id="btn-zoom-in"
          onClick={() => {
            setCandleWidth((w) => Math.min(80, w * 1.2));
          }}
          title="Zoom In"
          className="p-1.5 hover:bg-neutral-800 rounded text-gray-300 hover:text-white transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-out"
          onClick={() => {
            setCandleWidth((w) => Math.max(1.5, w * 0.8));
          }}
          title="Zoom Out"
          className="p-1.5 hover:bg-neutral-800 rounded text-gray-300 hover:text-white transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          id="btn-reset-zoom"
          onClick={resetZoomPan}
          title="Reset Scale & View to Default (Double-click chart or scale)"
          className="p-1.5 hover:bg-neutral-800 text-gray-300 hover:text-white rounded transition-colors flex items-center justify-center"
        >
          <RotateCcw className="w-4 h-4 text-blue-400" />
        </button>
      </div>
    </div>
  );
};
