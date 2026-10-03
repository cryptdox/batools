import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import type { PfRow } from './portfolio';

// Organization website (org_) rows belong to the signed-in user's IAM realm:
// every realm is its own organization. `created_by` / `updated_by` record the
// signed-in IAM user. The public site reads the rows of one fixed org id.

/** Public bucket from migration 030; files live under `<org_id>/…`. */
export const ORG_BUCKET = 'org';

/** Everything an org_ PfListEditor needs to scope, stamp and upload. */
export function useOrgEditor() {
  const { orgId, user } = useAuth();
  const userId = user?.userId ?? null;
  return useMemo(() => ({
    orgId,
    userId,
    owner: { column: 'org_id', id: orgId },
    auditUserId: userId,
    upload: orgId ? { bucket: ORG_BUCKET, folder: `${orgId}/images` } : undefined,
  }), [orgId, userId]);
}

/** Select options from rows already loaded by another editor on the page. */
export const optionsFrom = (rows: PfRow[], label: string) =>
  rows.map(r => ({ value: r.id, label: String(r[label] ?? '') }));

/** id → label, for showing a foreign key in a row summary. */
export const labelsFrom = (rows: PfRow[], label: string): Record<string, string> =>
  Object.fromEntries(rows.map(r => [r.id, String(r[label] ?? '')]));

export const formatDate = (d: unknown) => (typeof d === 'string' && d ? d.slice(0, 10) : '');

/** All rows of one org_ table for the signed-in org, e.g. to fill a select. */
export function useOrgRows(table: string, orderBy = 'sort_order'): PfRow[] {
  const { orgId } = useAuth();
  const [rows, setRows] = useState<PfRow[]>([]);
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void supabase.from(table).select('*').eq('org_id', orgId).order(orderBy).then(({ data, error }) => {
      if (error) console.error(error);
      if (!cancelled) setRows((data ?? []) as PfRow[]);
    });
    return () => { cancelled = true; };
  }, [table, orderBy, orgId]);
  return rows;
}
