import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, ArrowUp, ArrowDown, Eye, EyeOff, Search, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, formFromRow, isFormComplete, rowFromForm, usePfUserId, type PfField, type PfFormValues, type PfRow } from '../../lib/portfolio';
import { Button, Badge } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PfFieldInput, pfInputClass } from './PfFieldInput';

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
  /** Columns to sort by, in order; defaults to sort_order (or created_at). */
  orderBy?: string[];
  searchable?: boolean;
  /** Extra buttons per row, before edit/delete. */
  rowActions?: (row: PfRow) => ReactNode;
  /** Highlights the row (e.g. the one whose children are shown below). */
  isRowSelected?: (row: PfRow) => boolean;
};

/**
 * Generic editor for one pf_ list table, scoped to the signed-in user:
 * add / edit / delete, and for ordered tables move up/down and show/hide.
 */
export const PfListEditor = ({
  table, title, subtitle, fields, renderRow, scope, ordered = true, orderBy, searchable, rowActions, isRowSelected,
}: Props) => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [rows, setRows] = useState<PfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<PfRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [values, setValues] = useState<PfFormValues>({});
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PfRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const scopeKey = JSON.stringify(scope ?? {});
  const sortKey = (orderBy ?? [ordered ? 'sort_order' : 'created_at']).join(',');

  const fetchRows = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let query = supabase.from(table).select('*').eq('user_id', userId);
      for (const [col, val] of Object.entries(JSON.parse(scopeKey) as Record<string, string>)) query = query.eq(col, val);
      for (const col of sortKey.split(',')) query = query.order(col, { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      setRows((data ?? []) as PfRow[]);
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.loadError')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, userId, scopeKey, sortKey]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r => Object.values(r).some(v =>
      (Array.isArray(v) ? v.join(' ') : String(v ?? '')).toLowerCase().includes(needle)));
  }, [rows, search]);

  const openAdd = () => {
    setEditing(null);
    setValues(formFromRow(fields, null));
    setIsModalOpen(true);
  };

  const openEdit = (row: PfRow) => {
    setEditing(row);
    setValues(formFromRow(fields, row));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!userId || !isFormComplete(fields, values)) return;
    setSaving(true);
    try {
      const payload = { ...rowFromForm(fields, values), updated_at: new Date().toISOString() };
      const { error } = editing
        ? await supabase.from(table).update(payload).eq('id', editing.id).eq('user_id', userId)
        : await supabase.from(table).insert([{
            ...payload,
            ...scope,
            user_id: userId,
            // New rows go to the end of the list.
            ...(ordered ? { sort_order: Math.max(0, ...rows.map(r => Number(r.sort_order) || 0)) + 1 } : {}),
          }]);
      if (error) throw error;
      await fetchRows();
      setIsModalOpen(false);
      toast.success(editing ? t('pf.common.updated') : t('pf.common.added'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete || !userId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from(table).delete().eq('id', toDelete.id).eq('user_id', userId);
      if (error) throw error;
      await fetchRows();
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
    if (!userId) return;
    setBusy(true);
    try {
      for (const { id, patch } of changes) {
        const { error } = await supabase.from(table).update(patch).eq('id', id).eq('user_id', userId);
        if (error) throw error;
      }
      await fetchRows();
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setBusy(false);
    }
  };

  // Rewrites the whole order as 1..n so rows that share a sort_order (or
  // have gaps) still move exactly one place.
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    void update(next
      .map((r, i) => ({ id: r.id, patch: { sort_order: i + 1 }, changed: Number(r.sort_order) !== i + 1 }))
      .filter(c => c.changed)
      .map(({ id, patch }) => ({ id, patch })));
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
            const index = rows.indexOf(row);
            const hidden = ordered && row.is_visible === false;
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
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {rowActions?.(row)}
                  {ordered && !search && (
                    <>
                      <button className={iconButton} disabled={busy || index === 0} onClick={() => move(index, -1)} title={t('pf.common.moveUp')}>
                        <ArrowUp size={16} />
                      </button>
                      <button className={iconButton} disabled={busy || index === rows.length - 1} onClick={() => move(index, 1)} title={t('pf.common.moveDown')}>
                        <ArrowDown size={16} />
                      </button>
                    </>
                  )}
                  {ordered && (
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
        onClose={() => !saving && setIsModalOpen(false)}
        title={`${editing ? t('pf.common.edit') : t('pf.common.add')} · ${t(title)}`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          {fields.map(f => (
            <PfFieldInput key={f.name} field={f} values={values} onChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))} />
          ))}
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>{t('pf.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !isFormComplete(fields, values)}>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pf.common.deleteHint')}</p>
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
