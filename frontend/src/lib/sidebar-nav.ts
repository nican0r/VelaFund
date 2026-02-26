import {
  LayoutDashboard,
  Globe,
  FolderOpen,
  Sparkles,
  MessageSquare,
  Megaphone,
  Landmark,
  BarChart3,
  Users,
  Bell,
  Settings,
  HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Founder dashboard MENU section — 9 nav items.
 * Shared between desktop Sidebar and MobileSidebar to prevent drift.
 */
export const menuItems: NavItem[] = [
  { labelKey: 'menu.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'menu.companyPage', href: '/dashboard/company-page', icon: Globe },
  { labelKey: 'menu.dataroom', href: '/dashboard/dataroom', icon: FolderOpen },
  { labelKey: 'menu.aiReports', href: '/dashboard/ai-reports', icon: Sparkles },
  { labelKey: 'menu.investorQA', href: '/dashboard/qa-conversations', icon: MessageSquare },
  { labelKey: 'menu.updates', href: '/dashboard/updates', icon: Megaphone },
  { labelKey: 'menu.bankConnections', href: '/dashboard/bank-connections', icon: Landmark },
  { labelKey: 'menu.analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { labelKey: 'menu.investors', href: '/dashboard/investors', icon: Users },
];

/**
 * Founder dashboard GENERAL section — 3 nav items.
 * Shared between desktop Sidebar and MobileSidebar to prevent drift.
 */
export const generalItems: NavItem[] = [
  { labelKey: 'general.notifications', href: '/dashboard/notifications', icon: Bell },
  { labelKey: 'general.settings', href: '/dashboard/settings', icon: Settings },
  { labelKey: 'general.help', href: '/dashboard/help', icon: HelpCircle },
];
