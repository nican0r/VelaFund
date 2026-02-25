'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateCompany, type CreateCompanyData } from '@/hooks/use-onboarding';
import { toast } from 'sonner';

interface CompanyCreationStepProps {
  onComplete: () => void;
}

const ENTITY_TYPES = ['LTDA', 'SA_CAPITAL_FECHADO', 'SA_CAPITAL_ABERTO'] as const;

/**
 * Format CNPJ as user types: XX.XXX.XXX/XXXX-XX
 */
function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Validate CNPJ using Módulo 11 checksum.
 */
function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Reject all-same-digit CNPJs
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // First check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const checkDigit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12], 10) !== checkDigit1) return false;

  // Second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const checkDigit2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[13], 10) !== checkDigit2) return false;

  return true;
}

export function CompanyCreationStep({ onComplete }: CompanyCreationStepProps) {
  const t = useTranslations('onboarding.companyCreation');
  const tc = useTranslations('common');

  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<CreateCompanyData['entityType'] | ''>('');
  const [cnpj, setCnpj] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCompany = useCreateCompany();

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = t('nameRequired');
    } else if (name.trim().length < 2) {
      newErrors.name = t('nameTooShort');
    }
    if (!entityType) {
      newErrors.entityType = t('entityTypeRequired');
    }
    if (!cnpj.trim()) {
      newErrors.cnpj = t('cnpjRequired');
    } else if (!validateCnpj(cnpj)) {
      newErrors.cnpj = t('cnpjInvalid');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createCompany.mutateAsync({
        name: name.trim(),
        entityType: entityType as CreateCompanyData['entityType'],
        cnpj,
      });
      onComplete();
    } catch (err) {
      const error = err as { messageKey?: string };
      if (error.messageKey === 'errors.company.cnpjDuplicate') {
        setErrors({ cnpj: t('cnpjDuplicate') });
      } else {
        toast.error(tc('error'));
      }
    }
  }

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCnpj(e.target.value);
    setCnpj(formatted);
    if (errors.cnpj) setErrors((prev) => ({ ...prev, cnpj: '' }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">{t('title')}</h2>
        <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
      </div>

      <div className="space-y-4">
        {/* Company name */}
        <div className="space-y-1.5">
          <Label htmlFor="companyName">{t('name')}</Label>
          <Input
            id="companyName"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            placeholder={t('namePlaceholder')}
            maxLength={200}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'companyName-error' : undefined}
          />
          {errors.name && (
            <p id="companyName-error" className="text-xs text-[#DC2626]">{errors.name}</p>
          )}
        </div>

        {/* Entity type */}
        <div className="space-y-1.5">
          <Label htmlFor="entityType">{t('entityType')}</Label>
          <Select
            value={entityType}
            onValueChange={(value) => {
              setEntityType(value as CreateCompanyData['entityType']);
              if (errors.entityType) setErrors((prev) => ({ ...prev, entityType: '' }));
            }}
          >
            <SelectTrigger
              id="entityType"
              aria-invalid={!!errors.entityType}
              aria-describedby={errors.entityType ? 'entityType-error' : undefined}
            >
              <SelectValue placeholder={t('entityTypePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  <div>
                    <div>{t(`entityTypes.${type}`)}</div>
                    <div className="text-xs text-gray-500">{t(`entityTypesDescription.${type}`)}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.entityType && (
            <p id="entityType-error" className="text-xs text-[#DC2626]">{errors.entityType}</p>
          )}
        </div>

        {/* CNPJ */}
        <div className="space-y-1.5">
          <Label htmlFor="cnpj">{t('cnpj')}</Label>
          <Input
            id="cnpj"
            type="text"
            value={cnpj}
            onChange={handleCnpjChange}
            placeholder="XX.XXX.XXX/XXXX-XX"
            maxLength={18}
            aria-invalid={!!errors.cnpj}
            aria-describedby={errors.cnpj ? 'cnpj-error' : undefined}
          />
          {errors.cnpj && (
            <p id="cnpj-error" className="text-xs text-[#DC2626]">{errors.cnpj}</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={createCompany.isPending}
      >
        {createCompany.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {t('submit')}
      </Button>
    </form>
  );
}
