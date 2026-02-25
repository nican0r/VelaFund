'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';

export function useErrorToast() {
  const t = useTranslations();

  return function showErrorToast(error: unknown) {
    if (error instanceof ApiError) {
      // Try to resolve the messageKey via i18n, fall back to the key itself
      let message: string;
      try {
        message = t(error.messageKey);
      } catch {
        message = error.messageKey;
      }

      if (error.statusCode === 429) {
        const retryAfter = error.details?.retryAfter;
        toast.warning(message, {
          description: retryAfter
            ? `Tente novamente em ${retryAfter} segundos`
            : undefined,
        });
      } else {
        toast.error(message);
      }
    } else if (error instanceof Error) {
      toast.error(error.message);
    } else {
      toast.error('Ocorreu um erro inesperado');
    }
  };
}
