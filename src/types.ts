/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type TimeframeId = '1M' | '2M' | '5M' | '15M' | '30M' | '1H' | '4H' | '1D';

export interface Timeframe {
  id: TimeframeId;
  label: string;
  seconds: number;
}

export interface SymbolInfo {
  symbol: string;
  display_name: string;
  market: string;
  market_display_name: string;
  submarket_display_name?: string;
  pip?: number;
  is_closed?: boolean;
}

export type DrawingType = 'cursor' | 'trend' | 'horizontal' | 'risk_reward' | 'brush' | 'rectangle' | 'arrow' | 'path' | 'fixed_range_volume_profile';

export interface DrawingPoint {
  time: number;  // Anchored to the candle's epoch
  price: number; // Anchored to the price
}

export interface RiskRewardConfig {
  isLong: boolean;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  riskAmount: number; // Default risk or percentage
  lotSize: number;
  targetColor?: string;
  stopColor?: string;
  entryColor?: string;
  fillOpacity?: number;
}

export interface VolumeProfileConfig {
  numRows: number;
  vaPercent: number; // 0.70 default
  upColor: string;
  downColor: string;
  pocColor: string;
  vahValColor: string;
  showLabels: boolean;
  extendPocRight?: boolean;
  extendVahValRight?: boolean;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  riskReward?: RiskRewardConfig;
  volumeProfile?: VolumeProfileConfig;
}

export type HistorySpanId = 'all' | '1W' | '2W' | '3W' | '1M' | '2M' | '3M';

export interface HistorySpanOption {
  id: HistorySpanId;
  label: string;
  days: number;
  description: string;
}

export const HISTORY_SPANS: HistorySpanOption[] = [
  { id: 'all', label: 'Default (All)', days: 0, description: 'Continuous infinite scroll (No boundary limit)' },
  { id: '1W', label: '1 Week', days: 7, description: 'Strict 7-day historical boundary' },
  { id: '2W', label: '2 Weeks', days: 14, description: 'Strict 14-day historical boundary' },
  { id: '3W', label: '3 Weeks', days: 21, description: 'Strict 21-day historical boundary' },
  { id: '1M', label: '1 Month', days: 30, description: 'Strict 30-day historical boundary' },
  { id: '2M', label: '2 Months', days: 60, description: 'Strict 60-day historical boundary' },
  { id: '3M', label: '3 Months', days: 90, description: 'Strict 90-day historical boundary' },
];

export type ChartThemeId =
  | 'dark'
  | 'light'
  | 'offlight-white'
  | 'blue-dark'
  | 'offlight-dark'
  | 'nord'
  | 'bloomberg'
  | 'matrix';

