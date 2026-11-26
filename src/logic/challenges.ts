import type { AppData, Entry } from '../data/types';
import { addDays, DAY_MS, dayKey, keyToTs, startOfDay, startOfWeek } from './time';
import { dayInfo, type ChallengeWin, type DayInfo } from './xp';

/* Weekend challenges: one per Mon–Sun week, but only outdoor time on FREE days
   (Saturday, Sunday and holiday days) counts. Completing one = +50 XP. */

export interface ChallengeCtx {
  /** Entries that started on this week's free days, up to the day being checked */
  entries: Entry[];
  /** This week's free days so far, with minutes outside */
  days: { info: DayInfo; minutes: number }[];
  /** Every entry (for "something new") */
  all: Entry[];
}

export interface ChallengeDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  check: (c: ChallengeCtx) => [number, number];
}

const hourOf = (ts: number) => new Date(ts).getHours();
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const CHALLENGES: ChallengeDef[] = [
  { id: 'sun-chaser', emoji: '☀️', name: 'Sun Chaser', desc: 'Spend 4 hours outside on free days this week', check: (c) => [Math.min(sum(c.days.map((d) => d.minutes)), 240), 240] },
  { id: 'big-adventure', emoji: '🗺️', name: 'Big Adventure', desc: 'Go on one outing of 90 minutes or more', check: (c) => [Math.min(Math.max(0, ...c.entries.map((e) => e.minutes)), 90), 90] },
  { id: 'mix-it-up', emoji: '🎨', name: 'Mix It Up', desc: 'Do 2 different activities', check: (c) => [Math.min(new Set(c.entries.map((e) => e.category).filter(Boolean)).size, 2), 2] },
  { id: 'early-riser', emoji: '🌅', name: 'Early Riser', desc: 'Get outside for 15+ minutes before 10am', check: (c) => [c.entries.some((e) => hourOf(e.start) < 10 && e.minutes >= 15) ? 1 : 0, 1] },
  { id: 'hat-trick', emoji: '🎩', name: 'Hat-trick', desc: 'Go outside 3 separate times', check: (c) => [Math.min(c.entries.length, 3), 3] },
  { id: 'double-target', emoji: '🎯', name: 'Double Target', desc: 'Hit your daily target on 2 free days', check: (c) => [Math.min(c.days.filter((d) => !d.info.rest && d.minutes >= d.info.target).length, 2), 2] },
  { id: 'timer-trek', emoji: '⏱️', name: 'Timer Trek', desc: 'Record a 45-minute session with the live timer', check: (c) => [c.entries.some((e) => e.source === 'timer' && e.minutes >= 45) ? 1 : 0, 1] },
  { id: 'golden-hour', emoji: '🌇', name: 'Golden Hour', desc: 'Spend 30+ minutes outside after 5pm', check: (c) => [Math.min(sum(c.entries.filter((e) => hourOf(e.start) >= 17).map((e) => e.minutes)), 30), 30] },
  { id: 'something-new', emoji: '✨', name: 'Something New', desc: 'Do an activity you haven’t done in the last 2 weeks', check: (c) => [c.entries.some((e) => isNewActivity(e, c.all)) ? 1 : 0, 1] },
  {
    id: 'morning-afternoon',
    emoji: '🌤️',
    name: 'Double Dip',
    desc: 'Go outside before noon AND after 2pm on the same day',
    check: (c) => [c.days.some((d) => {
      const es = c.entries.filter((e) => dayKey(e.start) === d.info.key);
      return es.some((e) => hourOf(e.start) < 12) && es.some((e) => hourOf(e.start) >= 14);
    }) ? 1 : 0, 1],
  },
];

function isNewActivity(e: Entry, all: Entry[]) {
  if (!e.category) return false;
  const from = addDays(startOfDay(e.start), -14);
  return !all.some((o) => o.id !== e.id && o.category === e.category && o.start >= from && o.start < startOfDay(e.start));
}

/** Which challenge runs in the week starting `weekStart` (deterministic rotation). */
export function challengeForWeek(weekStart: number): ChallengeDef {
  const idx = Math.round(weekStart / (7 * DAY_MS));
  return CHALLENGES[((idx % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}

export interface WeekChallenge {
  def: ChallengeDef;
  weekStart: number;
  /** All free days in this week (including future ones), within tracking */
  freeDays: DayInfo[];
  progress: [number, number];
  done: boolean;
  completedOn?: string;
  /** Today is a free day */
  activeToday: boolean;
  /** No free day has started yet this week */
  upcoming: boolean;
}

function weekStatus(data: AppData, totals: Map<string, number>, weekStart: number, todayKey: string): WeekChallenge {
  const def = challengeForWeek(weekStart);
  const freeDays: DayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const key = dayKey(addDays(weekStart, i));
    if (key < data.trackingSince) continue;
    const info = dayInfo(data, key);
    if (info.free) freeDays.push(info);
  }
  let progress: [number, number] = [0, def.check({ entries: [], days: [], all: data.entries })[1]];
  let completedOn: string | undefined;
  const seen: ChallengeCtx = { entries: [], days: [], all: data.entries };
  for (const info of freeDays) {
    if (info.key > todayKey) break;
    seen.days.push({ info, minutes: totals.get(info.key) ?? 0 });
    seen.entries.push(...data.entries.filter((e) => dayKey(e.start) === info.key));
    progress = def.check(seen);
    if (!completedOn && progress[0] >= progress[1]) completedOn = info.key;
  }
  return {
    def,
    weekStart,
    freeDays,
    progress,
    done: !!completedOn,
    completedOn,
    activeToday: freeDays.some((d) => d.key === todayKey),
    upcoming: !freeDays.some((d) => d.key <= todayKey),
  };
}

/** Status of this week's challenge. */
export function currentChallenge(data: AppData, totals: Map<string, number>, now = Date.now()): WeekChallenge {
  return weekStatus(data, totals, startOfWeek(now), dayKey(now));
}

/** Every completed challenge since tracking started (for the XP ledger and badges). */
export function challengeWins(data: AppData, totals: Map<string, number>, now = Date.now()): ChallengeWin[] {
  const todayKey = dayKey(now);
  const wins: ChallengeWin[] = [];
  let ws = startOfWeek(keyToTs(data.trackingSince));
  const last = startOfWeek(now);
  for (let guard = 0; ws <= last && guard < 800; guard++) {
    const st = weekStatus(data, totals, ws, todayKey);
    if (st.completedOn) wins.push({ day: st.completedOn, id: st.def.id, name: `${st.def.name} challenge` });
    ws = addDays(ws, 7);
  }
  return wins;
}
