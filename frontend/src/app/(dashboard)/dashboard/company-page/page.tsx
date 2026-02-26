'use client';

import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function CompanyPagePage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.companyPage')} icon={Globe} />;
}
