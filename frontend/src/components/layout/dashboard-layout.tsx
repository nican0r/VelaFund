'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CompanyProvider } from '@/lib/company-context';
import { cn } from '@/lib/utils';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleOpenMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const handleCloseMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  return (
    <CompanyProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
        </div>

        {/* Mobile sidebar */}
        <MobileSidebar open={mobileSidebarOpen} onClose={handleCloseMobileSidebar} />

        {/* Topbar */}
        <Topbar
          onMenuClick={handleOpenMobileSidebar}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Main content area */}
        <main
          className={cn(
            'min-h-screen pt-topbar transition-[padding-left] duration-200',
            sidebarCollapsed ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar',
          )}
        >
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </CompanyProvider>
  );
}
