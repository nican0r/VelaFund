'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Shield,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Activity,
  Users,
  Bot,
  Search,
  ShieldCheck,
  ShieldAlert,
  FileSearch,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useAuditLogs, useVerifyHashChain } from '@/hooks/use-audit-logs';
import type { AuditLogEntry } from '@/types/company';

// --- Action categories for the dropdown filter ---

const ACTION_OPTIONS = [
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'AUTH_LOGOUT',
  'COMPANY_CREATED',
  'COMPANY_UPDATED',
  'COMPANY_STATUS_CHANGED',
  'COMPANY_MEMBER_INVITED',
  'COMPANY_MEMBER_ACCEPTED',
  'COMPANY_MEMBER_REMOVED',
  'COMPANY_ROLE_CHANGED',
  'SHAREHOLDER_CREATED',
  'SHAREHOLDER_UPDATED',
  'SHAREHOLDER_DELETED',
  'SHARES_ISSUED',
  'SHARES_TRANSFERRED',
  'SHARES_CANCELLED',
  'SHARES_CONVERTED',
  'SHARES_SPLIT',
  'TRANSACTION_SUBMITTED',
  'TRANSACTION_APPROVED',
  'TRANSACTION_REJECTED',
  'TRANSACTION_CANCELLED',
  'ROUND_CREATED',
  'ROUND_OPENED',
  'ROUND_CLOSED',
  'ROUND_CANCELLED',
  'OPTION_PLAN_CREATED',
  'OPTION_GRANTED',
  'OPTION_EXERCISE_REQUESTED',
  'OPTION_EXERCISE_CONFIRMED',
  'OPTION_GRANT_EXPIRED',
  'SHARE_CLASS_CREATED',
  'SHARE_CLASS_UPDATED',
  'SHARE_CLASS_DELETED',
  'CAP_TABLE_SNAPSHOT_CREATED',
  'CAP_TABLE_EXPORTED',
  'DOCUMENT_GENERATED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
  'CONVERTIBLE_CREATED',
  'CONVERTIBLE_CONVERTED',
  'CONVERTIBLE_CANCELLED',
  'KYC_STARTED',
  'KYC_CPF_VERIFIED',
  'KYC_APPROVED',
  'KYC_REJECTED',
] as const;

const RESOURCE_TYPE_OPTIONS = [
  'Company',
  'CompanyMember',
  'Shareholder',
  'ShareClass',
  'Transaction',
  'FundingRound',
  'RoundCommitment',
  'OptionPlan',
  'OptionGrant',
  'OptionExerciseRequest',
  'ConvertibleInstrument',
  'Document',
  'User',
  'KYCVerification',
  'AuditLog',
  'CapTableSnapshot',
] as const;

// --- Helpers ---

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function getActionBadgeClass(action: string): string {
  if (action.startsWith('AUTH_LOGIN_FAILED') || action.includes('REJECTED') || action.includes('FAILED')) {
    return 'bg-red-50 text-[#991B1B]';
  }
  if (action.includes('CREATED') || action.includes('ISSUED') || action.includes('APPROVED') || action.includes('CONFIRMED') || action.includes('SUCCESS')) {
    return 'bg-green-100 text-green-700';
  }
  if (action.includes('DELETED') || action.includes('CANCELLED') || action.includes('REMOVED')) {
    return 'bg-gray-100 text-gray-600';
  }
  if (action.includes('UPDATED') || action.includes('CHANGED')) {
    return 'bg-blue-50 text-ocean-600';
  }
  if (action.includes('SUBMITTED') || action.includes('OPENED') || action.includes('STARTED')) {
    return 'bg-cream-100 text-cream-700';
  }
  return 'bg-gray-100 text-gray-600';
}

function getActorTypeIcon(actorType: string) {
  switch (actorType) {
    case 'SYSTEM':
      return Bot;
    case 'ADMIN':
      return Shield;
    default:
      return Users;
  }
}

// --- Expandable Row Component ---

