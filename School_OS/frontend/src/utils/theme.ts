export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
}

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#00236f',
  secondaryColor: '#006b5f',
  accentColor: '#d4a843',
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
};

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToTriplet(hex: string, fallback: string): string {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : fallback;
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastTextOn(hex: string, dark = '#191c1e', light = '#ffffff'): string {
  return relativeLuminance(hex) > 0.45 ? dark : light;
}

export function shadeHex(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `#${[c(rgb.r), c(rgb.g), c(rgb.b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return b;
  const c = (x: number, y: number) => Math.max(0, Math.min(255, Math.round(x + (y - x) * t)));
  const v = (n: number) => n.toString(16).padStart(2, '0');
  return `#${v(c(ra.r, rb.r))}${v(c(ra.g, rb.g))}${v(c(ra.b, rb.b))}`;
}

export function brandVars(theme: ThemeConfig): Record<string, string> {
  const primary = theme.primaryColor || DEFAULT_THEME.primaryColor;
  const secondary = theme.secondaryColor || DEFAULT_THEME.secondaryColor;
  const onSurface = mixHex(primary, '#191c1e', 0.32);
  const onSurfaceVariant = mixHex(primary, '#444651', 0.52);
  const surface = mixHex(primary, '#ffffff', 0.955);
  const containerLow = mixHex(primary, '#ffffff', 0.92);
  const container = mixHex(primary, '#ffffff', 0.89);
  const containerHigh = mixHex(primary, '#ffffff', 0.86);
  const dim = mixHex(primary, '#ffffff', 0.83);
  const variant = mixHex(primary, '#ffffff', 0.88);
  const outline = mixHex(primary, '#757682', 0.55);
  const outlineVariant = mixHex(primary, '#c5c5d3', 0.62);
  const secondaryContainer = mixHex(secondary, '#ffffff', 0.8);
  const onSecondaryContainer = mixHex(secondary, '#191c1e', 0.6);
  return {
    '--color-on-surface': rgbToTriplet(onSurface, '25 28 30'),
    '--color-on-surface-variant': rgbToTriplet(onSurfaceVariant, '68 70 81'),
    '--color-on-background': rgbToTriplet(onSurface, '25 28 30'),
    '--color-background': rgbToTriplet(surface, '247 249 251'),
    '--color-surface': rgbToTriplet(surface, '247 249 251'),
    '--color-surface-bright': rgbToTriplet(surface, '247 249 251'),
    '--color-surface-container-lowest': rgbToTriplet('#ffffff', '255 255 255'),
    '--color-surface-container-low': rgbToTriplet(containerLow, '242 244 246'),
    '--color-surface-container': rgbToTriplet(container, '236 238 240'),
    '--color-surface-container-high': rgbToTriplet(containerHigh, '230 232 234'),
    '--color-surface-dim': rgbToTriplet(dim, '216 218 220'),
    '--color-surface-variant': rgbToTriplet(variant, '224 227 229'),
    '--color-outline': rgbToTriplet(outline, '117 118 130'),
    '--color-outline-variant': rgbToTriplet(outlineVariant, '197 197 211'),
    '--color-secondary-container': rgbToTriplet(secondaryContainer, '109 245 225'),
    '--color-on-secondary-container': rgbToTriplet(onSecondaryContainer, '0 111 100'),
  };
}

export function blueRamp(primary: string): Record<string, string> {
  const p = primary || DEFAULT_THEME.primaryColor;
  const t = (mix: number) => rgbToTriplet(mixHex(p, '#ffffff', mix), '0 35 111');
  return {
    '--color-blue-50': t(0.94),
    '--color-blue-100': t(0.88),
    '--color-blue-200': t(0.76),
    '--color-blue-300': t(0.6),
    '--color-blue-400': t(0.42),
    '--color-blue-500': t(0.22),
    '--color-blue-600': t(0.08),
    '--color-blue-700': rgbToTriplet(p, '0 35 111'),
    '--color-blue-800': rgbToTriplet(shadeHex(p, 0.72), '0 25 80'),
    '--color-blue-900': rgbToTriplet(shadeHex(p, 0.48), '0 17 53'),
    '--color-indigo-50': t(0.94),
    '--color-indigo-100': t(0.88),
    '--color-indigo-200': t(0.76),
    '--color-indigo-300': t(0.6),
    '--color-indigo-400': t(0.42),
    '--color-indigo-500': t(0.22),
    '--color-indigo-600': t(0.08),
    '--color-indigo-700': rgbToTriplet(p, '0 35 111'),
    '--color-indigo-800': rgbToTriplet(shadeHex(p, 0.72), '0 25 80'),
    '--color-indigo-900': rgbToTriplet(shadeHex(p, 0.48), '0 17 53'),
  };
}

export function applyThemeVars(theme: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', rgbToTriplet(theme.primaryColor, '0 35 111'));
  root.style.setProperty('--color-on-primary', rgbToTriplet(contrastTextOn(theme.primaryColor), '255 255 255'));
  root.style.setProperty('--color-secondary', rgbToTriplet(theme.secondaryColor, '0 107 95'));
  root.style.setProperty('--color-surface-tint', rgbToTriplet(theme.primaryColor, '64 89 170'));
  const container = shadeHex(theme.primaryColor, 0.78);
  root.style.setProperty('--color-primary-container', rgbToTriplet(container, '30 58 138'));
  root.style.setProperty('--color-on-primary-container', rgbToTriplet(contrastTextOn(container), '255 255 255'));
  for (const [key, value] of Object.entries(brandVars(theme))) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(blueRamp(theme.primaryColor))) {
    root.style.setProperty(key, value);
  }
  root.style.setProperty('--font-body', theme.fontFamily || DEFAULT_THEME.fontFamily);
  root.style.setProperty('--font-headline', theme.fontFamily || DEFAULT_THEME.fontFamily);
}

