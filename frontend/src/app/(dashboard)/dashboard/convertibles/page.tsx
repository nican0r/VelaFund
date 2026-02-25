'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Repeat,
  CircleDollarSign,
  TrendingUp,
  Percent,
  Eye,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useConvertibles, useCancelConvertible } from '@/hooks/use-convertibles';
import type { ConvertibleSummary } from '@/hooks/use-convertibles';
import type { ConvertibleInstrument, InstrumentType, ConvertibleStatus } from '@/types/company';

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

function formatPercent(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(num / 100);
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
  type: InstrumentType,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<InstrumentType, { label: string; className: string }> = {
    MUTUO_CONVERSIVEL: { label: t('instrumentType.mutuoConversivel'), className: 'bg-blue-50 text-ocean-600' },
    INVESTIMENTO_ANJO: { label: t('instrumentType.investimentoAnjo'), className: 'bg-green-100 text-green-700' },
    MISTO: { label: t('instrumentType.misto'), className: 'bg-cream-100 text-cream-700' },
    MAIS: { label: t('instrumentType.mais'), className: 'bg-gray-100 text-gray-600' },
  };
  return map[type] || { label: type, className: 'bg-gray-100 text-gray-600' };
}

function getStatusBadge(
  status: ConvertibleStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<ConvertibleStatus, { label: string; className: string }> = {
    OUTSTANDING: { label: t('status.outstanding'), className: 'bg-green-100 text-green-700' },
    CONVERTED: { label: t('status.converted'), className: 'bg-blue-50 text-ocean-600' },
    REDEEMED: { label: t('status.redeemed'), className: 'bg-cream-100 text-cream-700' },
    MATURED: { label: t('status.matured'), className: 'bg-gray-100 text-gray-600' },
    CANCELLED: { label: t('status.cancelled'), className: 'bg-gray-100 text-gray-500' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
}

function isCancellable(status: ConvertibleStatus): boolean {
  return status === 'OUTSTANDING';
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
              {t('pagination.previous')}
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
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// --- Main Page Component ---

export default function ConvertiblesPage() {
  const t = useTranslations('convertibles');
  const { selectedCompany, isLoading: companyLoading } = useCompany();

  const companyId = selectedCompany?.id;

  // State
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // Data fetching
  const { data, isLoading, error } = useConvertibles(companyId, {
    page,
    limit,
    status: statusFilter || undefined,
    sort: '-createdAt',
  });

  const cancelMutation = useCancelConvertible(companyId);

  const instruments = data?.data ?? [];
  const meta = data?.meta;
  const summary = (meta as (typeof meta & { summary?: ConvertibleSummary }))?.summary;
  const pageLoading = companyLoading || isLoading;

  // Client-side type filter (backend only filters by status)
  const filteredInstruments = useMemo(() => {
    if (!typeFilter) return instruments;
    return instruments.filter((c) => c.instrumentType === typeFilter);
  }, [instruments, typeFilter]);

  // Stats from summary or fallback
  const stats = useMemo(() => {
    if (summary) {
      return {
        total: meta?.total ?? 0,
        outstanding: summary.totalOutstanding,
        totalPrincipal: formatCurrency(summary.totalPrincipal),
        accruedInterest: formatCurrency(summary.totalAccruedInterest),
      };
    }
    return {
      total: meta?.total ?? 0,
      outstanding: instruments.filter((c) => c.status === 'OUTSTANDING').length,
      totalPrincipal: formatCurrency(
        instruments.reduce((acc, c) => acc + parseFloat(c.principalAmount || '0'), 0),
      ),
      accruedInterest: formatCurrency(
        instruments.reduce((acc, c) => acc + parseFloat(c.accruedInterest || '0'), 0),
      ),
    };
  }, [instruments, meta, summary]);

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
          href="/dashboard/convertibles/new"
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
          icon={Repeat}
          active
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.outstanding')}
          value={String(stats.outstanding)}
          icon={CircleDollarSign}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.totalPrincipal')}
          value={stats.totalPrincipal}
          icon={TrendingUp}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.accruedInterest')}
          value={stats.accruedInterest}
          icon={Percent}
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
            <option value="MUTUO_CONVERSIVEL">{t('instrumentType.mutuoConversivel')}</option>
            <option value="INVESTIMENTO_ANJO">{t('instrumentType.investimentoAnjo')}</option>
            <option value="MISTO">{t('instrumentType.misto')}</option>
            <option value="MAIS">{t('instrumentType.mais')}</option>
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
            <option value="OUTSTANDING">{t('status.outstanding')}</option>
            <option value="CONVERTED">{t('status.converted')}</option>
            <option value="REDEEMED">{t('status.redeemed')}</option>
            <option value="MATURED">{t('status.matured')}</option>
            <option value="CANCELLED">{t('status.cancelled')}</option>
          </select>
        </div>

        {/* Table */}
        {pageLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading convertible instruments'}
            </p>
          </div>
        ) : filteredInstruments.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <Repeat className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.issueDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.investor')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.type')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.principal')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.interestRate')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.accruedInterest')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.maturityDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInstruments.map((instrument) => {
                  const typeBadge = getTypeBadge(instrument.instrumentType, t);
                  const statusBadge = getStatusBadge(instrument.status, t);

                  return (
                    <tr key={instrument.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(instrument.issueDate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-700">
                        {instrument.shareholder?.name ?? '—'}
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
                        {formatCurrency(instrument.principalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatPercent(instrument.interestRate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatCurrency(instrument.accruedInterest)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(instrument.maturityDate)}
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
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/convertibles/${instrument.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {isCancellable(instrument.status) && (
                            <button
                              onClick={() => setCancelTarget(instrument.id)}
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
