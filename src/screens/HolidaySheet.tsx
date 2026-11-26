import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { deleteHoliday, newId, saveHoliday } from '../data/store';
import type { Holiday } from '../data/types';
import { addDaysKey, dayKey, DAY_MS, keyToTs } from '../logic/time';
import { showToast } from '../components/toast';
import { tap } from '../native/platform';

const PRESETS = ['Christmas break 🎄', 'Half term 🍂', 'Easter break 🐣', 'Summer holidays ☀️', 'Family trip ✈️'];

/** Add or edit a holiday period (dates inclusive). Every day inside it gets the holiday target. */
export function HolidaySheet({ holiday, onClose }: { holiday?: Holiday; onClose: () => void }) {
  const today = dayKey(Date.now());
  const [name, setName] = useState(holiday?.name ?? '');
  const [start, setStart] = useState(holiday?.start ?? today);
  const [end, setEnd] = useState(holiday?.end ?? addDaysKey(today, 6));
  const valid = start <= end && name.trim().length > 0;
  const days = start <= end ? Math.round((keyToTs(end) - keyToTs(start)) / DAY_MS) + 1 : 0;
  const pastStart = start < today;

  const save = () => {
    if (!valid) return;
    tap();
    saveHoliday({ id: holiday?.id ?? newId(), name: name.trim().slice(0, 40), start, end });
    showToast({ msg: holiday ? 'Holiday updated 🏖️' : `Holiday added: ${days} day${days === 1 ? '' : 's'} of holiday mode 🏖️` });
    onClose();
  };

  return (
    <Sheet
      title={holiday ? 'Edit holiday' : 'Add a holiday 🏖️'}
      onClose={onClose}
      footer={
        <>
          {holiday && (
            <button
              className="btn btn-danger"
              aria-label="Delete holiday"
              onClick={() => {
                tap();
                const removed = deleteHoliday(holiday.id);
                if (removed) showToast({ msg: 'Holiday deleted', action: { label: 'Undo', run: () => saveHoliday(removed) } });
                onClose();
              }}
            >
              <Trash2 size={20} />
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={save} disabled={!valid}>
            {holiday ? 'Save holiday' : days ? `Add ${days}-day holiday` : 'Add holiday'}
          </button>
        </>
      }
    >
      <label className="field-label" htmlFor="hol-name" style={{ marginTop: 4 }}>
        Name
      </label>
      <input id="hol-name" className="input" maxLength={40} placeholder="e.g. Christmas break" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="chips" style={{ marginTop: 10 }}>
        {PRESETS.map((p) => (
          <button
            key={p}
            className="chip"
            aria-pressed={name === p}
            onClick={() => {
              tap();
              setName(p);
            }}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <label className="when-field">
          <span>First day</span>
          <input
            className="input"
            type="date"
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setStart(v);
              if (v > end) setEnd(v);
            }}
          />
        </label>
        <label className="when-field">
          <span>Last day</span>
          <input className="input" type="date" value={end} min={start} onChange={(e) => e.target.value && setEnd(e.target.value)} />
        </label>
      </div>
      {start > end && <p className="form-error">The last day must be after the first day.</p>}
      {valid && (
        <p className="when-hint muted">
          {days} day{days === 1 ? '' : 's'} with a holiday target. Weekend challenges count on every holiday day too 🏆
          {pastStart && holiday === undefined ? ' Past days in this holiday will use the holiday target as well.' : ''}
        </p>
      )}
    </Sheet>
  );
}
