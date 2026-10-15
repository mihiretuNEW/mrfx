import React, { useState, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart2,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Clock,
  Workflow,
  Globe,
  Filter,
  ArrowUpRight,
  Menu,
  X,
  Cpu,
  Zap,
  Award,
  Layers,
  Calculator,
  Play,
  RotateCcw,
  Smartphone,
  Sliders,
  DollarSign,
  Maximize2
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenSupport: () => void;
}

// 10 Distinct Professional Strategy Configurations
interface StrategyPreset {
  id: string;
  num: string;
  name: string;
  subtitle: string;
  modules: string[];
  bias: 'BULLISH' | 'BEARISH' | 'BIDIRECTIONAL';
  rr: string;
  timeframe: string;
  marketFit: string;
  executionModel: string;
  confluenceCriteria: string[];
  isUnlockedFree?: boolean;
  isGoldHighlight?: boolean;
}

const STRATEGIES: StrategyPreset[] = [
  {
    id: 'strat-01',
    num: '01',
    name: 'Structural Liquidity Sweep & Order Block Mitigation',
    subtitle: 'Smart Money discount zone re-accumulation setup',
    modules: ['Structure Shift Model', 'Liquidity Sweep Detector', 'Order Block Matrix'],
    bias: 'BULLISH',
    rr: '1:2.4 R:R',
    timeframe: '15M / 1H Confluence',
    marketFit: 'Gold (XAU/USD), Major Forex & Volatility Indices',
    executionModel: 'Limit order at Order Block equilibrium following confirmed liquidity purge.',
    confluenceCriteria: [
      'Prior equal lows (EQL) swept with aggressive wick rejection',
      'Structural Change of Character (CHoCH) on lower timeframe',
      'Unmitigated bullish order block established',
      'Minimum 1:2 Risk/Reward clearance to nearest liquidity high'
    ],
    isUnlockedFree: true,
    isGoldHighlight: true
  },
  {
    id: 'strat-02',
    num: '02',
    name: 'Break of Structure (BOS) Momentum Expansion',
    subtitle: 'High-velocity continuation breakout with displacement confirmation',
    modules: ['Displacement Model', 'Trend Slope Quant', 'Breakout Execution Trigger'],
    bias: 'BULLISH',
    rr: '1:3.2 R:R',
    timeframe: '5M / 15M Intraday',
    marketFit: 'Crypto (BTC, ETH) & Derived Synthetic Indices',
    executionModel: 'Breakout pullback retest on closed displacement bar above swing high.',
    confluenceCriteria: [
      'Displacement candle body closes strictly beyond macro swing high',
      'Momentum acceleration above adaptive baseline slope',
      'Zero immediate supply overhang within the ADR target corridor',
      'Staged profit distribution at ADR 1.0 and ADR 2.0 targets'
    ]
  },
  {
    id: 'strat-03',
    num: '03',
    name: 'Multi-Timeframe Fair Value Gap Equilibrium Fill',
    subtitle: 'Algorithmic liquidity rebalance into unfilled imbalance',
    modules: ['Multi-Timeframe Gap Scanner', 'Equilibrium 50% Projector', 'Reaction Validator'],
    bias: 'BULLISH',
    rr: '1:2.8 R:R',
    timeframe: '1H / 4H Macro Align',
    marketFit: 'Gold Spot, EUR/USD & GBP/USD',
    executionModel: 'Precision fill at 50% midpoint of daily/4H Fair Value Gap.',
    confluenceCriteria: [
      'Concurrent 3-timeframe imbalance overlap confirmed',
      'Imbalance remaining unmitigated (virgin liquidity gap)',
      'Price taps 50% equilibrium line with deceleration wicks',
      'Tight invalidation placed 1 tick outside the gap boundary'
    ]
  },
  {
    id: 'strat-04',
    num: '04',
    name: 'Change of Character (CHoCH) Early Reversal',
    subtitle: 'Macro price exhaustion sweep transitioning into opposite order flow',
    modules: ['Macro Exhaustion Detector', 'Character Shift Matrix', 'Pivot Classifier'],
    bias: 'BEARISH',
    rr: '1:3.5 R:R',
    timeframe: '15M / 1H Timing',
    marketFit: 'Forex Majors & High Volatility Synthetics',
    executionModel: 'First pullback retest into newly created supply block following CHoCH shift.',
    confluenceCriteria: [
      'Failed extension past key resistance (structural liquidity trap)',
      'Aggressive displacement candle breaking internal swing low',
      'Bearish order block validated by candle volume ratio',
      'Target anchored at opposing major swing liquidity pool'
    ]
  },
  {
    id: 'strat-05',
    num: '05',
    name: 'Multi-Timeframe Smooth EMA Momentum Envelope',
    subtitle: 'Pine Script v6 15m (60-period) and 1H (240-period) dual trend alignment',
    modules: ['Pine Script Smooth EMA Engine', 'Trend Separation Quant', 'Retest Anchor'],
    bias: 'BULLISH',
    rr: '1:2.9 R:R',
    timeframe: '15M / 1H Active',
    marketFit: 'Volatility 75 Index, Volatility 100, Gold & Crypto',
    executionModel: 'Trend continuation retest at the smooth 15-minute EMA boundary with 1H anchor support.',
    confluenceCriteria: [
      '15-minute EMA (60) running cleanly above 1-hour EMA (240)',
      'No line crossover inversion across trailing 40 candles',
      'Candle wick test of dynamic blue EMA line shows instant buy rejection',
      'Stop loss anchored safely below the 1-hour red EMA baseline'
    ]
  },
  {
    id: 'strat-06',
    num: '06',
    name: 'High Volume Node (HVN) Point of Control Defense',
    subtitle: 'Volume profile auction acceptance and Point of Control defense',
    modules: ['Market Profile Framework', 'POC Anchor Matrix', 'Order Flow Defense Filter'],
    bias: 'BULLISH',
    rr: '1:2.6 R:R',
    timeframe: '1H / 4H Auction',
    marketFit: 'Bitcoin, Crude Oil, Gold & Major Currencies',
    executionModel: 'Limit buy execution on pullback re-test of high-volume accumulation POC.',
    confluenceCriteria: [
      'Established high-volume node exceeding 70% value area density',
      'Rejection tail on test of Point of Control (POC)',
      'Value Area Low (VAL) acting as dynamic price shelf',
      'Take profit aligned to opposite Value Area High (VAH)'
    ]
  },
  {
    id: 'strat-07',
    num: '07',
    name: 'Predictive Volatility Compression Squeeze',
    subtitle: 'Low-ATR range constriction preceding major volatility expansion',
    modules: ['Volatility Compression System', 'Predictive Range Quant', 'Expansion Trigger'],
    bias: 'BIDIRECTIONAL',
    rr: '1:3.0 R:R',
    timeframe: '15M / 1H',
    marketFit: 'Volatility 75 Index, Volatility 100 & BTC/USD',
    executionModel: 'Straddle breakout execution on verified volatility band puncture.',
    confluenceCriteria: [
      'Band width contracts to lowest 10th percentile over 60 bars',
      'Candle bodies compressed within tight predictive boundaries',
      'First displacement close outside the upper or lower boundary',
      'Trailing stop activated upon ADR 1.5 target arrival'
    ]
  },
  {
    id: 'strat-08',
    num: '08',
    name: 'Adaptive Slope Trendline Break & Confirmation',
    subtitle: 'ATR-calibrated structural slope penetration with signal validation',
    modules: ['Adaptive Slope System', 'ATR Volatility Filter', 'Signal Confirmation Ribbon'],
    bias: 'BULLISH',
    rr: '1:2.2 R:R',
    timeframe: '5M / 15M / 1H',
    marketFit: 'Forex Pairs & Gold Spot',
    executionModel: 'Post-break retest on closed candle across dynamic ATR slope line.',
    confluenceCriteria: [
      'Trendline tested at least 3 times prior to penetration',
      'Breakout candle volume exceeds 1.5x 20-period moving average',
      'Dual confirmation ribbon flips to active bullish alignment',
      'Clear structural invalidation below breakout swing base'
    ]
  },
  {
    id: 'strat-09',
    num: '09',
    name: 'Golden Pocket Harmonic Zone Confluence',
    subtitle: '0.618–0.786 Fibonacci deep discount re-accumulation anchor',
    modules: ['Harmonic Ratio Suite', 'Confluence Tolerance Matrix', 'Zone Time HUD'],
    bias: 'BULLISH',
    rr: '1:3.8 R:R',
    timeframe: '15M / 1H / 4H',
    marketFit: 'Gold (XAU/USD) & Crypto Assets',
    executionModel: 'Staged entry between 0.618 and 0.786 harmonic ratio levels.',
    confluenceCriteria: [
      'Prior impulse wave clearly defines high-to-low origin coordinates',
      'Golden Pocket overlaps with unmitigated structural demand zone',
      'Time-zone cycle indicator indicates London / New York session open',
      'Asymmetric 1:3.8 risk/reward ratio to prior swing apex'
    ],
    isGoldHighlight: true
  },
  {
    id: 'strat-10',
    num: '10',
    name: 'Synthetic Tick Velocity Spike Exhaustion',
    subtitle: 'Non-linear price jump absorption and mean-reversion capture',
    modules: ['Synthetic Pulse Monitor', 'Tick Velocity Scanner', 'Spike Defense Matrix'],
    bias: 'BEARISH',
    rr: '1:2.5 R:R',
    timeframe: '1M / 5M Synthetic',
    marketFit: 'Crash 1000, Crash 500, Boom 1000, Boom 500',
    executionModel: 'Precision exhaustion order placement above spike cluster ceiling.',
    confluenceCriteria: [
      'Consecutive tick acceleration exceeding 3x statistical average',
      'Arrival into historical synthetic order block ceiling',
      'Immediate tick dampening on lower timeframe micro-candles',
      'Guaranteed stop loss placed beyond spike distribution boundary'
    ]
  }
];

