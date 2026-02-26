'use client';

import { useTranslations } from 'next-intl';
import { FolderOpen } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function DataroomPage() {
  const t = useTranslations('sidebar');
  return <ComingSoon title={t('menu.dataroom')} icon={FolderOpen} />;
}
