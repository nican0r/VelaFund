'use client';

import { useTranslations } from 'next-intl';
import { Construction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  icon?: LucideIcon;
}

export function ComingSoon({ title, icon: Icon = Construction }: ComingSoonProps) {
  const t = useTranslations('comingSoon');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
          {title}
        </h1>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg bg-gray-50">
          <Icon className="h-16 w-16 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            {t('title')}
          </h2>
          <p className="mt-2 max-w-md text-center text-sm text-gray-500">
            {t('description')}
          </p>
        </div>
      </div>
    </div>
  );
}
