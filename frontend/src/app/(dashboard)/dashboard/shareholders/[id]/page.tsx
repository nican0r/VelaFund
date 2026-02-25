'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Briefcase,
  Globe,
  Mail,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useShareholder } from '@/hooks/use-shareholders';
import { useTransactions } from '@/hooks/use-transactions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  ShareholderDetail,
  ShareholderHolding,
  ShareholderType,
  ShareholderStatus,
  BeneficialOwner,
  Transaction,
} from '@/types/company';

// --- Brazilian number formatting (per i18n rules: always pt-BR format) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatPercentage(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num) + '%';
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

function maskCpfCnpj(value: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.***.***/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }
  return value;
}

// --- Badge helpers ---

function getTypeBadge(
  type: ShareholderType,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<ShareholderType, { key: string; className: string }> = {
    FOUNDER: { key: 'founder', className: 'bg-navy-50 text-navy-700' },
    INVESTOR: { key: 'investor', className: 'bg-blue-50 text-ocean-600' },
    EMPLOYEE: { key: 'employee', className: 'bg-green-100 text-celadon-700' },
    ADVISOR: { key: 'advisor', className: 'bg-cream-100 text-cream-700' },
    CORPORATE: { key: 'corporate', className: 'bg-gray-100 text-gray-600' },
  };
  const badge = map[type] || { key: type.toLowerCase(), className: 'bg-gray-100 text-gray-600' };
  return { label: t(`type.${badge.key}`), className: badge.className };
}

function getStatusBadge(
  status: ShareholderStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<ShareholderStatus, { key: string; className: string }> = {
    ACTIVE: { key: 'active', className: 'bg-green-100 text-green-700' },
    INACTIVE: { key: 'inactive', className: 'bg-gray-100 text-gray-500' },
    PENDING: { key: 'pending', className: 'bg-cream-100 text-cream-700' },
  };
  const badge = map[status] || { key: status.toLowerCase(), className: 'bg-gray-100 text-gray-500' };
  return { label: t(`status.${badge.key}`), className: badge.className };
}

function getTransactionTypeBadge(
  type: string,
  tTxn: (key: string) => string,
): { label: string; className: string } {
  const map: Record<string, { key: string; className: string }> = {
    ISSUANCE: { key: 'issuance', className: 'bg-green-100 text-green-700' },
    TRANSFER: { key: 'transfer', className: 'bg-blue-50 text-ocean-600' },
    CONVERSION: { key: 'conversion', className: 'bg-cream-100 text-cream-700' },
    CANCELLATION: { key: 'cancellation', className: 'bg-red-100 text-red-700' },
    SPLIT: { key: 'split', className: 'bg-gray-100 text-gray-600' },
  };
  const badge = map[type] || { key: type.toLowerCase(), className: 'bg-gray-100 text-gray-600' };
  return { label: tTxn(`type.${badge.key}`), className: badge.className };
}

function getTransactionStatusBadge(
  status: string,
  tTxn: (key: string) => string,
): { label: string; className: string } {
  const map: Record<string, { key: string; className: string }> = {
    DRAFT: { key: 'draft', className: 'bg-gray-100 text-gray-600' },
    PENDING_APPROVAL: { key: 'pendingApproval', className: 'bg-cream-100 text-cream-700' },
    SUBMITTED: { key: 'submitted', className: 'bg-blue-50 text-ocean-600' },
    CONFIRMED: { key: 'confirmed', className: 'bg-green-100 text-green-700' },
    FAILED: { key: 'failed', className: 'bg-red-100 text-red-700' },
    CANCELLED: { key: 'cancelled', className: 'bg-gray-100 text-gray-500' },
  };
  const badge = map[status] || { key: status.toLowerCase(), className: 'bg-gray-100 text-gray-500' };
  return { label: tTxn(`status.${badge.key}`), className: badge.className };
}

// --- Stat Card ---

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
        'rounded-xl p-6 transition-colors',
        active
          ? 'bg-ocean-600 text-white shadow-md'
          : 'bg-white border border-gray-200',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            active ? 'bg-white/20' : 'bg-gray-50',
          )}
        >
          <Icon className={cn('h-5 w-5', active ? 'text-white' : 'text-gray-500')} />
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
          {loading ? (
            <div className="mt-1 h-7 w-20 animate-pulse rounded bg-gray-200" />
          ) : (
            <p
              className={cn(
                'text-2xl font-bold',
                active ? 'text-white' : 'text-navy-900',
              )}
            >
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Loading skeleton ---

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-32 rounded bg-gray-200" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-5 w-20 rounded-full bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-10 w-64 rounded bg-gray-200" />
      <div className="h-64 rounded-lg bg-gray-200" />
    </div>
  );
}