function ExpandableRow({
  log,
  t,
}: {
  log: AuditLogEntry;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const actionLabel = t(`actions.${log.action}`) !== `actions.${log.action}`
    ? t(`actions.${log.action}`)
    : log.action;
  const resourceLabel = t(`resourceTypes.${log.resourceType}`) !== `resourceTypes.${log.resourceType}`
    ? t(`resourceTypes.${log.resourceType}`)
    : log.resourceType;
  const actorTypeLabel = t(`actorType.${log.actorType}`) !== `actorType.${log.actorType}`
    ? t(`actorType.${log.actorType}`)
    : log.actorType;
  const ActorIcon = getActorTypeIcon(log.actorType);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand icon */}
        <td className="whitespace-nowrap px-4 py-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </td>
        {/* Timestamp */}
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 tabular-nums">
          {formatDateTime(log.timestamp)}
        </td>
        {/* Actor */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <ActorIcon className="h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-700">
                {log.actorName || actorTypeLabel}
              </p>
              {log.actorEmail && (
                <p className="truncate text-xs text-gray-500">{log.actorEmail}</p>
              )}
            </div>
          </div>
        </td>
        {/* Action */}
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              getActionBadgeClass(log.action),
            )}
          >
            {actionLabel}
          </span>
        </td>
        {/* Resource Type */}
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
          {resourceLabel}
        </td>
        {/* Resource ID */}
        <td className="whitespace-nowrap px-4 py-3 text-xs font-mono text-gray-500">
          {log.resourceId ? log.resourceId.slice(0, 8) + '...' : t('table.noResourceId')}
        </td>
      </tr>
      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={6} className="px-8 py-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Changes */}
              {log.changes && (log.changes.before || log.changes.after) ? (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('changes.title')}
                  </h4>
                  <div className="space-y-3">
                    {log.changes.before && (
                      <div>
                        <span className="text-xs font-medium text-red-600">
                          {t('changes.before')}:
                        </span>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-xs text-gray-600">
                          {JSON.stringify(log.changes.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.changes.after && (
                      <div>
                        <span className="text-xs font-medium text-green-600">
                          {t('changes.after')}:
                        </span>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-xs text-gray-600">
                          {JSON.stringify(log.changes.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('changes.title')}
                  </h4>
                  <p className="text-sm text-gray-400">{t('changes.noChanges')}</p>
                </div>
              )}

              {/* Metadata */}
              {log.metadata && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('metadata.title')}
                  </h4>
                  <div className="space-y-1">
                    {(log.metadata as Record<string, unknown>).ipAddress && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('metadata.ipAddress')}:</span>{' '}
                        {String((log.metadata as Record<string, unknown>).ipAddress)}
                      </p>
                    )}
                    {(log.metadata as Record<string, unknown>).requestId && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('metadata.requestId')}:</span>{' '}
                        <span className="font-mono text-xs">
                          {String((log.metadata as Record<string, unknown>).requestId).slice(0, 8)}...
                        </span>
                      </p>
                    )}
                    {(log.metadata as Record<string, unknown>).source && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('metadata.source')}:</span>{' '}
                        {String((log.metadata as Record<string, unknown>).source)}
                      </p>
                    )}
                    {(log.metadata as Record<string, unknown>).userAgent && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('metadata.userAgent')}:</span>{' '}
                        <span className="truncate text-xs">
                          {String((log.metadata as Record<string, unknown>).userAgent).slice(0, 60)}
                          {String((log.metadata as Record<string, unknown>).userAgent).length > 60 ? '...' : ''}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// --- Verify Integrity Dialog ---

