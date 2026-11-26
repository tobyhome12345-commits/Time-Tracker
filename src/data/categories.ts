import type { Kind } from './types';

export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Record<Kind, Category[]> = {
  inside: [
    { id: 'gaming', label: 'Gaming', emoji: '🎮' },
    { id: 'youtube', label: 'YouTube', emoji: '▶️' },
    { id: 'schoolwork', label: 'Schoolwork', emoji: '📚' },
    { id: 'tv', label: 'TV', emoji: '📺' },
  ],
  outside: [
    { id: 'scooting', label: 'Scooting', emoji: '🛴' },
    { id: 'sport', label: 'Sport', emoji: '⚽' },
    { id: 'walking', label: 'Walking', emoji: '🚶' },
    { id: 'hanging-out', label: 'Hanging out', emoji: '🤙' },
  ],
};

export const KIND_LABEL: Record<Kind, string> = { inside: 'Inside', outside: 'Outside' };
export const KIND_EMOJI: Record<Kind, string> = { inside: '🏠', outside: '🌳' };

export function findCategory(kind: Kind, id?: string): Category | undefined {
  if (!id) return undefined;
  return CATEGORIES[kind].find((c) => c.id === id);
}
