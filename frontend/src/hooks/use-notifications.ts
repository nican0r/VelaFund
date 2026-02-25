import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Notification, NotificationPreferences } from '@/types/company';
import type { PaginationMeta } from '@/types/api';

// --- List notifications (paginated, user-scoped) ---

export interface NotificationsParams {
  page?: number;
  limit?: number;
  read?: 'true' | 'false';
  notificationType?: string;
  sort?: string;
}

export function useNotifications(params?: NotificationsParams) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.read) query.set('read', params.read);
  if (params?.notificationType) query.set('notificationType', params.notificationType);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();

  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () =>
      api.getList<Notification>(
        `/api/v1/users/me/notifications${qs ? `?${qs}` : ''}`,
      ) as Promise<{ data: Notification[]; meta: PaginationMeta }>,
    staleTime: 30 * 1000,
  });
}

// --- Unread count (polling) ---

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      api.get<{ count: number }>('/api/v1/users/me/notifications/unread-count'),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// --- Get single notification ---

export function useNotification(notificationId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', notificationId],
    queryFn: () =>
      api.get<Notification>(
        `/api/v1/users/me/notifications/${notificationId}`,
      ),
    enabled: !!notificationId,
    staleTime: 30 * 1000,
  });
}

// --- Mark notification as read ---

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      api.put<{ id: string; read: boolean; readAt: string }>(
        `/api/v1/users/me/notifications/${notificationId}/read`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// --- Mark all notifications as read ---

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.put<{ updatedCount: number }>(
        '/api/v1/users/me/notifications/read-all',
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// --- Delete notification ---

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      api.delete(`/api/v1/users/me/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// --- Notification preferences ---

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () =>
      api.get<NotificationPreferences>(
        '/api/v1/users/me/notifications/preferences',
      ),
    staleTime: 60 * 1000,
  });
}

// --- Update notification preferences ---

export interface UpdatePreferencesData {
  transactions?: boolean;
  documents?: boolean;
  options?: boolean;
  fundingRounds?: boolean;
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdatePreferencesData) =>
      api.put<NotificationPreferences>(
        '/api/v1/users/me/notifications/preferences',
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'preferences'],
      });
    },
  });
}
