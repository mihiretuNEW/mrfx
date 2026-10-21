/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDerivWS } from './hooks/useDerivWS';
import { useFavorites } from './hooks/useFavorites';
import { LeftToolbar } from './components/LeftToolbar';
import { TopToolbar } from './components/TopToolbar';
import { MihiretuViewChart } from './components/MihiretuViewChart';
import { BarReplayControls } from './components/BarReplayControls';
import { MultiChartPane } from './components/MultiChartPane';
import { SymbolSelectorModal } from './components/SymbolSelectorModal';
import { SettingsModal } from './components/SettingsModal';
import { Drawing, DrawingType, ChartSettings, TimeframeId, ChartThemeId } from './types';
import { isDarkTheme, getThemePreset } from './utils/themePresets';
import { ShieldAlert, TrendingUp, Compass, Activity, Star, RotateCcw } from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { SupportModal } from './components/SupportModal';
import { MproSignalsModal } from './components/MproSignalsModal';
import { Mpro2SignalsModal } from './components/Mpro2SignalsModal';
import { RiskRewardModal } from './components/RiskRewardModal';
import { getSymbolSpec } from './utils/symbolSpecs';
import { SRSignal } from './utils/supportResistanceClassification';

const DEFAULT_SETTINGS: ChartSettings = {
  theme: 'dark',
  historySpan: '1M',
  candle: {
    upColor: '#089981',      // Emerald Green
    downColor: '#f23645',    // Vivid Red
    wickUpColor: '#089981',
    wickDownColor: '#f23645',
    borderUpColor: '#089981',
    borderDownColor: '#f23645'
  },
  appearance: {
    backgroundColor: '#000000',
    gridColor: '#141414',
    gridStyle: 'dashed',
    gridType: 'both',
    crosshairColor: '#4f5966',
    crosshairStyle: 'dashed',
    priceLineColor: '#2962ff'
  },
  indicators: {
    showMA: false,
    maPeriod: 20,
    showAutoPriceChannels: true,
    autoPriceChannelsLineWidth: 2,
    autoPriceChannelsColor: '#38bdf8', // Light sky blue matching image
    autoPriceChannelsShowBreakouts: true,
    autoPriceChannelsFill: true,
    // Institutional Auto Supply/Demand Order Blocks & Parallel Channel
    showAutoSupplyDemandChannel: true,
    autoSdcShowSupplyDemand: true,
    autoSdcShowChannel: true,
    autoSdcShowFVGProjections: true,
    autoSdcColor: '#0ea5e9',
    autoSdcFvgBuyColor: '#10b981',
    autoSdcFvgSellColor: '#f43f5e',
    showGTA: true,
    gtaShortPeriod: 6,
    gtaMidPeriod: 13,
    gtaLongPeriod: 21,
    gtaArrowOffset: 0.10,
    showGTAEMAs: true,
    gtaShowArrows: true,
    gtaColorCandles: true,
    showTrendlinesWithBreaks: false,
    twbLength: 14,
    twbSlopeMultiplier: 1.6,
    twbSlopeMethod: 'atr',
    twbShowSignals: true,
    showSmartMoneyConcepts: false,
    smcSwingLookback: 5,
    smcShowBOS: true,
    smcShowCHoCH: true,
    smcShowOrderBlocks: true,
    smcObMode: 'strong',
    smcStructureLineStyle: 'dotted',
    smcObLimit: 5,
    smcObOpacityMultiplier: 2,
    smcInstances: [
      {
        id: 'smc-1',
        name: 'SMC #1 (History 720 / Intraday)',
        enabled: false,
        timeframe: 'chart',
        historyCandlesLimit: 720,
        swingLookback: 5,
        showBOS: true,
        showCHoCH: true,
        showOrderBlocks: true,
        obMode: 'strong',
        obLimit: 5,
        obOpacityMultiplier: 2,
        structureLineStyle: 'dotted',
        bullishColor: '#10b981',
        bearishColor: '#ef4444',
        tagBadge: '720',
      },
    ],
    showSignalsAndOverlays: false,
    soSensitivity: 12,
    soSignalMode: 'confirmation',
    soShowRibbon: true,
    soShowExitSignals: true,
    soShowStrongSignals: true,
    soShowSignalArrows: true,
    showSignalArrows: true,
    mproShowArrows: true,
    // Confluence FVG Finder Defaults
    showConfluenceFVG: false,
    fvgDisplayMode: 'Line',
    fvgTf1: '1M',
    fvgTf2: '5M',
    fvgTf3: '15M',
    fvgUseNormalizedZones: true,
    fvgZoneHeightMethod: 'ATR Based',
    fvgZoneHeightAtrMult: 0.75,
    fvgZoneHeightPercent: 0.3,
    fvgShowBullish: true,
    fvgShowBearish: true,
    fvgMaxZones: 8,
    fvgMinConfluence: 2,
    fvgProximityAtrMult: 5.0,
    fvgEnableStrengthRating: true,
    fvgMinStrengthFilter: 3.0,
    fvgConfluenceBonus: 0.5,
    fvgBullishColor: '#089981',
    fvgBearishColor: '#f23645',
    fvgBullishBorderColor: '#089981',
    fvgBearishBorderColor: '#f23645',
    fvgBorderWidth: 2,
    fvgShowLabels: true,
    fvgShowInfo: false,
    fvgInfoTextSize: 'Large',
    fvgMitigationType: '50% Fill',
    fvgShowMitigated: false,
    fvgMitigatedColor: '#8b8b8b',
    fvgMinGapSize: 0.0,
    fvgUseATRFilter: true,
    fvgAtrMultiplier: 0.5,
    fvgAtrLength: 14,
    // ICT Concepts Defaults
    showIctConcepts: false,
    ictMode: 'Present',
    ictShowMarketStructure: true,
    ictMsLength: 8,
    ictShowMSS: true,
    ictShowBOS: true,
    ictStructureLabelMode: 'CHoCH',
    ictStructureLineStyle: 'dashed',
    ictMssColorBullish: '#00b0ff',
    ictMssColorBearish: '#ff3d00',
    ictBosColorBullish: '#00e676',
    ictBosColorBearish: '#ff1744',
    ictShowDisplacement: true,
    ictShowVolumeImbalance: true,
    ictViMaxBoxes: 100,
    ictViBullishColor: '#00e676',
    ictViBearishColor: '#ff1744',
    ictShowOrderBlocks: true,
    ictObMode: 'strong',
    ictObLookback: 5,
    ictObMaxCount: 5,
    ictObBullishColor: '#2962ff',
    ictObBearishColor: '#ff1744',
    ictShowLiquidity: true,
    ictLiqMode: 'strong',
    ictLiqSensitivity: 2.3,
    ictLiqMaxBoxes: 50,
    ictLiqBullishColor: '#00838f',
    ictLiqBearishColor: '#c62828',
    ictFvgOption: 'FVG',
    ictFvgShowBullish: true,
    ictFvgShowBearish: true,
    ictFvgMaxCount: 20,
    ictFvgBalancePriceRange: true,
    ictFvgBullishColor: '#089981',
    ictFvgBearishColor: '#f23645',
    // Pure Price Action Liquidity Sweeps [LuxAlgo] Defaults
    showPureLiquiditySweeps: true,
    pureLiquidityDetection: 'Long Term',
    pureLiquidityBullishColor: '#089981',
    pureLiquidityBullishSweepColor: '#08998180',
    pureLiquidityBearishColor: '#f23645',
    pureLiquidityBearishSweepColor: '#f2364580',
    // Market Structure Signals | ProjectSyndicate Defaults
    showMarketStructureSignals: true,
    mssSwingLength: 25,
    mssBosConfirmation: 'Close',
    mssShowCHoCH: true,
    mssTp1Percent: 20.0,
    mssTp2Percent: 30.0,
    mssSlPercent: 20.0,
    mssColorBullish: '#21c997',
    mssColorBearish: '#cc24e2',
    mssColorTP1: '#26a69a',
    mssColorTP2: '#00897b',
    mssColorSL: '#b71c1c',
    mssBoxTransparency: 85,
    mssBorderTransparency: 50,
    mssDashboardTextSize: 'Normal',
    mssSendTelegramSignals: false,
    // Predictive Ranges [LuxAlgo] Defaults
    showPredictiveRanges: true,
    prLength: 200,
    prMult: 6.0,
    prUpperColor: '#f23645',
    prLowerColor: '#089981',
    prAvgColor: '#5b9cf6',
    prFillOpacity: 10,
    prLineWidth: 1.5,
    prExtendRight: true,
    prShowLabels: true,
    prShowTouchMarkers: true,
    prShowBreakoutMarkers: true,
    prHighlightActiveTouch: true,
    prMarkerStyle: 'badges',
    showCenterEntryLine: true,
    // Support Resistance Classification [LuxAlgo] Defaults
    showSrClassification: true,
    srShowLabels: false,
    srShowSignals: true,
    srLookback: 100,
    srFade: 5,
    srOpt: 'line',
    srColU: '#22c55e',
    srColD: '#ef4444',
    srLeft: 10,
    srRight: 1,
    srShowPP: false,
    srShowBreaks: false,
    srLineWidth: 1.5,
    srLineExtension: 'Anchored',
    srDisplayMode: 'shadow',
    srShadowVisibility: '1x',
    srShowCenterShadows: false, // Default false: only Higher and Lower shadows
    srShowStrongShadows: true, // Higher and Lower shadows (top & bottom boundary boxes)
    srShowMidline: true, // Mpro Middle Equilibrium Line between upper & lower extremes
    srMidlineType: 'both', // Both 50% Equilibrium level & dynamic historical path
    srMidlineColor: '#06b6d4', // Vibrant Cyan Equilibrium line
    srMidlineWidth: 1.5,
    srChc1: 'SMA',
    srLen1: 50,
    srMlt1: 2,
    srRes1: 'D',
    srChc2: 'SMA',
    srLen2: 100,
    srMlt2: 2,
    srRes2: 'D',
    srChc3: 'SMA',
    srLen3: 20,
    srMlt3: 2,
    srRes3: 'W',
    srChc4: 'Previous High',
    srLen4: 20,
    srMlt4: 2,
    srRes4: 'W',
    srChc5: 'Previous Low',
    srLen5: 20,
    srMlt5: 2,
    srRes5: 'W',
    srChc6: 'Upper',
    srLen6: 20,
    srMlt6: 2,
    srRes6: 'D',
    srChc7: 'Lower',
    srLen7: 20,
    srMlt7: 2,
    srRes7: 'D',
    srChc8: 'Swings',
    srLen8: 20,
    srMlt8: 2,
    srRes8: 'D',
    srChc9: 'Fibonacci',
    srLen9: 20,
    srMlt9: 2,
    srRes9: 'W',
    // ECHO mpro (Echo Forecast [LuxAlgo]) Defaults
    showEchoMpro: true,
    echoLength: 50,
    echoFcast: 50,
    echoFmode: 'Similarity',
    echoCmode: 'Cumulative',
    echoSrc: 'close',
    echoFcastColor: '#2157f3',
    echoFcastStyle: 'dotted',
    echoLineWidth: 1.5,
    echoShowArea: true,
    echoRefAreaColor: '#ff5d00',
    echoCorrAreaColor: '#089981',
    echoEvalAreaColor: '#808080',
    // Master Strategy System (Exclusively Mpro2)
    showMasterSignal: true,
    showMasterDashboard: true,
    // Mpro2 Signal (Fibonacci Confluence Suite)
    showMpro2Signal: true,
    mpro2RangeMode: 'WeeklyAnchor',
    mpro2LookbackPeriod: 200,
    mpro2DelayBars: 5,
    mpro2LineExtensionMode: 'FullChart',
    mpro2ReverseDirection: false,
    mpro2ShowBaseLine0000: true, // HIGHER line (0.000 / Swing High)
    mpro2ShowBaseLine1000: true, // LOWER line (1.000 / Swing Low)
    mpro2BaseLineColor: '#2962FF',
    mpro2BaseLineStyle: 'Solid',
    mpro2BaseLineWidth: 2,
    mpro2ShowDottedLines: false, // Default false: suppress all useless inside lines & dots
    mpro2ShowCenterLine: false,
    mpro2ShowExtLine1: false,
    mpro2ExtLineRatio1: 0.236,
    mpro2ShowExtLine2: false,
    mpro2ExtLineRatio2: 0.382,
    mpro2ShowExtLine3: false,
    mpro2ExtLineRatio3: 0.500,
    mpro2ShowExtLine4: false,
    mpro2ExtLineRatio4: 0.618,
    mpro2ShowExtLine5: false,
    mpro2ExtLineRatio5: 0.786,
    mpro2ShowExtLine6: false,
    mpro2ExtLineRatio6: 1.272,
    mpro2ShowExtLine7: false,
    mpro2ExtLineRatio7: 1.414,
    mpro2ShowExtLine8: false,
    mpro2ExtLineRatio8: 1.618,
    mpro2ShowExtLine9: false,
    mpro2ExtLineRatio9: 2.000,
    mpro2ExtLineColor: '#787B86',
    mpro2ExtLineStyle: 'Dotted',
    mpro2ExtLineWidth: 1,
    mpro2ShowGoldenPocket: true, // KEEP YELLOW GOLD ONE!
    mpro2GoldenPocketColor: '#FFB020', // Yellow Gold
    mpro2ShowTouchCounts: true,
    mpro2ShowScreenTexts: true,
    mpro2ShowLevelLabels: true,
    mpro2ShowConfluence: true,
    mpro2PriorSwingCount: 2,
    mpro2ConfluenceTolerancePct: 0.15,
    mpro2ConfluenceWidthBoost: 2,
    mpro2ConfluenceMarker: '★',
    mpro2UseAdaptiveDetection: false,
    mpro2AtrLength: 14,
    mpro2AtrBaselineLength: 100,
    mpro2ShowTimeZones: false,
    mpro2TimeZoneCount: 5,
    mpro2TimeZoneColor: '#D4AF37',
    mpro2UseMultiColorZones: true,
    mpro2ShowTimeZoneLabels: false,
    mpro2ShowStatusTable: true,
    mpro2TablePosition: 'Top Right',
    mpro2BullColor: '#26A69A',
    mpro2BearColor: '#EF5350',
    mpro2ShowTouchArrows: true,
    // HVN Profile (ATAS Market Profile Indicator by ProfitPro)
    showHvnProfile: true,
    hvnPeriodBars: 60,
    hvnNumBins: 40,
    hvnZoneThicknessPct: 3.0,
    hvnExtensionMode: 'Mitigation',
    hvnMitigationType: 'Touch',
    hvnZoneColor: '#f59e0b',
    hvnZoneBorderColor: '#d97706',
    hvnPocLineColor: '#fbbf24',
    hvnProfileColor: '#1e3a8a',
    hvnProfileBorderColor: '#3b82f6',
    hvnShowSilhouette: true,
    hvnShowLabels: true,
    hvnShowSecondaryNodes: false,
    // Nexus: Smart Money Suite [BullByte]
    showNexusSuite: true,
    nexusTradingMode: 'AUTO',
    nexusSignalFilter: 'A_PLUS_AND_A',
    nexusEntryMode: 'BOTH',
    nexusStopLossMode: 'ATR',
    nexusAtrMultiplierSL: 2.0,
    nexusShowMarketStructure: true,
    nexusShowOrderBlocks: true,
    nexusShowBreakerBlocks: true,
    nexusShowFVG: true,
    nexusShowInvertedFVG: true,
    nexusShowLiquidityPools: true,
    nexusShowPremiumDiscount: true,
    nexusShowSRGlow: true,
    nexusShowVWAP: true,
    nexusShowKeyLevels: true,
    nexusShowTrendlines: true,
    nexusShowSignals: true,
    nexusColorCandles: true,
    nexusShowSessions: true,
    nexusShowDashboard: true,
    nexusShowMarketNarrative: true,
    nexusConfirmationBar: true,
    // Session Filter Defaults (Free Indicator)
    showSessionFilter: true,
    sessionFilterLineStyle: 'dotted',
    sessionFilterLineWidth: 1,
    sessionFilterLineColor: '#94a3b8',
    sessionFilterLineOpacity: 35,
    sessionFilterShowAsia: true,
    sessionFilterShowLondon: true,
    sessionFilterShowNewYork: true,
    sessionFilterShowStartLine: true,
    sessionFilterShowEndLine: true,
    sessionFilterShowLabels: true,
    sessionFilterLabelSize: 'tiny',
    sessionFilterCustomColors: true,
    sessionFilterFillBackground: false,
    sessionFilterFillOpacity: 3,
    // Order Blocks with Volume Delta (cTrader Store / Pepperstone PRO Indicator)
    showOrderBlocksWithVolume: true,
    obvSwingLength: 10,
    obvInvalidation: 'Wick',
    obvShowNearest: 10,
    obvExtendZones: 10,
    obvHideInvalidatedZones: true,
    obvEnableVolumeDelta: true,
    obvDisplayTotalVolume: true,
    obvShowDeltaPercent: true,
    obvBullishColor: '#2e7d32',
    obvBearishColor: '#881337',
    obvTotalVolColor: '#00aaff',
    obvDeltaTextColor: '#ffffff',
    // PRO Institutional Order Blocks (Live 8-Factor Strength & Shadow Engine)
    showProOrderBlocks: true,
    proObShowShadow: true,
    proObShadowOpacity: 25,
    proObMinScore: 4,
    proObShowStrengthPercent: true,
    proObShowScore: true,
    proObExtendBars: 20,
    proObBullishColor: '#10b981',
    proObBearishColor: '#f43f5e',
    proObShowOnlyUnmitigated: false,
    // Market Tick Two [MarkitTick] — Enhanced Filters Defaults
    showMarketStructureTargetTracker: true,
    showMarketTickTwo: true,
    msttSwingLen: 5,
    msttUseStructureFilter: true,
    msttStructureTf: '15',
    msttFilterSwingLen: 5,
    msttUseWickFilter: true,
    msttMaxWickRatio: 0.70,
    msttUseSweepFilter: false,
    msttSweepLookback: 10,
    msttUseEmaFilter: false,
    msttEmaLen: 200,
    msttUseAdxFilter: false,
    msttDiLen: 14,
    msttAdxSmooth: 14,
    msttMinAdx: 18.0,
    msttUseCandleFilter: false,
    msttMinBodyAtr: 0.20,
    msttBreakoutBufferAtr: 0.00,
    msttShowSignalMarkers: true,
    msttShowBosLine: true,
    msttShowLabel: true,
    msttInvalidateMode: true,
    msttColBullBos: '#00c878',
    msttColBearBos: '#dc3232',
    msttColTarget: '#ffc800',
    msttColHit: '#b464ff',
    msttShowTpSl: true,
    msttSlMulti: 1.0,
    msttTp1Multi: 1.5,
    msttTp2Multi: 3.0,
    msttTp3Multi: 5.0,
    msttAtrLen: 14,
    msttColEntry: '#64b4ff',
    msttColSl: '#ff3c3c',
    msttColTp1: '#00dc82',
    msttColTp2: '#00ffb4',
    msttColTp3: '#00ffff',
    msttShowSl: true,
    msttShowTp1: true,
    msttShowTp2: true,
    msttShowTp3: true,
    msttShowSlShade: true,
    msttShowTp1Shade: true,
    msttShowTp2Shade: true,
    msttShowTp3Shade: true,
    msttColSlShade: '#ff3c3c',
    msttColTp1Shade: '#00dc82',
    msttColTp2Shade: '#00ffb4',
    msttColTp3Shade: '#00ffff',
    msttSlShadeAlpha: 0.30,
    msttTp1ShadeAlpha: 0.30,
    msttTp2ShadeAlpha: 0.15,
    msttTp3ShadeAlpha: 0.05,
    msttHtfRes: '240',
    msttUseHtfFilter: false,
    msttHtfRsiLen: 14,
    msttAlertBos: true,
    msttAlertTarget: true,
    msttShowDashboard: true,
    msttDashBgColor: 'rgb(10,10,18)',
    msttDashTxtColor: 'rgb(220,220,235)',
    // VIP Market Scanner™ (VIP Algos) - Single Pair Matrix
    showVipMarketScanner: true,
    vipScannerShowHud: true,
    vipScannerPosition: 'Top Left',
    vipScannerRsiPeriod: 14,
    vipScannerFastEma: 9,
    vipScannerSlowEma: 21,
    vipScannerSignalEma: 50,
    vipScannerShowSignals: true,
    // Premium Signals with Dynamic TP & SL Optimization
    showDynamicTpSlSignals: true,
    dynPeriod1: 14,
    dynMultiplier1: 1.5,
    dynPeriod2: 34,
    dynMultiplier2: 2.5,
    dynPriceSource: 'close',
    dynTp1Factor: 1.0,
    dynTp2Factor: 2.0,
    dynTp3Factor: 3.0,
    dynSlRatio: 0.50,
    dynRangeLookback: 10,
    dynShowChannels: true,
    dynShowFill: true,
    dynShowSignals: true,
    dynShowTpSlLines: true,
    dynShowTable: true,
    dynCh1Color: '#38bdf8',
    dynCh2Color: '#818cf8',
    dynBuyColor: '#10b981',
    dynSellColor: '#ef4444',
    // Trade Planner Buy Sell Signals, Stop Loss, TP & Lot Size [LunqFX]
    showTradePlanner: true,
    tpBalance: 10000,
    tpRiskPct: 1.0,
    tpAccCur: 'USD',
    tpLotOver: 0,
    tpFastLen: 21,
    tpSlowLen: 50,
    tpRsiLen: 14,
    tpZoneW: 0.25,
    tpSlBuf: 0.20,
    tpMinStop: 0.50,
    tpMaxStop: 3.0,
    tpPbBars: 10,
    tpSlMult: 1.0,
    tpR1: 1.0,
    tpR2: 2.0,
    tpR3: 3.0,
    tpTargetMode: 'r_multiple',
    tpCashSl: 1.0,
    tpCashTp1: 1.0,
    tpCashTp2: 2.0,
    tpCashTp3: 3.0,
    tpPipsSl: 220,
    tpPipsTp1: 1030,
    tpPipsTp2: 2060,
    tpPipsTp3: 3090,
    tpTargetFocus: 'TP1',
    tpBrokerPreset: 'auto',
    tpPointValue: 1.0,
    tpMinLot: 0.001,
    tpLotStep: 0.001,
    tpBeOn: false,
    tpOppOn: true,
    tpCandSty: 'Neon Bloom',
    tpShowZone: true,
    tpShowEmaLines: true,
    tpShowSignals: true,
    tpShowEntryLabel: false,
    tpShowPlans: true,
    tpShowSl: true,
    tpShowTp1: true,
    tpShowTp2: true,
    tpShowTp3: true,
    tpShowDottedLines: true,
    tpKeepN: 2,
    tpTagSize: 'Normal',
    tpShowHud: true,
    tpHudPos: 'Top Right',
    tpHudSize: 'Normal',
    tpFilterAdx: false,
    tpFilterSlope: false,
    tpFilterRsiExhaustion: false,
    tpFilterWickRejection: false,
    tpFilterVolatility: false,
    tpFilterMinStopDist: false,
    // Fibonacci Sequence Swing [ChartPrime]
    showFibonacciSequenceSwing: true,
    fibDepth: 20,
    fibZigCol: 'rgb(146, 151, 167)',
    fibColUp: '#22c55e',
    fibColDn: '#ef4444',
    fibMaxRetest: 30,
    fibShowZigZag: true,
    fibShowLevels: true,
    fibShowLabels: true,
    fibShowArrows: true,
    fibShowHistorical: true,
    fibEarlyTurnMode: true,
    fibEarlyDepth: 12,
    // Multi-Timeframe EMA 15m 1H [Pine Script v6 Exact Port]
    showMultiTimeframeEma: true,
    mtfEmaLength: 20,
    mtfEmaShow15min: true,
    mtfEmaShow60min: true,
    mtfEmaColor15min: '#0d9488', // Glossy Teal
    mtfEmaColor60min: '#0284c7', // Glazed Water Blue / Cyan
    mtfEmaAdaptiveTf: false,
    mtfEmaRenderStyle: 'water_glaze',
    // Mrov Trade: Opening Range [Pine Script v6 Exact Port]
    showMrovOpeningRange: false,
    mrovRangeColor: '#2979ff',
    mrovFillTransparency: 88,
    mrovBorderWidth: 2,
    mrovLevelWidth: 2,
    mrovShowRangeCaption: true,
    mrovLongColor: '#00c878',
    mrovShortColor: '#e64646',
    mrovHighlightBreakout: true,
    mrovShowSignalLabels: true,
    mrovShowBreakoutMarker: true,
    mrovRR: 3.0,
    mrovShowTradeGrid: true,
    mrovRiskColor: '#dc4155',
    mrovRewardColor: '#00a078',
    mrovEntryColor: '#e6e6e6',
    mrovZoneTransparency: 78,
    mrovShowStatsTable: true,
    // EMA 50/100 + Candle Trend | Albert Setups [Pine Script v6 Exact Port]
    showEma50100Trend: false,
    ema50100FastLength: 50,
    ema50100SlowLength: 100,
    ema50100ShowFastEma: true,
    ema50100ShowSlowEma: true,
    ema50100ShowSignals: true,
    ema50100ColorCandles: true,
    ema50100ShowBackground: false,
    ema50100FastColor: '#00e676',
    ema50100SlowColor: '#ff9800',
    ema50100FastLineWidth: 2,
    ema50100SlowLineWidth: 2,
    deletedIndicators: [],
  },
  connection: {
    customServer: '',
    customAppId: ''
  }
};

