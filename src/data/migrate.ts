import { DEFAULT_SETTINGS, DEFAULT_TARGETS, SCHEMA_VERSION, emptyData } from './types';
import type { AppData, Entry, Holiday, RunningTimer, Settings, TargetPeriod } from './types';
import { dayKey, startOfDay } from '../logic/time';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const MAX_MINUTES = 24 * 60;

/** v1 entries carried `kind`; inside entries are dropped in v2 (outside-only app). */
export function normalizeEntry(raw: unknown): Entry | null {
  if (!isObj(raw)) return null;
  const { id, start, minutes } = raw;
  if (raw.kind !== undefined && raw.kind !== 'outside') return null;
  if (typeof id !== 'string' || !id || !isNum(start) || !isNum(minutes)) return null;
  const mins = Math.round(minutes);
  if (mins < 1 || mins > MAX_MINUTES) return null;
  const now = Date.now();
  const source = raw.source === 'timer' || raw.source === 'custom' ? raw.source : 'quick';
  const e: Entry = {
    id,
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
  return d;
}

const clampTarget = (v: unknown, fallback: number) => (isNum(v) ? Math.min(8 * 60, Math.max(5, Math.round(v))) : fallback);

function normalizeTargets(raw: unknown, fallbackFrom: string): TargetPeriod[] {
  const out: TargetPeriod[] = [];
  if (Array.isArray(raw)) {
    for (const t of raw) {
      if (!isObj(t) || typeof t.from !== 'string' || !DAY.test(t.from)) continue;
      out.push({
        from: t.from,
        weekday: clampTarget(t.weekday, DEFAULT_TARGETS.weekday),
        weekend: clampTarget(t.weekend, DEFAULT_TARGETS.weekend),
        holiday: clampTarget(t.holiday, DEFAULT_TARGETS.holiday),
      });
    }
  }
  out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  // one period per start day (last wins)
  const dedup = out.filter((t, i) => i === out.length - 1 || out[i + 1].from !== t.from);
  if (!dedup.length) return [{ from: fallbackFrom, ...DEFAULT_TARGETS }];
  // The first period must cover every tracked day.
  if (dedup[0].from > fallbackFrom) dedup[0] = { ...dedup[0], from: fallbackFrom };
  return dedup;
}

function normalizeHolidays(raw: unknown): Holiday[] {
  if (!Array.isArray(raw)) return [];
  const out: Holiday[] = [];
  for (const h of raw) {
    if (!isObj(h) || typeof h.id !== 'string' || typeof h.start !== 'string' || typeof h.end !== 'string') continue;
    if (!DAY.test(h.start) || !DAY.test(h.end)) continue;
    const [start, end] = h.start <= h.end ? [h.start, h.end] : [h.end, h.start];
    out.push({ id: h.id, name: typeof h.name === 'string' && h.name.trim() ? h.name.trim().slice(0, 40) : 'Holiday', start, end });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : 1));
}

function normalizeTimer(raw: unknown): RunningTimer | null {
  if (!isObj(raw) || !isNum(raw.startedAt)) return null;
  if (raw.kind !== undefined && raw.kind !== 'outside') return null; // v1 inside timer
  const t: RunningTimer = { startedAt: raw.startedAt };
  if (typeof raw.category === 'string' && raw.category) t.category = raw.category;
  return t;
}

/** Turn anything (stored blob v1/v2, imported backup) into valid v2 AppData. */
export function normalizeData(raw: unknown, now = Date.now()): AppData {
  const today = dayKey(now);
  if (!isObj(raw)) return emptyData(today);

  const seen = new Set<string>();
  const entries: Entry[] = [];
  if (Array.isArray(raw.entries)) {
    for (const r of raw.entries) {
      const e = normalizeEntry(r);
      if (e && !seen.has(e.id)) {
        seen.add(e.id);
        entries.push(e);
      }
    }
  }
  entries.sort((a, b) => a.start - b.start);

  // Tracking starts at the stored day, else the first outside log, else today (never in the future).
  let trackingSince = typeof raw.trackingSince === 'string' && DAY.test(raw.trackingSince) ? raw.trackingSince : '';
  if (!trackingSince) trackingSince = entries.length ? dayKey(startOfDay(entries[0].start)) : today;
  if (trackingSince > today) trackingSince = today;

  const data: AppData = {
    schemaVersion: SCHEMA_VERSION,
    entries,
    timer: normalizeTimer(raw.timer),
    settings: normalizeSettings(raw.settings),
    targetHistory: normalizeTargets(raw.targetHistory, trackingSince),
    holidays: normalizeHolidays(raw.holidays),
    restDays: Array.isArray(raw.restDays) ? [...new Set(raw.restDays.filter((d): d is string => typeof d === 'string' && DAY.test(d)))].sort() : [],
    trackingSince,
    badges: {},
  };
  if (isObj(raw.badges)) {
    for (const [k, v] of Object.entries(raw.badges)) if (isNum(v) && k !== 'balanced-week') data.badges[k] = v;
  }
  return data;
}

/** Quick check used by import: does this look like a Touch Grass backup at all? */
export function looksLikeBackup(raw: unknown): boolean {
  return isObj(raw) && Array.isArray(raw.entries) && (raw.app === 'touch-grass' || 'settings' in raw || 'targetHistory' in raw);
}