// --- Info Row ---

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

// --- Main Component ---

export default function ShareholderDetailPage() {
  const params = useParams();
  const shareholderId = params.id as string;
  const t = useTranslations('shareholders');
  const tCommon = useTranslations('common');
  const tTxn = useTranslations('transactions');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Transaction pagination
  const [txnPage, setTxnPage] = useState(1);
  const txnLimit = 10;

  // Fetch shareholder detail
  const {
    data: shareholder,
    isLoading: shareholderLoading,
    error: shareholderError,
  } = useShareholder(companyId, shareholderId);

  // Fetch transactions for this shareholder
  const {
    data: transactionsData,
    isLoading: txnLoading,
  } = useTransactions(companyId, {
    shareholderId,
    page: txnPage,
    limit: txnLimit,
    sort: '-createdAt',
  });

  const isLoading = companyLoading || shareholderLoading;

  // Compute totals from holdings
  const totalShares = shareholder?.shareholdings?.reduce(
    (sum, h) => sum + parseFloat(h.quantity || '0'),
    0,
  ) ?? 0;

  const totalOwnership = shareholder?.shareholdings?.reduce(
    (sum, h) => sum + parseFloat(h.ownershipPct || '0'),
    0,
  ) ?? 0;

  const totalVotingPower = shareholder?.shareholdings?.reduce(
    (sum, h) => sum + parseFloat(h.votingPowerPct || '0'),
    0,
  ) ?? 0;

  // No company selected
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">{t('empty')}</p>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <DetailSkeleton />
      </div>
    );
  }

  // Error
  if (shareholderError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/shareholders"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <div className="flex items-center justify-center py-20">
          <p className="text-red-600">{t('detail.error')}</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!shareholder) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/shareholders"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">{t('detail.notFound')}</p>
        </div>
      </div>
    );
  }

  const typeBadge = getTypeBadge(shareholder.type, t);
  const statusBadge = getStatusBadge(shareholder.status, t);

  // Avatar initials (skip common Brazilian prepositions)
  const nameParts = shareholder.name
    .split(' ')
    .filter((n) => n && !['da', 'de', 'do', 'dos', 'das', 'e'].includes(n.toLowerCase()));
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.[0]?.toUpperCase() || '?');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/shareholders"
        className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      {/* Header: Avatar + Name + Badges */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ocean-600 text-white text-lg font-bold">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{shareholder.name}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
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
            {shareholder.isForeign && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-medium text-cream-700">
                <Globe className="h-3 w-3" />
                {t('foreign')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard
          label={t('detail.totalShares')}
          value={formatNumber(totalShares)}
          icon={Briefcase}
          active
        />
        <StatCard
          label={t('detail.ownershipPercentage')}
          value={formatPercentage(totalOwnership)}
          icon={User}
        />
        <StatCard
          label={t('detail.votingPower')}
          value={formatPercentage(totalVotingPower)}
          icon={User}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-gray-100 mb-6">
          <TabsTrigger value="overview">{t('detail.overview')}</TabsTrigger>
          <TabsTrigger value="holdings">{t('detail.holdings')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('detail.transactions')}</TabsTrigger>
          <TabsTrigger value="compliance">{t('detail.compliance')}</TabsTrigger>
        </TabsList>

        {/* --- Overview Tab --- */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-800">
                  {t('detail.personalInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label={t('table.name')} value={shareholder.name} />
                <InfoRow label={t('detail.cpfCnpj')} value={maskCpfCnpj(shareholder.cpfCnpj)} />
                <InfoRow label={t('table.type')} value={typeBadge.label} />
                <InfoRow label={t('detail.nationality')} value={shareholder.nationality} />
                <InfoRow label={t('detail.taxResidency')} value={shareholder.taxResidency} />
                <InfoRow
                  label={t('detail.isForeign')}
                  value={shareholder.isForeign ? t('detail.yes') : t('detail.no')}
                />
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-800">
                  {t('detail.contactInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label={t('detail.email')} value={shareholder.email} />
                <InfoRow label={t('detail.phone')} value={shareholder.phone} />
                {shareholder.address && (
                  <>
                    {shareholder.address.street && (
                      <InfoRow
                        label={t('form.addressStreet')}
                        value={shareholder.address.street}
                      />
                    )}
                    {(shareholder.address.city || shareholder.address.state) && (
                      <InfoRow
                        label={t('form.addressCity')}
                        value={
                          [shareholder.address.city, shareholder.address.state]
                            .filter(Boolean)
                            .join(', ')
                        }
                      />
                    )}
                    {shareholder.address.country && (
                      <InfoRow
                        label={t('form.addressCountry')}
                        value={shareholder.address.country}
                      />
                    )}
                    {shareholder.address.postalCode && (
                      <InfoRow
                        label={t('form.addressPostalCode')}
                        value={shareholder.address.postalCode}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- Holdings Tab --- */}
        <TabsContent value="holdings">
          {shareholder.shareholdings.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-gray-500">{t('detail.holdingsEmpty')}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t('detail.shareClass')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t('detail.shareClassType')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      {t('detail.quantity')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      {t('detail.ownershipPct')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      {t('detail.votingPowerPct')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {shareholder.shareholdings.map((holding) => (
                    <tr key={holding.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {holding.shareClass.className}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {holding.shareClass.type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                        {formatNumber(holding.quantity)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                        {formatPercentage(holding.ownershipPct)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                        {formatPercentage(holding.votingPowerPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* --- Transactions Tab --- */}
        <TabsContent value="transactions">
          {txnLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded bg-gray-200" />
              ))}
            </div>
          ) : !transactionsData?.data?.length ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-gray-500">{t('detail.transactionsEmpty')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        {tTxn('table.date')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        {tTxn('table.type')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        {tTxn('table.from')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        {tTxn('table.to')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        {tTxn('table.quantity')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        {tTxn('table.value')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        {tTxn('table.status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {transactionsData.data.map((txn: Transaction) => {
                      const txnTypeBadge = getTransactionTypeBadge(txn.type, tTxn);
                      const txnStatusBadge = getTransactionStatusBadge(txn.status, tTxn);
                      return (
                        <tr key={txn.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(txn.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                txnTypeBadge.className,
                              )}
                            >
                              {txnTypeBadge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {txn.fromShareholder?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {txn.toShareholder?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                            {formatNumber(txn.quantity)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                            {txn.totalValue ? formatCurrency(txn.totalValue) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                txnStatusBadge.className,
                              )}
                            >
                              {txnStatusBadge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Transaction pagination */}
              {transactionsData.meta && transactionsData.meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {t('pagination.showing', {
                      from: (txnPage - 1) * txnLimit + 1,
                      to: Math.min(txnPage * txnLimit, transactionsData.meta.total),
                      total: transactionsData.meta.total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
                      disabled={txnPage <= 1}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('pagination.previous')}
                    </button>
                    <span className="text-sm text-gray-500">
                      {t('pagination.page')} {txnPage} {t('pagination.of')}{' '}
                      {transactionsData.meta.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setTxnPage((p) =>
                          Math.min(transactionsData.meta!.totalPages, p + 1),
                        )
                      }
                      disabled={txnPage >= transactionsData.meta.totalPages}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('pagination.next')}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* --- Compliance Tab --- */}
        <TabsContent value="compliance">
          <div className="space-y-6">
            {/* Foreign shareholder info */}
            {shareholder.isForeign && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-800">
                    {t('detail.foreignInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow
                    label={t('detail.isForeign')}
                    value={t('detail.yes')}
                  />
                  <InfoRow
                    label={t('detail.rdeIedNumber')}
                    value={shareholder.rdeIedNumber}
                  />
                  <InfoRow
                    label={t('detail.rdeIedDate')}
                    value={shareholder.rdeIedDate ? formatDate(shareholder.rdeIedDate) : null}
                  />
                </CardContent>
              </Card>
            )}

            {/* Beneficial owners (for corporate shareholders) */}
            {shareholder.type === 'CORPORATE' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-800">
                    {t('detail.beneficialOwners')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {shareholder.beneficialOwners.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-sm text-gray-500">
                        {t('detail.beneficialOwnersEmpty')}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {t('detail.beneficialOwnersNote')}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              {t('table.name')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              {t('detail.cpfCnpj')}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                              {t('detail.ownershipPct')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {shareholder.beneficialOwners.map((bo: BeneficialOwner) => (
                            <tr key={bo.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {bo.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {maskCpfCnpj(bo.cpf)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                                {formatPercentage(bo.ownershipPct)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Non-foreign, non-corporate: show a minimal compliance info */}
            {!shareholder.isForeign && shareholder.type !== 'CORPORATE' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-800">
                    {t('detail.compliance')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label={t('detail.nationality')} value={shareholder.nationality} />
                  <InfoRow label={t('detail.taxResidency')} value={shareholder.taxResidency} />
                  <InfoRow
                    label={t('detail.isForeign')}
                    value={t('detail.no')}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
