// This build of Late Tracker serves one organization: GHL. Since migration 054
// every lt_ row carries an organization_id, so every Late Tracker request this
// app makes is pinned to GHL here, in the Supabase client's fetch, rather than
// in each page:
//   - reads, updates and deletes on lt_ tables get `organization_id=eq.<GHL>`;
//   - inserts / upserts get `organization_id` set on every row;
//   - waive_all_remaining() is limited to GHL (record_attendance and
//     add_punishment_transaction take the organization from the member /
//     punishment in the database).
// If the organization can't be resolved the request fails; it is never sent unscoped.
//
// VITE_LT_ORGANIZATION_ID picks the organization explicitly; without it, the
// oldest organization named GHL is used (the one migration 054 created).

const ORG_NAME = 'GHL';
/** Organization tables themselves are not scoped. */
const UNSCOPED = new Set(['lt_organizations', 'lt_organization_users']);
/** Functions that take the organization as an argument. */
const RPC_ORG_PARAM: Record<string, string> = { waive_all_remaining: 'p_organization_id' };

let orgIdPromise: Promise<string> | null = null;

function resolveOrgId(supabaseUrl: string, key: string, baseFetch: typeof fetch): Promise<string> {
  const configured = (import.meta.env.VITE_LT_ORGANIZATION_ID as string | undefined)?.trim();
  if (configured) return Promise.resolve(configured);
  orgIdPromise ??= (async () => {
    const url = `${supabaseUrl}/rest/v1/lt_organizations?select=id&name=eq.${ORG_NAME}&order=created_at.asc&limit=1`;
    const res = await baseFetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const rows = res.ok ? ((await res.json()) as { id: string }[]) : [];
    if (!rows[0]?.id) throw new Error(`Late Tracker organization "${ORG_NAME}" was not found.`);
    return rows[0].id;
  })().catch(err => {
    orgIdPromise = null; // try again on the next request
    throw err;
  });
  return orgIdPromise;
}

const failed = (message: string) =>
  new Response(JSON.stringify({ code: 'PGRST000', message, details: null, hint: null }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

/** Wraps fetch so every Late Tracker request is limited to the one organization. */
export function scopeToLtOrganization(supabaseUrl: string, key: string, baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const match = url.pathname.match(/\/rest\/v1\/(rpc\/)?([a-z0-9_]+)$/);
    if (!match) return baseFetch(input, init);
    const [, rpc, name] = match;
    const rpcParam = rpc ? RPC_ORG_PARAM[name] : undefined;
    const scoped = !rpc && name.startsWith('lt_') && !UNSCOPED.has(name);
    if (!scoped && !rpcParam) return baseFetch(input, init);

    let orgId: string;
    try {
      orgId = await resolveOrgId(supabaseUrl, key, baseFetch);
    } catch (err) {
      return failed(err instanceof Error ? err.message : 'Late Tracker organization is unavailable.');
    }

    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    let body = init?.body;
    if (body != null && typeof body !== 'string') return failed('Unexpected Late Tracker request body.');

    if (rpcParam) {
      const args = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      body = JSON.stringify({ ...args, [rpcParam]: orgId });
    } else if (method === 'POST') {
      // Insert / upsert: stamp every row, and keep it in the column list supabase-js sends for arrays.
      const rows = body ? JSON.parse(body) : {};
      const stamp = (row: Record<string, unknown>) => ({ ...row, organization_id: orgId });
      body = JSON.stringify(Array.isArray(rows) ? rows.map(stamp) : stamp(rows));
      const columns = url.searchParams.get('columns');
      if (columns && !columns.split(',').some(c => c.replace(/"/g, '') === 'organization_id')) {
        url.searchParams.set('columns', `${columns},"organization_id"`);
      }
    } else {
      // GET / HEAD / PATCH / DELETE: only this organization's rows.
      url.searchParams.append('organization_id', `eq.${orgId}`);
      if (body && method === 'PATCH') {
        const patch = JSON.parse(body) as Record<string, unknown>;
        delete patch.organization_id; // rows never move to another organization
        body = JSON.stringify(patch);
      }
    }

    return baseFetch(url.toString(), { ...init, method, headers: init?.headers ?? request?.headers, body });
  };
}
