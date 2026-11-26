import { describe, expect, it } from 'vitest';
import { computeProgress, dayFacts, levelInfo, moodFor, stageFor, streak, xpForLevel } from '../src/logic/progress';
import { dailyTotals } from '../src/logic/time';
import type { Entry } from '../src/data/types';

const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
let n = 0;
const e = (kind: Entry['kind'], start: number, minutes: number, extra: Partial<Entry> = {}): Entry => ({
  id: `p${n++}`,
  kind,
  start,
  minutes,
  source: 'quick',
  createdAt: start,
  updatedAt: start,
  ...extra,
});
const NOW = at(2026, 11, 26, 18);

describe('levels', () => {
  it('uses growing thresholds', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(60);
    expect(xpForLevel(5)).toBe(600);
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, need: 60, stage: 'seed' });
    expect(levelInfo(59).level).toBe(1);
    expect(levelInfo(60).level).toBe(2);
    expect(levelInfo(700)).toMatchObject({ level: 5, into: 100, need: 300, stage: 'sapling' });
  });

  it('maps levels to stages', () => {
    expect([1, 2, 3, 5, 8, 11, 15, 30].map(stageFor)).toEqual(['seed', 'seed', 'sprout', 'sapling', 'bud', 'bloom', 'tree', 'tree']);
  });
});

describe('streaks', () => {
  // 20th: win+goal, 21st: win, 22nd: nothing, 23rd–25th: win+goal, 26th (today): not yet
  const entries = [
    e('outside', at(2026, 11, 20), 130),
    e('outside', at(2026, 11, 21), 50),
    e('inside', at(2026, 11, 21, 19), 20),
    e('outside', at(2026, 11, 23), 120),
    e('outside', at(2026, 11, 24), 150),
    e('outside', at(2026, 11, 25), 200),
    e('inside', at(2026, 11, 26, 9), 60),
  ];
  const days = dayFacts(dailyTotals(entries), entries, 120, NOW);

  it('builds one fact per day up to today', () => {
    expect(days.map((d) => d.key)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']);
  });

  it('keeps the current streak alive while today is still in progress', () => {
    const s = streak(days, (d) => d.win);
    expect(s).toEqual({ current: 3, best: 3, todayDone: false });
  });

  it('counts today once it qualifies', () => {
    const withToday = [...entries, e('outside', at(2026, 11, 26, 15), 130)];
    const d2 = dayFacts(dailyTotals(withToday), withToday, 120, NOW);
    expect(streak(d2, (d) => d.goal)).toEqual({ current: 4, best: 4, todayDone: true });
  });

  it('breaks when yesterday was missed', () => {
    const gap = [e('outside', at(2026, 11, 23), 120)];
    const d3 = dayFacts(dailyTotals(gap), gap, 120, NOW);
    expect(streak(d3, (d) => d.win)).toMatchObject({ current: 0, best: 1 });
  });
});

describe('computeProgress + badges', () => {
  it('awards XP for outside minutes plus goal bonus', () => {
    const entries = [e('outside', at(2026, 11, 25), 130), e('outside', at(2026, 11, 26), 30)];
    const p = computeProgress(entries, dailyTotals(entries), { outsideGoalMin: 120 }, NOW);
    expect(p.level.xp).toBe(160 + 30);
    expect(p.goalDays).toBe(1);
  });

  it('unlocks the right badges', () => {
    const entries = [
      e('outside', at(2026, 11, 21, 8), 200, { category: 'scooting', source: 'timer' }), // Sat: early bird + marathon + goal
      e('outside', at(2026, 11, 22, 14), 125, { category: 'sport' }), // Sun: goal → weekend warrior
    ];
    const p = computeProgress(entries, dailyTotals(entries), { outsideGoalMin: 120 }, NOW);
    const earned = p.badgeResults.filter((b) => b.earned).map((b) => b.def.id);
    expect(earned).toEqual(expect.arrayContaining(['first-log', 'first-hour', 'first-goal', 'early-bird', 'marathon', 'weekend-warrior']));
    expect(earned).not.toContain('out-10h');
    expect(earned).not.toContain('explorer');
    const explorer = p.badgeResults.find((b) => b.def.id === 'explorer')!;
    expect(explorer.result).toEqual([2, 4]);
  });
});

describe('mood', () => {
  const s = { outsideGoalMin: 120, insideLimitMin: 180 };
  it('reacts to the balance', () => {
    expect(moodFor({ inside: 0, outside: 0 }, s)).toBe('sleepy');
    expect(moodFor({ inside: 30, outside: 60 }, s)).toBe('happy');
    expect(moodFor({ inside: 300, outside: 125 }, s)).toBe('cheer');
    expect(moodFor({ inside: 90, outside: 30 }, s)).toBe('unsure');
    expect(moodFor({ inside: 200, outside: 0 }, s)).toBe('droopy');
    expect(moodFor({ inside: 200, outside: 0 }, { ...s, insideLimitMin: null })).toBe('unsure');
  });
});
