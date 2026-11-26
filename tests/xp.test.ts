import { describe, expect, it } from 'vitest';
import { buildLedger, dayInfo, restDaysUsedInWeek, targetsOn, XP } from '../src/logic/xp';
import { levelInfo, stageFor, xpForLevel } from '../src/logic/levels';
import { dailyTotals } from '../src/logic/time';
import { emptyData, type AppData, type Entry } from '../src/data/types';

// Week of Mon 23 – Sun 29 Nov 2026. "Now" = Thu 26 Nov 2026, 18:00.
const at = (d: number, h = 12, mi = 0, mo = 11) => new Date(2026, mo - 1, d, h, mi).getTime();
const NOW = at(26, 18);
let n = 0;
const e = (start: number, minutes: number, extra: Partial<Entry> = {}): Entry => ({ id: `x${n++}`, start, minutes, source: 'quick', createdAt: start, updatedAt: start, ...extra });

function data(entries: Entry[], patch: Partial<AppData> = {}): AppData {
  return { ...emptyData('2026-11-23'), entries, ...patch };
}
const ledgerOf = (d: AppData, now = NOW) => buildLedger(d, dailyTotals(d.entries), now);

describe('day types and targets', () => {
  const d = data([], { holidays: [{ id: 'h', name: 'Christmas', start: '2026-12-21', end: '2027-01-02' }] });
  it('weekday 1h, weekend 2h, holiday 2h (holiday beats weekend)', () => {
    expect(dayInfo(d, '2026-11-26')).toMatchObject({ type: 'weekday', target: 60, free: false });
    expect(dayInfo(d, '2026-11-28')).toMatchObject({ type: 'weekend', target: 120, free: true });
    expect(dayInfo(d, '2026-12-22')).toMatchObject({ type: 'holiday', target: 120, free: true });
    expect(dayInfo(d, '2026-12-26').type).toBe('holiday'); // a Saturday inside the holiday
    expect(dayInfo(d, '2027-01-02').holiday?.name).toBe('Christmas'); // inclusive end
    expect(dayInfo(d, '2027-01-04').type).toBe('weekday');
  });

  it('target history: changes apply from their day onward', () => {
    const hist = [
      { from: '2026-11-01', weekday: 60, weekend: 120, holiday: 120 },
      { from: '2026-11-25', weekday: 45, weekend: 90, holiday: 120 },
    ];
    expect(targetsOn(hist, '2026-11-24').weekday).toBe(60);
    expect(targetsOn(hist, '2026-11-25').weekday).toBe(45);
    expect(targetsOn(hist, '2026-10-01').weekday).toBe(60); // before history → first period
  });
});

