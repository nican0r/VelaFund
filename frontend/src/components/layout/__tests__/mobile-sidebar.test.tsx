import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileSidebar } from '../mobile-sidebar';
import { menuItems, generalItems } from '@/lib/sidebar-nav';

// --- Mocks ---

const sidebarTranslations: Record<string, string> = {
  menuLabel: 'Menu',
  generalLabel: 'General',
  logout: 'Log out',
  'menu.dashboard': 'Dashboard',
  'menu.companyPage': 'Company Page',
  'menu.dataroom': 'Dataroom',
  'menu.aiReports': 'AI Reports',
  'menu.investorQA': 'Investor Q&A',
  'menu.updates': 'Updates',
  'menu.bankConnections': 'Bank Connections',
  'menu.analytics': 'Analytics',
  'menu.investors': 'Investors',
  'general.notifications': 'Notifications',
  'general.settings': 'Settings',
  'general.help': 'Help',
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) =>
    sidebarTranslations[key] ?? key,
}));

let mockPathname = '/dashboard';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockLogout = jest.fn();
const mockUser = {
  id: 'user-1',
  firstName: 'Maria',
  lastName: 'Santos',
  email: 'maria@example.com',
};

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

jest.mock('@/components/layout/company-switcher', () => ({
  SidebarCompanySwitcher: ({ collapsed }: { collapsed: boolean }) => (
    <div data-testid="company-switcher" data-collapsed={collapsed}>
      Company Switcher
    </div>
  ),
}));

describe('MobileSidebar', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    mockUseCompany.mockReturnValue({
      companies: [{ id: '1', name: 'Test Co' }],
      selectedCompany: { id: '1', name: 'Test Co' },
      isLoading: false,
    });
  });

  describe('visibility', () => {
    it('renders nothing when not open', () => {
      const { container } = render(
        <MobileSidebar open={false} onClose={mockOnClose} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders sidebar when open', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByText('Navia')).toBeInTheDocument();
    });
  });

  describe('navigation items', () => {
    it('renders all 9 menu items', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Company Page')).toBeInTheDocument();
      expect(screen.getByText('Dataroom')).toBeInTheDocument();
      expect(screen.getByText('AI Reports')).toBeInTheDocument();
      expect(screen.getByText('Investor Q&A')).toBeInTheDocument();
      expect(screen.getByText('Updates')).toBeInTheDocument();
      expect(screen.getByText('Bank Connections')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Investors')).toBeInTheDocument();
    });

    it('renders all 3 general items', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('renders correct total of 12 nav links', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(12);
    });

    it('renders nav links with correct hrefs', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const allItems = [...menuItems, ...generalItems];
      for (const item of allItems) {
        const label = sidebarTranslations[item.labelKey];
        const link = screen.getByText(label).closest('a');
        expect(link).toHaveAttribute('href', item.href);
      }
    });

    it('renders Menu and General section labels', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByText('Menu')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('highlights Dashboard when on /dashboard', () => {
      mockPathname = '/dashboard';
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const link = screen.getByText('Dashboard').closest('a');
      expect(link).toHaveClass('bg-navy-800');
    });

    it('highlights Settings when on /dashboard/settings', () => {
      mockPathname = '/dashboard/settings';
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const link = screen.getByText('Settings').closest('a');
      expect(link).toHaveClass('bg-navy-800');
    });

    it('does not highlight Dashboard when on subpage', () => {
      mockPathname = '/dashboard/settings';
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const link = screen.getByText('Dashboard').closest('a');
      expect(link).not.toHaveClass('bg-navy-800');
    });

    it('renders active indicator bar', () => {
      mockPathname = '/dashboard';
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const link = screen.getByText('Dashboard').closest('a');
      const indicator = link?.querySelector('.bg-ocean-600');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('renders close button with aria-label', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      // useEffect calls onClose on mount (pathname change watcher), so clear first
      mockOnClose.mockClear();
      await user.click(screen.getByLabelText('Close sidebar'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked', async () => {
      const user = userEvent.setup();
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const overlay = document.querySelector('[aria-hidden="true"]');
      expect(overlay).toBeInTheDocument();
      await user.click(overlay!);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('user section', () => {
    it('displays user initials', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByText('MS')).toBeInTheDocument();
    });

    it('displays user full name', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });

    it('displays user email', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    });

    it('renders logout button', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(screen.getByLabelText('Log out')).toBeInTheDocument();
    });

    it('calls logout when logout button is clicked', async () => {
      const user = userEvent.setup();
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      await user.click(screen.getByLabelText('Log out'));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('company switcher', () => {
    it('renders company switcher with collapsed=false', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      const switcher = screen.getByTestId('company-switcher');
      expect(switcher).toHaveAttribute('data-collapsed', 'false');
    });
  });

  describe('sidebar-nav sync', () => {
    it('uses the same item arrays as desktop sidebar', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(menuItems).toHaveLength(9);
      expect(generalItems).toHaveLength(3);
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(12);
    });
  });

  describe('body scroll lock', () => {
    it('locks body scroll when open', () => {
      render(<MobileSidebar open={true} onClose={mockOnClose} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
      const { rerender } = render(
        <MobileSidebar open={true} onClose={mockOnClose} />,
      );
      expect(document.body.style.overflow).toBe('hidden');
      rerender(<MobileSidebar open={false} onClose={mockOnClose} />);
      expect(document.body.style.overflow).toBe('');
    });
  });
});
