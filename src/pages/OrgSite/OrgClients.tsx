import { useState } from 'react';
import { Star } from 'lucide-react';
import { PfRowText } from '../../components/portfolio/PfListEditor';
import type { PfField, PfRow } from '../../lib/portfolio';
import { formatDate, labelsFrom, optionsFrom } from '../../lib/orgSite';
import { OrgList, OrgPage } from './OrgList';

const CLIENT_FIELDS: PfField[] = [
  { name: 'organization', label: 'org.clients.organization', type: 'text', required: true },
  { name: 'joined_at', label: 'org.clients.joinedAt', type: 'date' },
];

const Stars = ({ rating }: { rating: number }) => (
  <span className="inline-flex">
    {Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={12} className={i < rating ? 'fill-warning text-warning' : 'text-gray-300'} />
    ))}
  </span>
);

/** Clients, and what they said (only visible testimonials reach the site). */
export const OrgClients = () => {
  // The testimonial editor picks from the clients the editor above loaded.
  const [clients, setClients] = useState<PfRow[]>([]);
  const clientNames = labelsFrom(clients, 'organization');

  const testimonialFields: PfField[] = [
    { name: 'client_id', label: 'org.clients.client', type: 'select', required: true, options: optionsFrom(clients, 'organization'), initial: clients[0]?.id ?? '' },
    { name: 'content', label: 'org.clients.content', type: 'textarea', required: true },
    { name: 'rating', label: 'org.clients.rating', type: 'number', min: 1, max: 5, initial: '5', required: true },
  ];

  return (
    <OrgPage title="org.clients.pageTitle" subtitle="pf.common.orderHint">
      <OrgList
        table="org_clients"
        title="org.clients.title"
        fields={CLIENT_FIELDS}
        onRowsChange={setClients}
        renderRow={r => <PfRowText primary={String(r.organization)} secondary={formatDate(r.joined_at)} />}
      />
      <OrgList
        table="org_testimonials"
        title="org.clients.testimonials"
        subtitle="org.clients.testimonialsHint"
        fields={testimonialFields}
        renderRow={r => (
          <PfRowText
            primary={clientNames[String(r.client_id)] ?? '—'}
            secondary={String(r.content)}
            extra={<Stars rating={Number(r.rating)} />}
          />
        )}
      />
    </OrgPage>
  );
};
