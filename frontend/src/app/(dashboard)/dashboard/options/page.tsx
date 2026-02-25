'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Gift,
  Users,
  Wallet,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  Plus,
  Lock,
  BarChart3,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useOptionPlans,
  useClosePlan,
  useOptionGrants,
  useCancelGrant,
  useOptionExercises,
  useCancelExercise,
} from '@/hooks/use-option-plans';
import type {
  OptionPlan,
  OptionPlanStatus,
  OptionGrant,
  OptionGrantStatus,
  OptionExerciseRequest,
  ExerciseRequestStatus,
  TerminationPolicy,
} from '@/types/company';

// --- Formatting helpers (always pt-BR per i18n rules) ---

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR').format(num);
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

function getPlanStatusBadge(
  status: OptionPlanStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<OptionPlanStatus, { label: string; className: string }> = {
    ACTIVE: { label: t('planStatus.active'), className: 'bg-green-100 text-green-700' },
    CLOSED: { label: t('planStatus.closed'), className: 'bg-gray-100 text-gray-600' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
}

function getGrantStatusBadge(
  status: OptionGrantStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<OptionGrantStatus, { label: string; className: string }> = {
    ACTIVE: { label: t('grantStatus.active'), className: 'bg-green-100 text-green-700' },
    EXERCISED: { label: t('grantStatus.exercised'), className: 'bg-blue-50 text-ocean-600' },
    CANCELLED: { label: t('grantStatus.cancelled'), className: 'bg-gray-100 text-gray-600' },
    EXPIRED: { label: t('grantStatus.expired'), className: 'bg-red-50 text-red-700' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
}

function getExerciseStatusBadge(
  status: ExerciseRequestStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<ExerciseRequestStatus, { label: string; className: string }> = {
    PENDING_PAYMENT: { label: t('exerciseStatus.pendingPayment'), className: 'bg-cream-100 text-cream-700' },
    PAYMENT_CONFIRMED: { label: t('exerciseStatus.paymentConfirmed'), className: 'bg-blue-50 text-ocean-600' },
    SHARES_ISSUED: { label: t('exerciseStatus.sharesIssued'), className: 'bg-green-100 text-green-700' },
    COMPLETED: { label: t('exerciseStatus.completed'), className: 'bg-green-100 text-green-700' },
    CANCELLED: { label: t('exerciseStatus.cancelled'), className: 'bg-gray-100 text-gray-600' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
}

function getTerminationPolicyLabel(
  policy: TerminationPolicy,
  t: (key: string) => string,
): string {
  const map: Record<TerminationPolicy, string> = {
    FORFEITURE: t('terminationPolicy.forfeiture'),
    ACCELERATION: t('terminationPolicy.acceleration'),
    PRO_RATA: t('terminationPolicy.proRata'),
  };
  return map[policy] || policy;
}

function PoolUtilizationBar({
  granted,
  exercised,
  total,
  t,
}: {
  granted: number;
  exercised: number;
  total: number;
  t: (key: string) => string;
}) {
  if (total === 0) return <span className="text-sm text-gray-400">—</span>;
  const grantedPct = Math.min((granted / total) * 100, 100);
  const exercisedPct = Math.min((exercised / total) * 100, 100);

  return (
    <div className="w-full min-w-[120px]">
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="bg-ocean-600"
          style={{ width: `${exercisedPct}%` }}
          title={`${t('pool.exercised')}: ${formatPercentage(exercisedPct)}%`}
        />
        <div
          className="bg-ocean-400"
          style={{ width: `${grantedPct - exercisedPct}%` }}
          title={`${t('pool.granted')}: ${formatPercentage(grantedPct - exercisedPct)}%`}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {formatPercentage(grantedPct)}%
      </p>
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
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title: string;
  description: string;
  confirmLabel: string;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-navy-900/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
          <p className="mt-2 text-sm text-gray-500">{description}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {confirmLabel === 'cancel' ? 'Voltar' : 'Go Back'}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {confirmLabel}
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

// --- Plans Tab ---

function PlansTab({
  companyId,
  t,
  pageLoading,
}: {
  companyId: string | undefined;
  t: (key: string, params?: Record<string, unknown>) => string;
  pageLoading: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [closeTarget, setCloseTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useOptionPlans(companyId, {
    page,
    limit,
    status: statusFilter || undefined,
    sort: '-createdAt',
  });

  const closeMutation = useClosePlan(companyId);

  const plans = data?.data ?? [];
  const meta = data?.meta;
  const loading = pageLoading || isLoading;

  const stats = useMemo(() => {
    if (!meta) return { total: 0, active: 0, closed: 0, totalOptions: 0 };
    return {
      total: meta.total,
      active: plans.filter((p) => p.status === 'ACTIVE').length,
      closed: plans.filter((p) => p.status === 'CLOSED').length,
      totalOptions: plans.reduce(
        (sum, p) => sum + parseFloat(p.totalPoolSize || '0'),
        0,
      ),
    };
  }, [plans, meta]);

  const handleClose = async () => {
    if (!closeTarget) return;
    try {
      await closeMutation.mutateAsync(closeTarget);
      setCloseTarget(null);
    } catch {
      // Error handled by API error toast
    }
  };

  const totalPages = meta?.totalPages ?? 0;

  return (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.total')}
          value={String(stats.total)}
          icon={Gift}
          active
          loading={loading}
        />
        <StatCard
          label={t('stats.active')}
          value={String(stats.active)}
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard
          label={t('stats.closed')}
          value={String(stats.closed)}
          icon={Lock}
          loading={loading}
        />
        <StatCard
          label={t('stats.totalOptions')}
          value={formatNumber(stats.totalOptions)}
          icon={BarChart3}
          loading={loading}
        />
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="ACTIVE">{t('planStatus.active')}</option>
            <option value="CLOSED">{t('planStatus.closed')}</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading option plans'}
            </p>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <Gift className="h-12 w-12 text-gray-300" />
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
                    {t('table.shareClass')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.totalPool')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.granted')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.utilization')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.terminationPolicy')}
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
                {plans.map((plan) => {
                  const statusBadge = getPlanStatusBadge(plan.status, t);
                  const granted = parseFloat(plan.totalGranted || '0');
                  const exercised = parseFloat(plan.totalExercised || '0');
                  const total = parseFloat(plan.totalPoolSize || '0');

                  return (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-700">
                        {plan.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {plan.shareClass?.className ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatNumber(total)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatNumber(granted)}
                      </td>
                      <td className="px-6 py-4">
                        <PoolUtilizationBar
                          granted={granted}
                          exercised={exercised}
                          total={total}
                          t={t}
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {getTerminationPolicyLabel(plan.terminationPolicy, t)}
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
                            href={`/dashboard/options/plans/${plan.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {plan.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => setCloseTarget(plan.id)}
                              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Close"
                            >
                              <Lock className="h-4 w-4" />
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

      {/* Close Dialog */}
      <ConfirmDialog
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleClose}
        loading={closeMutation.isPending}
        title={t('confirm.closeTitle')}
        description={t('confirm.closeDescription')}
        confirmLabel={t('confirm.close')}
      />
    </>
  );
}

// --- Grants Tab ---

function GrantsTab({
  companyId,
  t,
  pageLoading,
}: {
  companyId: string | undefined;
  t: (key: string, params?: Record<string, unknown>) => string;
  pageLoading: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useOptionGrants(companyId, {
    page,
    limit,
    status: statusFilter || undefined,
    sort: '-grantDate',
  });

  const cancelMutation = useCancelGrant(companyId);

  const grants = data?.data ?? [];
  const meta = data?.meta;
  const loading = pageLoading || isLoading;

  const stats = useMemo(() => {
    if (!meta) return { total: 0, active: 0, exercised: 0, cancelled: 0 };
    return {
      total: meta.total,
      active: grants.filter((g) => g.status === 'ACTIVE').length,
      exercised: grants.filter((g) => g.status === 'EXERCISED').length,
      cancelled: grants.filter((g) => g.status === 'CANCELLED' || g.status === 'EXPIRED').length,
    };
  }, [grants, meta]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget);
      setCancelTarget(null);
    } catch {
      // Error handled by API error toast
    }
  };

  const totalPages = meta?.totalPages ?? 0;

  return (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.totalGrants')}
          value={String(stats.total)}
          icon={Users}
          active
          loading={loading}
        />
        <StatCard
          label={t('stats.activeGrants')}
          value={String(stats.active)}
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard
          label={t('stats.exercised')}
          value={String(stats.exercised)}
          icon={Wallet}
          loading={loading}
        />
        <StatCard
          label={t('stats.cancelled')}
          value={String(stats.cancelled)}
          icon={XCircle}
          loading={loading}
        />
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="ACTIVE">{t('grantStatus.active')}</option>
            <option value="EXERCISED">{t('grantStatus.exercised')}</option>
            <option value="CANCELLED">{t('grantStatus.cancelled')}</option>
            <option value="EXPIRED">{t('grantStatus.expired')}</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading option grants'}
            </p>
          </div>
        ) : grants.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <Users className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm text-gray-500">{t('emptyGrants')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.employee')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.plan')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.quantity')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.strikePrice')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.exercised')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.vesting')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.grantDate')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grants.map((grant) => {
                  const statusBadge = getGrantStatusBadge(grant.status, t);

                  return (
                    <tr key={grant.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {grant.employeeName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {grant.employeeEmail}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {grant.plan?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatNumber(grant.quantity)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatCurrency(grant.strikePrice)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatNumber(grant.exercised)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {t('table.cliffMonths', { months: grant.cliffMonths })} / {grant.vestingDurationMonths}m
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
                        {formatDate(grant.grantDate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
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
                              type="button"
                              onClick={() => setCancelTarget(grant.id)}
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
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelMutation.isPending}
        title={t('confirm.cancelTitle')}
        description={t('confirm.cancelDescription')}
        confirmLabel={t('confirm.cancel')}
      />
    </>
  );
}

// --- Exercises Tab ---

function ExercisesTab({
  companyId,
  t,
  pageLoading,
}: {
  companyId: string | undefined;
  t: (key: string, params?: Record<string, unknown>) => string;
  pageLoading: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useOptionExercises(companyId, {
    page,
    limit,
    status: statusFilter || undefined,
    sort: '-createdAt',
  });

  const cancelMutation = useCancelExercise(companyId);

  const exercises = data?.data ?? [];
  const meta = data?.meta;
  const loading = pageLoading || isLoading;

  const stats = useMemo(() => {
    if (!meta) return { total: 0, pending: 0, completed: 0, cancelled: 0 };
    return {
      total: meta.total,
      pending: exercises.filter(
        (e) => e.status === 'PENDING_PAYMENT' || e.status === 'PAYMENT_CONFIRMED',
      ).length,
      completed: exercises.filter(
        (e) => e.status === 'SHARES_ISSUED' || e.status === 'COMPLETED',
      ).length,
      cancelled: exercises.filter((e) => e.status === 'CANCELLED').length,
    };
  }, [exercises, meta]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget);
      setCancelTarget(null);
    } catch {
      // Error handled by API error toast
    }
  };

  const isCancellable = (status: ExerciseRequestStatus): boolean => {
    return status === 'PENDING_PAYMENT';
  };

  const totalPages = meta?.totalPages ?? 0;

  return (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.totalExercises')}
          value={String(stats.total)}
          icon={Wallet}
          active
          loading={loading}
        />
        <StatCard
          label={t('stats.pending')}
          value={String(stats.pending)}
          icon={Clock}
          loading={loading}
        />
        <StatCard
          label={t('stats.completed')}
          value={String(stats.completed)}
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard
          label={t('stats.cancelled')}
          value={String(stats.cancelled)}
          icon={XCircle}
          loading={loading}
        />
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="PENDING_PAYMENT">{t('exerciseStatus.pendingPayment')}</option>
            <option value="PAYMENT_CONFIRMED">{t('exerciseStatus.paymentConfirmed')}</option>
            <option value="SHARES_ISSUED">{t('exerciseStatus.sharesIssued')}</option>
            <option value="COMPLETED">{t('exerciseStatus.completed')}</option>
            <option value="CANCELLED">{t('exerciseStatus.cancelled')}</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading exercises'}
            </p>
          </div>
        ) : exercises.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <Wallet className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm text-gray-500">{t('emptyExercises')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.employee')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.plan')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.quantity')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.strikePrice')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.totalCost')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.paymentRef')}
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
                {exercises.map((exercise) => {
                  const statusBadge = getExerciseStatusBadge(exercise.status, t);

                  return (
                    <tr key={exercise.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {exercise.grant?.employeeName ?? '—'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {exercise.grant?.employeeEmail ?? ''}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {exercise.grant?.plan?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatNumber(exercise.quantity)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {exercise.grant?.strikePrice
                          ? formatCurrency(exercise.grant.strikePrice)
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                        {formatCurrency(exercise.totalCost)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                        {exercise.paymentReference}
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
                          {isCancellable(exercise.status) && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(exercise.id)}
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
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelMutation.isPending}
        title={t('confirm.cancelExerciseTitle')}
        description={t('confirm.cancelExerciseDescription')}
        confirmLabel={t('confirm.cancelExercise')}
      />
    </>
  );
}

// --- Main Page Component ---

type TabKey = 'plans' | 'grants' | 'exercises';

export default function OptionPlansPage() {
  const t = useTranslations('optionPlans');
  const { selectedCompany, isLoading: companyLoading } = useCompany();

  const companyId = selectedCompany?.id;
  const [activeTab, setActiveTab] = useState<TabKey>('plans');

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

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'plans', label: t('tabs.plans') },
    { key: 'grants', label: t('tabs.grants') },
    { key: 'exercises', label: t('tabs.exercises') },
  ];

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
        <div className="flex items-center gap-3">
          {activeTab === 'plans' && (
            <Link
              href="/dashboard/options/plans/new"
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <Plus className="h-4 w-4" />
              {t('create')}
            </Link>
          )}
          {activeTab === 'grants' && (
            <Link
              href="/dashboard/options/grants/new"
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <Plus className="h-4 w-4" />
              {t('createGrant')}
            </Link>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-ocean-600 text-ocean-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'plans' && (
        <PlansTab companyId={companyId} t={t} pageLoading={companyLoading} />
      )}
      {activeTab === 'grants' && (
        <GrantsTab companyId={companyId} t={t} pageLoading={companyLoading} />
      )}
      {activeTab === 'exercises' && (
        <ExercisesTab companyId={companyId} t={t} pageLoading={companyLoading} />
      )}
    </div>
  );
}
