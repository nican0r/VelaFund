import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  CompanyProfile,
  ProfileAccessType,
  ProfileMetric,
  ProfileTeamMember,
} from '@/types/company';

// --- DTO types for mutations ---

export interface UpdateProfileDto {
  headline?: string;
  description?: string;
  sector?: string;
  foundedYear?: number | null;
  website?: string;
  location?: string;
  accessType?: ProfileAccessType;
  accessPassword?: string;
}

export interface MetricItemDto {
  label: string;
  value: string;
  format: ProfileMetric['format'];
  icon?: string;
  order: number;
}

export interface TeamMemberItemDto {
  name: string;
  title: string;
  photoUrl?: string | null;
  linkedinUrl?: string | null;
  order: number;
}

// --- Create profile ---

export function useCreateProfile(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<CompanyProfile>(
        `/api/v1/companies/${companyId}/profile`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Update profile fields ---

export function useUpdateProfile(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileDto) =>
      api.put<CompanyProfile>(
        `/api/v1/companies/${companyId}/profile`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Publish profile ---

export function usePublishProfile(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<CompanyProfile>(
        `/api/v1/companies/${companyId}/profile/publish`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Unpublish profile ---

export function useUnpublishProfile(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<CompanyProfile>(
        `/api/v1/companies/${companyId}/profile/unpublish`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Archive profile ---

export function useArchiveProfile(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<CompanyProfile>(
        `/api/v1/companies/${companyId}/profile/archive`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Update slug ---

export function useUpdateSlug(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) =>
      api.put<CompanyProfile>(
        `/api/v1/companies/${companyId}/profile/slug`,
        { slug },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Replace metrics (full replacement) ---

export function useUpdateMetrics(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (metrics: MetricItemDto[]) =>
      api.put<ProfileMetric[]>(
        `/api/v1/companies/${companyId}/profile/metrics`,
        { metrics },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Replace team members (full replacement) ---

export function useUpdateTeam(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (members: TeamMemberItemDto[]) =>
      api.put<ProfileTeamMember[]>(
        `/api/v1/companies/${companyId}/profile/team`,
        { members },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Upload team member photo ---

export function useUploadTeamPhoto(companyId: string | undefined) {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.uploadFile<{ url: string }>(
        `/api/v1/companies/${companyId}/profile/team/photo`,
        formData,
      );
    },
  });
}

// --- Get profile analytics ---

export interface ProfileAnalytics {
  totalViews: number;
  periodViews: number;
  uniqueViewers: number;
  viewsByDay: Array<{ date: string; count: number }>;
  recentViewers: Array<{
    email: string | null;
    ip: string | null;
    viewedAt: string;
  }>;
}

export function useProfileAnalytics(
  companyId: string | undefined,
  period: '7d' | '30d' | '90d' = '30d',
) {
  return useQuery({
    queryKey: ['profile-analytics', companyId, period],
    queryFn: () =>
      api.get<ProfileAnalytics>(
        `/api/v1/companies/${companyId}/profile/analytics?period=${period}`,
      ),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}
