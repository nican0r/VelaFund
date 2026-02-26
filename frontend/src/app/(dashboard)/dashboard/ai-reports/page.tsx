'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function AiReportsPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.aiReports')} icon={Sparkles} />;
}
