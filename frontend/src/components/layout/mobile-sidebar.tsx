'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  LayoutDashboard,
  Table2,
  Users,
  ArrowLeftRight,
  TrendingUp,
  Gift,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const menuItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cap Table', href: '/dashboard/cap-table', icon: Table2 },
  { label: 'Shareholders', href: '/dashboard/shareholders', icon: Users },
  { label: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
  { label: 'Investments', href: '/dashboard/investments', icon: TrendingUp },
  { label: 'Options', href: '/dashboard/options', icon: Gift },
  { label: 'Documents', href: '/dashboard/documents', icon: FileText },
];

const generalItems: NavItem[] = [
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Help', href: '/dashboard/help', icon: HelpCircle },
];

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();

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

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-y-1 overflow-y-auto px-3 py-4">
          <span className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-white/60">
            Menu
          </span>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex h-10 items-center gap-x-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-navy-800 text-white'
                    : 'text-white/70 hover:bg-navy-950 hover:text-white/90',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-ocean-600" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          <span className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-white/60">
            General
          </span>
          {generalItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex h-10 items-center gap-x-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-navy-800 text-white'
                    : 'text-white/70 hover:bg-navy-950 hover:text-white/90',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-ocean-600" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-x-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-xs font-medium text-white">
              NP
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-white">
                Nelson Pereira
              </span>
              <span className="truncate text-xs text-white/60">
                nelson@navia.com.br
              </span>
            </div>
          </div>
          <button
            className="mt-2 flex w-full items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors duration-150 hover:bg-navy-950 hover:text-white/90"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
