'use client';

import { Bell, Search, Menu, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopbarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export function Topbar({ onMenuClick, sidebarCollapsed }: TopbarProps) {
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

      {/* Right section: notifications + user */}
      <div className="flex items-center gap-x-2">
        {/* Notification bell */}
        <button
          className="relative rounded-lg p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {/* Unread badge */}
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        </button>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-gray-200" />

        {/* User menu */}
        <button
          className="flex items-center gap-x-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-gray-100"
          aria-label="User menu"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-xs font-medium text-white">
            NP
          </div>
          <span className="hidden text-sm font-medium text-gray-700 md:inline-block">
            Nelson Pereira
          </span>
          <ChevronDown className="hidden h-4 w-4 text-gray-400 md:block" />
        </button>
      </div>
    </header>
  );
}
