import { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { TabBar, type TabId } from './components/TabBar';
import { Toaster } from './components/toast';
import { flush, useAppData } from './data/store';
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
      {tab === 'today' && <TodayScreen dayTs={dayTs} setDayTs={setDayTs} />}
      {tab === 'stats' && (
        <StatsScreen
          onOpenDay={(ts) => {
            setDayTs(startOfDay(ts));
            setTab('today');
          }}
        />
      )}
      {(tab === 'pip' || tab === 'settings') && (
        <main className="screen">
          <div className="screen-head">
            <h1 className="screen-title">{tab[0].toUpperCase() + tab.slice(1)}</h1>
          </div>
          <div className="card empty">Coming soon 🌱</div>
        </main>
      )}
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
