import { useAppData } from '../data/store';
import type { AppData } from '../data/types';
import { evaluateFamilies, type FamilyResult } from './badges';
import { challengeWins, currentChallenge, type WeekChallenge } from './challenges';
import { dailyTotals, dayKey } from './time';
import { buildLedger, type ChallengeWin, type Ledger } from './xp';

export interface Derived {
  map: Map<string, number>;
  ledger: Ledger;
  wins: ChallengeWin[];
  challenge: WeekChallenge;
  totalMinutes: number;
  badges: FamilyResult[];
}

/* Memoised derived data shared by every screen (recomputed only when data or the day changes). */
let cache: { data: AppData; day: string; hour: number; derived: Derived } | null = null;

export function derive(data: AppData, now = Date.now()): Derived {
  const day = dayKey(now);
  const hour = new Date(now).getHours(); // moods depend on the time of day
  if (cache && cache.data === data && cache.day === day && cache.hour === hour) return cache.derived;
  const map = dailyTotals(data.entries);
  const wins = challengeWins(data, map, now);
  const ledger = buildLedger(data, map, now, wins);
  let totalMinutes = 0;
  for (const m of map.values()) totalMinutes += m;
  const maxLevel = Math.max(1, ...ledger.rows.map((r) => r.levelAfter));
  const derived: Derived = {
    map,
    ledger,
    wins,
    challenge: currentChallenge(data, map, now),
    totalMinutes,
    badges: evaluateFamilies({ entries: data.entries, ledger, map, totalMinutes, wins, maxLevel }),
  };
  cache = { data, day, hour, derived };
  return derived;
}

export function useDerived(): Derived {
  return derive(useAppData());
}
