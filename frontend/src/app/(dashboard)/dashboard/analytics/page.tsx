'use client';

import { useTranslations } from 'next-intl';
import { BarChart3 } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function AnalyticsPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.analytics')} icon={BarChart3} />;
}
