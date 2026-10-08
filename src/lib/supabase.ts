import { createClient } from '@supabase/supabase-js'
import { ensureSessionAccess, iamRefresh, isExpiringSoon, loadSession } from './iam'
import { allows, deniedResponse, requirementOf } from './dataAccess'

export type AttendanceState = 'NO_ENTRY' | 'ENTRY' | 'CONSIDER_ENTRY' | 'LEAVE'

export type TeamMemberType = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type TeamMember = {
  id: string
  name: string
  is_active: boolean
  is_deleted: boolean
  type_id: string | null
  created_at: string
  updated_at: string
}

export type AttendanceRecord = {
  id: string
  team_member_id: string
  attendance_date: string
  state: AttendanceState
  entry_time: string | null
  threshold_time_used: string | null
  created_at: string
  updated_at: string
}

export type AttendanceSetting = {
  id: string
  late_threshold: string
  punishment_amount: number
  effective_from: string
  created_at: string
  updated_at: string
}

export type Punishment = {
  id: string
  team_member_id: string
  attendance_record_id: string
  attendance_date: string
  entry_time: string
  threshold_time_used: string
  punishment_amount: number
  created_at: string
  updated_at: string
}

export type Spend = {
  id: string
  spend_date: string
  amount: number
  description: string
  created_at: string
  updated_at: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Please provide this in your .env file (Vite requires the VITE_ prefix).");
}

// Every request carries the signed-in user's IAM access token. The mp_ (music)
// tables and the music bucket only accept writes with a valid one (migration
// 047_mp_write_guard), because the anon key is public in the mumu app.
// A token about to expire is refreshed first (shared with AuthContext's refresh).
// Before anything is sent, the call is checked against the user's IAM permissions
// (lib/dataAccess.ts): a refused call never reaches Supabase and comes back as a 403.
const withIamToken: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  const need = requirementOf(url, method, new Headers(init?.headers).get('Prefer'));
  if (need) {
    const access = await ensureSessionAccess();
    // Signed out (the public Late Tracker board) may only read.
    const permitted = access ? allows(access.permissions ?? [], need) : need.action === 'READ' && !loadSession();
    if (!permitted) return deniedResponse(need);
  }
  const session = loadSession();
  let token = session?.accessToken;
  if (token && isExpiringSoon(token)) token = (await iamRefresh().catch(() => null))?.accessToken ?? token;
  if (!token) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set('x-iam-token', token);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch: withIamToken } })
