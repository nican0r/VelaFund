'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (failureCount, error) => {
              // Don't retry auth, validation, or business rule errors
              if (error instanceof Error && 'statusCode' in error) {
                const statusCode = (error as { statusCode: number }).statusCode;
                if ([401, 400, 403, 404, 409, 422].includes(statusCode)) {
                  return false;
                }
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
          },
          classNames: {
            success: 'border-l-[3px] border-l-celadon-700',
            error: 'border-l-[3px] border-l-[#DC2626]',
            warning: 'border-l-[3px] border-l-cream-700',
            info: 'border-l-[3px] border-l-ocean-600',
          },
        }}
        richColors
        closeButton
        duration={5000}
      />
    </QueryClientProvider>
  );
}
