import { useSyncExternalStore } from 'react';

// The version tab picked on the Portfolio pages: one choice shared by every
// list on a page (and kept across pages and reloads). 'all' = every row.

const KEY = 'pf-version-tab';
const listeners = new Set<() => void>();

const read = (): string => {
  try { return localStorage.getItem(KEY) || 'all'; } catch { return 'all'; }
};
let current = read();

export function setPfVersionTab(value: string) {
  current = value;
  try { localStorage.setItem(KEY, value); } catch { /* private mode: keep it for this visit */ }
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const usePfVersionTab = () => useSyncExternalStore(subscribe, () => current);

/** A row belongs to version tab `tab` when it is in every version or tagged with it. */
export const inVersionTab = (row: Record<string, unknown>, tab: string, knownIds: Set<string>) => {
  if (tab === 'all') return true;
  const tags = (Array.isArray(row.versions) ? row.versions as string[] : []).filter(id => knownIds.has(id));
  return !tags.length || tags.includes(tab);
};
