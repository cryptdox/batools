import { useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { PARTICLES, useMpGenres, useMpUserId, type MpGenre, type MpParticle } from '../../lib/music';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { MpParticles } from '../../components/music/MpParticles';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const COLORS = ['#6c5ce7', '#2a78d6', '#1baf7a', '#eb6834', '#e87ba4', '#eda100', '#008300', '#e34948', '#4a3aa7', '#9aa3b2'];
// The preview animates as if music were playing at a steady level.
const previewLevel = () => 0.35;

/** The genre list: each genre's colour and particle effect in the player. */
export const MpGenres = () => {
  const { t } = useLanguage();
  const userId = useMpUserId();
  const { genres, reload } = useMpGenres();
  const [form, setForm] = useState<MpGenre | 'new' | null>(null);
  const [name, setName] = useState('');
  const [particle, setParticle] = useState<MpParticle>('sparks');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<MpGenre | null>(null);

  const open = (g: MpGenre | 'new') => {
    setForm(g);
    setName(g === 'new' ? '' : g.name);
    setParticle(g === 'new' ? 'sparks' : g.particle);
    setColor(g === 'new' ? COLORS[genres.length % COLORS.length] : g.color);
  };

  const save = async () => {
    if (!form || !name.trim()) return;
    setSaving(true);
    const row = { name: name.trim(), particle, color, updated_at: new Date().toISOString() };
    const { error } = form === 'new'
      ? await supabase.from('mp_genres').insert([{ ...row, created_by: userId }])
      : await supabase.from('mp_genres').update(row).eq('id', form.id);
    setSaving(false);
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    setForm(null);
    toast.success(form === 'new' ? t('pf.common.added') : t('pf.common.updated'));
    await reload();
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from('mp_genres').delete().eq('id', toDelete.id);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    setToDelete(null);
    toast.success(t('pf.common.deleted'));
    await reload();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="mp.genres.pageTitle" subtitle="mp.genres.pageSubtitle"
        action={<Button onClick={() => open('new')}><Plus size={16} className="mr-1" />{t('mp.genres.create')}</Button>} />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {genres.map(g => (
          <div key={g.id} className="relative overflow-hidden rounded-xl h-28 text-white shadow-sm" style={{ background: `linear-gradient(140deg, ${g.color}, #131d3d)` }}>
            <MpParticles kind={g.particle} color="#ffffff" playing level={previewLevel} className="absolute inset-0 w-full h-full opacity-70" />
            <div className="relative p-3 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-1">
                <span className="font-semibold leading-tight">{g.name}</span>
                <span className="flex">
                  <button className="p-1 rounded hover:bg-white/20" onClick={() => open(g)} title={t('pf.common.edit')}><Pencil size={13} /></button>
                  <button className="p-1 rounded hover:bg-white/20" onClick={() => setToDelete(g)} title={t('pf.common.delete')}><Trash2 size={13} /></button>
                </span>
              </div>
              <span className="text-[11px] text-white/80">{t(`mp.particles.${g.particle}`)}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={!!form} onClose={() => !saving && setForm(null)} title={form === 'new' ? t('mp.genres.create') : t('mp.genres.edit')}>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl h-32" style={{ background: `linear-gradient(140deg, ${color}, #131d3d)` }}>
            <MpParticles kind={particle} color="#ffffff" playing level={previewLevel} className="absolute inset-0 w-full h-full" />
            <span className="absolute left-3 bottom-2 text-white font-semibold">{name || t('mp.genre')}</span>
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('pf.common.name')} <span className="text-danger">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} className={`${pfInputClass} h-10`} autoFocus />
          </label>
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('mp.genres.particle')}</span>
            <div className="grid grid-cols-4 gap-2">
              {PARTICLES.map(k => (
                <button key={k} type="button" onClick={() => setParticle(k)}
                  className={`h-9 rounded-lg text-xs font-medium border ${particle === k ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                  {t(`mp.particles.${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ac.domain.color')}</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800' : ''}`} style={{ background: c }} aria-label={c} />)}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>{t('pf.common.cancel')}</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t('pf.common.deleteTitle')}>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('mp.genres.deleteHint').replace('{name}', toDelete?.name ?? '')}</p>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={() => setToDelete(null)}>{t('pf.common.cancel')}</Button>
          <Button variant="danger" onClick={() => void remove()}>{t('pf.common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
};
