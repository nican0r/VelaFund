import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  OwnershipReport,
  DilutionReport,
  ExportJob,
  ExportFormat,
} from '@/types/company';

// --- Ownership Report ---

export interface OwnershipParams {
  shareClassId?: string;
  includeOptions?: boolean;
}

export function useOwnershipReport(
  companyId: string | undefined,
  params?: OwnershipParams,
) {
  const query = new URLSearchParams();
  if (params?.shareClassId) query.set('shareClassId', params.shareClassId);
  if (params?.includeOptions === false) query.set('includeOptions', 'false');
  const qs = query.toString();

  return useQuery({
    queryKey: ['ownership-report', companyId, params],
    queryFn: () =>
      api.get<OwnershipReport>(
        `/api/v1/companies/${companyId}/reports/ownership${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

// --- Dilution Report ---

export interface DilutionParams {
  dateFrom?: string;
  dateTo?: string;
  granularity?: 'day' | 'week' | 'month';
}

export function useDilutionReport(
  companyId: string | undefined,
  params?: DilutionParams,
) {
  const query = new URLSearchParams();
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.granularity) query.set('granularity', params.granularity);
  const qs = query.toString();

  return useQuery({
    queryKey: ['dilution-report', companyId, params],
    queryFn: () =>
      api.get<DilutionReport>(
        `/api/v1/companies/${companyId}/reports/dilution${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

// --- Cap Table Export ---

export function useExportCapTable(companyId: string | undefined) {
  return useMutation({
    mutationFn: ({
      format,
      snapshotDate,
    }: {
      format: ExportFormat;
      snapshotDate?: string;
    }) => {
      const query = new URLSearchParams();
      query.set('format', format);
      if (snapshotDate) query.set('snapshotDate', snapshotDate);
      return api.get<ExportJob>(
        `/api/v1/companies/${companyId}/reports/cap-table/export?${query}`,
      );
    },
  });
}

export function useExportJobStatus(
  companyId: string | undefined,
  jobId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['export-job', companyId, jobId],
    queryFn: () =>
      api.get<ExportJob>(
        `/api/v1/companies/${companyId}/reports/cap-table/export/${jobId}`,
      ),
    enabled: !!companyId && !!jobId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 2000;
    },
    staleTime: 0,
  });
}

// --- Due Diligence ---

export function useGenerateDueDiligence(companyId: string | undefined) {
  return useMutation({
    mutationFn: ({
      dateFrom,
      dateTo,
    }: {
      dateFrom?: string;
      dateTo?: string;
    }) => {
      const query = new URLSearchParams();
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      const qs = query.toString();
      return api.get<ExportJob>(
        `/api/v1/companies/${companyId}/reports/due-diligence${qs ? `?${qs}` : ''}`,
      );
    },
  });
}

export function useDueDiligenceJobStatus(
  companyId: string | undefined,
  jobId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['due-diligence-job', companyId, jobId],
    queryFn: () =>
      api.get<ExportJob>(
        `/api/v1/companies/${companyId}/reports/due-diligence/${jobId}`,
      ),
    enabled: !!companyId && !!jobId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 2000;
    },
    staleTime: 0,
  });
}
