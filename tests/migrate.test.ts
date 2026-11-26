import { describe, expect, it } from 'vitest';
import { normalizeData, normalizeEntry } from '../src/data/migrate';
import { DEFAULT_SETTINGS, DEFAULT_TARGETS } from '../src/data/types';

const NOW = new Date(2026, 10, 26, 18).getTime();

describe('normalizeData (v2)', () => {
  it('returns empty defaults for junk', () => {
    for (const junk of [null, undefined, 42, 'x', [], {}]) {
      const d = normalizeData(junk, NOW);
      expect(d.schemaVersion).toBe(2);
      expect(d.entries).toEqual([]);
      expect(d.settings).toEqual(DEFAULT_SETTINGS);
      expect(d.targetHistory).toEqual([{ from: '2026-11-26', ...DEFAULT_TARGETS }]);
      expect(d.trackingSince).toBe('2026-11-26');
      expect(d.holidays).toEqual([]);
      expect(d.restDays).toEqual([]);
    }
  });

  it('migrates v1: drops inside logs + inside timer, keeps outside, tracking starts at first outside log', () => {
    const v1 = {
      schemaVersion: 1,
      entries: [
        { id: 'a', kind: 'inside', start: new Date(2026, 10, 20, 10).getTime(), minutes: 90, category: 'gaming' },
        { id: 'b', kind: 'outside', start: new Date(2026, 10, 24, 15).getTime(), minutes: 45, category: 'sport' },
        { id: 'c', kind: 'outside', start: new Date(2026, 10, 22, 9).getTime(), minutes: 30 },
      ],
      timer: { kind: 'inside', startedAt: 123 },
      settings: { theme: 'dark', accent: '#ABCDEF', outsideGoalMin: 120, insideLimitMin: 180, dailyReminder: { on: true, time: '19:30' } },
      badges: { 'first-log': 1, 'balanced-week': 2 },
    };
    const d = normalizeData(v1, NOW);
    expect(d.entries.map((e) => e.id)).toEqual(['c', 'b']);
    expect(d.entries[0]).not.toHaveProperty('kind');
    expect(d.timer).toBeNull();
    expect(d.settings).toEqual({ theme: 'dark', accent: '#abcdef' });
    expect(d.trackingSince).toBe('2026-11-22');
    expect(d.targetHistory[0]).toEqual({ from: '2026-11-22', ...DEFAULT_TARGETS });
    expect(d.badges).toEqual({ 'first-log': 1 });
  });

  it('keeps an outside timer', () => {
    expect(normalizeData({ timer: { kind: 'outside', startedAt: 5, category: 'sport' } }, NOW).timer).toEqual({ startedAt: 5, category: 'sport' });
    expect(normalizeData({ timer: { startedAt: 5 } }, NOW).timer).toEqual({ startedAt: 5 });
  });

  it('validates v2 fields', () => {
    const d = normalizeData(
      {
        entries: [],
        trackingSince: '2026-11-01',
        targetHistory: [
          { from: '2026-11-10', weekday: 45, weekend: 9999, holiday: 'x' },
          { from: 'bad', weekday: 1 },
        ],
        holidays: [
          { id: 'h1', name: '  Christmas  ', start: '2027-01-02', end: '2026-12-21' },
          { id: 'h2', start: 'nope', end: '2026-12-01' },
        ],
        restDays: ['2026-11-24', '2026-11-24', 'junk'],
      },
      NOW,
    );
    expect(d.targetHistory).toEqual([{ from: '2026-11-01', weekday: 45, weekend: 480, holiday: 120 }]);
    expect(d.holidays).toEqual([{ id: 'h1', name: 'Christmas', start: '2026-12-21', end: '2027-01-02' }]);
    expect(d.restDays).toEqual(['2026-11-24']);
  });

  it('never starts tracking in the future', () => {
    expect(normalizeData({ entries: [], trackingSince: '2030-01-01' }, NOW).trackingSince).toBe('2026-11-26');
  });
});

describe('normalizeEntry', () => {
  it('rounds minutes, defaults source, rejects inside and bad durations', () => {
    expect(normalizeEntry({ id: 'x', start: 10.4, minutes: 29.6 })).toMatchObject({ minutes: 30, start: 10, source: 'quick' });
    expect(normalizeEntry({ id: 'x', kind: 'inside', start: 10, minutes: 30 })).toBeNull();
    expect(normalizeEntry({ id: 'x', start: 10, minutes: 0 })).toBeNull();
    expect(normalizeEntry({ id: 'x', start: 10, minutes: 99999 })).toBeNull();
  });
});
