import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ShareClass } from '@/types/company';
import type { PaginationMeta } from '@/types/api';

// --- List share classes (paginated) ---

export interface ShareClassesParams {
  page?: number;
  limit?: number;
  type?: string;
  sort?: string;
}

export function useShareClasses(
  companyId: string | undefined,
  params?: ShareClassesParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.type) query.set('type', params.type);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();

  return useQuery({
    queryKey: ['shareClasses', companyId, params],
    queryFn: () =>
      api.getList<ShareClass>(
        `/api/v1/companies/${companyId}/share-classes${qs ? `?${qs}` : ''}`,
      ) as Promise<{ data: ShareClass[]; meta: PaginationMeta }>,
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

// --- Get single share class ---

export function useShareClass(
  companyId: string | undefined,
  shareClassId: string | undefined,
) {
  return useQuery({
    queryKey: ['shareClasses', companyId, shareClassId],
    queryFn: () =>
      api.get<ShareClass>(
        `/api/v1/companies/${companyId}/share-classes/${shareClassId}`,
      ),
    enabled: !!companyId && !!shareClassId,
    staleTime: 30 * 1000,
  });
}

// --- Create share class ---

export interface CreateShareClassData {
  className: string;
  type: 'QUOTA' | 'COMMON_SHARES' | 'PREFERRED_SHARES';
  totalAuthorized: string;
  votesPerShare: number;
  liquidationPreferenceMultiple?: number | null;
  participatingRights?: boolean;
  rightOfFirstRefusal?: boolean;
  lockUpPeriodMonths?: number | null;
  tagAlongPercentage?: number | null;
}

export function useCreateShareClass(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateShareClassData) =>
      api.post<ShareClass>(
        `/api/v1/companies/${companyId}/share-classes`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareClasses', companyId] });
    },
  });
}

// --- Delete share class ---

export function useDeleteShareClass(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareClassId: string) =>
      api.delete(
        `/api/v1/companies/${companyId}/share-classes/${shareClassId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareClasses', companyId] });
    },
  });
}
