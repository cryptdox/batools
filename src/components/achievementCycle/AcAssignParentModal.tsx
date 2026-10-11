import { useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import type { AcGraph, AcTopic } from '../../lib/achievementCycle';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { AcTopicMultiPicker } from './AcTopicMultiPicker';

/** Puts several topics under one or more parents: added to their parents, or replacing them. */
export const AcAssignParentModal = ({ userId, graph, topics, childIds, onClose, onDone }: {
  userId: string;
  graph: AcGraph;
  topics: AcTopic[];
  childIds: string[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const { t } = useLanguage();
  const [parentIds, setParentIds] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  // A parent can't be one of the topics or anything beneath them (no loops).
  const blocked = new Set(childIds.flatMap(id => [...graph.subtree(id)]));
  const candidates = topics.filter(x => !blocked.has(x.id));

  const save = async () => {
    if (parentIds.size === 0) return;
    setBusy(true);
    try {
      const parents = [...parentIds];
      if (replace) {
        const { error } = await supabase.from('ac_topic_links').delete().eq('user_id', userId)
          .in('child_id', childIds).not('parent_id', 'in', `(${parents.join(',')})`);
        if (error) throw error;
      }
      const counts = new Map<string, number>();
      const links = parents.flatMap(p => childIds
        .filter(c => !(graph.childLinks.get(p) ?? []).some(l => l.child_id === c))
        .map(c => {
          const n = (counts.get(p) ?? graph.childLinks.get(p)?.length ?? 0) + 1;
          counts.set(p, n);
          return { user_id: userId, parent_id: p, child_id: c, sort_order: n };
        }));
      if (links.length) {
        const { error } = await supabase.from('ac_topic_links').insert(links);
        if (error) throw error;
      }
      toast.success(t('ac.assignParent.done').replace('{n}', String(childIds.length)));
      onDone();
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title={t('ac.assignParent.title').replace('{n}', String(childIds.length))}>
      <div className="space-y-4">
        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ac.topic.parents')}</span>
          <AcTopicMultiPicker topics={candidates} value={parentIds} onChange={setParentIds} placeholder={t('ac.assignParent.pick')} />
          {parentIds.size > 0 && (
            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">{[...parentIds].map(id => graph.byId.get(id)?.name).join(', ')}</p>
          )}
        </div>
        <div className="space-y-2 text-sm">
          {([false, true] as const).map(r => (
            <label key={String(r)} className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={replace === r} onChange={() => setReplace(r)} className="mt-0.5 w-4 h-4 text-primary border-gray-300" />
              <span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{t(r ? 'ac.assignParent.replace' : 'ac.assignParent.add')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t(r ? 'ac.assignParent.replaceHint' : 'ac.assignParent.addHint')}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t('pf.common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || parentIds.size === 0}>{busy ? t('pf.common.saving') : t('pf.common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
};
