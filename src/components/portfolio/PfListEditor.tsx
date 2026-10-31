import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, ArrowUp, ArrowDown, Eye, EyeOff, Search, Inbox, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, formFromRow, isFormComplete, loadPfVersions, rowFromShownForm, shownFields, usePfUserId, type PfField, type PfFormValues, type PfRow } from '../../lib/portfolio';
import { Button, Badge } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PfFieldInput, pfInputClass, removeUploads, type PfUploadTarget } from './PfFieldInput';
import { inVersionTab, usePfVersionTab } from '../../lib/pfVersionTab';

/** Rows that belong to a row of these tables and are copied with it on Clone. */
const CLONE_CHILDREN: Record<string, { table: string; column: string }[]> = {
  pf_about_sections: [{ table: 'pf_about_blocks', column: 'section_id' }],
  pf_projects: [{ table: 'pf_case_study_sections', column: 'project_id' }, { table: 'pf_challenges', column: 'project_id' }],
  pf_publications: [{ table: 'pf_case_study_sections', column: 'publication_id' }, { table: 'pf_challenges', column: 'publication_id' }],
  pf_posts: [{ table: 'pf_post_blocks', column: 'post_id' }],
};

/** Columns a copy never takes from its original. */
const withoutIdentity = ({ id: _id, created_at: _c, updated_at: _u, ...rest }: Record<string, unknown>) => rest;

/** "Title v3" → "Title"; "my-post-v3" → "my-post". */
const baseLabel = (s: string) => s.replace(/\s+v\d+$/, '');
const baseSlug = (s: string) => s.replace(/-v\d+$/, '');

type Props = {
  table: string;
  /** Translation keys. */
  title: string;
  subtitle?: string;
  fields: PfField[];
  /** What a row shows in the list. */
  renderRow: (row: PfRow) => ReactNode;
  /** Extra equality filters, also written onto new rows (e.g. a parent id). */
  scope?: Record<string, string>;
  /** Off for tables without sort_order / is_visible (labels). */
  ordered?: boolean;
  /** Columns to sort by, in order; `-col` sorts descending. Defaults to sort_order (or created_at). */
  orderBy?: string[];
  /** Column + id the rows belong to; defaults to the signed-in user's `user_id`. */
  owner?: { column: string; id: string | null };
  /** Written as `updated_by` on every save, and `created_by` on new rows. */
  auditUserId?: string | null;
  /** Show/hide toggle (needs is_visible); defaults to `ordered`. */
  hideable?: boolean;
  /** Translation key for the delete confirmation's warning. */
  deleteHint?: string;
  /** Where fields with `upload` store their files. */
  upload?: PfUploadTarget;
  /** Called with the full row list after every load. */
  onRowsChange?: (rows: PfRow[]) => void;
  searchable?: boolean;
  /** Extra buttons per row, before edit/delete. */
  rowActions?: (row: PfRow) => ReactNode;
  /** Highlights the row (e.g. the one whose children are shown below). */
  isRowSelected?: (row: PfRow) => boolean;
  /** Bump to reload the rows after they were changed elsewhere. */
  reloadSignal?: number;
  /** Last say over a row before it is saved (derived columns, e.g. a slug from the title). */
  transform?: (row: Record<string, unknown>, values: PfFormValues) => Record<string, unknown>;
  /** Extra buttons in the list's header, before Add. */
  headerActions?: ReactNode;
  /** Runs after a row is saved (with the saved columns); a returned message is shown. */
  afterSave?: (row: Record<string, unknown>) => Promise<string | void>;
  /** The table has a `versions` column (063): adds the version picker and shows each row's versions. */
  versioned?: boolean;
  /** A Clone button per row: a copy (with its child rows) named "… v1", "… v2", … */
  cloneable?: boolean;
};

/**
 * Generic editor for one pf_ list table, scoped to the signed-in user:
 * add / edit / delete, and for ordered tables move up/down and show/hide.
 * Files uploaded through `upload` fields are cleaned up: a replaced file is
 * deleted once the new one is saved, uploads from a cancelled form are
 * deleted, and deleting a row deletes its files.
 */