export function buildThemeCss(theme: ThemeConfig): string {
  const primary = theme.primaryColor || DEFAULT_THEME.primaryColor;
  const secondary = theme.secondaryColor || DEFAULT_THEME.secondaryColor;
  const fontFamily = theme.fontFamily || DEFAULT_THEME.fontFamily;
  const container = shadeHex(primary, 0.78);
  const vars: Record<string, string> = {
    '--color-primary': rgbToTriplet(primary, '0 35 111'),
    '--color-on-primary': rgbToTriplet(contrastTextOn(primary), '255 255 255'),
    '--color-secondary': rgbToTriplet(secondary, '0 107 95'),
    '--color-surface-tint': rgbToTriplet(primary, '64 89 170'),
    '--color-primary-container': rgbToTriplet(container, '30 58 138'),
    '--color-on-primary-container': rgbToTriplet(contrastTextOn(container), '255 255 255'),
    '--font-body': fontFamily,
    '--font-headline': fontFamily,
    ...brandVars(theme),
    ...blueRamp(primary),
  };
  const body = Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('');
  return `:root{${body}}`;
}

export interface BrandTemplate {
  name: string;
  premium: boolean;
  colors: Pick<ThemeConfig, 'primaryColor' | 'secondaryColor' | 'accentColor'>;
}

export const PRESET_TEMPLATES: BrandTemplate[] = [
  { name: 'School OS Default', premium: false, colors: { primaryColor: '#00236f', secondaryColor: '#006b5f', accentColor: '#d4a843' } },
  { name: 'Midnight Sapphire', premium: false, colors: { primaryColor: '#1e3a8a', secondaryColor: '#0f766e', accentColor: '#f59e0b' } },
  { name: 'Forest Canopy', premium: false, colors: { primaryColor: '#14532d', secondaryColor: '#047857', accentColor: '#facc15' } },
  { name: 'Noble Crimson', premium: false, colors: { primaryColor: '#7f1d1d', secondaryColor: '#b91c1c', accentColor: '#fbbf24' } },
  { name: 'Royal Amethyst', premium: true, colors: { primaryColor: '#4c1d95', secondaryColor: '#7c3aed', accentColor: '#f0abfc' } },
  { name: 'Sunset Ember', premium: true, colors: { primaryColor: '#9a3412', secondaryColor: '#ea580c', accentColor: '#fed7aa' } },
  { name: 'Ocean Deep', premium: true, colors: { primaryColor: '#0f4c5c', secondaryColor: '#1b9aaa', accentColor: '#a7f3d0' } },
  { name: 'Rose Quartz', premium: true, colors: { primaryColor: '#7f1d3c', secondaryColor: '#f43f5e', accentColor: '#fbcfe8' } },
];

export const FONT_OPTIONS: { label: string; value: string; google: string }[] = [
  { label: 'Inter', value: "'Inter', 'Segoe UI', sans-serif", google: 'Inter' },
  { label: 'Poppins', value: "'Poppins', sans-serif", google: 'Poppins' },
  { label: 'Montserrat', value: "'Montserrat', sans-serif", google: 'Montserrat' },
  { label: 'Open Sans', value: "'Open Sans', sans-serif", google: 'Open Sans' },
  { label: 'Roboto', value: "'Roboto', sans-serif", google: 'Roboto' },
  { label: 'Lato', value: "'Lato', sans-serif", google: 'Lato' },
  { label: 'Merriweather', value: "'Merriweather', serif", google: 'Merriweather' },
  { label: 'Lora', value: "'Lora', serif", google: 'Lora' },
  { label: 'Playfair Display', value: "'Playfair Display', serif", google: 'Playfair Display' },
  { label: 'Source Serif 4', value: "'Source Serif 4', serif", google: 'Source Serif 4' },
];

export function googleFontUrl(fontFamily: string): string {
  const name = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  if (!name || name === 'Inter') return 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap';
  return `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900&display=swap`;
}
