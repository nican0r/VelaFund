'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useTranslations } from 'next-intl';
import type { CompanyListItem } from '@/types/company';

const entityTypeLabels: Record<string, string> = {
  LTDA: 'Ltda.',
  SA_CAPITAL_FECHADO: 'S.A.',
  SA_CAPITAL_ABERTO: 'S.A.',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-celadon-100 text-celadon-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  INACTIVE: 'bg-cream-100 text-cream-700',
  DISSOLVED: 'bg-gray-100 text-gray-500',
};

function CompanyItem({
  company,
  isSelected,
  onClick,
}: {
  company: CompanyListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-x-3 rounded-md px-3 py-2.5 text-left transition-colors duration-150',
        isSelected ? 'bg-ocean-50 text-ocean-600' : 'text-gray-700 hover:bg-gray-50',
      )}
      role="option"
      aria-selected={isSelected}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
          isSelected ? 'bg-ocean-600 text-white' : 'bg-gray-100 text-gray-600',
        )}
      >
        {company.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <span className="truncate text-sm font-medium">{company.name}</span>
        <span className="text-xs text-gray-500">
          {entityTypeLabels[company.entityType] || company.entityType}
          {company.cnpj ? ` · ${company.cnpj}` : ''}
        </span>
      </div>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-ocean-600" />}
    </button>
  );
}

export function CompanySwitcher() {
  const { companies, selectedCompany, setSelectedCompanyId, isLoading } = useCompany();
  const t = useTranslations('companySwitcher');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  // Don't render if only one company
  if (!isLoading && companies.length <= 1) {
    if (!selectedCompany) return null;
    return (
      <div className="flex items-center gap-x-2 rounded-md px-2 py-1.5">
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="hidden text-sm font-medium text-navy-900 md:inline-block">
          {selectedCompany.name}
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-x-2 rounded-md px-2 py-1.5">
        <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
        <div className="hidden h-4 w-24 animate-pulse rounded bg-gray-200 md:block" />
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-x-2 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-gray-100"
        aria-label={t('label')}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="hidden max-w-[160px] truncate text-sm font-medium text-navy-900 md:inline-block">
          {selectedCompany?.name || t('select')}
        </span>
        <ChevronDown
          className={cn(
            'hidden h-3.5 w-3.5 text-gray-400 transition-transform duration-150 md:block',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
          aria-label={t('label')}
        >
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-medium text-gray-500">{t('title')}</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {companies.map((company) => (
              <CompanyItem
                key={company.id}
                company={company}
                isSelected={company.id === selectedCompany?.id}
                onClick={() => {
                  setSelectedCompanyId(company.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Sidebar variant of the company switcher — compact, dark-themed */
export function SidebarCompanySwitcher({ collapsed }: { collapsed: boolean }) {
  const { companies, selectedCompany, setSelectedCompanyId, isLoading } = useCompany();
  const t = useTranslations('companySwitcher');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!isLoading && companies.length <= 1) {
    if (!selectedCompany) return null;
    return (
      <div
        className={cn(
          'flex items-center gap-x-2 px-3 py-2',
          collapsed && 'justify-center px-0',
        )}
        title={collapsed ? selectedCompany.name : undefined}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-white">
          {selectedCompany.name.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-medium text-white/90">
            {selectedCompany.name}
          </span>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-x-2 px-3 py-2', collapsed && 'justify-center px-0')}>
        <div className="h-7 w-7 animate-pulse rounded-md bg-white/10" />
        {!collapsed && <div className="h-4 w-20 animate-pulse rounded bg-white/10" />}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-x-2 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-navy-950',
          collapsed && 'justify-center px-0',
        )}
        title={collapsed ? `${t('label')}: ${selectedCompany?.name}` : undefined}
        aria-label={t('label')}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-white">
          {selectedCompany?.name.charAt(0).toUpperCase() || '?'}
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left text-sm font-medium text-white/90">
              {selectedCompany?.name || t('select')}
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-white/40 transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg',
            collapsed ? 'left-full top-0 ml-2' : 'left-0 top-full',
          )}
          role="listbox"
          aria-label={t('label')}
        >
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-medium text-gray-500">{t('title')}</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {companies.map((company) => (
              <CompanyItem
                key={company.id}
                company={company}
                isSelected={company.id === selectedCompany?.id}
                onClick={() => {
                  setSelectedCompanyId(company.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