export const PfListEditor = ({
  table, title, subtitle, fields: baseFields, renderRow, versioned, cloneable, scope, ordered = true, orderBy, searchable, rowActions, isRowSelected,
  owner, auditUserId, hideable = ordered, deleteHint = 'pf.common.deleteHint', upload, onRowsChange, reloadSignal, transform, headerActions, afterSave,
}: Props) => {
  const { t } = useLanguage();
  const pfUserId = usePfUserId();
  const ownerColumn = owner?.column ?? 'user_id';
  const ownerId = owner ? owner.id : pfUserId;
  // Kept in a ref so a new callback each render doesn't refetch.
  const onRowsChangeRef = useRef(onRowsChange);
  useEffect(() => { onRowsChangeRef.current = onRowsChange; });
  // The owner's versions, offered as the `versions` field; none yet means no picker.
  const [versions, setVersions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (versioned && pfUserId) void loadPfVersions(pfUserId).then(setVersions);
  }, [versioned, pfUserId]);
  const fields = useMemo<PfField[]>(() => (versions.length
    ? [...baseFields, { name: 'versions', label: 'pf.versions.field', type: 'multi', options: versions, hint: 'pf.versions.fieldHint' }]
    : baseFields), [baseFields, versions]);
  const [rows, setRows] = useState<PfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<PfRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [values, setValues] = useState<PfFormValues>({});
  const [saving, setSaving] = useState(false);
  /** Files uploaded while the form is open; whichever end up unused are deleted. */
  const formUploads = useRef<string[]>([]);
  const uploadFields = fields.filter(f => f.upload).map(f => f.name);

  const [toDelete, setToDelete] = useState<PfRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const scopeKey = JSON.stringify(scope ?? {});
  const sortKey = (orderBy ?? [ordered ? 'sort_order' : 'created_at']).join(',');

  /** Reads the rows; `quiet` keeps the list on screen (after a change) instead of showing Loading. */
  const fetchRows = useCallback(async (quiet = false) => {
    if (!ownerId) return;
    if (!quiet) setLoading(true);
    try {
      let query = supabase.from(table).select('*').eq(ownerColumn, ownerId);
      for (const [col, val] of Object.entries(JSON.parse(scopeKey) as Record<string, string>)) query = query.eq(col, val);
      for (const col of sortKey.split(',')) {
        query = col.startsWith('-') ? query.order(col.slice(1), { ascending: false }) : query.order(col, { ascending: true });
      }
      const { data, error } = await query;
      if (error) throw error;
      setRows((data ?? []) as PfRow[]);
      onRowsChangeRef.current?.((data ?? []) as PfRow[]);
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.loadError')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ownerColumn, ownerId, scopeKey, sortKey]);

  useEffect(() => { void fetchRows(); }, [fetchRows, reloadSignal]);

  // The page's version tab (PfVersionTabs) narrows a versioned list.
  const versionTab = usePfVersionTab();
  const activeTab = versioned && versions.some(v => v.value === versionTab) ? versionTab : 'all';
  const visibleRows = useMemo(() => {
    const known = new Set(versions.map(v => v.value));
    const inTab = rows.filter(r => inVersionTab(r, activeTab, known));
    const needle = search.trim().toLowerCase();
    if (!needle) return inTab;
    return inTab.filter(r => Object.values(r).some(v =>
      (Array.isArray(v) ? v.join(' ') : String(v ?? '')).toLowerCase().includes(needle)));
  }, [rows, search, activeTab, versions]);

  const openAdd = () => {
    formUploads.current = [];
    setEditing(null);
    // Added under a version tab: starts in that version.
    setValues({ ...formFromRow(fields, null), ...(activeTab !== 'all' ? { versions: activeTab } : {}) });
    setIsModalOpen(true);
  };

  const openEdit = (row: PfRow) => {
    formUploads.current = [];
    setEditing(row);
    setValues(formFromRow(fields, row));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!ownerId || !isFormComplete(shownFields(fields, values), values)) return;
    setSaving(true);
    try {
      const payload = {
        ...(transform ? transform(rowFromShownForm(fields, values), values) : rowFromShownForm(fields, values)),
        updated_at: new Date().toISOString(),
        ...(auditUserId ? { updated_by: auditUserId } : {}),
      };
      const { error } = editing
        ? await supabase.from(table).update(payload).eq('id', editing.id).eq(ownerColumn, ownerId)
        : await supabase.from(table).insert([{
            ...payload,
            ...scope,
            [ownerColumn]: ownerId,
            ...(auditUserId ? { created_by: auditUserId } : {}),
            // New rows go to the end of the list.
            ...(ordered ? { sort_order: Math.max(0, ...rows.map(r => Number(r.sort_order) || 0)) + 1 } : {}),
          }]);
      if (error) throw error;
      if (upload) {
        // Everything uploaded this time plus the file the row had, minus what it keeps now.
        const kept = new Set(uploadFields.map(name => (payload as Record<string, unknown>)[name]));
        const candidates = [...formUploads.current, ...uploadFields.map(name => editing?.[name] as string | null)];
        await removeUploads(upload, await unshared(candidates.filter(url => !kept.has(url))));
      }
      formUploads.current = [];
      const note = afterSave ? await afterSave(payload).catch(e => { console.error(e); return undefined; }) : undefined;
      await fetchRows(true);
      setIsModalOpen(false);
      toast.success(editing ? t('pf.common.updated') : t('pf.common.added'));
      if (note) toast.info(note);
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete || !ownerId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from(table).delete().eq('id', toDelete.id).eq(ownerColumn, ownerId);
      if (error) throw error;
      if (upload) await removeUploads(upload, await unshared(uploadFields.map(name => toDelete[name] as string | null), toDelete.id));
      await fetchRows(true);
      setToDelete(null);
      toast.success(t('pf.common.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.deleteError')));
    } finally {
      setDeleting(false);
    }
  };

  const update = async (changes: { id: string; patch: Record<string, unknown> }[]) => {
    if (!ownerId) return;
    setBusy(true);
    // Shown at once; the quiet re-read afterwards confirms (or undoes) it.
    setRows(prev => prev.map(r => {
      const change = changes.find(c => c.id === r.id);
      return change ? { ...r, ...change.patch } : r;
    }));
    try {
      for (const { id, patch } of changes) {
        const audited = auditUserId ? { ...patch, updated_by: auditUserId, updated_at: new Date().toISOString() } : patch;
        const { error } = await supabase.from(table).update(audited).eq('id', id).eq(ownerColumn, ownerId);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      await fetchRows(true);
      setBusy(false);
    }
  };

  // Rewrites the whole order as 1..n so rows that share a sort_order (or
  // have gaps) still move exactly one place.
  // Moves among the rows on screen (a version tab hides some): it trades
  // places with its visible neighbour.
  const move = (row: PfRow, delta: -1 | 1) => {
    const neighbour = visibleRows[visibleRows.indexOf(row) + delta];
    if (!neighbour) return;
    const index = rows.indexOf(row), target = rows.indexOf(neighbour);
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    void update(next
      .map((r, i) => ({ id: r.id, patch: { sort_order: i + 1 }, changed: Number(r.sort_order) !== i + 1 }))
      .filter(c => c.changed)
      .map(({ id, patch }) => ({ id, patch })));
  };

  /** Of these files, the ones no other row of the table still points at (a clone shares its original's files). */
  const unshared = async (urls: (string | null | undefined)[], rowId?: string) => {
    const result: string[] = [];
    for (const url of new Set(urls.filter((u): u is string => !!u))) {
      let used = false;
      for (const col of uploadFields) {
        let query = supabase.from(table).select('id', { head: true, count: 'exact' }).eq(col, url);
        if (rowId) query = query.neq('id', rowId);
        const { count } = await query;
        if (count) { used = true; break; }
      }
      if (!used) result.push(url);
    }
    return result;
  };

  /** Copies a row and its child rows; the copy is named "… vN" (the next free N) and goes last. */
  const cloneRow = async (row: PfRow) => {
    if (!ownerId) return;
    setBusy(true);
    try {
      const label = baseFields.find(f => f.type === 'i18n') ?? baseFields.find(f => f.type === 'text');
      const labelKey = label ? (label.type === 'i18n' ? `${label.name}_en` : label.name) : null;
      const base = labelKey ? baseLabel(String(row[labelKey] ?? '')) : '';
      const taken = labelKey
        ? rows.map(r => String(r[labelKey] ?? '').match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+v(\\d+)$`))?.[1]).filter(Boolean).map(Number)
        : [];
      const n = Math.max(0, ...taken) + 1;

      const copy: Record<string, unknown> = withoutIdentity(row);
      if (label) {
        const keys = label.type === 'i18n' ? [`${label.name}_en`, `${label.name}_bn`] : [label.name];
        for (const k of keys) if (typeof copy[k] === 'string' && copy[k]) copy[k] = `${baseLabel(copy[k] as string)} v${n}`;
      }
      // Unique per owner: the copy gets its own.
      if (typeof copy.slug === 'string' && copy.slug) copy.slug = `${baseSlug(copy.slug)}-v${n}`;
      if (copy.is_default === true) copy.is_default = false;
      if (ordered) copy.sort_order = Math.max(0, ...rows.map(r => Number(r.sort_order) || 0)) + 1;
      if (auditUserId) Object.assign(copy, { created_by: auditUserId, updated_by: auditUserId });

      const { data, error } = await supabase.from(table).insert([copy]).select('id').single();
      if (error) throw error;
      for (const child of CLONE_CHILDREN[table] ?? []) {
        const { data: kids, error: kidsError } = await supabase.from(child.table).select('*').eq(child.column, row.id);
        if (kidsError) throw kidsError;
        if (kids?.length) {
          const { error: insertError } = await supabase.from(child.table)
            .insert(kids.map(k => ({ ...withoutIdentity(k), [child.column]: data.id })));
          if (insertError) throw insertError;
        }
      }
      await fetchRows(true);
      toast.success(t('pf.common.cloned'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setBusy(false);
    }
  };

  /** Closes the form without saving: its uploads were never used. */
  const closeForm = () => {
    if (saving) return;
    if (upload && formUploads.current.length) void removeUploads(upload, formUploads.current);
    formUploads.current = [];
    setIsModalOpen(false);
  };

  const iconButton = 'p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t(title)}</h3>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{t(subtitle)}</p>}
        </div>
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('pf.common.search')}
                className={`${pfInputClass} h-9 pl-8 w-48`}
              />
            </div>
          )}
          {headerActions}
          <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" /> {t('pf.common.add')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : visibleRows.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Inbox size={28} className="mx-auto mb-2 text-gray-400" />
          {t('pf.common.empty')}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {visibleRows.map(row => {
            const index = visibleRows.indexOf(row);
            const hidden = hideable && row.is_visible === false;
            return (
              <li
                key={row.id}
                className={`flex items-start gap-3 p-4 transition-colors ${
                  isRowSelected?.(row) ? 'bg-primary/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                } ${hidden ? 'opacity-60' : ''}`}
              >
                <div className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300">
                  {renderRow(row)}
                  {hidden && <Badge variant="muted" className="mt-1 inline-block">{t('pf.common.hidden')}</Badge>}
                  {versions.length > 0 && Array.isArray(row.versions) && (row.versions as string[]).some(id => versions.some(v => v.value === id)) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {versions.filter(v => (row.versions as string[]).includes(v.value)).map(v => <Badge key={v.value} variant="default">{v.label}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {rowActions?.(row)}
                  {cloneable && (
                    <button className={iconButton} disabled={busy} onClick={() => void cloneRow(row)} title={t('pf.common.clone')}>
                      <Copy size={16} />
                    </button>
                  )}
                  {ordered && !search && (
                    <>
                      <button className={iconButton} disabled={busy || index === 0} onClick={() => move(row, -1)} title={t('pf.common.moveUp')}>
                        <ArrowUp size={16} />
                      </button>
                      <button className={iconButton} disabled={busy || index === visibleRows.length - 1} onClick={() => move(row, 1)} title={t('pf.common.moveDown')}>
                        <ArrowDown size={16} />
                      </button>
                    </>
                  )}
                  {hideable && (
                    <button
                      className={iconButton}
                      disabled={busy}
                      onClick={() => void update([{ id: row.id, patch: { is_visible: hidden } }])}
                      title={hidden ? t('pf.common.show') : t('pf.common.hide')}
                    >
                      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                  <button className={iconButton} onClick={() => openEdit(row)} title={t('pf.common.edit')}>
                    <Pencil size={16} />
                  </button>
                  <button className={iconButton} onClick={() => setToDelete(row)} title={t('pf.common.delete')}>
                    <Trash2 size={16} className="text-danger" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeForm}
        title={`${editing ? t('pf.common.edit') : t('pf.common.add')} · ${t(title)}`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          {shownFields(fields, values).map(f => (
            <PfFieldInput
              key={f.name}
              field={f}
              values={values}
              upload={upload}
              onUploaded={url => { formUploads.current.push(url); }}
              onChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
            />
          ))}
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={closeForm} disabled={saving}>{t('pf.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !isFormComplete(shownFields(fields, values), values)}>
              {saving ? t('pf.common.saving') : t('pf.common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pf.common.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700 dark:text-gray-300 min-w-0">{renderRow(toDelete)}</div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t(deleteHint)}</p>
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>{t('pf.common.cancel')}</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? t('pf.common.deleting') : t('pf.common.delete')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

/** Two-line row summary used by most pf_ lists. */
export const PfRowText = ({ primary, secondary, extra }: { primary: ReactNode; secondary?: ReactNode; extra?: ReactNode }) => (
  <div className="min-w-0">
    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{primary || '—'}</div>
    {secondary && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{secondary}</div>}
    {extra && <div className="mt-1 flex flex-wrap gap-1">{extra}</div>}
  </div>
);