export interface ChartSettings {
  theme: ChartThemeId;
  historySpan?: HistorySpanId; // Span covering 1H and all lower timeframes (1M, 5M, 15M, 30M)
  candle: {
    upColor: string;
    downColor: string;
    wickUpColor: string;
    wickDownColor: string;
    borderUpColor: string;
    borderDownColor: string;
  };
  appearance: {
    backgroundColor: string;
    gridColor: string;
    gridStyle: 'solid' | 'dashed' | 'none';
    gridType: 'both' | 'horizontal' | 'vertical' | 'none';
    crosshairColor: string;
    crosshairStyle: 'dashed' | 'solid';
    priceLineColor: string;
  };
  indicators: {
    showMA: boolean;
    maPeriod: number;
    // Auto Price Channels (4H Breakout & Trend Indicator)
    showAutoPriceChannels?: boolean;
    autoPriceChannelsLineWidth?: number;
    autoPriceChannelsColor?: string;
    autoPriceChannelsShowBreakouts?: boolean;
    autoPriceChannelsFill?: boolean;
    // Institutional Auto Supply/Demand Order Blocks & Parallel Channel
    showAutoSupplyDemandChannel?: boolean;
    autoSdcShowSupplyDemand?: boolean;
    autoSdcShowChannel?: boolean;
    autoSdcShowFVGProjections?: boolean;
    autoSdcColor?: string;
    autoSdcFvgBuyColor?: string;
    autoSdcFvgSellColor?: string;
    showGTA: boolean;
    gtaShortPeriod: number;
    gtaMidPeriod: number;
    gtaLongPeriod: number;
    gtaArrowOffset: number;
    showGTAEMAs: boolean; // Toggle EMA lines for GTA
    gtaShowArrows?: boolean; // Toggle Buy/Sell arrows on/off for GTA
    gtaColorCandles?: boolean; // Toggle candle coloring on/off for GTA
    // Trendlines with Breaks Settings
    showTrendlinesWithBreaks: boolean;
    twbLength: number;
    twbSlopeMultiplier: number;
    twbSlopeMethod: 'atr' | 'manual';
    twbShowSignals: boolean; // Toggle breakout signals/arrows on/off
    // Smart Money Concepts (SMC) Settings
    showSmartMoneyConcepts: boolean;
    smcSwingLookback: number;
    smcShowBOS: boolean;
    smcShowCHoCH: boolean;
    smcShowOrderBlocks: boolean;
    smcObMode?: 'strong' | 'all';
    smcStructureLineStyle?: 'dashed' | 'solid' | 'dotted';
    smcObLimit: number;
    smcObOpacityMultiplier?: 1 | 2 | 2.5; // Order blocks shades visible setting (1x, 2x, 2.5x)
    smcInstances?: SMCInstanceConfig[]; // Multi-instance SMC support (e.g. 720 history, Weekly HTF, Daily HTF)
    // LuxAlgo Signals & Overlays Settings
    showSignalsAndOverlays: boolean;
    soSensitivity: number;
    soSignalMode: 'confirmation' | 'contrarian';
    soShowRibbon: boolean;
    soShowExitSignals: boolean;
    soShowStrongSignals: boolean;
    soShowSignalArrows?: boolean; // Toggle Buy/Sell arrows on/off for Signals & Overlays
    showSignalArrows?: boolean; // Global Master toggle for all Buy/Sell and Long/Short signal arrows
    mproShowArrows?: boolean; // Toggle Buy/Sell arrows for Mpro system
    // Confluence FVG Finder Settings
    showConfluenceFVG: boolean;
    fvgDisplayMode?: 'Line' | 'Zone';
    fvgTf1: TimeframeId;
    fvgTf2: TimeframeId;
    fvgTf3: TimeframeId;
    fvgUseNormalizedZones: boolean;
    fvgZoneHeightMethod: 'ATR Based' | 'Fixed Percentage';
    fvgZoneHeightAtrMult: number;
    fvgZoneHeightPercent: number;
    fvgShowBullish: boolean;
    fvgShowBearish: boolean;
    fvgMaxZones: number;
    fvgMinConfluence: number;
    fvgProximityAtrMult: number;
    fvgEnableStrengthRating: boolean;
    fvgMinStrengthFilter: number;
    fvgConfluenceBonus: number;
    fvgBullishColor: string;
    fvgBearishColor: string;
    fvgBullishBorderColor: string;
    fvgBearishBorderColor: string;
    fvgBorderWidth: number;
    fvgShowLabels: boolean;
    fvgShowInfo: boolean;
    fvgInfoTextSize: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
    fvgMitigationType: 'Touch' | 'Full Fill' | '50% Fill';
    fvgShowMitigated: boolean;
    fvgMitigatedColor: string;
    fvgMinGapSize: number;
    fvgUseATRFilter: boolean;
    fvgAtrMultiplier: number;
    fvgAtrLength: number;
    // ICT Concepts (LuxAlgo) Settings
    showIctConcepts: boolean;
    ictMode: 'Present' | 'Historical';
    ictShowMarketStructure: boolean;
    ictMsLength: number;
    ictShowMSS: boolean;
    ictShowBOS: boolean;
    ictStructureLabelMode?: 'CHoCH' | 'MSS';
    ictStructureLineStyle?: 'dashed' | 'solid' | 'dotted';
    ictMssColorBullish: string;
    ictMssColorBearish: string;
    ictBosColorBullish: string;
    ictBosColorBearish: string;
    ictShowDisplacement: boolean;
    ictShowVolumeImbalance: boolean;
    ictViMaxBoxes: number;
    ictViBullishColor: string;
    ictViBearishColor: string;
    ictShowOrderBlocks: boolean;
    ictObMode?: 'strong' | 'all';
    ictObLookback: number;
    ictObMaxCount: number;
    ictObBullishColor: string;
    ictObBearishColor: string;
    ictShowLiquidity: boolean;
    ictLiqMode?: 'strong' | 'all';
    ictLiqSensitivity: number;
    ictLiqMaxBoxes: number;
    ictLiqBullishColor: string;
    ictLiqBearishColor: string;
    ictFvgOption: 'FVG' | 'IFVG' | 'NONE';
    ictFvgShowBullish: boolean;
    ictFvgShowBearish: boolean;
    ictFvgMaxCount: number;
    ictFvgBalancePriceRange: boolean;
    ictFvgBullishColor: string;
    ictFvgBearishColor: string;
    // Zeiierman - Market Structure & Price Action Toolkit Settings (Order Block & Real-Time S/R Grid)
    showMarketStructureToolkit?: boolean;
    mstatPivotLength?: number;
    mstatMaxZones?: number;
    mstatShowDashedProjections?: boolean;
    mstatShowHeightBadges?: boolean;
    mstatBullishColor?: string;
    mstatBearishColor?: string;
    // Pure Price Action Liquidity Sweeps [LuxAlgo] Settings
    showPureLiquiditySweeps?: boolean;
    pureLiquidityDetection?: 'Short Term' | 'Intermediate Term' | 'Long Term';
    pureLiquidityBullishColor?: string;
    pureLiquidityBullishSweepColor?: string;
    pureLiquidityBearishColor?: string;
    pureLiquidityBearishSweepColor?: string;
    // Market Structure Signals | ProjectSyndicate Settings
    showMarketStructureSignals?: boolean;
    mssSwingLength?: number;
    mssBosConfirmation?: 'Close' | 'Wick';
    mssShowCHoCH?: boolean;
    mssTp1Percent?: number;
    mssTp2Percent?: number;
    mssSlPercent?: number;
    mssColorBullish?: string;
    mssColorBearish?: string;
    mssColorTP1?: string;
    mssColorTP2?: string;
    mssColorSL?: string;
    mssBoxTransparency?: number;
    mssBorderTransparency?: number;
    mssDashboardTextSize?: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
    mssSendTelegramSignals?: boolean;
    // Predictive Ranges [LuxAlgo] Settings
    showPredictiveRanges?: boolean;
    prLength?: number;
    prMult?: number;
    prUpperColor?: string;
    prLowerColor?: string;
    prAvgColor?: string;
    prFillOpacity?: number;
    prLineWidth?: number;
    prExtendRight?: boolean;
    prShowLabels?: boolean;
    prShowTouchMarkers?: boolean;
    prShowBreakoutMarkers?: boolean;
    prHighlightActiveTouch?: boolean;
    prMarkerStyle?: 'badges' | 'arrows' | 'dots';
    showCenterEntryLine?: boolean; // Center divider white line on Risk/Reward and signal setups
    // Mpro Signals (Support Resistance Engine) Settings
    showSrClassification?: boolean;
    srShowLabels?: boolean;
    srShowSignals?: boolean;
    srLookback?: number;
    srFade?: number;
    srOpt?: 'line' | 'value';
    srColU?: string;
    srColD?: string;
    srLeft?: number;
    srRight?: number;
    srShowPP?: boolean;
    srShowBreaks?: boolean;
    srLineWidth?: number;
    srLineExtension?: 'Anchored' | 'FullChart';
    srDisplayMode?: 'shadow' | 'lines' | 'both';
    srShadowVisibility?: '0.5x' | '1x' | '2x' | '3x';
    srShowCenterShadows?: boolean; // Center intermediate level shadows on/off (default true)
    srShowStrongShadows?: boolean; // Extreme top & bottom strong boundary shadows on/off (default true)
    srShowMidline?: boolean; // Mpro Middle Equilibrium Line between Higher and Lower shadows (default true)
    srMidlineType?: 'equilibrium' | 'dynamic' | 'both'; // Mpro Middle Line mode: 50% Equilibrium, Dynamic History Path, or Both
    srMidlineColor?: string; // Mpro Middle Line color (default '#06b6d4')
    srMidlineWidth?: number; // Mpro Middle Line width (default 1.5)
    srChc1?: string;
    srLen1?: number;
    srMlt1?: number;
    srRes1?: string;
    srChc2?: string;
    srLen2?: number;
    srMlt2?: number;
    srRes2?: string;
    srChc3?: string;
    srLen3?: number;
    srMlt3?: number;
    srRes3?: string;
    srChc4?: string;
    srLen4?: number;
    srMlt4?: number;
    srRes4?: string;
    srChc5?: string;
    srLen5?: number;
    srMlt5?: number;
    srRes5?: string;
    srChc6?: string;
    srLen6?: number;
    srMlt6?: number;
    srRes6?: string;
    srChc7?: string;
    srLen7?: number;
    srMlt7?: number;
    srRes7?: string;
    srChc8?: string;
    srLen8?: number;
    srMlt8?: number;
    srRes8?: string;
    srChc9?: string;
    srLen9?: number;
    srMlt9?: number;
    srRes9?: string;
    // ECHO mpro (Echo Forecast [LuxAlgo]) Settings
    showEchoMpro?: boolean;
    echoLength?: number; // Evaluation window (default 50)
    echoFcast?: number; // Forecast window (default 50)
    echoFmode?: 'Similarity' | 'Dissimilarity';
    echoCmode?: 'Cumulative' | 'Mean' | 'Linreg';
    echoSrc?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
    echoFcastColor?: string; // default '#2157f3'
    echoFcastStyle?: 'solid' | 'dashed' | 'dotted'; // default 'dotted'
    echoLineWidth?: number; // default 1.5
    echoShowArea?: boolean; // Screen Shade on/off button (default true)
    echoRefAreaColor?: string; // default '#ff5d00'
    echoCorrAreaColor?: string; // default '#089981'
    echoEvalAreaColor?: string; // default '#808080'
    // Master Strategy System (Exclusive Jump 10 Mpro2 Gatekeeper & Dashboard)
    showMasterSignal?: boolean; // Master Signal Engine on/off (default true)
    showMasterDashboard?: boolean; // Master Dashboard HUD on chart on/off (default true)
    // Mpro2 Signal
    showMpro2Signal?: boolean;
    mpro2DisplayMode?: 'lines' | 'shadow' | 'both'; // 'lines' (original lines), 'shadow' (rectangle shadow zones), or 'both'
    mpro2ShadowVisibility?: '0.5x' | '1x' | '2x' | '3x'; // Opacity / thickness multiplier for rectangle shadow
    mpro2RangeMode?: 'WeeklyAnchor' | 'AllChart' | 'Lookback'; // 'WeeklyAnchor' (Fixed Weekly High & Low with Confirmed Swing Lock), 'AllChart', or 'Lookback'
    mpro2LookbackPeriod?: number; // Period (default 200)
    mpro2DelayBars?: number; // Delay (default 5)
    mpro2LineExtensionMode?: 'None' | 'Left' | 'Right' | 'Both' | 'FullChart';
    mpro2ReverseDirection?: boolean;
    mpro2ShowBaseLine0000?: boolean;
    mpro2ShowBaseLine1000?: boolean;
    mpro2BaseLineColor?: string; // default #2962FF
    mpro2BaseLineStyle?: 'Solid' | 'Dotted' | 'Dashed';
    mpro2BaseLineWidth?: number; // default 2
    mpro2ShowDottedLines?: boolean; // Center & extension dotted lines on/off (default true)
    mpro2ShowCenterLine?: boolean; // Explicit center line 0.500 on/off (default true)
    mpro2ShowExtLine1?: boolean;
    mpro2ExtLineRatio1?: number; // 0.236
    mpro2ShowExtLine2?: boolean;
    mpro2ExtLineRatio2?: number; // 0.382
    mpro2ShowExtLine3?: boolean;
    mpro2ExtLineRatio3?: number; // 0.500
    mpro2ShowExtLine4?: boolean;
    mpro2ExtLineRatio4?: number; // 0.618
    mpro2ShowExtLine5?: boolean;
    mpro2ExtLineRatio5?: number; // 0.786
    mpro2ShowExtLine6?: boolean;
    mpro2ExtLineRatio6?: number; // 1.272
    mpro2ShowExtLine7?: boolean;
    mpro2ExtLineRatio7?: number; // 1.414
    mpro2ShowExtLine8?: boolean;
    mpro2ExtLineRatio8?: number; // 1.618
    mpro2ShowExtLine9?: boolean;
    mpro2ExtLineRatio9?: number; // 2.000
    mpro2ExtLineColor?: string; // default #787B86
    mpro2ExtLineStyle?: 'Solid' | 'Dotted' | 'Dashed';
    mpro2ExtLineWidth?: number; // default 1
    mpro2ShowGoldenPocket?: boolean;
    mpro2GoldenPocketColor?: string; // default #FFB020
    mpro2ShowTouchCounts?: boolean;
    mpro2ShowScreenTexts?: boolean; // On/Off setting for screen texts & HUD
    mpro2ShowLevelLabels?: boolean;
    mpro2ShowConfluence?: boolean;
    mpro2PriorSwingCount?: number;
    mpro2ConfluenceTolerancePct?: number;
    mpro2ConfluenceWidthBoost?: number;
    mpro2ConfluenceMarker?: string;
    mpro2UseAdaptiveDetection?: boolean;
    mpro2AtrLength?: number;
    mpro2AtrBaselineLength?: number;
    mpro2ShowTimeZones?: boolean;
    mpro2TimeZoneCount?: number;
    mpro2TimeZoneColor?: string;
    mpro2UseMultiColorZones?: boolean;
    mpro2ShowTimeZoneLabels?: boolean;
    mpro2ShowStatusTable?: boolean;
    mpro2TablePosition?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left';
    mpro2BullColor?: string; // default #26A69A
    mpro2BearColor?: string; // default #EF5350
    mpro2ShowTouchArrows?: boolean; // Buy/Sell arrow on upper/lower line touch
    // HVN Profile (ATAS Market Profile Indicator by ProfitPro)
    showHvnProfile?: boolean;
    hvnPeriodBars?: number; // Segment duration in candles (default 60)
    hvnNumBins?: number; // Price resolution bins (default 40)
    hvnZoneThicknessPct?: number; // Zone vertical tolerance in % (default 3.0)
    hvnExtensionMode?: 'Mitigation' | 'NextPeriod' | 'FullRight';
    hvnMitigationType?: 'Touch' | 'Close';
    hvnZoneColor?: string; // Amber / Gold zone fill (default '#f59e0b')
    hvnZoneBorderColor?: string; // Amber / Gold border (default '#d97706')
    hvnPocLineColor?: string; // Central gold POC line (default '#fbbf24')
    hvnProfileColor?: string; // Dark blue/slate volume silhouette fill (default '#1e3a8a')
    hvnProfileBorderColor?: string; // Profile silhouette outline (default '#3b82f6')
    hvnShowSilhouette?: boolean; // Volume Profile silhouette on/off (default true)
    hvnShowLabels?: boolean; // Price badges on/off (default true)
    hvnShowSecondaryNodes?: boolean; // Secondary HVN peaks (default false)
    // Nexus: Smart Money Suite [BullByte] Settings
    showNexusSuite?: boolean; // Master Toggle for Nexus
    nexusTradingMode?: 'AUTO' | 'SCALPER' | 'SWING' | 'POSITION';
    nexusSignalFilter?: 'A_PLUS_ONLY' | 'A_PLUS_AND_A' | 'B_AND_ABOVE' | 'ALL';
    nexusEntryMode?: 'BOTH' | 'RETEST' | 'BREAK';
    nexusStopLossMode?: 'ATR' | 'PERCENT' | 'SWING';
    nexusShowMarketStructure?: boolean; // BOS, CHoCH, SMS, Swings
    nexusShowOrderBlocks?: boolean; // Scored 1-5 Order Blocks
    nexusShowBreakerBlocks?: boolean; // Mitigated OB to Breaker conversion
    nexusShowFVG?: boolean; // 3-Candle Imbalance & 50% CE
    nexusShowInvertedFVG?: boolean; // Filled FVG inverted to opposite resistance/support
    nexusShowLiquidityPools?: boolean; // BSL / SSL touch pools & sweeps
    nexusShowPremiumDiscount?: boolean; // Premium (25%), Discount (25%), Equilibrium (50%)
    nexusShowSRGlow?: boolean; // Density-weighted S/R with touch glow
    nexusShowVWAP?: boolean; // Volume/Session weighted average price & bands
    nexusShowKeyLevels?: boolean; // PDH, PDL, PDO, PWH, PWL
    nexusShowTrendlines?: boolean; // Smart trendlines & TL BREAK
    nexusShowSignals?: boolean; // Signal arrows (Long / Short entry arrows) and target brackets on/off
    nexusColorCandles?: boolean; // Trend-colored candles (full vs dimmed)
    nexusShowSessions?: boolean; // Asia, London (LDN KZ), NY (NY KZ)
    nexusShowDashboard?: boolean; // NEXUS ENGINE [BullByte] HUD
    nexusShowMarketNarrative?: boolean; // Market narrative status box
    nexusConfirmationBar?: boolean; // Wait for confirmed body break candle
    nexusAtrMultiplierSL?: number; // Default 2.0x ATR
    // Session Filter (Free Indicator)
    showSessionFilter?: boolean; // Master Toggle for Session Filter
    sessionFilterLineStyle?: 'dotted' | 'dashed' | 'solid'; // Dotted or solid or dashed line
    sessionFilterLineWidth?: number; // Line width in pixels (default: 1)
    sessionFilterLineColor?: string; // Base color or uniform color (default: '#94a3b8')
    sessionFilterLineOpacity?: number; // Opacity 10-100 (default: 35)
    sessionFilterShowAsia?: boolean; // Show Asian session (00:00 - 08:00 UTC)
    sessionFilterShowLondon?: boolean; // Show London session (07:00 - 16:00 UTC)
    sessionFilterShowNewYork?: boolean; // Show New York session (13:00 - 21:00 UTC)
    sessionFilterShowStartLine?: boolean; // Show Session Start vertical line
    sessionFilterShowEndLine?: boolean; // Show Session End vertical line
    sessionFilterShowLabels?: boolean; // Show tiny top label with session name
    sessionFilterLabelSize?: 'tiny' | 'small'; // 'tiny' (9px) or 'small' (11px)
    sessionFilterCustomColors?: boolean; // Subtle pastel tints per session vs uniform off-light
    sessionFilterFillBackground?: boolean; // Optional faint background tint (default: false)
    sessionFilterFillOpacity?: number; // Fill opacity (default: 3)
    // Order Blocks with Volume Delta (cTrader Store / Pepperstone PRO Indicator)
    showOrderBlocksWithVolume?: boolean; // Master Toggle for Order Blocks with Volume Delta
    obvSwingLength?: number; // Technical: Swing Length (default 10)
    obvInvalidation?: 'Wick' | 'Close'; // Technical: Invalidation ('Wick' or 'Close', default 'Wick')
    obvShowNearest?: number; // Technical: Show Nearest (default 10)
    obvExtendZones?: number; // Technical: Extend Zones in bars (default 10)
    obvHideInvalidatedZones?: boolean; // Technical: Hide Invalidated Zones (default true)
    obvEnableVolumeDelta?: boolean; // Volume: Enable Volume Delta (default true)
    obvDisplayTotalVolume?: boolean; // Volume: Display Total Volume (default true)
    obvShowDeltaPercent?: boolean; // Volume: Show Delta % (default true)
    obvBullishColor?: string; // Aesthetics: Bullish Block Color (default '#2e7d32')
    obvBearishColor?: string; // Aesthetics: Bearish Block Color (default '#881337')
    obvTotalVolColor?: string; // Aesthetics: Total Vol Text Color (default '#00aaff')
    obvDeltaTextColor?: string; // Aesthetics: Delta % Text Color (default '#ffffff')
    // PRO Institutional Order Blocks (Live 8-Factor Strength & Shadow Engine)
    showProOrderBlocks?: boolean; // Master Toggle for Pro Order Blocks (default: true)
    proObShowShadow?: boolean; // Shadow Visibility toggle (default: true)
    proObShadowOpacity?: number; // Shadow Opacity % 5-70 (default: 25)
    proObMinScore?: number; // Min Score filter 1-8 (default: 4)
    proObShowStrengthPercent?: boolean; // Show Strength % (0-100) inside shadow (default: true)
    proObShowScore?: boolean; // Show [X/8] Score inside shadow (default: true)
    proObExtendBars?: number; // Forward Shadow projection distance in bars (default: 20)
    proObBullishColor?: string; // Bullish Block & Shadow Color (default: '#10b981')
    proObBearishColor?: string; // Bearish Block & Shadow Color (default: '#f43f5e')
    proObShowOnlyUnmitigated?: boolean; // Only show active unmitigated blocks (default: false)
    // Market Structure Target Tracker [MarkitTick] Settings
    showMarketStructureTargetTracker?: boolean; // Master Toggle (default: true)
    msttSwingLen?: number; // Swing Length (default: 5, min: 1, max: 100)
    msttShowBosLine?: boolean; // Show BOS Line (default: true)
    msttShowLabel?: boolean; // Show Labels (default: true)
    msttInvalidateMode?: boolean; // Auto-Invalidate (default: true)
    msttColBullBos?: string; // Bull BOS color (default: 'rgb(0,200,120)')
    msttColBearBos?: string; // Bear BOS color (default: 'rgb(220,50,50)')
    msttColTarget?: string; // Target color (default: 'rgb(255,200,0)')
    msttColHit?: string; // Target Hit color (default: 'rgb(180,100,255)')
    msttShowTpSl?: boolean; // Show Entry/SL/TP (default: true)
    msttSlMulti?: number; // SL ATR Multi (default: 1.0)
    msttTp1Multi?: number; // TP1 ATR Multi (default: 1.5)
    msttTp2Multi?: number; // TP2 ATR Multi (default: 3.0)
    msttTp3Multi?: number; // TP3 ATR Multi (default: 5.0)
    msttAtrLen?: number; // ATR Length (default: 14)
    msttColEntry?: string; // Entry color (default: 'rgb(100,180,255)')
    msttColSl?: string; // SL color (default: 'rgb(255,60,60)')
    msttColTp1?: string; // TP1 color (default: 'rgb(0,220,130)')
    msttColTp2?: string; // TP2 color (default: 'rgb(0,255,180)')
    msttColTp3?: string; // TP3 color (default: 'rgb(0,255,255)')
    // MSTT Target Visibilities & Custom Shades
    msttShowSl?: boolean; // Show SL Line & Label (default: true)
    msttShowTp1?: boolean; // Show TP1 Line & Label (default: true)
    msttShowTp2?: boolean; // Show TP2 Line & Label (default: true)
    msttShowTp3?: boolean; // Show TP3 Line & Label (default: true)
    msttShowSlShade?: boolean; // Show SL Shaded Area (default: true)
    msttShowTp1Shade?: boolean; // Show TP1 Shaded Area (default: true)
    msttShowTp2Shade?: boolean; // Show TP2 Shaded Area (default: true)
    msttShowTp3Shade?: boolean; // Show TP3 Shaded Area (default: true)
    msttColSlShade?: string; // Custom SL Shade Color (default: '#ff3c3c')
    msttColTp1Shade?: string; // Custom TP1 Shade Color (default: '#00dc82')
    msttColTp2Shade?: string; // Custom TP2 Shade Color (default: '#00ffb4')
    msttColTp3Shade?: string; // Custom TP3 Shade Color (default: '#00ffff')
    msttSlShadeAlpha?: number; // SL Shade Opacity (default: 0.30)
    msttTp1ShadeAlpha?: number; // TP1 Shade Opacity (default: 0.30)
    msttTp2ShadeAlpha?: number; // TP2 Shade Opacity (default: 0.15)
    msttTp3ShadeAlpha?: number; // TP3 Shade Opacity (default: 0.05)
    msttHtfRes?: string; // HTF timeframe (default: '240')
    msttUseHtfFilter?: boolean; // HTF Filter (default: false)
    msttHtfRsiLen?: number; // HTF RSI Len (default: 14)
    msttAlertBos?: boolean; // BOS Alert (default: true)
    msttAlertTarget?: boolean; // Target Alert (default: true)
    msttShowDashboard?: boolean; // Show Dashboard (default: true)
    msttDashBgColor?: string; // Dashboard BG (default: 'rgb(10,10,18)')
    msttDashTxtColor?: string; // Dashboard Text (default: 'rgb(220,220,235)')
    // VIP Market Scanner™ (VIP Algos) - Single Pair Matrix
    showVipMarketScanner?: boolean;
    vipScannerShowHud?: boolean;
    vipScannerPosition?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left';
    vipScannerRsiPeriod?: number;
    vipScannerFastEma?: number;
    vipScannerSlowEma?: number;
    vipScannerSignalEma?: number;
    vipScannerShowSignals?: boolean;
    // Premium Signals with Dynamic TP & SL Optimization
    showDynamicTpSlSignals?: boolean;
    dynPeriod1?: number;
    dynMultiplier1?: number;
    dynPeriod2?: number;
    dynMultiplier2?: number;
    dynPriceSource?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
    dynTp1Factor?: number;
    dynTp2Factor?: number;
    dynTp3Factor?: number;
    dynSlRatio?: number;
    dynRangeLookback?: number;
    dynShowChannels?: boolean;
    dynShowFill?: boolean;
    dynShowSignals?: boolean;
    dynShowTpSlLines?: boolean;
    dynShowTable?: boolean;
    dynCh1Color?: string;
    dynCh2Color?: string;
    dynBuyColor?: string;
    dynSellColor?: string;
    // Trade Planner Buy Sell Signals, Stop Loss, TP & Lot Size [LunqFX]
    showTradePlanner?: boolean; // Master Toggle (default: true)
    tpBalance?: number; // Account balance (default: 10000)
    tpRiskPct?: number; // Risk per trade % (default: 1.0)
    tpAccCur?: string; // Account currency (default: 'USD')
    tpLotOver?: number; // Units per lot (0 = automatic)
    tpFastLen?: number; // Fast EMA (value zone) (default: 21)
    tpSlowLen?: number; // Slow EMA (trend) (default: 50)
    tpRsiLen?: number; // Momentum RSI length (default: 14)
    tpZoneW?: number; // Value zone width (× ATR) (default: 0.25)
    tpSlBuf?: number; // Stop buffer beyond pullback (× ATR) (default: 0.20)
    tpMinStop?: number; // Minimum stop distance (× ATR) (default: 0.50)
    tpMaxStop?: number; // Maximum stop distance (× ATR) (default: 3.0)
    tpPbBars?: number; // Pullback lookback (bars) (default: 10)
    tpR1?: number; // TP1 (R) (default: 1.0)
    tpR2?: number; // TP2 (R) (default: 2.0)
    tpR3?: number; // TP3 (R) (default: 3.0)
    tpBeOn?: boolean; // Move stop to entry after TP1 (default: false)
    tpOppOn?: boolean; // Close on opposite signal (default: true)
    tpCandSty?: 'Neon Bloom' | 'Midnight Cyan' | 'Vibrant Neon' | 'Classic Soft' | 'Cool Blue' | 'Off';
    tpShowZone?: boolean; // Show value zone ("water like moving line in screen") (default: true)
    tpShowEmaLines?: boolean; // Show Fast & Slow EMA lines ("line in scren") (default: true)
    tpShowSignals?: boolean; // Show Buy & Sell signals and entry labels (default: true)
    tpShowPlans?: boolean; // Show Risk/Reward boxes and TP lines (default: true)
    tpShowSl?: boolean; // Show SL line & label (default: true)
    tpShowTp1?: boolean; // Show TP1 line & label (default: true)
    tpShowTp2?: boolean; // Show TP2 line & label (default: true)
    tpShowTp3?: boolean; // Show TP3 line & label (default: true)
    tpKeepN?: number; // Plans kept on chart (default: 2)
    tpTagSize?: 'Small' | 'Normal' | 'Large' | 'Huge'; // Level tag size (default: 'Normal')
    tpShowHud?: boolean; // Show HUD Panel (default: true)
    tpHudPos?: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left' | 'Middle Right';
    tpHudSize?: 'Small' | 'Normal' | 'Large';
    // Fibonacci Sequence Swing [ChartPrime]
    showFibonacciSequenceSwing?: boolean; // Master Toggle (default: true)
    fibDepth?: number; // ZigZag Depth (default: 20, min: 5, max: 500)
    fibZigCol?: string; // ZigZag Color (default: 'rgb(146, 151, 167)')
    fibColUp?: string; // Up Levels Color (default: '#22c55e')
    fibColDn?: string; // Down Levels Color (default: '#ef4444')
    fibMaxRetest?: number; // Retest Limit (default: 30)
    fibShowZigZag?: boolean; // Show ZigZag dashed lines (default: true)
    fibShowLevels?: boolean; // Show Fibonacci Sequence horizontal lines (default: true)
    fibShowLabels?: boolean; // Show Fibonacci tags with retest counts (default: true)
    fibShowArrows?: boolean; // Show Pivot tell arrows (▲ / ▼) (default: true)
    fibShowHistorical?: boolean; // Show past completed swings & levels (default: true)
    fibEarlyTurnMode?: boolean; // Live Early Turn Predictor on Candle 0 (default: true)
    fibEarlyDepth?: number; // Early swing sensitivity (default: 12, min: 3, max: 50)
    // Multi-Timeframe EMA 15m 1H [Pine Script v6 Exact Port]
    showMultiTimeframeEma?: boolean; // Master Toggle (default: true)
    mtfEmaLength?: number; // EMA Length (default: 20, minval: 1)
    mtfEmaShow15min?: boolean; // Show 15-minute EMA (default: true)
    mtfEmaShow60min?: boolean; // Show 1-hour EMA (default: true)
    mtfEmaColor15min?: string; // 15-minute EMA Color (default: '#00008B')
    mtfEmaColor60min?: string; // 1-hour EMA Color (default: '#FF0000')
    mtfEmaAdaptiveTf?: boolean; // Dynamically scale to chart timeframe (default: false - Pine Script uses fixed 3x & 12x)
    mtfEmaRenderStyle?: 'water_glaze' | 'line'; // 'water_glaze' (Glossy Teal + Glazed Ceramic + Water Glaze) vs 'line' (Classic Flat Line)
    // Mrov Trade: Opening Range [Pine Script v6 1:1 Implementation]
    showMrovOpeningRange?: boolean;
    mrovRangeColor?: string; // color.rgb(41, 121, 255)
    mrovFillTransparency?: number; // 88 (0..100)
    mrovBorderWidth?: number; // 2 (1..4)
    mrovLevelWidth?: number; // 2 (1..4)
    mrovShowRangeCaption?: boolean; // Show Opening Range Label
    mrovLongColor?: string; // color.rgb(0, 200, 120)
    mrovShortColor?: string; // color.rgb(230, 70, 70)
    mrovHighlightBreakout?: boolean; // Highlight Breakout Candle
    mrovShowSignalLabels?: boolean; // Show LONG / SHORT
    mrovShowBreakoutMarker?: boolean; // Show Entry Marker
    mrovRR?: number; // Risk / Reward ratio (default 3.0)
    mrovShowTradeGrid?: boolean; // Show Trade Grid
    mrovRiskColor?: string; // color.rgb(220, 65, 85)
    mrovRewardColor?: string; // color.rgb(0, 160, 120)
    mrovEntryColor?: string; // color.rgb(230, 230, 230)
    mrovZoneTransparency?: number; // 78 (0..100)
    mrovShowStatsTable?: boolean; // Show Statistics Table HUD
    // EMA 50/100 + Candle Trend | Albert Setups [Pine Script v6 Exact Port]
    showEma50100Trend?: boolean;
    ema50100FastLength?: number; // Fast EMA (default 50)
    ema50100SlowLength?: number; // Slow EMA (default 100)
    ema50100ShowFastEma?: boolean; // Show Fast EMA line (default true)
    ema50100ShowSlowEma?: boolean; // Show Slow EMA line (default true)
    ema50100ShowSignals?: boolean; // Show BUY / SELL (default true)
    ema50100ColorCandles?: boolean; // Color Candles by Trend (default true)
    ema50100ShowBackground?: boolean; // Show Trend Background (default false)
    ema50100FastColor?: string; // color.lime (default '#00e676')
    ema50100SlowColor?: string; // color.orange (default '#ff9800')
    ema50100FastLineWidth?: number; // Fast EMA line width 1..4 (default 2)
    ema50100SlowLineWidth?: number; // Slow EMA line width 1..4 (default 2)
  };
  connection?: {
    customServer: string;
    customAppId: string;
  };
}

