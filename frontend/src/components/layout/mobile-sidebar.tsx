'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { SidebarCompanySwitcher } from '@/components/layout/company-switcher';
import { menuItems, generalItems, type NavItem } from '@/lib/sidebar-nav';

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

function getUserInitials(firstName: string | null, lastName: string | null, email: string | null): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '?';
}

function getUserDisplayName(firstName: string | null, lastName: string | null, email: string | null): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  return email || '';
}

function MobileNavLink({ item, label, isActive }: { item: NavItem; label: string; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex h-10 items-center gap-x-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-navy-800 text-white'
          : 'text-white/70 hover:bg-navy-950 hover:text-white/90',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-ocean-600" />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const t = useTranslations('sidebar');

  const initials = getUserInitials(user?.firstName ?? null, user?.lastName ?? null, user?.email ?? null);
  const displayName = getUserDisplayName(user?.firstName ?? null, user?.lastName ?? null, user?.email ?? null);

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-navy-900/50 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside className="fixed inset-y-0 left-0 flex w-sidebar flex-col bg-navy-900 shadow-xl">
        {/* Header with close button */}
        <div className="flex h-topbar shrink-0 items-center justify-between border-b border-white/10 px-5">
          <span className="text-xl font-bold text-white tracking-tight">Navia</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 hover:bg-navy-950 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Company switcher */}
        <div className="border-b border-white/10 px-3 py-2">
          <SidebarCompanySwitcher collapsed={false} />
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-y-1 overflow-y-auto px-3 py-4">
          <span className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-white/60">
            {t('menuLabel')}
          </span>
          {menuItems.map((item) => (
            <MobileNavLink
              key={item.href}
              item={item}
              label={t(item.labelKey)}
              isActive={isActive(item.href)}
            />
          ))}

          <div className="my-3 border-t border-white/10" />

          <span className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-white/60">
            {t('generalLabel')}
          </span>
          {generalItems.map((item) => (
            <MobileNavLink
              key={item.href}
              item={item}
              label={t(item.labelKey)}
              isActive={isActive(item.href)}
            />
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-x-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-xs font-medium text-white">
              {initials}
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-white">
                {displayName}
              </span>
              <span className="truncate text-xs text-white/60">
                {user?.email || ''}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors duration-150 hover:bg-navy-950 hover:text-white/90"
            aria-label={t('logout')}
          >
            <LogOut className="h-4 w-4" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
