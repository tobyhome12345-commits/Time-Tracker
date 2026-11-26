import { useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Download, HelpCircle, Minus, Monitor, Moon, Palette, Plus, Sun, Trash2, Upload } from 'lucide-react';
import { getState, importData, resetAll, setTargets, updateSettings, useAppData } from '../data/store';
import type { Holiday, Settings, Targets, ThemePref } from '../data/types';
import { exportBackup, parseBackup, type ParsedBackup } from '../data/backup';
import { Sheet } from '../components/Sheet';
import { showToast } from '../components/toast';
import { ACCENTS, contrast } from '../theme';
import { dayKey, DAY_MS, fmtDur, keyToTs } from '../logic/time';
import { tap } from '../native/platform';
import { HolidaySheet } from './HolidaySheet';
import { XpRulesSheet } from './XpHistory';

export function SettingsScreen() {
  const { settings, entries, targetHistory, holidays } = useAppData();
  const targets = targetHistory[targetHistory.length - 1];
  const [accentSheet, setAccentSheet] = useState(false);
  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [holidaySheet, setHolidaySheet] = useState<Holiday | 'new' | null>(null);
  const [rules, setRules] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = dayKey(Date.now());

  const set = (patch: Partial<Settings>) => updateSettings(patch);
  const setTarget = (k: keyof Targets, v: number) => {
    setTargets({ [k]: v });
    showToast({ msg: 'New target applies from today 👍' });
  };

  const onExport = async () => {
    tap();
    try {
      const res = await exportBackup(getState());
      showToast({ msg: res.savedTo ? `Backup saved to ${res.savedTo} ✓` : res.shared ? 'Backup shared ✓' : 'Backup ready' });
    } catch {
      showToast({ msg: 'Couldn’t export the backup 😕' });
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch (err) {
      showToast({ msg: (err as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const upcoming = holidays.filter((h) => h.end >= today);
  const past = holidays.filter((h) => h.end < today);

  return (
    <main className="screen" aria-label="Settings">
      <div className="screen-head">
        <h1 className="screen-title">Settings</h1>
      </div>

      <div className="stack">
        <h2 className="section-title">Daily targets</h2>
        <section className="card settings-card">
          <Row icon="📚" title="School days" sub="Monday to Friday">
            <MiniStepper value={targets.weekday} min={15} max={6 * 60} step={15} onChange={(v) => setTarget('weekday', v)} label="weekday target" />
          </Row>
          <Row icon="🎉" title="Weekends" sub="Saturday and Sunday">
            <MiniStepper value={targets.weekend} min={15} max={8 * 60} step={15} onChange={(v) => setTarget('weekend', v)} label="weekend target" />
          </Row>
          <Row icon="🏖️" title="Holidays" sub="Every day of a holiday">
            <MiniStepper value={targets.holiday} min={15} max={8 * 60} step={15} onChange={(v) => setTarget('holiday', v)} label="holiday target" />
          </Row>
          <p className="settings-note">Beat your target to win XP, miss it and you lose XP at midnight. Changes apply from today, so past days keep their old targets.</p>
          <button
            className="btn btn-soft btn-block"
            style={{ marginTop: 10 }}
            onClick={() => {
              tap();
              setRules(true);
            }}
          >
            <HelpCircle size={18} /> How XP works
          </button>
        </section>

        <h2 className="section-title">🏖️ Holiday mode</h2>
        <section className="card settings-card">
          {upcoming.length === 0 && <p className="settings-note" style={{ marginTop: 6 }}>Add your school holidays and every day becomes a {fmtDur(targets.holiday)} day. Weekend challenges also run all holiday long!</p>}
          {upcoming.map((h) => (
            <HolidayRow key={h.id} h={h} today={today} onClick={() => setHolidaySheet(h)} />
          ))}
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 12 }}
            onClick={() => {
              tap();
              setHolidaySheet('new');
            }}
          >
            <Plus size={18} /> Add a holiday
          </button>
          {past.length > 0 && (
            <details className="past-holidays">
              <summary>Past holidays ({past.length})</summary>
              {past
                .slice()
                .reverse()
                .map((h) => (
                  <HolidayRow key={h.id} h={h} today={today} onClick={() => setHolidaySheet(h)} />
                ))}
            </details>
          )}
        </section>

        <h2 className="section-title">Rest days</h2>
        <section className="card settings-card">
          <Row icon="😴" title="Two rest days per week" sub="Ill or really busy? Use one from the bottom of the Today screen: no XP lost, streak safe.">
            <span />
          </Row>
        </section>

        <h2 className="section-title">Appearance</h2>
        <section className="card settings-card">
          <span className="field-label" style={{ marginTop: 0 }}>
            Theme
          </span>
          <div className="segmented theme-seg">
            {(
              [
                ['system', 'System', Monitor],
                ['light', 'Light', Sun],
                ['dark', 'Dark', Moon],
              ] as [ThemePref, string, typeof Sun][]
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                aria-pressed={settings.theme === id}
                onClick={() => {
                  tap();
                  set({ theme: id });
                }}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <span className="field-label">Accent colour</span>
          <div className="swatches" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={settings.accent === c}
                aria-label={c}
                className="swatch"
                style={{ background: c }}
                onClick={() => {
                  tap();
                  set({ accent: c });
                }}
              />
            ))}
            <button
              className={`swatch swatch-custom${ACCENTS.includes(settings.accent) ? '' : ' is-on'}`}
              aria-label="Custom colour"
              onClick={() => {
                tap();
                setAccentSheet(true);
              }}
              style={ACCENTS.includes(settings.accent) ? undefined : { background: settings.accent }}
            >
              <Palette size={18} />
            </button>
          </div>
        </section>

        <h2 className="section-title">Your data</h2>
        <section className="card settings-card">
          <p className="settings-note" style={{ marginTop: 0 }}>
            Everything is saved only on this phone ({entries.length} logs). Export a backup now and then so you never lose it.
          </p>
          <div className="grid-2">
            <button className="btn btn-soft" onClick={() => void onExport()}>
              <Download size={18} /> Export
            </button>
            <button
              className="btn btn-soft"
              onClick={() => {
                tap();
                fileRef.current?.click();
              }}
            >
              <Upload size={18} /> Import
            </button>
          </div>
          <input ref={fileRef} type="file" hidden onChange={(e) => void onPickFile(e.target.files?.[0])} />
          <button
            className="btn btn-ghost btn-block danger-link"
            onClick={() => {
              tap();
              setConfirmReset(true);
            }}
          >
            <Trash2 size={16} /> Delete all logs
          </button>
        </section>

        <p className="about">
          🌱 Touch Grass v{__APP_VERSION__}
          <br />
          Works offline · No accounts · No ads
        </p>
      </div>

      {holidaySheet && <HolidaySheet holiday={holidaySheet === 'new' ? undefined : holidaySheet} onClose={() => setHolidaySheet(null)} />}
      {rules && <XpRulesSheet onClose={() => setRules(false)} />}
      {accentSheet && <AccentSheet current={settings.accent} onPick={(c) => set({ accent: c })} onClose={() => setAccentSheet(false)} />}

      {pendingImport && (
        <Sheet title="Import backup?" onClose={() => setPendingImport(null)}>
          <p className="import-summary">
            This backup has <b>{pendingImport.entries} logs</b>
            {pendingImport.exportedAt && <> from {new Date(pendingImport.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</>}.
          </p>
          <div className="stack" style={{ gap: 10, marginTop: 14 }}>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                importData(pendingImport.data, 'merge');
                showToast({ msg: 'Backup merged ✓' });
                setPendingImport(null);
              }}
            >
              Merge with my logs
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={() => {
                importData(pendingImport.data, 'replace');
                showToast({ msg: 'Backup restored ✓' });
                setPendingImport(null);
              }}
            >
              Replace everything
            </button>
            <p className="settings-note">Merge keeps your current logs and adds the backup’s. Replace swaps everything (including targets and holidays) for the backup.</p>
          </div>
        </Sheet>
      )}

      {confirmReset && (
        <Sheet title="Delete all logs?" onClose={() => setConfirmReset(false)}>
          <p className="import-summary">This removes all {entries.length} logs, XP, badges and Pip’s progress. Your targets, holidays and colours stay. This can’t be undone, so export a backup first if you might want them back.</p>
          <div className="stack" style={{ gap: 10, marginTop: 14 }}>
            <button className="btn btn-soft btn-block" onClick={() => void onExport()}>
              <Download size={18} /> Export a backup first
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={() => {
                resetAll();
                showToast({ msg: 'All logs deleted' });
                setConfirmReset(false);
              }}
            >
              <Trash2 size={18} /> Delete everything
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function HolidayRow({ h, today, onClick }: { h: Holiday; today: string; onClick: () => void }) {
  const days = Math.round((keyToTs(h.end) - keyToTs(h.start)) / DAY_MS) + 1;
  const fmt = (k: string) => new Date(keyToTs(k)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const onNow = h.start <= today && today <= h.end;
  const startsIn = Math.round((keyToTs(h.start) - keyToTs(today)) / DAY_MS);
  return (
    <button className="holiday-row" onClick={onClick}>
      <span className="set-icon" aria-hidden>
        🏖️
      </span>
      <span className="set-text">
        <span className="set-title">
          {h.name} {onNow && <span className="on-now">On now</span>}
        </span>
        <span className="set-sub">
          {fmt(h.start)} – {fmt(h.end)} · {days} day{days === 1 ? '' : 's'}
          {!onNow && startsIn > 0 ? ` · starts in ${startsIn} day${startsIn === 1 ? '' : 's'}` : ''}
        </span>
      </span>
      <ChevronRight size={18} className="faint" />
    </button>
  );
}

function Row({ icon, title, sub, children, indent }: { icon: string; title: string; sub: string; children: ReactNode; indent?: boolean }) {
  return (
    <div className={`set-row${indent ? ' is-indent' : ''}`}>
      {icon && (
        <span className="set-icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="set-text">
        <span className="set-title">{title}</span>
        {sub && <span className="set-sub">{sub}</span>}
      </span>
      <span className="set-control">{children}</span>
    </div>
  );
}


function MiniStepper({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  const change = (d: number) => {
    tap();
    onChange(Math.min(max, Math.max(min, value + d)));
  };
  return (
    <span className="mini-stepper" role="group" aria-label={label}>
      <button onClick={() => change(-step)} disabled={value <= min} aria-label={`Less ${label}`}>
        <Minus size={16} />
      </button>
      <span className="tnum" aria-live="polite">
        {fmtDur(value)}
      </span>
      <button onClick={() => change(step)} disabled={value >= max} aria-label={`More ${label}`}>
        <Plus size={16} />
      </button>
    </span>
  );
}

/* ───── Custom accent picker (hue + lightness sliders; works the same on every Android WebView) ───── */

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

function hexToHue(hex: string): { h: number; l: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), l: Math.round(l * 100) };
}

function AccentSheet({ current, onPick, onClose }: { current: string; onPick: (c: string) => void; onClose: () => void }) {
  const init = hexToHue(current);
  const [h, setH] = useState(init.h);
  const [l, setL] = useState(Math.min(60, Math.max(32, init.l)));
  const color = hslToHex(h, 78, l);
  const lowContrast = contrast(color, '#ffffff') < 2.2 && contrast(color, '#0b130e') < 2.2;
  return (
    <Sheet
      title="Custom colour"
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary btn-block"
          style={{ background: color }}
          onClick={() => {
            onPick(color);
            onClose();
          }}
        >
          Use this colour
        </button>
      }
    >
      <div className="accent-preview" style={{ background: color }}>
        <span>{color.toUpperCase()}</span>
      </div>
      <label className="field-label" htmlFor="hue">
        Colour
      </label>
      <input id="hue" className="slider slider-hue" type="range" min={0} max={359} value={h} onChange={(e) => setH(Number(e.target.value))} />
      <label className="field-label" htmlFor="light">
        Brightness
      </label>
      <input
        id="light"
        className="slider"
        type="range"
        min={32}
        max={60}
        value={l}
        onChange={(e) => setL(Number(e.target.value))}
        style={{ background: `linear-gradient(90deg, ${hslToHex(h, 78, 32)}, ${hslToHex(h, 78, 60)})` }}
      />
      {lowContrast && <p className="form-error">This one might be hard to read on buttons.</p>}
    </Sheet>
  );
}