describe('XP ledger', () => {
  it('hit: +25 bonus, +1 per extra minute, +5×streak', () => {
    const l = ledgerOf(data([e(at(23), 90), e(at(24), 60), e(at(25), 75)]));
    const [mon, tue, wed] = l.rows;
    expect(mon.xp).toBe(25 + 30 + 5); // streak 1
    expect(tue.xp).toBe(25 + 0 + 10); // exactly on target, streak 2
    expect(wed.xp).toBe(25 + 15 + 15); // streak 3
    expect(tue.parts.find((p) => p.kind === 'extra')).toBeUndefined();
  });

  it('miss: −1 per minute short, streak resets', () => {
    const l = ledgerOf(data([e(at(23), 120), e(at(24), 40)]));
    expect(l.rows[1].xp).toBe(-20);
    expect(l.rows[1].streak).toBe(0);
  });

  it('today is pending until midnight (no loss yet, streak kept)', () => {
    const l = ledgerOf(data([e(at(23), 60), e(at(24), 60), e(at(25), 60), e(at(26, 9), 20)]));
    expect(l.today).toMatchObject({ isToday: true, pending: true, xp: 0, minutes: 20 });
    expect(l.toGo).toBe(40);
    expect(l.atRisk).toBe(40);
    expect(l.streak.current).toBe(3);
    expect(l.streak.todayDone).toBe(false);
    // Next day, the loss lands
    const later = ledgerOf(data([e(at(23), 60), e(at(24), 60), e(at(25), 60), e(at(26, 9), 20)]), at(27, 10));
    expect(later.rows[3].xp).toBe(-40);
  });

  it('gains count today as soon as the target is hit', () => {
    const l = ledgerOf(data([e(at(26, 9), 70)]));
    expect(l.today).toMatchObject({ hit: true, pending: false, xp: 25 + 10 + 5 });
  });

  it('caps extra minutes at 4h', () => {
    const l = ledgerOf(data([e(at(23, 6), 600)]));
    expect(l.rows[0].parts.find((p) => p.kind === 'extra')?.xp).toBe(XP.extraCap);
  });

  it('streak bonus caps at +25', () => {
    const entries = [23, 24, 25].map((d) => e(at(d), 60)).concat([e(at(26, 9), 60)]);
    const l = ledgerOf(data(entries, { trackingSince: '2026-11-21' }), NOW);
    // 21 Sat & 22 Sun missed (0 of 120) → streak restarts Monday
    expect(l.rows[0].xp).toBe(-120);
    expect(l.rows[0].applied).toBe(0); // total floors at 0
    const long = Array.from({ length: 8 }, (_, i) => e(at(16 + i, 8), 130));
    const l2 = ledgerOf(data(long, { trackingSince: '2026-11-16' }), at(23, 20));
    expect(Math.max(...l2.rows.map((r) => r.parts.find((p) => p.kind === 'streak')?.xp ?? 0))).toBe(25);
  });

  it('rest days: no XP lost, streak paused not broken', () => {
    const d = data([e(at(23), 60), e(at(25), 60)], { restDays: ['2026-11-24'] });
    const l = ledgerOf(d);
    expect(l.rows[1].parts).toEqual([{ kind: 'rest', label: 'Rest day', xp: 0 }]);
    expect(l.rows[1].streak).toBe(1);
    expect(l.rows[2].streak).toBe(2);
  });

  it('XP total never goes below 0 and levels can go down', () => {
    // Mon: +25+120+5 = 150 (level 2). Tue–Wed: nothing → −60 each.
    const l = ledgerOf(data([e(at(23), 180)]));
    expect(l.rows[0].total).toBe(150);
    expect(l.rows[0].levelAfter).toBe(2);
    expect(l.rows[1].total).toBe(90);
    expect(l.rows[2].total).toBe(30);
    expect(l.rows[2].levelAfter).toBe(1);
    expect(l.total).toBe(30);
    const l2 = ledgerOf(data([], { trackingSince: '2026-11-20' }));
    expect(l2.total).toBe(0);
    expect(l2.rows.every((r) => r.total === 0)).toBe(true);
  });

  it('weekend target is 2h', () => {
    const l = ledgerOf(data([e(at(28, 10), 100)], { trackingSince: '2026-11-28' }), at(29, 10));
    expect(l.rows[0]).toMatchObject({ hit: false, xp: -20 });
  });

  it('challenge wins add +50 on their day', () => {
    const d = data([e(at(23), 60)]);
    const l = buildLedger(d, dailyTotals(d.entries), NOW, [{ day: '2026-11-23', id: 'x', name: 'Test challenge' }]);
    expect(l.rows[0].xp).toBe(25 + 5 + 50);
  });
});

describe('rest day limit', () => {
  it('one per Mon–Sun week', () => {
    expect(restDaysUsedInWeek(['2026-11-24'], '2026-11-27')).toEqual(['2026-11-24']);
    expect(restDaysUsedInWeek(['2026-11-24'], '2026-11-24')).toEqual([]);
    expect(restDaysUsedInWeek(['2026-11-22'], '2026-11-24')).toEqual([]); // previous week (Sunday)
  });
});

describe('levels', () => {
  it('curve and stages', () => {
    expect(xpForLevel(2)).toBe(60);
    expect(levelInfo(700)).toMatchObject({ level: 5, into: 100, need: 300, stage: 'sapling' });
    expect(levelInfo(-50).level).toBe(1);
    expect([1, 3, 5, 8, 11, 15].map(stageFor)).toEqual(['seed', 'sprout', 'sapling', 'bud', 'bloom', 'tree']);
  });
});
