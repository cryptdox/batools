import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { LpScope, lpChoices } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const GROUPS = lpChoices('lp.family.groups', ['father', 'mother', 'child', 'family']);
const DEGREES = lpChoices('lp.family.degrees', ['1', '2', '3']);
const SIDES = lpChoices('lp.family.sides', ['paternal', 'maternal']);
const ROLES = lpChoices('lp.family.roles', ['parent', 'guardian', 'caregiver', 'viewer', 'none']);

/** Same colours as the app's member themes (life-stage-parenting src/content/static/family.json). */
const GROUP_COLOURS: Record<string, string> = { father: '#0097e6', mother: '#e75480', child: '#e1a12c', family: '#4f9a6b' };

const FIELDS: IsField[] = [
  { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'group_key', label: 'lp.family.group', type: 'select', required: true, options: GROUPS, hint: 'lp.family.groupHint' },
  { name: 'blood_degree', label: 'lp.family.bloodDegree', type: 'select', allowEmpty: true, options: DEGREES, hint: 'lp.family.bloodDegreeHint' },
  { name: 'side', label: 'lp.family.side', type: 'select', allowEmpty: true, options: SIDES },
  { name: 'default_role', label: 'lp.family.defaultRole', type: 'select', required: true, options: ROLES, hint: 'lp.family.defaultRoleHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

/** "Who are you to the children?" — the relations a family member can have, by blood degree. */
export const LpFamily = () => {
  const { t, language } = useLanguage();
  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.family.pageTitle" subtitle="lp.family.pageSubtitle" />
        <IsListEditor
          table="lp_relation_types"
          title="lp.family.title"
          keys={['key']}
          fields={FIELDS}
          audited="none"
          defaults={{ group_key: 'family', default_role: 'viewer' }}
          filters={[{ name: 'group_key', label: 'lp.family.group', options: GROUPS }]}
          renderRow={r => (
            <IsRowText
              primary={
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLOURS[String(r.group_key)] }} />
                  {isText(r.name, language)}
                </span>
              }
              secondary={[
                t(`lp.family.groups.${r.group_key}`),
                r.blood_degree ? t(`lp.family.degrees.${r.blood_degree}`) : t('lp.family.notBlood'),
                r.side ? t(`lp.family.sides.${r.side}`) : '',
                `${t('lp.family.defaultRole')}: ${t(`lp.family.roles.${r.default_role}`)}`,
              ].filter(Boolean).join(' · ')}
              extra={<Badge variant="muted">{String(r.key)}</Badge>}
            />
          )}
        />
      </div>
    </LpScope>
  );
};
