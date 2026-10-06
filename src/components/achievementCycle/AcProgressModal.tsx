import { useState } from 'react';
import { toast } from 'react-toastify';
import { Minus, Plus } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { cycleLabel, acRpc, type AcCycle, type AcTopic } from '../../lib/achievementCycle';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { AcProgress, AcRichEditor } from './AcUi';

/** Adds or removes achieved points on an in-progress cycle, with why. */
export const AcProgressModal = ({ userId, cycle, topic, direction, onClose, onDone }: {
  userId: string;
  cycle: AcCycle;
  topic: AcTopic;
  direction: 1 | -1;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { t } = useLanguage();
  const max = direction === 1 ? cycle.total_points - cycle.achieved_points : cycle.achieved_points;
  const [amount, setAmount] = useState(max > 0 ? '1' : '0');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n <= max && comment.trim() !== '';
  const after = cycle.achieved_points + direction * (Number.isInteger(n) ? n : 0);

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    const res = await acRpc<AcCycle>('ac_log_progress', {
      p_user_id: userId, p_cycle_id: cycle.id, p_delta: direction * n, p_comment_html: comment,
    }, t('pf.common.saveError'));
    setSaving(false);
    if (!res) return;
    toast.success(res.status === 'complete' ? t('ac.progress.completed') : t('ac.progress.saved'));
    onDone();
  };

  return (
    <Modal
      isOpen
      onClose={() => !saving && onClose()}
      title={`${direction === 1 ? t('ac.progress.add') : t('ac.progress.remove')} · ${topic.name} · ${cycleLabel(cycle, t)}`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {topic.story_point_description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('ac.topic.spMeaning')}: {topic.story_point_description}</p>
        )}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${direction === 1 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {direction === 1 ? <Plus size={18} /> : <Minus size={18} />}
          </span>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('ac.progress.points')}</span>
            <input type="number" min={1} max={max} step={1} value={amount} onChange={e => setAmount(e.target.value)} className={`${pfInputClass} h-10 w-24`} />
          </label>
          <span className="text-xs text-gray-500">{t('ac.progress.max').replace('{n}', String(max))}</span>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{t('ac.progress.after')}</div>
          <AcProgress achieved={Math.max(0, Math.min(after, cycle.total_points))} total={cycle.total_points} />
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ac.progress.why')} <span className="text-danger">*</span></span>
          <AcRichEditor value={comment} onChange={setComment} placeholder={t('ac.progress.whyPlaceholder')} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button variant={direction === 1 ? 'primary' : 'danger'} onClick={submit} disabled={saving || !valid}>
            {saving ? t('pf.common.saving') : t('ac.progress.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
