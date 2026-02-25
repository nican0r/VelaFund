'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Settings,
  Users,
  Building2,
  UserPlus,
  Shield,
  Mail,
  MoreHorizontal,
  Search,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Briefcase,
  Scale,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useCompany } from '@/lib/company-context';
import { useErrorToast } from '@/lib/use-error-toast';
import {
  useMembers,
  useInviteMember,
  useUpdateMember,
  useRemoveMember,
  useResendInvitation,
  useCompanyDetail,
  useUpdateCompany,
} from '@/hooks/use-members';
import type { CompanyMember, MemberRole } from '@/types/company';

// ─── Constants ───────────────────────────────────────────────────────
const LIMIT = 20;
const ROLES: MemberRole[] = ['ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR', 'EMPLOYEE'];

const ROLE_ICONS: Record<MemberRole, React.ElementType> = {
  ADMIN: Shield,
  FINANCE: TrendingUp,
  LEGAL: Scale,
  INVESTOR: Briefcase,
  EMPLOYEE: UserCheck,
};

// ─── Helper functions ────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(iso));
  } catch {
    return iso;
  }
}

function getInitials(member: CompanyMember): string {
  if (member.user?.firstName && member.user?.lastName) {
    return `${member.user.firstName[0]}${member.user.lastName[0]}`.toUpperCase();
  }
  if (member.email) {
    return member.email[0].toUpperCase();
  }
  return '?';
}