// Nexus Smart Money Suite Types
export type NexusTradingMode = 'AUTO' | 'SCALPER' | 'SWING' | 'POSITION';
export type NexusSignalFilter = 'A_PLUS_ONLY' | 'A_PLUS_AND_A' | 'B_AND_ABOVE' | 'ALL';
export type NexusEntryMode = 'BOTH' | 'RETEST' | 'BREAK';
export type NexusStopLossMode = 'ATR' | 'PERCENT' | 'SWING';

export interface NexusSwingPoint {
  index: number;
  time: number;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
}

export interface NexusStructureBreak {
  id: string;
  type: 'BOS' | 'CHoCH' | 'SMS';
  direction: 'BULLISH' | 'BEARISH';
  startIndex: number;
  breakIndex: number;
  time: number;
  price: number;
  level: number;
  confirmed: boolean;
}

export interface NexusOrderBlock {
  id: string;
  type: 'BULL_OB' | 'BEAR_OB';
  originIndex: number;
  startIndex: number;
  endIndex: number;
  topPrice: number;
  bottomPrice: number;
  score: number; // 1 to 5
  displacementRatio: number;
  isMitigated: boolean;
  mitigatedIndex?: number;
  isBreaker: boolean; // Converted to Breaker Block
}

export interface NexusFVG {
  id: string;
  type: 'BULL_FVG' | 'BEAR_FVG';
  startIndex: number;
  endIndex: number;
  topPrice: number;
  bottomPrice: number;
  cePrice: number; // 50% Consequent Encroachment
  isCeTouched: boolean;
  isFilled: boolean;
  filledIndex?: number;
  isInverted: boolean; // iFVG
  isTerminated: boolean;
}

