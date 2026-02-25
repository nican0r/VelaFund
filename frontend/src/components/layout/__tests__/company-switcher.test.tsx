import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompanySwitcher, SidebarCompanySwitcher } from '../company-switcher';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      label: 'Switch company',
      select: 'Select a company',
      title: 'Your companies',
    };
    return translations[key] ?? key;
  },
}));

// Mock company context
const mockSetSelectedCompanyId = jest.fn();
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

const mockCompanies = [
  {
    id: 'c1',
    name: 'Acme Ltda.',
    entityType: 'LTDA' as const,
    cnpj: '12.345.678/0001-90',
    status: 'ACTIVE' as const,
    logoUrl: null,
    role: 'ADMIN',
    memberCount: 5,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'c2',
    name: 'TechCorp S.A.',
    entityType: 'SA_CAPITAL_FECHADO' as const,
    cnpj: '98.765.432/0001-10',
    status: 'ACTIVE' as const,
    logoUrl: null,
    role: 'FINANCE',
    memberCount: 12,
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'c3',
    name: 'StartupXYZ',
    entityType: 'LTDA' as const,
    cnpj: '11.222.333/0001-44',
    status: 'DRAFT' as const,
    logoUrl: null,
    role: 'ADMIN',
    memberCount: 2,
    createdAt: '2026-02-10T10:00:00Z',
  },
];

function setupMocks(overrides?: {
  companies?: typeof mockCompanies;
  selectedCompany?: (typeof mockCompanies)[0] | null;
  isLoading?: boolean;
}) {
  const hasSelectedCompany = overrides && 'selectedCompany' in overrides;
  mockUseCompany.mockReturnValue({
    companies: overrides?.companies ?? mockCompanies,
    selectedCompany: hasSelectedCompany ? overrides!.selectedCompany : mockCompanies[0],
    setSelectedCompanyId: mockSetSelectedCompanyId,
    isLoading: overrides?.isLoading ?? false,
    error: null,
  });
}

