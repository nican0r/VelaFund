'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Shield,
  ArrowLeftRight,
  FileText,
  Gift,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useErrorToast } from '@/lib/use-error-toast';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationPreferences,
  useUpdatePreferences,
} from '@/hooks/use-notifications';
import type { Notification, NotificationType } from '@/types/company';

// --- Notification type → category mapping for filter ---
const TYPE_CATEGORY_MAP: Record<string, string> = {
  SIGNATURE_REQUEST: 'documents',
  DOCUMENT_SIGNED: 'documents',
  DOCUMENT_FULLY_SIGNED: 'documents',
  DOCUMENT_DECLINED: 'documents',
  SHARES_ISSUED: 'transactions',
  SHARES_TRANSFERRED: 'transactions',
  TRANSACTION_FAILED: 'transactions',
  SHAREHOLDER_ADDED: 'transactions',
  SHAREHOLDER_REMOVED: 'transactions',
  DILUTION_EVENT: 'transactions',
  OPTION_GRANTED: 'options',
  VESTING_MILESTONE: 'options',
  OPTION_EXERCISE_REQUESTED: 'options',
  OPTION_EXERCISE_COMPLETED: 'options',
  OPTIONS_EXPIRING: 'options',
  ROUND_INVITATION: 'fundingRounds',
  ROUND_CLOSING_SOON: 'fundingRounds',
  ROUND_CLOSED: 'fundingRounds',
  KYC_COMPLETED: 'security',
  KYC_REJECTED: 'security',
  KYC_RESUBMISSION: 'security',
};

function getNotificationIconClass(type: NotificationType): string {
  const map: Record<string, string> = {
    SHARES_ISSUED: 'bg-green-100 text-green-700',
    SHARES_TRANSFERRED: 'bg-blue-50 text-ocean-600',
    TRANSACTION_FAILED: 'bg-red-50 text-red-600',
    SHAREHOLDER_ADDED: 'bg-green-100 text-green-700',
    SHAREHOLDER_REMOVED: 'bg-red-50 text-red-600',
    DILUTION_EVENT: 'bg-cream-100 text-cream-700',
    OPTION_GRANTED: 'bg-green-100 text-green-700',
    VESTING_MILESTONE: 'bg-blue-50 text-ocean-600',
    OPTION_EXERCISE_REQUESTED: 'bg-cream-100 text-cream-700',
    OPTION_EXERCISE_COMPLETED: 'bg-green-100 text-green-700',
    OPTIONS_EXPIRING: 'bg-cream-100 text-cream-700',
    ROUND_INVITATION: 'bg-blue-50 text-ocean-600',
    ROUND_CLOSING_SOON: 'bg-cream-100 text-cream-700',
    ROUND_CLOSED: 'bg-green-100 text-green-700',
    KYC_COMPLETED: 'bg-green-100 text-green-700',
    KYC_REJECTED: 'bg-red-50 text-red-600',
    KYC_RESUBMISSION: 'bg-cream-100 text-cream-700',
    SIGNATURE_REQUEST: 'bg-blue-50 text-ocean-600',
    DOCUMENT_SIGNED: 'bg-green-100 text-green-700',
    DOCUMENT_FULLY_SIGNED: 'bg-green-100 text-green-700',
    DOCUMENT_DECLINED: 'bg-red-50 text-red-600',
  };
  return map[type] || 'bg-gray-100 text-gray-600';
}