export interface NexusLiquidityPool {
  id: string;
  type: 'BSL' | 'SSL';
  price: number; // weighted average
  touchCount: number;
  swingIndices: number[];
  isSwept: boolean;
  sweepIndex?: number;
  sweepPrice?: number;
}

export interface NexusTrendline {
  id: string;
  type: 'ASCENDING' | 'DESCENDING';
  startIndex: number;
  endIndex: number;
  p1: { index: number; price: number };
  p2: { index: number; price: number };
  touchCount: number;
  isBroken: boolean;
  breakIndex?: number;
}

export interface NexusSRLevel {
  id: string;
  type: 'SUPPORT' | 'RESISTANCE';
  price: number;
  touchCount: number;
  glowIntensity: number;
  lineWidth: number;
}

export interface NexusKeyLevels {
  pdh: number | null;
  pdl: number | null;
  pdo: number | null;
  pwh: number | null;
  pwl: number | null;
}

export interface NexusSessionWindow {
  name: 'Asia' | 'London' | 'New York';
  killZoneName?: 'LDN KZ' | 'NY KZ';
  isKillZone: boolean;
  isActive: boolean;
  startIndex: number;
  endIndex: number;
  high: number;
  low: number;
  openPrice: number;
}

export interface NexusPulseData {
  displacementIndex: number;
  absorptionScore: number;
  structureVelocity: number;
  liquidityGradient: number;
  compositeScore: number; // -100 to +100
  signalLine: number;
  stateDescription: 'Strong Bull' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bear';
}

