import { useAppData } from '../data/store';
import type { Entry } from '../data/types';
import { computeProgress, type Progress } from './progress';
import { dailyTotals, dayKey, type DayTotals } from './time';

/* Memoised derived data shared by every screen (recomputed only when entries/goal/day change). */
let cache: { entries: Entry[]; goal: number; day: string; map: Map<string, DayTotals>; progress: Progress } | null = null;

export function derive(entries: Entry[], goal: number) {
  const day = dayKey(Date.now());
  if (cache && cache.entries === entries && cache.goal === goal && cache.day === day) return cache;
  const map = dailyTotals(entries);
  const progress = computeProgress(entries, map, { outsideGoalMin: goal });
  cache = { entries, goal, day, map, progress };
  return cache;
}

export function useDerived() {
  const data = useAppData();
  return derive(data.entries, data.settings.outsideGoalMin);
}
