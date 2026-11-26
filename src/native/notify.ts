import type { Entry, Kind } from '../data/types';

/* Notification hooks: filled in with real OS-scheduled notifications in the reminders step. */
export function afterLogSaved(_e: Entry) {}
export function afterTimerStarted(_k: Kind) {}
export function afterTimerStopped() {}
