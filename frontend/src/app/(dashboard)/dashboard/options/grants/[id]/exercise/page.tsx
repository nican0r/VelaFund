'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  DollarSign,
  Gift,
  Loader2,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useOptionGrant,
  useCreateExercise,
  useOptionExercises,
} from '@/hooks/use-option-plans';
import { useErrorToast } from '@/lib/use-error-toast';
import { toast } from 'sonner';

// --- Formatting helpers (always pt-BR per i18n rules) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

// --- Sub-components ---

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-5 w-48 bg-gray-200 rounded mb-6" />
      <div className="h-8 w-64 bg-gray-200 rounded mb-2" />
      <div className="h-5 w-96 bg-gray-200 rounded mb-8" />
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: { label: string }[];
}) {
  return (
    <div className="mb-8 flex items-center justify-center gap-4">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
              idx < currentStep
                ? 'bg-ocean-600 text-white'
                : idx === currentStep
                  ? 'bg-ocean-600 text-white'
                  : 'bg-gray-200 text-gray-500',
            )}
            aria-current={idx === currentStep ? 'step' : undefined}
          >
            {idx + 1}
          </div>
          <span
            className={cn(
              'text-sm font-medium',
              idx <= currentStep ? 'text-navy-900' : 'text-gray-400',
            )}
          >
            {step.label}
          </span>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'h-px w-12',
                idx < currentStep ? 'bg-ocean-600' : 'bg-gray-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Main page component ---

