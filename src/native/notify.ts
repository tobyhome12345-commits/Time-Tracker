import type { Entry, Kind, Settings } from '../data/types';

/* Notification hooks: filled in with real OS-scheduled notifications in the reminders step. */
export function afterLogSaved(_e: Entry) {}
export function afterTimerStarted(_k: Kind) {}
export function afterTimerStopped() {}
export async function syncReminders(_s: Settings) {}
export async function ensurePermission(): Promise<boolean> {
  return true;
}
export async function sendTest() {}
