'use client';

import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function InvestorsPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.investors')} icon={Users} />;
}
