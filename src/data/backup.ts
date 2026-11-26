import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from '../native/platform';
import { dayKey } from '../logic/time';
import { looksLikeBackup, normalizeData } from './migrate';
import type { AppData } from './types';

export interface BackupFile {
  app: 'touch-grass';
  version: string;
  exportedAt: string;
  data: AppData;
}

export function makeBackup(data: AppData): BackupFile {
  return { app: 'touch-grass', version: __APP_VERSION__, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(now = Date.now()) {
  return `touch-grass-backup-${dayKey(now)}.json`;
}

/** Export: on Android saves a copy in Documents/TouchGrass (when allowed) and opens the share sheet.
 *  In a browser it downloads the file. Returns where it was saved, if anywhere. */
export async function exportBackup(data: AppData): Promise<{ savedTo?: string; shared: boolean }> {
  const json = JSON.stringify(makeBackup(data), null, 2);
  const name = backupFileName();
  if (!isNative) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { savedTo: 'Downloads', shared: false };
  }
  let savedTo: string | undefined;
  try {
    await Filesystem.writeFile({ path: `TouchGrass/${name}`, data: json, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    savedTo = `Documents/TouchGrass/${name}`;
  } catch {
    // Older Android versions need storage permission; the share sheet still works.
  }
  const cached = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: 'Touch Grass backup', text: 'My Touch Grass backup 🌱', files: [cached.uri], dialogTitle: 'Save or send your backup' });
    return { savedTo, shared: true };
  } catch {
    // User closed the share sheet.
    return { savedTo, shared: false };
  }
}

export interface ParsedBackup {
  data: AppData;
  exportedAt?: string;
  entries: number;
}

/** Parse a backup file's text. Throws a friendly error message if it isn't one. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a Touch Grass backup (not JSON).');
  }
  const wrapped = raw && typeof raw === 'object' && 'data' in raw && (raw as BackupFile).app === 'touch-grass';
  const payload = wrapped ? (raw as BackupFile).data : raw;
  if (!looksLikeBackup(payload)) throw new Error('That file isn’t a Touch Grass backup.');
  const data = normalizeData(payload);
  return { data, exportedAt: wrapped ? (raw as BackupFile).exportedAt : undefined, entries: data.entries.length };
}
