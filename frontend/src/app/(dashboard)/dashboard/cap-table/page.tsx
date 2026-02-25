'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Layers,
  Users,
  Grid3X3,
  PieChart as PieChartIcon,
  Download,
  History,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useCapTableCurrent,
  useCapTableFullyDiluted,
  useCapTableHistory,
  useExportCapTable,
} from '@/hooks/use-cap-table-page';
import { OwnershipChart } from '@/components/dashboard/ownership-chart';
import type { CapTableEntry, FullyDilutedEntry, CapTableHistoryItem } from '@/types/company';

// --- Brazilian number formatting (per i18n rules: always pt-BR format) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatPct(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0,0%';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(num) + '%';
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

// --- Stat Card (same pattern as dashboard) ---

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

function getShareholderTypeBadge(type: string, t: (key: string) => string) {
  const typeMap: Record<string, { label: string; color: string }> = {
    FOUNDER: { label: t('types.founder'), color: 'bg-blue-50 text-ocean-600' },
    INVESTOR: { label: t('types.investor'), color: 'bg-green-100 text-celadon-700' },
    EMPLOYEE: { label: t('types.employee'), color: 'bg-cream-100 text-cream-700' },
    ADVISOR: { label: t('types.advisor'), color: 'bg-gray-100 text-gray-600' },
    CORPORATE: { label: t('types.corporate'), color: 'bg-navy-100 text-navy-700' },
  };
  return typeMap[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' };
}

// --- Share class type label ---

function getShareClassTypeLabel(type: string, t: (key: string) => string): string {
  const typeMap: Record<string, string> = {
    QUOTA: t('types.quota'),
    COMMON_SHARES: t('types.commonShares'),
    PREFERRED_SHARES: t('types.preferredShares'),
  };
  return typeMap[type] ?? type;
}

// --- Current Cap Table View ---

function CurrentCapTableView({
  entries,
  isLoading,
  isEmpty,
  t,
}: {
  entries: CapTableEntry[];
  isLoading: boolean;
  isEmpty: boolean;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg bg-gray-50">
        <Layers className="h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-400">{t('empty')}</p>
      </div>
    );
  }

  // Calculate summary totals
  const totalShares = entries.reduce(
    (sum, e) => sum + parseFloat(e.shares || '0'),
    0,
  );
  const totalVotingPower = entries.reduce(
    (sum, e) => sum + parseFloat(e.votingPower || '0'),
    0,
  );

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('table.shareholder')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('table.shareClass')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('table.shares')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('table.ownership')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('table.votingPower')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('table.votingPercentage')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry, idx) => {
              const badge = getShareholderTypeBadge(entry.shareholderType, t);
              return (
                <tr
                  key={`${entry.shareholderId}-${entry.shareClassId}-${idx}`}
                  className="transition-colors duration-150 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {entry.shareholderName}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                          badge.color,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {entry.shareClassName}
                    </span>
                    <span className="ml-1 text-xs text-gray-400">
                      ({getShareClassTypeLabel(entry.shareClassType, t)})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatNumber(entry.shares)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatPct(entry.ownershipPercentage)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatNumber(entry.votingPower)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatPct(entry.votingPercentage)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="px-4 py-3 text-sm font-semibold text-navy-900" colSpan={2}>
                {t('summary')}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-navy-900">
                {formatNumber(totalShares)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-navy-900">
                100,0%
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-navy-900">
                {formatNumber(totalVotingPower)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-navy-900">
                100,0%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// --- Fully Diluted View ---

function FullyDilutedView({
  entries,
  isLoading,
  isEmpty,
  t,
}: {
  entries: FullyDilutedEntry[];
  isLoading: boolean;
  isEmpty: boolean;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg bg-gray-50">
        <Layers className="h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-400">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('table.shareholder')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('fullyDiluted.currentShares')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('fullyDiluted.currentPercentage')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('fullyDiluted.optionsVested')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('fullyDiluted.optionsUnvested')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('fullyDiluted.fullyDilutedShares')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('fullyDiluted.fullyDilutedPercentage')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const badge = getShareholderTypeBadge(entry.shareholderType, t);
              return (
                <tr
                  key={entry.shareholderId}
                  className="transition-colors duration-150 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {entry.shareholderName}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                          badge.color,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatNumber(entry.currentShares)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatPct(entry.currentPercentage)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatNumber(entry.optionsVested)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                    {formatNumber(entry.optionsUnvested)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-navy-900">
                    {formatNumber(entry.fullyDilutedShares)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-navy-900">
                    {formatPct(entry.fullyDilutedPercentage)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- History View ---

function HistoryView({
  items,
  isLoading,
  isEmpty,
  t,
}: {
  items: CapTableHistoryItem[];
  isLoading: boolean;
  isEmpty: boolean;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg bg-gray-50">
        <History className="h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-400">{t('history.empty')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('history.snapshotDate')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('history.totalShares')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('history.totalShareholders')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('history.trigger')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('history.notes')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('history.createdAt')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className="transition-colors duration-150 hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatDate(item.snapshotDate)}
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                  {formatNumber(item.totalShares)}
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                  {formatNumber(item.totalShareholders)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {item.trigger}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {item.notes ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDate(item.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Export Dropdown ---

function ExportDropdown({
  companyId,
  t,
}: {
  companyId: string | undefined;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const exportMutation = useExportCapTable(companyId);

  const handleExport = (format: string) => {
    setOpen(false);
    exportMutation.mutate({ format });
  };

  const formats = [
    { key: 'pdf', label: t('export.pdf') },
    { key: 'xlsx', label: t('export.xlsx') },
    { key: 'csv', label: t('export.csv') },
    { key: 'oct', label: t('export.oct') },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={!companyId || exportMutation.isPending}
        className="inline-flex items-center gap-x-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {exportMutation.isPending ? t('export.downloading') : t('export.button')}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-40 rounded-md bg-white shadow-lg ring-1 ring-gray-200">
            <div className="py-1">
              {formats.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleExport(f.key)}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-100"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Cap Table Page ---

type TabView = 'current' | 'fullyDiluted' | 'history';

export default function CapTablePage() {
  const t = useTranslations('capTable');
  const { selectedCompany, isLoading: companyLoading } = useCompany();

  const companyId = selectedCompany?.id;

  const [activeTab, setActiveTab] = useState<TabView>('current');
  const [shareClassFilter, setShareClassFilter] = useState<string | undefined>(
    undefined,
  );

  const {
    data: capTable,
    isLoading: capTableLoading,
    error: capTableError,
  } = useCapTableCurrent(companyId, shareClassFilter);

  const {
    data: fullyDiluted,
    isLoading: fdLoading,
  } = useCapTableFullyDiluted(companyId, activeTab === 'fullyDiluted');

  const {
    data: historyData,
    isLoading: historyLoading,
  } = useCapTableHistory(companyId, { limit: 20 });

  const isLoading = companyLoading || capTableLoading;

  // Extract unique share classes from current entries for the filter
  const shareClasses = capTable?.entries
    ? Array.from(
        new Map(
          capTable.entries.map((e) => [
            e.shareClassId,
            { id: e.shareClassId, className: e.shareClassName, type: e.shareClassType },
          ]),
        ).values(),
      )
    : [];

  // No company state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            {t('empty')}
          </h2>
        </div>
      </div>
    );
  }

  const tabs: { key: TabView; label: string }[] = [
    { key: 'current', label: t('tabs.current') },
    { key: 'fullyDiluted', label: t('tabs.fullyDiluted') },
    { key: 'history', label: t('tabs.history') },
  ];

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
        <ExportDropdown companyId={companyId} t={t} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.totalShares')}
          value={capTable ? formatNumber(capTable.summary.totalShares) : '—'}
          icon={Layers}
          active
          loading={isLoading}
        />
        <StatCard
          label={t('stats.shareholders')}
          value={capTable ? formatNumber(capTable.summary.totalShareholders) : '—'}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.shareClasses')}
          value={capTable ? formatNumber(capTable.summary.totalShareClasses) : '—'}
          icon={Grid3X3}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.optionPool')}
          value={
            fullyDiluted
              ? formatNumber(fullyDiluted.summary.totalOptionsOutstanding)
              : '—'
          }
          icon={PieChartIcon}
          loading={isLoading || fdLoading}
        />
      </div>

      {/* Content area with tabs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Tab bar + filter */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                  activeTab === tab.key
                    ? 'text-ocean-600'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ocean-600" />
                )}
              </button>
            ))}
          </div>

          {/* Share class filter (only for current view) */}
          {activeTab === 'current' && shareClasses.length > 1 && (
            <div className="pb-4 sm:pb-0">
              <select
                value={shareClassFilter ?? ''}
                onChange={(e) =>
                  setShareClassFilter(e.target.value || undefined)
                }
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
              >
                <option value="">{t('filter.allClasses')}</option>
                {shareClasses.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.className}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'current' && (
            <>
              <CurrentCapTableView
                entries={capTable?.entries ?? []}
                isLoading={isLoading}
                isEmpty={!capTableError && !isLoading && (!capTable?.entries?.length)}
                t={t}
              />

              {/* Ownership chart below the table */}
              {capTable?.entries?.length ? (
                <div className="mt-8">
                  <h3 className="text-base font-semibold text-gray-800">
                    {t('stats.shareholders')}
                  </h3>
                  <div className="mt-4">
                    <OwnershipChart
                      entries={capTable.entries}
                      othersLabel={t('types.corporate')}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}

          {activeTab === 'fullyDiluted' && (
            <FullyDilutedView
              entries={fullyDiluted?.entries ?? []}
              isLoading={fdLoading}
              isEmpty={!fdLoading && (!fullyDiluted?.entries?.length)}
              t={t}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              items={historyData?.data ?? []}
              isLoading={historyLoading}
              isEmpty={!historyLoading && (!historyData?.data?.length)}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  );
}
