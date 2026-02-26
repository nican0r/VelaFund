'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  Users,
  TrendingUp,
  Download,
  FileDown,
  Globe,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useOwnershipReport,
  useDilutionReport,
  useExportCapTable,
  useExportJobStatus,
  useGenerateDueDiligence,
  useDueDiligenceJobStatus,
} from '@/hooks/use-reports';
import { useShareClasses } from '@/hooks/use-share-classes';
import type { ExportFormat } from '@/types/company';

// --- Formatting Helpers ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatPct(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(num) + '%';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

// --- Stat Card ---

function StatCard({
  label,
  value,
  icon: Icon,
  active = false,
  loading = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-6',
        active
          ? 'border-transparent bg-ocean-600 text-white shadow-md'
          : 'border-gray-200 bg-white shadow-sm',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-medium uppercase',
            active ? 'text-white/80' : 'text-gray-500',
          )}
        >
          {label}
        </span>
        <Icon
          className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')}
        />
      </div>
      {loading ? (
        <div className="mt-2 h-10 w-24 animate-pulse rounded bg-gray-200" />
      ) : (
        <p
          className={cn(
            'mt-2 text-stat',
            active ? 'text-white' : 'text-navy-900',
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}

// --- Ownership Tab ---

function OwnershipTab({ companyId }: { companyId: string }) {
  const t = useTranslations('reports.ownership');
  const [shareClassId, setShareClassId] = useState<string>('');
  const [includeOptions, setIncludeOptions] = useState(true);

  const { data: shareClassesData } = useShareClasses(companyId);
  const shareClasses = shareClassesData?.data ?? [];

  const { data, isLoading, error } = useOwnershipReport(companyId, {
    shareClassId: shareClassId || undefined,
    includeOptions,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="mt-2 text-sm text-gray-700">{t('title')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={shareClassId}
          onChange={(e) => setShareClassId(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
        >
          <option value="">{t('allClasses')}</option>
          {shareClasses.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.className}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeOptions}
            onChange={(e) => setIncludeOptions(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500"
          />
          {t('includeOptions')}
        </label>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{t('totalShares')}</p>
            <p className="mt-1 text-lg font-semibold text-navy-900">
              {formatNumber(data.totalShares)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{t('totalFullyDiluted')}</p>
            <p className="mt-1 text-lg font-semibold text-navy-900">
              {formatNumber(data.totalFullyDiluted)}
            </p>
          </div>
        </div>
      )}

      {/* Shareholders table */}
      {data && data.shareholders.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('name')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('shareClass')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('shares')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('ownershipPct')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('fullyDiluted')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.shareholders.map((sh, idx) => (
                  <tr
                    key={`${sh.shareholderId}-${sh.shareClassId}`}
                    className={cn(
                      'border-b border-gray-100',
                      idx % 2 === 1 && 'bg-gray-50',
                    )}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">
                      {sh.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {sh.shareClassName}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                      {formatNumber(sh.shares)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                      {formatPct(sh.percentage)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                      {formatPct(sh.fullyDilutedPercentage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.shareholders.length === 0 && (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-6">
          <Users className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('shareholder')}</p>
        </div>
      )}

      {/* Option Pool Summary */}
      {data?.optionPoolSummary && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">{t('optionPool')}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-xs font-medium text-gray-500">{t('poolTotal')}</p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {formatNumber(data.optionPoolSummary.totalPool)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t('poolGranted')}</p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {formatNumber(data.optionPoolSummary.granted)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t('poolExercised')}</p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {formatNumber(data.optionPoolSummary.exercised)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t('poolVestedUnexercised')}</p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {formatNumber(data.optionPoolSummary.vestedUnexercised)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t('poolUnvested')}</p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {formatNumber(data.optionPoolSummary.unvested)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t('poolAvailable')}</p>
              <p className="mt-1 text-sm font-semibold text-green-700">
                {formatNumber(data.optionPoolSummary.available)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Dilution Tab ---

function DilutionTab({ companyId }: { companyId: string }) {
  const t = useTranslations('reports.dilution');
  const tStats = useTranslations('reports.stats');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, error } = useDilutionReport(companyId, {
    granularity,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="mt-2 text-sm text-gray-700">{t('title')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as 'day' | 'week' | 'month')}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
        >
          <option value="day">{t('granularityDay')}</option>
          <option value="week">{t('granularityWeek')}</option>
          <option value="month">{t('granularityMonth')}</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          title={t('dateFrom')}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          title={t('dateTo')}
        />
      </div>

      {/* Summary metrics */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{tStats('giniCoefficient')}</p>
            <p className="mt-1 text-lg font-semibold text-navy-900">
              {data.giniCoefficient}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{tStats('foreignOwnership')}</p>
            <p className="mt-1 text-lg font-semibold text-navy-900">
              {formatPct(data.foreignOwnershipPercentage)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{t('period')}</p>
            <p className="mt-1 text-lg font-semibold text-navy-900">
              {data.dataPoints.length}
            </p>
          </div>
        </div>
      )}

      {/* Data Points Table */}
      {data && data.dataPoints.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('period')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('shares')}
                  </th>
                  {data.dataPoints[0]?.shareClasses?.map((sc) => (
                    <th
                      key={sc.shareClassId}
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {sc.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.dataPoints.map((dp, idx) => (
                  <tr
                    key={dp.date}
                    className={cn(
                      'border-b border-gray-100',
                      idx % 2 === 1 && 'bg-gray-50',
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatDate(dp.date)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                      {formatNumber(dp.totalShares)}
                    </td>
                    {dp.shareClasses.map((sc) => (
                      <td
                        key={sc.shareClassId}
                        className="px-4 py-3 text-right text-sm tabular-nums text-gray-700"
                      >
                        {formatNumber(sc.shares)} ({formatPct(sc.percentage)})
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        data && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-6">
            <TrendingUp className="h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">{t('noDataPoints')}</p>
          </div>
        )
      )}
    </div>
  );
}

// --- Export Tab ---

function ExportTab({ companyId }: { companyId: string }) {
  const t = useTranslations('reports.export');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [snapshotDate, setSnapshotDate] = useState('');

  const exportMutation = useExportCapTable(companyId);
  const jobId = exportMutation.data?.jobId;
  const { data: jobStatus } = useExportJobStatus(
    companyId,
    jobId,
    !!jobId,
  );

  const currentStatus = jobStatus ?? exportMutation.data;

  function handleExport() {
    exportMutation.mutate({
      format,
      snapshotDate: snapshotDate || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">{t('title')}</h3>
        <p className="mb-4 text-sm text-gray-500">{t('description')}</p>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {t('format')}
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            >
              <option value="pdf">{t('pdf')}</option>
              <option value="xlsx">{t('xlsx')}</option>
              <option value="csv">{t('csv')}</option>
              <option value="oct">{t('oct')}</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {t('snapshotDate')}
            </label>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>

          <button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500 disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('downloading')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                {t('exportButton')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Export status */}
      {currentStatus && (
        <ExportStatusCard
          status={currentStatus.status}
          downloadUrl={currentStatus.downloadUrl}
          errorCode={currentStatus.errorCode}
          t={t}
        />
      )}
    </div>
  );
}

// --- Due Diligence Tab ---

function DueDiligenceTab({ companyId }: { companyId: string }) {
  const t = useTranslations('reports.dueDiligence');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const generateMutation = useGenerateDueDiligence(companyId);
  const jobId = generateMutation.data?.jobId;
  const { data: jobStatus } = useDueDiligenceJobStatus(
    companyId,
    jobId,
    !!jobId,
  );

  const currentStatus = jobStatus ?? generateMutation.data;

  function handleGenerate() {
    generateMutation.mutate({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">{t('title')}</h3>
        <p className="mb-4 text-sm text-gray-500">{t('description')}</p>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {t('dateFrom')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {t('dateTo')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('processing')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FileDown className="h-4 w-4" />
                {t('generate')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Due Diligence status */}
      {currentStatus && (
        <ExportStatusCard
          status={currentStatus.status}
          downloadUrl={currentStatus.downloadUrl}
          errorCode={currentStatus.errorCode}
          t={(key: string) => {
            const map: Record<string, string> = {
              queued: t('queued'),
              processing: t('processing'),
              ready: t('ready'),
              failed: t('failed'),
              download: t('download'),
            };
            return map[key] ?? key;
          }}
        />
      )}
    </div>
  );
}

// --- Export Status Card ---

function ExportStatusCard({
  status,
  downloadUrl,
  errorCode,
  t,
}: {
  status: string;
  downloadUrl: string | null;
  errorCode: string | null;
  t: (key: string) => string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        status === 'COMPLETED' && 'border-green-200 bg-green-50',
        status === 'FAILED' && 'border-red-200 bg-red-50',
        (status === 'QUEUED' || status === 'PROCESSING') && 'border-blue-200 bg-blue-50',
      )}
    >
      <div className="flex items-center gap-3">
        {status === 'QUEUED' && (
          <Loader2 className="h-5 w-5 animate-spin text-ocean-600" />
        )}
        {status === 'PROCESSING' && (
          <Loader2 className="h-5 w-5 animate-spin text-ocean-600" />
        )}
        {status === 'COMPLETED' && (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        )}
        {status === 'FAILED' && (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">
            {status === 'QUEUED' && t('queued')}
            {status === 'PROCESSING' && t('processing')}
            {status === 'COMPLETED' && t('ready')}
            {status === 'FAILED' && (errorCode || t('failed'))}
          </p>
        </div>
        {status === 'COMPLETED' && downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
          >
            {t('download')}
          </a>
        )}
      </div>
    </div>
  );
}

// --- Tab Type ---
type ReportTab = 'ownership' | 'dilution' | 'export' | 'dueDiligence';

// --- Main Page Component ---

export default function ReportsPage() {
  const t = useTranslations('reports');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;
  const [activeTab, setActiveTab] = useState<ReportTab>('ownership');

  const { data: ownershipData, isLoading: ownershipLoading } = useOwnershipReport(
    companyId,
    { includeOptions: true },
  );

  const { data: dilutionData } = useDilutionReport(companyId);

  // No company selected
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
        </div>
      </div>
    );
  }

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'ownership', label: t('tabs.ownership') },
    { key: 'dilution', label: t('tabs.dilution') },
    { key: 'export', label: t('tabs.export') },
    { key: 'dueDiligence', label: t('tabs.dueDiligence') },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] text-navy-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.totalShares')}
          value={ownershipData ? formatNumber(ownershipData.totalShares) : '—'}
          icon={BarChart3}
          active
          loading={ownershipLoading}
        />
        <StatCard
          label={t('stats.shareholders')}
          value={ownershipData ? String(ownershipData.shareholders.length) : '—'}
          icon={Users}
          loading={ownershipLoading}
        />
        <StatCard
          label={t('stats.giniCoefficient')}
          value={dilutionData?.giniCoefficient ?? '—'}
          icon={TrendingUp}
          loading={!dilutionData}
        />
        <StatCard
          label={t('stats.foreignOwnership')}
          value={dilutionData ? formatPct(dilutionData.foreignOwnershipPercentage) : '—'}
          icon={Globe}
          loading={!dilutionData}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
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
      {companyId && (
        <div>
          {activeTab === 'ownership' && <OwnershipTab companyId={companyId} />}
          {activeTab === 'dilution' && <DilutionTab companyId={companyId} />}
          {activeTab === 'export' && <ExportTab companyId={companyId} />}
          {activeTab === 'dueDiligence' && <DueDiligenceTab companyId={companyId} />}
        </div>
      )}
    </div>
  );
}
