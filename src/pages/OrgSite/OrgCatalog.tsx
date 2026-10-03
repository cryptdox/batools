import { Badge } from '../../components/ui/Button';
import { PfRowText } from '../../components/portfolio/PfListEditor';
import { useLanguage } from '../../lib/LanguageContext';
import type { PfField } from '../../lib/portfolio';
import { labelsFrom, optionsFrom, useOrgRows } from '../../lib/orgSite';
import { OrgList, OrgPage } from './OrgList';

const SERVICE_FIELDS: PfField[] = [
  { name: 'name', label: 'pf.common.name', type: 'text', required: true },
  { name: 'description', label: 'org.common.description', type: 'textarea' },
  { name: 'lucide_icon', label: 'pf.common.icon', type: 'text', hint: 'org.services.iconHint' },
];

export const OrgServices = () => (
  <OrgPage title="org.services.pageTitle" subtitle="pf.common.orderHint">
    <OrgList
      table="org_services"
      title="org.services.title"
      fields={SERVICE_FIELDS}
      searchable
      renderRow={r => <PfRowText primary={String(r.name)} secondary={String(r.description ?? '')} extra={r.lucide_icon ? <Badge variant="muted">{String(r.lucide_icon)}</Badge> : undefined} />}
    />
  </OrgPage>
);

export const OrgProducts = () => {
  const { t } = useLanguage();
  const services = useOrgRows('org_services');
  const serviceNames = labelsFrom(services, 'name');
  const fields: PfField[] = [
    { name: 'name', label: 'pf.common.name', type: 'text', required: true },
    { name: 'service_id', label: 'org.products.service', type: 'select', allowEmpty: true, options: optionsFrom(services, 'name') },
    { name: 'description', label: 'org.common.description', type: 'textarea' },
    { name: 'is_free', label: 'org.products.free', type: 'boolean' },
    { name: 'price', label: 'org.products.price', type: 'number', min: 0 },
    { name: 'image_url', label: 'org.common.image', type: 'text', upload: 'image/*' },
    { name: 'site_url', label: 'org.products.siteUrl', type: 'text' },
  ];
  return (
    <OrgPage title="org.products.pageTitle" subtitle="pf.common.orderHint">
      <OrgList
        table="org_products"
        title="org.products.title"
        fields={fields}
        searchable
        renderRow={r => (
          <PfRowText
            primary={String(r.name)}
            secondary={String(r.description ?? '')}
            extra={
              <>
                {r.service_id ? <Badge variant="default">{serviceNames[String(r.service_id)] ?? '—'}</Badge> : null}
                {r.is_free === true
                  ? <Badge variant="success">{t('org.products.free')}</Badge>
                  : r.price !== null && <Badge variant="muted">${String(r.price)}</Badge>}
              </>
            }
          />
        )}
      />
    </OrgPage>
  );
};

const FAQ_FIELDS: PfField[] = [
  { name: 'question', label: 'org.faqs.question', type: 'text', required: true },
  { name: 'answer', label: 'org.faqs.answer', type: 'textarea', required: true },
];

export const OrgFaqs = () => (
  <OrgPage title="org.faqs.pageTitle" subtitle="pf.common.orderHint">
    <OrgList
      table="org_faqs"
      title="org.faqs.title"
      fields={FAQ_FIELDS}
      searchable
      renderRow={r => <PfRowText primary={String(r.question)} secondary={String(r.answer)} />}
    />
  </OrgPage>
);
