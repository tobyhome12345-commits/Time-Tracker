import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from '../src/data/backup';
import { addEntry, getState, importData, setState } from '../src/data/store';
import { emptyData } from '../src/data/types';

describe('backup', () => {
  it('round-trips through JSON', () => {
    const data = emptyData('2023-11-14');
    data.entries.push({ id: 'a', start: 1_700_000_000_000, minutes: 45, category: 'sport', source: 'timer', createdAt: 1, updatedAt: 2 });
    data.holidays.push({ id: 'h', name: 'Summer', start: '2026-07-20', end: '2026-08-31' });
    data.settings.accent = '#ec4899';
    const parsed = parseBackup(JSON.stringify(makeBackup(data)));
    expect(parsed.entries).toBe(1);
    expect(parsed.data.entries[0]).toEqual(data.entries[0]);
    expect(parsed.data.settings.accent).toBe('#ec4899');
    expect(parsed.data.holidays).toEqual(data.holidays);
    expect(parsed.data.trackingSince).toBe('2023-11-14');
    expect(parsed.exportedAt).toBeTruthy();
  });

  it('accepts a raw AppData blob too', () => {
    const data = emptyData('2026-11-26');
    expect(parseBackup(JSON.stringify(data)).entries).toBe(0);
  });

  it('migrates an old v1 backup (inside logs dropped)', () => {
    const v1 = { app: 'touch-grass', version: '1.0.10', exportedAt: '2026-11-26T10:00:00Z', data: { schemaVersion: 1, settings: {}, entries: [
      { id: 'i', kind: 'inside', start: 1_700_000_000_000, minutes: 60 },
      { id: 'o', kind: 'outside', start: 1_700_000_000_000, minutes: 30 },
    ] } };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.data.entries.map((e) => e.id)).toEqual(['o']);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not JSON/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/isn’t a Touch Grass backup/);
    expect(() => parseBackup('[1,2,3]')).toThrow();
  });
});

describe('importData', () => {
  it('merges by id (imported wins) and keeps local-only entries', () => {
    setState(() => emptyData('2026-11-26'));
    const local = addEntry({ start: 1000, minutes: 30, source: 'quick' });
    const incoming = emptyData('2026-11-20');
    incoming.entries.push({ id: local.id, start: 1000, minutes: 99, source: 'quick', createdAt: 1, updatedAt: 1 });
    incoming.entries.push({ id: 'new', start: 500, minutes: 20, source: 'quick', createdAt: 1, updatedAt: 1 });
    importData(incoming, 'merge');
    const s = getState();
    expect(s.entries.map((e) => [e.id, e.minutes])).toEqual([
      ['new', 20],
      [local.id, 99],
    ]);
    expect(s.trackingSince).toBe('2026-11-20');
  });

  it('replace swaps everything', () => {
    setState(() => emptyData('2026-11-26'));
    addEntry({ start: 1000, minutes: 30, source: 'quick' });
    const incoming = emptyData('2026-11-01');
    incoming.targetHistory[0].weekday = 45;
    importData(incoming, 'replace');
    expect(getState().entries).toHaveLength(0);
    expect(getState().targetHistory[0].weekday).toBe(45);
  });
});
