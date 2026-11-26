export interface Category {
  id: string;
  label: string;
  emoji: string;
}

/** Outdoor activities (ids are stored in entries, so never rename an id). */
export const CATEGORIES: Category[] = [
  { id: 'scooting', label: 'Scooting', emoji: '🛴' },
  { id: 'sport', label: 'Sport', emoji: '⚽' },
  { id: 'walking', label: 'Walking', emoji: '🚶' },
  { id: 'hanging-out', label: 'Hanging out', emoji: '🤙' },
  { id: 'cycling', label: 'Cycling', emoji: '🚲' },
  { id: 'park', label: 'Park / playing', emoji: '🛝' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊' },
  { id: 'exploring', label: 'Exploring', emoji: '🧭' },
];

export const OUTSIDE_EMOJI = '🌳';

export function findCategory(id?: string): Category | undefined {
  if (!id) return undefined;
  return CATEGORIES.find((c) => c.id === id);
}
