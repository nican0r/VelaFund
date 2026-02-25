'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Layers,
  Users,
  Grid3X3,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useCapTable } from '@/hooks/use-cap-table';
import { useRecentTransactions } from '@/hooks/use-transactions';
import { OwnershipChart } from '@/components/dashboard/ownership-chart';
import type { Transaction } from '@/types/company';

// --- Brazilian number formatting (per i18n rules: always pt-BR format) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

// --- Stat Card ---

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}

function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
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
      {change && !loading && (
        <div className="mt-1 flex items-center gap-x-1">
          {changeType === 'positive' && (
            <TrendingUp
              className={cn(
                'h-3.5 w-3.5',
                active ? 'text-white/80' : 'text-celadon-700',
              )}
            />
          )}
          {changeType === 'negative' && (
            <TrendingDown
              className={cn(
                'h-3.5 w-3.5',
                active ? 'text-white/80' : 'text-[#DC2626]',
              )}
            />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              active
                ? 'text-white/80'
                : changeType === 'positive'
                  ? 'text-celadon-700'
                  : changeType === 'negative'
                    ? 'text-[#DC2626]'
                    : 'text-gray-500',
            )}
          >
            {change}
          </span>
        </div>
      )}
    </div>
  );
}

// --- Skeleton for loading states ---

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

// --- Transaction type labels ---

function getTransactionTypeBadge(
  type: Transaction['type'],
  t: (key: string) => string,
): { label: string; color: string } {
  switch (type) {
    case 'ISSUANCE':
      return { label: t('types.issuance'), color: 'bg-green-100 text-green-700' };
    case 'TRANSFER':
      return { label: t('types.transfer'), color: 'bg-blue-50 text-ocean-600' };
    case 'CONVERSION':
      return { label: t('types.conversion'), color: 'bg-cream-100 text-cream-700' };
    case 'CANCELLATION':
      return { label: t('types.cancellation'), color: 'bg-red-50 text-[#991B1B]' };
    case 'SPLIT':
      return { label: t('types.split'), color: 'bg-gray-100 text-gray-600' };
    default:
      return { label: type, color: 'bg-gray-100 text-gray-600' };
  }
}

function getTransactionTarget(tx: Transaction): string {
  if (tx.type === 'TRANSFER') {
    return tx.toShareholder?.name ?? '—';
  }
  if (tx.type === 'ISSUANCE') {
    return tx.toShareholder?.name ?? '—';
  }
  if (tx.type === 'CANCELLATION') {
    return tx.fromShareholder?.name ?? '—';
  }
  return tx.toShareholder?.name ?? tx.fromShareholder?.name ?? '—';
}

// --- Main Dashboard Page ---

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { selectedCompany, isLoading: companyLoading } = useCompany();

  const companyId = selectedCompany?.id;

  const {
    data: capTable,
    isLoading: capTableLoading,
    error: capTableError,
  } = useCapTable(companyId);

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
  } = useRecentTransactions(companyId);

  const isLoading = companyLoading || capTableLoading;
  const transactions = txData?.data ?? [];
  const txTotal = txData?.meta?.total ?? 0;

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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.totalShares')}
          value={
            capTable ? formatNumber(capTable.summary.totalShares) : '—'
          }
          icon={Layers}
          active
          loading={isLoading}
        />
        <StatCard
          label={t('stats.shareholders')}
          value={
            capTable
              ? formatNumber(capTable.summary.totalShareholders)
              : '—'
          }
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.shareClasses')}
          value={
            capTable
              ? formatNumber(capTable.summary.totalShareClasses)
              : '—'
          }
          icon={Grid3X3}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.transactions')}
          value={txData ? formatNumber(txTotal) : '—'}
          icon={ArrowLeftRight}
          loading={isLoading || txLoading}
        />
      </div>

      {/* Content section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ownership chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800">
            {t('ownership.title')}
          </h2>
          <p className="mt-1 text-[13px] text-gray-500">
            {t('ownership.description')}
          </p>
          <div className="mt-6">
            {isLoading ? (
              <div className="flex h-[240px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ocean-600 border-t-transparent" />
              </div>
            ) : capTableError ? (
              <div className="flex h-[240px] items-center justify-center rounded-lg bg-gray-50">
                <p className="text-sm text-gray-400">—</p>
              </div>
            ) : capTable?.entries?.length ? (
              <OwnershipChart
                entries={capTable.entries}
                othersLabel={t('ownership.others')}
              />
            ) : (
              <div className="flex h-[240px] items-center justify-center rounded-lg bg-gray-50">
                <p className="text-sm text-gray-400">
                  {t('ownership.empty')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                {t('recentTransactions.title')}
              </h2>
              <p className="mt-1 text-[13px] text-gray-500">
                {t('recentTransactions.description')}
              </p>
            </div>
            {transactions.length > 0 && (
              <Link
                href="/dashboard/transactions"
                className="text-sm font-medium text-ocean-600 transition-colors duration-150 hover:text-ocean-700"
              >
                {t('recentTransactions.viewAll')}
              </Link>
            )}
          </div>
          <div className="mt-6 space-y-3">
            {txLoading || isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-gray-100"
                />
              ))
            ) : txError ? (
              <div className="flex h-32 items-center justify-center rounded-lg bg-gray-50">
                <p className="text-sm text-gray-400">—</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-lg bg-gray-50">
                <ArrowLeftRight className="h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-400">
                  {t('recentTransactions.empty')}
                </p>
              </div>
            ) : (
              transactions.map((tx) => {
                const badge = getTransactionTypeBadge(tx.type, t);
                const target = getTransactionTarget(tx);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                            badge.color,
                          )}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {tx.shareClass?.className}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {target}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm font-medium tabular-nums text-gray-700">
                        {formatNumber(tx.quantity)}{' '}
                        <span className="text-xs font-normal text-gray-400">
                          {t('recentTransactions.shares')}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">
          {t('quickActions.title')}
        </h2>
        <p className="mt-1 text-[13px] text-gray-500">
          {t('quickActions.description')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/transactions"
            className="inline-flex items-center gap-x-2 rounded-md bg-ocean-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-ocean-500 active:bg-ocean-700"
          >
            <Plus className="h-4 w-4" />
            {t('quickActions.issueShares')}
          </Link>
          <Link
            href="/dashboard/shareholders"
            className="inline-flex items-center gap-x-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50"
          >
            <Users className="h-4 w-4" />
            {t('quickActions.addShareholder')}
          </Link>
          <Link
            href="/dashboard/transactions"
            className="inline-flex items-center gap-x-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50"
          >
            <ArrowLeftRight className="h-4 w-4" />
            {t('quickActions.recordTransfer')}
          </Link>
          <Link
            href="/dashboard/cap-table"
            className="inline-flex items-center gap-x-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            {t('quickActions.exportCapTable')}
          </Link>
        </div>
      </div>
    </div>
  );
}