function VerifyIntegritySection({
  companyId,
  t,
}: {
  companyId: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const [showVerify, setShowVerify] = useState(false);
  const { data, isLoading } = useVerifyHashChain(
    companyId,
    undefined,
    showVerify,
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-ocean-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{t('verify.title')}</h3>
            <p className="text-xs text-gray-500">{t('verify.description')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowVerify(true)}
          disabled={isLoading}
          className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('verify.verifying')}
            </span>
          ) : (
            t('verify.button')
          )}
        </button>
      </div>
      {data && showVerify && (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-gray-500">{t('verify.status')}</p>
            <div className="mt-1 flex items-center gap-1">
              {data.status === 'VALID' ? (
                <ShieldCheck className="h-4 w-4 text-green-600" />
              ) : data.status === 'INVALID' ? (
                <ShieldAlert className="h-4 w-4 text-red-600" />
              ) : (
                <FileSearch className="h-4 w-4 text-gray-400" />
              )}
              <span
                className={cn(
                  'text-sm font-semibold',
                  data.status === 'VALID' && 'text-green-700',
                  data.status === 'INVALID' && 'text-red-700',
                  data.status === 'NO_DATA' && 'text-gray-500',
                )}
              >
                {t(`verify.${data.status === 'VALID' ? 'valid' : data.status === 'INVALID' ? 'invalid' : 'noData'}`)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{t('verify.daysVerified')}</p>
            <p className="mt-1 text-sm font-semibold text-navy-900">{data.daysVerified}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{t('verify.daysValid')}</p>
            <p className="mt-1 text-sm font-semibold text-green-700">{data.daysValid}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{t('verify.daysInvalid')}</p>
            <p className="mt-1 text-sm font-semibold text-red-700">{data.daysInvalid}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Page Component ---

export default function AuditLogsPage() {
  const t = useTranslations('auditLogs');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch audit logs
  const { data, isLoading, error } = useAuditLogs(companyId, {
    page,
    limit,
    action: actionFilter || undefined,
    resourceType: resourceTypeFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sort: '-timestamp',
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 0;

  // Compute stat card values
  const totalEvents = meta?.total ?? 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = logs.filter(
    (l) => l.timestamp.startsWith(todayStr),
  ).length;
  const userActions = logs.filter((l) => l.actorType === 'USER').length;
  const systemEvents = logs.filter((l) => l.actorType === 'SYSTEM').length;

  const hasFilters = actionFilter || resourceTypeFilter || dateFrom || dateTo;

  function clearFilters() {
    setActionFilter('');
    setResourceTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  // No company selected
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            {t('empty.description')}
          </p>
        </div>
      </div>
    );
  }

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
          label={t('stats.totalEvents')}
          value={isLoading ? '—' : String(totalEvents)}
          icon={Activity}
          active
          loading={isLoading}
        />
        <StatCard
          label={t('stats.todayEvents')}
          value={isLoading ? '—' : String(todayEvents)}
          icon={Search}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.userActions')}
          value={isLoading ? '—' : String(userActions)}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.systemEvents')}
          value={isLoading ? '—' : String(systemEvents)}
          icon={Bot}
          loading={isLoading}
        />
      </div>

      {/* Hash Chain Verification */}
      {companyId && (
        <VerifyIntegritySection companyId={companyId} t={t} />
      )}

      {/* Table Card */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3">
          {/* Action filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filters.allActions')}</option>
            {ACTION_OPTIONS.map((action) => {
              const label = t(`actions.${action}`) !== `actions.${action}`
                ? t(`actions.${action}`)
                : action;
              return (
                <option key={action} value={action}>
                  {label}
                </option>
              );
            })}
          </select>

          {/* Resource type filter */}
          <select
            value={resourceTypeFilter}
            onChange={(e) => {
              setResourceTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filters.allResourceTypes')}</option>
            {RESOURCE_TYPE_OPTIONS.map((type) => {
              const label = t(`resourceTypes.${type}`) !== `resourceTypes.${type}`
                ? t(`resourceTypes.${type}`)
                : type;
              return (
                <option key={type} value={type}>
                  {label}
                </option>
              );
            })}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            title={t('filters.dateFrom')}
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            title={t('filters.dateTo')}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-ocean-600 hover:text-ocean-700"
            >
              {t('empty.clearFilters')}
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mb-4 flex items-center gap-4">
                <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center p-6">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="mt-2 text-sm font-medium text-gray-700">{t('error.title')}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-ocean-600 hover:text-ocean-700"
            >
              {t('error.retry')}
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center p-6">
            <Shield className="h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-700">{t('empty.title')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('empty.description')}</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ocean-500"
              >
                {t('empty.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('table.timestamp')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('table.actor')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('table.action')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('table.resourceType')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('table.resourceId')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <ExpandableRow key={log.id} log={log} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              {t('pagination.showing', {
                from: (page - 1) * limit + 1,
                to: Math.min(page * limit, meta?.total ?? 0),
                total: meta?.total ?? 0,
              })}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {t('pagination.previous')}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {t('pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