export default function ExerciseOptionsPage() {
  const { id: grantId } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('optionPlans');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;
  const { showErrorToast } = useErrorToast();

  // Form state
  const [step, setStep] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [quantityError, setQuantityError] = useState('');

  // Data
  const {
    data: grant,
    isLoading: grantLoading,
    error: grantError,
  } = useOptionGrant(companyId, grantId);

  // Check for pending exercises
  const { data: exercisesData } = useOptionExercises(companyId, {
    grantId,
    status: 'PENDING_PAYMENT',
    limit: 1,
  });

  const createExerciseMutation = useCreateExercise(companyId);

  const isLoading = companyLoading || grantLoading;
  const hasPendingExercise = (exercisesData?.data?.length ?? 0) > 0;

  // Derived values
  const exercisableQty = grant?.vesting
    ? parseFloat(grant.vesting.exercisableQuantity)
    : 0;
  const strikePrice = grant ? parseFloat(grant.strikePrice) : 0;
  const quantityNum = parseFloat(quantity) || 0;
  const totalCost = quantityNum * strikePrice;

  // Validation
  const validateQuantity = (val: string): boolean => {
    const num = parseFloat(val);
    if (!val || isNaN(num) || num <= 0) {
      setQuantityError(t('exerciseForm.quantityRequired'));
      return false;
    }
    if (num > exercisableQty) {
      setQuantityError(
        t('exerciseForm.maxQuantity', { max: formatNumber(exercisableQty) }),
      );
      return false;
    }
    setQuantityError('');
    return true;
  };

  const handleNext = () => {
    if (validateQuantity(quantity)) {
      setStep(1);
    }
  };

  const handleBack = () => {
    setStep(0);
  };

  const handleSubmit = async () => {
    try {
      await createExerciseMutation.mutateAsync({
        grantId,
        quantity,
      });
      toast.success(t('success.exerciseCreated'));
      router.push(`/dashboard/options/grants/${grantId}`);
    } catch (err) {
      showErrorToast(err);
    }
  };

  // --- Guard states ---

  if (!companyId && !companyLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Gift className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            Selecione uma empresa para continuar.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <FormSkeleton />;
  }

  if (grantError || !grant) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/dashboard/options/grants/${grantId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('exerciseForm.back')}
        </Link>
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-red-600">{t('grantDetail.error')}</p>
        </div>
      </div>
    );
  }

  // Check if grant is active
  if (grant.status !== 'ACTIVE') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/dashboard/options/grants/${grantId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('exerciseForm.back')}
        </Link>
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-12">
          <Gift className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {t('exerciseForm.notActive')}
          </p>
        </div>
      </div>
    );
  }

  // Check for pending exercise
  if (hasPendingExercise) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/dashboard/options/grants/${grantId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('exerciseForm.back')}
        </Link>
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-cream-600 bg-cream-50 py-12">
          <DollarSign className="h-12 w-12 text-cream-700" />
          <p className="mt-3 text-sm text-cream-700">
            {t('exerciseForm.pendingExists')}
          </p>
        </div>
      </div>
    );
  }

  // Check if any exercisable options
  if (exercisableQty <= 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/dashboard/options/grants/${grantId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('exerciseForm.back')}
        </Link>
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-12">
          <Target className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {t('exerciseForm.noExercisable')}
          </p>
        </div>
      </div>
    );
  }

  // --- Happy path ---

  const steps = [
    { label: t('exerciseForm.stepDetails') },
    { label: t('exerciseForm.stepReview') },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href={`/dashboard/options/grants/${grantId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('exerciseForm.back')}
      </Link>

      {/* Header */}
      <h1 className="text-2xl font-bold text-navy-900">
        {t('exerciseForm.createTitle')}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {t('exerciseForm.createDescription')}
      </p>

      {/* Step indicator */}
      <div className="mt-6">
        <StepIndicator currentStep={step} steps={steps} />
      </div>

      {/* Step 0: Details */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Grant info card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-navy-900">
              {t('exerciseForm.grantInfo')}
            </h3>
            <div className="space-y-0">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">
                  {t('grantDetail.employee')}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {grant.employeeName}
                </span>
              </div>
              {grant.plan && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">
                    {t('grantDetail.plan')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {grant.plan.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">
                  {t('exerciseForm.exercisableOptions')}
                </span>
                <span className="text-sm font-bold text-ocean-600">
                  {formatNumber(exercisableQty)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">
                  {t('exerciseForm.strikePrice')}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(strikePrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Quantity input */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-navy-900">
              {t('exerciseForm.sectionDetails')}
            </h3>
            <div>
              <label
                htmlFor="quantity"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('exerciseForm.quantity')}
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                max={exercisableQty}
                step="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  if (quantityError) validateQuantity(e.target.value);
                }}
                placeholder={t('exerciseForm.quantityPlaceholder')}
                className={cn(
                  'block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2',
                  quantityError
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-gray-300 focus:border-ocean-600 focus:ring-ocean-600/10',
                )}
              />
              {quantityError ? (
                <p className="mt-1 text-xs text-red-600">{quantityError}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {t('exerciseForm.quantityHelp', {
                    max: formatNumber(exercisableQty),
                  })}
                </p>
              )}
            </div>

            {/* Live total cost */}
            {quantityNum > 0 && (
              <div className="mt-4 rounded-md bg-gray-50 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">
                    {t('exerciseForm.totalCost')}
                  </span>
                  <span className="text-lg font-bold text-navy-900">
                    {formatCurrency(totalCost)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {formatNumber(quantityNum)} x {formatCurrency(strikePrice)}
                </p>
              </div>
            )}
          </div>

          {/* Next button */}
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              disabled={!quantity || quantityNum <= 0}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-ocean-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('exerciseForm.stepReview')}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Review */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-navy-900">
              {t('exerciseForm.reviewTitle')}
            </h3>
            <div className="space-y-0">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">
                  {t('exerciseForm.reviewEmployee')}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {grant.employeeName}
                </span>
              </div>
              {grant.plan && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">
                    {t('exerciseForm.reviewPlan')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {grant.plan.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">
                  {t('exerciseForm.reviewQuantity')}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatNumber(quantityNum)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">
                  {t('exerciseForm.reviewStrikePrice')}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(strikePrice)}
                </span>
              </div>
              <div className="flex justify-between py-3 bg-gray-50 -mx-6 px-6 mt-2 rounded-b-lg">
                <span className="text-sm font-semibold text-navy-900">
                  {t('exerciseForm.reviewTotalCost')}
                </span>
                <span className="text-lg font-bold text-navy-900">
                  {formatCurrency(totalCost)}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('exerciseForm.stepDetails')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={createExerciseMutation.isPending}
              className={cn(
                'inline-flex items-center gap-2 rounded-md bg-ocean-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-ocean-500',
                createExerciseMutation.isPending && 'opacity-75',
              )}
            >
              {createExerciseMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t('exerciseForm.exerciseButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
