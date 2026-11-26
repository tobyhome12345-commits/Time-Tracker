import { describe, expect, it } from 'vitest';
import { normalizeData, normalizeEntry } from '../src/data/migrate';
import { DEFAULT_SETTINGS } from '../src/data/types';

describe('normalizeData', () => {
  it('returns empty defaults for junk', () => {
    for (const junk of [null, undefined, 42, 'x', [], {}]) {
      const d = normalizeData(junk);
      expect(d.entries).toEqual([]);
      expect(d.settings).toEqual(DEFAULT_SETTINGS);
      expect(d.timer).toBeNull();
    }
  });

  it('keeps valid entries, drops invalid + duplicate ones, sorts by start', () => {
    const d = normalizeData({
      entries: [
        { id: 'b', kind: 'outside', start: 2000, minutes: 30 },
        { id: 'a', kind: 'inside', start: 1000, minutes: 45, category: 'gaming', note: '  ' },
        { id: 'a', kind: 'inside', start: 5000, minutes: 10 },
        { id: 'c', kind: 'sideways', start: 1, minutes: 5 },
        { id: 'd', kind: 'inside', start: 1, minutes: 0 },
        { id: 'e', kind: 'inside', start: 1, minutes: 99999 },
      ],
    });
    expect(d.entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(d.entries[0].category).toBe('gaming');
    expect(d.entries[0].note).toBeUndefined();
  });

  it('validates settings fields', () => {
    const d = normalizeData({
      settings: { theme: 'dark', accent: '#ABCDEF', outsideGoalMin: 1, insideLimitMin: null, dailyReminder: { on: true, time: '25:00' } },
    });
    expect(d.settings.theme).toBe('dark');
    expect(d.settings.accent).toBe('#abcdef');
    expect(d.settings.outsideGoalMin).toBe(5);
    expect(d.settings.insideLimitMin).toBeNull();
    expect(d.settings.dailyReminder).toEqual({ on: true, time: DEFAULT_SETTINGS.dailyReminder.time });
  });

  it('restores a running timer', () => {
    expect(normalizeData({ timer: { kind: 'outside', startedAt: 123 } }).timer).toEqual({ kind: 'outside', startedAt: 123 });
    expect(normalizeData({ timer: { kind: 'x', startedAt: 123 } }).timer).toBeNull();
  });
});

describe('normalizeEntry', () => {
  it('rounds minutes and defaults source', () => {
    const e = normalizeEntry({ id: 'x', kind: 'outside', start: 10.4, minutes: 29.6 });
    expect(e).toMatchObject({ minutes: 30, start: 10, source: 'quick' });
  });
});
