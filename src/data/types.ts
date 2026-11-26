export type Kind = 'inside' | 'outside';

export interface Entry {
  id: string;
  kind: Kind;
  /** Start time, epoch ms (local clock). The entry counts toward the day(s) it overlaps. */
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
  kind: Kind;
  startedAt: number;
  category?: string;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
  accent: string;
  outsideGoalMin: number;
  insideLimitMin: number | null;
  dailyReminder: { on: boolean; time: string };
  insideNudge: { on: boolean; afterMin: number };
}

export interface AppData {
  schemaVersion: 1;
  entries: Entry[];
  timer: RunningTimer | null;
  settings: Settings;
  /** badgeId → unlocked-at epoch ms */
  badges: Record<string, number>;
}

export const SCHEMA_VERSION = 1 as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#16a34a',
  outsideGoalMin: 120,
  insideLimitMin: 180,
  dailyReminder: { on: false, time: '19:30' },
  insideNudge: { on: false, afterMin: 90 },
};

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    entries: [],
    timer: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    badges: {},
  };
}
