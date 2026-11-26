/** One outdoor session. */
export interface Entry {
  id: string;
  /** Start time, epoch ms (local clock). Counts toward the day(s) it overlaps. */
  start: number;
  /** Duration in whole minutes (>= 1). */
  minutes: number;
  category?: string;
  note?: string;
  source: 'quick' | 'custom' | 'timer';
  createdAt: number;
  updatedAt: number;
}

export interface RunningTimer {
  startedAt: number;
  category?: string;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
  accent: string;
}

/** Daily outside targets in minutes. */
export interface Targets {
  weekday: number;
  weekend: number;
  holiday: number;
}

/** A target set that applies from `from` (dayKey) until the next one. */
export interface TargetPeriod extends Targets {
  from: string;
}

/** A holiday period, both ends inclusive ('YYYY-MM-DD'). */
export interface Holiday {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface AppData {
  schemaVersion: 2;
  entries: Entry[];
  timer: RunningTimer | null;
  settings: Settings;
  /** Sorted oldest → newest. The newest period with from <= day applies to that day. */
  targetHistory: TargetPeriod[];
  holidays: Holiday[];
  /** dayKeys marked as rest/sick days (max one per Mon–Sun week). */
  restDays: string[];
  /** XP is counted from this day (dayKey). */
  trackingSince: string;
  /** badgeId → unlocked-at epoch ms */
  badges: Record<string, number>;
}

export const SCHEMA_VERSION = 2 as const;

export const DEFAULT_TARGETS: Targets = { weekday: 60, weekend: 120, holiday: 120 };

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#16a34a',
};

export function emptyData(today: string): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    entries: [],
    timer: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    targetHistory: [{ from: today, ...DEFAULT_TARGETS }],
    holidays: [],
    restDays: [],
    trackingSince: today,
    badges: {},
  };
}
