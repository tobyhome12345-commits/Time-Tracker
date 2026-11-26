import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeForWeek, challengeWins, currentChallenge } from '../src/logic/challenges';
import { dailyTotals, startOfWeek } from '../src/logic/time';
import { emptyData, type AppData, type Entry } from '../src/data/types';

const at = (d: number, h = 12, mi = 0, mo = 11) => new Date(2026, mo - 1, d, h, mi).getTime();
let n = 0;
const e = (start: number, minutes: number, extra: Partial<Entry> = {}): Entry => ({ id: `c${n++}`, start, minutes, source: 'quick', createdAt: start, updatedAt: start, ...extra });
const data = (entries: Entry[], patch: Partial<AppData> = {}): AppData => ({ ...emptyData('2026-11-16'), entries, ...patch });

/** Force a specific challenge for a week by finding a week that rotates to it. */
function weekFor(id: string): number {
  let ws = startOfWeek(at(16));
  for (let i = 0; i < 40; i++) {
    if (challengeForWeek(ws).id === id) return ws;
    ws += 7 * 86_400_000 + 3_600_000; // tolerate DST
    ws = startOfWeek(ws);
  }
  throw new Error('not found');
}

describe('weekend challenges', () => {
  it('rotate through the pool deterministically', () => {
    const ids = new Set<string>();
    let ws = startOfWeek(at(16));
    for (let i = 0; i < CHALLENGES.length; i++) {
      ids.add(challengeForWeek(ws).id);
      ws = startOfWeek(ws + 8 * 86_400_000);
    }
    expect(ids.size).toBe(CHALLENGES.length);
  });

  it('only counts free days (weekends), not weekdays', () => {
    const ws = weekFor('hat-trick');
    const d0 = new Date(ws);
    const day = (i: number, h = 12) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i, h).getTime();
    // 3 sessions on weekdays don't count
    const weekdayOnly = data([e(day(0), 20), e(day(1), 20), e(day(2), 20)], { trackingSince: '2026-01-01' });
    const sunday = day(6, 20);
    expect(currentChallenge(weekdayOnly, dailyTotals(weekdayOnly.entries), sunday).done).toBe(false);
    // 2 on Saturday + 1 on Sunday do
    const weekend = data([e(day(5, 9), 20), e(day(5, 15), 20), e(day(6, 10), 20)], { trackingSince: '2026-01-01' });
    const st = currentChallenge(weekend, dailyTotals(weekend.entries), sunday);
    expect(st.done).toBe(true);
    expect(st.progress).toEqual([3, 3]);
    expect(st.completedOn).toBe(new Date(day(6)).toLocaleDateString('sv-SE'));
  });

  it('holiday weekdays count as free days', () => {
    const ws = weekFor('hat-trick');
    const d0 = new Date(ws);
    const day = (i: number, h = 12) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i, h).getTime();
    const key = (i: number) => new Date(day(i)).toLocaleDateString('sv-SE');
    const d = data([e(day(0, 9), 20), e(day(0, 15), 20), e(day(1), 20)], {
      trackingSince: '2026-01-01',
      holidays: [{ id: 'h', name: 'Half term', start: key(0), end: key(4) }],
    });
    const st = currentChallenge(d, dailyTotals(d.entries), day(1, 20));
    expect(st.activeToday).toBe(true);
    expect(st.done).toBe(true);
  });

  it('shows as upcoming on school weekdays before the weekend', () => {
    const ws = weekFor('sun-chaser');
    const tue = ws + 86_400_000 + 12 * 3_600_000;
    const st = currentChallenge(data([], { trackingSince: '2026-01-01' }), new Map(), tue);
    expect(st.upcoming).toBe(true);
    expect(st.activeToday).toBe(false);
    expect(st.freeDays.map((f) => f.type)).toEqual(['weekend', 'weekend']);
  });

  it('wins are listed with the day they were completed', () => {
    const ws = weekFor('big-adventure');
    const sat = ws + 5 * 86_400_000 + 11 * 3_600_000;
    const d = data([e(sat, 95)], { trackingSince: '2026-01-01' });
    const wins = challengeWins(d, dailyTotals(d.entries), sat + 6 * 3_600_000);
    expect(wins.map((w) => w.id)).toContain('big-adventure');
  });
});
