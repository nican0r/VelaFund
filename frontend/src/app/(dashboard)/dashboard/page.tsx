'use client';

import { useTranslations } from 'next-intl';
import {
  Building2,
  Bell,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';

// --- Stat Card ---

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  active = false,
  loading = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-6 transition-shadow duration-150',
        active
          ? 'border-transparent bg-ocean-600 text-white shadow-md'
          : 'border-gray-200 bg-white shadow-sm',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            active ? 'text-white/80' : 'text-gray-500',
          )}
        >
          {label}
        </span>
        <Icon
          className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')}
        />
      </div>
      {loading ? (
        <div className="mt-2 h-10 w-24 animate-pulse rounded bg-gray-200" />
      ) : (
        <p
          className={cn(
            'mt-2 text-stat',
            active ? 'text-white' : 'text-navy-900',
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}

// --- Main Dashboard Page ---

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { selectedCompany, isLoading: companyLoading } = useCompany();

  // No company state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            {t('noCompany.title')}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {t('noCompany.description')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t('stats.company')}
          value={selectedCompany?.name ?? '—'}
          icon={Building2}
          active
          loading={companyLoading}
        />
        <StatCard
          label={t('stats.notifications')}
          value="—"
          icon={Bell}
          loading={companyLoading}
        />
        <StatCard
          label={t('stats.settings')}
          value="—"
          icon={Settings}
          loading={companyLoading}
        />
      </div>

      {/* Placeholder content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg bg-gray-50">
          <Building2 className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {t('description')}
          </p>
        </div>
      </div>
    </div>
  );
}
