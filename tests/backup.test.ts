import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from '../src/data/backup';
import { addEntry, getState, importData, setState } from '../src/data/store';
import { emptyData } from '../src/data/types';

describe('backup', () => {
  it('round-trips through JSON', () => {
    const data = emptyData();
    data.entries.push({ id: 'a', kind: 'outside', start: 1_700_000_000_000, minutes: 45, category: 'sport', source: 'timer', createdAt: 1, updatedAt: 2 });
    data.settings.accent = '#ec4899';
    const parsed = parseBackup(JSON.stringify(makeBackup(data)));
    expect(parsed.entries).toBe(1);
    expect(parsed.data.entries[0]).toEqual(data.entries[0]);
    expect(parsed.data.settings.accent).toBe('#ec4899');
    expect(parsed.exportedAt).toBeTruthy();
  });

  it('accepts a raw AppData blob too', () => {
    const data = emptyData();
    expect(parseBackup(JSON.stringify(data)).entries).toBe(0);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not JSON/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/isn’t a Touch Grass backup/);
    expect(() => parseBackup('[1,2,3]')).toThrow();
  });
});

describe('importData', () => {
  it('merges by id (imported wins) and keeps local-only entries', () => {
    setState(() => emptyData());
    const local = addEntry({ kind: 'inside', start: 1000, minutes: 30, source: 'quick' });
    const incoming = emptyData();
    incoming.entries.push({ id: local.id, kind: 'inside', start: 1000, minutes: 99, source: 'quick', createdAt: 1, updatedAt: 1 });
    incoming.entries.push({ id: 'new', kind: 'outside', start: 500, minutes: 20, source: 'quick', createdAt: 1, updatedAt: 1 });
    importData(incoming, 'merge');
    const s = getState();
    expect(s.entries.map((e) => [e.id, e.minutes])).toEqual([
      ['new', 20],
      [local.id, 99],
    ]);
  });

  it('replace swaps everything', () => {
    setState(() => emptyData());
    addEntry({ kind: 'inside', start: 1000, minutes: 30, source: 'quick' });
    const incoming = emptyData();
    incoming.settings.outsideGoalMin = 60;
    importData(incoming, 'replace');
    expect(getState().entries).toHaveLength(0);
    expect(getState().settings.outsideGoalMin).toBe(60);
  });
});
