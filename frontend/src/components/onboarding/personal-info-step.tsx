'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateProfile } from '@/hooks/use-onboarding';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface PersonalInfoStepProps {
  onComplete: () => void;
}

export function PersonalInfoStep({ onComplete }: PersonalInfoStepProps) {
  const t = useTranslations('onboarding.personalInfo');
  const tc = useTranslations('common');
  const { user, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateProfile = useUpdateProfile();

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) {
      newErrors.firstName = t('firstNameRequired');
    }
    if (!lastName.trim()) {
      newErrors.lastName = t('lastNameRequired');
    }
    if (!email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('emailInvalid');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      await refreshUser();
      onComplete();
    } catch (err) {
      const error = err as { messageKey?: string };
      if (error.messageKey === 'errors.auth.duplicateEmail') {
        setErrors({ email: t('emailDuplicate') });
      } else {
        toast.error(tc('error'));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">{t('title')}</h2>
        <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
      </div>

      <div className="space-y-4">
        {/* First name */}
        <div className="space-y-1.5">
          <Label htmlFor="firstName">{t('firstName')}</Label>
          <Input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: '' }));
            }}
            placeholder={t('firstNamePlaceholder')}
            maxLength={100}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? 'firstName-error' : undefined}
          />
          {errors.firstName && (
            <p id="firstName-error" className="text-xs text-[#DC2626]">{errors.firstName}</p>
          )}
        </div>

        {/* Last name */}
        <div className="space-y-1.5">
          <Label htmlFor="lastName">{t('lastName')}</Label>
          <Input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: '' }));
            }}
            placeholder={t('lastNamePlaceholder')}
            maxLength={100}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? 'lastName-error' : undefined}
          />
          {errors.lastName && (
            <p id="lastName-error" className="text-xs text-[#DC2626]">{errors.lastName}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder={t('emailPlaceholder')}
            maxLength={254}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-[#DC2626]">{errors.email}</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={updateProfile.isPending}
      >
        {updateProfile.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {tc('continue')}
      </Button>
    </form>
  );
}
