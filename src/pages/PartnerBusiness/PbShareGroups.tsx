import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { ShareGroupsCard } from '../../components/partnerBusiness/ShareGroupsCard';
import type { PbPartner, PbShareGroupFund, PbGeneralFund } from '../../types/partnerBusiness';

/**
 * Share groups and their funds, on their own page rather than tucked under
 * Partners — the fund actions move real capital, so they earn the space.
 */
export const PbShareGroups = () => {
  const { t } = useLanguage();
  const [partners, setPartners] = useState<PbPartner[]>([]);
  const [funds, setFunds] = useState<PbShareGroupFund[]>([]);
  const [general, setGeneral] = useState<PbGeneralFund | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { fetchAll(); }, [reloadKey]);

  const fetchAll = async () => {
    try {
      const [p, f, g] = await Promise.all([
        supabase.from('pb_partners').select('*').eq('is_active', true).order('name'),
        supabase.from('pb_share_group_fund').select('*'),
        supabase.from('pb_general_fund').select('*').single(),
      ]);
      for (const r of [p, f, g]) if (r.error) throw r.error;
      setPartners(p.data ?? []);
      setFunds(f.data ?? []);
      setGeneral(g.data ?? null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.groups.loadError'));
    }
  };

  const inGroups = funds.reduce((s, f) => s + Number(f.remaining), 0);
  const generalLeft = Number(general?.remaining ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('pb.groups.title')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('pb.groups.subtitle')}</p>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.groups.count'), value: funds.length },
          { label: t('pb.groups.inGroupFunds'), value: formatTaka(inGroups), tone: 'text-success' },
          {
            label: t('pb.groups.generalAvailable'),
            value: formatTaka(generalLeft),
            tone: generalLeft < 0 ? 'text-danger' : 'text-success',
          },
        ]}
      />

      <ShareGroupsCard partners={partners} onFundChanged={() => setReloadKey(k => k + 1)} />
    </div>
  );
};