function formatRelativeTime(dateStr: string, t: (key: string, values?: Record<string, unknown>) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return t('time.now');
  if (diffMinutes < 60) return t('time.minutesAgo', { count: diffMinutes });
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
  return t('time.daysAgo', { count: diffDays });
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// --- Filter categories for type dropdown ---
const CATEGORY_TYPES: Record<string, NotificationType[]> = {
  transactions: [
    'SHARES_ISSUED',
    'SHARES_TRANSFERRED',
    'TRANSACTION_FAILED',
    'SHAREHOLDER_ADDED',
    'SHAREHOLDER_REMOVED',
    'DILUTION_EVENT',
  ],
  documents: [
    'SIGNATURE_REQUEST',
    'DOCUMENT_SIGNED',
    'DOCUMENT_FULLY_SIGNED',
    'DOCUMENT_DECLINED',
  ],
  options: [
    'OPTION_GRANTED',
    'VESTING_MILESTONE',
    'OPTION_EXERCISE_REQUESTED',
    'OPTION_EXERCISE_COMPLETED',
    'OPTIONS_EXPIRING',
  ],
  fundingRounds: [
    'ROUND_INVITATION',
    'ROUND_CLOSING_SOON',
    'ROUND_CLOSED',
  ],
  security: [
    'KYC_COMPLETED',
    'KYC_REJECTED',
    'KYC_RESUBMISSION',
  ],
};

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const showErrorToast = useErrorToast();

  const [activeTab, setActiveTab] = useState<'all' | 'preferences'>('all');
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<'' | 'true' | 'false'>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading, error } = useNotifications({
    page,
    limit: 20,
    read: readFilter || undefined,
    sort: '-createdAt',
  });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = data?.data ?? [];
  const meta = data?.meta;

  // Client-side category filter (backend only supports type filter, we filter by category)
  const filteredNotifications = categoryFilter
    ? notifications.filter((n) => TYPE_CATEGORY_MAP[n.notificationType] === categoryFilter)
    : notifications;

  const hasUnread = notifications.some((n) => !n.read);

  function handleMarkAsRead(id: string) {
    markAsRead.mutate(id);
  }

  function handleMarkAllAsRead() {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('markAllReadSuccess'));
      },
      onError: (err) => showErrorToast(err),
    });
  }

  function handleDelete(id: string) {
    deleteNotification.mutate(id, {
      onSuccess: () => {
        toast.success(t('deleteSuccess'));
        setDeleteConfirmId(null);
      },
      onError: (err) => showErrorToast(err),
    });
  }

  const tabs = [
    { key: 'all' as const, label: t('title') },
    { key: 'preferences' as const, label: t('preferences.title') },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[30px] font-bold tracking-tight text-navy-900">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500">{t('description')}</p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
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

      {/* Tab content */}
      {activeTab === 'all' && (
        <NotificationList
          notifications={filteredNotifications}
          meta={meta}
          isLoading={isLoading}
          error={error}
          page={page}
          setPage={setPage}
          readFilter={readFilter}
          setReadFilter={setReadFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          hasUnread={hasUnread}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onDelete={handleDelete}
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          deleteIsPending={deleteNotification.isPending}
          t={t}
        />
      )}

      {activeTab === 'preferences' && <PreferencesTab t={t} />}
    </div>
  );
}

// --- Notification List Tab ---

