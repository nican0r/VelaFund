'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { OnboardingStepper } from '@/components/onboarding/onboarding-stepper';
import { PersonalInfoStep } from '@/components/onboarding/personal-info-step';
import { CompanyCreationStep } from '@/components/onboarding/company-creation-step';

export default function OnboardingPage() {
  const { isReady, isAuthenticated, user, completeOnboarding } = useAuth();
  const t = useTranslations('onboarding');

  // Determine initial step based on user state:
  // If firstName is missing → step 1 (personal info)
  // If firstName exists but user is here → step 2 (company creation)
  const initialStep = user?.firstName ? 2 : 1;
  const [currentStep, setCurrentStep] = useState<1 | 2>(initialStep as 1 | 2);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-600" />
      </div>
    );
  }

  function handlePersonalInfoComplete() {
    setCurrentStep(2);
  }

  function handleCompanyCreationComplete() {
    completeOnboarding();
    // AuthProvider redirect effect will navigate to /dashboard
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[640px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">Navia</h1>
          <p className="mt-1 text-sm text-gray-500">{t('welcome')}</p>
        </div>

        {/* Stepper */}
        <div className="mb-6">
          <OnboardingStepper currentStep={currentStep} />
        </div>

        {/* Step card */}
        <div className="rounded-xl bg-white p-8 shadow-lg">
          {currentStep === 1 ? (
            <PersonalInfoStep onComplete={handlePersonalInfoComplete} />
          ) : (
            <CompanyCreationStep onComplete={handleCompanyCreationComplete} />
          )}
        </div>
      </div>
    </div>
  );
}
