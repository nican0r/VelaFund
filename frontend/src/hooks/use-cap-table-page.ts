import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  CapTable,
  FullyDilutedCapTable,
  CapTableHistoryItem,
} from '@/types/company';
import type { PaginationMeta } from '@/types/api';

/**
 * Fetch current cap table with optional share class filter.
 * Polls every 30 seconds for near-real-time updates.
 */
export function useCapTableCurrent(
  companyId: string | undefined,
  shareClassId?: string,
) {
  const query = new URLSearchParams();
  if (shareClassId) query.set('shareClassId', shareClassId);
  const qs = query.toString();
  const path = `/api/v1/companies/${companyId}/cap-table${qs ? `?${qs}` : ''}`;

  return useQuery({
    queryKey: ['cap-table', companyId, 'current', shareClassId],
    queryFn: () => api.get<CapTable>(path),
    enabled: !!companyId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Fetch fully-diluted cap table including all options.
 */
export function useCapTableFullyDiluted(
  companyId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['cap-table', companyId, 'fully-diluted'],
    queryFn: () =>
      api.get<FullyDilutedCapTable>(
        `/api/v1/companies/${companyId}/cap-table/fully-diluted`,
      ),
    enabled: !!companyId && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch cap table snapshot history (paginated).
 */
export function useCapTableHistory(
  companyId: string | undefined,
  params?: { page?: number; limit?: number },
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();

  return useQuery({
    queryKey: ['cap-table-history', companyId, params],
    queryFn: () =>
      api.getList<CapTableHistoryItem>(
        `/api/v1/companies/${companyId}/cap-table/history${qs ? `?${qs}` : ''}`,
      ) as Promise<{ data: CapTableHistoryItem[]; meta: PaginationMeta }>,
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

/**
 * Trigger async cap table export via reports module.
 * Returns job info for polling.
 */
export function useExportCapTable(companyId: string | undefined) {
  return useMutation({
    mutationFn: async (params: { format: string }) => {
      const query = new URLSearchParams({ format: params.format });
      return api.get<{
        jobId: string;
        status: string;
        format: string;
        downloadUrl: string | null;
      }>(
        `/api/v1/companies/${companyId}/reports/cap-table/export?${query}`,
      );
    },
  });
}

/**
 * Check export job status and get download URL.
 */
export function useExportJobStatus(
  companyId: string | undefined,
  jobId: string | null,
) {
  return useQuery({
    queryKey: ['export-job', companyId, jobId],
    queryFn: () =>
      api.get<{
        jobId: string;
        status: string;
        format: string;
        downloadUrl: string | null;
        expiresAt: string | null;
      }>(
        `/api/v1/companies/${companyId}/reports/cap-table/export/${jobId}`,
      ),
    enabled: !!companyId && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 2000; // Poll every 2 seconds while processing
    },
  });
}
