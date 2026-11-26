/* Levels: XP → level → Pip's growth stage. Levels can go down when XP is lost. */

/** Cumulative XP needed to reach level n (n ≥ 1). */
export function xpForLevel(n: number): number {
  return 30 * n * (n - 1);
}

export type Stage = 'seed' | 'sprout' | 'sapling' | 'bud' | 'bloom' | 'tree';

export const STAGES: { id: Stage; name: string; from: number; blurb: string }[] = [
  { id: 'seed', name: 'Seed', from: 1, blurb: 'Tiny, but full of potential.' },
  { id: 'sprout', name: 'Sprout', from: 3, blurb: 'First leaves! Pip is waking up.' },
  { id: 'sapling', name: 'Sapling', from: 5, blurb: 'Taller, leafier, braver.' },
  { id: 'bud', name: 'Bud', from: 8, blurb: 'Something exciting is about to bloom…' },
  { id: 'bloom', name: 'Bloom', from: 11, blurb: 'In full flower. Absolutely glowing.' },
  { id: 'tree', name: 'Mighty Tree', from: 15, blurb: 'A legend of the outdoors. Shades on. 😎' },
];

export function stageFor(level: number): Stage {
  let s: Stage = 'seed';
  for (const st of STAGES) if (level >= st.from) s = st.id;
  return s;
}

export interface LevelInfo {
  xp: number;
  level: number;
  /** XP into the current level / needed for the next */
  into: number;
  need: number;
  stage: Stage;
}

export function levelInfo(xp: number): LevelInfo {
  const x = Math.max(0, Math.round(xp));
  let level = 1;
  while (xpForLevel(level + 1) <= x) level++;
  const base = xpForLevel(level);
  return { xp: x, level, into: x - base, need: xpForLevel(level + 1) - base, stage: stageFor(level) };
}

export function levelOf(xp: number): number {
  return levelInfo(xp).level;
}
