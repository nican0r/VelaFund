'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gift,
  Loader2,
  Lock,
  Plus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useOptionPlan,
  useOptionGrants,
  useClosePlan,
  useCancelGrant,
} from '@/hooks/use-option-plans';
import type {
  OptionPlan,
  OptionPlanStatus,
  OptionGrant,
  OptionGrantStatus,
  TerminationPolicy,
  VestingFrequency,
} from '@/types/company';

// --- Formatting helpers (always pt-BR per i18n rules) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
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

function formatPercentage(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

// --- Badge helpers ---

function getStatusBadge(
  status: OptionPlanStatus,
  t: (key: string) => string,
) {
  const statusMap: Record<
    OptionPlanStatus,
    { label: string; className: string }
  > = {
    ACTIVE: {
      label: t('planStatus.active'),
      className: 'bg-green-100 text-green-700',
    },
    CLOSED: {
      label: t('planStatus.closed'),
      className: 'bg-gray-100 text-gray-500',
    },
  };
  return statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

function getGrantStatusBadge(
  status: OptionGrantStatus,
  t: (key: string) => string,
) {
  const statusMap: Record<
    OptionGrantStatus,
    { label: string; className: string }
  > = {
    ACTIVE: {
      label: t('grantStatus.active'),
      className: 'bg-green-100 text-green-700',
    },
    EXERCISED: {
      label: t('grantStatus.exercised'),
      className: 'bg-blue-50 text-ocean-600',
    },
    CANCELLED: {
      label: t('grantStatus.cancelled'),
      className: 'bg-gray-100 text-gray-500',
    },
    EXPIRED: {
      label: t('grantStatus.expired'),
      className: 'bg-cream-100 text-cream-700',
    },
  };
  return statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

// --- Sub-components ---

function StatCard({
  label,
  value,
  icon: Icon,
  active = false,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl p-5',
        active
          ? 'bg-ocean-600 text-white shadow-md'
          : 'bg-white border border-gray-200',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            active ? 'bg-white/20' : 'bg-gray-100',
          )}
        >
          <Icon
            className={cn('h-5 w-5', active ? 'text-white' : 'text-gray-500')}
          />
        </div>
        <div>
          <p
            className={cn(
              'text-xs font-medium',
              active ? 'text-white/80' : 'text-gray-500',
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              'text-2xl font-bold',
              active ? 'text-white' : 'text-navy-900',
            )}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
  title,
  description,
  confirmLabel,
  variant = 'destructive',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'primary' | 'destructive';
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-navy-900/50"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            {/* Reuse common.cancel from the namespace's cancel button pattern */}
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white',
              variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-ocean-600 hover:bg-ocean-700',
              loading && 'opacity-75',
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Back link */}
      <div className="h-5 w-48 bg-gray-200 rounded mb-6" />
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      {/* Pool bar */}
      <div className="h-4 bg-gray-200 rounded-full mb-8" />
      {/* Tabs + table */}
      <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

// --- Main page component ---

export default function OptionPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('optionPlans');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Plan data
  const {
    data: plan,
    isLoading: planLoading,
    error: planError,
  } = useOptionPlan(companyId, id);

  // Tab state
  const [activeTab, setActiveTab] = useState<'grants' | 'details'>('grants');

  // Grant list state
  const [grantPage, setGrantPage] = useState(1);
  const [grantStatusFilter, setGrantStatusFilter] = useState('');
  const grantsLimit = 10;

  // Grants data (only fetch when on grants tab)
  const {
    data: grantsData,
    isLoading: grantsLoading,
  } = useOptionGrants(activeTab === 'grants' ? companyId : undefined, {
    optionPlanId: id,
    page: grantPage,
    limit: grantsLimit,
    status: grantStatusFilter || undefined,
    sort: '-grantDate',
  });

  // Mutations
  const closePlanMutation = useClosePlan(companyId);
  const cancelGrantMutation = useCancelGrant(companyId);

  // Dialog state
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [cancelGrantId, setCancelGrantId] = useState<string | null>(null);

  const isLoading = companyLoading || planLoading;

  // Computed values
  const totalPool = plan ? parseFloat(plan.totalPoolSize) : 0;
  const totalGranted = plan ? parseFloat(plan.totalGranted) : 0;
  const totalExercised = plan ? parseFloat(plan.totalExercised) : 0;
  const optionsAvailable = plan
    ? plan.optionsAvailable
      ? parseFloat(plan.optionsAvailable)
      : totalPool - totalGranted
    : 0;
  const utilizationPct = totalPool > 0 ? (totalGranted / totalPool) * 100 : 0;

  // Handlers
  const handleClosePlan = async () => {
    try {
      await closePlanMutation.mutateAsync(id);
      setShowCloseDialog(false);
    } catch {
      // Error handled by TanStack Query / API error toast
    }
  };

  const handleCancelGrant = async () => {
    if (!cancelGrantId) return;
    try {
      await cancelGrantMutation.mutateAsync(cancelGrantId);
      setCancelGrantId(null);
    } catch {
      // Error handled by TanStack Query / API error toast
    }
  };

  // --- Guard states ---

  if (!companyId && !companyLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Gift className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            Selecione uma empresa para continuar.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (planError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/options"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('planDetail.back')}
        </Link>
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-red-600">{t('planDetail.error')}</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/options"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('planDetail.back')}
        </Link>
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="text-center">
            <Gift className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {t('planDetail.notFound')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Happy path ---

  const statusBadge = getStatusBadge(plan.status, t);
  const grants = grantsData?.data ?? [];
  const grantsMeta = grantsData?.meta;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/options"
        className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('planDetail.back')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy-900">{plan.name}</h1>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              statusBadge.className,
            )}
          >
            {statusBadge.label}
          </span>
          {plan.shareClass && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-ocean-600">
              {plan.shareClass.className}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {plan.status === 'ACTIVE' && (
            <>
              <Link
                href={`/dashboard/options/grants/new?planId=${plan.id}`}
                className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ocean-700"
              >
                <Plus className="h-4 w-4" />
                {t('planDetail.newGrant')}
              </Link>
              <button
                onClick={() => setShowCloseDialog(true)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Lock className="h-4 w-4" />
                {t('planDetail.closePlan')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <StatCard
          label={t('table.totalPool')}
          value={formatNumber(totalPool)}
          icon={Gift}
          active
        />
        <StatCard
          label={t('table.granted')}
          value={formatNumber(totalGranted)}
          icon={Users}
        />
        <StatCard
          label={t('table.available')}
          value={formatNumber(optionsAvailable)}
          icon={Wallet}
        />
        <StatCard
          label={t('table.exercised')}
          value={formatNumber(totalExercised)}
          icon={XCircle}
        />
      </div>

      {/* Pool utilization bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500">
            {t('pool.utilization')}
          </span>
          <span className="text-xs font-medium text-gray-700">
            {formatPercentage(utilizationPct)}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-ocean-600 transition-all"
            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>
            {t('pool.granted')}: {formatNumber(totalGranted)}
          </span>
          <span>
            {t('pool.available')}: {formatNumber(optionsAvailable)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-6">
          {(['grants', 'details'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-3 text-sm font-medium transition-colors border-b-2',
                activeTab === tab
                  ? 'border-ocean-600 text-ocean-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {t(`planDetail.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'grants' && (
        <GrantsTab
          grants={grants}
          meta={grantsMeta}
          loading={grantsLoading}
          page={grantPage}
          statusFilter={grantStatusFilter}
          planId={plan.id}
          planStatus={plan.status}
          onPageChange={setGrantPage}
          onStatusFilterChange={(v) => {
            setGrantStatusFilter(v);
            setGrantPage(1);
          }}
          onCancelGrant={setCancelGrantId}
          t={t}
        />
      )}

      {activeTab === 'details' && (
        <DetailsTab plan={plan} t={t} />
      )}

      {/* Close plan dialog */}
      <ConfirmDialog
        open={showCloseDialog}
        onClose={() => setShowCloseDialog(false)}
        onConfirm={handleClosePlan}
        loading={closePlanMutation.isPending}
        title={t('confirm.closeTitle')}
        description={t('confirm.closeDescription')}
        confirmLabel={t('confirm.close')}
        variant="destructive"
      />

      {/* Cancel grant dialog */}
      <ConfirmDialog
        open={!!cancelGrantId}
        onClose={() => setCancelGrantId(null)}
        onConfirm={handleCancelGrant}
        loading={cancelGrantMutation.isPending}
        title={t('confirm.cancelTitle')}
        description={t('confirm.cancelDescription')}
        confirmLabel={t('confirm.cancel')}
        variant="destructive"
      />
    </div>
  );
}

// --- Grants Tab ---

function GrantsTab({
  grants,
  meta,
  loading,
  page,
  statusFilter,
  planId,
  planStatus,
  onPageChange,
  onStatusFilterChange,
  onCancelGrant,
  t,
}: {
  grants: OptionGrant[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
  loading: boolean;
  page: number;
  statusFilter: string;
  planId: string;
  planStatus: OptionPlanStatus;
  onPageChange: (page: number) => void;
  onStatusFilterChange: (status: string) => void;
  onCancelGrant: (grantId: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const grantStatuses: OptionGrantStatus[] = [
    'ACTIVE',
    'EXERCISED',
    'CANCELLED',
    'EXPIRED',
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex items-center justify-between">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
        >
          <option value="">{t('filter.allStatuses')}</option>
          {grantStatuses.map((s) => (
            <option key={s} value={s}>
              {t(`grantStatus.${s.toLowerCase()}`)}
            </option>
          ))}
        </select>
        {planStatus === 'ACTIVE' && (
          <Link
            href={`/dashboard/options/grants/new?planId=${planId}`}
            className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-ocean-700"
          >
            <Plus className="h-4 w-4" />
            {t('planDetail.newGrant')}
          </Link>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      ) : grants.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-12">
          <Users className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {t('planDetail.emptyGrants')}
          </p>
          {planStatus === 'ACTIVE' && (
            <Link
              href={`/dashboard/options/grants/new?planId=${planId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ocean-700"
            >
              <Plus className="h-4 w-4" />
              {t('planDetail.newGrant')}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    {t('table.employee')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    {t('table.grantDate')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('table.quantity')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('table.strikePrice')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    {t('table.vesting')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('table.exercised')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    {t('table.status')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {grants.map((grant) => {
                  const grantBadge = getGrantStatusBadge(grant.status, t);
                  return (
                    <tr
                      key={grant.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {grant.employeeName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {grant.employeeEmail}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(grant.grantDate)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-gray-900">
                        {formatNumber(grant.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">
                        {formatCurrency(grant.strikePrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {t('table.cliffMonths', {
                          months: grant.cliffMonths,
                        })}{' '}
                        / {grant.vestingDurationMonths}m
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">
                        {formatNumber(grant.exercised)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            grantBadge.className,
                          )}
                        >
                          {grantBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/options/grants/${grant.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {grant.status === 'ACTIVE' && (
                            <button
                              onClick={() => onCancelGrant(grant.id)}
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

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {t('pagination.showing', {
                  from: (page - 1) * meta.limit + 1,
                  to: Math.min(page * meta.limit, meta.total),
                  total: meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('pagination.previous')}
                </button>
                <span className="text-sm text-gray-600">
                  {t('pagination.page')} {page} {t('pagination.of')}{' '}
                  {meta.totalPages}
                </span>
                <button
                  onClick={() =>
                    onPageChange(Math.min(meta.totalPages, page + 1))
                  }
                  disabled={page >= meta.totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('pagination.next')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Details Tab ---

function DetailsTab({
  plan,
  t,
}: {
  plan: OptionPlan;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Plan Information */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-navy-900">
          {t('planDetail.planInformation')}
        </h3>
        <div className="space-y-0">
          <InfoRow label={t('planDetail.name')} value={plan.name} />
          <InfoRow
            label={t('planDetail.shareClass')}
            value={plan.shareClass?.className ?? '—'}
          />
          <InfoRow
            label={t('planDetail.status')}
            value={
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  getStatusBadge(plan.status, t).className,
                )}
              >
                {getStatusBadge(plan.status, t).label}
              </span>
            }
          />
          <InfoRow
            label={t('planDetail.boardApprovalDate')}
            value={
              plan.boardApprovalDate
                ? formatDate(plan.boardApprovalDate)
                : '—'
            }
          />
          <InfoRow
            label={t('planDetail.createdAt')}
            value={formatDate(plan.createdAt)}
          />
        </div>
      </div>

      {/* Plan Terms */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-navy-900">
          {t('planDetail.planTerms')}
        </h3>
        <div className="space-y-0">
          <InfoRow
            label={t('planDetail.terminationPolicy')}
            value={t(
              `terminationPolicy.${plan.terminationPolicy.toLowerCase()}`,
            )}
          />
          <InfoRow
            label={t('planDetail.exerciseWindow')}
            value={t('planDetail.exerciseWindowDays', {
              days: plan.exerciseWindowDays,
            })}
          />
          <InfoRow
            label={t('table.totalPool')}
            value={formatNumber(plan.totalPoolSize)}
          />
          <InfoRow
            label={t('planDetail.notes')}
            value={plan.notes ?? '—'}
          />
        </div>
      </div>
    </div>
  );
}
