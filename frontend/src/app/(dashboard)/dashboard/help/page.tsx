'use client';

import { useTranslations } from 'next-intl';
import { HelpCircle } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function HelpPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('general.help')} icon={HelpCircle} />;
}
