import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MpUnknownCard } from '../../components/music/MpUnknownCard';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Search, Users, Film, Ticket, Tv, Clapperboard, Shapes, type LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { FILE_FIELDS, SOURCE_KINDS, deleteMusicFile, useMpLookups, useMpUserId, withCover, type MpFile, type MpSource, type MpSourceKind } from '../../lib/music';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { MpCombo } from '../../components/music/MpCombo';
import { MpCover, MpCoverInput } from '../../components/music/MpUi';
import { activeItems, MpSingerPicker } from '../../components/music/MpSongForm';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

export const SOURCE_ICONS: Record<MpSourceKind, LucideIcon> = {
  band: Users, movie: Film, concert: Ticket, tv_show: Tv, drama: Clapperboard, other: Shapes,
};

type Row = MpSource & {
  country: { name: string } | null;
  cover: MpFile | null;
  singers: { singer: { id: string; name: string } | null }[];
  songs: { count: number }[];
};

/** Bands, movies, concerts, TV shows, dramas...: where songs come from, and their singers. */
export const MpSources = () => {
  const { t } = useLanguage();
  const userId = useMpUserId();
  const navigate = useNavigate();
  const { countries, singers, setSingers } = useMpLookups();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | MpSourceKind>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Row | 'new' | null>(null);
  const [kind, setKind] = useState<MpSourceKind>('band');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [countryId, setCountryId] = useState('');
  const [description, setDescription] = useState('');
  const [singerIds, setSingerIds] = useState<string[]>([]);
  const [cover, setCover] = useState<{ file: File | null; remove: boolean; preview: string | null }>({ file: null, remove: false, preview: null });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('mp_sources')
      .select(`*, country:mp_countries!mp_sources_country_fkey(name), cover:mp_files!mp_sources_cover_fkey(${FILE_FIELDS}), singers:mp_source_singers(singer:mp_singers!mp_source_singers_singer_fkey(id, name)), songs:mp_songs(count)`)
      .order('name');
    if (error) toast.error(errorMessage(error, t('pf.common.loadError')));
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void load(); }, [load]);

  const needle = search.trim().toLowerCase();
  const shown = rows.filter(r => (tab === 'all' || r.kind === tab) && (!needle || r.name.toLowerCase().includes(needle)));
  const pg = usePagination(shown);
  useEffect(() => { pg.setPage(1); }, [needle, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (r: Row | 'new') => {
    setForm(r);
    setKind(r === 'new' ? (tab === 'all' ? 'band' : tab) : r.kind);
    setName(r === 'new' ? search.trim() : r.name);
    setYear(r === 'new' ? String(new Date().getFullYear()) : r.release_year ? String(r.release_year) : '');
    setCountryId(r === 'new' ? '' : r.country_id ?? '');
    setDescription(r === 'new' ? '' : r.description ?? '');
    setCover({ file: null, remove: false, preview: r === 'new' ? null : r.cover?.url ?? null });
    setSingerIds(r === 'new' ? [] : r.singers.map(s => s.singer?.id).filter(Boolean) as string[]);
  };

  const yearNum = year.trim() ? Number(year) : null;
  const valid = name.trim() !== '' && (yearNum === null || (Number.isInteger(yearNum) && yearNum >= 1800 && yearNum <= 2200));

  const save = async () => {
    if (!form || !valid || !userId) return;
    setSaving(true);
    try {
      const id = await withCover({ file: cover.file, remove: cover.remove, current: form === 'new' ? null : form.cover, userId }, async coverId => {
        const row = {
          kind, name: name.trim(), release_year: yearNum, country_id: countryId || null,
          description: description.trim() || null, cover_file_id: coverId, updated_at: new Date().toISOString(),
        };
        if (form === 'new') {
          const { data, error } = await supabase.from('mp_sources').insert([{ ...row, created_by: userId }]).select('id').single();
          if (error) throw error;
          return data.id as string;
        }
        const { error } = await supabase.from('mp_sources').update(row).eq('id', form.id);
        if (error) throw error;
        return form.id;
      });
      if (form !== 'new') await supabase.from('mp_source_singers').delete().eq('source_id', id);
      if (singerIds.length) {
        const { error } = await supabase.from('mp_source_singers').insert(singerIds.map(singer_id => ({ source_id: id, singer_id })));
        if (error) throw error;
      }
      setForm(null);
      toast.success(form === 'new' ? t('pf.common.added') : t('pf.common.updated'));
      await load();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      toast.error(code === '23505' ? t('mp.sources.duplicate') : errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from('mp_sources').delete().eq('id', toDelete.id);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    if (toDelete.cover) await deleteMusicFile(toDelete.cover);
    setToDelete(null);
    toast.success(t('pf.common.deleted'));
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader title="mp.sources.pageTitle" subtitle="mp.sources.pageSubtitle"
        action={<Button onClick={() => open('new')}><Plus size={16} className="mr-1" />{t('mp.sources.create')}</Button>} />

      <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
        <PfTabs
          tabs={[{ key: 'all' as const, label: 'mp.collections.all' }, ...SOURCE_KINDS.map(k => ({ key: k, label: `mp.sourceKinds.${k}` }))]}
          active={tab}
          onChange={setTab}
        />
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pf.common.search')} className={`${pfInputClass} h-9 pl-8 w-56`} />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : shown.length === 0 ? (
        <div className={`${card} p-12 text-center text-gray-500`}>{t('mp.sources.empty')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pg.page === 1 && !search.trim() && <MpUnknownCard what="source" />}
          {pg.pageRows.map(r => {
            const Icon = SOURCE_ICONS[r.kind];
            return (
              <div key={r.id} className={`${card} p-4 flex gap-3 cursor-pointer hover:shadow-md transition-shadow`} onClick={() => navigate(`/mp?source=${r.id}`)}>
                {r.cover
                  ? <MpCover url={r.cover.url} className="w-14 h-14" rounded="rounded-xl" alt={r.name} />
                  : <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon size={22} /></div>}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-1">
                    <span className="flex-1 font-semibold text-gray-900 dark:text-gray-100 truncate">{r.name}</span>
                    <button className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={e => { e.stopPropagation(); open(r); }} title={t('pf.common.edit')}><Pencil size={13} /></button>
                    <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={e => { e.stopPropagation(); setToDelete(r); }} title={t('pf.common.delete')}><Trash2 size={13} className="text-danger" /></button>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {[t(`mp.sourceKinds.${r.kind}`), r.release_year, r.country?.name, `${r.songs?.[0]?.count ?? 0} ${t('mp.songs')}`].filter(Boolean).join(' · ')}
                  </div>
                  {r.singers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.singers.map(s => s.singer && (
                        <span key={s.singer.id} className="px-1.5 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{s.singer.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && pg.total > 0 && (
        <div className={`${card} overflow-hidden`}>
          <Pagination page={pg.page} pageCount={pg.pageCount} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} />
        </div>
      )}

      <Modal isOpen={!!form} onClose={() => !saving && setForm(null)} title={form === 'new' ? t('mp.sources.create') : t('mp.sources.edit')}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_KINDS.map(k => {
              const Icon = SOURCE_ICONS[k];
              return (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium border ${kind === k ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                  <Icon size={14} />{t(`mp.sourceKinds.${k}`)}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4">
            <MpCoverInput url={cover.preview} onChange={setCover} />
            <label className="block flex-1 min-w-0">
              <span className={label}>{t('pf.common.name')} <span className="text-danger">*</span></span>
              <input value={name} onChange={e => setName(e.target.value)} className={`${pfInputClass} h-10`} autoFocus />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>{t('mp.year')}</span>
              <input type="number" min={1800} max={2200} value={year} onChange={e => setYear(e.target.value)} className={`${pfInputClass} h-10`} />
            </label>
            <div>
              <span className={label}>{t('mp.country')}</span>
              <MpCombo items={activeItems(countries, countryId, c => c.code)} value={countryId} onChange={setCountryId} />
            </div>
          </div>
          <div>
            <span className={label}>{t('mp.singers')}</span>
            {userId && <MpSingerPicker userId={userId} singers={singers} onSingersChange={setSingers} value={singerIds} onChange={setSingerIds} />}
          </div>
          <label className="block">
            <span className={label}>{t('org.common.description')}</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={pfInputClass} />
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>{t('pf.common.cancel')}</Button>
            <Button onClick={save} disabled={saving || !valid}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t('pf.common.deleteTitle')}>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('mp.sources.deleteHint').replace('{name}', toDelete?.name ?? '')}</p>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={() => setToDelete(null)}>{t('pf.common.cancel')}</Button>
          <Button variant="danger" onClick={() => void remove()}>{t('pf.common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
};