// All 26 Technical Indicators in the Codebase
interface IndicatorItem {
  id: string;
  name: string;
  category: 'structure' | 'trend' | 'volume' | 'harmonic' | 'volatility';
  categoryLabel: string;
  description: string;
  tag: string;
  badge?: string;
}

const ALL_26_INDICATORS: IndicatorItem[] = [
  { id: '1', name: 'Smart Money Concepts (SMC)', category: 'structure', categoryLabel: 'Structure', description: 'Automated BOS, CHoCH, Swing highs/lows, Order Blocks, and Liquidity Pools.', tag: 'Institutional Core' },
  { id: '2', name: 'Confluence FVG Finder', category: 'structure', categoryLabel: 'Structure', description: 'Multi-timeframe Fair Value Gaps with 50% equilibrium mitigation projection.', tag: 'Imbalance' },
  { id: '3', name: 'Market Structure Signals & Target Corridors', category: 'structure', categoryLabel: 'Structure', description: 'Non-repainting BOS/CHoCH breakouts with dynamic ADR10 TP1, TP2, and SL corridors.', tag: 'Execution' },
  { id: '4', name: 'Auto Supply & Demand Zones', category: 'structure', categoryLabel: 'Structure', description: 'High-probability order block rectangles with volume mitigation validation.', tag: 'Zones' },
  { id: '5', name: 'Pure Liquidity Sweeps', category: 'structure', categoryLabel: 'Structure', description: 'Real-time Equal Highs (EQH) and Equal Lows (EQL) purge alerts.', tag: 'Liquidity' },
  { id: '6', name: 'Zeiierman Structural Toolkit', category: 'structure', categoryLabel: 'Structure', description: 'Advanced pivot-based S/R grid with dynamic supply/demand height zones.', tag: 'Price Action' },
  { id: '7', name: 'Mpro Support & Resistance Levels', category: 'structure', categoryLabel: 'Structure', description: 'Multi-depth swing pivot classification with anchored and full-chart shadow projections.', tag: 'Support/Resistance' },
  { id: '8', name: 'Multi-Timeframe EMA 15m 1H', category: 'trend', categoryLabel: 'Trend', description: 'Exact Pine Script v6 port: smooth 15m (60) & 1H (240) moving averages without staircasing.', tag: 'Pine Script v6', badge: 'NEW' },
  { id: '9', name: 'GTA Trend & Momentum Suite', category: 'trend', categoryLabel: 'Trend', description: 'Triple EMA trend alignment ribbon with momentum candle coloring and arrow triggers.', tag: 'Momentum' },
  { id: '10', name: 'Trendlines with Breaks', category: 'trend', categoryLabel: 'Trend', description: 'ATR-calibrated structural slope trendlines featuring early breakout warning arrows.', tag: 'Trendlines' },
  { id: '11', name: 'LuxAlgo Signals & Overlays', category: 'trend', categoryLabel: 'Trend', description: 'Confirmation and contrarian signal system with volatility ribbon and exit alert flags.', tag: 'Signals' },
  { id: '12', name: 'Auto Price Channels (4H)', category: 'trend', categoryLabel: 'Trend', description: '4H trend breakout channels with dynamic upper/lower boundary fills.', tag: 'Channels' },
  { id: '13', name: 'High Volume Nodes (HVN)', category: 'volume', categoryLabel: 'Volume', description: 'ATAS-style Market Profile volume silhouette, Point of Control (POC), and Value Area bounds.', tag: 'Market Profile' },
  { id: '14', name: 'Fixed Range Volume Profile (FRVP)', category: 'volume', categoryLabel: 'Volume', description: 'User-anchored micro volume distribution calculating POC, VAH, and VAL for any interval.', tag: 'Volume Profile' },
  { id: '15', name: 'Volume Flow & Imbalance Delta', category: 'volume', categoryLabel: 'Volume', description: 'Cumulative volume delta evaluating buyer vs seller aggressive market orders.', tag: 'Order Flow' },
  { id: '16', name: 'Volume Profile Matrix', category: 'volume', categoryLabel: 'Volume', description: 'Horizontal liquidity density mapping identifying high and low volume nodes.', tag: 'Density' },
  { id: '17', name: 'Mpro2 Harmonic Suite', category: 'harmonic', categoryLabel: 'Harmonics', description: 'Adaptive Fibonacci harmonic ratios, Golden Pocket (0.618–0.786), and time-zone cycles.', tag: 'Harmonics' },
  { id: '18', name: 'Fibonacci Sequence Swing', category: 'harmonic', categoryLabel: 'Harmonics', description: 'Live ZigZag swing mapping with 0.236 to 1.618 extensions and early turn predictor.', tag: 'Fibonacci' },
  { id: '19', name: 'Fibonacci Retracement & Extension', category: 'harmonic', categoryLabel: 'Harmonics', description: 'Interactive multi-level Fibonacci drawing with custom ratios and price badges.', tag: 'Drawing Tool' },
  { id: '20', name: 'Time Cycle & Session Ranges', category: 'harmonic', categoryLabel: 'Harmonics', description: 'London, New York, and Asian session range highlights with equilibrium boxes.', tag: 'Sessions' },
  { id: '21', name: 'Predictive Volatility Ranges', category: 'volatility', categoryLabel: 'Volatility', description: 'Dynamic volatility compression/expansion envelopes with touch and breakout markers.', tag: 'Envelopes' },
  { id: '22', name: 'Average Daily Range (ADR10)', category: 'volatility', categoryLabel: 'Volatility', description: 'Statistical 10-day ATR projections calculating daily expansion exhaustion targets.', tag: 'Daily Targets' },
  { id: '23', name: 'Trade Planner (LunqFX Port)', category: 'volatility', categoryLabel: 'Volatility', description: 'Automated 1.0 to 3.0 R:R target zones with dynamic stop placement and risk manager.', tag: 'Planner' },
  { id: '24', name: 'Nexus Smart Money Suite', category: 'structure', categoryLabel: 'Structure', description: 'Auto-detection of Order Blocks, Fair Value Gaps, and Liquidity Sweeps with bias ribbon.', tag: 'Suite' },
  { id: '25', name: 'ECHO Historical Forecast', category: 'trend', categoryLabel: 'Trend', description: 'K-NN pattern similarity evaluation comparing current price action to historical cycles.', tag: 'Forecast' },
  { id: '26', name: 'Risk / Reward Tool with Auto Dollar Payoff', category: 'volatility', categoryLabel: 'Volatility', description: 'Precise position sizing tool with live cash dollar P&L calculations for Deriv & Forex.', tag: 'Risk Engine', badge: 'UPGRADED' }
];

