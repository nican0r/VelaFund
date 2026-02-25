'use client';

import { Bell, Search, Menu, ChevronDown, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/hooks/use-notifications';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import { CompanySwitcher } from '@/components/layout/company-switcher';

interface TopbarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
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

export function Topbar({ onMenuClick, sidebarCollapsed }: TopbarProps) {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;

  const initials = getUserInitials(user?.firstName ?? null, user?.lastName ?? null, user?.email ?? null);
  const displayName = getUserDisplayName(user?.firstName ?? null, user?.lastName ?? null, user?.email ?? null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex h-topbar items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm transition-[left] duration-200 sm:px-6',
        sidebarCollapsed ? 'left-sidebar-collapsed' : 'left-sidebar',
        'max-lg:left-0',
      )}
    >
      {/* Left section: hamburger (mobile) + search */}
      <div className="flex items-center gap-x-4">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search bar */}
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-full max-w-[360px] rounded-md bg-gray-100 pl-9 pr-4 text-sm text-gray-700 placeholder:text-gray-400 outline-none transition-colors duration-150 focus:bg-white focus:ring-2 focus:ring-ocean-600/20 focus:border focus:border-ocean-600 sm:w-[280px] lg:w-[360px]"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400 lg:inline-block">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Right section: company switcher + notifications + user */}
      <div className="flex items-center gap-x-2">
        {/* Company switcher */}
        <CompanySwitcher />

        {/* Divider */}
        <div className="mx-1 hidden h-6 w-px bg-gray-200 md:block" />

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-lg p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationDropdown
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-gray-200" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-x-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-gray-100"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-xs font-medium text-white">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-gray-700 md:inline-block">
              {displayName}
            </span>
            <ChevronDown className={cn(
              'hidden h-4 w-4 text-gray-400 transition-transform duration-150 md:block',
              userMenuOpen && 'rotate-180',
            )} />
          </button>

          {/* Dropdown menu */}
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-gray-700">{displayName}</p>
                <p className="truncate text-xs text-gray-500">{user?.email || ''}</p>
              </div>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
