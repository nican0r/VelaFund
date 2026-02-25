'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  OptionPlan,
  OptionGrant,
  OptionExerciseRequest,
} from '@/types/company';

// --- Option Plans ---

interface OptionPlansParams {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
}

export function useOptionPlans(
  companyId: string | undefined,
  params?: OptionPlansParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();

  return useQuery({
    queryKey: ['optionPlans', companyId, params],
    queryFn: () =>
      api.getList<OptionPlan>(
        `/api/v1/companies/${companyId}/option-plans${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useOptionPlan(
  companyId: string | undefined,
  planId: string | undefined,
) {
  return useQuery({
    queryKey: ['optionPlans', companyId, planId],
    queryFn: () =>
      api.get<OptionPlan>(
        `/api/v1/companies/${companyId}/option-plans/${planId}`,
      ),
    enabled: !!companyId && !!planId,
    staleTime: 60 * 1000,
  });
}

interface CreateOptionPlanPayload {
  name: string;
  shareClassId: string;
  totalPoolSize: string;
  boardApprovalDate?: string;
  terminationPolicy?: string;
  exerciseWindowDays?: number;
  notes?: string;
}

export function useCreateOptionPlan(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOptionPlanPayload) =>
      api.post<OptionPlan>(
        `/api/v1/companies/${companyId}/option-plans`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optionPlans', companyId] });
    },
  });
}

export function useClosePlan(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/option-plans/${planId}/close`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optionPlans', companyId] });
    },
  });
}

// --- Option Grants ---

interface OptionGrantsParams {
  page?: number;
  limit?: number;
  status?: string;
  optionPlanId?: string;
  sort?: string;
}

export function useOptionGrants(
  companyId: string | undefined,
  params?: OptionGrantsParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.optionPlanId) query.set('optionPlanId', params.optionPlanId);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();

  return useQuery({
    queryKey: ['optionGrants', companyId, params],
    queryFn: () =>
      api.getList<OptionGrant>(
        `/api/v1/companies/${companyId}/option-grants${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useOptionGrant(
  companyId: string | undefined,
  grantId: string | undefined,
) {
  return useQuery({
    queryKey: ['optionGrants', companyId, grantId],
    queryFn: () =>
      api.get<OptionGrant>(
        `/api/v1/companies/${companyId}/option-grants/${grantId}`,
      ),
    enabled: !!companyId && !!grantId,
    staleTime: 60 * 1000,
  });
}

export function useCancelGrant(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (grantId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/option-grants/${grantId}/cancel`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optionGrants', companyId] });
      queryClient.invalidateQueries({ queryKey: ['optionPlans', companyId] });
    },
  });
}

// --- Option Exercises ---

interface OptionExercisesParams {
  page?: number;
  limit?: number;
  status?: string;
  grantId?: string;
  sort?: string;
}

export function useOptionExercises(
  companyId: string | undefined,
  params?: OptionExercisesParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.grantId) query.set('grantId', params.grantId);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();

  return useQuery({
    queryKey: ['optionExercises', companyId, params],
    queryFn: () =>
      api.getList<OptionExerciseRequest>(
        `/api/v1/companies/${companyId}/option-exercises${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useCancelExercise(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exerciseId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/option-exercises/${exerciseId}/cancel`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['optionExercises', companyId],
      });
      queryClient.invalidateQueries({ queryKey: ['optionGrants', companyId] });
      queryClient.invalidateQueries({ queryKey: ['optionPlans', companyId] });
    },
  });
}
