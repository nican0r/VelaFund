import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// --- Types ---

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface UpdateProfileResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  walletAddress: string | null;
  profilePictureUrl: string | null;
  kycStatus: string;
  locale: string;
  lastLoginAt: string;
  createdAt: string;
}

export interface CreateCompanyData {
  name: string;
  entityType: 'LTDA' | 'SA_CAPITAL_FECHADO' | 'SA_CAPITAL_ABERTO';
  cnpj: string;
}

export interface CreateCompanyResult {
  id: string;
  name: string;
  entityType: string;
  cnpj: string;
  status: string;
  createdAt: string;
}

// --- Update user profile (onboarding step 1) ---

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      api.put<UpdateProfileResult>('/api/v1/auth/me', data),
  });
}

// --- Create company (onboarding step 2) ---

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyData) =>
      api.post<CreateCompanyResult>('/api/v1/companies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}