export interface NexusTemporalMemoryData {
  sweep: { active: boolean; direction: 'BULLISH' | 'BEARISH' | null; barsAgo: number; weight: number };
  zone: { active: boolean; quality: 'OVL' | 'HI' | 'MED' | 'LOW'; barsAgo: number; weight: number };
  displacement: { active: boolean; direction: 'BULLISH' | 'BEARISH' | null; barsAgo: number; weight: number };
  structureBreak: { active: boolean; type: 'BOS' | 'CHoCH' | 'SMS' | null; barsAgo: number };
  sequenceStatus: 'INACTIVE' | 'EARLY' | 'BUILDING' | 'READY';
  sequenceDirection: 'LONG' | 'SHORT' | null;
}

export interface NexusMTFData {
  tf15: { trend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR'; text: string; dir: 'up' | 'down' | 'flat' };
  tf60: { trend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR'; text: string; dir: 'up' | 'down' | 'flat' };
  tf240: { trend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR'; text: string; dir: 'up' | 'down' | 'flat' };
  tfd: { trend: 'STRONG_BULL' | 'BULL' | 'FLAT' | 'BEAR' | 'STRONG_BEAR'; text: string; dir: 'up' | 'down' | 'flat' };
  consensus: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface NexusSignal {
  id: string;
  barIndex: number;
  time: number;
  type: 'LONG' | 'SHORT';
  signalCategory: 'BOS' | 'CHoCH' | 'SMS' | 'RETEST';
  score: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C';
  price: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  slHit: boolean;
  status: 'ACTIVE' | 'TP1_HIT' | 'TP2_HIT' | 'FULL_TARGET' | 'STOPPED_OUT' | 'EXIT_SIGNAL';
  statusText: string;
  exitReason?: string;
}

export interface NexusResults {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';
  premiumHigh: number;
  discountLow: number;
  equilibriumPrice: number;
  hasVolume: boolean;
  swings: NexusSwingPoint[];
  structureBreaks: NexusStructureBreak[];
  orderBlocks: NexusOrderBlock[];
  fvgs: NexusFVG[];
  liquidityPools: NexusLiquidityPool[];
  sweeps: Array<{ type: 'BSL' | 'SSL'; index: number; price: number; time: number }>;
  srLevels: NexusSRLevel[];
  trendlines: NexusTrendline[];
  vwap?: { vwap: number; upperBand1: number; lowerBand1: number };
  keyLevels: NexusKeyLevels;
  sessions: NexusSessionWindow[];
  activeSessionName: string;
  isKillZoneActive: boolean;
  pulse: NexusPulseData;
  temporalMemory: NexusTemporalMemoryData;
  mtf: NexusMTFData;
  signals: NexusSignal[];
  activeTrade: NexusSignal | null;
  candleColors: Array<{ index: number; color: string }>;
  narrative: {
    structureText: string;
    zoneText: string;
    sessionText: string;
    summaryPillText: string;
    summaryPillType: 'bullish' | 'bearish' | 'neutral';
  };
}

export interface SMCInstanceConfig {
  id: string;
  name: string; // e.g. "SMC #1 (720 Candles)", "SMC #2 (Weekly)", "SMC #3 (Daily)"
  enabled: boolean;
  timeframe: 'chart' | '1M' | '5M' | '15M' | '30M' | '1H' | '4H' | 'D' | 'W' | 'M';
  historyCandlesLimit?: number; // e.g. 720, 1000, 500, or 0 (all)
  swingLookback: number; // e.g. 5, 10, 20
  showBOS: boolean;
  showCHoCH: boolean;
  showOrderBlocks: boolean;
  obMode?: 'strong' | 'all';
  obLimit: number;
  obOpacityMultiplier?: 1 | 2 | 2.5;
  structureLineStyle?: 'dashed' | 'solid' | 'dotted';
  bullishColor?: string;
  bearishColor?: string;
  tagBadge?: string; // Short badge, e.g. "720", "W", "D"
}


