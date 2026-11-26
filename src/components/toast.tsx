import { useEffect, useSyncExternalStore } from 'react';

export interface ToastData {
  id: number;
  msg: string;
  action?: { label: string; run: () => void };
  ms?: number;
}

let current: ToastData | null = null;
const queue: ToastData[] = [];
let seq = 0;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

/** Show a toast now. With `queued`, wait until the current toast is gone (used for celebrations). */
export function showToast(t: Omit<ToastData, 'id'>, opts: { queued?: boolean } = {}) {
  const next = { ...t, id: ++seq };
  if (opts.queued && current) {
    queue.push(next);
    return;
  }
  current = next;
  emit();
}

export function hideToast(id?: number) {
  if (id !== undefined && current?.id !== id) return;
  current = queue.shift() ?? null;
  emit();
}

export function Toaster() {
  const t = useSyncExternalStore(
    (l) => (ls.add(l), () => ls.delete(l)),
    () => current,
  );
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => hideToast(t.id), t.ms ?? (t.action ? 5000 : 2800));
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast" key={t.id}>
        <span className="toast-msg">{t.msg}</span>
        {t.action && (
          <button
            onClick={() => {
              t.action!.run();
              hideToast(t.id);
            }}
          >
            {t.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
