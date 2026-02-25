'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  Layers,
  BarChart3,
  ShieldCheck,
  Percent,
  Trash2,
  Users,
  FileText,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useShareClass, useDeleteShareClass } from '@/hooks/use-share-classes';
import { useCapTable } from '@/hooks/use-cap-table';
import type { ShareClassType, CapTableEntry, AntiDilutionType } from '@/types/company';
import { useRouter } from 'next/navigation';

// --- Brazilian formatting helpers (per i18n rules: always pt-BR) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatPercentage(value: number): string {
  return (
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + '%'
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR').format(date);
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

// --- Info Row ---

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-700">{value}</span>
    </div>
  );
}

// --- Type Badge ---

function getTypeBadge(type: ShareClassType, t: (key: string) => string) {
  const typeMap: Record<ShareClassType, { label: string; className: string }> = {
    QUOTA: { label: t('type.quota'), className: 'bg-blue-50 text-ocean-600' },
    COMMON_SHARES: { label: t('type.commonShares'), className: 'bg-green-100 text-celadon-700' },
    PREFERRED_SHARES: { label: t('type.preferredShares'), className: 'bg-cream-100 text-cream-700' },
  };
  return typeMap[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
}

// --- Shareholder type badge (for holders table) ---

function getShareholderTypeBadge(type: string) {
  const typeMap: Record<string, { label: string; className: string }> = {
    FOUNDER: { label: 'Founder', className: 'bg-blue-50 text-ocean-600' },
    INVESTOR: { label: 'Investor', className: 'bg-green-100 text-celadon-700' },
    EMPLOYEE: { label: 'Employee', className: 'bg-cream-100 text-cream-700' },
    ADVISOR: { label: 'Advisor', className: 'bg-gray-100 text-gray-600' },
    CORPORATE: { label: 'Corporate', className: 'bg-navy-100 text-navy-700' },
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

// --- Detail Skeleton ---

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white p-6">
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="mt-4 h-8 w-24 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

// --- Holders Tab ---

function HoldersTab({
  holders,
  loading,
  t,
}: {
  holders: CapTableEntry[];
  loading: boolean;
  t: (key: string) => string;
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center p-6">
        <Users className="h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">{t('detail.holdersEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('detail.holdersTable.name')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('detail.holdersTable.type')}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('detail.holdersTable.shares')}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('detail.holdersTable.ownershipPct')}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('detail.holdersTable.votingPct')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {holders.map((entry) => {
            const typeBadge = getShareholderTypeBadge(entry.shareholderType);
            return (
              <tr key={entry.shareholderId} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <Link
                    href={`/dashboard/shareholders/${entry.shareholderId}`}
                    className="text-sm font-medium text-ocean-600 hover:text-ocean-700 hover:underline"
                  >
                    {entry.shareholderName}
                  </Link>
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
                  {formatNumber(entry.shares)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-sm text-gray-700">
                  {formatPercentage(parseFloat(entry.ownershipPercentage))}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-sm text-gray-700">
                  {formatPercentage(parseFloat(entry.votingPercentage))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Details Tab ---

function DetailsTab({
  shareClass,
  t,
}: {
  shareClass: {
    className: string;
    type: ShareClassType;
    votesPerShare: number;
    totalAuthorized: string;
    totalIssued: string;
    liquidationPreferenceMultiple: string | null;
    participatingRights: boolean;
    participationCap: string | null;
    seniority: number;
    rightOfFirstRefusal: boolean;
    lockUpPeriodMonths: number | null;
    tagAlongPercentage: string | null;
    conversionRatio: string | null;
    antiDilutionType: AntiDilutionType | null;
    createdAt: string;
    updatedAt: string;
  };
  t: (key: string) => string;
}) {
  const typeBadge = getTypeBadge(shareClass.type, t);
  const isPreferred = shareClass.type === 'PREFERRED_SHARES';

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
      {/* Share Class Information */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-800">
          {t('detail.information')}
        </h3>
        <InfoRow label={t('detail.className')} value={shareClass.className} />
        <InfoRow
          label={t('detail.type')}
          value={
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                typeBadge.className,
              )}
            >
              {typeBadge.label}
            </span>
          }
        />
        <InfoRow label={t('detail.authorized')} value={formatNumber(shareClass.totalAuthorized)} />
        <InfoRow label={t('detail.issued')} value={formatNumber(shareClass.totalIssued)} />
        <InfoRow label={t('detail.createdAt')} value={formatDate(shareClass.createdAt)} />
        <InfoRow label={t('detail.updatedAt')} value={formatDate(shareClass.updatedAt)} />
      </div>

      {/* Voting Rights */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-800">
          {t('detail.votingRights')}
        </h3>
        <InfoRow label={t('detail.votesPerShare')} value={String(shareClass.votesPerShare)} />
        <InfoRow
          label={t('detail.antiDilution')}
          value={
            shareClass.antiDilutionType
              ? shareClass.antiDilutionType === 'FULL_RATCHET'
                ? t('detail.antiDilutionType.fullRatchet')
                : t('detail.antiDilutionType.weightedAverage')
              : t('detail.none')
          }
        />
        <InfoRow
          label={t('detail.conversionRatio')}
          value={shareClass.conversionRatio ? formatNumber(shareClass.conversionRatio) : t('detail.none')}
        />
      </div>

      {/* Liquidation Preferences (only for PREFERRED_SHARES) */}
      {isPreferred && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-800">
            {t('detail.preferences')}
          </h3>
          <InfoRow
            label={t('detail.liquidationMultiple')}
            value={
              shareClass.liquidationPreferenceMultiple
                ? `${formatNumber(shareClass.liquidationPreferenceMultiple)}x`
                : t('detail.none')
            }
          />
          <InfoRow
            label={t('detail.participatingRights')}
            value={shareClass.participatingRights ? t('detail.yes') : t('detail.no')}
          />
          <InfoRow
            label={t('detail.participationCap')}
            value={
              shareClass.participationCap
                ? formatPercentage(parseFloat(shareClass.participationCap))
                : t('detail.none')
            }
          />
          <InfoRow label={t('detail.seniority')} value={String(shareClass.seniority)} />
        </div>
      )}

      {/* Transfer Restrictions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-800">
          {t('detail.restrictions')}
        </h3>
        <InfoRow
          label={t('detail.rightOfFirstRefusal')}
          value={shareClass.rightOfFirstRefusal ? t('detail.yes') : t('detail.no')}
        />
        <InfoRow
          label={t('detail.lockUpPeriod')}
          value={
            shareClass.lockUpPeriodMonths
              ? t('detail.lockUpMonths', { months: shareClass.lockUpPeriodMonths })
              : t('detail.noLockUp')
          }
        />
        <InfoRow
          label={t('detail.tagAlong')}
          value={
            shareClass.tagAlongPercentage
              ? formatPercentage(parseFloat(shareClass.tagAlongPercentage))
              : t('detail.none')
          }
        />
      </div>
    </div>
  );
}

// --- Main Share Class Detail Page ---

export default function ShareClassDetailPage() {
  const t = useTranslations('shareClasses');
  const commonT = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const shareClassId = params.id as string;
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Fetch share class details
  const {
    data: shareClass,
    isLoading: scLoading,
    error: scError,
  } = useShareClass(companyId, shareClassId);

  // Fetch cap table for holders data
  const { data: capTable, isLoading: capTableLoading } = useCapTable(companyId);

  // Filter cap table entries for this share class
  const holders: CapTableEntry[] =
    capTable?.entries?.filter((entry) => entry.shareClassId === shareClassId) ?? [];

  // Delete mutation
  const deleteMutation = useDeleteShareClass(companyId);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'holders' | 'details'>('holders');

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(shareClassId);
      router.push('/dashboard/share-classes');
    } catch {
      // Error handled by TanStack Query / API error toast
    }
  };

  // Loading state
  if (companyLoading || scLoading) {
    return <DetailSkeleton />;
  }

  // No company
  if (!selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('empty')}</p>
        </div>
      </div>
    );
  }

  // Error
  if (scError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          href="/dashboard/share-classes"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.backToList')}
        </Link>
        <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center">
          <Layers className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-red-600">{t('detail.error')}</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!shareClass) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          href="/dashboard/share-classes"
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.backToList')}
        </Link>
        <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center">
          <Layers className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('detail.notFound')}</p>
        </div>
      </div>
    );
  }

  // Compute stats
  const authorized = parseFloat(shareClass.totalAuthorized) || 0;
  const issued = parseFloat(shareClass.totalIssued) || 0;
  const available = authorized - issued;
  const issuedPct = authorized > 0 ? (issued / authorized) * 100 : 0;
  const hasIssued = issued > 0;
  const typeBadge = getTypeBadge(shareClass.type, t);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Back link */}
      <Link
        href="/dashboard/share-classes"
        className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.backToList')}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
              {shareClass.className}
            </h1>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                typeBadge.className,
              )}
            >
              {typeBadge.label}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-gray-500">
            {t('detail.title')}
          </p>
        </div>
        {!hasIssued && (
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            {commonT('delete')}
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('detail.authorized')}
          value={formatNumber(authorized)}
          icon={Layers}
          active
        />
        <StatCard
          label={t('detail.issued')}
          value={formatNumber(issued)}
          icon={BarChart3}
        />
        <StatCard
          label={t('detail.available')}
          value={formatNumber(available)}
          icon={ShieldCheck}
        />
        <StatCard
          label={t('detail.issuedPct')}
          value={formatPercentage(issuedPct)}
          icon={Percent}
        />
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Tab bar */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0">
            <button
              type="button"
              onClick={() => setActiveTab('holders')}
              className={cn(
                'px-6 py-3 text-sm font-medium transition-colors',
                activeTab === 'holders'
                  ? 'border-b-2 border-ocean-600 text-ocean-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {t('detail.tabHolders')}
                {holders.length > 0 && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {holders.length}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={cn(
                'px-6 py-3 text-sm font-medium transition-colors',
                activeTab === 'details'
                  ? 'border-b-2 border-ocean-600 text-ocean-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {t('detail.tabDetails')}
              </span>
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'holders' && (
          <HoldersTab holders={holders} loading={capTableLoading} t={t} />
        )}
        {activeTab === 'details' && (
          <DetailsTab shareClass={shareClass} t={t} />
        )}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        t={t}
        commonT={commonT}
      />
    </div>
  );
}
