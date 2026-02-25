'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Table2,
  Users,
  Layers,
  ArrowLeftRight,
  TrendingUp,
  Repeat,
  Gift,
  FileText,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const menuItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cap Table', href: '/dashboard/cap-table', icon: Table2 },
  { label: 'Shareholders', href: '/dashboard/shareholders', icon: Users },
  { label: 'Share Classes', href: '/dashboard/share-classes', icon: Layers },
  { label: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
  { label: 'Funding Rounds', href: '/dashboard/funding-rounds', icon: TrendingUp },
  { label: 'Convertibles', href: '/dashboard/convertibles', icon: Repeat },
  { label: 'Options', href: '/dashboard/options', icon: Gift },
  { label: 'Documents', href: '/dashboard/documents', icon: FileText },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
];

const generalItems: NavItem[] = [
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Help', href: '/dashboard/help', icon: HelpCircle },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex h-10 items-center gap-x-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-navy-800 text-white'
          : 'text-white/70 hover:bg-navy-950 hover:text-white/90',
        collapsed && 'justify-center px-0',
      )}
      title={collapsed ? item.label : undefined}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-ocean-600" />
      )}
      <Icon className={cn('h-5 w-5 shrink-0', collapsed ? 'mx-auto' : '')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
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

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = getUserInitials(user?.firstName ?? null, user?.lastName ?? null, user?.email ?? null);
  const displayName = getUserDisplayName(user?.firstName ?? null, user?.lastName ?? null, user?.email ?? null);

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-navy-900 transition-[width] duration-200',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      {/* Logo area */}
      <div
        className={cn(
          'flex h-topbar shrink-0 items-center border-b border-white/10',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        {collapsed ? (
          <span className="text-lg font-bold text-white">N</span>
        ) : (
          <span className="text-xl font-bold text-white tracking-tight">Navia</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-y-1 overflow-y-auto px-3 py-4">
        {/* MENU section */}
        {!collapsed && (
          <span className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-white/60">
            Menu
          </span>
        )}
        {menuItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}

        {/* Divider */}
        <div className="my-3 border-t border-white/10" />

        {/* GENERAL section */}
        {!collapsed && (
          <span className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-white/60">
            General
          </span>
        )}
        {generalItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-white/10">
        <button
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-x-2 px-5 py-3 text-sm text-white/60 transition-colors duration-150 hover:text-white/90',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* User section */}
      <div
        className={cn(
          'border-t border-white/10 p-4',
          collapsed && 'flex items-center justify-center p-2',
        )}
      >
        <div className={cn('flex items-center gap-x-3', collapsed && 'gap-x-0')}>
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-xs font-medium text-white">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-white">
                {displayName}
              </span>
              <span className="truncate text-xs text-white/60">
                {user?.email || ''}
              </span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors duration-150 hover:bg-navy-950 hover:text-white/90"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
