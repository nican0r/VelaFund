'use client';

import { useTranslations } from 'next-intl';
import { Landmark } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function BankConnectionsPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.bankConnections')} icon={Landmark} />;
}
