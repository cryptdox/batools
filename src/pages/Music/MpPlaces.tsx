import { useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { useMpLookups, useMpUserId } from '../../lib/music';
import { Button } from '../../components/ui/Button';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';

type Item = { id: string; name: string; code: string | null; native_name?: string | null };

/** One list (countries or languages): add by name + code, delete. */
const LookupList = ({ table, title, items, withNative, onChanged }: {
  table: 'mp_countries' | 'mp_languages'; title: string; items: Item[]; withNative?: boolean; onChanged: () => void;
}) => {
  const { t } = useLanguage();
  const userId = useMpUserId();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [native, setNative] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const row = { name: name.trim(), code: code.trim() || null, created_by: userId, ...(withNative ? { native_name: native.trim() || null } : {}) };
    const { error } = await supabase.from(table).insert([row]);
    setSaving(false);
    if (error) return toast.error(error.code === '23505' ? t('mp.places.duplicate') : errorMessage(error, t('pf.common.saveError')));
    setName(''); setCode(''); setNative('');
    onChanged();
  };

  const remove = async (item: Item) => {
    if (!window.confirm(t('mp.places.deleteHint').replace('{name}', item.name))) return;
    const { error } = await supabase.from(table).delete().eq('id', item.id);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    onChanged();
  };

  return (
    <div className={`${card} p-4 flex flex-col gap-3`}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title} <span className="text-xs font-normal text-gray-500">({items.length})</span></h3>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t('pf.common.name')} className={`${pfInputClass} h-9 flex-1 min-w-32`}
          onKeyDown={e => { if (e.key === 'Enter') void add(); }} />
        {withNative && <input value={native} onChange={e => setNative(e.target.value)} placeholder={t('mp.places.native')} className={`${pfInputClass} h-9 w-32`} />}
        <input value={code} onChange={e => setCode(e.target.value)} placeholder={t('mp.places.code')} className={`${pfInputClass} h-9 w-20`} />
        <Button size="sm" onClick={() => void add()} disabled={saving || !name.trim()}><Plus size={14} className="mr-1" />{t('pf.common.add')}</Button>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[28rem] overflow-y-auto">
        {items.map(i => (
          <li key={i.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="flex-1 text-gray-800 dark:text-gray-200">{i.name}</span>
            {i.native_name && i.native_name !== i.name && <span className="text-gray-500">{i.native_name}</span>}
            {i.code && <span className="text-[11px] font-mono uppercase text-gray-400 w-10 text-right">{i.code}</span>}
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => void remove(i)} title={t('pf.common.delete')}><Trash2 size={13} className="text-danger" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** The country and language pick lists used by songs and singers. */
export const MpPlaces = () => {
  const { t } = useLanguage();
  const { countries, languages, reload } = useMpLookups();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="mp.places.pageTitle" subtitle="mp.places.pageSubtitle" />
      <div className="grid gap-4 md:grid-cols-2">
        <LookupList table="mp_countries" title={t('mp.places.countries')} items={countries} onChanged={() => void reload()} />
        <LookupList table="mp_languages" title={t('mp.places.languages')} items={languages} withNative onChanged={() => void reload()} />
      </div>
    </div>
  );
};
