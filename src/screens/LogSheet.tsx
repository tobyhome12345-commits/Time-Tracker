import { useMemo, useState } from 'react';
import { Minus, Play, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { CATEGORIES, KIND_EMOJI, KIND_LABEL } from '../data/categories';
import { addEntry, deleteEntry, getState, restoreEntry, startTimer, updateEntry } from '../data/store';
import type { Entry, Kind } from '../data/types';
import { fmtDur, fromInputs, MIN, sameDay, startOfDay, toDateInput, toTimeInput } from '../logic/time';
import { showToast } from '../components/toast';
import { tap } from '../native/platform';
import { afterLogSaved, afterTimerStarted } from '../native/notify';

const PRESETS = [15, 30, 60, 120];

export interface LogSheetProps {
  kind: Kind;
  /** Editing an existing entry */
  entry?: Entry;
  /** Day currently shown on the Today screen (defaults "when" for past days) */
  dayTs: number;
  onClose: () => void;
}

export function LogSheet({ kind: initialKind, entry, dayTs, onClose }: LogSheetProps) {
  const editing = !!entry;
  const now = Date.now();
  const viewingPast = !sameDay(dayTs, now);

  const [kind, setKind] = useState<Kind>(entry?.kind ?? initialKind);
  const [minutes, setMinutes] = useState<number>(entry?.minutes ?? 0);
  const [custom, setCustom] = useState<boolean>(!!entry && !PRESETS.includes(entry.minutes));
  const [category, setCategory] = useState<string | undefined>(entry?.category);
  const [note, setNote] = useState(entry?.note ?? '');
  const [when, setWhen] = useState<'now' | 'earlier'>(editing || viewingPast ? 'earlier' : 'now');

  const defaultStart = useMemo(() => {
    if (entry) return entry.start;
    if (viewingPast) {
      const d = new Date(dayTs);
      d.setHours(16, 0, 0, 0);
      return d.getTime();
    }
    return now - 60 * MIN;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [date, setDate] = useState(toDateInput(defaultStart));
  const [time, setTime] = useState(toTimeInput(defaultStart));

  const start = when === 'now' ? now - minutes * MIN : fromInputs(date, time);
  const inFuture = when === 'earlier' && start + minutes * MIN > now + MIN;
  const canSave = minutes >= 1 && !inFuture;
  const timerRunning = !!getState().timer;

  const color = kind === 'outside' ? 'var(--outside)' : 'var(--inside)';
  const chipStyle = {
    ['--chip-on' as string]: color,
    ['--chip-on-bg' as string]: kind === 'outside' ? 'var(--outside-soft)' : 'var(--inside-soft)',
  };

  const pickKind = (k: Kind) => {
    if (k === kind) return;
    tap();
    setKind(k);
    setCategory(undefined);
  };

  const save = () => {
    if (!canSave) return;
    tap();
    const n = note.trim() || undefined;
    if (entry) {
      updateEntry(entry.id, { kind, minutes, start, category, note: n ?? '' });
      showToast({ msg: 'Changes saved ✓' });
    } else {
      const e = addEntry({ kind, minutes, start, category, note: n, source: custom ? 'custom' : 'quick' });
      afterLogSaved(e);
      showToast({
        msg: `Logged ${fmtDur(minutes)} ${kind}${sameDay(start, now) ? '' : ` on ${new Date(start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}`} ${KIND_EMOJI[kind]}`,
        action: { label: 'Undo', run: () => deleteEntry(e.id) },
      });
    }
    onClose();
  };

  const remove = () => {
    if (!entry) return;
    tap();
    const removed = deleteEntry(entry.id);
    if (removed) showToast({ msg: 'Log deleted', action: { label: 'Undo', run: () => restoreEntry(removed) } });
    onClose();
  };

  const timerInstead = () => {
    tap();
    startTimer(kind, category);
    afterTimerStarted(kind);
    showToast({ msg: `${KIND_LABEL[kind]} timer started ⏱️` });
    onClose();
  };

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const bump = (d: number) => setMinutes((v) => Math.max(d < 0 ? 5 : 0, Math.min(16 * 60, v + d)));

  return (
    <Sheet
      title={editing ? 'Edit log' : 'Log time'}
      onClose={onClose}
      footer={
        <>
          {editing ? (
            <button className="btn btn-danger" onClick={remove} aria-label="Delete log">
              <Trash2 size={20} />
            </button>
          ) : (
            <button className="btn btn-soft" onClick={timerInstead} disabled={timerRunning} title={timerRunning ? 'A timer is already running' : undefined}>
              <Play size={18} /> Timer
            </button>
          )}
          <button className="btn btn-primary btn-block log-save" style={{ background: color, color: '#fff' }} onClick={save} disabled={!canSave}>
            {editing ? 'Save changes' : minutes ? `Log ${fmtDur(minutes)} ${kind}` : 'Pick a time'}
          </button>
        </>
      }
    >
      <div className="kind-toggle" role="radiogroup" aria-label="Inside or outside">
        {(['inside', 'outside'] as Kind[]).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={kind === k}
            className={`kind-opt kind-${k}`}
            onClick={() => pickKind(k)}
          >
            <span aria-hidden className="kind-emoji">
              {KIND_EMOJI[k]}
            </span>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <span className="field-label">How long?</span>
      <div className="chips" style={chipStyle}>
        {PRESETS.map((p) => (
          <button
            key={p}
            className="chip chip-lg"
            aria-pressed={!custom && minutes === p}
            onClick={() => {
              tap();
              setCustom(false);
              setMinutes(p);
            }}
          >
            {fmtDur(p)}
          </button>
        ))}
        <button
          className="chip chip-lg"
          aria-pressed={custom}
          onClick={() => {
            tap();
            setCustom(true);
            if (!minutes) setMinutes(45);
          }}
        >
          Custom
        </button>
      </div>

      {custom && (
        <div className="hm-picker" style={chipStyle}>
          <Stepper label="hours" display={`${h}`} unit="h" onDec={() => bump(-60)} onInc={() => bump(60)} decDisabled={minutes < 60} />
          <Stepper label="minutes" display={String(m).padStart(2, '0')} unit="m" onDec={() => bump(-5)} onInc={() => bump(5)} decDisabled={minutes <= 5} />
        </div>
      )}

      <span className="field-label">What were you up to? <span className="faint">(optional)</span></span>
      <div className="chips" style={chipStyle}>
        {CATEGORIES[kind].map((c) => (
          <button
            key={c.id}
            className="chip"
            aria-pressed={category === c.id}
            onClick={() => {
              tap();
              setCategory(category === c.id ? undefined : c.id);
            }}
          >
            <span aria-hidden>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="log-note">
        Note <span className="faint">(optional)</span>
      </label>
      <textarea
        id="log-note"
        className="input"
        rows={2}
        maxLength={280}
        placeholder={kind === 'outside' ? 'e.g. Skatepark with Sam' : 'e.g. Finished level 12'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
      />

      <span className="field-label">When?</span>
      {!editing && (
        <div className="segmented" style={{ marginBottom: 10 }}>
          <button aria-pressed={when === 'now'} onClick={() => setWhen('now')} disabled={viewingPast}>
            Just now
          </button>
          <button
            aria-pressed={when === 'earlier'}
            onClick={() => {
              if (when === 'earlier') return;
              // Prefill so the log ends about now (rounded down to 5 min); the user then adjusts.
              const s0 = Math.floor((now - Math.max(minutes, 30) * MIN) / (5 * MIN)) * 5 * MIN;
              setDate(toDateInput(s0));
              setTime(toTimeInput(s0));
              setWhen('earlier');
            }}
          >
            Earlier / past day
          </button>
        </div>
      )}
      {when === 'now' ? (
        <p className="when-hint muted">{minutes ? `Ending now · started ${new Date(start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Ending right now'}</p>
      ) : (
        <div className="grid-2">
          <label className="when-field">
            <span>Date</span>
            <input className="input" type="date" value={date} max={toDateInput(now)} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <label className="when-field">
            <span>Started at</span>
            <input className="input" type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
          </label>
        </div>
      )}
      {inFuture && <p className="form-error">That ends in the future. Pick an earlier time ⏪</p>}
      {when === 'earlier' && !inFuture && !sameDay(start, startOfDay(now)) && minutes > 0 && (
        <p className="when-hint muted">Counts toward {new Date(start).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      )}
    </Sheet>
  );
}

function Stepper(props: {
  label: string;
  display: string;
  unit: string;
  onDec: () => unknown;
  onInc: () => unknown;
  decDisabled?: boolean;
}) {
  return (
    <div className="stepper" role="group" aria-label={props.label}>
      <button
        className="stepper-btn"
        aria-label={`Fewer ${props.label}`}
        disabled={props.decDisabled}
        onClick={() => {
          tap();
          props.onDec();
        }}
      >
        <Minus size={20} />
      </button>
      <div className="stepper-val tnum" aria-live="polite">
        {props.display}
        <small>{props.unit}</small>
      </div>
      <button
        className="stepper-btn"
        aria-label={`More ${props.label}`}
        onClick={() => {
          tap();
          props.onInc();
        }}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
