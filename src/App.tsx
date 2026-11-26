import { useEffect, useState } from 'react';
import { TabBar, type TabId } from './components/TabBar';
import { useAppData } from './data/store';
import { applyTheme, onSystemThemeChange } from './theme';
import { TodayScreen } from './screens/Today';

export function App() {
  const data = useAppData();
  const [tab, setTab] = useState<TabId>('today');
  const { theme, accent } = data.settings;

  useEffect(() => {
    applyTheme({ theme, accent });
    if (theme !== 'system') return;
    return onSystemThemeChange(() => applyTheme({ theme, accent }));
  }, [theme, accent]);

  return (
    <div className="app">
      {tab === 'today' && <TodayScreen />}
      {tab !== 'today' && (
        <main className="screen">
          <div className="screen-head">
            <h1 className="screen-title">{tab[0].toUpperCase() + tab.slice(1)}</h1>
          </div>
          <div className="card empty">Coming soon 🌱</div>
        </main>
      )}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}
