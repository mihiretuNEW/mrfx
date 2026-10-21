import { SymbolInfo } from '../types';

export interface SymbolSpec {
  symbol: string;
  cleanCode: string;
  displayName: string;
  marketCategory: 'forex' | 'metals' | 'crypto' | 'boom_crash' | 'volatility' | 'step' | 'jump' | 'other';
  minLot: number;
  lotStep: number;
  contractSize: number;
  pointSize: number;
  pipSize: number;
  quoteCurrency: string;
  isSpecAvailable: boolean;
  categoryLabel: string;
}

interface RawDbSpec {
  marketCategory: SymbolSpec['marketCategory'];
  minLot: number;
  lotStep: number;
  contractSize: number;
  pointSize: number;
  pipSize: number;
  quoteCurrency: string;
  categoryLabel: string;
}

const SPEC_DATABASE: Record<string, RawDbSpec> = {
  // FOREX MAJORS (Contract size = 100,000, Min lot = 0.01)
  AUDUSD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'USD', categoryLabel: 'Forex Majors' },
  EURCAD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'CAD', categoryLabel: 'Forex Majors' },
  EURCHF: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'CHF', categoryLabel: 'Forex Majors' },
  EURGBP: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'GBP', categoryLabel: 'Forex Majors' },
  EURJPY: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'JPY', categoryLabel: 'Forex Majors' },
  EURUSD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'USD', categoryLabel: 'Forex Majors' },
  GBPCAD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'CAD', categoryLabel: 'Forex Majors' },
  GBPCHF: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'CHF', categoryLabel: 'Forex Majors' },
  GBPJPY: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'JPY', categoryLabel: 'Forex Majors' },
  GBPUSD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'USD', categoryLabel: 'Forex Majors' },
  NZDUSD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'USD', categoryLabel: 'Forex Majors' },
  USDCAD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'CAD', categoryLabel: 'Forex Majors' },
  USDCHF: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'CHF', categoryLabel: 'Forex Majors' },
  USDJPY: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'JPY', categoryLabel: 'Forex Majors' },

  // FOREX MINORS (Selected pairs: EURAUD, GBPAUD, GBPNZD, EURNZD)
  EURAUD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'AUD', categoryLabel: 'Forex Minors' },
  EURNZD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'NZD', categoryLabel: 'Forex Minors' },
  GBPAUD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'AUD', categoryLabel: 'Forex Minors' },
  GBPNZD: { marketCategory: 'forex', minLot: 0.01, lotStep: 0.01, contractSize: 100000, pointSize: 0.00001, pipSize: 0.0001, quoteCurrency: 'NZD', categoryLabel: 'Forex Minors' },

  // METALS / COMMODITIES
  XAUUSD: { marketCategory: 'metals', minLot: 0.01, lotStep: 0.01, contractSize: 100, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Precious Metals' },
  GOLD: { marketCategory: 'metals', minLot: 0.01, lotStep: 0.01, contractSize: 100, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Precious Metals' },
  XAGUSD: { marketCategory: 'metals', minLot: 0.01, lotStep: 0.01, contractSize: 5000, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Precious Metals' },
  XPDUSD: { marketCategory: 'metals', minLot: 0.01, lotStep: 0.01, contractSize: 100, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Precious Metals' },
  XPTUSD: { marketCategory: 'metals', minLot: 0.01, lotStep: 0.01, contractSize: 100, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Precious Metals' },

  // CRYPTOCURRENCY (Contract size = 1, Min lot = 0.01)
  BTCUSD: { marketCategory: 'crypto', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Crypto Index' },
  ETHUSD: { marketCategory: 'crypto', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Crypto Index' },
  LTCUSD: { marketCategory: 'crypto', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Crypto Index' },
  XRPUSD: { marketCategory: 'crypto', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.0001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Crypto Index' },
  BCHUSD: { marketCategory: 'crypto', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Crypto Index' },

  // BOOM & CRASH INDICES (Deriv Synthetic)
  BOOM1000: { marketCategory: 'boom_crash', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },
  BOOM500: { marketCategory: 'boom_crash', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },
  BOOM300: { marketCategory: 'boom_crash', minLot: 0.50, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },
  BOOM900: { marketCategory: 'boom_crash', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },
  CRASH1000: { marketCategory: 'boom_crash', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },
  CRASH500: { marketCategory: 'boom_crash', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },
  CRASH300: { marketCategory: 'boom_crash', minLot: 0.50, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },
  CRASH150: { marketCategory: 'boom_crash', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Boom/Crash Index' },

  // VOLATILITY INDICES
  R_10: { marketCategory: 'volatility', minLot: 0.50, lotStep: 0.01, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility Index' },
  R_25: { marketCategory: 'volatility', minLot: 0.50, lotStep: 0.01, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility Index' },
  R_50: { marketCategory: 'volatility', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility Index' },
  R_75: { marketCategory: 'volatility', minLot: 0.001, lotStep: 0.001, contractSize: 1, pointSize: 0.0001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility 75 Index' },
  V75: { marketCategory: 'volatility', minLot: 0.001, lotStep: 0.001, contractSize: 1, pointSize: 0.0001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility 75 Index' },
  VOLATILITY75: { marketCategory: 'volatility', minLot: 0.001, lotStep: 0.001, contractSize: 1, pointSize: 0.0001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility 75 Index' },
  'VOLATILITY 75': { marketCategory: 'volatility', minLot: 0.001, lotStep: 0.001, contractSize: 1, pointSize: 0.0001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility 75 Index' },
  'VOLATILITY 75 INDEX': { marketCategory: 'volatility', minLot: 0.001, lotStep: 0.001, contractSize: 1, pointSize: 0.0001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility 75 Index' },
  R_100: { marketCategory: 'volatility', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Volatility Index' },
  '1HZ10V': { marketCategory: 'volatility', minLot: 0.10, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  '1HZ25V': { marketCategory: 'volatility', minLot: 0.10, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  '1HZ50V': { marketCategory: 'volatility', minLot: 0.10, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  '1HZ75V': { marketCategory: 'volatility', minLot: 0.005, lotStep: 0.001, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  'VOLATILITY 75 (1S) INDEX': { marketCategory: 'volatility', minLot: 0.005, lotStep: 0.001, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility 75 (1s) Index' },
  '1HZ100V': { marketCategory: 'volatility', minLot: 0.20, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  '1HZ150V': { marketCategory: 'volatility', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  '1HZ200V': { marketCategory: 'volatility', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  '1HZ250V': { marketCategory: 'volatility', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },
  '1HZ300V': { marketCategory: 'volatility', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.001, pipSize: 0.01, quoteCurrency: 'USD', categoryLabel: 'Volatility (1s) Index' },

  // STEP INDICES
  STPRNG: { marketCategory: 'step', minLot: 0.10, lotStep: 0.01, contractSize: 10, pointSize: 0.10, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Step Index' },
  STPRNG2: { marketCategory: 'step', minLot: 0.10, lotStep: 0.01, contractSize: 10, pointSize: 0.10, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Step Index' },
  STPRNG3: { marketCategory: 'step', minLot: 0.10, lotStep: 0.01, contractSize: 10, pointSize: 0.10, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Step Index' },
  STPRNG4: { marketCategory: 'step', minLot: 0.10, lotStep: 0.01, contractSize: 10, pointSize: 0.10, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Step Index' },
  STPRNG5: { marketCategory: 'step', minLot: 0.10, lotStep: 0.01, contractSize: 10, pointSize: 0.10, pipSize: 1.0, quoteCurrency: 'USD', categoryLabel: 'Step Index' },

  // JUMP INDICES (Deriv MT5 Standard: Contract size = 1, Min lot = 0.01)
  JD10: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 10 Index' },
  JUMP10: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 10 Index' },
  JUMP_10: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 10 Index' },
  'JUMP 10': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 10 Index' },
  'JUMP 10 INDEX': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 10 Index' },
  JD25: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 25 Index' },
  JUMP25: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 25 Index' },
  JUMP_25: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 25 Index' },
  'JUMP 25': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 25 Index' },
  'JUMP 25 INDEX': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 25 Index' },
  JD50: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 50 Index' },
  JUMP50: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 50 Index' },
  JUMP_50: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 50 Index' },
  'JUMP 50': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 50 Index' },
  'JUMP 50 INDEX': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 50 Index' },
  JD75: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 75 Index' },
  JUMP75: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 75 Index' },
  JUMP_75: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 75 Index' },
  'JUMP 75': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 75 Index' },
  'JUMP 75 INDEX': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 75 Index' },
  JD100: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 100 Index' },
  JUMP100: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 100 Index' },
  JUMP_100: { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 100 Index' },
  'JUMP 100': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 100 Index' },
  'JUMP 100 INDEX': { marketCategory: 'jump', minLot: 0.01, lotStep: 0.01, contractSize: 1, pointSize: 0.01, pipSize: 0.10, quoteCurrency: 'USD', categoryLabel: 'Jump 100 Index' },
};

export function getSymbolSpec(rawSymbol: string, activeSymbolInfo?: SymbolInfo): SymbolSpec {
  let cleanCode = (rawSymbol || '').toUpperCase().trim();

  // Strip common prefixes
  cleanCode = cleanCode.replace(/^(FRX|CRY|IND|OTC|SYN)/, '');

  let baseKey = cleanCode;
  if (baseKey.endsWith('N') && (baseKey.startsWith('BOOM') || baseKey.startsWith('CRASH'))) {
    baseKey = baseKey.slice(0, -1);
  }

  const normalizedKey = cleanCode.replace(/[\s\-_]/g, '');
  const displayNameUpper = (activeSymbolInfo?.display_name || '').toUpperCase().replace(/[\s\-_]/g, '');

  const dbMatch = SPEC_DATABASE[cleanCode] || 
    SPEC_DATABASE[baseKey] || 
    SPEC_DATABASE[normalizedKey] || 
    (displayNameUpper ? SPEC_DATABASE[displayNameUpper] : undefined);
  const displayName = activeSymbolInfo?.display_name || rawSymbol || 'Symbol';

  if (dbMatch) {
    return {
      symbol: rawSymbol,
      cleanCode,
      displayName,
      marketCategory: dbMatch.marketCategory,
      minLot: dbMatch.minLot,
      lotStep: dbMatch.lotStep,
      contractSize: dbMatch.contractSize,
      pointSize: dbMatch.pointSize,
      pipSize: dbMatch.pipSize,
      quoteCurrency: dbMatch.quoteCurrency,
      categoryLabel: dbMatch.categoryLabel,
      isSpecAvailable: true,
    };
  }

  // Heuristic fallbacks for symbols not explicitly listed
  let minLot = 0.01;
  let contractSize = 100000;
  let pointSize = 0.0001;
  let pipSize = 0.0001;
  let category: SymbolSpec['marketCategory'] = 'other';
  let categoryLabel = 'Market Instrument';
  let isAvailable = true;

  if (cleanCode.includes('XAU') || cleanCode.includes('GOLD')) {
    category = 'metals';
    categoryLabel = 'Precious Metals';
    minLot = 0.01;
    contractSize = 100;
  } else if (cleanCode.includes('BTC') || cleanCode.includes('ETH') || cleanCode.includes('CRY')) {
    category = 'crypto';
    categoryLabel = 'Crypto Currency';
    minLot = 0.01;
    contractSize = 1;
  } else if (cleanCode.includes('BOOM') || cleanCode.includes('CRASH')) {
    category = 'boom_crash';
    categoryLabel = 'Deriv Synthetic';
    minLot = cleanCode.includes('300') ? 0.50 : 0.20;
    contractSize = 1;
  } else if (cleanCode.includes('VOLATILITY') || cleanCode.startsWith('R_') || cleanCode.includes('1HZ')) {
    category = 'volatility';
    categoryLabel = 'Volatility Index';
    minLot = 0.10;
    contractSize = 1;
  } else if (cleanCode.includes('STEP') || cleanCode.startsWith('STP')) {
    category = 'step';
    categoryLabel = 'Step Index';
    minLot = 0.10;
    contractSize = 10;
  } else if (cleanCode.includes('JUMP') || cleanCode.startsWith('JD') || cleanCode.endsWith('JUMP')) {
    category = 'jump';
    categoryLabel = 'Jump Index';
    minLot = 0.01;
    contractSize = 1;
    pointSize = 0.01;
    pipSize = 0.10;
  } else if (cleanCode.length === 6) {
    category = 'forex';
    categoryLabel = 'Forex Pair';
    minLot = 0.01;
    contractSize = 100000;
  } else {
    isAvailable = false;
  }

  return {
    symbol: rawSymbol,
    cleanCode,
    displayName,
    marketCategory: category,
    minLot,
    lotStep: 0.01,
    contractSize,
    pointSize: 0.0001,
    pipSize: 0.0001,
    quoteCurrency: 'USD',
    categoryLabel,
    isSpecAvailable: isAvailable,
  };
}

export function calculateProfitLoss(
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  isLong: boolean,
  spec: SymbolSpec,
  currentPrice?: number
): number | null {
  if (!spec.isSpecAvailable || !entryPrice || !exitPrice || !lotSize) {
    return null;
  }

  const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;

  if (spec.quoteCurrency === 'JPY') {
    const rate = currentPrice || entryPrice || 150;
    return (priceDiff * lotSize * spec.contractSize) / rate;
  }

  return priceDiff * lotSize * spec.contractSize;
}

/**
 * Calculates the exact Stop Loss price given a desired Risk Amount in Dollars ($), Entry Price, and Lot Size.
 * Works dynamically with Deriv MT5 contract specifications (including Jump 10, Volatility, Step, Forex, Metals).
 */
export function calculateStopPriceFromRisk(
  entryPrice: number,
  riskDollars: number,
  lotSize: number,
  isLong: boolean,
  spec: SymbolSpec,
  currentPrice?: number
): number {
  if (!entryPrice || riskDollars <= 0 || lotSize <= 0) return entryPrice;
  const contractSize = spec?.contractSize || 1;
  let priceDiff: number;

  if (spec?.quoteCurrency === 'JPY') {
    const rate = currentPrice || entryPrice || 150;
    priceDiff = (riskDollars * rate) / (lotSize * contractSize);
  } else {
    priceDiff = riskDollars / (lotSize * contractSize);
  }

  return isLong ? entryPrice - priceDiff : entryPrice + priceDiff;
}

/**
 * Calculates the exact Take Profit price given a desired Reward Amount in Dollars ($), Entry Price, and Lot Size.
 * Works dynamically with Deriv MT5 contract specifications (including Jump 10, Volatility, Step, Forex, Metals).
 */
export function calculateTargetPriceFromReward(
  entryPrice: number,
  rewardDollars: number,
  lotSize: number,
  isLong: boolean,
  spec: SymbolSpec,
  currentPrice?: number
): number {
  if (!entryPrice || rewardDollars <= 0 || lotSize <= 0) return entryPrice;
  const contractSize = spec?.contractSize || 1;
  let priceDiff: number;

  if (spec?.quoteCurrency === 'JPY') {
    const rate = currentPrice || entryPrice || 150;
    priceDiff = (rewardDollars * rate) / (lotSize * contractSize);
  } else {
    priceDiff = rewardDollars / (lotSize * contractSize);
  }

  return isLong ? entryPrice + priceDiff : entryPrice - priceDiff;
}

/**
 * Creates default Risk/Reward targets & stop loss dynamically based on symbol specifications.
 * For Volatility 75 Index (R_75 / 1HZ75V):
 * - At min lot 0.01: 224 points price movement = $2.24
 * - SL defaults to $2.2 (220 index points)
 * - TP defaults to $10.3 (1030 index points)
 * - Formula: price_diff = dollars / (lotSize * contractSize)
 */
export function createDefaultRiskReward(
  entryPrice: number,
  symbol: string,
  spec: SymbolSpec,
  isLong: boolean = true,
  customSlDollar?: number,
  customTpDollar?: number,
  customLot?: number
): { targetPrice: number; stopPrice: number; lotSize: number; riskAmount: number } {
  const clean = (symbol || '').toUpperCase().replace(/^(FRX|CRY|IND|OTC|SYN)/, '');
  const isVol75 = clean.includes('75') && (clean.includes('R_') || clean.includes('1HZ') || clean.includes('VOLATILITY'));

  // Default lot: 0.01 for Volatility 75, or custom lot, or spec minLot
  const lotSize = customLot !== undefined && customLot > 0
    ? customLot
    : (isVol75 ? 0.01 : (spec?.minLot || 0.01));

  const contractSize = spec?.contractSize || 1;

  // Default SL = $2.2, Default TP = $10.3 (or custom)
  const slDollars = customSlDollar !== undefined && customSlDollar > 0 ? customSlDollar : 2.2;
  const tpDollars = customTpDollar !== undefined && customTpDollar > 0 ? customTpDollar : 10.3;

  let slDistance: number;
  let tpDistance: number;

  if (spec?.quoteCurrency === 'JPY') {
    const rate = entryPrice || 150;
    slDistance = (slDollars * rate) / (lotSize * contractSize);
    tpDistance = (tpDollars * rate) / (lotSize * contractSize);
  } else {
    slDistance = slDollars / (lotSize * contractSize);
    tpDistance = tpDollars / (lotSize * contractSize);
  }

  const stopPrice = isLong ? entryPrice - slDistance : entryPrice + slDistance;
  const targetPrice = isLong ? entryPrice + tpDistance : entryPrice - tpDistance;

  return {
    targetPrice,
    stopPrice,
    lotSize,
    riskAmount: slDollars,
  };
}

