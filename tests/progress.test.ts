import { describe, expect, it } from 'vitest';
import { evaluateBadges, moodFor, moodLine } from '../src/logic/progress';
import { buildLedger } from '../src/logic/xp';
import { dailyTotals } from '../src/logic/time';
import { emptyData, type AppData, type Entry } from '../src/data/types';

const at = (d: number, h = 12, mi = 0) => new Date(2026, 10, d, h, mi).getTime();
let n = 0;
const e = (start: number, minutes: number, extra: Partial<Entry> = {}): Entry => ({ id: `p${n++}`, start, minutes, source: 'quick', createdAt: start, updatedAt: start, ...extra });
const data = (entries: Entry[], patch: Partial<AppData> = {}): AppData => ({ ...emptyData('2026-11-23'), entries, ...patch });

function moodAt(d: AppData, now: number) {
  const l = buildLedger(d, dailyTotals(d.entries), now);
  return { mood: moodFor(l, l.today, now), l };
}

describe('Pip moods (outside-only)', () => {
  it('sleepy in the morning with nothing logged', () => {
    expect(moodAt(data([e(at(23), 60), e(at(24), 60), e(at(25), 60)]), at(26, 9)).mood).toBe('sleepy');
  });
  it('happy with some time logged', () => {
    expect(moodAt(data([e(at(26, 9), 20)]), at(26, 13)).mood).toBe('happy');
  });
  it('cheers once the target is hit', () => {
    expect(moodAt(data([e(at(26, 9), 60)]), at(26, 13)).mood).toBe('cheer');
  });
  it('worried after 5pm below target, with the XP at risk in the bubble', () => {
    const { mood, l } = moodAt(data([e(at(23), 120), e(at(24), 60), e(at(25), 60), e(at(26, 9), 20)]), at(26, 18));
    expect(mood).toBe('worried');
    expect(moodLine(mood, l, l.today, at(26, 18))).toContain('40m to go or we lose 40 XP');
  });
  it('droopy the morning after losing XP', () => {
    expect(moodAt(data([e(at(23), 120), e(at(24), 60), e(at(25), 10)]), at(26, 9)).mood).toBe('droopy');
  });
  it('resting on a rest day', () => {
    expect(moodAt(data([], { restDays: ['2026-11-26'] }), at(26, 18)).mood).toBe('rest');
  });
});

describe('badges', () => {
  it('awards outside badges from the ledger', () => {
    const entries = [
      e(at(23, 8), 200, { category: 'scooting', source: 'timer' }), // early bird, marathon, big day (25+140+5=170)
      e(at(24), 30), // missed → −30
      e(at(25), 70, { category: 'cycling' }), // comeback
    ];
    const d = data(entries);
    const map = dailyTotals(entries);
    const ledger = buildLedger(d, map, at(26, 10));
    const total = entries.reduce((a, x) => a + x.minutes, 0);
    const res = evaluateBadges({ entries, ledger, totalMinutes: total, wins: [], maxLevel: 2 });
    const earned = res.filter((b) => b.earned).map((b) => b.def.id);
    expect(earned).toEqual(expect.arrayContaining(['first-log', 'first-hour', 'first-target', 'early-bird', 'marathon', 'big-day', 'comeback']));
    expect(earned).not.toContain('streak-3');
    expect(res.find((b) => b.def.id === 'explorer')!.result).toEqual([2, 5]);
  });

  it('holiday hero needs every day of a 3+ day holiday', () => {
    const d = data([e(at(23), 130), e(at(24), 125), e(at(25), 120)], { holidays: [{ id: 'h', name: 'Break', start: '2026-11-23', end: '2026-11-25' }] });
    const ledger = buildLedger(d, dailyTotals(d.entries), at(26, 10));
    const res = evaluateBadges({ entries: d.entries, ledger, totalMinutes: 375, wins: [], maxLevel: 3 });
    expect(res.find((b) => b.def.id === 'holiday-hero')!.earned).toBe(true);
  });
});
