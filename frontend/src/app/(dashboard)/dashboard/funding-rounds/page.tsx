'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  TrendingUp,
  CircleDollarSign,
  CheckCircle2,
  FileEdit,
  Eye,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useFundingRounds, useCancelFundingRound } from '@/hooks/use-funding-rounds';
import type { FundingRound, RoundType, FundingRoundStatus } from '@/types/company';

// --- Formatting helpers (always pt-BR per i18n rules) ---

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

// --- Sub-components ---

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}

function StatCard({ label, value, icon: Icon, active, loading }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-6 transition-shadow',
        active
          ? 'border-transparent bg-ocean-600 text-white shadow-md'
          : 'border border-gray-200 bg-white shadow-sm',
      )}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')}
        />
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            active ? 'text-white/80' : 'text-gray-500',
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-10 w-24 animate-pulse rounded bg-gray-200" />
        ) : (
          <span
            className={cn(
              'text-stat',
              active ? 'text-white' : 'text-navy-900',
            )}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

function getTypeBadge(
  type: RoundType,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<RoundType, { label: string; className: string }> = {
    PRE_SEED: { label: t('type.preSeed'), className: 'bg-gray-100 text-gray-600' },
    SEED: { label: t('type.seed'), className: 'bg-green-100 text-green-700' },
    SERIES_A: { label: t('type.seriesA'), className: 'bg-blue-50 text-ocean-600' },
    SERIES_B: { label: t('type.seriesB'), className: 'bg-blue-50 text-ocean-600' },
    SERIES_C: { label: t('type.seriesC'), className: 'bg-blue-50 text-ocean-600' },
    BRIDGE: { label: t('type.bridge'), className: 'bg-cream-100 text-cream-700' },
    OTHER: { label: t('type.other'), className: 'bg-gray-100 text-gray-500' },
  };
  return map[type] || { label: type, className: 'bg-gray-100 text-gray-600' };
}

function getStatusBadge(
  status: FundingRoundStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<FundingRoundStatus, { label: string; className: string }> = {
    DRAFT: { label: t('status.draft'), className: 'bg-gray-100 text-gray-600' },
    OPEN: { label: t('status.open'), className: 'bg-green-100 text-green-700' },
    CLOSING: { label: t('status.closing'), className: 'bg-cream-100 text-cream-700' },
    CLOSED: { label: t('status.closed'), className: 'bg-blue-50 text-ocean-600' },
    CANCELLED: { label: t('status.cancelled'), className: 'bg-gray-100 text-gray-500' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
}

function isCancellable(status: FundingRoundStatus): boolean {
  return status === 'DRAFT' || status === 'OPEN';
}

function CancelDialog({
  open,
  onClose,
  onConfirm,
  loading,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: (key: string) => string;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-navy-900/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-navy-900">
            {t('confirm.cancelTitle')}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {t('confirm.cancelDescription')}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {t('actions') === 'Ações' ? 'Voltar' : 'Go Back'}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {t('confirm.cancel')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// --- Main Page Component ---

export default function FundingRoundsPage() {
  const t = useTranslations('fundingRounds');
  const { selectedCompany, isLoading: companyLoading } = useCompany();

  const companyId = selectedCompany?.id;

  // State
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // Data fetching
  const { data, isLoading, error } = useFundingRounds(companyId, {
    page,
    limit,
    status: statusFilter || undefined,
    sort: '-createdAt',
  });

  const cancelMutation = useCancelFundingRound(companyId);

  const rounds = data?.data ?? [];
  const meta = data?.meta;
  const pageLoading = companyLoading || isLoading;

  // Client-side type filter (backend only filters by status)
  const filteredRounds = useMemo(() => {
    if (!typeFilter) return rounds;
    return rounds.filter((r) => r.roundType === typeFilter);
  }, [rounds, typeFilter]);

  // Stats derived from current page data
  const stats = useMemo(() => {
    if (!meta) return { total: 0, open: 0, closed: 0, draft: 0 };
    return {
      total: meta.total,
      open: rounds.filter((r) => r.status === 'OPEN' || r.status === 'CLOSING').length,
      closed: rounds.filter((r) => r.status === 'CLOSED').length,
      draft: rounds.filter((r) => r.status === 'DRAFT').length,
    };
  }, [rounds, meta]);

  // Cancel handler
  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget);
      setCancelTarget(null);
    } catch {
      // Error handled by API error toast
    }
  };

  // No company state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
        </div>
      </div>
    );
  }

  const totalPages = meta?.totalPages ?? 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] text-navy-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
        </div>
        <Link
          href="/dashboard/funding-rounds/new"
          className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
        >
          <Plus className="h-4 w-4" />
          {t('create')}
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.total')}
          value={String(stats.total)}
          icon={TrendingUp}
          active
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.open')}
          value={String(stats.open)}
          icon={CircleDollarSign}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.closed')}
          value={String(stats.closed)}
          icon={CheckCircle2}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.draft')}
          value={String(stats.draft)}
          icon={FileEdit}
          loading={pageLoading}
        />
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filter.allTypes')}</option>
            <option value="PRE_SEED">{t('type.preSeed')}</option>
            <option value="SEED">{t('type.seed')}</option>
            <option value="SERIES_A">{t('type.seriesA')}</option>
            <option value="SERIES_B">{t('type.seriesB')}</option>
            <option value="SERIES_C">{t('type.seriesC')}</option>
            <option value="BRIDGE">{t('type.bridge')}</option>
            <option value="OTHER">{t('type.other')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="DRAFT">{t('status.draft')}</option>
            <option value="OPEN">{t('status.open')}</option>
            <option value="CLOSING">{t('status.closing')}</option>
            <option value="CLOSED">{t('status.closed')}</option>
            <option value="CANCELLED">{t('status.cancelled')}</option>
          </select>
        </div>

        {/* Table */}
        {pageLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading funding rounds'}
            </p>
          </div>
        ) : filteredRounds.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <TrendingUp className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.type')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.target')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.preMoney')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.pricePerShare')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.closeDate')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRounds.map((round) => {
                  const typeBadge = getTypeBadge(round.roundType, t);
                  const statusBadge = getStatusBadge(round.status, t);

                  return (
                    <tr key={round.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-700">
                        {round.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            typeBadge.className,
                          )}
                        >
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatCurrency(round.targetAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatCurrency(round.preMoneyValuation)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatCurrency(round.pricePerShare)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusBadge.className,
                          )}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {round.targetCloseDate
                          ? formatDate(round.targetCloseDate)
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/funding-rounds/${round.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {isCancellable(round.status) && (
                            <button
                              onClick={() => setCancelTarget(round.id)}
                              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-500">
              {t('pagination.showing', {
                from: (page - 1) * limit + 1,
                to: Math.min(page * limit, meta.total),
                total: meta.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('pagination.previous')}
              </button>
              <span className="text-sm text-gray-500">
                {t('pagination.page')} {page} {t('pagination.of')} {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      <CancelDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelMutation.isPending}
        t={t}
      />
    </div>
  );
}
