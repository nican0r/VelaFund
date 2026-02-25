import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { CompanyMember, CompanyDetail } from '@/types/company';
import type { PaginationMeta } from '@/types/api';

// --- List members (paginated) ---

export interface MembersParams {
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  search?: string;
  sort?: string;
}

export function useMembers(
  companyId: string | undefined,
  params?: MembersParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.role) query.set('role', params.role);
  if (params?.search) query.set('search', params.search);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();

  return useQuery({
    queryKey: ['members', companyId, params],
    queryFn: () =>
      api.getList<CompanyMember>(
        `/api/v1/companies/${companyId}/members${qs ? `?${qs}` : ''}`,
      ) as Promise<{ data: CompanyMember[]; meta: PaginationMeta }>,
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

// --- Invite member ---

export function useInviteMember(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: string; message?: string }) =>
      api.post<CompanyMember>(
        `/api/v1/companies/${companyId}/members`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', companyId] });
    },
  });
}

// --- Update member role ---

export function useUpdateMember(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data: { role?: string; permissions?: Record<string, boolean> | null };
    }) =>
      api.put<CompanyMember>(
        `/api/v1/companies/${companyId}/members/${memberId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', companyId] });
    },
  });
}

// --- Remove member ---

export function useRemoveMember(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete(
        `/api/v1/companies/${companyId}/members/${memberId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', companyId] });
    },
  });
}

// --- Resend invitation ---

export function useResendInvitation(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      api.post<CompanyMember>(
        `/api/v1/companies/${companyId}/members/${memberId}/resend-invitation`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', companyId] });
    },
  });
}

// --- Get company detail ---

export function useCompanyDetail(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-detail', companyId],
    queryFn: () =>
      api.get<CompanyDetail>(
        `/api/v1/companies/${companyId}`,
      ),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

// --- Update company ---

export function useUpdateCompany(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<CompanyDetail>(
        `/api/v1/companies/${companyId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-detail', companyId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}
