import type { Entry, Kind } from '../data/types';

export const MIN = 60_000;
export const DAY_MS = 86_400_000;

/** Local-midnight timestamp for the day containing ts. */
export function startOfDay(ts: number | Date): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Add whole calendar days (DST-safe). */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

/** 'YYYY-MM-DD' in local time. */
export function dayKey(ts: number | Date): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function keyToTs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function sameDay(a: number, b: number) {
  return startOfDay(a) === startOfDay(b);
}

/** Monday-based week start. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(startOfDay(ts));
  d.setDate(1);
  return d.getTime();
}

export function daysInMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Split an entry into per-day minute chunks (an entry crossing midnight counts on both days). */
export function splitByDay(e: Pick<Entry, 'start' | 'minutes'>): { day: string; minutes: number }[] {
  const out: { day: string; minutes: number }[] = [];
  const end = e.start + e.minutes * MIN;
  let cur = e.start;
  while (cur < end) {
    const nextMidnight = addDays(startOfDay(cur), 1);
    const chunkEnd = Math.min(end, nextMidnight);
    const mins = (chunkEnd - cur) / MIN;
    if (mins > 0) out.push({ day: dayKey(cur), minutes: mins });
    cur = chunkEnd;
  }
  // Round chunks so they always add back up to the entry's whole minutes.
  let acc = 0;
  return out.map((c, i) => {
    const m = i === out.length - 1 ? e.minutes - acc : Math.round(c.minutes);
    acc += m;
    return { day: c.day, minutes: m };
  });
}

export interface DayTotals {
  inside: number;
  outside: number;
}

/** Map of dayKey → minutes per kind. */
export function dailyTotals(entries: Entry[]): Map<string, DayTotals> {
  const map = new Map<string, DayTotals>();
  for (const e of entries) {
    for (const c of splitByDay(e)) {
      let t = map.get(c.day);
      if (!t) map.set(c.day, (t = { inside: 0, outside: 0 }));
      t[e.kind] += c.minutes;
    }
  }
  return map;
}

export function totalsFor(map: Map<string, DayTotals>, day: string): DayTotals {
  return map.get(day) ?? { inside: 0, outside: 0 };
}

/** Entries that overlap the given local day. */
export function entriesOnDay(entries: Entry[], dayStart: number): Entry[] {
  const dayEnd = addDays(dayStart, 1);
  return entries.filter((e) => e.start < dayEnd && e.start + e.minutes * MIN > dayStart);
}

/* ───────────── Formatting ───────────── */

/** 95 → "1h 35m", 60 → "1h", 5 → "5m" */
export function fmtDur(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Compact hours for axes: 90 → "1.5h" */
export function fmtHours(mins: number): string {
  const h = mins / 60;
  if (h === 0) return '0';
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

/** Live clock for timers: "1:05:09" / "05:09" */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtDayLong(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtDayShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function relativeDayName(ts: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
}

/** <input type="date"> / "time" helpers (local). */
export function toDateInput(ts: number): string {
  return dayKey(ts);
}

export function toTimeInput(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fromInputs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
}

export const otherKind = (k: Kind): Kind => (k === 'inside' ? 'outside' : 'inside');
