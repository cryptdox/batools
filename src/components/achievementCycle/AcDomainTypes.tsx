import { useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import type { AcDomain, AcDomainType } from '../../lib/achievementCycle';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';

export const TYPE_COLORS = ['#6c5ce7', '#2a78d6', '#1baf7a', '#eb6834', '#e87ba4', '#eda100', '#008300', '#e34948'];

/** A domain type as a small coloured tag. */
export const AcTypeBadge = ({ type }: { type: AcDomainType }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white" style={{ background: type.color }}>
    <Tag size={10} />{type.name}
  </span>
);

/** Domain types: add / edit / delete. Deleting a type leaves its domains untyped. */
export const AcDomainTypes = ({ userId, types, domains, onChanged, can = { create: true, update: true, remove: true } }: {
  userId: string;
  types: AcDomainType[];
  domains: AcDomain[];
  onChanged: () => Promise<void>;
  /** What the user may do (IAM permissions); everything by default. */
  can?: { create: boolean; update: boolean; remove: boolean };
}) => {
  const { t } = useLanguage();
  const [form, setForm] = useState<AcDomainType | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TYPE_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AcDomainType | null>(null);

  const open = (x: AcDomainType | 'new') => {
    setForm(x);
    setName(x === 'new' ? '' : x.name);
    setDescription(x === 'new' ? '' : x.description ?? '');
    setColor(x === 'new' ? TYPE_COLORS[types.length % TYPE_COLORS.length] : x.color);
  };

  const save = async () => {
    if (!form || !name.trim()) return;
    setSaving(true);
    const row = { name: name.trim(), description: description.trim() || null, color, updated_at: new Date().toISOString() };
    const { error } = form === 'new'
      ? await supabase.from('ac_domain_types').insert([{ ...row, user_id: userId, sort_order: types.length + 1 }])
      : await supabase.from('ac_domain_types').update(row).eq('id', form.id).eq('user_id', userId);
    setSaving(false);
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    setForm(null);
    toast.success(form === 'new' ? t('pf.common.added') : t('pf.common.updated'));
    await onChanged();
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from('ac_domain_types').delete().eq('id', toDelete.id).eq('user_id', userId);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    setToDelete(null);
    toast.success(t('pf.common.deleted'));
    await onChanged();
  };

  const usedBy = (id: string) => domains.filter(d => d.type_id === id).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('ac.types.title')}</span>
        {can.create && <Button size="sm" variant="ghost" onClick={() => open('new')}><Plus size={14} className="mr-1" />{t('ac.types.create')}</Button>}
      </div>
      {types.length === 0 ? (
        <p className="text-xs text-gray-500">{t('ac.types.none')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {types.map(x => (
            <span key={x.id} className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 pl-1 pr-1 py-0.5" title={x.description ?? undefined}>
              <AcTypeBadge type={x} />
              <span className="text-[11px] text-gray-500 tabular-nums">{usedBy(x.id)}</span>
              {can.update && <button className="p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => open(x)} title={t('pf.common.edit')}><Pencil size={12} /></button>}
              {can.remove && <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setToDelete(x)} title={t('pf.common.delete')}><Trash2 size={12} className="text-danger" /></button>}
            </span>
          ))}
        </div>
      )}

      <Modal isOpen={!!form} onClose={() => !saving && setForm(null)} title={form === 'new' ? t('ac.types.create') : t('ac.types.edit')}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('pf.common.name')} <span className="text-danger">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('ac.types.placeholder')} className={`${pfInputClass} h-10`} autoFocus />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('org.common.description')}</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={pfInputClass} />
          </label>
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ac.domain.color')}</span>
            <div className="flex flex-wrap gap-2">
              {TYPE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`w-7 h-7 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800' : ''}`} style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>{t('pf.common.cancel')}</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t('pf.common.deleteTitle')}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('ac.types.deleteHint').replace('{name}', toDelete?.name ?? '').replace('{n}', String(toDelete ? usedBy(toDelete.id) : 0))}
        </p>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={() => setToDelete(null)}>{t('pf.common.cancel')}</Button>
          <Button variant="danger" onClick={() => void remove()}>{t('pf.common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
};
