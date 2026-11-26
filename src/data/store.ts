import { useSyncExternalStore } from 'react';
import { Preferences } from '@capacitor/preferences';
import { emptyData } from './types';
import type { AppData, Entry, Kind, RunningTimer, Settings } from './types';
import { normalizeData } from './migrate';

/* A tiny global store: one AppData object, persisted as a single JSON blob on the device
   (Android SharedPreferences via @capacitor/preferences; localStorage in a browser). */

export const STORAGE_KEY = 'touchgrass.data';
const BACKUP_KEY = 'touchgrass.data.prev';
const SAVE_DELAY = 300;

let state: AppData = emptyData();
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

function emit() {
  for (const l of listeners) l();
}

export function getState(): AppData {
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function isLoaded() {
  return loaded;
}

/** Replace state immutably and schedule a save. */
export function setState(updater: (s: AppData) => AppData) {
  const next = updater(state);
  if (next === state) return;
  state = next;
  emit();
  scheduleSave();
}

function scheduleSave() {
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flush(), SAVE_DELAY);
}

export async function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!dirty || !loaded) return;
  dirty = false;
  try {
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(state) });
  } catch (err) {
    dirty = true;
    console.error('Save failed', err);
  }
}

export async function loadState(): Promise<AppData> {
  let raw: string | null = null;
  try {
    raw = (await Preferences.get({ key: STORAGE_KEY })).value;
  } catch (err) {
    console.error('Load failed', err);
  }
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Main copy corrupted: fall back to the previous good copy.
      try {
        const prev = (await Preferences.get({ key: BACKUP_KEY })).value;
        parsed = prev ? JSON.parse(prev) : null;
      } catch {
        parsed = null;
      }
    }
  }
  state = normalizeData(parsed);
  loaded = true;
  emit();
  if (raw) {
    // Keep one rolling copy of the last good data (made once per app start).
    void Preferences.set({ key: BACKUP_KEY, value: JSON.stringify(state) }).catch(() => {});
  }
  return state;
}

/* ───────────── Actions ───────────── */

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type NewEntry = Pick<Entry, 'kind' | 'start' | 'minutes' | 'source'> & Partial<Pick<Entry, 'category' | 'note'>>;

export function addEntry(input: NewEntry): Entry {
  const now = Date.now();
  const entry: Entry = clean({
    id: newId(),
    kind: input.kind,
    start: input.start,
    minutes: Math.max(1, Math.round(input.minutes)),
    category: input.category,
    note: input.note?.trim() || undefined,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  });
  setState((s) => ({ ...s, entries: insertSorted(s.entries, entry) }));
  return entry;
}

export function updateEntry(id: string, patch: Partial<Omit<Entry, 'id' | 'createdAt'>>) {
  setState((s) => {
    const old = s.entries.find((e) => e.id === id);
    if (!old) return s;
    const merged = clean({ ...old, ...patch, note: (patch.note ?? old.note)?.trim() || undefined, updatedAt: Date.now() });
    if ('category' in patch && !patch.category) delete merged.category;
    const rest = s.entries.filter((e) => e.id !== id);
    return { ...s, entries: insertSorted(rest, merged) };
  });
}

export function deleteEntry(id: string): Entry | undefined {
  const removed = state.entries.find((e) => e.id === id);
  if (!removed) return undefined;
  setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  return removed;
}

export function restoreEntry(entry: Entry) {
  setState((s) => (s.entries.some((e) => e.id === entry.id) ? s : { ...s, entries: insertSorted(s.entries, entry) }));
}

export function startTimer(kind: Kind, category?: string, startedAt = Date.now()) {
  const timer: RunningTimer = category ? { kind, startedAt, category } : { kind, startedAt };
  setState((s) => ({ ...s, timer }));
}

export function updateTimer(patch: Partial<RunningTimer>) {
  setState((s) => (s.timer ? { ...s, timer: { ...s.timer, ...patch } } : s));
}

/** Stops the timer and saves it as a log. Returns the entry, or null if under a minute. */
export function stopTimer(now = Date.now()): Entry | null {
  const t = state.timer;
  if (!t) return null;
  const minutes = Math.round((now - t.startedAt) / 60000);
  setState((s) => ({ ...s, timer: null }));
  if (minutes < 1) return null;
  return addEntry({ kind: t.kind, start: t.startedAt, minutes: Math.min(minutes, 24 * 60), source: 'timer', category: t.category });
}

export function cancelTimer() {
  setState((s) => ({ ...s, timer: null }));
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function unlockBadges(ids: string[], at = Date.now()) {
  if (!ids.length) return;
  setState((s) => {
    const badges = { ...s.badges };
    for (const id of ids) if (!badges[id]) badges[id] = at;
    return { ...s, badges };
  });
}

/** Replace everything, or merge entries by id (imported wins on conflict). */
export function importData(incoming: AppData, mode: 'merge' | 'replace') {
  setState((s) => {
    if (mode === 'replace') return { ...incoming, timer: s.timer ?? incoming.timer };
    const byId = new Map(s.entries.map((e) => [e.id, e]));
    for (const e of incoming.entries) byId.set(e.id, e);
    const entries = [...byId.values()].sort((a, b) => a.start - b.start);
    return { ...s, entries, badges: { ...incoming.badges, ...s.badges } };
  });
}

export function resetAll() {
  setState(() => ({ ...emptyData(), settings: state.settings }));
}

function insertSorted(list: Entry[], e: Entry): Entry[] {
  const out = list.slice();
  let i = out.length;
  while (i > 0 && out[i - 1].start > e.start) i--;
  out.splice(i, 0, e);
  return out;
}

function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}
