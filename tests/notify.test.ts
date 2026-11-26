import { beforeEach, describe, expect, it, vi } from 'vitest';

// Pretend we're on Android with notification permission granted; record plugin calls.
const calls: { schedule: any[]; cancel: number[][] } = { schedule: [], cancel: [] };
vi.mock('../src/native/platform', () => ({ isNative: true, tap() {}, celebrate() {}, setSystemBars() {} }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    createChannel: vi.fn(async () => {}),
    checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'denied' })),
    changeExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'granted' })),
    checkPermissions: vi.fn(async () => ({ display: 'granted' })),
    requestPermissions: vi.fn(async () => ({ display: 'granted' })),
    schedule: vi.fn(async (o: any) => {
      calls.schedule.push(...o.notifications);
      return { notifications: [] };
    }),
    cancel: vi.fn(async (o: any) => {
      calls.cancel.push(o.notifications.map((n: any) => n.id));
    }),
    removeDeliveredNotificationsById: vi.fn(async () => {}),
    addListener: vi.fn(async () => ({ remove() {} })),
  },
}));

const { NOTIF_ID, afterLogSaved, afterTimerStarted, afterTimerStopped, inWakingHours, syncReminders } = await import('../src/native/notify');
const { addEntry, setState, startTimer, getState } = await import('../src/data/store');
const { emptyData } = await import('../src/data/types');

const at = (h: number, m = 0) => new Date(2026, 10, 26, h, m).getTime();

function reset(nowH: number, nowM = 0) {
  vi.useFakeTimers();
  vi.setSystemTime(at(nowH, nowM));
  calls.schedule.length = 0;
  calls.cancel.length = 0;
  const d = emptyData();
  d.settings.dailyReminder = { on: true, time: '19:30' };
  d.settings.insideNudge = { on: true, afterMin: 90 };
  setState(() => d);
}

describe('quiet hours', () => {
  it('allows 08:00–20:59 only', () => {
    expect(inWakingHours(at(7, 59))).toBe(false);
    expect(inWakingHours(at(8))).toBe(true);
    expect(inWakingHours(at(20, 59))).toBe(true);
    expect(inWakingHours(at(21))).toBe(false);
  });
});

describe('daily reminder', () => {
  beforeEach(() => reset(10));

  it('schedules a repeating daily notification at the chosen time, never forcing exact alarms', async () => {
    await syncReminders(getState().settings);
    const n = calls.schedule.find((x) => x.id === NOTIF_ID.daily);
    expect(n.schedule.on).toEqual({ hour: 19, minute: 30 });
    expect(n.isExactNotification).toBe(false); // otherwise the plugin opens Android settings
    expect(n.smallIcon).toBe('ic_stat_pip');
  });

  it('cancels it when switched off', async () => {
    const s = { ...getState().settings, dailyReminder: { on: false, time: '19:30' } };
    await syncReminders(s);
    expect(calls.cancel.flat()).toContain(NOTIF_ID.daily);
    expect(calls.schedule.find((x) => x.id === NOTIF_ID.daily)).toBeUndefined();
  });
});

describe('fresh-air nudges', () => {
  it('inside timer → ongoing notification + nudge after the delay', async () => {
    reset(14);
    startTimer('inside');
    await afterTimerStarted('inside');
    expect(calls.schedule.find((x) => x.id === NOTIF_ID.timer)).toMatchObject({ ongoing: true, channelId: 'timer' });
    const nudge = calls.schedule.find((x) => x.id === NOTIF_ID.timerNudge);
    expect(nudge.schedule.at.getTime()).toBe(at(15, 30));
  });

  it('no nudge if it would land in quiet hours', async () => {
    reset(20);
    startTimer('inside');
    await afterTimerStarted('inside');
    expect(calls.schedule.find((x) => x.id === NOTIF_ID.timerNudge)).toBeUndefined();
  });

  it('outside timer cancels pending nudges', async () => {
    reset(14);
    startTimer('outside');
    await afterTimerStarted('outside');
    expect(calls.cancel.flat()).toEqual(expect.arrayContaining([NOTIF_ID.timerNudge, NOTIF_ID.logNudge]));
    await afterTimerStopped();
    expect(calls.cancel.flat()).toContain(NOTIF_ID.timer);
  });

  it('inside log over the threshold with no outside → nudge in 30 min', async () => {
    reset(15);
    const e = addEntry({ kind: 'inside', start: at(13), minutes: 100, source: 'quick' });
    await afterLogSaved(e);
    const n = calls.schedule.find((x) => x.id === NOTIF_ID.logNudge);
    expect(n.schedule.at.getTime()).toBe(at(15, 30));
  });

  it('no log nudge once there is outside time today', async () => {
    reset(15);
    addEntry({ kind: 'outside', start: at(9), minutes: 20, source: 'quick' });
    const e = addEntry({ kind: 'inside', start: at(13), minutes: 100, source: 'quick' });
    await afterLogSaved(e);
    expect(calls.schedule.find((x) => x.id === NOTIF_ID.logNudge)).toBeUndefined();
  });

  it('outside log cancels nudges', async () => {
    reset(15);
    const e = addEntry({ kind: 'outside', start: at(14), minutes: 20, source: 'quick' });
    await afterLogSaved(e);
    expect(calls.cancel.flat()).toEqual(expect.arrayContaining([NOTIF_ID.timerNudge, NOTIF_ID.logNudge]));
  });
});
