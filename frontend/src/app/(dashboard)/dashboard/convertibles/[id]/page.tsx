'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  AlertTriangle,
  XCircle,
  Banknote,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { useCompany } from '@/lib/company-context';
import { useErrorToast } from '@/lib/use-error-toast';
import {
  useConvertible,
  useConvertibleInterest,
  useConvertibleScenarios,
  useCancelConvertible,
  useRedeemConvertible,
} from '@/hooks/use-convertibles';
import type {
  ConvertibleInstrument,
  InterestBreakdown,
  ConversionScenarios,
  ConversionScenario,
} from '@/types/company';
import { cn } from '@/lib/utils';

// ── Formatting helpers (always pt-BR per i18n rules) ─────────────────────

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

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function formatPercent(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

// ── Badge helpers ────────────────────────────────────────────────────────

function getTypeBadge(
  type: string,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    MUTUO_CONVERSIVEL: {
      label: t('instrumentType.mutuoConversivel'),
      className: 'bg-blue-50 text-ocean-600',
    },
    INVESTIMENTO_ANJO: {
      label: t('instrumentType.investimentoAnjo'),
      className: 'bg-celadon-100 text-celadon-700',
    },
    MISTO: {
      label: t('instrumentType.misto'),
      className: 'bg-cream-100 text-cream-700',
    },
    MAIS: {
      label: t('instrumentType.mais'),
      className: 'bg-gray-100 text-gray-600',
    },
  };
  return map[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
}

function getStatusBadge(
  status: string,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    OUTSTANDING: {
      label: t('status.outstanding'),
      className: 'bg-blue-50 text-ocean-600',
    },
    CONVERTED: {
      label: t('status.converted'),
      className: 'bg-green-100 text-green-700',
    },
    REDEEMED: {
      label: t('status.redeemed'),
      className: 'bg-cream-100 text-cream-700',
    },
    MATURED: {
      label: t('status.matured'),
      className: 'bg-red-50 text-[#991B1B]',
    },
    CANCELLED: {
      label: t('status.cancelled'),
      className: 'bg-gray-100 text-gray-600',
    },
  };
  return map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

// ── Reusable sub-components ──────────────────────────────────────────────

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined | React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex justify-between py-3 border-b border-gray-100 last:border-0',
        className,
      )}
    >
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">
        {value || '—'}
      </span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-6',
        active
          ? 'border-ocean-600 bg-ocean-600 text-white shadow-md'
          : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')}
        />
        <span
          className={cn(
            'text-xs font-medium',
            active ? 'text-white/80' : 'text-gray-500',
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-bold tabular-nums',
          active ? 'text-white' : 'text-navy-900',
        )}
      >
        {value}
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
        data-testid="dialog-overlay"
      />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium text-white',
              variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-ocean-600 hover:bg-ocean-500',
              loading && 'opacity-60',
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function RedeemDialog({
  open,
  onClose,
  onConfirm,
  loading,
  title,
  description,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: string, ref?: string) => void;
  loading: boolean;
  title: string;
  description: string;
  t: (key: string) => string;
}) {
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-navy-900/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('detail.redemptionAmount')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('detail.redemptionAmountPlaceholder')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('detail.paymentReference')}
            </label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder={t('detail.paymentReferencePlaceholder')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(amount, ref || undefined)}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className={cn(
              'rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-500',
              (loading || !amount) && 'opacity-60',
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('detail.redeemButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-5 w-40 rounded bg-gray-200" />
      <div className="h-8 w-64 rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-gray-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-64 rounded-xl border border-gray-200 bg-white" />
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-xl border border-gray-200 bg-white" />
        </div>
      </div>
    </div>
  );
}

// ── Tab: Details ─────────────────────────────────────────────────────────

function DetailsTab({
  instrument,
  t,
}: {
  instrument: ConvertibleInstrument;
  t: (key: string) => string;
}) {
  const typeBadge = getTypeBadge(instrument.instrumentType, t);
  const statusBadge = getStatusBadge(instrument.status, t);
  const triggerLabel = instrument.conversionTrigger
    ? t(`conversionTriggerType.${
        instrument.conversionTrigger === 'QUALIFIED_FINANCING'
          ? 'qualifiedFinancing'
          : instrument.conversionTrigger === 'CHANGE_OF_CONTROL'
            ? 'changeOfControl'
            : instrument.conversionTrigger === 'INVESTOR_OPTION'
              ? 'investorOption'
              : 'maturity'
      }`)
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Summary + Conversion Terms */}
      <div className="lg:col-span-2 space-y-6">
        {/* Summary Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800">
            {t('detail.summary')}
          </h2>
          <div className="mt-4">
            <InfoRow
              label={t('detail.investor')}
              value={instrument.shareholder?.name}
            />
            <InfoRow
              label={t('detail.type')}
              value={
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    typeBadge.className,
                  )}
                >
                  {typeBadge.label}
                </span>
              }
            />
            <InfoRow
              label={t('detail.status')}
              value={
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    statusBadge.className,
                  )}
                >
                  {statusBadge.label}
                </span>
              }
            />
            <InfoRow
              label={t('detail.principalAmount')}
              value={formatCurrency(instrument.principalAmount)}
            />
            <InfoRow
              label={t('detail.interestRate')}
              value={formatPercent(parseFloat(instrument.interestRate))}
            />
            <InfoRow
              label={t('detail.interestType')}
              value={t(`interestType.${instrument.interestType.toLowerCase()}`)}
            />
            <InfoRow
              label={t('detail.issueDate')}
              value={formatDate(instrument.issueDate)}
            />
            <InfoRow
              label={t('detail.maturityDate')}
              value={formatDate(instrument.maturityDate)}
            />
            {instrument.notes && (
              <InfoRow label={t('detail.notes')} value={instrument.notes} />
            )}
          </div>
        </div>

        {/* Conversion Terms Card */}
        {(instrument.discountRate ||
          instrument.valuationCap ||
          instrument.conversionTrigger ||
          instrument.qualifiedFinancingThreshold) && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800">
              {t('detail.conversionTerms')}
            </h2>
            <div className="mt-4">
              {instrument.discountRate && (
                <InfoRow
                  label={t('detail.discountRate')}
                  value={formatPercent(parseFloat(instrument.discountRate))}
                />
              )}
              {instrument.valuationCap && (
                <InfoRow
                  label={t('detail.valuationCap')}
                  value={formatCurrency(instrument.valuationCap)}
                />
              )}
              {instrument.qualifiedFinancingThreshold && (
                <InfoRow
                  label={t('detail.qualifiedFinancing')}
                  value={formatCurrency(
                    instrument.qualifiedFinancingThreshold,
                  )}
                />
              )}
              {triggerLabel && (
                <InfoRow
                  label={t('detail.conversionTrigger')}
                  value={triggerLabel}
                />
              )}
              {instrument.targetShareClass && (
                <InfoRow
                  label={t('detail.targetShareClass')}
                  value={instrument.targetShareClass.className}
                />
              )}
              <InfoRow
                label={t('detail.autoConvert')}
                value={instrument.autoConvert ? t('detail.yes') : t('detail.no')}
              />
              <InfoRow
                label={t('detail.mfnClause')}
                value={instrument.mfnClause ? t('detail.yes') : t('detail.no')}
              />
            </div>
          </div>
        )}

        {/* Conversion Data (for CONVERTED status) */}
        {instrument.status === 'CONVERTED' && instrument.conversionData && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-green-800">
              {t('detail.conversionData')}
            </h2>
            <div className="mt-4">
              {instrument.conversionData.conversionAmount && (
                <InfoRow
                  label={t('detail.conversionAmount')}
                  value={formatCurrency(
                    instrument.conversionData.conversionAmount as string,
                  )}
                />
              )}
              {instrument.conversionData.conversionPricePerShare && (
                <InfoRow
                  label={t('detail.conversionPrice')}
                  value={formatCurrency(
                    instrument.conversionData.conversionPricePerShare as string,
                  )}
                />
              )}
              {instrument.conversionData.sharesIssued && (
                <InfoRow
                  label={t('detail.sharesIssued')}
                  value={formatNumber(
                    instrument.conversionData.sharesIssued as number,
                  )}
                />
              )}
              {instrument.conversionData.methodUsed && (
                <InfoRow
                  label={t('detail.methodUsed')}
                  value={instrument.conversionData.methodUsed as string}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Metadata sidebar */}
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800">
            {t('detail.metadata')}
          </h2>
          <div className="mt-4">
            <InfoRow
              label={t('detail.createdAt')}
              value={formatDateTime(instrument.createdAt)}
            />
            {instrument.convertedAt && (
              <InfoRow
                label={t('detail.convertedAt')}
                value={formatDateTime(instrument.convertedAt)}
              />
            )}
            {instrument.redeemedAt && (
              <InfoRow
                label={t('detail.redeemedAt')}
                value={formatDateTime(instrument.redeemedAt)}
              />
            )}
            {instrument.cancelledAt && (
              <InfoRow
                label={t('detail.cancelledAt')}
                value={formatDateTime(instrument.cancelledAt)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Interest ────────────────────────────────────────────────────────

function InterestTab({
  companyId,
  convertibleId,
  t,
}: {
  companyId: string;
  convertibleId: string;
  t: (key: string) => string;
}) {
  const {
    data: interest,
    isLoading,
    error,
  } = useConvertibleInterest(companyId, convertibleId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-64 rounded-xl border border-gray-200 bg-white" />
      </div>
    );
  }

  if (error || !interest) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">{t('detail.interestEmpty')}</p>
      </div>
    );
  }

  // Compute cumulative totals for the breakdown table
  let cumulative = 0;
  const rows = interest.interestBreakdown.map((period) => {
    const accrued = parseFloat(period.interestAccrued);
    cumulative += isNaN(accrued) ? 0 : accrued;
    return { ...period, cumulative };
  });

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <span className="text-xs font-medium text-gray-500">
            {t('detail.interestDaysElapsed')}
          </span>
          <p className="mt-1 text-xl font-bold text-navy-900 tabular-nums">
            {interest.daysElapsed}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <span className="text-xs font-medium text-gray-500">
            {t('detail.accruedInterest')}
          </span>
          <p className="mt-1 text-xl font-bold text-navy-900 tabular-nums">
            {formatCurrency(interest.accruedInterest)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <span className="text-xs font-medium text-gray-500">
            {t('detail.totalValue')}
          </span>
          <p className="mt-1 text-xl font-bold text-navy-900 tabular-nums">
            {formatCurrency(interest.totalValue)}
          </p>
        </div>
      </div>

      {/* Interest Breakdown Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 pb-3">
          <h2 className="text-base font-semibold text-gray-800">
            {t('detail.interestTitle')}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {t('detail.interestCalculationDate')}:{' '}
            {formatDateTime(interest.calculationDate)}
          </p>
        </div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    {t('detail.interestPeriod')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('detail.interestDays')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('detail.interestAccrued')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('detail.interestCumulative')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-6 py-3 text-gray-700">{row.period}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-gray-700">
                      {row.days}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-gray-700">
                      {formatCurrency(row.interestAccrued)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums font-medium text-gray-900">
                      {formatCurrency(row.cumulative)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <p className="text-sm text-gray-500">{t('detail.interestEmpty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Scenarios ───────────────────────────────────────────────────────

function ScenariosTab({
  companyId,
  convertibleId,
  t,
}: {
  companyId: string;
  convertibleId: string;
  t: (key: string) => string;
}) {
  const {
    data: scenarios,
    isLoading,
    error,
  } = useConvertibleScenarios(companyId, convertibleId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-64 rounded-xl border border-gray-200 bg-white" />
      </div>
    );
  }

  if (error || !scenarios) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">
          {t('detail.scenariosEmpty')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversion Amount + Cap trigger info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <span className="text-xs font-medium text-gray-500">
            {t('detail.scenariosConversionAmount')}
          </span>
          <p className="mt-1 text-xl font-bold text-navy-900 tabular-nums">
            {formatCurrency(scenarios.currentConversionAmount)}
          </p>
        </div>
        {scenarios.summary.capTriggersAbove && (
          <div className="rounded-xl border border-cream-600 bg-cream-50 p-4">
            <span className="text-xs font-medium text-cream-700">
              {t('detail.scenariosCapTrigger')}
            </span>
            <p className="mt-1 text-xl font-bold text-cream-700 tabular-nums">
              {formatCurrency(scenarios.summary.capTriggersAbove)}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500">
        {t('detail.scenariosDescription')}
      </p>

      {/* Scenarios Table */}
      {scenarios.scenarios.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('detail.scenariosValuation')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('detail.scenariosRoundPrice')}
                </th>
                {scenarios.summary.discountRate && (
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('detail.scenariosDiscount')}
                  </th>
                )}
                {scenarios.summary.valuationCap && (
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    {t('detail.scenariosCap')}
                  </th>
                )}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                  {t('detail.scenariosBestMethod')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('detail.scenariosShares')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('detail.scenariosOwnership')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('detail.scenariosDilution')}
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.scenarios.map(
                (scenario: ConversionScenario, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 tabular-nums">
                      {formatCurrency(scenario.hypotheticalValuation)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {formatCurrency(scenario.roundPricePerShare)}
                    </td>
                    {scenarios.summary.discountRate && (
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {scenario.discountMethod
                          ? formatCurrency(
                              scenario.discountMethod.conversionPrice,
                            )
                          : '—'}
                      </td>
                    )}
                    {scenarios.summary.valuationCap && (
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {scenario.capMethod
                          ? formatCurrency(scenario.capMethod.conversionPrice)
                          : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          scenario.bestMethod === 'DISCOUNT'
                            ? 'bg-blue-50 text-ocean-600'
                            : scenario.bestMethod === 'CAP'
                              ? 'bg-cream-100 text-cream-700'
                              : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {scenario.bestMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                      {formatNumber(scenario.finalSharesIssued)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {scenario.finalOwnershipPercentage}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">
                      {scenario.dilutionToExisting}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            {t('detail.scenariosEmpty')}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────

export default function ConvertibleDetailPage() {
  const params = useParams();
  const convertibleId = params.id as string;
  const t = useTranslations('convertibles');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const showErrorToast = useErrorToast();

  const companyId = selectedCompany?.id;

  const {
    data: instrument,
    isLoading,
    error,
  } = useConvertible(companyId, convertibleId);

  const cancelMutation = useCancelConvertible(companyId);
  const redeemMutation = useRedeemConvertible(companyId);

  const [activeTab, setActiveTab] = useState<
    'details' | 'interest' | 'scenarios'
  >('details');
  const [dialogType, setDialogType] = useState<
    'cancel' | 'redeem' | null
  >(null);

  const actionLoading = cancelMutation.isPending || redeemMutation.isPending;

  // ── Guards ─────────────────────────────────────────────────────────

  if (companyLoading || !selectedCompany) {
    return <DetailSkeleton />;
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/convertibles"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <p className="text-sm text-red-600">{t('detail.error')}</p>
      </div>
    );
  }

  if (!instrument) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/convertibles"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <div className="text-center py-16">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-semibold text-gray-700">
            {t('detail.notFound')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('detail.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  // ── Computed values ────────────────────────────────────────────────

  const principal = parseFloat(instrument.principalAmount) || 0;
  const accrued = parseFloat(instrument.accruedInterest) || 0;
  const total = principal + accrued;

  const maturityDate = new Date(instrument.maturityDate);
  const today = new Date();
  const daysToMaturity = Math.max(
    0,
    Math.ceil(
      (maturityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const isMaturityNear = daysToMaturity <= 30 && daysToMaturity > 0;
  const isMatured =
    instrument.status === 'MATURED' || daysToMaturity === 0;

  const canCancel =
    instrument.status === 'OUTSTANDING' || instrument.status === 'MATURED';
  const canRedeem = canCancel;

  const typeBadge = getTypeBadge(instrument.instrumentType, t);
  const statusBadge = getStatusBadge(instrument.status, t);

  // ── Action handlers ────────────────────────────────────────────────

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(convertibleId);
      setDialogType(null);
    } catch (err) {
      showErrorToast(err);
    }
  };

  const handleRedeem = async (amount: string, ref?: string) => {
    try {
      await redeemMutation.mutateAsync({
        convertibleId,
        data: { redemptionAmount: amount, paymentReference: ref },
      });
      setDialogType(null);
    } catch (err) {
      showErrorToast(err);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

  const tabs = [
    { key: 'details' as const, label: t('detail.detailsTab') },
    { key: 'interest' as const, label: t('detail.interestTab') },
    { key: 'scenarios' as const, label: t('detail.scenariosTab') },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/convertibles"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy-900">
              {t('detail.title')}
            </h1>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                typeBadge.className,
              )}
            >
              {typeBadge.label}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                statusBadge.className,
              )}
            >
              {statusBadge.label}
            </span>
          </div>
          {instrument.shareholder && (
            <p className="mt-1 text-sm text-gray-500">
              {instrument.shareholder.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canRedeem && (
            <button
              type="button"
              onClick={() => setDialogType('redeem')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Banknote className="h-4 w-4" />
              {t('detail.redeemButton')}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => setDialogType('cancel')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              {t('detail.cancelButton')}
            </button>
          )}
        </div>
      </div>

      {/* Maturity Warning */}
      {isMaturityNear && instrument.status === 'OUTSTANDING' && (
        <div className="flex items-center gap-3 rounded-xl border border-cream-600 bg-cream-50 p-4">
          <AlertTriangle className="h-5 w-5 text-cream-700 flex-shrink-0" />
          <p className="text-sm text-cream-700">
            {t('detail.maturityWarning', {
              days: daysToMaturity,
              date: formatDate(instrument.maturityDate),
            })}
          </p>
        </div>
      )}
      {isMatured && instrument.status !== 'MATURED' && instrument.status === 'OUTSTANDING' && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">
            {t('detail.maturityExpired', {
              date: formatDate(instrument.maturityDate),
            })}
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label={t('detail.statsPrincipal')}
          value={formatCurrency(principal)}
          active
        />
        <StatCard
          icon={TrendingUp}
          label={t('detail.statsInterest')}
          value={formatCurrency(accrued)}
        />
        <StatCard
          icon={FileText}
          label={t('detail.statsTotal')}
          value={formatCurrency(total)}
        />
        <StatCard
          icon={daysToMaturity > 0 ? Calendar : Clock}
          label={t('detail.statsMaturity')}
          value={
            daysToMaturity > 0
              ? t('detail.days', { count: daysToMaturity })
              : t('detail.expired')
          }
        />
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
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
      {activeTab === 'details' && (
        <DetailsTab instrument={instrument} t={t} />
      )}
      {activeTab === 'interest' && companyId && (
        <InterestTab
          companyId={companyId}
          convertibleId={convertibleId}
          t={t}
        />
      )}
      {activeTab === 'scenarios' && companyId && (
        <ScenariosTab
          companyId={companyId}
          convertibleId={convertibleId}
          t={t}
        />
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={dialogType === 'cancel'}
        onClose={() => setDialogType(null)}
        onConfirm={handleCancel}
        loading={cancelMutation.isPending}
        title={t('detail.cancelTitle')}
        description={t('detail.cancelDescription')}
        confirmLabel={t('detail.cancelButton')}
      />
      <RedeemDialog
        open={dialogType === 'redeem'}
        onClose={() => setDialogType(null)}
        onConfirm={handleRedeem}
        loading={redeemMutation.isPending}
        title={t('detail.redeemTitle')}
        description={t('detail.redeemDescription')}
        t={t}
      />
    </div>
  );
}
