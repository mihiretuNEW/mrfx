import { ChartThemeId } from '../types';

export interface ThemePreset {
  id: ChartThemeId;
  name: string;
  subtitle: string;
  badge?: string;
  isDark: boolean;
  backgroundColor: string;
  surfaceColor: string;
  gridColor: string;
  crosshairColor: string;
  borderColor: string;
  textColor: string;
  textSecondary: string;
  accentColor: string;
  previewColors: {
    bg: string;
    surface: string;
    accent: string;
    border: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'offlight-white',
    name: 'Off-Light White',
    subtitle: 'Eye-friendly soft canvas · Reduces glare & eye fatigue',
    badge: 'Eye Comfort',
    isDark: false,
    backgroundColor: '#f0f3fa', // TradingView Soft Light Canvas (easy on eyes)
    surfaceColor: '#ffffff',
    gridColor: '#e0e3eb',
    crosshairColor: '#8c92a4',
    borderColor: '#d1d4dc',
    textColor: '#131722',
    textSecondary: '#64748b',
    accentColor: '#2563eb',
    previewColors: {
      bg: '#f0f3fa',
      surface: '#ffffff',
      accent: '#2563eb',
      border: '#cbd5e1',
    },
  },
  {
    id: 'blue-dark',
    name: 'Blue Dark',
    subtitle: 'Midnight Navy · TradingView & Bloomberg Pro standard',
    badge: 'Popular',
    isDark: true,
    backgroundColor: '#131722',
    surfaceColor: '#1e222d',
    gridColor: '#242835',
    crosshairColor: '#5d6588',
    borderColor: '#2a2e39',
    textColor: '#d1d4dc',
    textSecondary: '#868993',
    accentColor: '#2962ff',
    previewColors: {
      bg: '#131722',
      surface: '#1e222d',
      accent: '#2962ff',
      border: '#2a2e39',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    subtitle: 'Classic pure black OLED trader workspace',
    badge: 'Default',
    isDark: true,
    backgroundColor: '#000000',
    surfaceColor: '#0c0c0e',
    gridColor: '#171717',
    crosshairColor: '#4f5966',
    borderColor: '#262626',
    textColor: '#f4f4f5',
    textSecondary: '#a1a1aa',
    accentColor: '#3b82f6',
    previewColors: {
      bg: '#000000',
      surface: '#121212',
      accent: '#3b82f6',
      border: '#27272a',
    },
  },
  {
    id: 'offlight-dark',
    name: 'Off-Light Dark',
    subtitle: 'Muted slate & charcoal · Optimal contrast for all-day trading',
    badge: 'Anti-Fatigue',
    isDark: true,
    backgroundColor: '#1a1d24',
    surfaceColor: '#222630',
    gridColor: '#292e3a',
    crosshairColor: '#626c82',
    borderColor: '#333a48',
    textColor: '#e2e8f0',
    textSecondary: '#94a3b8',
    accentColor: '#38bdf8',
    previewColors: {
      bg: '#1a1d24',
      surface: '#222630',
      accent: '#38bdf8',
      border: '#333a48',
    },
  },
  {
    id: 'nord',
    name: 'Nord Arctic Dark',
    subtitle: 'Polar night palette favored by quantitative developers',
    badge: 'Pro Quant',
    isDark: true,
    backgroundColor: '#242933',
    surfaceColor: '#2e3440',
    gridColor: '#3b4252',
    crosshairColor: '#88c0d0',
    borderColor: '#434c5e',
    textColor: '#eceff4',
    textSecondary: '#d8dee9',
    accentColor: '#88c0d0',
    previewColors: {
      bg: '#242933',
      surface: '#2e3440',
      accent: '#88c0d0',
      border: '#434c5e',
    },
  },
  {
    id: 'bloomberg',
    name: 'Bloomberg Terminal',
    subtitle: 'Institutional amber & obsidian finance terminal style',
    badge: 'Wall Street',
    isDark: true,
    backgroundColor: '#0d0f12',
    surfaceColor: '#15181e',
    gridColor: '#1c2027',
    crosshairColor: '#f59e0b',
    borderColor: '#2b313c',
    textColor: '#fbbf24',
    textSecondary: '#d97706',
    accentColor: '#f59e0b',
    previewColors: {
      bg: '#0d0f12',
      surface: '#15181e',
      accent: '#f59e0b',
      border: '#2b313c',
    },
  },
  {
    id: 'matrix',
    name: 'Cyber Terminal',
    subtitle: 'Matrix phosphor emerald & jet black algorithmic theme',
    badge: 'Matrix',
    isDark: true,
    backgroundColor: '#070d0a',
    surfaceColor: '#0e1713',
    gridColor: '#13241d',
    crosshairColor: '#10b981',
    borderColor: '#1c382b',
    textColor: '#34d399',
    textSecondary: '#6ee7b7',
    accentColor: '#10b981',
    previewColors: {
      bg: '#070d0a',
      surface: '#0e1713',
      accent: '#10b981',
      border: '#1c382b',
    },
  },
  {
    id: 'light',
    name: 'Classic Light',
    subtitle: 'Original light theme upgraded to eye-friendly canvas',
    badge: 'Classic',
    isDark: false,
    backgroundColor: '#f0f3fa',
    surfaceColor: '#ffffff',
    gridColor: '#e0e3eb',
    crosshairColor: '#8c92a4',
    borderColor: '#cbd5e1',
    textColor: '#0f172a',
    textSecondary: '#64748b',
    accentColor: '#2563eb',
    previewColors: {
      bg: '#f0f3fa',
      surface: '#ffffff',
      accent: '#2563eb',
      border: '#cbd5e1',
    },
  },
];

export function isDarkTheme(themeId?: string): boolean {
  if (!themeId) return true;
  return themeId !== 'light' && themeId !== 'offlight-white';
}

export function getThemePreset(themeId?: ChartThemeId): ThemePreset {
  const found = THEME_PRESETS.find((p) => p.id === themeId);
  if (found) return found;
  // Default fallback is 'dark' or 'blue-dark'
  return THEME_PRESETS[2]; // dark
}

/**
 * Checks if a color hex or string has very high luminance (white or near-white)
 */
export function isLightColor(colorStr?: string): boolean {
  if (!colorStr) return false;
  const s = colorStr.trim().toLowerCase();
  if (s === '#fff' || s === '#ffffff' || s === 'white' || s === 'rgb(255,255,255)') return true;
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum > 0.82;
    }
  }
  return false;
}
