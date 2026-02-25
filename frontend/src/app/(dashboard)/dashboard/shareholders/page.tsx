'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Users,
  Building2,
  Globe,
  UserCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useShareholders, useDeleteShareholder } from '@/hooks/use-shareholders';
import type { Shareholder, ShareholderType, ShareholderStatus } from '@/types/company';

// --- Brazilian number formatting (per i18n rules: always pt-BR format) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

function maskCpfCnpj(value: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    // CPF: show first 3 and last 2
    return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
  }
  if (digits.length === 14) {
    // CNPJ: show first 2 and last 2
    return `${digits.slice(0, 2)}.***.***/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }
  return value;
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

// --- Shareholder type badge ---

function getTypeBadge(type: ShareholderType, t: (key: string) => string) {
  const typeMap: Record<ShareholderType, { label: string; className: string }> = {
    FOUNDER: { label: t('type.founder'), className: 'bg-navy-50 text-navy-700' },
    INVESTOR: { label: t('type.investor'), className: 'bg-blue-50 text-ocean-600' },
    EMPLOYEE: { label: t('type.employee'), className: 'bg-green-100 text-celadon-700' },
    ADVISOR: { label: t('type.advisor'), className: 'bg-cream-100 text-cream-700' },
    CORPORATE: { label: t('type.corporate'), className: 'bg-gray-100 text-gray-600' },
  };
  return typeMap[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
}

// --- Shareholder status badge ---

function getStatusBadge(status: ShareholderStatus, t: (key: string) => string) {
  const statusMap: Record<ShareholderStatus, { label: string; className: string }> = {
    ACTIVE: { label: t('status.active'), className: 'bg-green-100 text-green-700' },
    INACTIVE: { label: t('status.inactive'), className: 'bg-gray-100 text-gray-500' },
    PENDING: { label: t('status.pending'), className: 'bg-cream-100 text-cream-700' },
  };
  return statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

// --- Delete confirmation dialog ---

function DeleteDialog({
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
            {t('confirm.delete').includes('?') ? 'Cancelar' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? '...' : t('confirm.deleteTitle')}
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
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// --- Main Shareholders Page ---

export default function ShareholdersPage() {
  const t = useTranslations('shareholders');
  const commonT = useTranslations('common');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Filters and pagination state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Debounced search — triggers API call with search param
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Simple debounce via timeout
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    // Debounce search input
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timer);
  };

  // Fetch shareholders
  const { data, isLoading, error } = useShareholders(companyId, {
    page,
    limit,
    search: debouncedSearch || undefined,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    sort: '-createdAt',
  });

  const shareholders = data?.data ?? [];
  const meta = data?.meta;

  // Delete mutation
  const deleteMutation = useDeleteShareholder(companyId);
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

  // Compute stats from current page data
  const stats = useMemo(() => {
    if (!meta) return { total: 0, active: 0, corporate: 0, foreign: 0 };
    return {
      total: meta.total,
      active: shareholders.filter((s) => s.status === 'ACTIVE').length,
      corporate: shareholders.filter((s) => s.type === 'CORPORATE').length,
      foreign: shareholders.filter((s) => s.isForeign).length,
    };
  }, [shareholders, meta]);

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
          href="/dashboard/shareholders/new"
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
          icon={Users}
          active
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.active')}
          value={formatNumber(stats.active)}
          icon={UserCheck}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.corporate')}
          value={formatNumber(stats.corporate)}
          icon={Building2}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.foreign')}
          value={formatNumber(stats.foreign)}
          icon={Globe}
          loading={pageLoading}
        />
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Filters bar */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('filter.searchPlaceholder')}
              className="h-10 w-full rounded-md border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            >
              <option value="">{t('filter.allTypes')}</option>
              <option value="FOUNDER">{t('type.founder')}</option>
              <option value="INVESTOR">{t('type.investor')}</option>
              <option value="EMPLOYEE">{t('type.employee')}</option>
              <option value="ADVISOR">{t('type.advisor')}</option>
              <option value="CORPORATE">{t('type.corporate')}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            >
              <option value="">{t('filter.allStatuses')}</option>
              <option value="ACTIVE">{t('status.active')}</option>
              <option value="INACTIVE">{t('status.inactive')}</option>
              <option value="PENDING">{t('status.pending')}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {pageLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading shareholders'}
            </p>
          </div>
        ) : shareholders.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <Users className="h-12 w-12 text-gray-300" />
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
                    {t('table.cpfCnpj')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.email')}
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
                {shareholders.map((shareholder) => {
                  const typeBadge = getTypeBadge(shareholder.type, t);
                  const statusBadge = getStatusBadge(shareholder.status, t);

                  return (
                    <tr key={shareholder.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {shareholder.name}
                          </span>
                          {shareholder.isForeign && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-ocean-600"
                              title={t('foreign')}
                            >
                              <Globe className="h-3 w-3" />
                              {t('foreign')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-mono text-sm text-gray-500">
                          {maskCpfCnpj(shareholder.cpfCnpj)}
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
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {shareholder.email ?? '—'}
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
                            href={`/dashboard/shareholders/${shareholder.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title={commonT('edit')}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(shareholder.id)}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title={commonT('delete')}
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
      />
    </div>
  );
}
