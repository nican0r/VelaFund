'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Building2,
  Users,
  Bell,
  Eye,
  Globe,
  FolderOpen,
  UserPlus,
  Settings,
  CheckCircle2,
  Circle,
  ArrowRight,
  ChevronRight,
  Shield,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useAuth } from '@/lib/auth';
import { useCompanyProfile } from '@/hooks/use-company-profile';
import { useUnreadCount } from '@/hooks/use-notifications';
import { useNotifications } from '@/hooks/use-notifications';
import type { CompanyProfile } from '@/types/company';

// --- Profile Completeness Logic ---

interface CompletenessItem {
  key: string;
  done: boolean;
}

function computeCompleteness(
  profile: CompanyProfile | null | undefined,
  kycStatus: string | undefined,
): { percentage: number; items: CompletenessItem[] } {
  const items: CompletenessItem[] = [
    { key: 'profile', done: !!profile },
    { key: 'description', done: !!profile?.description },
    { key: 'logo', done: !!profile?.company?.logoUrl },
    { key: 'metrics', done: (profile?.metrics?.length ?? 0) > 0 },
    { key: 'team', done: (profile?.team?.length ?? 0) > 0 },
    { key: 'documents', done: (profile?.documents?.length ?? 0) > 0 },
    { key: 'kyc', done: kycStatus === 'APPROVED' },
    { key: 'publish', done: profile?.status === 'PUBLISHED' },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const percentage = Math.round((doneCount / items.length) * 100);

  return { percentage, items };
}

// --- Stat Card ---

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  active = false,
  loading = false,
}: StatCardProps) {
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
        <Icon
          className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')}
        />
      </div>
      {loading ? (
        <div
          className={cn(
            'mt-2 h-10 w-24 animate-pulse rounded',
            active ? 'bg-white/20' : 'bg-gray-200',
          )}
        />
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

// --- Completeness Progress ---

interface CompletenessCardProps {
  percentage: number;
  items: CompletenessItem[];
  loading?: boolean;
}

function CompletenessCard({ percentage, items, loading }: CompletenessCardProps) {
  const t = useTranslations('dashboard.completeness');
  const incompleteItems = items.filter((i) => !i.done);
  const isComplete = percentage === 100;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-gray-200" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-52 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          {t('title')}
        </h2>
        <span className="text-sm font-bold text-ocean-600">
          {t('percent', { value: percentage })}
        </span>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isComplete ? 'bg-green-600' : 'bg-ocean-600',
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('title')}
        />
      </div>
      {/* Checklist */}
      {isComplete ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {t('complete')}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {incompleteItems.slice(0, 4).map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-2 text-sm text-gray-500"
            >
              <Circle className="h-3.5 w-3.5 text-gray-300" />
              {t(`items.${item.key}`)}
            </li>
          ))}
          {incompleteItems.length > 4 && (
            <li className="text-xs text-gray-400">
              +{incompleteItems.length - 4} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// --- Company Health Card ---

interface HealthCardProps {
  companyStatus: string | undefined;
  cnpjValidatedAt: string | null | undefined;
  kycStatus: string | undefined;
  loading?: boolean;
}

function HealthCard({
  companyStatus,
  cnpjValidatedAt,
  kycStatus,
  loading,
}: HealthCardProps) {
  const t = useTranslations('dashboard.health');
  const ts = useTranslations('dashboard.statuses');

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const healthItems = [
    {
      label: t('companyStatus'),
      icon: Building2,
      value: companyStatus ? ts(companyStatus as 'ACTIVE' | 'DRAFT' | 'INACTIVE' | 'DISSOLVED') : '—',
      status: companyStatus === 'ACTIVE' ? 'success' : 'warning',
    },
    {
      label: t('cnpj'),
      icon: FileCheck,
      value: cnpjValidatedAt ? t('cnpjValidated') : t('cnpjPending'),
      status: cnpjValidatedAt ? 'success' : 'warning',
    },
    {
      label: t('kyc'),
      icon: Shield,
      value:
        kycStatus === 'APPROVED'
          ? t('kycApproved')
          : kycStatus === 'REJECTED'
            ? t('kycRejected')
            : t('kycPending'),
      status:
        kycStatus === 'APPROVED'
          ? 'success'
          : kycStatus === 'REJECTED'
            ? 'error'
            : 'warning',
    },
  ];

  const statusColors = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-cream-100 text-cream-700',
    error: 'bg-red-50 text-red-700',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800">{t('title')}</h2>
      <div className="mt-4 space-y-3">
        {healthItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <item.icon className="h-4 w-4 text-gray-400" />
              {item.label}
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                statusColors[item.status as keyof typeof statusColors],
              )}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Quick Actions ---

function QuickActions() {
  const t = useTranslations('dashboard.quickActions');

  const actions = [
    {
      key: 'editProfile',
      label: t('editProfile'),
      href: '/dashboard/company-page',
      icon: Globe,
    },
    {
      key: 'uploadDocument',
      label: t('uploadDocument'),
      href: '/dashboard/dataroom',
      icon: FolderOpen,
    },
    {
      key: 'inviteMember',
      label: t('inviteMember'),
      href: '/dashboard/settings',
      icon: UserPlus,
    },
    {
      key: 'viewSettings',
      label: t('viewSettings'),
      href: '/dashboard/settings',
      icon: Settings,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800">{t('title')}</h2>
      <div className="mt-4 space-y-2">
        {actions.map((action) => (
          <Link
            key={action.key}
            href={action.href}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <span className="flex items-center gap-3">
              <action.icon className="h-4 w-4 text-gray-400" />
              {action.label}
            </span>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// --- Recent Activity ---

function RecentActivity() {
  const t = useTranslations('dashboard.recentActivity');

  const { data } = useNotifications({ limit: 5, sort: '-createdAt' });
  const notifications = data?.data ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">{t('title')}</h2>
        {notifications.length > 0 && (
          <Link
            href="/dashboard/notifications"
            className="flex items-center gap-1 text-xs font-medium text-ocean-600 hover:text-ocean-500"
          >
            {t('viewAll')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-4 text-center">
          <Bell className="h-8 w-8 text-gray-200" />
          <p className="mt-2 text-sm text-gray-500">{t('empty')}</p>
          <p className="mt-0.5 text-xs text-gray-400">{t('emptyDescription')}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-3"
            >
              <div
                className={cn(
                  'mt-0.5 h-2 w-2 flex-shrink-0 rounded-full',
                  n.read ? 'bg-gray-200' : 'bg-ocean-600',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-700">{n.subject}</p>
                <p className="text-xs text-gray-400">
                  {formatRelativeTime(n.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Helpers ---

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d`;
}

// --- Main Dashboard Page ---

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { user } = useAuth();
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: profile, isLoading: profileLoading } =
    useCompanyProfile(companyId);

  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;

  const isLoading = companyLoading || (!!companyId && profileLoading);

  // Compute profile completeness
  const { percentage, items: completenessItems } = computeCompleteness(
    profile,
    user?.kycStatus,
  );

  // No company state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            {t('noCompany.title')}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {t('noCompany.description')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
          {user?.firstName
            ? t('welcome', { firstName: user.firstName })
            : t('welcomeGeneric')}
        </h1>
        <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.companyStatus')}
          value={
            selectedCompany?.status
              ? t(`statuses.${selectedCompany.status}`)
              : '—'
          }
          icon={Building2}
          active
          loading={isLoading}
        />
        <StatCard
          label={t('stats.teamMembers')}
          value={String(selectedCompany?.memberCount ?? 0)}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.unread')}
          value={String(unreadCount)}
          icon={Bell}
          loading={isLoading}
        />
        <StatCard
          label={t('stats.profileViews')}
          value={String(profile?.viewCount ?? 0)}
          icon={Eye}
          loading={isLoading}
        />
      </div>

      {/* Completeness + Health row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CompletenessCard
          percentage={percentage}
          items={completenessItems}
          loading={isLoading}
        />
        <HealthCard
          companyStatus={selectedCompany?.status}
          cnpjValidatedAt={undefined}
          kycStatus={user?.kycStatus}
          loading={isLoading}
        />
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActions />
        <RecentActivity />
      </div>
    </div>
  );
}
