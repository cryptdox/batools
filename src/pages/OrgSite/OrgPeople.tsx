import { useState } from 'react';
import { ListTree } from 'lucide-react';
import { Badge } from '../../components/ui/Button';
import { PfRowText } from '../../components/portfolio/PfListEditor';
import { useLanguage } from '../../lib/LanguageContext';
import type { PfField, PfRow } from '../../lib/portfolio';
import { formatDate, labelsFrom, optionsFrom, useOrgRows } from '../../lib/orgSite';
import { PfTabs } from '../Portfolio/PfPageHeader';
import { OrgList, OrgPage } from './OrgList';

const TEAM_FIELDS: PfField[] = [
  { name: 'name', label: 'pf.common.name', type: 'text', required: true },
  { name: 'description', label: 'org.common.description', type: 'textarea' },
];

const SKILL_FIELDS: PfField[] = [{ name: 'name', label: 'pf.common.name', type: 'text', required: true }];

/** Teams shown on the site, and the skill catalogue members pick from. */
export const OrgTeams = () => (
  <OrgPage title="org.teams.pageTitle" subtitle="pf.common.orderHint">
    <OrgList
      table="org_teams"
      title="org.teams.title"
      fields={TEAM_FIELDS}
      renderRow={r => <PfRowText primary={String(r.name)} secondary={String(r.description ?? '')} />}
    />
    <OrgList
      table="org_skills"
      title="org.teams.skills"
      subtitle="org.teams.skillsHint"
      fields={SKILL_FIELDS}
      ordered={false}
      orderBy={['name']}
      searchable
      renderRow={r => <PfRowText primary={String(r.name)} />}
    />
  </OrgPage>
);

const MEMBER_FIELDS: PfField[] = [
  { name: 'name', label: 'pf.common.name', type: 'text', required: true },
  { name: 'designation', label: 'org.members.designation', type: 'text' },
  { name: 'profile_image_url', label: 'org.members.photo', type: 'text', upload: 'image/*' },
  { name: 'objective', label: 'org.members.objective', type: 'textarea' },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'].map(value => ({ value, label: `org.members.levels.${value}` }));

const EDUCATION_FIELDS: PfField[] = [
  { name: 'degree', label: 'pf.about.degree', type: 'text', required: true },
  { name: 'institution', label: 'pf.about.institution', type: 'text', required: true },
  { name: 'start_date', label: 'org.common.startDate', type: 'date' },
  { name: 'end_date', label: 'org.common.endDate', type: 'date' },
];

const EXPERIENCE_FIELDS: PfField[] = [
  { name: 'position', label: 'pf.work.position', type: 'text', required: true },
  { name: 'company', label: 'pf.work.company', type: 'text', required: true },
  { name: 'start_date', label: 'org.common.startDate', type: 'date' },
  { name: 'end_date', label: 'org.common.endDate', type: 'date', hint: 'org.members.currentHint' },
];

type Tab = 'teams' | 'skills' | 'education' | 'experience';
const TABS: { key: Tab; label: string }[] = [
  { key: 'teams', label: 'org.members.teams' },
  { key: 'skills', label: 'org.members.skills' },
  { key: 'education', label: 'pf.about.education' },
  { key: 'experience', label: 'pf.work.experience' },
];

const period = (r: PfRow, present: string) =>
  [formatDate(r.start_date), formatDate(r.end_date) || present].join(' – ');

/** People, and per person their teams, skills, education and experience. */
export const OrgMembers = () => {
  const { t } = useLanguage();
  const [member, setMember] = useState<PfRow | null>(null);
  const [tab, setTab] = useState<Tab>('teams');
  const teams = useOrgRows('org_teams');
  const skills = useOrgRows('org_skills', 'name');
  const teamNames = labelsFrom(teams, 'name');
  const skillNames = labelsFrom(skills, 'name');

  const teamFields: PfField[] = [
    { name: 'team_id', label: 'org.members.team', type: 'select', required: true, options: optionsFrom(teams, 'name'), initial: teams[0]?.id ?? '' },
  ];
  const skillFields: PfField[] = [
    { name: 'skill_id', label: 'org.members.skill', type: 'select', required: true, options: optionsFrom(skills, 'name'), initial: skills[0]?.id ?? '' },
    { name: 'level', label: 'org.members.level', type: 'select', allowEmpty: true, options: LEVELS },
  ];

  const scope = member ? { member_id: member.id } : undefined;
  const memberName = member ? String(member.name) : '';

  return (
    <OrgPage title="org.members.pageTitle" subtitle="org.members.pageSubtitle">
      <OrgList
        table="org_members"
        title="org.members.title"
        fields={MEMBER_FIELDS}
        searchable
        onRowsChange={rows => setMember(prev => (prev ? rows.find(r => r.id === prev.id) ?? null : null))}
        isRowSelected={r => r.id === member?.id}
        rowActions={r => (
          <button
            className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${r.id === member?.id ? 'text-primary' : 'text-gray-500'}`}
            onClick={() => setMember(r.id === member?.id ? null : r)}
            title={t('org.members.editDetails')}
          >
            <ListTree size={16} />
          </button>
        )}
        renderRow={r => (
          <div className="flex items-center gap-3 min-w-0">
            {r.profile_image_url ? (
              <img src={String(r.profile_image_url)} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
            ) : null}
            <PfRowText primary={String(r.name)} secondary={String(r.designation ?? r.objective ?? '')} />
          </div>
        )}
      />

      {!member || !scope ? (
        <div className="p-6 text-center text-sm text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          {t('org.members.pick')}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default">{memberName}</Badge>
            <PfTabs tabs={TABS} active={tab} onChange={setTab} />
          </div>
          {tab === 'teams' && (
            <OrgList
              key={`teams-${member.id}`}
              table="org_member_teams"
              title="org.members.teams"
              fields={teamFields}
              scope={scope}
              ordered={false}
              renderRow={r => <PfRowText primary={teamNames[String(r.team_id)] ?? '—'} />}
            />
          )}
          {tab === 'skills' && (
            <OrgList
              key={`skills-${member.id}`}
              table="org_member_skills"
              title="org.members.skills"
              fields={skillFields}
              scope={scope}
              ordered={false}
              renderRow={r => (
                <PfRowText
                  primary={skillNames[String(r.skill_id)] ?? '—'}
                  extra={r.level ? <Badge variant="muted">{t(`org.members.levels.${r.level}`)}</Badge> : undefined}
                />
              )}
            />
          )}
          {tab === 'education' && (
            <OrgList
              key={`edu-${member.id}`}
              table="org_member_education"
              title="pf.about.education"
              fields={EDUCATION_FIELDS}
              scope={scope}
              renderRow={r => <PfRowText primary={String(r.degree)} secondary={`${r.institution} · ${period(r, t('org.common.present'))}`} />}
            />
          )}
          {tab === 'experience' && (
            <OrgList
              key={`exp-${member.id}`}
              table="org_member_experiences"
              title="pf.work.experience"
              fields={EXPERIENCE_FIELDS}
              scope={scope}
              renderRow={r => <PfRowText primary={`${r.position} · ${r.company}`} secondary={period(r, t('org.common.present'))} />}
            />
          )}
        </>
      )}
    </OrgPage>
  );
};
