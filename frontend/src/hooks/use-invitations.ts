import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// --- Types ---

export interface InvitationDetails {
  companyName: string;
  companyLogoUrl: string | null;
  role: string;
  invitedByName: string | null;
  invitedAt: string;
  expiresAt: string;
  email: string;
  hasExistingAccount: boolean;
}

export interface AcceptInvitationResult {
  memberId: string;
  companyId: string;
  companyName: string;
  role: string;
  status: string;
  acceptedAt: string;
}

// --- Get invitation details (public, no auth required) ---

export function useInvitationDetails(token: string | undefined) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () =>
      api.get<InvitationDetails>(`/api/v1/invitations/${token}`),
    enabled: !!token,
    staleTime: 60 * 1000,
    retry: false, // Don't retry 404/410 errors
  });
}

// --- Accept invitation (requires auth) ---

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) =>
      api.post<AcceptInvitationResult>(
        `/api/v1/invitations/${token}/accept`,
      ),
    onSuccess: () => {
      // Invalidate companies list so new company shows up
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}
