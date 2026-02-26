'use client';

import { useTranslations } from 'next-intl';
import { MessageSquare } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function QaConversationsPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.investorQA')} icon={MessageSquare} />;
}
