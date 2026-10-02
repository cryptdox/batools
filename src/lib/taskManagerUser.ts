import { useMemo } from 'react';
import { useAuth } from './AuthContext';

// Task Manager rows are scoped to the signed-in IAM user via `user_id` /
// `created_by`. The ported pages expect a `{ id }` user like the old
// `useAuth().user`, so this adapts the IAM session to that shape.
//
// Memoized on the id: the ported pages carry `[user]` in their effect
// dependency arrays, so a fresh object each render would re-fire those effects
// forever.
export function useTmUser(): { id: string } | null {
  const { user } = useAuth();
  const id = user?.userId ?? null;
  return useMemo(() => (id ? { id } : null), [id]);
}
