import type { ComponentProps, ReactNode } from 'react';
import { PfListEditor } from '../../components/portfolio/PfListEditor';
import { useOrgEditor } from '../../lib/orgSite';
import { PfPageHeader } from '../Portfolio/PfPageHeader';
import { OrgMissing } from './OrgMissing';

type EditorProps = Omit<ComponentProps<typeof PfListEditor>, 'owner' | 'auditUserId' | 'upload'>;

/** PfListEditor scoped to the signed-in org, stamping created_by / updated_by. */
export const OrgList = (props: EditorProps) => {
  const { owner, auditUserId, upload } = useOrgEditor();
  return (
    <PfListEditor
      deleteHint="org.common.deleteHint"
      {...props}
      owner={owner}
      auditUserId={auditUserId}
      upload={upload}
    />
  );
};

/** Page shell for org pages; renders a notice instead when there is no org. */
export const OrgPage = ({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) => {
  const { orgId } = useOrgEditor();
  if (!orgId) return <OrgMissing />;
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </div>
  );
};
