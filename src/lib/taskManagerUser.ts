// Task Manager came from a standalone app that used Supabase Auth, where every
// row was scoped to the signed-in user via `user_id` / `created_by`.
//
// Bangla Tools has no Supabase Auth: it gates the UI with a static
// email/password from .env and talks to the database with the anon key. There
// is no `auth.uid()` to scope by, so the feature runs under a single static
// identity instead. The ported pages use this in place of the old
// `useAuth().user.id`.
//
// The value must match what migration 012 wrote into the copied rows, or the
// app's queries will filter that data straight back out of view.
export const TM_USER_ID =
  import.meta.env.VITE_TM_USER_ID || '00000000-0000-0000-0000-000000000111';

// Exported as a single frozen object rather than constructed per render: the
// ported pages carry `[user]` in their effect dependency arrays, so a fresh
// object each render would re-fire those effects forever.
export const tmUser = Object.freeze({ id: TM_USER_ID });
