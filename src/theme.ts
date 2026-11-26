import type { Settings } from './data/types';
import { setSystemBars } from './native/platform';

const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(pref: Settings['theme']): 'light' | 'dark' {
  if (pref === 'system') return media?.matches ? 'dark' : 'light';
  return pref;
}

/** Apply resolved theme + accent to <html>. Returns the resolved theme. */
export function applyTheme(settings: Pick<Settings, 'theme' | 'accent'>): 'light' | 'dark' {
  const theme = resolveTheme(settings.theme);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--accent-ink', bestInk(settings.accent));
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (theme === 'dark' ? '#0d1310' : '#f3f6f1'));
  setSystemBars(theme === 'dark');
  return theme;
}

export function onSystemThemeChange(cb: () => void) {
  media?.addEventListener('change', cb);
  return () => media?.removeEventListener('change', cb);
}

/* WCAG relative luminance → pick white or near-black text for a coloured background. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function bestInk(bg: string): string {
  return contrast(bg, '#ffffff') >= contrast(bg, '#0b130e') ? '#ffffff' : '#0b130e';
}

export const ACCENTS = ['#16a34a', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#14b8a6'];
