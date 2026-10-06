import { useState } from 'react';
import type { CycleRef, useAcData } from '../../lib/achievementCycle';
import { AcTopicDetail } from './AcTopicDetail';
import { AcTopicForm } from './AcTopicForm';

type AcData = ReturnType<typeof useAcData>;
type FormState = { topicId: string | null; parentId: string | null; domainId?: string | null } | null;

/**
 * Topic detail + create/edit dialogs, shared by every Achievement Cycle page.
 * Render `dialogs` once; call openTopic / newTopic / editTopic from anywhere.
 */
export function useAcDialogs(data: AcData, cycle: CycleRef) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const openTopic = (id: string) => setDetailId(id);
  const newTopic = (parentId: string | null = null, domainId: string | null = null) => setForm({ topicId: null, parentId, domainId });
  const editTopic = (id: string) => setForm({ topicId: id, parentId: null });

  const dialogs = data.userId ? (
    <>
      {detailId && !form && (
        <AcTopicDetail
          data={data}
          topicId={detailId}
          cycle={cycle}
          onClose={() => setDetailId(null)}
          onOpenTopic={setDetailId}
          onEdit={editTopic}
          onAddChild={id => newTopic(id)}
        />
      )}
      {form && (
        <AcTopicForm
          userId={data.userId}
          graph={data.graph}
          topics={data.topics}
          domains={data.domains}
          topic={form.topicId ? data.graph.byId.get(form.topicId) ?? null : null}
          parentId={form.parentId}
          domainId={form.domainId}
          onClose={() => setForm(null)}
          onSaved={async id => {
            setForm(null);
            await data.reload();
            setDetailId(id);
          }}
        />
      )}
    </>
  ) : null;

  return { openTopic, newTopic, editTopic, dialogs };
}
