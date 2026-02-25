'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStepperProps {
  currentStep: 1 | 2;
}

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  const t = useTranslations('onboarding.stepper');

  const steps = [
    { number: 1, label: t('step1') },
    { number: 2, label: t('step2') },
  ];

  return (
    <div className="flex items-center justify-center gap-3" role="list" aria-label="Onboarding steps">
      {steps.map((step, index) => {
        const isComplete = step.number < currentStep;
        const isActive = step.number === currentStep;

        return (
          <div key={step.number} className="flex items-center gap-3" role="listitem">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  isComplete && 'bg-celadon-600 text-white',
                  isActive && 'bg-ocean-600 text-white',
                  !isComplete && !isActive && 'bg-gray-200 text-gray-500',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isActive && 'text-navy-900',
                  isComplete && 'text-celadon-700',
                  !isComplete && !isActive && 'text-gray-400',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-px w-12',
                  isComplete ? 'bg-celadon-600' : 'bg-gray-200',
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
