'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Layers,
  ShieldCheck,
  BarChart3,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useShareClasses, useDeleteShareClass } from '@/hooks/use-share-classes';
import type { ShareClass, ShareClassType } from '@/types/company';

// --- Brazilian number formatting (per i18n rules: always pt-BR format) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatPercentage(issued: string, authorized: string): string {
  const issuedNum = parseFloat(issued);
  const authorizedNum = parseFloat(authorized);
  if (isNaN(issuedNum) || isNaN(authorizedNum) || authorizedNum === 0) return '0%';
  const pct = (issuedNum / authorizedNum) * 100;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pct) + '%';
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

// --- Share class type badge ---

function getTypeBadge(type: ShareClassType, t: (key: string) => string) {
  const typeMap: Record<ShareClassType, { label: string; className: string }> = {
    QUOTA: { label: t('type.quota'), className: 'bg-blue-50 text-ocean-600' },
    COMMON_SHARES: { label: t('type.commonShares'), className: 'bg-green-100 text-celadon-700' },
    PREFERRED_SHARES: { label: t('type.preferredShares'), className: 'bg-cream-100 text-cream-700' },
  };
  return typeMap[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
}

// --- Delete confirmation dialog ---

function DeleteDialog({
  open,
  onClose,
  onConfirm,
  loading,
  t,
  commonT,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: (key: string) => string;
  commonT: (key: string) => string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-navy-900/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800">
          {t('confirm.deleteTitle')}
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          {t('confirm.deleteDescription')}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            {commonT('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? '...' : commonT('delete')}
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
          <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// --- Main Share Classes Page ---

export default function ShareClassesPage() {
  const t = useTranslations('shareClasses');
  const commonT = useTranslations('common');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Filters and pagination state
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch share classes
  const { data, isLoading, error } = useShareClasses(companyId, {
    page,
    limit,
    type: typeFilter || undefined,
    sort: '-createdAt',
  });

  const shareClasses = data?.data ?? [];
  const meta = data?.meta;

  // Delete mutation
  const deleteMutation = useDeleteShareClass(companyId);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      setDeleteTarget(null);
    } catch {
      // Error handled by TanStack Query / API error toast
    }
  };

  // Compute stats from current data
  const stats = useMemo(() => {
    if (!meta) return { total: 0, totalIssued: 0, totalAvailable: 0, preferred: 0 };
    let totalIssued = 0;
    let totalAuthorized = 0;
    let preferred = 0;
    for (const sc of shareClasses) {
      totalIssued += parseFloat(sc.totalIssued) || 0;
      totalAuthorized += parseFloat(sc.totalAuthorized) || 0;
      if (sc.type === 'PREFERRED_SHARES') preferred++;
    }
    return {
      total: meta.total,
      totalIssued,
      totalAvailable: totalAuthorized - totalIssued,
      preferred,
    };
  }, [shareClasses, meta]);

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
          href="/dashboard/share-classes/new"
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
          icon={Layers}
          active
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.issued')}
          value={formatNumber(stats.totalIssued)}
          icon={BarChart3}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.available')}
          value={formatNumber(stats.totalAvailable)}
          icon={ShieldCheck}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.preferred')}
          value={formatNumber(stats.preferred)}
          icon={Layers}
          loading={pageLoading}
        />
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Filters bar */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <span className="text-sm font-medium text-gray-700">
            {meta ? t('pagination.showing', { from: 1, to: shareClasses.length, total: meta.total }) : ''}
          </span>
          <div className="flex gap-3">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            >
              <option value="">{t('filter.allTypes')}</option>
              <option value="QUOTA">{t('type.quota')}</option>
              <option value="COMMON_SHARES">{t('type.commonShares')}</option>
              <option value="PREFERRED_SHARES">{t('type.preferredShares')}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {pageLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading share classes'}
            </p>
          </div>
        ) : shareClasses.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <Layers className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-base font-semibold text-gray-700">{t('empty')}</h3>
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
                    {t('table.votesPerShare')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.authorized')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.issued')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.issuedPct')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.lockUp')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shareClasses.map((sc) => {
                  const typeBadge = getTypeBadge(sc.type, t);
                  const issuedPct = formatPercentage(sc.totalIssued, sc.totalAuthorized);
                  const hasIssued = parseFloat(sc.totalIssued) > 0;

                  return (
                    <tr key={sc.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-sm font-medium text-gray-700">
                          {sc.className}
                        </span>
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
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-sm text-gray-700">
                        {sc.votesPerShare}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-sm text-gray-700">
                        {formatNumber(sc.totalAuthorized)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-sm text-gray-700">
                        {formatNumber(sc.totalIssued)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-sm text-gray-700">
                        {issuedPct}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {sc.lockUpPeriodMonths
                          ? t('table.lockUpMonths', { months: sc.lockUpPeriodMonths })
                          : t('table.noLockUp')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/share-classes/${sc.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title={commonT('edit')}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(sc.id)}
                            disabled={hasIssued}
                            className={cn(
                              'rounded-md p-2 transition-colors',
                              hasIssued
                                ? 'cursor-not-allowed text-gray-200'
                                : 'text-gray-400 hover:bg-red-50 hover:text-red-600',
                            )}
                            title={hasIssued ? t('confirm.deleteDescription') : commonT('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* Delete confirmation dialog */}
      <DeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        t={t}
        commonT={commonT}
      />
    </div>
  );
}
