import { describe, expect, it } from 'vitest';
import { computeMetrics, earnedKeys, evaluateFamilies, evaluateFamily, FAMILIES, MAX_TIER, storedTier, tierFor, TIERS, type BadgeCtx } from '../src/logic/badges';
import { buildLedger } from '../src/logic/xp';
import { dailyTotals } from '../src/logic/time';
import { emptyData, type AppData, type Entry } from '../src/data/types';

const at = (d: number, h = 12, mi = 0) => new Date(2026, 10, d, h, mi).getTime();
let n = 0;
const e = (start: number, minutes: number, extra: Partial<Entry> = {}): Entry => ({ id: `b${n++}`, start, minutes, source: 'quick', createdAt: start, updatedAt: start, ...extra });

function ctxFor(entries: Entry[], patch: Partial<AppData> = {}, now = at(30, 20)): BadgeCtx {
  const data: AppData = { ...emptyData('2026-11-16'), entries: entries.sort((a, b) => a.start - b.start), ...patch };
  const map = dailyTotals(data.entries);
  const ledger = buildLedger(data, map, now);
  let totalMinutes = 0;
  for (const m of map.values()) totalMinutes += m;
  return { entries: data.entries, ledger, map, wins: [], maxLevel: Math.max(1, ...ledger.rows.map((r) => r.levelAfter)), totalMinutes };
}

describe('tier setup', () => {
  it('has 6 tiers, Bronze → Legend', () => {
    expect(TIERS.map((t) => t.name)).toEqual(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend']);
    expect(MAX_TIER).toBe(6);
  });

  it('every family has 6 strictly increasing thresholds and a unique id', () => {
    expect(FAMILIES.length).toBe(18);
    expect(new Set(FAMILIES.map((f) => f.id)).size).toBe(FAMILIES.length);
    for (const f of FAMILIES) {
      expect(f.thresholds).toHaveLength(6);
      for (let i = 1; i < 6; i++) expect(f.thresholds[i]).toBeGreaterThan(f.thresholds[i - 1]);
      expect(f.goal(f.thresholds[0]).length).toBeGreaterThan(5);
    }
  });

  it('streak family matches the example: 3 → 7 → 14 days in a row', () => {
    const streak = FAMILIES.find((f) => f.id === 'streak')!;
    expect(streak.thresholds.slice(0, 3)).toEqual([3, 7, 14]);
    expect(streak.goal(7)).toBe('Hit your target 7 days in a row');
  });
});

describe('tier evaluation', () => {
  const streak = FAMILIES.find((f) => f.id === 'streak')!;

  it('counts thresholds reached', () => {
    expect(tierFor([3, 7, 14, 30, 60, 100], 0)).toBe(0);
    expect(tierFor([3, 7, 14, 30, 60, 100], 3)).toBe(1);
    expect(tierFor([3, 7, 14, 30, 60, 100], 13)).toBe(2);
    expect(tierFor([3, 7, 14, 30, 60, 100], 500)).toBe(6);
  });

  it('progress bar starts again from empty after each upgrade', () => {
    expect(evaluateFamily(streak, 0)).toMatchObject({ tier: 0, prevThreshold: 0, fraction: 0, next: { threshold: 3 } });
    expect(evaluateFamily(streak, 3)).toMatchObject({ tier: 1, prevThreshold: 3, fraction: 0, next: { threshold: 7 } });
    expect(evaluateFamily(streak, 5).fraction).toBeCloseTo(0.5); // halfway from 3 → 7
    expect(evaluateFamily(streak, 5).next?.tier.name).toBe('Silver');
  });

  it('maxes out at Legend with no next goal', () => {
    const r = evaluateFamily(streak, 150);
    expect(r.tier).toBe(6);
    expect(r.next).toBeUndefined();
    expect(r.fraction).toBe(1);
  });

  it('earned keys list every tier reached', () => {
    const results = [evaluateFamily(streak, 8)];
    expect(earnedKeys(results)).toEqual(['streak:1', 'streak:2']);
  });

  it('next goal starts from the highest tier ever earned', () => {
    const r = evaluateFamily(streak, 2, 3); // value dropped below Bronze, but Gold was earned before
    expect(r.tier).toBe(3);
    expect(r.next?.tier.name).toBe('Platinum');
    expect(r.next?.threshold).toBe(30);
    expect(r.fraction).toBe(0);
  });

  it('stored tiers are kept forever', () => {
    expect(storedTier({ 'streak:1': 1, 'streak:2': 2 }, 'streak')).toBe(2);
    expect(storedTier({}, 'streak')).toBe(0);
  });
});

describe('metrics from real data', () => {
  // Week Mon 16 – Sun 22 Nov: every day hit (perfect week + weekend warrior), then Mon 23 missed, Tue 24 comeback
  const week = [16, 17, 18, 19, 20].map((d) => e(at(d, 8), 70, { category: 'walking' }));
  const weekend = [e(at(21, 10), 200, { category: 'sport', source: 'timer' }), e(at(22, 17), 130, { category: 'cycling' })];
  const after = [e(at(24, 16), 90, { category: 'scooting' })];
  const c = ctxFor([...week, ...weekend, ...after], {}, at(25, 10));
  const m = computeMetrics(c);
  const byId = Object.fromEntries(evaluateFamilies(c).map((r) => [r.family.id, r]));

  it('counts perfect weeks, weekend warriors and comebacks', () => {
    expect(m.perfectWeeks).toBe(1);
    expect(m.weekendWarriors).toBe(1);
    expect(m.comebacks).toBe(1); // missed Mon 23 → hit Tue 24
    expect(m.hits).toBe(8);
  });

  it('counts marathons, active days, early birds, golden hours, timer sessions and activities', () => {
    expect(m.marathons).toBe(1); // 200m on the 21st
    expect(m.activeDays).toBe(8);
    expect(byId['early-bird'].value).toBe(5); // 8am school-day walks
    expect(byId['golden-hour'].value).toBe(1); // 17:00 cycling
    expect(byId.timer.value).toBe(1);
    expect(byId.explorer.value).toBe(4);
    expect(byId.logger.value).toBe(8);
  });

  it('gives the right tiers', () => {
    expect(byId.streak).toMatchObject({ value: 7, tier: 2 }); // Silver: 7 in a row
    expect(byId['perfect-week'].tier).toBe(1);
    expect(byId.targets.tier).toBe(2); // 8 hits ≥ 7
    expect(byId.hours.value).toBeCloseTo(12.8, 1); // 770 min
    expect(byId.hours.tier).toBe(2); // ≥ 10h
  });

  it('holiday hero counts holiday days with the target hit', () => {
    const h = ctxFor([e(at(23), 130), e(at(24), 125), e(at(25), 90)], { holidays: [{ id: 'h', name: 'Break', start: '2026-11-23', end: '2026-11-27' }] }, at(26, 10));
    expect(computeMetrics(h).holidayHits).toBe(2); // 90m < 2h on the 25th
  });
});
