import { BarChart3, Settings as Cog, Sprout, Sun } from 'lucide-react';
import { tap } from '../native/platform';

export type TabId = 'today' | 'stats' | 'pip' | 'settings';

const TABS: { id: TabId; label: string; Icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', Icon: Sun },
  { id: 'stats', label: 'Stats', Icon: BarChart3 },
  { id: 'pip', label: 'Pip', Icon: Sprout },
  { id: 'settings', label: 'Settings', Icon: Cog },
];

export function TabBar({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            className="tab"
            aria-selected={tab === id}
            onClick={() => {
              if (tab !== id) tap();
              onChange(id);
            }}
          >
            <span className="tab-icon">
              <Icon size={22} strokeWidth={tab === id ? 2.5 : 2} />
            </span>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
