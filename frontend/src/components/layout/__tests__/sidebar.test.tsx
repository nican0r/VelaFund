import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../sidebar';
import { menuItems, generalItems } from '@/lib/sidebar-nav';

// --- Mocks ---

const sidebarTranslations: Record<string, string> = {
  menuLabel: 'Menu',
  generalLabel: 'General',
  collapse: 'Collapse',
  expand: 'Expand sidebar',
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
  firstName: 'Nelson',
  lastName: 'Pereira',
  email: 'nelson@example.com',
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

// SidebarCompanySwitcher renders company selector — mock it
jest.mock('@/components/layout/company-switcher', () => ({
  SidebarCompanySwitcher: ({ collapsed }: { collapsed: boolean }) => (
    <div data-testid="company-switcher" data-collapsed={collapsed}>
      Company Switcher
    </div>
  ),
}));

describe('Sidebar', () => {
  const mockOnToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    mockUseCompany.mockReturnValue({
      companies: [{ id: '1', name: 'Test Co' }],
      selectedCompany: { id: '1', name: 'Test Co' },
      isLoading: false,
    });
  });

  describe('rendering', () => {
    it('renders the Navia logo', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('Navia')).toBeInTheDocument();
    });

    it('renders abbreviated logo when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.getByText('N')).toBeInTheDocument();
      expect(screen.queryByText('Navia')).not.toBeInTheDocument();
    });

    it('renders the company switcher', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByTestId('company-switcher')).toBeInTheDocument();
    });

    it('passes collapsed state to company switcher', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.getByTestId('company-switcher')).toHaveAttribute(
        'data-collapsed',
        'true',
      );
    });
  });

  describe('navigation items', () => {
    it('renders all 9 menu items', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
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
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('renders correct number of nav links (9 menu + 3 general = 12)', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(menuItems.length + generalItems.length);
    });

    it('renders nav links with correct hrefs', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const allItems = [...menuItems, ...generalItems];
      for (const item of allItems) {
        const label = sidebarTranslations[item.labelKey];
        const link = screen.getByText(label).closest('a');
        expect(link).toHaveAttribute('href', item.href);
      }
    });

    it('renders Menu section label', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('Menu')).toBeInTheDocument();
    });

    it('renders General section label', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    it('hides section labels when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      expect(screen.queryByText('General')).not.toBeInTheDocument();
    });

    it('hides nav labels when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Company Page')).not.toBeInTheDocument();
    });

    it('shows title tooltips when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      const links = screen.getAllByRole('link');
      for (const link of links) {
        expect(link).toHaveAttribute('title');
      }
    });
  });

  describe('active state', () => {
    it('highlights Dashboard when on /dashboard', () => {
      mockPathname = '/dashboard';
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveClass('bg-navy-800');
    });

    it('does not highlight Dashboard when on /dashboard/settings', () => {
      mockPathname = '/dashboard/settings';
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).not.toHaveClass('bg-navy-800');
    });

    it('highlights Settings when on /dashboard/settings', () => {
      mockPathname = '/dashboard/settings';
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const settingsLink = screen.getByText('Settings').closest('a');
      expect(settingsLink).toHaveClass('bg-navy-800');
    });

    it('highlights Company Page when on /dashboard/company-page', () => {
      mockPathname = '/dashboard/company-page';
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const link = screen.getByText('Company Page').closest('a');
      expect(link).toHaveClass('bg-navy-800');
    });

    it('highlights Dataroom when on /dashboard/dataroom', () => {
      mockPathname = '/dashboard/dataroom';
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const link = screen.getByText('Dataroom').closest('a');
      expect(link).toHaveClass('bg-navy-800');
    });

    it('renders active indicator bar for active item', () => {
      mockPathname = '/dashboard';
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      const indicator = dashboardLink?.querySelector('.bg-ocean-600');
      expect(indicator).toBeInTheDocument();
    });

    it('does not render active indicator bar for inactive items', () => {
      mockPathname = '/dashboard';
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      const settingsLink = screen.getByText('Settings').closest('a');
      const indicator = settingsLink?.querySelector('.bg-ocean-600');
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('collapse toggle', () => {
    it('renders collapse button with correct aria-label when expanded', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByLabelText('Collapse')).toBeInTheDocument();
    });

    it('renders expand button with correct aria-label when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
    });

    it('calls onToggle when collapse button is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      await user.click(screen.getByLabelText('Collapse'));
      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('shows Collapse label text when expanded', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('Collapse')).toBeInTheDocument();
    });
  });

  describe('user section', () => {
    it('displays user initials', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('NP')).toBeInTheDocument();
    });

    it('displays user full name', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('Nelson Pereira')).toBeInTheDocument();
    });

    it('displays user email', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByText('nelson@example.com')).toBeInTheDocument();
    });

    it('hides user name and email when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.queryByText('Nelson Pereira')).not.toBeInTheDocument();
      expect(screen.queryByText('nelson@example.com')).not.toBeInTheDocument();
    });

    it('shows initials when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.getByText('NP')).toBeInTheDocument();
    });

    it('renders logout button when expanded', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(screen.getByLabelText('Log out')).toBeInTheDocument();
    });

    it('hides logout button when collapsed', () => {
      render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
      expect(screen.queryByLabelText('Log out')).not.toBeInTheDocument();
    });

    it('calls logout when logout button is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      await user.click(screen.getByLabelText('Log out'));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('sidebar-nav sync', () => {
    it('uses the same items array as defined in sidebar-nav.ts', () => {
      render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
      expect(menuItems).toHaveLength(9);
      expect(generalItems).toHaveLength(3);
      // Every item should have a corresponding link
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(12);
    });
  });
});