function AppContent() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const favs = useFavorites();
  
  // Default on first opening: GOLD (frxXAUUSD), and persist across page refresh / new tabs
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('mihiretu_selected_symbol');
      if (saved && saved.trim()) return saved.trim();
      return 'frxXAUUSD'; // Default: GOLD (XAU/USD)
    } catch {
      return 'frxXAUUSD';
    }
  });

  // Default on first opening: 1 Minute, and persist across page refresh
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeId>(() => {
    try {
      const saved = localStorage.getItem('mihiretu_selected_timeframe') as TimeframeId;
      if (saved && ['1M', '2M', '5M', '15M', '30M', '1H', '4H', '1D'].includes(saved)) {
        return saved;
      }
      return '1M'; // Default: 1 Minute
    } catch {
      return '1M';
    }
  });

  const [activeTool, setActiveTool] = useState<DrawingType>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  // Magnet Mode State (Snap drawings to OHLC prices)
  const [isMagnetActive, setIsMagnetActive] = useState<boolean>(true);

  // Multi-Chart Grid Layout (1, 2, 4, 6 charts)
  const [layoutCount, setLayoutCount] = useState<1 | 2 | 4 | 6>(1);

  // Bar Replay Tool State (Backtest step-by-step candles)
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 5>(1);

  // Track candle array shifts so replayIndex stays anchored when older history is prepended
  const prevCandlesLengthRef = useRef<number>(0);
  const prevFirstCandleTimeRef = useRef<number | null>(null);

  // TradingView-style Chart-Only Mode (shows ONLY chart canvas without toolbars/headers, Esc or click restores normal screen)
  const [isChartOnlyMode, setIsChartOnlyMode] = useState<boolean>(false);

  const toggleChartOnlyMode = () => {
    setIsChartOnlyMode((prev) => {
      const next = !prev;
      if (next) {
        if (typeof document !== 'undefined' && document.documentElement?.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChartOnlyMode) {
        setIsChartOnlyMode(false);
        if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    const handleFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement && isChartOnlyMode) {
        setIsChartOnlyMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isChartOnlyMode]);

  // Homepage vs Password page view mode for unauthenticated users
  const [viewMode, setViewMode] = useState<'landing' | 'password'>('landing');
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Pro persistence helpers (localStorage + cookie)
  const checkStoredPro = (): boolean => {
    try {
      const mode = localStorage.getItem('mcharts_pro_mode');
      const isProFlag = localStorage.getItem('is_mcharts_pro_user');
      const suiteToken = localStorage.getItem('mcharts_pro_suite_token');
      const mproToken = localStorage.getItem('mpro_signals_pro_token');
      const mpro2Token = localStorage.getItem('mpro2_signals_pro_token');
      const cookiePro = typeof document !== 'undefined' && (
        document.cookie.includes('is_mcharts_pro_user=true') ||
        document.cookie.includes('mcharts_pro_suite_token=')
      );
      if (mode === 'free' && !cookiePro && !suiteToken && !mproToken && !mpro2Token) {
        return false;
      }
      return isProFlag === 'true' || cookiePro || !!suiteToken || !!mproToken || !!mpro2Token;
    } catch {
      return false;
    }
  };

  const persistProActivation = (token: string = 'Mcharts-Mihiretu-Jump10-2019') => {
    try {
      localStorage.setItem('is_mcharts_pro_user', 'true');
      localStorage.setItem('mcharts_pro_mode', 'pro');
      localStorage.setItem('mcharts_pro_suite_token', token);
      localStorage.setItem('mpro_signals_pro_token', token);
      localStorage.setItem('mpro2_signals_pro_token', token);
      localStorage.setItem('mpro_signals_mode', 'pro');
      localStorage.setItem('mpro2_signals_mode', 'pro');
      if (typeof document !== 'undefined') {
        document.cookie = 'is_mcharts_pro_user=true; path=/; max-age=31536000; SameSite=Lax';
        document.cookie = `mcharts_pro_suite_token=${encodeURIComponent(token)}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch (err) {
      console.error('Error saving pro status:', err);
    }
  };

  const persistProDeactivation = () => {
    try {
      localStorage.setItem('mcharts_pro_mode', 'free');
      localStorage.setItem('is_mcharts_pro_user', 'false');
      localStorage.removeItem('mcharts_pro_suite_token');
      localStorage.removeItem('mpro_signals_pro_token');
      localStorage.removeItem('mpro2_signals_pro_token');
      if (typeof document !== 'undefined') {
        document.cookie = 'is_mcharts_pro_user=false; path=/; max-age=31536000; SameSite=Lax';
        document.cookie = 'mcharts_pro_suite_token=; path=/; max-age=0; SameSite=Lax';
      }
    } catch (err) {
      console.error('Error removing pro status:', err);
    }
  };

  // Mpro Signals Pro / Demo state
  const [isMproModalOpen, setIsMproModalOpen] = useState(false);
  const [mproAccessMode, setMproAccessMode] = useState<'free' | 'demo' | 'pro'>(() => checkStoredPro() ? 'pro' : 'free');
  const [isMproPro, setIsMproPro] = useState<boolean>(() => checkStoredPro());
  const [selectedMproRRSignal, setSelectedMproRRSignal] = useState<SRSignal | null>(null);

  // Mpro2 Signal (Fibonacci Confluence Suite) Pro / Demo state
  const [isMpro2ModalOpen, setIsMpro2ModalOpen] = useState(false);
  const [mpro2AccessMode, setMpro2AccessMode] = useState<'free' | 'demo' | 'pro'>(() => checkStoredPro() ? 'pro' : 'free');
  const [isMpro2Pro, setIsMpro2Pro] = useState<boolean>(() => checkStoredPro());

  const handleVerifyMproKey = async (key: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = key.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter an access key.' };
    }

    try {
      const response = await fetch('/api/mpro-access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      });
      const data = await response.json();
      if (data.success && data.isPro) {
        setIsMproPro(true);
        setIsMpro2Pro(true);
        setMproAccessMode('pro');
        setMpro2AccessMode('pro');
        persistProActivation(data.proToken || trimmed);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid or expired access key.' };
    } catch {
      // Fallback offline verification for the requested access key
      const normalized = trimmed.toUpperCase();
      if (normalized === 'MIHIRETU-MPRO-2284-FX' || normalized === 'MPRO-2284-FX' || normalized === 'MCHARTS-MIHIRETU-JUMP10-2019') {
        setIsMproPro(true);
        setIsMpro2Pro(true);
        setMproAccessMode('pro');
        setMpro2AccessMode('pro');
        persistProActivation(trimmed);
        return { success: true };
      }
      return { success: false, error: 'Invalid or expired access key.' };
    }
  };

  const handleActivateMproDemo = () => {
    setMproAccessMode('demo');
    localStorage.setItem('mpro_signals_mode', 'demo');
  };

  // Mpro2 Key Verification
  const handleVerifyMpro2Key = async (key: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = key.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter your license key.' };
    }

    try {
      const response = await fetch('/api/mpro2-access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed, indicator: 'mpro2' }),
      });
      const data = await response.json();
      if (data.success && data.isPro) {
        setIsMproPro(true);
        setIsMpro2Pro(true);
        setMproAccessMode('pro');
        setMpro2AccessMode('pro');
        persistProActivation(data.proToken || trimmed);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid or unauthorized license key.' };
    } catch {
      // Fallback offline verification for authorized key pattern
      const pattern = /^096886-[A-Za-z0-9_-]+-Mchart$/i;
      if (pattern.test(trimmed) || trimmed.toUpperCase() === '096886-XX-MCHART' || trimmed.toUpperCase() === 'MCHARTS-MIHIRETU-JUMP10-2019') {
        setIsMproPro(true);
        setIsMpro2Pro(true);
        setMproAccessMode('pro');
        setMpro2AccessMode('pro');
        persistProActivation(trimmed);
        return { success: true };
      }
      return { success: false, error: 'Invalid or unauthorized license key.' };
    }
  };

  const handleActivateMpro2Demo = () => {
    setMpro2AccessMode('demo');
    localStorage.setItem('mpro2_signals_mode', 'demo');
  };

  // Modals Visibility
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'indicators' | 'settings'>('settings');
  const [settingsTab, setSettingsTab] = useState<'candles' | 'appearance' | 'indicators' | 'added_indicators' | 'all_indicators' | 'connection'>('candles');


  // Risk/Reward Modal & Calculator State (Deriv MT5 Standard)
  const [isRiskRewardModalOpen, setIsRiskRewardModalOpen] = useState(false);
  const [editingRiskRewardSetup, setEditingRiskRewardSetup] = useState<{
    isLong: boolean;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    lotSize: number;
    drawingId?: string;
  } | null>(null);

  const handleOpenRiskRewardModal = (setup?: {
    isLong: boolean;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    lotSize: number;
    drawingId?: string;
  }) => {
    if (setup) {
      setEditingRiskRewardSetup(setup);
    } else {
      const existingRr = (drawings || []).find((d) => d.type === 'risk_reward');
      if (existingRr && existingRr.riskReward) {
        setEditingRiskRewardSetup({
          isLong: existingRr.riskReward.isLong,
          entryPrice: existingRr.riskReward.entryPrice,
          targetPrice: existingRr.riskReward.targetPrice,
          stopPrice: existingRr.riskReward.stopPrice,
          lotSize: existingRr.riskReward.lotSize || activeSymbolSpec.minLot,
          drawingId: existingRr.id,
        });
      } else {
        setEditingRiskRewardSetup(null);
      }
    }
    setIsRiskRewardModalOpen(true);
  };

  const handleApplyRiskRewardSetup = (setup: {
    isLong: boolean;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    lotSize: number;
  }) => {
    const currentDrawings = drawings || [];
    const targetDrawingId = editingRiskRewardSetup?.drawingId;

    if (targetDrawingId && currentDrawings.some((d) => d.id === targetDrawingId)) {
      setDrawings((prev) =>
        (prev || []).map((d) => {
          if (d.id === targetDrawingId) {
            return {
              ...d,
              points: [
                { time: d.points[0]?.time || (activeCandles[activeCandles.length - 1]?.time || Date.now() / 1000), price: setup.entryPrice },
                { time: d.points[1]?.time || ((activeCandles[activeCandles.length - 1]?.time || Date.now() / 1000) + 1800), price: setup.entryPrice },
              ],
              riskReward: {
                ...d.riskReward,
                isLong: setup.isLong,
                entryPrice: setup.entryPrice,
                targetPrice: setup.targetPrice,
                stopPrice: setup.stopPrice,
                lotSize: setup.lotSize,
              },
            };
          }
          return d;
        })
      );
    } else {
      const lastCandle = activeCandles.length > 0 ? activeCandles[activeCandles.length - 1] : null;
      const avgSpan = activeCandles.length > 1 ? (activeCandles[1].time - activeCandles[0].time) : 60;
      const startIdx = Math.max(0, activeCandles.length - 15);
      const startTime = activeCandles[startIdx]?.time || Date.now() / 1000 - avgSpan * 15;
      const endTime = (lastCandle?.time || Date.now() / 1000) + avgSpan * 15;

      const newDrawing: Drawing = {
        id: 'drawing_rr_' + Date.now(),
        type: 'risk_reward',
        points: [
          { time: startTime, price: setup.entryPrice },
          { time: endTime, price: setup.entryPrice },
        ],
        color: '#2196f3',
        lineWidth: 1.5,
        riskReward: {
          isLong: setup.isLong,
          entryPrice: setup.entryPrice,
          targetPrice: setup.targetPrice,
          stopPrice: setup.stopPrice,
          riskAmount: 100,
          lotSize: setup.lotSize,
        },
      };

      setDrawings((prev) => [...(prev || []), newDrawing]);
    }

    setIsRiskRewardModalOpen(false);
    setEditingRiskRewardSetup(null);
  };

  const handleOpenSettings = (tab: 'candles' | 'appearance' | 'indicators' | 'added_indicators' | 'all_indicators' | 'connection' = 'candles') => {
    if (tab === 'indicators' || tab === 'added_indicators' || tab === 'all_indicators') {
      setModalMode('indicators');
    } else {
      setModalMode('settings');
    }
    setSettingsTab(tab);
    setIsSettingsModalOpen(true);
  };

  const handleOpenIndicators = () => {
    setModalMode('indicators');
    setSettingsTab('added_indicators');
    setIsSettingsModalOpen(true);
  };

  // Settings state (Loaded from localStorage if exists)
  const [settings, setSettings] = useState<ChartSettings>(() => {
    try {
      const saved = localStorage.getItem('mihiretu_chart_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.appearance && parsed.appearance.backgroundColor === '#131722') {
          parsed.appearance.backgroundColor = '#000000';
          parsed.appearance.gridColor = '#141414';
        }
        if (parsed.indicators) {
          // If the user hasn't explicitly customized, ensure only higher/lower lines and shadows are shown
          if (parsed.indicators.mpro2ShowDottedLines === undefined) {
            parsed.indicators.mpro2ShowDottedLines = false;
          }
          if (parsed.indicators.srShowCenterShadows === undefined) {
            parsed.indicators.srShowCenterShadows = false;
          }
          // TradingView Pine Script v6 uses fixed 3x & 12x multipliers by default
          if (parsed.indicators.mtfEmaAdaptiveTf === undefined) {
            parsed.indicators.mtfEmaAdaptiveTf = false;
          }
        }
        // Upgrade previous blinding pure-white theme to eye-friendly off-light white
        if (parsed.theme === 'light' || parsed.theme === 'offlight-white') {
          if (!parsed.appearance || parsed.appearance.backgroundColor === '#ffffff' || parsed.appearance.backgroundColor === '#fff') {
            parsed.theme = 'offlight-white';
            parsed.appearance = {
              ...(parsed.appearance || {}),
              backgroundColor: '#f0f3fa',
              gridColor: '#e0e3eb',
              crosshairColor: '#8c92a4',
            };
          }
        }
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          historySpan: parsed.historySpan || '1M',
          candle: { ...DEFAULT_SETTINGS.candle, ...(parsed.candle || {}) },
          appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
          indicators: { ...DEFAULT_SETTINGS.indicators, ...(parsed.indicators || {}) },
          connection: { ...DEFAULT_SETTINGS.connection, ...(parsed.connection || {}) }
        };
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  // Fetch Live Data & Active Symbols via Deriv WebSocket
  const { 
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
  } = useDerivWS(
    selectedSymbol,
    selectedTimeframe,
    settings.connection,
    settings.historySpan || '1M'
  );

  // Synchronize Replay Mode: Conceal future candles when Replay is engaged
  useEffect(() => {
    if (isReplayMode) {
      if (candles.length > 25) {
        setReplayIndex(candles.length - 25);
      } else {
        setReplayIndex(Math.max(0, candles.length - 1));
      }
    } else {
      setIsReplayPlaying(false);
    }
  }, [isReplayMode]);

  // Keep replayIndex anchored when older history is prepended during replay.
  // Without this, loading more history shifts every index and the replay position jumps to a different candle.
  useEffect(() => {
    if (candles.length === 0) {
      prevCandlesLengthRef.current = 0;
      prevFirstCandleTimeRef.current = null;
      return;
    }
    const prevLen = prevCandlesLengthRef.current;
    const prevFirstTime = prevFirstCandleTimeRef.current;
    const currFirstTime = candles[0].time;

    if (isReplayMode && prevLen > 0 && prevFirstTime !== null && currFirstTime < prevFirstTime) {
      const oldFirstIdx = candles.findIndex((c) => c.time === prevFirstTime);
      if (oldFirstIdx > 0) {
        setReplayIndex((prev) => prev + oldFirstIdx);
      }
    }

    prevCandlesLengthRef.current = candles.length;
    prevFirstCandleTimeRef.current = currFirstTime;
  }, [candles, isReplayMode]);

  // Auto-load older history when stepping back near the earliest loaded candle during replay
  useEffect(() => {
    if (!isReplayMode || !loadMoreHistory || !hasMoreHistory || isLoadingMore) return;
    if (replayIndex <= 15 && candles.length >= 5) {
      loadMoreHistory();
    }
  }, [isReplayMode, replayIndex, loadMoreHistory, hasMoreHistory, isLoadingMore, candles.length]);

  // Bar Replay Auto-Playback Timer (1x, 2x, 5x)
  useEffect(() => {
    if (!isReplayMode || !isReplayPlaying) return;
    const intervalMs = Math.max(150, Math.round(1000 / replaySpeed));
    const timer = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= candles.length - 1) {
          setIsReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isReplayMode, isReplayPlaying, replaySpeed, candles.length]);

  // Candle slice visible to the chart during Replay Mode
  const activeCandles = isReplayMode && candles.length > 0
    ? candles.slice(0, Math.min(candles.length, Math.max(5, replayIndex + 1)))
    : candles;

  const currentReplayCandle = activeCandles.length > 0
    ? activeCandles[activeCandles.length - 1]
    : null;

  // Persistence: Save Settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('mihiretu_chart_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to persist settings:', e);
    }
  }, [settings]);

  // Persistence: Save active symbol to localStorage
  useEffect(() => {
    if (selectedSymbol) {
      try {
        localStorage.setItem('mihiretu_selected_symbol', selectedSymbol);
      } catch (e) {
        console.error('Failed to persist selected symbol:', e);
      }
    }
  }, [selectedSymbol]);

  // Persistence: Save active timeframe to localStorage
  useEffect(() => {
    if (selectedTimeframe) {
      try {
        localStorage.setItem('mihiretu_selected_timeframe', selectedTimeframe);
      } catch (e) {
        console.error('Failed to persist selected timeframe:', e);
      }
    }
  }, [selectedTimeframe]);

  // Full-App Theme Synchronization: update html, body, and colorScheme
  useEffect(() => {
    const isDark = isDarkTheme(settings.theme);
    const preset = getThemePreset(settings.theme);
    
    document.documentElement.dataset.themeMode = isDark ? 'dark' : 'light';
    document.documentElement.dataset.themeId = settings.theme;
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('app-theme-light', !isDark);
    document.documentElement.classList.toggle('app-theme-dark', isDark);
    
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.style.backgroundColor = preset.backgroundColor;
    document.body.style.color = preset.textColor;

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', preset.surfaceColor || preset.backgroundColor);
    }
  }, [settings.theme]);

  // Sync drawings for the selected symbol asset
  useEffect(() => {
    try {
      const savedDrawings = localStorage.getItem(`drawings_${selectedSymbol}`);
      if (savedDrawings) {
        const parsed = JSON.parse(savedDrawings);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.filter(
            (d) => d && typeof d === 'object' && Array.isArray(d.points)
          );
          setDrawings(sanitized);
        } else {
          setDrawings([]);
        }
      } else {
        setDrawings([]);
      }
    } catch (e) {
      console.error('Failed to load drawings for symbol:', e);
      setDrawings([]);
    }
  }, [selectedSymbol]);

  // Persist drawings changes to localStorage
  const handleUpdateDrawings = (updater: React.SetStateAction<Drawing[]>) => {
    setDrawings((prev) => {
      const nextRaw = typeof updater === 'function' ? updater(prev) : updater;
      const next = Array.isArray(nextRaw)
        ? nextRaw.filter((d) => d && typeof d === 'object' && Array.isArray(d.points))
        : [];
      try {
        localStorage.setItem(`drawings_${selectedSymbol}`, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to persist drawings:', e);
      }
      return next;
    });
  };

  const handleClearAllDrawings = () => {
    handleUpdateDrawings([]);
  };

  const handleToggleIndicator = (key: keyof ChartSettings['indicators']) => {
    setSettings((prev) => {
      const currentVal = prev.indicators[key] !== undefined
        ? prev.indicators[key]
        : (DEFAULT_SETTINGS.indicators[key] ?? true);
      return {
        ...prev,
        indicators: {
          ...prev.indicators,
          [key]: !currentVal,
        },
      };
    });
  };

  const handleUpdateIndicator = <K extends keyof ChartSettings['indicators']>(
    key: K,
    value: ChartSettings['indicators'][K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      indicators: {
        ...prev.indicators,
        [key]: value,
      },
    }));
  };

  const handleToggleTheme = () => {
    const isDark = isDarkTheme(settings.theme);
    const nextTheme: ChartThemeId = isDark ? 'offlight-white' : 'blue-dark';
    const preset = getThemePreset(nextTheme);

    setSettings({
      ...settings,
      theme: nextTheme,
      appearance: {
        ...settings.appearance,
        backgroundColor: preset.backgroundColor,
        gridColor: preset.gridColor,
        crosshairColor: preset.crosshairColor
      }
    });
  };

  const handleCaptureChart = () => {
    const canvas = document.getElementById('trading-chart-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      // Draw original chart canvas
      ctx.drawImage(canvas, 0, 0);

      const width = tempCanvas.width;
      const height = tempCanvas.height;

      ctx.save();

      // 1. Top-Right Professional Signal Targets Blueprint Card (SL, TP, Entry, RR)
      const lastCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
      const currentPrice = lastCandle ? lastCandle.close : 0;
      const decimals = currentPrice > 1000 ? 2 : currentPrice > 10 ? 3 : 5;

      // Determine signal target details
      const signalToStamp = selectedMproRRSignal ? {
        type: selectedMproRRSignal.type,
        entryPrice: selectedMproRRSignal.entryPrice,
        stopLossPrice: selectedMproRRSignal.stopLossPrice,
        takeProfitPrice: selectedMproRRSignal.takeProfitPrice,
        qualityScore: 92,
        reason: '1:2.5 RR Classification'
      } : null;

      const cardW = Math.min(340, width - 40);
      const cardH = signalToStamp ? 140 : 100;
      const cardX = width - cardW - 20;
      const cardY = 20;

      // Card Background with dark glass effect and border
      ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
      ctx.strokeStyle = signalToStamp 
        ? (signalToStamp.type === 'BUY' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)')
        : 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(cardX, cardY, cardW, cardH, 10);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.fill();
      ctx.stroke();

      // Card Header
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const headerTitle = signalToStamp
        ? `🎯 MPRO ${signalToStamp.type} SETUP`
        : `📊 ${selectedSymbol} MARKET SNAPSHOT`;
      ctx.fillText(headerTitle, cardX + 14, cardY + 12);

      // Subheader badge (Timeframe & Pair)
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.fillText(`${selectedSymbol} • ${selectedTimeframe}`, cardX + cardW - 14, cardY + 13);

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 12, cardY + 32);
      ctx.lineTo(cardX + cardW - 12, cardY + 32);
      ctx.stroke();

      if (signalToStamp) {
        // Row 1: Entry Price
        ctx.font = '11px -apple-system, BlinkMacSystemFont, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText('ENTRY PRICE:', cardX + 14, cardY + 44);
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(signalToStamp.entryPrice.toFixed(decimals), cardX + cardW - 14, cardY + 44);

        // Row 2: Stop Loss (-1.0R)
        ctx.font = '11px -apple-system, BlinkMacSystemFont, monospace';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'left';
        ctx.fillText('STOP LOSS (-1.0R):', cardX + 14, cardY + 66);
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'right';
        ctx.fillText(signalToStamp.stopLossPrice.toFixed(decimals), cardX + cardW - 14, cardY + 66);

        // Row 3: Take Profit (+2.5R)
        ctx.font = '11px -apple-system, BlinkMacSystemFont, monospace';
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'left';
        ctx.fillText('TAKE PROFIT (+2.5R):', cardX + 14, cardY + 88);
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#6ee7b7';
        ctx.textAlign = 'right';
        ctx.fillText(signalToStamp.takeProfitPrice.toFixed(decimals), cardX + cardW - 14, cardY + 88);

        // Row 4: Risk / Reward Summary
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'left';
        ctx.fillText('RISK/REWARD: 1 : 2.50 R:R (+$2.50 on $1.00 risk)', cardX + 14, cardY + 112);
      } else {
        // General Price Details
        ctx.font = '11px -apple-system, BlinkMacSystemFont, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText('CURRENT PRICE:', cardX + 14, cardY + 46);
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(currentPrice > 0 ? currentPrice.toFixed(decimals) : 'N/A', cardX + cardW - 14, cardY + 46);

        ctx.font = '10px monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'left';
        ctx.fillText('3-Rule Liquidity Scanner Active', cardX + 14, cardY + 72);
      }

      // 2. Large subtle background watermark in bottom-center/left (TradingView style)
      const watermarkFontSize = Math.max(28, Math.floor(width / 30));
      ctx.font = `700 ${watermarkFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Mihiretuview Charts', 36, height - 65);

      const subFontSize = Math.max(14, Math.floor(watermarkFontSize * 0.5));
      ctx.font = `600 ${subFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillText(`${selectedSymbol} • ${selectedTimeframe}`, 36, height - 42);

      // 3. Crisp bottom-left branding pill badge with Timestamp
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      const badgePaddingX = 12;
      const badgePaddingY = 6;
      const badgeText = `Mihiretuview Charts | ${selectedSymbol} (${selectedTimeframe}) | ${nowStr}`;
      const badgeFontSize = 12;
      ctx.font = `600 ${badgeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textWidth = ctx.measureText(badgeText).width;

      const badgeX = 24;
      const badgeY = height - 32;
      const badgeW = textWidth + badgePaddingX * 2 + 10;
      const badgeH = badgeFontSize + badgePaddingY * 2;

      // Semi-transparent dark pill background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(badgeX, badgeY - badgeH / 2 - 2, badgeW, badgeH, 6);
      } else {
        ctx.rect(badgeX, badgeY - badgeH / 2 - 2, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      // Accent blue indicator dot
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(badgeX + 12, badgeY + 2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Text label
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + 22, badgeY + 2);

      ctx.restore();

      const dataUrl = tempCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Mihiretuview_${selectedSymbol}_${selectedTimeframe}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to capture chart screenshot:', e);
    }
  };

  const activeSymbolInfo = symbols.find(s => s.symbol === selectedSymbol);
  const activeSymbolSpec = useMemo(() => getSymbolSpec(selectedSymbol, activeSymbolInfo), [selectedSymbol, activeSymbolInfo]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#09090b] text-[#fafafa] font-sans">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm text-neutral-400 font-medium tracking-wide">Validating Secure Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {viewMode === 'landing' ? (
          <LandingPage
            onGetStarted={() => setViewMode('password')}
            onOpenSupport={() => setIsSupportOpen(true)}
          />
        ) : (
          <LoginPage onBackToHome={() => setViewMode('landing')} />
        )}
        <SupportModal
          isOpen={isSupportOpen}
          onClose={() => setIsSupportOpen(false)}
        />
      </>
    );
  }

  const isDark = isDarkTheme(settings.theme);
  const activeThemePreset = getThemePreset(settings.theme);

  return (
    <div 
      id="app-root-container"
      data-app-theme={settings.theme}
      className={`h-screen w-screen flex flex-col font-sans transition-colors duration-150 overflow-hidden ${
        isDark ? 'bg-black text-white app-theme-dark' : 'bg-[#f0f3fa] text-slate-900 app-theme-light'
      }`}
      style={{
        backgroundColor: activeThemePreset.backgroundColor,
        color: activeThemePreset.textColor,
      }}
    >
      {/* 1. Header Toolbar (Hidden in TradingView Chart-Only mode) */}
      {!isChartOnlyMode && (
        <TopToolbar
          selectedSymbol={selectedSymbol}
          symbols={symbols}
          selectedTimeframe={selectedTimeframe}
          onSelectTimeframe={setSelectedTimeframe}
          onOpenSymbolModal={() => setIsSymbolModalOpen(true)}
          onOpenSettingsModal={() => handleOpenSettings('candles')}
          onOpenIndicators={handleOpenIndicators}
          onCaptureChart={handleCaptureChart}
          isConnected={isConnected}
          onReconnect={reconnect}
          theme={settings.theme}
          onToggleTheme={handleToggleTheme}
          favorites={favs.favorites}
          onToggleFavorite={favs.toggleFavorite}
          onSelectSymbol={setSelectedSymbol}
          isReplayMode={isReplayMode}
          onToggleReplayMode={() => {
            const next = !isReplayMode;
            setIsReplayMode(next);
            if (next && candles.length > 25) {
              setReplayIndex(candles.length - 25);
            }
            setIsReplayPlaying(false);
          }}
          layoutCount={layoutCount}
          onChangeLayout={setLayoutCount}
          isChartOnly={isChartOnlyMode}
          onToggleChartOnly={toggleChartOnlyMode}
        />
      )}

      {/* Bar Replay Playback Toolbar (LIVE ↔ REPLAY, Step Back ◀, Play ▶, Step Forward ▶, Jump ▶▶, 1x 2x 5x) */}
      {!isChartOnlyMode && (
        <BarReplayControls
          isReplayMode={isReplayMode}
          onToggleReplayMode={() => {
            setIsReplayMode(false);
            setIsReplayPlaying(false);
          }}
          replayIndex={replayIndex}
          totalCandles={candles.length}
          currentCandle={currentReplayCandle}
          isPlaying={isReplayPlaying}
          onTogglePlay={() => setIsReplayPlaying((prev) => !prev)}
          onStepBack={() => setReplayIndex((prev) => Math.max(5, prev - 1))}
          onStepForward={() => setReplayIndex((prev) => Math.min(candles.length - 1, prev + 1))}
          onJumpToEnd={() => setReplayIndex(candles.length - 1)}
          onJumpToStart={() => setReplayIndex(5)}
          onSeek={(idx) => setReplayIndex(idx)}
          onBarsBack={(bars) => setReplayIndex((prev) => Math.max(5, prev - bars))}
          speed={replaySpeed}
          onChangeSpeed={(spd) => setReplaySpeed(spd)}
          theme={settings.theme}
        />
      )}

      {/* 2. Main Display Area */}
      <div id="main-display-layout" className="flex flex-grow w-full overflow-hidden relative">
        {/* Left Vertical Tools Sidebar (Hidden in Chart-Only mode) */}
        {!isChartOnlyMode && (
          <LeftToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onClearDrawings={handleClearAllDrawings}
            drawingsCount={(drawings || []).length}
            isMagnetActive={isMagnetActive}
            onToggleMagnet={() => setIsMagnetActive((prev) => !prev)}
            onOpenRiskRewardModal={handleOpenRiskRewardModal}
            theme={settings.theme}
          />
        )}

        {/* Center Canvas panel with optional overlay loaders */}
        <div id="central-chart-stage" className="flex-grow h-full relative overflow-hidden flex flex-col">
          
          {/* Symbol Info Bar (Thin TradingView-style pair name bar to maximize chart canvas space, hidden in Chart-Only mode) */}
          {!isChartOnlyMode && (
            <div 
              id="symbol-info-banner" 
              className={`h-6 sm:h-6.5 border-b px-2.5 sm:px-3 flex items-center justify-between text-[11px] font-medium select-none shrink-0 transition-colors ${
                isDark ? 'bg-black border-neutral-850 text-white' : 'bg-white border-neutral-200 text-slate-800'
              }`}
              style={{
                backgroundColor: isDark ? activeThemePreset.surfaceColor || '#0c0c0e' : '#ffffff',
                borderColor: isDark ? activeThemePreset.borderColor : '#e2e8f0',
                color: activeThemePreset.textColor,
              }}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => favs.toggleFavorite(selectedSymbol)}
                  className={`p-0.5 rounded transition-colors ${isDark ? 'hover:bg-neutral-850 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title={favs.isFavorite(selectedSymbol) ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star className={`w-3.5 h-3.5 ${favs.isFavorite(selectedSymbol) ? 'text-amber-400 fill-amber-400' : isDark ? 'text-neutral-600 hover:text-amber-300' : 'text-neutral-400 hover:text-amber-500'}`} />
                </button>
                <span className={`font-mono text-xs font-bold shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{selectedSymbol}</span>
                <span className={`truncate max-w-[160px] sm:max-w-xs text-[11px] ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                  {activeSymbolInfo?.display_name || 'Volatility Index'}
                </span>
                <span className={`text-[10px] font-normal uppercase hidden md:inline shrink-0 ${isDark ? 'text-neutral-500' : 'text-slate-500'}`}>
                  {activeSymbolInfo?.market_display_name || 'Derived Indices'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isReplayMode ? (
                  <span
                    id="badge-mode-replay"
                    className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-500 border border-amber-500/40 flex items-center gap-1"
                  >
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
                    Replay Backtest
                  </span>
                ) : isMarketClosed || activeSymbolInfo?.is_closed ? (
                  <span 
                    id="badge-market-closed"
                    className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border flex items-center gap-1 ${
                      isDark ? 'bg-neutral-900 text-neutral-400 border-neutral-800' : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                    }`}
                    title="Market is currently closed. Historical charts and indicator analysis remain fully accessible."
                  >
                    <span className="w-1 h-1 rounded-full bg-neutral-500" />
                    Closed
                  </span>
                ) : (isLoading || !isConnected) ? (
                  <span 
                    id="badge-market-loading"
                    className={`px-2 py-0.5 text-[9px] font-bold rounded border flex items-center gap-1.5 ${
                      isDark ? 'bg-sky-950/40 text-sky-400 border-sky-800/40' : 'bg-sky-50 text-sky-700 border-sky-300'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full border border-sky-400 border-t-transparent animate-spin shrink-0" />
                    <span>Loading Live Market</span>
                  </span>
                ) : (
                  <span 
                    id="badge-market-live"
                    className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border flex items-center gap-1 ${
                      isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                )}

                {/* TradingView-style [] Fullscreen / Chart-Only Button */}
                <button
                  id="btn-symbol-banner-chart-only"
                  onClick={toggleChartOnlyMode}
                  title="Fullscreen / Chart Only Mode [ ] (TradingView style)"
                  aria-label="Toggle Chart Only Mode"
                  className={`p-1 rounded transition-colors flex items-center justify-center border border-transparent ${
                    isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-slate-900'
                  }`}
                >
                  <svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6V3h3M15 6V3h-3M3 12v3h3M15 12v3h-3" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Discreet Exit Fullscreen Button in Bottom-Right Corner (No top text/banner) */}
          {isChartOnlyMode && (
            <button
              id="btn-exit-chart-only-discrete"
              onClick={toggleChartOnlyMode}
              title="Exit Fullscreen (Esc)"
              aria-label="Exit Chart Only Mode"
              className="absolute bottom-6 right-20 z-40 p-1.5 rounded-md bg-neutral-900/60 hover:bg-neutral-900 text-neutral-400 hover:text-white transition-all backdrop-blur-sm border border-neutral-700/50 opacity-40 hover:opacity-100 cursor-pointer shadow-lg"
            >
              <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3v3H3M12 3v3h3M6 15v-3H3M12 15v-3h3" />
              </svg>
            </button>
          )}

          {/* Chart View (Single or Multi-Chart Layout Grid: 2, 4, 6 charts) */}
          {layoutCount === 1 ? (
            <div className="flex-grow w-full h-full min-h-0 relative">
              {/* Interactive Custom Canvas Chart */}
              <MihiretuViewChart
                candles={activeCandles}
                symbolName={selectedSymbol}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                drawings={drawings}
                setDrawings={handleUpdateDrawings}
                settings={settings}
                timeframe={selectedTimeframe}
                isMagnetActive={isMagnetActive}
                isMproPro={isMproPro}
                mproAccessMode={mproAccessMode}
                onOpenMproModal={() => setIsMproModalOpen(true)}
                isMpro2Pro={isMpro2Pro}
                mpro2AccessMode={mpro2AccessMode}
                onOpenMpro2Modal={() => setIsMpro2ModalOpen(true)}
                selectedMproRRSignal={selectedMproRRSignal}
                onSelectMproRRSignal={setSelectedMproRRSignal}
                onToggleIndicator={handleToggleIndicator}
                onUpdateIndicator={handleUpdateIndicator}
                onOpenSettingsModal={handleOpenSettings}
                onOpenRiskRewardModal={handleOpenRiskRewardModal}
                onLoadMoreHistory={loadMoreHistory}
                isLoadingMoreHistory={isLoadingMore}
                hasMoreHistory={hasMoreHistory}
              />

              {/* Minimalist Fullscreen Loader while loading live market - stays until chart is visible */}
              {(isLoading || candles.length === 0) && (
                <div 
                  id="chart-loading-overlay"
                  className={`absolute inset-0 z-40 flex flex-col items-center justify-center transition-colors select-none ${
                    isDark ? 'bg-[#131722]' : 'bg-[#f0f3fa]'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center p-6 text-center max-w-xs">
                    {/* Modern Double-Ring Glowing Spinner */}
                    <div className="relative w-12 h-12 mb-4">
                      <div className="absolute inset-0 rounded-full border-2 border-sky-500/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                      <div className="absolute inset-2 rounded-full border-2 border-teal-400/40 border-b-transparent animate-spin [animation-duration:1.2s]" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      <h4 className={`text-sm font-semibold tracking-wide ${isDark ? 'text-gray-100' : 'text-slate-800'}`}>
                        Loading Live Market...
                      </h4>
                    </div>

                    <button
                      onClick={() => reconnect()}
                      className="mt-4 px-3 py-1 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium rounded-md border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Multi-Chart Grid for Multi-Timeframe Analysis (2, 4, 6 charts) */
            <div 
              id="multi-chart-grid"
              className={`flex-grow w-full h-full min-h-0 p-1 grid gap-1.5 ${
                isDark ? 'bg-neutral-950' : 'bg-[#e2e8f0]'
              } ${
                layoutCount === 2 
                  ? 'grid-cols-1 md:grid-cols-2 grid-rows-1' 
                  : layoutCount === 4 
                    ? 'grid-cols-2 grid-rows-2' 
                    : 'grid-cols-2 md:grid-cols-3 grid-rows-2'
              }`}
              style={{
                backgroundColor: isDark ? activeThemePreset.backgroundColor : '#e2e8f0'
              }}
            >
              {/* Main Primary Chart (Pane #1) */}
              <div className={`flex flex-col h-full w-full border rounded-md overflow-hidden relative ${
                isDark ? 'bg-black border-neutral-850' : 'bg-white border-neutral-300'
              }`}>
                <div className={`h-7 border-b px-2.5 flex items-center justify-between select-none shrink-0 text-xs ${
                  isDark ? 'bg-neutral-950 border-neutral-850 text-white' : 'bg-neutral-50 border-neutral-200 text-slate-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-900/60 text-blue-300 font-bold border border-blue-700/50">
                      #1 (Main)
                    </span>
                    <span className={`font-bold font-mono text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{selectedSymbol}</span>
                    <span className="text-neutral-500 text-[11px]">•</span>
                    <span className={`font-bold text-[11px] font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedTimeframe}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>LIVE</span>
                  </div>
                </div>
                <div className="flex-grow w-full h-full min-h-0 relative">
                  <MihiretuViewChart
                    candles={activeCandles}
                    symbolName={selectedSymbol}
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    drawings={drawings}
                    setDrawings={handleUpdateDrawings}
                    settings={settings}
                    timeframe={selectedTimeframe}
                    isMagnetActive={isMagnetActive}
                    isMproPro={isMproPro}
                    mproAccessMode={mproAccessMode}
                    onOpenMproModal={() => setIsMproModalOpen(true)}
                    isMpro2Pro={isMpro2Pro}
                    mpro2AccessMode={mpro2AccessMode}
                    onOpenMpro2Modal={() => setIsMpro2ModalOpen(true)}
                    selectedMproRRSignal={selectedMproRRSignal}
                    onSelectMproRRSignal={setSelectedMproRRSignal}
                    onToggleIndicator={handleToggleIndicator}
                    onUpdateIndicator={handleUpdateIndicator}
                    onOpenSettingsModal={handleOpenSettings}
                    onLoadMoreHistory={loadMoreHistory}
                    isLoadingMoreHistory={isLoadingMore}
                    hasMoreHistory={hasMoreHistory}
                  />
                </div>
              </div>

              {/* Secondary Sub-Chart Panes (Multi-Timeframe Analysis) */}
              {Array.from({ length: layoutCount - 1 }).map((_, idx) => {
                const complementaryTimeframes: TimeframeId[] = ['5M', '15M', '1H', '4H', '1D', '30M'];
                const defTf = complementaryTimeframes[idx % complementaryTimeframes.length];
                return (
                  <MultiChartPane
                    key={`multi-chart-pane-${idx + 2}`}
                    id={`pane-${idx + 2}`}
                    paneNumber={idx + 2}
                    symbol={selectedSymbol}
                    defaultTimeframe={defTf}
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    settings={settings}
                    isMagnetActive={isMagnetActive}
                    isMproPro={isMproPro}
                    mproAccessMode={mproAccessMode}
                    onOpenMproModal={() => setIsMproModalOpen(true)}
                    isMpro2Pro={isMpro2Pro}
                    mpro2AccessMode={mpro2AccessMode}
                    onOpenMpro2Modal={() => setIsMpro2ModalOpen(true)}
                    onOpenSettingsModal={handleOpenSettings}
                    theme={settings.theme}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Symbol Selection Search Dialog */}
      <SymbolSelectorModal
        isOpen={isSymbolModalOpen}
        onClose={() => setIsSymbolModalOpen(false)}
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
        favorites={favs.favorites}
        onToggleFavorite={favs.toggleFavorite}
        isFavorite={favs.isFavorite}
        customFolders={favs.customFolders}
        onCreateFolder={favs.createFolder}
        onDeleteFolder={favs.deleteFolder}
        onToggleSymbolInFolder={favs.toggleSymbolInFolder}
        theme={settings.theme}
      />

      {/* 4. Chart Settings Customization Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        initialTab={settingsTab}
        modalMode={modalMode}
        isMproPro={isMproPro}
        mproAccessMode={mproAccessMode}
        onOpenMproModal={() => setIsMproModalOpen(true)}
        isMpro2Pro={isMpro2Pro}
        mpro2AccessMode={mpro2AccessMode}
        onOpenMpro2Modal={() => setIsMpro2ModalOpen(true)}
        onActivatePro={(token) => {
          setIsMproPro(true);
          setIsMpro2Pro(true);
          setMproAccessMode('pro');
          setMpro2AccessMode('pro');
          persistProActivation(token || 'Mcharts-Mihiretu-Jump10-2019');
        }}
        onSwitchToFree={() => {
          setIsMproPro(false);
          setIsMpro2Pro(false);
          setMproAccessMode('free');
          setMpro2AccessMode('free');
          persistProDeactivation();
        }}
      />

      {/* 5. Mpro Signals Exclusive PRO / DEMO Paywall Modal */}
      <MproSignalsModal
        isOpen={isMproModalOpen}
        onClose={() => setIsMproModalOpen(false)}
        isPro={isMproPro}
        accessMode={mproAccessMode}
        onVerifyKey={handleVerifyMproKey}
        onActivateDemo={handleActivateMproDemo}
        isEnabled={settings.indicators.showSrClassification ?? true}
        onToggleEnabled={(enabled) => handleUpdateIndicator('showSrClassification', enabled)}
        theme={settings.theme}
      />

      {/* 6. Mpro2 Signal Exclusive PRO / DEMO Modal (096886-XX-Mchart) */}
      <Mpro2SignalsModal
        isOpen={isMpro2ModalOpen}
        onClose={() => setIsMpro2ModalOpen(false)}
        isPro={isMpro2Pro}
        accessMode={mpro2AccessMode}
        onVerifyKey={handleVerifyMpro2Key}
        onActivateDemo={handleActivateMpro2Demo}
        isEnabled={settings.indicators.showMpro2Signal ?? true}
        onToggleEnabled={(enabled) => handleUpdateIndicator('showMpro2Signal', enabled)}
        showCenterLine={settings.indicators.mpro2ShowExtLine3 ?? true}
        onToggleCenterLine={(show) => handleUpdateIndicator('mpro2ShowExtLine3', show)}
        displayMode={settings.indicators.mpro2DisplayMode ?? 'lines'}
        onChangeDisplayMode={(mode) => handleUpdateIndicator('mpro2DisplayMode', mode)}
        theme={settings.theme}
      />

      {/* 7. Risk/Reward Interactive Placement & Calculation Modal (Deriv MT5 Standard) */}
      <RiskRewardModal
        isOpen={isRiskRewardModalOpen}
        onClose={() => {
          setIsRiskRewardModalOpen(false);
          setEditingRiskRewardSetup(null);
        }}
        currentPrice={activeCandles.length > 0 ? activeCandles[activeCandles.length - 1].close : 96371.56}
        symbolSpec={activeSymbolSpec}
        symbolName={selectedSymbol}
        initialValues={editingRiskRewardSetup}
        onApplySetup={handleApplyRiskRewardSetup}
        theme={settings.theme}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
