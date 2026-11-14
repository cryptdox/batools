import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, ArrowUp, ArrowDown, Eye, EyeOff, Search, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { isErrorKey, useIsLanguages, useIsReviewer, useIsUserId, type IsRow } from '../../lib/islamicStudio';
import { Button, Badge } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { PfPager, pageOf } from '../portfolio/PfPager';
import { IsFieldInput, isFormComplete, isFormFromRow, isRowFromForm, type IsField, type IsFormValues } from './IsFieldInput';

type Props = {
  table: string;
  /** Translation keys. */
  title: string;
  subtitle?: string;
  fields: IsField[];
  /** What a row shows in the list; `patch` saves a change straight away (e.g. a status picker). */
  renderRow: (row: IsRow, patch: (changes: IsRow) => void) => ReactNode;
  /** Primary key columns (default id). */
  keys?: string[];
  /** PostgREST select, e.g. '*, is_dua_category_items(category_id)'. */
  select?: string;
  /** Equality filters, also written onto new rows (e.g. a parent id). */
  scope?: Record<string, string>;
  /** Has sort_order: move up / down, new rows go last. */
  ordered?: boolean;
  /** Has is_active: an eye toggle per row. Defaults to `ordered`. */
  activeToggle?: boolean;
  /** Has review_status (+ reviewed_by / reviewed_at): see `save`. */
  reviewed?: boolean;
  /** Columns to sort by; `-col` sorts descending. Defaults to sort_order. */
  orderBy?: string[];
  canAdd?: boolean;
  canDelete?: boolean;
  searchable?: boolean;
  pageSize?: number;
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
  /** Form values for a new row (keys as in the form). */
  defaults?: IsFormValues;
  /** Fills in form values from a loaded row that `fields` can't (e.g. categories from a join). */
  formFromRow?: (row: IsRow) => IsFormValues;
  /** Last say over the columns before saving. */
  transform?: (row: IsRow, values: IsFormValues) => IsRow;
  /** Runs after a save with the saved row (including its keys). */
  afterSave?: (row: IsRow, values: IsFormValues) => Promise<void>;
  rowActions?: (row: IsRow, patch: (changes: IsRow) => void) => ReactNode;
  reloadSignal?: number;
  onRowsChange?: (rows: IsRow[]) => void;
  /** Which audit columns the table has: updated_by only (default), created_by too, or none. */
  audited?: 'updated' | 'both' | 'none';
};

const keyOf = (row: IsRow, keys: string[]) => keys.map(k => String(row[k])).join('|');

/**
 * Editor for one is_ table: list, add / edit / delete, and where the table has
 * them, order (sort_order) and on/off (is_active). Multilingual fields are
 * JSONB per language, with one input per active is_languages row.
 * Religious content (`reviewed`): only a reviewer may set review_status; an
 * edit by anyone else sends the row back to review, so approved text can't
 * change unseen.
 */
