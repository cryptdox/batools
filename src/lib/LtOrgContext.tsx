import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { PAGE_RESOURCES, useAccess } from './permissions';

// Late Tracker data belongs to an organization (lt_organizations, migration 054).
// This loads the organizations the signed-in user belongs to and which one they
// are working in. The database works out who the caller is from their IAM
// token (lt_my_organizations / lt_create_organization), not from anything sent here.

export type LtOrganization = {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  is_owner: boolean;
  created_at: string;
};

export type LtOrganizationInput = {
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
};

type LtOrgContextValue = {
  orgs: LtOrganization[];
  /** The organization Late Tracker pages work in; null until loaded or when the user has none. */
  current: LtOrganization | null;
  state: 'idle' | 'loading' | 'ready' | 'error';
  /** Why loading failed, as the database reported it. */
  error: string | null;
  select: (id: string) => void;
  reload: () => Promise<void>;
  /** Creates an organization with the user as its owner, and switches to it. */
  create: (input: LtOrganizationInput) => Promise<LtOrganization>;
};

const LtOrgContext = createContext<LtOrgContextValue | null>(null);

const LT_RESOURCES = Object.entries(PAGE_RESOURCES).filter(([path]) => path.startsWith('/late-tracker')).map(([, r]) => r);
const storageKey = (userId: string) => `lt-current-org:${userId}`;

export const LtOrgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { canRead, accessState } = useAccess();
  const userId = user?.userId ?? null;
  const allowed = accessState === 'ready' && LT_RESOURCES.some(canRead);

  const [orgs, setOrgs] = useState<LtOrganization[]>([]);
  const [state, setState] = useState<LtOrgContextValue['state']>('idle');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<LtOrganization[]> => {
    const { data, error } = await supabase.rpc('lt_my_organizations');
    if (error) throw error;
    return (data ?? []) as LtOrganization[];
  }, []);

  const reload = useCallback(async () => {
    if (!userId) return;
    setState('loading');
    setError(null);
    try {
      const list = await load();
      setOrgs(list);
      let stored: string | null = null;
      try { stored = localStorage.getItem(storageKey(userId)); } catch { /* storage unavailable */ }
      setCurrentId(list.find(o => o.id === stored)?.id ?? list[0]?.id ?? null);
      setState('ready');
    } catch (e) {
      console.error(e);
      // supabase-js errors are plain objects with a message, not Error instances.
      setError((e as { message?: string })?.message ?? String(e));
      setState('error');
    }
  }, [load, userId]);

  useEffect(() => {
    if (allowed) void reload();
    else { setOrgs([]); setCurrentId(null); setState('idle'); }
  }, [allowed, reload]);

  const select = useCallback((id: string) => {
    setCurrentId(id);
    if (userId) try { localStorage.setItem(storageKey(userId), id); } catch { /* storage unavailable */ }
  }, [userId]);

  const create = useCallback(async (input: LtOrganizationInput) => {
    const { data, error } = await supabase.rpc('lt_create_organization', {
      p_name: input.name,
      p_description: input.description ?? null,
      p_email: input.email ?? null,
      p_phone: input.phone ?? null,
      p_address: input.address ?? null,
      p_website: input.website ?? null,
    });
    if (error) throw error;
    const list = await load();
    const created = list.find(o => o.id === data);
    if (!created) throw new Error('The organization was created but could not be loaded.');
    setOrgs(list);
    select(created.id);
    setState('ready');
    return created;
  }, [load, select]);

  const current = useMemo(() => orgs.find(o => o.id === currentId) ?? null, [orgs, currentId]);

  return (
    <LtOrgContext.Provider value={{ orgs, current, state, error, select, reload, create }}>
      {children}
    </LtOrgContext.Provider>
  );
};

export const useLtOrg = () => {
  const ctx = useContext(LtOrgContext);
  if (!ctx) throw new Error('useLtOrg must be used within an LtOrgProvider');
  return ctx;
};

/** The current organization's id, for new Late Tracker rows. Pages render inside LtOrgGate, so it is set. */
export const useLtOrgId = () => useLtOrg().current?.id ?? null;
