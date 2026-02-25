'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Plus,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useTransactions, useCancelTransaction } from '@/hooks/use-transactions';
import type { Transaction } from '@/types/company';

// --- Brazilian number formatting (per i18n rules: always pt-BR format) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

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

// --- Stat Card ---

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}

function StatCard({ label, value, icon: Icon, active = false, loading = false }: StatCardProps) {
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
        <Icon className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')} />
      </div>
      {loading ? (
        <div className="mt-2 h-10 w-24 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className={cn('mt-2 text-stat', active ? 'text-white' : 'text-navy-900')}>
          {value}
        </p>
      )}
    </div>
  );
}

// --- Transaction type badge ---

type TransactionType = Transaction['type'];
type TransactionStatus = Transaction['status'];

function getTypeBadge(type: TransactionType, t: (key: string) => string) {
  const typeMap: Record<TransactionType, { label: string; className: string }> = {
    ISSUANCE: { label: t('type.issuance'), className: 'bg-green-100 text-green-700' },
    TRANSFER: { label: t('type.transfer'), className: 'bg-blue-50 text-ocean-600' },
    CONVERSION: { label: t('type.conversion'), className: 'bg-cream-100 text-cream-700' },
    CANCELLATION: { label: t('type.cancellation'), className: 'bg-red-50 text-[#991B1B]' },
    SPLIT: { label: t('type.split'), className: 'bg-gray-100 text-gray-600' },
  };
  return typeMap[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
}

// --- Transaction status badge ---

function getStatusBadge(status: TransactionStatus, t: (key: string) => string) {
  const statusMap: Record<TransactionStatus, { label: string; className: string }> = {
    DRAFT: { label: t('status.draft'), className: 'bg-gray-100 text-gray-600' },
    PENDING_APPROVAL: { label: t('status.pendingApproval'), className: 'bg-cream-100 text-cream-700' },
    SUBMITTED: { label: t('status.submitted'), className: 'bg-blue-50 text-ocean-600' },
    CONFIRMED: { label: t('status.confirmed'), className: 'bg-green-100 text-green-700' },
    FAILED: { label: t('status.failed'), className: 'bg-red-50 text-[#991B1B]' },
    CANCELLED: { label: t('status.cancelled'), className: 'bg-gray-100 text-gray-500' },
  };
  return statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

// --- Cancel confirmation dialog ---

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-navy-900/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800">
          {t('confirm.cancelTitle')}
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          {t('confirm.cancelDescription')}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            {t('confirm.cancel').includes('?') ? 'Não' : 'No'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? '...' : t('confirm.cancelTitle')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Loading skeleton ---

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// --- Helper: can this transaction be cancelled? ---

function isCancellable(status: TransactionStatus): boolean {
  return ['DRAFT', 'PENDING_APPROVAL', 'SUBMITTED', 'FAILED'].includes(status);
}

// --- Main Transactions Page ---

export default function TransactionsPage() {
  const t = useTranslations('transactions');
  const commonT = useTranslations('common');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Filters and pagination state
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch transactions
  const { data, isLoading, error } = useTransactions(companyId, {
    page,
    limit,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    sort: '-createdAt',
  });

  const transactions = data?.data ?? [];
  const meta = data?.meta;

  // Cancel mutation
  const cancelMutation = useCancelTransaction(companyId);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget);
      setCancelTarget(null);
    } catch {
      // Error handled by TanStack Query / API error toast
    }
  };

  // Compute stats from current page data
  const stats = useMemo(() => {
    if (!meta) return { total: 0, confirmed: 0, pending: 0, draft: 0 };
    return {
      total: meta.total,
      confirmed: transactions.filter((tx) => tx.status === 'CONFIRMED').length,
      pending: transactions.filter((tx) => tx.status === 'PENDING_APPROVAL' || tx.status === 'SUBMITTED').length,
      draft: transactions.filter((tx) => tx.status === 'DRAFT').length,
    };
  }, [transactions, meta]);

  const pageLoading = companyLoading || isLoading;

  // No company state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">{t('empty')}</h2>
        </div>
      </div>
    );
  }

  const totalPages = meta?.totalPages ?? 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
        </div>
        <Link
          href="/dashboard/transactions/new"
          className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
        >
          <Plus className="h-4 w-4" />
          {t('create')}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.total')}
          value={meta ? formatNumber(meta.total) : '—'}
          icon={ArrowLeftRight}
          active
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.confirmed')}
          value={formatNumber(stats.confirmed)}
          icon={CheckCircle2}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.pending')}
          value={formatNumber(stats.pending)}
          icon={Clock}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.draft')}
          value={formatNumber(stats.draft)}
          icon={FileText}
          loading={pageLoading}
        />
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Filters bar */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex gap-3">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            >
              <option value="">{t('filter.allTypes')}</option>
              <option value="ISSUANCE">{t('type.issuance')}</option>
              <option value="TRANSFER">{t('type.transfer')}</option>
              <option value="CONVERSION">{t('type.conversion')}</option>
              <option value="CANCELLATION">{t('type.cancellation')}</option>
              <option value="SPLIT">{t('type.split')}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            >
              <option value="">{t('filter.allStatuses')}</option>
              <option value="DRAFT">{t('status.draft')}</option>
              <option value="PENDING_APPROVAL">{t('status.pendingApproval')}</option>
              <option value="SUBMITTED">{t('status.submitted')}</option>
              <option value="CONFIRMED">{t('status.confirmed')}</option>
              <option value="FAILED">{t('status.failed')}</option>
              <option value="CANCELLED">{t('status.cancelled')}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {pageLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading transactions'}
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <ArrowLeftRight className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-base font-semibold text-gray-700">{t('empty')}</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.from')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.to')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.shareClass')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.quantity')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.value')}
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
                {transactions.map((tx) => {
                  const typeBadge = getTypeBadge(tx.type, t);
                  const statusBadge = getStatusBadge(tx.status, t);

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(tx.createdAt)}
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
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {tx.fromShareholder?.name ?? t('noFrom')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {tx.toShareholder?.name ?? t('noFrom')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {tx.shareClass.className}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatNumber(tx.quantity)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {tx.totalValue ? formatCurrency(tx.totalValue) : '—'}
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
                            href={`/dashboard/transactions/${tx.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title={commonT('edit')}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {isCancellable(tx.status) && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(tx.id)}
                              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title={commonT('cancel')}
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
        {meta && meta.totalPages > 1 && (
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
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('pagination.previous')}
              </button>
              <span className="text-sm text-gray-500">
                {t('pagination.page')} {page} {t('pagination.of')} {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
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
