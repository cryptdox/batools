import { useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, usePfUserId, type PfField, type PfRow } from '../../lib/portfolio';
import { Modal } from '../ui/Modal';
import { richPlainText } from '../ui/RichText';
import { PfListEditor, PfRowText } from './PfListEditor';

// A project's or publication's details (migration 058): its case-study
// sections and its challenges, both ordered lists whose items can each be
// shown or hidden, plus the parent's master switch that shows or hides all of
// them on the portfolio at once.

const SECTION_FIELDS: PfField[] = [
  { name: 'heading', label: 'pf.work.sectionHeading', type: 'i18n', required: true, hint: 'pf.work.sectionHeadingHint' },
  { name: 'body', label: 'pf.work.sectionBody', type: 'i18n', rich: true, hint: 'pf.common.richTextHint' },
];

const CHALLENGE_FIELDS: PfField[] = [
  { name: 'challenge', label: 'pf.work.challenge', type: 'i18n', rich: true, required: true, hint: 'pf.work.challengeHint' },
  { name: 'solution', label: 'pf.work.solution', type: 'i18n', rich: true, hint: 'pf.work.solutionHint' },
  { name: 'result', label: 'pf.work.result', type: 'i18n', rich: true, hint: 'pf.work.resultHint' },
];

type Props = {
  /** The project or publication; null keeps the modal closed. */
  row: PfRow | null;
  /** Its table, and the column the detail rows point at it with. */
  table: 'pf_projects' | 'pf_publications';
  parentColumn: 'project_id' | 'publication_id';
  onClose: () => void;
  /** Called after the master switch is saved, so the parent list can refresh. */
  onSwitchChange: () => void;
};

export const PfCaseStudyModal = ({ row, table, parentColumn, onClose, onSwitchChange }: Props) => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [shown, setShown] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  // The switch as saved; the row prop reflects it only until the list reloads.
  const on = shown ?? row?.show_case_study === true;

  const toggle = async () => {
    if (!row || !userId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from(table)
        .update({ show_case_study: !on, updated_at: new Date().toISOString() })
        .eq('id', row.id).eq('user_id', userId);
      if (error) throw error;
      setShown(!on);
      onSwitchChange();
    } catch (e) {
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const close = () => { setShown(null); onClose(); };
  const scope = row ? { [parentColumn]: row.id } : undefined;

  return (
    <Modal isOpen={!!row} onClose={close} title={`${t('pf.work.details')} · ${row?.title_en ?? ''}`} className="max-w-4xl">
      {row && (
        <div className="space-y-5">
          <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${on ? 'border-success/40 bg-success/5' : 'border-gray-200 dark:border-gray-700'}`}>
            <input type="checkbox" checked={on} disabled={saving} onChange={() => void toggle()} className="w-4 h-4 mt-0.5 text-primary rounded border-gray-300 focus:ring-primary" />
            <span className="text-sm">
              <span className="font-medium text-gray-800 dark:text-gray-200">{t('pf.work.showCaseStudy')}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t(on ? 'pf.work.masterOnHint' : 'pf.work.masterOffHint')}</span>
            </span>
          </label>

          <PfListEditor
            key={`sections-${row.id}`}
            table="pf_case_study_sections"
            title="pf.work.caseStudy"
            subtitle="pf.work.caseStudyHint"
            fields={SECTION_FIELDS}
            scope={scope}
            renderRow={r => <PfRowText primary={String(r.heading_en)} secondary={richPlainText(String(r.body_en ?? ''))} />}
          />

          <PfListEditor
            key={`challenges-${row.id}`}
            table="pf_challenges"
            title="pf.work.challenges"
            subtitle="pf.work.challengesHint"
            fields={CHALLENGE_FIELDS}
            scope={scope}
            renderRow={r => <PfRowText primary={richPlainText(String(r.challenge_en))} secondary={richPlainText(String(r.solution_en ?? ''))} />}
          />
        </div>
      )}
    </Modal>
  );
};
