import { House, Trees } from 'lucide-react';

export function TodayScreen() {
  const now = new Date();
  return (
    <main className="screen">
      <div className="screen-head">
        <div>
          <p className="screen-sub">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="screen-title">Today</h1>
        </div>
      </div>
      <div className="stack">
        <div className="card empty">Nothing logged yet. Time to touch some grass 🌱</div>
        <div className="grid-2">
          <button className="log-btn log-btn-inside">
            <House size={26} />
            Inside
          </button>
          <button className="log-btn log-btn-outside">
            <Trees size={26} />
            Outside
          </button>
        </div>
      </div>
    </main>
  );
}