describe('CompanySwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders selected company name', () => {
    setupMocks();
    render(<CompanySwitcher />);
    expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
  });

  it('renders building icon', () => {
    setupMocks();
    render(<CompanySwitcher />);
    expect(screen.getByLabelText('Switch company')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    setupMocks({ isLoading: true });
    render(<CompanySwitcher />);
    // Should not show company name, but show skeleton placeholders
    expect(screen.queryByText('Acme Ltda.')).not.toBeInTheDocument();
  });

  it('renders static display when only one company', () => {
    const singleCompany = [mockCompanies[0]];
    setupMocks({ companies: singleCompany, selectedCompany: singleCompany[0] });
    render(<CompanySwitcher />);
    expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
    // Should not have a dropdown button
    expect(screen.queryByLabelText('Switch company')).not.toBeInTheDocument();
  });

  it('returns null when single company and no selection', () => {
    setupMocks({ companies: [mockCompanies[0]], selectedCompany: null });
    const { container } = render(<CompanySwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('opens dropdown on click', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    const trigger = screen.getByLabelText('Switch company');
    await user.click(trigger);

    expect(screen.getByText('Your companies')).toBeInTheDocument();
    expect(screen.getByText('TechCorp S.A.')).toBeInTheDocument();
    expect(screen.getByText('StartupXYZ')).toBeInTheDocument();
  });

  it('shows all companies in dropdown', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    await user.click(screen.getByLabelText('Switch company'));

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(3);
  });

  it('marks currently selected company', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    await user.click(screen.getByLabelText('Switch company'));

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('calls setSelectedCompanyId when selecting a different company', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    await user.click(screen.getByLabelText('Switch company'));
    await user.click(screen.getByText('TechCorp S.A.'));

    expect(mockSetSelectedCompanyId).toHaveBeenCalledWith('c2');
  });

  it('closes dropdown after selection', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    await user.click(screen.getByLabelText('Switch company'));
    expect(screen.getByText('Your companies')).toBeInTheDocument();

    await user.click(screen.getByText('TechCorp S.A.'));
    expect(screen.queryByText('Your companies')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(
      <div>
        <CompanySwitcher />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    await user.click(screen.getByLabelText('Switch company'));
    expect(screen.getByText('Your companies')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('Your companies')).not.toBeInTheDocument();
  });

  it('closes dropdown on Escape key', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    await user.click(screen.getByLabelText('Switch company'));
    expect(screen.getByText('Your companies')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Your companies')).not.toBeInTheDocument();
  });

  it('shows entity type and CNPJ in dropdown items', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    await user.click(screen.getByLabelText('Switch company'));

    expect(screen.getByText('Ltda. · 12.345.678/0001-90')).toBeInTheDocument();
    expect(screen.getByText('S.A. · 98.765.432/0001-10')).toBeInTheDocument();
  });

  it('shows company initial in item icon', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    await user.click(screen.getByLabelText('Switch company'));

    // "A" for Acme, "T" for TechCorp, "S" for StartupXYZ
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('has aria-expanded attribute on trigger', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<CompanySwitcher />);

    const trigger = screen.getByLabelText('Switch company');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('returns null when no companies and not loading', () => {
    setupMocks({ companies: [], selectedCompany: null });
    const { container } = render(<CompanySwitcher />);
    expect(container.firstChild).toBeNull();
  });
});

describe('SidebarCompanySwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders selected company name when expanded', () => {
    setupMocks();
    render(<SidebarCompanySwitcher collapsed={false} />);
    expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
  });

  it('hides company name when collapsed', () => {
    setupMocks();
    render(<SidebarCompanySwitcher collapsed={true} />);
    // In collapsed mode, should still show the company initial but not the name
    expect(screen.queryByText('Acme Ltda.')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows company initial icon', () => {
    setupMocks();
    render(<SidebarCompanySwitcher collapsed={false} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders static display when only one company', () => {
    const singleCompany = [mockCompanies[0]];
    setupMocks({ companies: singleCompany, selectedCompany: singleCompany[0] });
    render(<SidebarCompanySwitcher collapsed={false} />);
    expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
    // Should not have a dropdown button
    expect(screen.queryByLabelText('Switch company')).not.toBeInTheDocument();
  });

  it('opens dropdown on click with multiple companies', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SidebarCompanySwitcher collapsed={false} />);

    await user.click(screen.getByLabelText('Switch company'));

    expect(screen.getByText('Your companies')).toBeInTheDocument();
    expect(screen.getByText('TechCorp S.A.')).toBeInTheDocument();
  });

  it('calls setSelectedCompanyId on selection', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SidebarCompanySwitcher collapsed={false} />);

    await user.click(screen.getByLabelText('Switch company'));
    await user.click(screen.getByText('TechCorp S.A.'));

    expect(mockSetSelectedCompanyId).toHaveBeenCalledWith('c2');
  });

  it('closes dropdown after selection', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SidebarCompanySwitcher collapsed={false} />);

    await user.click(screen.getByLabelText('Switch company'));
    await user.click(screen.getByText('TechCorp S.A.'));

    expect(screen.queryByText('Your companies')).not.toBeInTheDocument();
  });

  it('shows title tooltip when collapsed', () => {
    setupMocks();
    render(<SidebarCompanySwitcher collapsed={true} />);
    const button = screen.getByLabelText('Switch company');
    expect(button).toHaveAttribute('title', 'Switch company: Acme Ltda.');
  });

  it('shows loading skeleton', () => {
    setupMocks({ isLoading: true });
    render(<SidebarCompanySwitcher collapsed={false} />);
    expect(screen.queryByText('Acme Ltda.')).not.toBeInTheDocument();
  });

  it('returns null when no companies and not loading', () => {
    setupMocks({ companies: [], selectedCompany: null });
    const { container } = render(<SidebarCompanySwitcher collapsed={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('closes dropdown on outside click', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(
      <div>
        <SidebarCompanySwitcher collapsed={false} />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    await user.click(screen.getByLabelText('Switch company'));
    expect(screen.getByText('Your companies')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('Your companies')).not.toBeInTheDocument();
  });
});
