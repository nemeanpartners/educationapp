export type ThemeMode = 'default' | 'light' | 'dark';

export type ThemePaletteId =
  | 'edurev'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'berry';

export interface AppThemePreference {
  mode: ThemeMode;
  paletteId: ThemePaletteId;
}

export interface AppThemePalette {
  id: ThemePaletteId;
  name: string;
  description: string;
  swatches: string[];
}

export const THEME_STORAGE_KEY = 'edurev-theme-preference';

export const APP_THEME_PALETTES: AppThemePalette[] = [
  {
    id: 'edurev',
    name: 'EduRev Default',
    description: 'The current indigo-led system colors.',
    swatches: ['#4f46e5', '#2563eb', '#14b8a6'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Blue, cyan, and teal study colors.',
    swatches: ['#0284c7', '#0891b2', '#0d9488'],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Green, emerald, and lime progress colors.',
    swatches: ['#16a34a', '#059669', '#65a30d'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm rose, amber, and orange accents.',
    swatches: ['#e11d48', '#f97316', '#d97706'],
  },
  {
    id: 'berry',
    name: 'Berry',
    description: 'Violet, fuchsia, and pink highlights.',
    swatches: ['#7c3aed', '#c026d3', '#db2777'],
  },
];

const DEFAULT_THEME: AppThemePreference = {
  mode: 'default',
  paletteId: 'edurev',
};

export function getStoredThemePreference(): AppThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  try {
    const rawPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!rawPreference) return DEFAULT_THEME;

    const preference = JSON.parse(rawPreference) as Partial<AppThemePreference>;
    const mode = isThemeMode(preference.mode) ? preference.mode : DEFAULT_THEME.mode;
    const paletteId = isThemePaletteId(preference.paletteId) ? preference.paletteId : DEFAULT_THEME.paletteId;

    return { mode, paletteId };
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyThemePreference(preference: AppThemePreference) {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.themeMode = preference.mode;
  document.documentElement.dataset.themePalette = preference.paletteId;
}

export function saveThemePreference(preference: AppThemePreference) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
  applyThemePreference(preference);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'default' || value === 'light' || value === 'dark';
}

function isThemePaletteId(value: unknown): value is ThemePaletteId {
  return APP_THEME_PALETTES.some((palette) => palette.id === value);
}