function getMemberDisplayName(member: CompanyMember): string {
  if (member.user?.firstName || member.user?.lastName) {
    return [member.user.firstName, member.user.lastName].filter(Boolean).join(' ');
  }
  return member.email;
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  active,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        active
          ? 'border-ocean-600 bg-ocean-600 text-white'
          : 'border-gray-200 bg-white text-gray-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className={`text-xs font-medium ${
              active ? 'text-white/80' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-9 w-20 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="mt-1 text-stat">{value}</p>
          )}
        </div>
        <div
          className={`rounded-lg p-2 ${
            active ? 'bg-white/20' : 'bg-gray-100'
          }`}
        >
          <Icon
            className={`h-5 w-5 ${active ? 'text-white' : 'text-gray-500'}`}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-cream-100 text-cream-700',
    REMOVED: 'bg-gray-100 text-gray-500',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function RoleBadge({ role, t }: { role: MemberRole; t: (key: string) => string }) {
  const styles: Record<MemberRole, string> = {
    ADMIN: 'bg-navy-50 text-navy-700',
    FINANCE: 'bg-blue-50 text-ocean-600',
    LEGAL: 'bg-cream-100 text-cream-700',
    INVESTOR: 'bg-green-100 text-green-700',
    EMPLOYEE: 'bg-gray-100 text-gray-600',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[role] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {t(`role.${role}`)}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// ─── Invite Member Dialog ────────────────────────────────────────────

function InviteDialog({
  open,
  onClose,
  companyId,
  t,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('EMPLOYEE');
  const [message, setMessage] = useState('');
  const inviteMutation = useInviteMember(companyId);
  const showErrorToast = useErrorToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteMutation.mutateAsync({
        email: email.trim(),
        role,
        message: message.trim() || undefined,
      });
      toast.success(t('success.invited'));
      setEmail('');
      setRole('EMPLOYEE');
      setMessage('');
      onClose();
    } catch (err) {
      showErrorToast(err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-navy-900/50"
        onClick={onClose}
        data-testid="invite-overlay"
      />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dialog.invite.title')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label
              htmlFor="invite-email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t('dialog.invite.email')}
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('dialog.invite.emailPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/10"
            />
          </div>
          <div>
            <label
              htmlFor="invite-role"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t('dialog.invite.role')}
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/10"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="invite-message"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t('dialog.invite.message')}
            </label>
            <textarea
              id="invite-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('dialog.invite.messagePlaceholder')}
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/10"
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('dialog.invite.cancel')}
            </button>
            <button
              type="submit"
              disabled={inviteMutation.isPending || !email.trim()}
              className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-500 disabled:opacity-50"
            >
              {inviteMutation.isPending
                ? t('dialog.invite.sending')
                : t('dialog.invite.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Change Role Dialog ──────────────────────────────────────────────

function ChangeRoleDialog({
  open,
  onClose,
  member,
  companyId,
  t,
}: {
  open: boolean;
  onClose: () => void;
  member: CompanyMember | null;
  companyId: string;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const [newRole, setNewRole] = useState<MemberRole>(member?.role || 'EMPLOYEE');
  const updateMutation = useUpdateMember(companyId);
  const showErrorToast = useErrorToast();

  // Reset when member changes
  const currentRole = member?.role || 'EMPLOYEE';
  if (open && newRole !== currentRole && member && newRole === 'EMPLOYEE' && member.role !== 'EMPLOYEE') {
    // Only reset on first open
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    try {
      await updateMutation.mutateAsync({
        memberId: member.id,
        data: { role: newRole },
      });
      toast.success(t('roleChangeSuccess'));
      onClose();
    } catch (err) {
      showErrorToast(err);
    }
  };

  if (!open || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-navy-900/50"
        onClick={onClose}
        data-testid="role-overlay"
      />
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dialog.changeRole.title')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {getMemberDisplayName(member)} ({member.email})
          </p>
          <div>
            <label
              htmlFor="change-role"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t('dialog.changeRole.label')}
            </label>
            <select
              id="change-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as MemberRole)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/10"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('dialog.changeRole.cancel')}
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || newRole === member.role}
              className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-500 disabled:opacity-50"
            >
              {t('dialog.changeRole.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Remove Member Dialog ────────────────────────────────────────────

function RemoveDialog({
  open,
  onClose,
  member,
  companyId,
  t,
}: {
  open: boolean;
  onClose: () => void;
  member: CompanyMember | null;
  companyId: string;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const removeMutation = useRemoveMember(companyId);
  const showErrorToast = useErrorToast();

  const handleConfirm = async () => {
    if (!member) return;
    try {
      await removeMutation.mutateAsync(member.id);
      toast.success(t('success.removed'));
      onClose();
    } catch (err) {
      showErrorToast(err);
    }
  };

  if (!open || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-navy-900/50"
        onClick={onClose}
        data-testid="remove-overlay"
      />
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dialog.remove.title')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {t('dialog.remove.message', {
              name: getMemberDisplayName(member),
            })}
          </p>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('dialog.remove.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={removeMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {t('dialog.remove.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Members Tab ─────────────────────────────────────────────────────

function MembersTab({ companyId }: { companyId: string }) {
  const t = useTranslations('settings.members');
  const showErrorToast = useErrorToast();

  // State
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [changeRoleMember, setChangeRoleMember] = useState<CompanyMember | null>(null);
  const [removeMember, setRemoveMember] = useState<CompanyMember | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Data
  const { data, isLoading, error } = useMembers(companyId, {
    page,
    limit: LIMIT,
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    sort: '-invitedAt',
  });
  const resendMutation = useResendInvitation(companyId);

  const members = data?.data || [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages || 1;

  // Stats
  const stats = useMemo(() => {
    const total = meta?.total || 0;
    const active = members.filter((m) => m.status === 'ACTIVE').length;
    const pending = members.filter((m) => m.status === 'PENDING').length;
    const admins = members.filter((m) => m.role === 'ADMIN' && m.status === 'ACTIVE').length;
    return { total, active, pending, admins };
  }, [members, meta]);

  const pageLoading = isLoading;

  const handleResend = useCallback(
    async (memberId: string) => {
      try {
        await resendMutation.mutateAsync(memberId);
        toast.success(t('resendSuccess'));
      } catch (err) {
        showErrorToast(err);
      }
      setOpenMenuId(null);
    },
    [resendMutation, t, showErrorToast],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowInviteDialog(true)}
          className="flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-500"
        >
          <UserPlus className="h-4 w-4" />
          {t('inviteButton')}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.total')}
          value={stats.total}
          icon={Users}
          active
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.active')}
          value={stats.active}
          icon={UserCheck}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.pending')}
          value={stats.pending}
          icon={Mail}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.admins')}
          value={stats.admins}
          icon={Shield}
          loading={pageLoading}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {/* Filters */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('filter.searchPlaceholder')}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none"
          >
            <option value="">{t('filter.allRoles')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none"
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="ACTIVE">{t('status.ACTIVE')}</option>
            <option value="PENDING">{t('status.PENDING')}</option>
            <option value="REMOVED">{t('status.REMOVED')}</option>
          </select>
        </div>

        {/* Table content */}
        {pageLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-red-500">
              {error instanceof Error ? error.message : 'Error loading members'}
            </p>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-500">{t('empty')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('table.member')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('table.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('table.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('table.invitedAt')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-600 text-sm font-medium text-white">
                        {getInitials(member)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {getMemberDisplayName(member)}
                        </p>
                        {member.user?.firstName && (
                          <p className="text-xs text-gray-500">{member.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={member.role} t={t} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={member.status} t={t} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(member.invitedAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.status !== 'REMOVED' && (
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === member.id ? null : member.id,
                            )
                          }
                          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          aria-label={t('table.actions')}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {openMenuId === member.id && (
                          <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                            {member.status === 'ACTIVE' && (
                              <button
                                onClick={() => {
                                  setChangeRoleMember(member);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Shield className="h-4 w-4" />
                                {t('actions.changeRole')}
                              </button>
                            )}
                            {member.status === 'PENDING' && (
                              <button
                                onClick={() => handleResend(member.id)}
                                disabled={resendMutation.isPending}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                              >
                                <RefreshCw className="h-4 w-4" />
                                {t('actions.resend')}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setRemoveMember(member);
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('actions.remove')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
            <p className="text-xs text-gray-500">
              {t('pagination.showing', {
                from: String((page - 1) * LIMIT + 1),
                to: String(Math.min(page * LIMIT, meta.total)),
                total: String(meta.total),
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-600">
                {t('pagination.page')} {page} {t('pagination.of')} {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <InviteDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        companyId={companyId}
        t={t}
      />
      <ChangeRoleDialog
        open={!!changeRoleMember}
        onClose={() => setChangeRoleMember(null)}
        member={changeRoleMember}
        companyId={companyId}
        t={t}
      />
      <RemoveDialog
        open={!!removeMember}
        onClose={() => setRemoveMember(null)}
        member={removeMember}
        companyId={companyId}
        t={t}
      />
    </div>
  );
}

// ─── Company Info Tab ────────────────────────────────────────────────

function CompanyInfoTab({ companyId }: { companyId: string }) {
  const t = useTranslations('settings.company');
  const tc = useTranslations('common');
  const showErrorToast = useErrorToast();

  const { data: company, isLoading } = useCompanyDetail(companyId);
  const updateMutation = useUpdateCompany(companyId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Sync form when company data loads
  const companyName = company?.name || '';
  const companyDesc = company?.description || '';
  if (!isDirty && company && (name !== companyName || description !== companyDesc)) {
    setName(companyName);
    setDescription(companyDesc);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success(t('saveSuccess'));
      setIsDirty(false);
    } catch (err) {
      showErrorToast(err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-lg border border-gray-200 bg-white p-6 space-y-5"
      >
        {/* Name */}
        <div>
          <label
            htmlFor="company-name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t('name')}
          </label>
          <input
            id="company-name"
            type="text"
            required
            minLength={2}
            maxLength={200}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsDirty(true);
            }}
            placeholder={t('namePlaceholder')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/10"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="company-description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t('description')}
          </label>
          <textarea
            id="company-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setIsDirty(true);
            }}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/10"
          />
        </div>

        {/* Read-only fields */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('entityType')}
            </label>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {t(`entityTypes.${company.entityType}`)}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('cnpj')}
            </label>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {company.cnpj}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('status')}
            </label>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {t(`statuses.${company.status}`)}
            </p>
          </div>
          {company.foundedDate && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('foundedDate')}
              </label>
              <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {formatDate(company.foundedDate)}
              </p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('currency')}
            </label>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {company.defaultCurrency}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('timezone')}
            </label>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {company.timezone}
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={updateMutation.isPending || !isDirty || !name.trim()}
            className="rounded-md bg-ocean-600 px-6 py-2 text-sm font-medium text-white hover:bg-ocean-500 disabled:opacity-50"
          >
            {updateMutation.isPending ? tc('loading') : tc('save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const [activeTab, setActiveTab] = useState<'company' | 'members'>('company');

  const companyId = selectedCompany?.id;

  // No company selected state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="mb-3 h-12 w-12 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-700">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('description')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-[30px] font-bold tracking-tight text-navy-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'company'
                ? 'border-ocean-600 text-ocean-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <Building2 className="h-4 w-4" />
            {t('tabs.company')}
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'border-ocean-600 text-ocean-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4" />
            {t('tabs.members')}
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {companyId && (
        <>
          {activeTab === 'company' && <CompanyInfoTab companyId={companyId} />}
          {activeTab === 'members' && <MembersTab companyId={companyId} />}
        </>
      )}
    </div>
  );
}
