import { useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { LpScope, lpChoices } from '../../lib/parenting';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

type Tab = 'achievements' | 'levels';

const CATEGORIES = lpChoices('lp.garden.categories', ['learning', 'health_records', 'family', 'islamic', 'activities', 'development', 'safety']);

const ACHIEVEMENT_FIELDS: IsField[] = [
  { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
  { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'category', label: 'lp.garden.category', type: 'select', required: true, options: CATEGORIES },
  { name: 'rule', label: 'lp.garden.rule', type: 'json', required: true, hint: 'lp.garden.ruleHint' },
  { name: 'xp', label: 'lp.common.xp', type: 'number', required: true },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const LEVEL_FIELDS: IsField[] = [
  { name: 'level', label: 'lp.garden.level', type: 'number', required: true },
  { name: 'min_xp', label: 'lp.garden.minXp', type: 'number', required: true },
  { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'image_url', label: 'is.common.image', type: 'upload', accept: 'image/*,application/json', hint: 'lp.garden.imageHint' },
];

/** The family garden: achievements and the levels the garden grows through. It rewards learning and taking part only. */
export const LpGarden = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('achievements');
  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.garden.pageTitle" subtitle="lp.garden.pageSubtitle" />
        <PfTabs<Tab> tabs={[{ key: 'achievements', label: 'lp.garden.tabs.achievements' }, { key: 'levels', label: 'lp.garden.tabs.levels' }]} active={tab} onChange={setTab} />
        {tab === 'achievements' && (
          <IsListEditor
            table="lp_achievements"
            title="lp.garden.tabs.achievements"
            keys={['key']}
            fields={ACHIEVEMENT_FIELDS}
            defaults={{ category: 'learning', xp: '50', rule: '{\n  "kind": "tasks_done",\n  "count": 10\n}' }}
            renderRow={r => (
              <IsRowText
                primary={`${r.emoji ?? ''} ${isText(r.name, language)}`}
                secondary={[t(`lp.garden.categories.${r.category}`), JSON.stringify(r.rule)].join(' · ')}
                extra={<Badge variant="muted">{String(r.xp)} XP</Badge>}
              />
            )}
          />
        )}
        {tab === 'levels' && (
          <IsListEditor
            table="lp_garden_levels"
            title="lp.garden.tabs.levels"
            keys={['level']}
            fields={LEVEL_FIELDS}
            ordered={false}
            activeToggle={false}
            audited="none"
            orderBy={['level']}
            renderRow={r => (
              <IsRowText primary={`${r.emoji ?? ''} ${t('lp.garden.level')} ${r.level} · ${isText(r.name, language)}`} secondary={`${t('lp.garden.minXp')}: ${r.min_xp}`} />
            )}
          />
        )}
      </div>
    </LpScope>
  );
};
