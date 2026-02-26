'use client';

import { useTranslations } from 'next-intl';
import { Megaphone } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function UpdatesPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.updates')} icon={Megaphone} />;
}
