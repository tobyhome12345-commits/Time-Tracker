import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { evaluateFamily, fmtValue, MAX_TIER, storedTier, tierKey, TIERS, type FamilyResult } from '../logic/badges';
import { tap } from '../native/platform';

/** Tier actually shown: the higher of what the data says now and what was ever unlocked. */
function shownTier(r: FamilyResult, unlocked: Record<string, number>) {
  return Math.max(r.tier, storedTier(unlocked, r.family.id));
}

export function BadgeCase({ results: raw, unlocked }: { results: FamilyResult[]; unlocked: Record<string, number> }) {
  const [open, setOpen] = useState<FamilyResult | null>(null);
  // Next goals start from the highest tier ever earned.
  const results = raw.map((r) => evaluateFamily(r.family, r.value, storedTier(unlocked, r.family.id)));
  const counts = TIERS.map((t) => results.filter((r) => shownTier(r, unlocked) >= t.n).length);
  const medals = results.reduce((a, r) => a + shownTier(r, unlocked), 0);
  const sorted = results.slice().sort((a, b) => {
    const ta = shownTier(a, unlocked);
    const tb = shownTier(b, unlocked);
    if ((ta >= MAX_TIER) !== (tb >= MAX_TIER)) return ta >= MAX_TIER ? 1 : -1; // maxed last
    return b.fraction - a.fraction || tb - ta;
  });

  return (
    <>
      <section className="card trophy-case" aria-label="Trophy case">
        <div className="spread">
          <h3 className="card-title" style={{ fontSize: 16 }}>
            Trophy case
          </h3>
          <span className="badge-count tnum">
            {medals} / {results.length * MAX_TIER} medals
          </span>
        </div>
        <div className="trophy-row">
          {TIERS.map((t, i) => (
            <div key={t.n} className={`trophy-cell${counts[i] ? '' : ' is-empty'}`} aria-label={`${counts[i]} ${t.name}`}>
              <span className={`medal medal-sm ${t.cls}`} aria-hidden>
                <span>{t.emoji}</span>
              </span>
              <b className="tnum">{counts[i]}</b>
              <small>{t.name}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="badge-grid2">
        {sorted.map((r) => (
          <BadgeCard
            key={r.family.id}
            r={r}
            tier={shownTier(r, unlocked)}
            onOpen={() => {
              tap();
              setOpen(r);
            }}
          />
        ))}
      </div>

      {open && <BadgeSheet r={open} unlocked={unlocked} onClose={() => setOpen(null)} />}
    </>
  );
}

function Pips({ tier }: { tier: number }) {
  return (
    <span className="pips" aria-hidden>
      {TIERS.map((t) => (
        <i key={t.n} className={tier >= t.n ? t.cls : ''} />
      ))}
    </span>
  );
}

function BadgeCard({ r, tier, onOpen }: { r: FamilyResult; tier: number; onOpen: () => void }) {
  const t = tier > 0 ? TIERS[tier - 1] : null;
  const f = r.family;
  return (
    <button className={`bcard${t ? ' is-earned' : ''}`} onClick={onOpen} aria-label={`${f.name}: ${t ? t.name : 'not started'}${r.next ? `. Next: ${f.goal(r.next.threshold)}` : '. Maxed out'}`}>
      <span className={`medal ${t ? t.cls : 't-0'}`} aria-hidden>
        <span>{f.emoji}</span>
      </span>
      <span className="bcard-name">{f.name}</span>
      <span className={`tier-chip ${t ? t.cls : 't-0'}`}>{t ? `${t.emoji} ${t.name}` : 'Locked'}</span>
      <Pips tier={tier} />
      {r.next ? (
        <span className="bcard-next">
          <span className="bcard-next-label">
            Next: {r.next.tier.emoji} {r.next.tier.name}
          </span>
          <span className="progress bcard-bar">
            <span style={{ width: `${r.fraction * 100}%` }} />
          </span>
          <span className="bcard-count tnum">
            {fmtValue(f, r.value)} / {fmtValue(f, r.next.threshold)} {r.next.threshold === 1 && f.unit.endsWith('s') ? f.unit.slice(0, -1) : f.unit}
          </span>
        </span>
      ) : (
        <span className="bcard-max">👑 Maxed out!</span>
      )}
    </button>
  );
}

function BadgeSheet({ r, unlocked, onClose }: { r: FamilyResult; unlocked: Record<string, number>; onClose: () => void }) {
  const f = r.family;
  const tier = shownTier(r, unlocked);
  const cur = tier > 0 ? TIERS[tier - 1] : null;
  return (
    <Sheet title={`${f.emoji} ${f.name}`} onClose={onClose}>
      <div className="bsheet-head">
        <span className={`medal medal-lg ${cur ? cur.cls : 't-0'}`} aria-hidden>
          <span>{f.emoji}</span>
        </span>
        <div>
          <div className="bsheet-tier">{cur ? `${cur.emoji} ${cur.name}` : 'Not started yet'}</div>
          <div className="bsheet-val tnum">
            You’re on <b>{fmtValue(f, r.value)}</b> {f.unit}
          </div>
          <Pips tier={tier} />
        </div>
      </div>
      <ol className="tier-list">
        {TIERS.map((t, i) => {
          const th = f.thresholds[i];
          const got = tier >= t.n;
          const isNext = !got && t.n === tier + 1;
          const when = unlocked[tierKey(f.id, t.n)];
          return (
            <li key={t.n} className={`tier-row${got ? ' is-got' : ''}${isNext ? ' is-next' : ''}`}>
              <span className={`medal medal-sm ${got ? t.cls : 't-0'}`} aria-hidden>
                <span>{t.emoji}</span>
              </span>
              <span className="tier-main">
                <span className="tier-name">{t.name}</span>
                <span className="tier-goal">{f.goal(th)}</span>
                {isNext && (
                  <span className="tier-prog">
                    <span className="progress bcard-bar">
                      <span style={{ width: `${r.fraction * 100}%` }} />
                    </span>
                    <span className="tnum">
                      {fmtValue(f, r.value)} / {fmtValue(f, th)}
                    </span>
                  </span>
                )}
              </span>
              <span className="tier-status">{got ? (when ? `✓ ${new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : '✓') : '🔒'}</span>
            </li>
          );
        })}
      </ol>
      <p className="settings-note">Every tier you earn is yours forever. The bar starts again from empty for the next one 💪</p>
    </Sheet>
  );
}
