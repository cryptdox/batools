import { Badge } from '../../components/ui/Button';
import { PfRowText } from '../../components/portfolio/PfListEditor';
import { useLanguage } from '../../lib/LanguageContext';
import type { PfField } from '../../lib/portfolio';
import { formatDate, labelsFrom, optionsFrom, useOrgRows } from '../../lib/orgSite';
import { OrgList, OrgPage } from './OrgList';

const stripHtml = (html: unknown) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const BLOG_FIELDS: PfField[] = [
  { name: 'title', label: 'org.common.title', type: 'text', required: true },
  { name: 'content', label: 'org.blogs.content', type: 'textarea', rows: 14, hint: 'org.blogs.contentHint' },
];

export const OrgBlogs = () => (
  <OrgPage title="org.blogs.pageTitle" subtitle="org.blogs.pageSubtitle">
    <OrgList
      table="org_blogs"
      title="org.blogs.title"
      fields={BLOG_FIELDS}
      ordered={false}
      hideable
      orderBy={['-created_at']}
      searchable
      renderRow={r => <PfRowText primary={String(r.title)} secondary={`${formatDate(r.created_at)} · ${stripHtml(r.content).slice(0, 140)}`} />}
    />
  </OrgPage>
);

const JOB_FIELDS: PfField[] = [
  { name: 'title', label: 'org.common.title', type: 'text', required: true },
  { name: 'recruitment_expire_date', label: 'org.jobs.expires', type: 'date', hint: 'org.jobs.expiresHint' },
  { name: 'description', label: 'org.common.description', type: 'textarea', rows: 10, hint: 'org.jobs.descriptionHint' },
];

export const OrgJobs = () => {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <OrgPage title="org.jobs.pageTitle" subtitle="org.jobs.pageSubtitle">
      <OrgList
        table="org_jobs"
        title="org.jobs.title"
        fields={JOB_FIELDS}
        ordered={false}
        hideable
        orderBy={['-created_at']}
        searchable
        renderRow={r => {
          const expires = formatDate(r.recruitment_expire_date);
          return (
            <PfRowText
              primary={String(r.title)}
              secondary={expires ? `${t('org.jobs.expires')}: ${expires}` : ''}
              extra={expires && expires < today ? <Badge variant="warning">{t('org.jobs.expired')}</Badge> : undefined}
            />
          );
        }}
      />
    </OrgPage>
  );
};

/** The site's Portfolio page. */
export const OrgProjects = () => {
  const members = useOrgRows('org_members');
  const memberNames = labelsFrom(members, 'name');
  const fields: PfField[] = [
    { name: 'title', label: 'org.common.title', type: 'text', required: true },
    { name: 'description', label: 'org.common.description', type: 'textarea' },
    { name: 'technology_used', label: 'org.projects.technology', type: 'tags' },
    { name: 'link', label: 'org.projects.link', type: 'text' },
    { name: 'member_id', label: 'org.projects.member', type: 'select', allowEmpty: true, options: optionsFrom(members, 'name') },
  ];
  return (
    <OrgPage title="org.projects.pageTitle" subtitle="pf.common.orderHint">
      <OrgList
        table="org_projects"
        title="org.projects.title"
        fields={fields}
        searchable
        renderRow={r => (
          <PfRowText
            primary={String(r.title)}
            secondary={[r.member_id ? memberNames[String(r.member_id)] : null, r.link].filter(Boolean).join(' · ')}
            extra={<>{(r.technology_used as string[]).map(s => <Badge key={s} variant="muted">{s}</Badge>)}</>}
          />
        )}
      />
    </OrgPage>
  );
};
