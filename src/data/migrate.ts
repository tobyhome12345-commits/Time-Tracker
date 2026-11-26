import { DEFAULT_SETTINGS, SCHEMA_VERSION, emptyData } from './types';
import type { AppData, Entry, Kind, RunningTimer, Settings } from './types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isKind = (v: unknown): v is Kind => v === 'inside' || v === 'outside';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const MAX_MINUTES = 24 * 60;

export function normalizeEntry(raw: unknown): Entry | null {
  if (!isObj(raw)) return null;
  const { id, kind, start, minutes } = raw;
  if (typeof id !== 'string' || !id || !isKind(kind) || !isNum(start) || !isNum(minutes)) return null;
  const mins = Math.round(minutes);
  if (mins < 1 || mins > MAX_MINUTES) return null;
  const now = Date.now();
  const source = raw.source === 'timer' || raw.source === 'custom' ? raw.source : 'quick';
  const e: Entry = {
    id,
    kind,
    start: Math.round(start),
    minutes: mins,
    source,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
  };
  if (typeof raw.category === 'string' && raw.category) e.category = raw.category.slice(0, 40);
  if (typeof raw.note === 'string' && raw.note.trim()) e.note = raw.note.slice(0, 280);
  return e;
}

function normalizeSettings(raw: unknown): Settings {
  const d = structuredClone(DEFAULT_SETTINGS);
  if (!isObj(raw)) return d;
  if (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system') d.theme = raw.theme;
  if (typeof raw.accent === 'string' && HEX.test(raw.accent)) d.accent = raw.accent.toLowerCase();
  if (isNum(raw.outsideGoalMin)) d.outsideGoalMin = clamp(Math.round(raw.outsideGoalMin), 5, 12 * 60);
  if (raw.insideLimitMin === null) d.insideLimitMin = null;
  else if (isNum(raw.insideLimitMin)) d.insideLimitMin = clamp(Math.round(raw.insideLimitMin), 5, 16 * 60);
  if (isObj(raw.dailyReminder)) {
    d.dailyReminder.on = raw.dailyReminder.on === true;
    if (typeof raw.dailyReminder.time === 'string' && HHMM.test(raw.dailyReminder.time)) d.dailyReminder.time = raw.dailyReminder.time;
  }
  if (isObj(raw.insideNudge)) {
    d.insideNudge.on = raw.insideNudge.on === true;
    if (isNum(raw.insideNudge.afterMin)) d.insideNudge.afterMin = clamp(Math.round(raw.insideNudge.afterMin), 15, 6 * 60);
  }
  return d;
}

function normalizeTimer(raw: unknown): RunningTimer | null {
  if (!isObj(raw) || !isKind(raw.kind) || !isNum(raw.startedAt)) return null;
  const t: RunningTimer = { kind: raw.kind, startedAt: raw.startedAt };
  if (typeof raw.category === 'string' && raw.category) t.category = raw.category;
  return t;
}

/** Turn anything (stored blob, imported backup) into valid AppData. Invalid entries are dropped. */
export function normalizeData(raw: unknown): AppData {
  const data = emptyData();
  if (!isObj(raw)) return data;
  // Future: if (raw.schemaVersion === 1) migrate → 2, etc.
  const seen = new Set<string>();
  if (Array.isArray(raw.entries)) {
    for (const r of raw.entries) {
      const e = normalizeEntry(r);
      if (e && !seen.has(e.id)) {
        seen.add(e.id);
        data.entries.push(e);
      }
    }
  }
  data.entries.sort((a, b) => a.start - b.start);
  data.settings = normalizeSettings(raw.settings);
  data.timer = normalizeTimer(raw.timer);
  if (isObj(raw.badges)) {
    for (const [k, v] of Object.entries(raw.badges)) if (isNum(v)) data.badges[k] = v;
  }
  data.schemaVersion = SCHEMA_VERSION;
  return data;
}

/** Quick check used by import: does this look like a Touch Grass backup at all? */
export function looksLikeBackup(raw: unknown): boolean {
  return isObj(raw) && Array.isArray(raw.entries) && (raw.app === 'touch-grass' || 'settings' in raw);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