function NotificationList({
  notifications,
  meta,
  isLoading,
  error,
  page,
  setPage,
  readFilter,
  setReadFilter,
  categoryFilter,
  setCategoryFilter,
  hasUnread,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  deleteConfirmId,
  setDeleteConfirmId,
  deleteIsPending,
  t,
}: {
  notifications: Notification[];
  meta: { total: number; page: number; limit: number; totalPages: number } | undefined;
  isLoading: boolean;
  error: Error | null;
  page: number;
  setPage: (p: number) => void;
  readFilter: string;
  setReadFilter: (f: '' | 'true' | 'false') => void;
  categoryFilter: string;
  setCategoryFilter: (f: string) => void;
  hasUnread: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  deleteIsPending: boolean;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const showErrorToast = useErrorToast();

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Read filter */}
        <select
          value={readFilter}
          onChange={(e) => {
            setReadFilter(e.target.value as '' | 'true' | 'false');
            setPage(1);
          }}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-ocean-600 focus:ring-2 focus:ring-ocean-600/20"
        >
          <option value="">{t('filters.all')}</option>
          <option value="false">{t('filters.unreadOnly')}</option>
          <option value="true">{t('filters.readOnly')}</option>
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-ocean-600 focus:ring-2 focus:ring-ocean-600/20"
        >
          <option value="">{t('filters.allTypes')}</option>
          <option value="transactions">{t('filters.transactions')}</option>
          <option value="documents">{t('filters.documents')}</option>
          <option value="options">{t('filters.options')}</option>
          <option value="fundingRounds">{t('filters.fundingRounds')}</option>
          <option value="security">{t('filters.security')}</option>
        </select>

        {/* Clear filters */}
        {(readFilter || categoryFilter) && (
          <button
            onClick={() => {
              setReadFilter('');
              setCategoryFilter('');
              setPage(1);
            }}
            className="text-sm text-ocean-600 hover:text-ocean-700"
          >
            {t('clearFilters')}
          </button>
        )}

        {/* Mark all as read */}
        <div className="flex-1" />
        {hasUnread && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <CheckCheck className="h-4 w-4" />
            {t('markAllRead')}
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-0 divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center">
            <BellOff className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-700">{t('loadError')}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-medium text-ocean-600 hover:text-ocean-700"
            >
              {t('retry')}
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-700">
              {readFilter || categoryFilter ? t('emptyFiltered') : t('empty')}
            </p>
            <p className="mt-1 text-xs text-gray-400">{t('emptyDescription')}</p>
            {(readFilter || categoryFilter) && (
              <button
                onClick={() => {
                  setReadFilter('');
                  setCategoryFilter('');
                  setPage(1);
                }}
                className="mt-3 text-sm font-medium text-ocean-600 hover:text-ocean-700"
              >
                {t('clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-4 transition-colors hover:bg-gray-50',
                  !notification.read && 'bg-blue-50/30',
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    getNotificationIconClass(notification.notificationType),
                  )}
                >
                  <Bell className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm leading-snug', !notification.read ? 'font-medium text-navy-900' : 'text-gray-700')}>
                    {notification.subject}
                  </p>
                  {notification.body && (
                    <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">
                      {notification.body}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {formatDate(notification.createdAt)}
                    </span>
                    {notification.companyName && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="truncate text-xs text-gray-400">
                          {notification.companyName}
                        </span>
                      </>
                    )}
                    <span className="text-xs text-gray-300">·</span>
                    <span className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      getNotificationIconClass(notification.notificationType),
                    )}>
                      {t(`types.${notification.notificationType}`)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {!notification.read && (
                    <button
                      onClick={() => onMarkAsRead(notification.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ocean-600"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirmId(notification.id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              {((page - 1) * (meta.limit || 20)) + 1}–{Math.min(page * (meta.limit || 20), meta.total)} / {meta.total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= meta.totalPages}
                className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-navy-900/50" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative z-50 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-navy-900">
              {t('title')}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t('deleteSuccess').replace('excluída', 'será excluída').replace('deleted', 'will be deleted')}?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                disabled={deleteIsPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleDeleteConfirm(id: string) {
    onDelete(id);
  }
}

// --- Preferences Tab ---

function PreferencesTab({ t }: { t: (key: string, values?: Record<string, unknown>) => string }) {
  const showErrorToast = useErrorToast();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdatePreferences();

  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean> | null>(null);

  // Initialize local state from fetched prefs
  const prefs = localPrefs ?? preferences?.categories;

  function handleToggle(category: string) {
    if (category === 'security') return; // Security cannot be disabled
    setLocalPrefs((prev) => ({
      ...(prev ?? preferences?.categories ?? {}),
      [category]: !(prev ?? preferences?.categories)?.[category as keyof typeof preferences.categories],
    }));
  }

  function handleSave() {
    if (!localPrefs) return;
    updatePreferences.mutate(
      {
        transactions: localPrefs.transactions,
        documents: localPrefs.documents,
        options: localPrefs.options,
        fundingRounds: localPrefs.fundingRounds,
      },
      {
        onSuccess: () => {
          toast.success(t('preferences.saveSuccess'));
          setLocalPrefs(null);
        },
        onError: (err) => showErrorToast(err),
      },
    );
  }

  const categories = [
    { key: 'security', icon: Shield, locked: true },
    { key: 'transactions', icon: ArrowLeftRight, locked: false },
    { key: 'documents', icon: FileText, locked: false },
    { key: 'options', icon: Gift, locked: false },
    { key: 'fundingRounds', icon: TrendingUp, locked: false },
  ];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-navy-900">{t('preferences.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('preferences.description')}</p>
      </div>

      <div className="divide-y divide-gray-100 px-6">
        {categories.map(({ key, icon: Icon, locked }) => {
          const enabled = prefs?.[key as keyof typeof prefs] ?? true;

          return (
            <div key={key} className="flex items-center gap-4 py-4">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                enabled ? 'bg-ocean-50 text-ocean-600' : 'bg-gray-100 text-gray-400',
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-navy-900">
                    {t(`preferences.${key}`)}
                  </span>
                  {locked && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {locked
                    ? t('preferences.securityLocked')
                    : t(`preferences.${key}Description`)}
                </p>
              </div>
              <button
                onClick={() => handleToggle(key)}
                disabled={locked}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ocean-600 focus:ring-offset-2',
                  enabled ? 'bg-ocean-600' : 'bg-gray-200',
                  locked && 'cursor-not-allowed opacity-60',
                )}
                role="switch"
                aria-checked={enabled}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                    enabled ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Save button */}
      {localPrefs && (
        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleSave}
            disabled={updatePreferences.isPending}
            className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-500 disabled:opacity-50"
          >
            {t('preferences.save')}
          </button>
        </div>
      )}
    </div>
  );
}
