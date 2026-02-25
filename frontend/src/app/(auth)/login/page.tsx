'use client';

import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { isReady, isAuthenticated, isLoggingIn, login } = useAuth();

  // Show loading while Privy SDK initializes or login is in progress
  if (!isReady || isLoggingIn) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-600" />
        <p className="mt-3 text-sm text-gray-500">Carregando...</p>
      </div>
    );
  }

  // If already authenticated, the AuthProvider will redirect to /dashboard
  if (isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-600" />
        <p className="mt-3 text-sm text-gray-500">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Entrar</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Acesse a plataforma com seu email ou conta social.
        </p>
      </div>

      {/* Privy Login Button */}
      <button
        type="button"
        onClick={login}
        className="flex h-12 w-full items-center justify-center rounded-md bg-ocean-600 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-ocean-500 active:bg-ocean-700"
      >
        Continuar
      </button>

      {/* Legal text */}
      <p className="text-center text-xs text-gray-400">
        Ao entrar, voce concorda com nossos Termos de Servico e Politica de Privacidade.
      </p>
    </div>
  );
}
