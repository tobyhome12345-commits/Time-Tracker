import { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { TabBar, type TabId } from './components/TabBar';
import { Toaster } from './components/toast';
import { flush, isLoaded, unlockBadges, useAppData } from './data/store';
import { useDerived } from './logic/useProgress';
import { STAGES } from './logic/progress';
import { showToast } from './components/toast';
import { celebrate } from './native/platform';
import { PipScreen } from './screens/PipScreen';
import { SettingsScreen } from './screens/Settings';
import { applyTheme, onSystemThemeChange } from './theme';
import { TodayScreen } from './screens/Today';
import { TimerPill } from './screens/TimerCard';
import { StatsScreen } from './screens/Stats';
import { runBack } from './native/back';
import { isNative } from './native/platform';
import { startOfDay } from './logic/time';

export function App() {
  const data = useAppData();
  const [tab, setTab] = useState<TabId>('today');
  const [dayTs, setDayTs] = useState(() => startOfDay(Date.now()));
  const { theme, accent } = data.settings;
  // If the app was left on "today" and resumes after midnight, follow the new day.
  const todayRef = useRef(startOfDay(Date.now()));
  todayRef.current = startOfDay(Date.now());

  useEffect(() => {
    applyTheme({ theme, accent });
    if (theme !== 'system') return;
    return onSystemThemeChange(() => applyTheme({ theme, accent }));
  }, [theme, accent]);

  // Celebrate new badges and level-ups.
  const { progress } = useDerived();
  const prevLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!isLoaded()) return;
    const lvl = progress.level.level;
    const msgs: string[] = [];
    if (prevLevel.current !== null && lvl > prevLevel.current) {
      const evolved = STAGES.find((s) => s.from === lvl && s.from > 1);
      msgs.push(evolved ? `🌟 Pip evolved into a ${evolved.name}!` : `🌱 Pip reached level ${lvl}!`);
    }
    prevLevel.current = lvl;
    const fresh = progress.badgeResults.filter((b) => b.earned && !data.badges[b.def.id]);
    if (fresh.length) {
      unlockBadges(fresh.map((b) => b.def.id));
      msgs.push(fresh.length === 1 ? `🏅 Badge unlocked: ${fresh[0].def.name}` : `🏅 ${fresh.length} new badges unlocked!`);
    }
    if (msgs.length) {
      celebrate();
      showToast({ msg: msgs.join('  ·  '), ms: 4000, action: { label: 'See', run: () => setTab('pip') } }, { queued: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  // Save immediately when the app goes to the background.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // Android back button: close sheet → back to Today → leave app.
  useEffect(() => {
    if (!isNative) return;
    const sub = CapApp.addListener('backButton', () => {
      if (runBack()) return;
      if (tab !== 'today') return setTab('today');
      void flush().then(() => CapApp.minimizeApp());
    });
    const pause = CapApp.addListener('pause', () => void flush());
    const resume = CapApp.addListener('resume', () => {
      const prevToday = todayRef.current;
      setDayTs((d) => (d === prevToday ? startOfDay(Date.now()) : d));
    });
    return () => {
      void sub.then((s) => s.remove());
      void pause.then((s) => s.remove());
      void resume.then((s) => s.remove());
    };
  }, [tab]);

  return (
    <div className="app">
      {tab === 'today' && <TodayScreen dayTs={dayTs} setDayTs={setDayTs} onOpenPip={() => setTab('pip')} />}
      {tab === 'pip' && <PipScreen />}
      {tab === 'stats' && (
        <StatsScreen
          onOpenDay={(ts) => {
            setDayTs(startOfDay(ts));
            setTab('today');
          }}
        />
      )}
      {tab === 'settings' && <SettingsScreen />}
      {tab !== 'today' && <TimerPill onOpen={() => setTab('today')} />}
      <Toaster />
      <TabBar
        tab={tab}
        onChange={(t) => {
          if (t === 'today' && tab === 'today') setDayTs(startOfDay(Date.now()));
          setTab(t);
        }}
      />
    </div>
  );
}