// Interactive Calculator Instruments
interface CalcInstrument {
  id: string;
  name: string;
  symbol: string;
  minLot: number;
  lotStep: number;
  contractSize: number;
  defaultEntry: number;
  defaultSlDollar: number;
  defaultTpDollar: number;
  tickRule: string;
}

const CALC_INSTRUMENTS: CalcInstrument[] = [
  {
    id: 'r75',
    name: 'Volatility 75 Index',
    symbol: 'R_75',
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 1,
    defaultEntry: 45856.73,
    defaultSlDollar: 2.20,
    defaultTpDollar: 10.30,
    tickRule: 'At min lot 0.01: 220 pts = $2.20 SL, 1,030 pts = $10.30 TP'
  },
  {
    id: 'gold',
    name: 'Gold Spot',
    symbol: 'XAU/USD',
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 100,
    defaultEntry: 2684.50,
    defaultSlDollar: 35.00,
    defaultTpDollar: 140.00,
    tickRule: '100 oz contract size: 100 pips = $10.00 at 0.01 lot'
  },
  {
    id: 'eurusd',
    name: 'Euro / US Dollar',
    symbol: 'EUR/USD',
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 100000,
    defaultEntry: 1.08420,
    defaultSlDollar: 15.00,
    defaultTpDollar: 45.00,
    tickRule: 'Standard lot 100k: 1 pip = $0.10 at 0.01 lot'
  },
  {
    id: 'btc',
    name: 'Bitcoin Perpetual',
    symbol: 'BTC/USD',
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 1,
    defaultEntry: 68410.00,
    defaultSlDollar: 50.00,
    defaultTpDollar: 200.00,
    tickRule: 'Direct coin contract: $500 BTC move = $5.00 at 0.01 lot'
  }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onOpenSupport }) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('strat-01');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [indicatorFilter, setIndicatorFilter] = useState<'all' | 'structure' | 'trend' | 'volume' | 'harmonic' | 'volatility'>('all');

  // Interactive Live Simulator Overlays
  const [simShowMtfEma, setSimShowMtfEma] = useState<boolean>(true);
  const [simShowFvg, setSimShowFvg] = useState<boolean>(true);
  const [simShowBos, setSimShowBos] = useState<boolean>(true);
  const [simShowRr, setSimShowRr] = useState<boolean>(true);
  const [simSelectedTf, setSimSelectedTf] = useState<'15M' | '1H' | '4H'>('15M');
  const [simActiveAsset, setSimActiveAsset] = useState<'R_75' | 'XAU/USD' | 'BTC/USD'>('R_75');

  // Interactive Calculator State
  const [calcInstrumentId, setCalcInstrumentId] = useState<string>('r75');
  const selectedCalcInst = CALC_INSTRUMENTS.find((i) => i.id === calcInstrumentId) || CALC_INSTRUMENTS[0];
  const [calcLot, setCalcLot] = useState<number>(selectedCalcInst.minLot);
  const [calcSlDollar, setCalcSlDollar] = useState<number>(selectedCalcInst.defaultSlDollar);
  const [calcTpDollar, setCalcTpDollar] = useState<number>(selectedCalcInst.defaultTpDollar);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const activeStrategy = STRATEGIES.find((s) => s.id === selectedStrategyId) || STRATEGIES[0];

  const filteredIndicators = useMemo(() => {
    if (indicatorFilter === 'all') return ALL_26_INDICATORS;
    return ALL_26_INDICATORS.filter((ind) => ind.category === indicatorFilter);
  }, [indicatorFilter]);

  // Derived Calculator Output
  const calcOutput = useMemo(() => {
    const risk = Math.max(0.01, calcSlDollar);
    const reward = Math.max(0.01, calcTpDollar);
    const rrRatio = (reward / risk).toFixed(2);
    const breakEvenWinRate = ((1 / (1 + reward / risk)) * 100).toFixed(1);
    const priceDiffSl = (risk / (calcLot * selectedCalcInst.contractSize)).toFixed(2);
    const priceDiffTp = (reward / (calcLot * selectedCalcInst.contractSize)).toFixed(2);
    return {
      rrRatio,
      breakEvenWinRate,
      priceDiffSl,
      priceDiffTp
    };
  }, [calcSlDollar, calcTpDollar, calcLot, selectedCalcInst]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#08090C] text-[#E2E8F0] font-sans antialiased selection:bg-amber-500 selection:text-black relative overflow-x-hidden">

      {/* Subtle Financial Workspace Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#141721_1px,transparent_1px),linear-gradient(to_bottom,#141721_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      </div>

      {/* TOP BAR CONTRACT: Zone 1 (Brand) — Zone 2 (Clean Nav) — Zone 3 (Action) */}
      <header className="sticky top-0 z-50 w-full bg-[#08090C]/95 backdrop-blur-md border-b border-[#1A1D27] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Zone 1: Single text element wordmark with brand gold mark */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-8 h-8 rounded-lg bg-[#141209] border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/10">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">Mcharts</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] font-mono text-amber-400/90 font-bold uppercase tracking-wider">PRO</span>
            </div>
          </div>

          {/* Zone 2: Clean 4–6 text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#94A3B8]">
            <button onClick={() => scrollToSection('live-simulator')} className="hover:text-white transition-colors">
              Interactive Simulator
            </button>
            <button onClick={() => scrollToSection('strategy-confluence')} className="hover:text-white transition-colors">
              10 Strategy Presets
            </button>
            <button onClick={() => scrollToSection('all-indicators')} className="hover:text-white transition-colors">
              26 Indicators
            </button>
            <button onClick={() => scrollToSection('risk-calculator')} className="hover:text-white transition-colors">
              Payoff Calculator
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
              $15 Lifetime License
            </button>
            <button onClick={onOpenSupport} className="hover:text-white transition-colors">
              Support
            </button>
          </nav>

          {/* Zone 3: 1–2 primary actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold transition-all shadow-sm shadow-amber-500/20 whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-black" />
              <span>Enter Terminal</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-[#141824] border border-[#262C3E] text-neutral-300"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0C0E15] border-b border-[#1B1F2B] px-4 py-4 space-y-3 text-sm">
            <button onClick={() => scrollToSection('live-simulator')} className="block w-full text-left py-1 text-neutral-300">
              Interactive Simulator
            </button>
            <button onClick={() => scrollToSection('strategy-confluence')} className="block w-full text-left py-1 text-neutral-300">
              10 Strategy Presets
            </button>
            <button onClick={() => scrollToSection('all-indicators')} className="block w-full text-left py-1 text-neutral-300">
              26 Technical Indicators
            </button>
            <button onClick={() => scrollToSection('risk-calculator')} className="block w-full text-left py-1 text-neutral-300">
              Position &amp; Risk Calculator
            </button>
            <button onClick={() => scrollToSection('pricing')} className="block w-full text-left py-1 text-amber-400 font-semibold">
              $15 Lifetime License
            </button>
            <button onClick={onOpenSupport} className="block w-full text-left py-1 text-[#94A3B8]">
              Contact Support
            </button>
          </div>
        )}
      </header>

      {/* HERO SECTION: Editorial Fintech Authority */}
      <section className="relative pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          
          {/* Metadata Discipline: Clean unboxed text with typographic separators */}
          <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] mb-6">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sub-second Deriv Feeds
            </span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span className="text-amber-400 font-semibold">$15 Lifetime License</span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span className="text-neutral-300">26 Indicators Included</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.1] text-balance">
            INSTITUTIONAL TECHNICAL CHARTING &amp; <span className="text-amber-400">SMART MONEY CONFLUENCE</span>.
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-sm sm:text-lg text-[#94A3B8] max-w-2xl font-normal leading-relaxed">
            High-precision market charting engine engineered for professional price-action traders. Real-time Smart Money Concepts (BOS &amp; CHoCH), Fair Value Gaps, 1:1 Pine Script v6 Multi-Timeframe EMAs, and automated risk/reward execution.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-7 py-3.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-md shadow-amber-500/20 whitespace-nowrap"
            >
              <span>Launch Terminal ($15 Lifetime)</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>

            <button
              onClick={() => scrollToSection('live-simulator')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-[#141824] hover:bg-[#1C2233] text-[#CBD5E1] hover:text-white font-semibold text-sm border border-[#262C3E] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4 text-amber-400" />
              <span>Test Interactive Simulator</span>
            </button>
          </div>

          {/* Trust Metrics Adjacency */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-7 text-xs text-[#64748B] font-mono">
            <div className="flex items-center gap-1.5 text-neutral-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>100% Non-Repainting Breakouts</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Exact Pine Script v6 Parity</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Zero Monthly Subscriptions</span>
            </div>
          </div>
        </div>

        {/* HERO MEDIA SHOWCASE: Ultra-High-Fidelity Trading Terminal Banner */}
        <div className="mt-12 sm:mt-16 relative w-full max-w-6xl mx-auto rounded-2xl border border-[#222838] bg-[#0C0E15] shadow-2xl overflow-hidden group">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0A0D14]">
            <img
              src="/src/assets/images/hero_trading_terminal_1790893995625.jpg"
              alt="Mcharts Institutional Trading Desk and Multi-Monitor Candlestick Charts"
              className="w-full h-full object-cover object-center transform group-hover:scale-[1.01] transition-transform duration-700"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback styled container if image path is unavailable
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Subtle Gradient Scrim for Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-black/30 pointer-events-none" />

            {/* In-Hero Live Terminal Tag Overlay */}
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Mcharts Terminal Architecture</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">• 5,000 Bars Ingested</span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    Operating with continuous high-frequency tick data across Synthetics, Forex, Gold, and Digital Assets.
                  </p>
                </div>
              </div>

              <button
                onClick={onGetStarted}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs hover:from-amber-400 hover:to-amber-500 transition-all flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
              >
                <span>Launch Live Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* NEW FEATURE 1: INTERACTIVE LIVE CHART & OVERLAY SIMULATOR */}
      <section id="live-simulator" className="py-20 border-t border-[#1A1D27] bg-[#0A0C13] px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold mb-2">
                <Sliders className="w-3.5 h-3.5" />
                <span>Feature Showcase</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                INTERACTIVE ON-CHART OVERLAY SIMULATOR.
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Test how our analytical layers stack up in real-time. Toggle individual institutional indicators to see how confluence zones, fair value gaps, and dual EMAs render on live price action.
              </p>
            </div>

            {/* Asset Selector Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#121622] rounded-lg border border-[#222838] self-start md:self-auto font-mono text-xs">
              {(['R_75', 'XAU/USD', 'BTC/USD'] as const).map((asset) => (
                <button
                  key={asset}
                  onClick={() => setSimActiveAsset(asset)}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    simActiveAsset === asset
                      ? 'bg-amber-500 text-black font-bold shadow-sm'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>

          {/* Simulator Canvas Frame */}
          <div className="rounded-2xl border border-[#23293A] bg-[#07090F] overflow-hidden shadow-2xl">
            {/* Control Bar: Toggle Indicators in Real Time */}
            <div className="p-3 sm:p-4 bg-[#0E121C] border-b border-[#1E2433] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 font-mono">
                <span className="text-[#64748B] text-[11px] font-semibold mr-1">ACTIVE OVERLAYS:</span>
                
                {/* Toggle 1: Multi-Timeframe EMA */}
                <button
                  onClick={() => setSimShowMtfEma(!simShowMtfEma)}
                  className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                    simShowMtfEma
                      ? 'bg-blue-950/70 border-blue-500/50 text-blue-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${simShowMtfEma ? 'bg-blue-400' : 'bg-neutral-600'}`} />
                  <span>MTF EMA 15m/1H (60 &amp; 240)</span>
                </button>

                {/* Toggle 2: Fair Value Gaps */}
                <button
                  onClick={() => setSimShowFvg(!simShowFvg)}
                  className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                    simShowFvg
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${simShowFvg ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                  <span>FVG Imbalance Zones</span>
                </button>

                {/* Toggle 3: Break of Structure (BOS) */}
                <button
                  onClick={() => setSimShowBos(!simShowBos)}
                  className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                    simShowBos
                      ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${simShowBos ? 'bg-amber-400' : 'bg-neutral-600'}`} />
                  <span>BOS / CHoCH Structure</span>
                </button>

                {/* Toggle 4: Risk / Reward Target Corridors */}
                <button
                  onClick={() => setSimShowRr(!simShowRr)}
                  className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                    simShowRr
                      ? 'bg-purple-950/70 border-purple-500/50 text-purple-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${simShowRr ? 'bg-purple-400' : 'bg-neutral-600'}`} />
                  <span>Risk:Reward HUD (1:4.6)</span>
                </button>
              </div>

              {/* Timeframe Switcher */}
              <div className="flex items-center gap-1 font-mono text-[11px]">
                {(['15M', '1H', '4H'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSimSelectedTf(tf)}
                    className={`px-2 py-0.5 rounded ${
                      simSelectedTf === tf
                        ? 'bg-neutral-800 text-white font-bold'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic SVG / Canvas Simulation Graphic */}
            <div className="relative w-full h-80 sm:h-96 bg-[#07090F] p-4 flex items-center justify-center select-none overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
                <defs>
                  {/* FVG Box Gradient */}
                  <linearGradient id="fvgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
                  </linearGradient>
                  {/* TP Box Gradient */}
                  <linearGradient id="tpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.04" />
                  </linearGradient>
                  {/* SL Box Gradient */}
                  <linearGradient id="slGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.04" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="100" x2="1000" y2="100" stroke="#1A202E" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="200" x2="1000" y2="200" stroke="#1A202E" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="300" x2="1000" y2="300" stroke="#1A202E" strokeWidth="1" strokeDasharray="3 3" />

                {/* Layer 1: Fair Value Gap Box */}
                {simShowFvg && (
                  <g>
                    <rect x="240" y="160" width="380" height="60" fill="url(#fvgGrad)" stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" rx="3" />
                    <line x1="240" y1="190" x2="620" y2="190" stroke="#10B981" strokeWidth="1" opacity="0.6" />
                    <text x="250" y="180" fill="#34D399" fontSize="10" fontFamily="monospace" fontWeight="bold">BULLISH FVG (50% EQ: 45,950.00)</text>
                  </g>
                )}

                {/* Layer 2: Break of Structure (BOS) Line */}
                {simShowBos && (
                  <g>
                    <line x1="380" y1="130" x2="720" y2="130" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="5 3" />
                    <circle cx="720" cy="130" r="3" fill="#F59E0B" />
                    <rect x="520" y="118" width="110" height="18" fill="#141209" stroke="#F59E0B" strokeWidth="1" rx="3" />
                    <text x="530" y="131" fill="#FBBF24" fontSize="10" fontFamily="monospace" fontWeight="bold">BOS (Expansion)</text>
                  </g>
                )}

                {/* Layer 3: Simulated Candlesticks */}
                {/* Swing low accumulation */}
                <line x1="80" y1="250" x2="80" y2="330" stroke="#EF4444" strokeWidth="1.5" />
                <rect x="75" y="270" width="10" height="45" fill="#EF4444" rx="1" />

                <line x1="120" y1="240" x2="120" y2="310" stroke="#10B981" strokeWidth="1.5" />
                <rect x="115" y="250" width="10" height="40" fill="#10B981" rx="1" />

                <line x1="160" y1="220" x2="160" y2="290" stroke="#10B981" strokeWidth="1.5" />
                <rect x="155" y="230" width="10" height="50" fill="#10B981" rx="1" />

                <line x1="200" y1="180" x2="200" y2="260" stroke="#10B981" strokeWidth="1.5" />
                <rect x="195" y="190" width="10" height="60" fill="#10B981" rx="1" />

                {/* Pullback into FVG */}
                <line x1="260" y1="170" x2="260" y2="240" stroke="#EF4444" strokeWidth="1.5" />
                <rect x="255" y="180" width="10" height="40" fill="#EF4444" rx="1" />

                <line x1="300" y1="180" x2="300" y2="230" stroke="#EF4444" strokeWidth="1.5" />
                <rect x="295" y="190" width="10" height="30" fill="#EF4444" rx="1" />

                <line x1="340" y1="170" x2="340" y2="220" stroke="#10B981" strokeWidth="1.5" />
                <rect x="335" y="180" width="10" height="35" fill="#10B981" rx="1" />

                {/* Major impulse breakout */}
                <line x1="400" y1="120" x2="400" y2="200" stroke="#10B981" strokeWidth="1.5" />
                <rect x="395" y="130" width="10" height="60" fill="#10B981" rx="1" />

                <line x1="460" y1="90" x2="460" y2="160" stroke="#10B981" strokeWidth="1.5" />
                <rect x="455" y="100" width="10" height="50" fill="#10B981" rx="1" />

                <line x1="520" y1="70" x2="520" y2="140" stroke="#10B981" strokeWidth="1.5" />
                <rect x="515" y="80" width="10" height="50" fill="#10B981" rx="1" />

                {/* Pullback test */}
                <line x1="580" y1="90" x2="580" y2="160" stroke="#EF4444" strokeWidth="1.5" />
                <rect x="575" y="100" width="10" height="50" fill="#EF4444" rx="1" />

                <line x1="640" y1="110" x2="640" y2="180" stroke="#EF4444" strokeWidth="1.5" />
                <rect x="635" y="120" width="10" height="40" fill="#EF4444" rx="1" />

                <line x1="700" y1="90" x2="700" y2="160" stroke="#10B981" strokeWidth="1.5" />
                <rect x="695" y="100" width="10" height="50" fill="#10B981" rx="1" />

                <line x1="760" y1="60" x2="760" y2="130" stroke="#10B981" strokeWidth="1.5" />
                <rect x="755" y="70" width="10" height="50" fill="#10B981" rx="1" />

                <line x1="820" y1="70" x2="820" y2="140" stroke="#EF4444" strokeWidth="1.5" />
                <rect x="815" y="80" width="10" height="45" fill="#EF4444" rx="1" />

                {/* Live Current Candle */}
                <line x1="880" y1="80" x2="880" y2="150" stroke="#10B981" strokeWidth="1.5" />
                <rect x="875" y="90" width="10" height="35" fill="#10B981" rx="1" />

                {/* Layer 4: Multi-Timeframe Smooth EMAs (Exact TradingView Parity) */}
                {simShowMtfEma && (
                  <g>
                    {/* Red 1H EMA (Period 240) - Smooth long-term anchor curve */}
                    <path
                      d="M 50 340 Q 300 290 550 240 T 920 220"
                      fill="none"
                      stroke="#FF0000"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {/* Blue 15m EMA (Period 60) - Smooth medium trend curve */}
                    <path
                      d="M 50 280 Q 250 200 480 130 T 920 115"
                      fill="none"
                      stroke="#00008B"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </g>
                )}

                {/* Layer 5: Risk/Reward Target Corridors */}
                {simShowRr && (
                  <g>
                    {/* Target Profit Area */}
                    <rect x="710" y="30" width="180" height="90" fill="url(#tpGrad)" stroke="#10B981" strokeWidth="1" rx="3" />
                    <text x="720" y="50" fill="#34D399" fontSize="10" fontFamily="monospace" fontWeight="bold">TP TARGET (+$10.30)</text>

                    {/* Entry Line */}
                    <line x1="690" y1="120" x2="920" y2="120" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x="720" y="115" fill="#38BDF8" fontSize="10" fontFamily="monospace">ENTRY: 45,856.73</text>

                    {/* Stop Loss Area */}
                    <rect x="710" y="120" width="180" height="35" fill="url(#slGrad)" stroke="#EF4444" strokeWidth="1" rx="3" />
                    <text x="720" y="145" fill="#F87171" fontSize="10" fontFamily="monospace" fontWeight="bold">STOP LOSS (-$2.20)</text>

                    {/* R:R Ratio Badge */}
                    <rect x="800" y="65" width="85" height="20" fill="#0D111A" stroke="#10B981" strokeWidth="1" rx="3" />
                    <text x="810" y="79" fill="#10B981" fontSize="10" fontFamily="monospace" fontWeight="bold">1:4.68 R:R</text>
                  </g>
                )}

                {/* Right Price Scale Badges (1:1 TradingView Match) */}
                <g>
                  {/* Current Candle Close Badge */}
                  <rect x="925" y="80" width="70" height="18" fill="#089981" rx="2" />
                  <text x="932" y="93" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="bold">45,856.73</text>

                  {/* 15m EMA Badge (Blue) */}
                  {simShowMtfEma && (
                    <>
                      <rect x="925" y="106" width="70" height="18" fill="#00008B" rx="2" />
                      <text x="932" y="119" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="bold">46,054.35</text>

                      {/* 1H EMA Badge (Red) */}
                      <rect x="925" y="211" width="70" height="18" fill="#FF0000" rx="2" />
                      <text x="932" y="224" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="bold">45,614.17</text>
                    </>
                  )}
                </g>
              </svg>
            </div>

            {/* Bottom Insight Footer */}
            <div className="p-3 bg-[#0B0E16] border-t border-[#1C2130] flex flex-wrap items-center justify-between gap-3 text-xs text-[#94A3B8] font-mono">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold">{simActiveAsset} • {simSelectedTf}</span>
                <span className="text-[#475569]">|</span>
                <span className="text-emerald-400">TradingView Pine Script Parity Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#64748B]">Latency:</span>
                <span className="text-emerald-400 font-bold">12ms WebSocket Direct</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NEW FEATURE 2: INTERACTIVE POSITION & RISK/REWARD PAYOFF ENGINE */}
      <section id="risk-calculator" className="py-20 border-t border-[#1A1D27] bg-[#08090C] px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold mb-3">
              <Calculator className="w-3.5 h-3.5" />
              <span>Interactive Position &amp; Risk Sizing Engine</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              CALCULATE EXACT CASH RISK &amp; REWARD.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              No manual pip/tick conversion math. Enter your target dollar risk and reward parameters to see exact position sizing, point tolerances, and required break-even probability.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Column: Calculator Inputs */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-[#0D1017] border border-[#222838] shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider block mb-3 font-semibold">
                  1. Choose Market Instrument
                </span>

                {/* Instrument Selector Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                  {CALC_INSTRUMENTS.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => {
                        setCalcInstrumentId(inst.id);
                        setCalcLot(inst.minLot);
                        setCalcSlDollar(inst.defaultSlDollar);
                        setCalcTpDollar(inst.defaultTpDollar);
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        calcInstrumentId === inst.id
                          ? 'bg-[#181409] border-amber-500/60 shadow-sm'
                          : 'bg-[#0A0C12] border-[#1E2333] hover:border-[#2D354C]'
                      }`}
                    >
                      <div className={`text-xs font-bold ${calcInstrumentId === inst.id ? 'text-amber-400' : 'text-white'}`}>
                        {inst.symbol}
                      </div>
                      <div className="text-[10px] text-[#64748B] truncate mt-0.5">{inst.name}</div>
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-[#080A10] rounded-lg border border-[#1B202E] text-[11px] font-mono text-neutral-300 mb-6 flex items-center justify-between">
                  <span className="text-[#94A3B8]">Specification:</span>
                  <span className="text-amber-400 font-semibold">{selectedCalcInst.tickRule}</span>
                </div>

                {/* Numerical Sliders / Inputs */}
                <div className="space-y-4 font-mono">
                  {/* Position Lot */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#94A3B8]">Position Volume (Lots):</span>
                      <span className="text-white font-bold">{calcLot.toFixed(2)} Lot</span>
                    </div>
                    <input
                      type="range"
                      min={selectedCalcInst.minLot}
                      max={selectedCalcInst.minLot * 20}
                      step={selectedCalcInst.lotStep}
                      value={calcLot}
                      onChange={(e) => setCalcLot(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#1E2435] rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Stop Loss Cash Dollar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-red-400">Stop Loss Cash Risk ($ USD):</span>
                      <span className="text-red-400 font-bold">${calcSlDollar.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={0.5}
                      value={calcSlDollar}
                      onChange={(e) => setCalcSlDollar(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#1E2435] rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                  </div>

                  {/* Take Profit Cash Dollar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-emerald-400">Take Profit Cash Target ($ USD):</span>
                      <span className="text-emerald-400 font-bold">${calcTpDollar.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={500}
                      step={2.5}
                      value={calcTpDollar}
                      onChange={(e) => setCalcTpDollar(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#1E2435] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Calculated Output Card */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-gradient-to-b from-[#141209] to-[#0D1017] border border-amber-500/40 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 font-mono text-xs">
                  <span className="text-amber-400 font-bold">SYNTHESIS OUTPUT</span>
                  <span className="text-[10px] text-[#94A3B8]">AUTO-COMPOUNDING</span>
                </div>

                {/* Big RR Ratio Display */}
                <div className="my-5 text-center">
                  <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1">
                    Risk to Reward Ratio
                  </span>
                  <div className="text-4xl sm:text-5xl font-black text-amber-400 font-mono tracking-tight">
                    1 : {calcOutput.rrRatio}
                  </div>
                </div>

                {/* Quantitative Metric Breakdown */}
                <div className="space-y-3 font-mono text-xs border-t border-[#222838] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#94A3B8]">Break-Even Win Rate Required:</span>
                    <span className="text-white font-bold">{calcOutput.breakEvenWinRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#94A3B8]">Stop Loss Distance:</span>
                    <span className="text-red-400 font-bold">{calcOutput.priceDiffSl} index points</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#94A3B8]">Take Profit Distance:</span>
                    <span className="text-emerald-400 font-bold">{calcOutput.priceDiffTp} index points</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={onGetStarted}
                className="mt-6 w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <span>Apply On Live Charts ($15 Lifetime)</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* NEW FEATURE 3: COMPLETE 26-INDICATOR INVENTORY WITH FILTER TABS */}
      <section id="all-indicators" className="py-20 border-t border-[#1A1D27] bg-[#0A0C13] px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold mb-2">
                <Layers className="w-3.5 h-3.5" />
                <span>Complete Catalog</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                26 ADVANCED TECHNICAL INDICATORS INCLUDED.
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-[#94A3B8]">
                Every indicator is native to our canvas rendering engine. Zero third-party widget embeds, zero repaint bugs, and zero performance slowdowns.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#121622] rounded-lg border border-[#222838] self-start md:self-auto text-xs font-mono">
              {[
                { id: 'all', label: 'All (26)' },
                { id: 'structure', label: 'Structure (7)' },
                { id: 'trend', label: 'Trend (5)' },
                { id: 'volume', label: 'Volume (4)' },
                { id: 'harmonic', label: 'Harmonic (4)' },
                { id: 'volatility', label: 'Volatility (6)' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setIndicatorFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                    indicatorFilter === tab.id
                      ? 'bg-amber-500 text-black font-bold shadow-sm'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {filteredIndicators.map((ind) => (
              <div
                key={ind.id}
                className="p-4 rounded-xl bg-[#0D1017] border border-[#1E2333] hover:border-amber-500/40 transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                    <span className="text-[#64748B] font-semibold">{ind.categoryLabel}</span>
                    {ind.badge ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        {ind.badge}
                      </span>
                    ) : (
                      <span className="text-amber-400/80 font-mono text-[10px]">#{ind.id}</span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1.5 group-hover:text-amber-300 transition-colors">
                    {ind.name}
                  </h3>
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    {ind.description}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-[#181C28] flex items-center justify-between text-[10px] font-mono text-[#64748B]">
                  <span>{ind.tag}</span>
                  <span className="text-emerald-400 font-semibold">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STRATEGY CONFLUENCE FRAMEWORK (10 MASTER SETUPS) */}
      <section id="strategy-confluence" className="py-20 border-t border-[#1A1D27] px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold mb-2">
              <Workflow className="w-3.5 h-3.5" />
              <span>Confluence Engine</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              10 ALGORITHMIC STRATEGY BLUEPRINTS.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Never guess when to enter. Our indicators operate concurrently to synthesize multi-factor rule-based trading confluences.
            </p>
          </div>

          <button
            onClick={onGetStarted}
            className="self-start md:self-auto px-4 py-2.5 rounded-lg bg-[#161309] hover:bg-[#211B0C] text-xs font-mono text-amber-400 border border-amber-500/40 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Strategy 01 Unlocked Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Master-Detail Strategy Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: 10 Strategy Selector List */}
          <div className="lg:col-span-5 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {STRATEGIES.map((strat) => {
              const isSelected = strat.id === selectedStrategyId;
              return (
                <div
                  key={strat.id}
                  onClick={() => setSelectedStrategyId(strat.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#181409] border-amber-500/60 shadow-sm'
                      : 'bg-[#0D1017] border-[#1B202E] hover:bg-[#111420] hover:border-[#262E42]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`text-xs font-mono font-bold mt-0.5 ${isSelected ? 'text-amber-400' : 'text-[#64748B]'}`}>
                      {strat.num}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate">{strat.name}</h4>
                        {strat.isUnlockedFree && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            FREE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] truncate mt-0.5">{strat.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-mono">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#161A26] text-[#CBD5E1] border border-[#232A3D]">
                      {strat.rr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Strategy Architectural Blueprint Detail Panel */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-[#0D1017] border border-[#222838] shadow-lg sticky top-24">
            
            {/* Header / Badges */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#1B202E]">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-amber-400 font-bold">
                  SETUP #{activeStrategy.num}
                </span>
                <span className="text-[#475569]">·</span>
                <span className="text-[#94A3B8]">{activeStrategy.timeframe}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  activeStrategy.bias === 'BULLISH'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                    : activeStrategy.bias === 'BEARISH'
                    ? 'bg-red-950/60 text-red-400 border-red-800/40'
                    : 'bg-blue-950/60 text-blue-400 border-blue-800/40'
                }`}>
                  {activeStrategy.bias} BIAS
                </span>
                <span className="text-xs font-mono font-bold text-white px-2.5 py-0.5 rounded bg-[#161A26] border border-[#293247]">
                  {activeStrategy.rr}
                </span>
              </div>
            </div>

            {/* Title & Description */}
            <div className="py-4">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">{activeStrategy.name}</h3>
              <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{activeStrategy.subtitle}</p>
            </div>

            {/* Confluence Blueprint */}
            <div className="my-3 p-4 rounded-xl bg-[#080A10] border border-[#1B202E]">
              <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block mb-2 font-semibold">
                Internal Indicator Confluence:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {activeStrategy.modules.map((mod, idx) => (
                  <React.Fragment key={mod}>
                    <span className="px-2.5 py-1 rounded bg-[#141824] text-xs font-mono text-blue-300 border border-[#232B40]">
                      {mod}
                    </span>
                    {idx < activeStrategy.modules.length - 1 && (
                      <span className="text-xs text-neutral-500 font-mono">+</span>
                    )}
                  </React.Fragment>
                ))}
                <span className="text-xs text-neutral-500 font-mono">=</span>
                <span className="px-2.5 py-1 rounded bg-amber-500/20 text-xs font-mono text-amber-300 border border-amber-500/40 font-bold">
                  Confirmed Trade Setup
                </span>
              </div>
            </div>

            {/* Confluence Criteria */}
            <div className="py-3">
              <span className="text-[11px] font-mono font-semibold text-neutral-300 uppercase tracking-wider block mb-2.5">
                Rule-Based Confluence Checklist:
              </span>
              <div className="space-y-2">
                {activeStrategy.confluenceCriteria.map((crit, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-[#94A3B8]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{crit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Compatibility */}
            <div className="mt-2 pt-3 border-t border-[#1B202E] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="text-[#64748B]">
                <span className="text-[#94A3B8]">Compatible Assets:</span> {activeStrategy.marketFit}
              </div>
            </div>

            {/* Hook */}
            <div className="mt-5 pt-4 border-t border-[#1B202E]">
              {activeStrategy.isUnlockedFree ? (
                <div className="p-3.5 rounded-xl bg-[#151208] border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">Strategy 01 Is Available Free</span>
                    <span className="text-[11px] text-[#94A3B8]">
                      Enter platform access to load Strategy 01 on live charts.
                    </span>
                  </div>
                  <button
                    onClick={onGetStarted}
                    className="shrink-0 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Start Free</span>
                    <ArrowRight className="w-3.5 h-3.5 text-black" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-[#64748B] font-mono">
                    Unlocked with Lifetime Platform Access ($15 one-time).
                  </span>
                  <button
                    onClick={onGetStarted}
                    className="shrink-0 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-black" />
                    <span>Unlock All 10 Presets</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* NEW FEATURE 4: CROSS-DEVICE & PWA RESPONSIVENESS SHOWCASE */}
      <section className="py-20 border-t border-[#1A1D27] bg-[#0A0C13] px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold mb-2">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile &amp; Multi-Screen Terminal</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                FULL DESKTOP POWER IN THE PALM OF YOUR HAND.
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Mcharts is a Progressive Web Application (PWA). Run live indicators, touch-optimized drawing tools, and instant order calculations on your phone with zero app store delays.
              </p>

              <div className="mt-6 space-y-3 font-mono text-xs">
                {[
                  'Installable as a standalone app on iOS Safari & Android Chrome',
                  'Instant touch crosshair with haptic cursor feedback',
                  'Real-time cloud settings sync across PC and smartphone',
                  'Offline-first fallback data caching for uninterrupted trading'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-3">
                <button
                  onClick={onGetStarted}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all flex items-center gap-2"
                >
                  <Lock className="w-4 h-4 text-black" />
                  <span>Install Platform App</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-md rounded-2xl border border-[#232A3E] bg-[#0E121D] p-3 shadow-2xl overflow-hidden group">
                <img
                  src="/src/assets/images/mobile_chart_terminal_1790894007700.jpg"
                  alt="Mcharts Responsive Mobile Platform"
                  className="w-full h-auto rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING & LIFETIME ACCESS */}
      <section id="pricing" className="py-20 border-t border-[#1A1D27] bg-[#08090C] px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-b from-[#161309] via-[#0D1017] to-[#08090F] border border-amber-500/40 p-8 sm:p-12 shadow-2xl shadow-amber-500/10 relative overflow-hidden">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-md text-center md:text-left">
              <span className="text-amber-400 text-xs font-mono font-bold uppercase tracking-wider block mb-2">
                One-Time Lifetime License
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                NO RECURRING MONTHLY BILLS.
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Unlock the entire platform, all 26 technical indicators, all 10 strategy presets, continuous updates, and direct technical support.
              </p>

              <div className="mt-6 space-y-2.5 text-xs text-[#CBD5E1] text-left">
                {[
                  'Zero monthly subscription fees ($0 / month forever)',
                  'All 26 technical indicators unlocked immediately',
                  '1:1 Pine Script v6 Multi-Timeframe EMAs & SMC',
                  'Deriv WebSocket tick feed with 5,000 bars history',
                  'Universal device access (Phone, Tablet, Desktop)'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Box */}
            <div className="p-7 sm:p-8 rounded-2xl bg-[#090805] border border-amber-500/50 text-center shrink-0 w-full sm:w-72 shadow-2xl">
              <span className="text-[10px] font-mono text-amber-400/80 uppercase tracking-wider block mb-1">
                LIFETIME PASS
              </span>
              <div className="flex items-baseline justify-center gap-1 font-mono my-2">
                <span className="text-2xl text-amber-400 font-bold">$</span>
                <span className="text-6xl font-black text-white">15</span>
              </div>
              <span className="text-[11px] font-mono text-amber-400 font-bold block mb-5">
                ONE-TIME PAYMENT
              </span>

              <button
                onClick={onGetStarted}
                className="w-full py-3.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span>Get Lifetime Access</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>

              <span className="text-[10px] text-[#64748B] font-mono mt-3 block">
                Instant access via secure platform key
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* NEW FEATURE 5: TRADER FAQ ACCORDION */}
      <section className="py-20 border-t border-[#1A1D27] bg-[#0A0C13] px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
            Clear Answers
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            FREQUENTLY ASKED QUESTIONS.
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: 'Is the $15 license really lifetime with zero monthly fees?',
              a: 'Yes. You pay $15 once. There are no renewal charges, no hidden indicator tiers, and no subscriptions. You receive lifetime access to all current and future updates.'
            },
            {
              q: 'How does the Multi-Timeframe EMA match TradingView Pine Script?',
              a: 'We built a 1:1 mathematical port of TradingView Pine Script v6. It calculates continuous higher-timeframe equivalent EMAs (length * 3 for 15m and length * 12 for 1H) with zero stepping lag, identical down to the second decimal place.'
            },
            {
              q: 'Which markets can I chart and analyze?',
              a: 'Mcharts supports 24/7 Synthetic Indices (Volatility 75, Volatility 100, Crash 1000, Boom 1000), Commodities (Gold XAU/USD, Crude Oil), Forex pairs (EUR/USD, GBP/USD, USD/JPY), and Cryptocurrencies (BTC, ETH, SOL).'
            },
            {
              q: 'Can I request a custom technical indicator to be added?',
              a: 'Yes! Our support desk directly implements verified indicator requests for licensed users. Simply message our support desk with your Pine Script or concept.'
            },
            {
              q: 'Do I need a special app store download to use Mcharts on mobile?',
              a: 'No. Mcharts is engineered as a modern Progressive Web App (PWA). Open the URL in Safari on iPhone or Chrome on Android and tap "Add to Home Screen" for a full-screen native app experience.'
            }
          ].map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-[#1E2435] bg-[#0D1017] overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-white hover:text-amber-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#64748B] transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-[#94A3B8] leading-relaxed border-t border-[#181C28]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL BRAND CTA */}
      <section className="py-20 border-t border-[#1A1D27] px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight text-balance">
          EXPERIENCE INSTITUTIONAL CHARTING TODAY.
        </h2>
        <p className="mt-3 text-sm text-[#94A3B8] max-w-lg mx-auto">
          Start operating with non-repainting structure breakouts, 26 advanced indicators, and rule-based confluence presets.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-4 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Lock className="w-4 h-4 text-black" />
            <span>Launch Platform ($15 Lifetime)</span>
          </button>

          <button
            onClick={onOpenSupport}
            className="w-full sm:w-auto px-6 py-4 rounded-lg bg-[#141824] hover:bg-[#1C2233] text-neutral-300 hover:text-white font-semibold text-sm border border-[#262C3E] transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-neutral-400" />
            <span>Talk to Support</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-[#1A1D27] text-xs text-[#64748B] font-mono z-10 relative bg-[#06070A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-300">Mcharts PRO</span>
            <span aria-hidden="true">·</span>
            <span>Institutional Technical Analysis Platform</span>
          </div>

          <div className="text-center sm:text-right text-[11px] text-[#475569]">
            © {new Date().getFullYear()} Mcharts. All models are analytical tools. Trading involves risk.
          </div>
        </div>
      </footer>

    </div>
  );
};
