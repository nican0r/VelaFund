'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Gift,
  Loader2,
  Percent,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useOptionGrant,
  useGrantVestingSchedule,
  useOptionExercises,
  useCancelGrant,
  useCancelExercise,
} from '@/hooks/use-option-plans';
import type {
  OptionGrant,
  OptionGrantStatus,
  VestingScheduleEntry,
  OptionExerciseRequest,
  ExerciseRequestStatus,
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

function formatPercentage(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num);
}

// --- Badge helpers ---

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
  return (
    statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  );
}

function getExerciseStatusBadge(
  status: ExerciseRequestStatus,
  t: (key: string) => string,
) {
  const statusMap: Record<
    ExerciseRequestStatus,
    { label: string; className: string }
  > = {
    PENDING_PAYMENT: {
      label: t('exerciseStatus.pendingPayment'),
      className: 'bg-cream-100 text-cream-700',
    },
    PAYMENT_CONFIRMED: {
      label: t('exerciseStatus.paymentConfirmed'),
      className: 'bg-blue-50 text-ocean-600',
    },
    SHARES_ISSUED: {
      label: t('exerciseStatus.sharesIssued'),
      className: 'bg-green-100 text-green-700',
    },
    COMPLETED: {
      label: t('exerciseStatus.completed'),
      className: 'bg-green-100 text-green-700',
    },
    CANCELLED: {
      label: t('exerciseStatus.cancelled'),
      className: 'bg-gray-100 text-gray-500',
    },
  };
  return (
    statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  );
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
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700',
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
      <div className="h-5 w-48 bg-gray-200 rounded mb-6" />
      <div className="flex items-center gap-4 mb-8">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-4 bg-gray-200 rounded-full mb-8" />
      <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

// --- Overview Tab ---

function OverviewTab({
  grant,
  t,
}: {
  grant: OptionGrant;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const frequencyLabels: Record<string, string> = {
    MONTHLY: t('frequency.monthly'),
    QUARTERLY: t('frequency.quarterly'),
    ANNUALLY: t('frequency.annually'),
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Grant Information */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-navy-900">
          {t('grantDetail.grantInformation')}
        </h3>
        <div className="space-y-0">
          <InfoRow
            label={t('grantDetail.employee')}
            value={
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {grant.employeeName}
                </p>
                <p className="text-xs text-gray-500">{grant.employeeEmail}</p>
              </div>
            }
          />
          <InfoRow
            label={t('grantDetail.plan')}
            value={
              grant.plan ? (
                <Link
                  href={`/dashboard/options/plans/${grant.planId}`}
                  className="text-sm font-medium text-ocean-600 hover:text-ocean-700"
                >
                  {grant.plan.name}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <InfoRow
            label={t('grantDetail.status')}
            value={
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  getGrantStatusBadge(grant.status, t).className,
                )}
              >
                {getGrantStatusBadge(grant.status, t).label}
              </span>
            }
          />
          <InfoRow
            label={t('grantDetail.grantDate')}
            value={formatDate(grant.grantDate)}
          />
          <InfoRow
            label={t('grantDetail.expirationDate')}
            value={formatDate(grant.expirationDate)}
          />
          {grant.shareholder && (
            <InfoRow
              label={t('grantDetail.shareholder')}
              value={grant.shareholder.name}
            />
          )}
          {grant.terminatedAt && (
            <InfoRow
              label={t('grantDetail.terminatedAt')}
              value={formatDate(grant.terminatedAt)}
            />
          )}
          <InfoRow
            label={t('grantDetail.createdAt')}
            value={formatDate(grant.createdAt)}
          />
        </div>
      </div>

      {/* Grant Terms */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-navy-900">
          {t('grantDetail.grantTerms')}
        </h3>
        <div className="space-y-0">
          <InfoRow
            label={t('grantDetail.quantity')}
            value={formatNumber(grant.quantity)}
          />
          <InfoRow
            label={t('grantDetail.strikePrice')}
            value={formatCurrency(grant.strikePrice)}
          />
          <InfoRow
            label={t('grantDetail.totalValue')}
            value={formatCurrency(
              parseFloat(grant.quantity) * parseFloat(grant.strikePrice),
            )}
          />
          <InfoRow
            label={t('grantDetail.cliffMonths')}
            value={`${grant.cliffMonths}`}
          />
          <InfoRow
            label={t('grantDetail.vestingDuration')}
            value={t('grantDetail.vestingDurationValue', {
              months: grant.vestingDurationMonths,
            })}
          />
          <InfoRow
            label={t('grantDetail.vestingFrequency')}
            value={
              frequencyLabels[grant.vestingFrequency] ?? grant.vestingFrequency
            }
          />
          {grant.plan?.terminationPolicy && (
            <InfoRow
              label={t('grantDetail.terminationPolicy')}
              value={t(
                `terminationPolicy.${grant.plan.terminationPolicy.toLowerCase()}`,
              )}
            />
          )}
          {grant.notes && (
            <InfoRow label={t('grantDetail.notes')} value={grant.notes} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Vesting Tab ---

function VestingTab({
  companyId,
  grantId,
  grant,
  t,
}: {
  companyId: string;
  grantId: string;
  grant: OptionGrant;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const { data: vestingData, isLoading } = useGrantVestingSchedule(
    companyId,
    grantId,
  );

  const scheduleTypeLabels: Record<string, string> = {
    CLIFF: t('grantDetail.scheduleTypeCliff'),
    MONTHLY: t('grantDetail.scheduleTypeMonthly'),
    QUARTERLY: t('grantDetail.scheduleTypeQuarterly'),
    ANNUAL: t('grantDetail.scheduleTypeAnnual'),
  };

  const scheduleTypeBadge: Record<string, string> = {
    CLIFF: 'bg-cream-100 text-cream-700',
    MONTHLY: 'bg-blue-50 text-ocean-600',
    QUARTERLY: 'bg-green-100 text-green-700',
    ANNUAL: 'bg-gray-100 text-gray-600',
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  // Use vesting data from schedule endpoint, or fall back to grant.vesting
  const vesting = vestingData
    ? {
        vestedQuantity: vestingData.vestedOptions,
        unvestedQuantity: vestingData.unvestedOptions,
        exercisableQuantity: vestingData.exercisableOptions,
        vestingPercentage: vestingData.vestingPercentage,
        cliffDate: vestingData.cliffDate,
        cliffMet: vestingData.cliffMet,
        nextVestingDate: vestingData.nextVestingDate,
        nextVestingAmount: vestingData.nextVestingAmount,
      }
    : grant.vesting;

  const schedule = vestingData?.schedule ?? [];
  const totalQuantity = parseFloat(grant.quantity) || 1;
  const vestingPct = vesting
    ? parseFloat(vesting.vestingPercentage)
    : 0;

  return (
    <div className="space-y-6">
      {/* Vesting progress bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-navy-900">
          {t('grantDetail.vestingProgress')}
        </h3>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {t('grantDetail.vestedQuantity')}:{' '}
            {formatNumber(vesting?.vestedQuantity ?? '0')} /{' '}
            {formatNumber(grant.quantity)}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {formatPercentage(vestingPct)}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-ocean-600 transition-all"
            style={{ width: `${Math.min(vestingPct, 100)}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500">
              {t('grantDetail.cliffDate')}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {vesting?.cliffDate ? formatDate(vesting.cliffDate) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('grantDetail.cliffMet')}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {vesting?.cliffMet
                ? t('grantDetail.yes')
                : t('grantDetail.no')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('grantDetail.nextVesting')}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {vesting?.nextVestingDate
                ? formatDate(vesting.nextVestingDate)
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('grantDetail.nextVestingAmount')}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {vesting?.nextVestingAmount
                ? formatNumber(vesting.nextVestingAmount)
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Vesting schedule table */}
      {schedule.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-navy-900">
              {t('grantDetail.vestingSchedule')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    {t('grantDetail.scheduleDate')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    {t('grantDetail.scheduleType')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('grantDetail.scheduleQuantity')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('grantDetail.scheduleCumulative')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('grantDetail.vestingPercentage')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {schedule.map((entry: VestingScheduleEntry, idx: number) => {
                  const cumPct =
                    (parseFloat(entry.cumulative) / totalQuantity) * 100;
                  const isPast = new Date(entry.date) <= new Date();
                  return (
                    <tr
                      key={idx}
                      className={cn(
                        'transition-colors',
                        isPast ? 'bg-green-50/30' : 'hover:bg-gray-50',
                      )}
                    >
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          {isPast && (
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          )}
                          {formatDate(entry.date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            scheduleTypeBadge[entry.type] ??
                              'bg-gray-100 text-gray-600',
                          )}
                        >
                          {scheduleTypeLabels[entry.type] ?? entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-gray-900">
                        {formatNumber(entry.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">
                        {formatNumber(entry.cumulative)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">
                        {formatPercentage(cumPct)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Exercises Tab ---

function ExercisesTab({
  companyId,
  grantId,
  t,
}: {
  companyId: string;
  grantId: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: exercisesData, isLoading } = useOptionExercises(companyId, {
    grantId,
    page,
    limit,
    sort: '-createdAt',
  });

  const cancelExerciseMutation = useCancelExercise(companyId);
  const [cancelExerciseId, setCancelExerciseId] = useState<string | null>(null);

  const handleCancelExercise = async () => {
    if (!cancelExerciseId) return;
    try {
      await cancelExerciseMutation.mutateAsync(cancelExerciseId);
      setCancelExerciseId(null);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const exercises = exercisesData?.data ?? [];
  const meta = exercisesData?.meta;

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-12">
        <DollarSign className="h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">
          {t('grantDetail.emptyExercises')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                {t('grantDetail.exerciseDate')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                {t('grantDetail.quantity')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                {t('grantDetail.totalCost')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                {t('grantDetail.paymentReference')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                {t('grantDetail.status')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {exercises.map((exercise: OptionExerciseRequest) => {
              const badge = getExerciseStatusBadge(exercise.status, t);
              return (
                <tr
                  key={exercise.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(exercise.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-gray-900">
                    {formatNumber(exercise.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">
                    {formatCurrency(exercise.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {exercise.paymentReference}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {exercise.status === 'PENDING_PAYMENT' && (
                      <button
                        onClick={() => setCancelExerciseId(exercise.id)}
                        className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Cancel"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
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
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('pagination.previous')}
            </button>
            <span className="text-sm text-gray-600">
              {t('pagination.page')} {page} {t('pagination.of')} {meta.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
              disabled={page >= meta.totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('pagination.next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cancel exercise dialog */}
      <ConfirmDialog
        open={!!cancelExerciseId}
        onClose={() => setCancelExerciseId(null)}
        onConfirm={handleCancelExercise}
        loading={cancelExerciseMutation.isPending}
        title={t('confirm.cancelExerciseTitle')}
        description={t('confirm.cancelExerciseDescription')}
        confirmLabel={t('confirm.cancelExercise')}
      />
    </div>
  );
}

// --- Main page component ---

export default function OptionGrantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('optionPlans');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Grant data
  const {
    data: grant,
    isLoading: grantLoading,
    error: grantError,
  } = useOptionGrant(companyId, id);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'vesting' | 'exercises'>(
    'overview',
  );

  // Mutations
  const cancelGrantMutation = useCancelGrant(companyId);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const isLoading = companyLoading || grantLoading;

  // Handlers
  const handleCancelGrant = async () => {
    try {
      await cancelGrantMutation.mutateAsync(id);
      setShowCancelDialog(false);
    } catch {
      // Error handled by TanStack Query
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

  if (grantError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/options"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('grantDetail.back')}
        </Link>
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-red-600">{t('grantDetail.error')}</p>
        </div>
      </div>
    );
  }

  if (!grant) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/options"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('grantDetail.back')}
        </Link>
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="text-center">
            <Gift className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {t('grantDetail.notFound')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Happy path ---

  const statusBadge = getGrantStatusBadge(grant.status, t);
  const vesting = grant.vesting;
  const totalQty = parseFloat(grant.quantity) || 0;
  const vestedQty = vesting ? parseFloat(vesting.vestedQuantity) : 0;
  const exercisableQty = vesting ? parseFloat(vesting.exercisableQuantity) : 0;
  const exercisedQty = parseFloat(grant.exercised) || 0;
  const vestingPct = vesting ? parseFloat(vesting.vestingPercentage) : 0;

  const tabs = [
    { key: 'overview' as const, label: t('grantDetail.tabOverview') },
    { key: 'vesting' as const, label: t('grantDetail.tabVesting') },
    { key: 'exercises' as const, label: t('grantDetail.tabExercises') },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href={`/dashboard/options/plans/${grant.planId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('grantDetail.backToPlan')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-navy-900">
            {grant.employeeName}
          </h1>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              statusBadge.className,
            )}
          >
            {statusBadge.label}
          </span>
          {grant.plan && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-ocean-600">
              {grant.plan.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {grant.status === 'ACTIVE' && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              {t('grantDetail.cancelGrant')}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <StatCard
          label={t('grantDetail.statsGranted')}
          value={formatNumber(totalQty)}
          icon={Gift}
          active
        />
        <StatCard
          label={t('grantDetail.statsVested')}
          value={formatNumber(vestedQty)}
          icon={CheckCircle}
        />
        <StatCard
          label={t('grantDetail.statsExercisable')}
          value={formatNumber(exercisableQty)}
          icon={Target}
        />
        <StatCard
          label={t('grantDetail.statsExercised')}
          value={formatNumber(exercisedQty)}
          icon={TrendingUp}
        />
      </div>

      {/* Vesting progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500">
            {t('grantDetail.statsVestingProgress')}
          </span>
          <span className="text-xs font-medium text-gray-700">
            {formatPercentage(vestingPct)}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-ocean-600 transition-all"
            style={{ width: `${Math.min(vestingPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'pb-3 text-sm font-medium transition-colors border-b-2',
                activeTab === tab.key
                  ? 'border-ocean-600 text-ocean-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab grant={grant} t={t} />}

      {activeTab === 'vesting' && companyId && (
        <VestingTab
          companyId={companyId}
          grantId={id}
          grant={grant}
          t={t}
        />
      )}

      {activeTab === 'exercises' && companyId && (
        <ExercisesTab companyId={companyId} grantId={id} t={t} />
      )}

      {/* Cancel grant dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancelGrant}
        loading={cancelGrantMutation.isPending}
        title={t('grantDetail.cancelGrantTitle')}
        description={t('grantDetail.cancelGrantDescription')}
        confirmLabel={t('grantDetail.cancelGrant')}
      />
    </div>
  );
}
