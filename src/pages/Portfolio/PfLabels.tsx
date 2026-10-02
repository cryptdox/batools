import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import type { PfField } from '../../lib/portfolio';
import { PfPageHeader } from './PfPageHeader';

const FIELDS: PfField[] = [
  { name: 'key', label: 'pf.labels.key', type: 'text', required: true, hint: 'pf.labels.keyHint' },
  { name: 'value', label: 'pf.labels.value', type: 'i18n', required: true, multiline: true },
];

export const PfLabels = () => (
  <div className="max-w-5xl mx-auto space-y-6">
    <PfPageHeader title="pf.labels.pageTitle" subtitle="pf.labels.pageSubtitle" />
    <PfListEditor
      table="pf_labels"
      title="pf.labels.title"
      fields={FIELDS}
      ordered={false}
      orderBy={['key']}
      searchable
      renderRow={r => (
        <PfRowText
          primary={<span className="font-mono text-xs text-primary">{String(r.key)}</span>}
          secondary={`${r.value_en} · ${r.value_bn}`}
        />
      )}
    />
  </div>
);
