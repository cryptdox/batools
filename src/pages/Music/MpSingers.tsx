import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Search, Mic2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { useMpLookups, useMpRatings, useMpUserId, type MpSinger } from '../../lib/music';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { MpStars } from '../../components/music/MpUi';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

type Row = MpSinger & { country: { name: string } | null; songs: { count: number }[] };

/** The shared singer list: add / edit names, rate singers, open their songs. */
export const MpSingers = () => {
  const { t } = useLanguage();
  const userId = useMpUserId();
  const navigate = useNavigate();
  const { countries } = useMpLookups();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Row | 'new' | null>(null);
  const [name, setName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('mp_singers')
      .select('*, country:mp_countries!mp_singers_country_fkey(name), songs:mp_song_singers(count)').order('name');
    if (error) toast.error(errorMessage(error, t('pf.common.loadError')));
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void load(); }, [load]);

  const needle = search.trim().toLowerCase();
  const shown = rows.filter(r => !needle || r.name.toLowerCase().includes(needle));
  const ratings = useMpRatings('singer', shown.map(r => r.id), userId);

  const open = (r: Row | 'new') => {
    setForm(r);
    setName(r === 'new' ? search.trim() : r.name);
    setCountryId(r === 'new' ? '' : r.country_id ?? '');
    setBio(r === 'new' ? '' : r.bio ?? '');
  };

  const save = async () => {
    if (!form || !name.trim()) return;
    setSaving(true);
    const row = { name: name.trim(), country_id: countryId || null, bio: bio.trim() || null, updated_at: new Date().toISOString() };
    const { error } = form === 'new'
      ? await supabase.from('mp_singers').insert([{ ...row, created_by: userId }])
      : await supabase.from('mp_singers').update(row).eq('id', form.id);
    setSaving(false);
    if (error) {
      return toast.error(error.code === '23505' ? t('mp.singersPage.duplicate') : errorMessage(error, t('pf.common.saveError')));
    }
    setForm(null);
    toast.success(form === 'new' ? t('pf.common.added') : t('pf.common.updated'));
    await load();
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from('mp_singers').delete().eq('id', toDelete.id);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    setToDelete(null);
    toast.success(t('pf.common.deleted'));
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader title="mp.singersPage.pageTitle" subtitle="mp.singersPage.pageSubtitle"
        action={<Button onClick={() => open('new')}><Plus size={16} className="mr-1" />{t('mp.singersPage.create')}</Button>} />

      <div className={`${card} p-4`}>
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pf.common.search')} className={`${pfInputClass} h-9 pl-8`} />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : shown.length === 0 ? (
        <div className={`${card} p-12 text-center text-gray-500`}>{t('mp.singersPage.empty')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(r => (
            <div key={r.id} className={`${card} p-4 flex gap-3 cursor-pointer hover:shadow-md transition-shadow`} onClick={() => navigate(`/mp?singer=${r.id}`)}>
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold">
                {r.name.trim().charAt(0).toUpperCase() || <Mic2 size={18} />}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start gap-1">
                  <span className="flex-1 font-semibold text-gray-900 dark:text-gray-100 truncate">{r.name}</span>
                  <button className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={e => { e.stopPropagation(); open(r); }} title={t('pf.common.edit')}><Pencil size={13} /></button>
                  <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={e => { e.stopPropagation(); setToDelete(r); }} title={t('pf.common.delete')}><Trash2 size={13} className="text-danger" /></button>
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {[r.country?.name, `${r.songs?.[0]?.count ?? 0} ${t('mp.songs')}`].filter(Boolean).join(' · ')}
                </div>
                <MpStars stat={ratings.stats[r.id]} mine={ratings.mine[r.id]} onRate={n => void ratings.rate(r.id, n)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!form} onClose={() => !saving && setForm(null)} title={form === 'new' ? t('mp.singersPage.create') : t('mp.singersPage.edit')}>
        <div className="space-y-4">
          <label className="block">
            <span className={label}>{t('pf.common.name')} <span className="text-danger">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} className={`${pfInputClass} h-10`} autoFocus />
          </label>
          <label className="block">
            <span className={label}>{t('mp.country')}</span>
            <select value={countryId} onChange={e => setCountryId(e.target.value)} className={`${pfInputClass} h-10`}>
              <option value="">—</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={label}>{t('mp.singersPage.bio')}</span>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className={pfInputClass} />
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>{t('pf.common.cancel')}</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t('pf.common.deleteTitle')}>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('mp.singersPage.deleteHint').replace('{name}', toDelete?.name ?? '')}</p>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={() => setToDelete(null)}>{t('pf.common.cancel')}</Button>
          <Button variant="danger" onClick={() => void remove()}>{t('pf.common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
};
