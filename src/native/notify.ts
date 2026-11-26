import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { getState } from '../data/store';
import type { Entry, Kind, Settings } from '../data/types';
import { dailyTotals, dayKey, fmtDur, fmtTime, MIN, sameDay, totalsFor } from '../logic/time';
import { isNative } from './platform';

/* Real OS-scheduled notifications (Android AlarmManager via @capacitor/local-notifications).
   They fire even when the app is closed and are restored after a reboot by the plugin. */

export const NOTIF_ID = { daily: 1001, timerNudge: 1002, logNudge: 1003, timer: 1004, test: 1005 } as const;

const QUIET_START = 21; // no nudges from 21:00…
const QUIET_END = 8; // …until 08:00
const ICON = { smallIcon: 'ic_stat_pip', iconColor: '#16a34a' };

let setupDone: Promise<void> | null = null;
let exactAllowed = false;

function setup(): Promise<void> {
  if (!setupDone) {
    setupDone = (async () => {
      try {
        await LocalNotifications.createChannel({
          id: 'reminders',
          name: 'Reminders & nudges',
          description: 'Daily log reminder and fresh-air nudges',
          importance: 4,
          visibility: 1,
        });
        await LocalNotifications.createChannel({
          id: 'timer',
          name: 'Running timer',
          description: 'Shows while a live timer is running',
          importance: 2,
          visibility: 1,
          vibration: false,
        });
        exactAllowed = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
      } catch (err) {
        console.warn('Notification setup failed', err);
      }
    })();
  }
  return setupDone;
}

async function hasPermission(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** Ask for notification permission (Android 13+ shows a system prompt). */
export async function ensurePermission(): Promise<boolean> {
  if (!isNative) return true; // browser preview: pretend it's fine
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch {
    return false;
  }
}

async function cancel(...ids: number[]) {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    await LocalNotifications.removeDeliveredNotificationsById?.({ ids }).catch(() => {});
  } catch {
    /* nothing scheduled */
  }
}

async function schedule(n: LocalNotificationSchema) {
  // isExactNotification:false unless the user granted "Alarms & reminders": otherwise the plugin
  // would open that settings screen on every schedule call.
  await LocalNotifications.schedule({ notifications: [{ ...ICON, isExactNotification: exactAllowed, ...n }] });
}

/** Nudges only make sense in waking hours. */
export function inWakingHours(ts: number) {
  const h = new Date(ts).getHours();
  return h >= QUIET_END && h < QUIET_START;
}

/* ───────────── Daily reminder ───────────── */

export async function syncReminders(s: Settings) {
  if (!isNative) return;
  await setup();
  await cancel(NOTIF_ID.daily);
  if (!s.insideNudge.on) await cancel(NOTIF_ID.timerNudge, NOTIF_ID.logNudge);
  if (!s.dailyReminder.on || !(await hasPermission())) return;
  const [hour, minute] = s.dailyReminder.time.split(':').map(Number);
  try {
    await schedule({
      id: NOTIF_ID.daily,
      channelId: 'reminders',
      title: 'Time to log your day 🌱',
      body: 'How did inside vs outside go today? Pip is waiting to hear!',
      schedule: { on: { hour, minute }, allowWhileIdle: true },
      autoCancel: true,
    });
  } catch (err) {
    console.warn('Could not schedule daily reminder', err);
  }
}

/* ───────────── Timer ───────────── */

export async function afterTimerStarted(kind: Kind) {
  if (!isNative) return;
  await setup();
  if (!(await hasPermission())) return;
  const t = getState().timer;
  if (!t) return;
  await showTimerNotification(kind, t.startedAt);
  const s = getState().settings;
  if (kind === 'outside') {
    await cancel(NOTIF_ID.timerNudge, NOTIF_ID.logNudge);
  } else if (s.insideNudge.on) {
    const at = t.startedAt + s.insideNudge.afterMin * MIN;
    if (at > Date.now() && inWakingHours(at)) {
      await schedule({
        id: NOTIF_ID.timerNudge,
        channelId: 'reminders',
        title: `You’ve been inside for ${fmtDur(s.insideNudge.afterMin)} 👀`,
        body: 'Pip could use some sunshine. Fancy a quick walk or scoot?',
        schedule: { at: new Date(at), allowWhileIdle: true },
        autoCancel: true,
      }).catch(() => {});
    }
  }
}

async function showTimerNotification(kind: Kind, startedAt: number) {
  await schedule({
    id: NOTIF_ID.timer,
    channelId: 'timer',
    title: kind === 'outside' ? '🌳 Outside timer running' : '🏠 Inside timer running',
    body: `Started at ${fmtTime(startedAt)}. Tap to open and stop it.`,
    ongoing: true,
    autoCancel: false,
  }).catch(() => {});
}

export async function afterTimerStopped() {
  await cancel(NOTIF_ID.timer, NOTIF_ID.timerNudge);
}

/* ───────────── After a log ───────────── */

export async function afterLogSaved(e: Entry) {
  if (!isNative) return;
  const s = getState().settings;
  if (e.kind === 'outside') {
    await cancel(NOTIF_ID.timerNudge, NOTIF_ID.logNudge);
    return;
  }
  if (!s.insideNudge.on || !sameDay(e.start, Date.now()) || !(await hasPermission())) return;
  const today = totalsFor(dailyTotals(getState().entries), dayKey(Date.now()));
  if (today.outside > 0 || today.inside < s.insideNudge.afterMin) return;
  const at = Date.now() + 30 * MIN;
  if (!inWakingHours(at)) return;
  await setup();
  await schedule({
    id: NOTIF_ID.logNudge,
    channelId: 'reminders',
    title: `${fmtDur(today.inside)} inside, 0 outside today 🥺`,
    body: 'Pip is wilting! Even 15 minutes of fresh air helps.',
    schedule: { at: new Date(at), allowWhileIdle: true },
    autoCancel: true,
  }).catch(() => {});
}

/* ───────────── App start + test + exact alarms ───────────── */

/** Called on launch/resume: re-sync the daily reminder and the running-timer notification. */
export async function resyncAll() {
  if (!isNative) return;
  await setup();
  const { settings, timer } = getState();
  await syncReminders(settings);
  if (timer && (await hasPermission())) await showTimerNotification(timer.kind, timer.startedAt);
  if (!timer) await cancel(NOTIF_ID.timer, NOTIF_ID.timerNudge);
}

export async function sendTest() {
  if (!isNative) return;
  await setup();
  if (!(await ensurePermission())) return;
  await schedule({
    id: NOTIF_ID.test,
    channelId: 'reminders',
    title: 'Hi from Pip! 🌱',
    body: 'Notifications are working. See you outside!',
    schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
    autoCancel: true,
  });
}

export async function exactStatus(): Promise<boolean> {
  if (!isNative) return false;
  await setup();
  try {
    exactAllowed = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    /* ignore */
  }
  return exactAllowed;
}

/** Opens Android's "Alarms & reminders" screen so reminders arrive on the exact minute. */
export async function requestExact(): Promise<boolean> {
  if (!isNative) return false;
  try {
    exactAllowed = (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    /* ignore */
  }
  await syncReminders(getState().settings);
  return exactAllowed;
}

export function onNotificationTap(cb: (id: number) => void) {
  if (!isNative) return () => {};
  const sub = LocalNotifications.addListener('localNotificationActionPerformed', (a) => cb(a.notification.id));
  return () => void sub.then((s) => s.remove());
}
