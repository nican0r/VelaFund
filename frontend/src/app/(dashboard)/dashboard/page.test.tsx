import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from './page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const keys: Record<string, string> = {
      title: 'Dashboard',
      description: 'Overview of your company.',
      'stats.company': 'Company',
      'stats.notifications': 'Notifications',
      'stats.settings': 'Settings',
      'noCompany.title': 'No company found',
      'noCompany.description': 'Create a company to get started.',
    };
    return keys[key] ?? key;
  },
}));

// Mock company context
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company state when user has no companies', () => {
    mockUseCompany.mockReturnValue({
      companies: [],
      selectedCompany: null,
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('No company found')).toBeInTheDocument();
    expect(
      screen.getByText('Create a company to get started.'),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: true,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    // Loading skeletons should be present (animated divs)
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders company name in stat card when loaded', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