export const IsListEditor = ({
  table, title, subtitle, fields, renderRow, keys = ['id'], select = '*', scope, ordered = true, activeToggle = ordered, reviewed,
  orderBy, canAdd = true, canDelete = true, searchable, pageSize, filters, defaults, formFromRow, transform, afterSave, rowActions,
  reloadSignal, onRowsChange, audited = 'updated',
}: Props) => {
  const { t } = useLanguage();
  const userId = useIsUserId();
  const isReviewer = useIsReviewer();
  const languages = useIsLanguages();
  const languageCodes = useMemo(() => languages.map(l => l.code), [languages]);
  const [rows, setRows] = useState<IsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  const [editing, setEditing] = useState<IsRow | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<IsFormValues>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<IsRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formFields = useMemo<IsField[]>(() => (reviewed && isReviewer
    ? [...fields, {
        name: 'review_status', label: 'is.review.status', type: 'select', options: [
          { value: 'draft', label: 'is.review.draft' }, { value: 'in_review', label: 'is.review.in_review' },
          { value: 'approved', label: 'is.review.approved' }, { value: 'rejected', label: 'is.review.rejected' },
        ],
      }]
    : fields), [fields, reviewed, isReviewer]);

  const scopeKey = JSON.stringify(scope ?? {});
  const sortKey = (orderBy ?? (ordered ? ['sort_order'] : keys)).join(',');
  const keysKey = keys.join(',');

  const fail = useCallback((e: unknown, fallback: string) => {
    console.error(e);
    const known = isErrorKey(e);
    toast.error(known ? t(known) : errorMessage(e, t(fallback)));
  }, [t]);

  const fetchRows = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      let query = supabase.from(table).select(select);
      for (const [col, val] of Object.entries(JSON.parse(scopeKey) as Record<string, string>)) query = query.eq(col, val);
      for (const col of sortKey.split(',')) {
        query = col.startsWith('-') ? query.order(col.slice(1), { ascending: false }) : query.order(col, { ascending: true });
      }
      const { data, error } = await query;
      if (error) throw error;
      const list = (data ?? []) as unknown as IsRow[];
      setRows(list);
      onRowsChange?.(list);
    } catch (e) {
      fail(e, 'pf.common.loadError');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, scopeKey, sortKey, fail]);

  useEffect(() => { void fetchRows(); }, [fetchRows, reloadSignal]);

  const visibleRows = useMemo(() => {
    const narrowed = rows.filter(r => Object.entries(picked).every(([col, value]) => !value || String(r[col] ?? '') === value));
    const needle = search.trim().toLowerCase();
    if (!needle) return narrowed;
    return narrowed.filter(r => JSON.stringify(r).toLowerCase().includes(needle));
  }, [rows, picked, search]);
  const paged = pageOf(visibleRows, page, pageSize ?? Math.max(1, visibleRows.length));

  const match = (row: IsRow) => Object.fromEntries(keys.map(k => [k, row[k]]));

  const audit = (row: IsRow, isNew: boolean): IsRow => ({
    ...row,
    ...(userId && audited !== 'none' ? { updated_by: userId } : {}),
    ...(userId && isNew && audited === 'both' ? { created_by: userId } : {}),
  });

  /** Review rules for a save: a reviewer's pick stands (and is signed); anyone else sends it to review. */
  const withReview = (row: IsRow, before: IsRow | null): IsRow => {
    if (!reviewed) return row;
    if (!isReviewer) return { ...row, review_status: 'in_review', reviewed_by: null, reviewed_at: null };
    const status = row.review_status ?? before?.review_status ?? 'draft';
    if (status === 'approved' && before?.review_status !== 'approved') return { ...row, reviewed_by: userId, reviewed_at: new Date().toISOString() };
    return row;
  };

  const openAdd = () => {
    setEditing(null);
    setValues({ ...isFormFromRow(formFields, null, languageCodes), ...defaults });
    setIsOpen(true);
  };

  const openEdit = (row: IsRow) => {
    setEditing(row);
    setValues({ ...isFormFromRow(formFields, row, languageCodes), ...formFromRow?.(row) });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!isFormComplete(formFields, values)) return;
    setSaving(true);
    try {
      let row: IsRow;
      try {
        row = isRowFromForm(formFields, values);
      } catch {
        toast.error(t('is.common.badJson'));
        return;
      }
      if (transform) row = transform(row, values);
      row = withReview(audit(row, !editing), editing);
      let saved: IsRow;
      if (editing) {
        const { data, error } = await supabase.from(table).update(row).match(match(editing)).select(keysKey).single();
        if (error) throw error;
        saved = { ...row, ...(data as unknown as IsRow) };
      } else {
        const next = ordered ? { sort_order: Math.max(0, ...rows.map(r => Number(r.sort_order) || 0)) + 1 } : {};
        const { data, error } = await supabase.from(table).insert([{ ...next, ...row, ...scope }]).select(keysKey).single();
        if (error) throw error;
        saved = { ...row, ...(data as unknown as IsRow) };
      }
      if (afterSave) await afterSave(saved, values);
      await fetchRows(true);
      setIsOpen(false);
      toast.success(editing ? t('pf.common.updated') : t('pf.common.added'));
      if (reviewed && !isReviewer) toast.info(t('is.review.sentForReview'));
    } catch (e) {
      fail(e, 'pf.common.saveError');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from(table).delete().match(match(toDelete));
      if (error) throw error;
      await fetchRows(true);
      setToDelete(null);
      toast.success(t('pf.common.deleted'));
    } catch (e) {
      fail(e, 'pf.common.deleteError');
    } finally {
      setDeleting(false);
    }
  };

  /** Saves changes to rows at once; the list shows them first and the re-read confirms. */
  const update = async (changes: { row: IsRow; patch: IsRow }[]) => {
    setBusy(true);
    setRows(prev => prev.map(r => {
      const c = changes.find(x => keyOf(x.row, keys) === keyOf(r, keys));
      return c ? { ...r, ...c.patch } : r;
    }));
    try {
      for (const { row, patch } of changes) {
        const { error } = await supabase.from(table).update(audit(patch, false)).match(match(row));
        if (error) throw error;
      }
    } catch (e) {
      fail(e, 'pf.common.saveError');
    } finally {
      await fetchRows(true);
      setBusy(false);
    }
  };
  const patchRow = (row: IsRow) => (changes: IsRow) => void update([{ row, patch: changes }]);

  const move = (row: IsRow, delta: -1 | 1) => {
    const neighbour = visibleRows[visibleRows.indexOf(row) + delta];
    if (!neighbour) return;
    const next = [...rows];
    const a = next.indexOf(row), b = next.indexOf(neighbour);
    [next[a], next[b]] = [next[b], next[a]];
    setRows(next);
    void update(next
      .map((r, i) => ({ row: r, patch: { sort_order: i + 1 }, changed: Number(r.sort_order) !== i + 1 }))
      .filter(c => c.changed)
      .map(({ row: r, patch }) => ({ row: r, patch })));
  };

  const iconButton = 'p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none';
  const shown = formFields.filter(f => !f.when || f.when(values));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t(title)}</h3>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{t(subtitle)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters?.map(f => (
            <select
              key={f.name}
              value={picked[f.name] ?? ''}
              onChange={e => { setPicked(p => ({ ...p, [f.name]: e.target.value })); setPage(0); }}
              className={`${pfInputClass} h-9 w-auto`}
              title={t(f.label)}
            >
              <option value="">{t(f.label)}: {t('pf.common.filterAll')}</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          ))}
          {searchable && (
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder={t('pf.common.search')}
                className={`${pfInputClass} h-9 pl-8 w-48`}
              />
            </div>
          )}
          {canAdd && <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" /> {t('pf.common.add')}</Button>}
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
          {paged.slice.map(row => {
            const index = visibleRows.indexOf(row);
            const off = activeToggle && row.is_active === false;
            const status = reviewed ? String(row.review_status ?? 'draft') : null;
            return (
              <li key={keyOf(row, keys)} className={`flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${off ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300">
                  {renderRow(row, patchRow(row))}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {off && <Badge variant="muted">{t('is.common.off')}</Badge>}
                    {status && (
                      <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>
                        {t(`is.review.${status}`)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {rowActions?.(row, patchRow(row))}
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
                  {activeToggle && (
                    <button className={iconButton} disabled={busy} onClick={() => void update([{ row, patch: { is_active: off } }])} title={off ? t('is.common.turnOn') : t('is.common.turnOff')}>
                      {off ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                  <button className={iconButton} onClick={() => openEdit(row)} title={t('pf.common.edit')}>
                    <Pencil size={16} />
                  </button>
                  {canDelete && (
                    <button className={iconButton} onClick={() => setToDelete(row)} title={t('pf.common.delete')}>
                      <Trash2 size={16} className="text-danger" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pageSize && <PfPager page={paged.current} pages={paged.pages} onChange={setPage} />}

      <Modal isOpen={isOpen} onClose={() => !saving && setIsOpen(false)} title={`${editing ? t('pf.common.edit') : t('pf.common.add')} · ${t(title)}`} className="max-w-3xl">
        <div className="space-y-4">
          {reviewed && !isReviewer && (
            <p className="text-xs rounded-lg bg-warning/10 border border-warning/20 p-3 text-gray-700 dark:text-gray-300">{t('is.review.editorNote')}</p>
          )}
          {shown.map(f => (
            <IsFieldInput key={f.name} field={f} values={values} folder={table} onChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))} />
          ))}
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={saving}>{t('pf.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !isFormComplete(formFields, values)}>
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
              <div className="text-sm text-gray-700 dark:text-gray-300 min-w-0">{renderRow(toDelete, () => undefined)}</div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('is.common.deleteHint')}</p>
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

/** Two-line row summary. */
export const IsRowText = ({ primary, secondary, extra }: { primary: ReactNode; secondary?: ReactNode; extra?: ReactNode }) => (
  <div className="min-w-0">
    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{primary || '—'}</div>
    {secondary && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{secondary}</div>}
    {extra && <div className="mt-1 flex flex-wrap gap-1">{extra}</div>}
  </div>
);
