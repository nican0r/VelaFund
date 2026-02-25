'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/use-notifications';
import type { Notification, NotificationType } from '@/types/company';

function getNotificationIcon(type: NotificationType): string {
  const iconMap: Record<string, string> = {
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
  return iconMap[type] || 'bg-gray-100 text-gray-600';
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

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ open, onClose }: NotificationDropdownProps) {
  const t = useTranslations('notifications');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useNotifications({ limit: 5, sort: '-createdAt' });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  const notifications = data?.data ?? [];
  const hasUnread = notifications.some((n) => !n.read);

  function handleMarkAsRead(notificationId: string) {
    markAsRead.mutate(notificationId);
  }

  function handleMarkAllAsRead() {
    markAllAsRead.mutate();
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-1 w-[380px] rounded-lg border border-gray-200 bg-white shadow-lg"
      role="menu"
      aria-label={t('title')}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-navy-900">{t('title')}</h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs font-medium text-ocean-600 hover:text-ocean-700"
            disabled={markAllAsRead.isPending}
          >
            {t('markAllRead')}
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">{t('empty')}</p>
            <p className="mt-1 text-xs text-gray-400">{t('emptyDescription')}</p>
          </div>
        ) : (
          <div>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-2.5">
        <Link
          href="/dashboard/notifications"
          className="flex items-center justify-center gap-1.5 text-xs font-medium text-ocean-600 hover:text-ocean-700"
          onClick={onClose}
        >
          {t('viewAll')}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkAsRead,
  t,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const iconClass = getNotificationIcon(notification.notificationType);
  const timeStr = formatRelativeTime(notification.createdAt, t);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50',
        !notification.read && 'bg-blue-50/30',
      )}
    >
      {/* Icon dot */}
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs', iconClass)}>
        <Bell className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', !notification.read ? 'font-medium text-navy-900' : 'text-gray-700')}>
          {notification.subject}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-gray-400">{timeStr}</span>
          {notification.companyName && (
            <>
              <span className="text-xs text-gray-300">·</span>
              <span className="truncate text-xs text-gray-400">{notification.companyName}</span>
            </>
          )}
        </div>
      </div>

      {/* Mark as read button */}
      {!notification.read && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id);
          }}
          className="mt-1 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-ocean-600"
          aria-label="Mark as read"
          title="Mark as read"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
