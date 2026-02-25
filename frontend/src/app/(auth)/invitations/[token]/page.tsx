'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Building2, Calendar, Clock, Loader2, Mail, ShieldAlert, UserPlus, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useErrorToast } from '@/lib/use-error-toast';
import { useInvitationDetails, useAcceptInvitation } from '@/hooks/use-invitations';
import { ApiError } from '@/lib/api-client';

function formatRole(role: string, t: ReturnType<typeof useTranslations>): string {
  const roleMap: Record<string, string> = {
    ADMIN: t('invitations.role.admin'),
    FINANCE: t('invitations.role.finance'),
    LEGAL: t('invitations.role.legal'),
    INVESTOR: t('invitations.role.investor'),
    EMPLOYEE: t('invitations.role.employee'),
  };
  return roleMap[role] || role;
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: 'bg-ocean-50 text-ocean-700',
    FINANCE: 'bg-celadon-100 text-celadon-700',
    LEGAL: 'bg-cream-100 text-cream-700',
    INVESTOR: 'bg-navy-100 text-navy-700',
    EMPLOYEE: 'bg-gray-100 text-gray-700',
  };
  return colors[role] || 'bg-gray-100 text-gray-600';
}

export default function InvitationAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const showErrorToast = useErrorToast();
  const { isReady, isAuthenticated, isLoggingIn, login } = useAuth();

  const token = params.token as string;

  const {
    data: invitation,
    isLoading: isLoadingInvitation,
    error: invitationError,
  } = useInvitationDetails(token);

  const acceptMutation = useAcceptInvitation();

  const handleAccept = async () => {
    try {
      const result = await acceptMutation.mutateAsync(token);
      toast.success(
        t('invitations.acceptSuccess', { companyName: result.companyName }),
      );
      router.replace('/dashboard');
    } catch (error) {
      showErrorToast(error);
    }
  };

  const handleLogin = () => {
    login();
  };

  // Loading state while Privy initializes or invitation loads
  if (!isReady || isLoadingInvitation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-600" />
        <p className="mt-3 text-sm text-gray-500">{t('invitations.loading')}</p>
      </div>
    );
  }

  // Error: invitation not found (404) or already used
  if (invitationError) {
    const isExpired =
      invitationError instanceof ApiError && invitationError.statusCode === 410;

    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          {isExpired ? (
            <Clock className="h-7 w-7 text-red-500" />
          ) : (
            <XCircle className="h-7 w-7 text-red-500" />
          )}
        </div>
        <h2 className="text-lg font-semibold text-navy-900">
          {isExpired ? t('invitations.expired') : t('invitations.notFound')}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          {isExpired
            ? t('invitations.expiredDescription')
            : t('invitations.notFoundDescription')}
        </p>
        <button
          type="button"
          onClick={() => router.replace('/login')}
          className="mt-6 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-ocean-500 active:bg-ocean-700"
        >
          {t('invitations.signIn')}
        </button>
      </div>
    );
  }

  // Invitation loaded successfully
  if (!invitation) return null;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-navy-900">
          {t('invitations.title')}
        </h2>
        <p className="mt-1 text-[13px] text-gray-500">
          {t('invitations.description')}
        </p>
      </div>

      {/* Company card */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start gap-4">
          {/* Company icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ocean-600">
            <Building2 className="h-6 w-6 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Company name */}
            <h3 className="text-lg font-semibold text-navy-900">
              {invitation.companyName}
            </h3>

            {/* Role badge */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {t('invitations.invitedAs')}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeColor(invitation.role)}`}
              >
                {formatRole(invitation.role, t)}
              </span>
            </div>
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
          {invitation.invitedByName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserPlus className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">{t('invitations.invitedBy')}</span>
              <span className="font-medium">{invitation.invitedByName}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">{t('invitations.invitedOn')}</span>
            <span className="font-medium">{formatDate(invitation.invitedAt)}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">{t('invitations.expiresAt')}</span>
            <span className="font-medium">{formatDate(invitation.expiresAt)}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="truncate font-medium">{invitation.email}</span>
          </div>
        </div>
      </div>

      {/* Action section */}
      {isLoggingIn ? (
        <div className="flex flex-col items-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-ocean-600" />
          <p className="mt-2 text-sm text-gray-500">{t('common.loading')}</p>
        </div>
      ) : isAuthenticated ? (
        /* Authenticated: show accept button */
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className="flex h-12 w-full items-center justify-center rounded-md bg-ocean-600 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-ocean-500 active:bg-ocean-700 disabled:opacity-50"
          >
            {acceptMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ShieldAlert className="mr-2 h-4 w-4" />
                {t('invitations.accept')}
              </>
            )}
          </button>
        </div>
      ) : (
        /* Not authenticated: show login/signup buttons */
        <div className="space-y-3">
          <p className="text-center text-sm text-gray-500">
            {invitation.hasExistingAccount
              ? t('invitations.signInDescription')
              : t('invitations.signUpDescription')}
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="flex h-12 w-full items-center justify-center rounded-md bg-ocean-600 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-ocean-500 active:bg-ocean-700"
          >
            {invitation.hasExistingAccount
              ? t('invitations.signIn')
              : t('invitations.createAccount')}
          </button>
        </div>
      )}
    </div>
  );
}
