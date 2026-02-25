import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const allKeys: Record<string, Record<string, string>> = {
      settings: {
        title: 'Settings',
        description: 'Manage your company settings.',
        'tabs.company': 'Company',
        'tabs.members': 'Members',
      },
      'settings.company': {
        title: 'Company Information',
        subtitle: 'Manage your company\'s basic information.',
        name: 'Company name',
        namePlaceholder: 'e.g. Acme Ltda.',
        description: 'Description',
        descriptionPlaceholder: 'Briefly describe the company...',
        entityType: 'Entity type',
        'entityTypes.LTDA': 'Ltda.',
        'entityTypes.SA_CAPITAL_FECHADO': 'S.A. Private',
        'entityTypes.SA_CAPITAL_ABERTO': 'S.A. Public',
        cnpj: 'CNPJ',
        status: 'Status',
        'statuses.ACTIVE': 'Active',
        'statuses.DRAFT': 'Draft',
        'statuses.INACTIVE': 'Inactive',
        'statuses.DISSOLVED': 'Dissolved',
        foundedDate: 'Founded date',
        currency: 'Default currency',
        timezone: 'Timezone',
        fiscalYearEnd: 'Fiscal year end',
        locale: 'Language',
        saveSuccess: 'Company information updated successfully',
        saveError: 'Failed to save company information',
      },
      'settings.members': {
        title: 'Team Members',
        subtitle: 'Manage team members and their permissions.',
        inviteButton: 'Invite member',
        empty: 'No members found.',
        'stats.total': 'Total Members',
        'stats.active': 'Active',
        'stats.pending': 'Pending',
        'stats.admins': 'Administrators',
        'filter.searchPlaceholder': 'Search by email or name...',
        'filter.allRoles': 'All roles',
        'filter.allStatuses': 'All statuses',
        'table.member': 'Member',
        'table.role': 'Role',
        'table.status': 'Status',
        'table.invitedAt': 'Invited at',
        'table.actions': 'Actions',
        'role.ADMIN': 'Administrator',
        'role.FINANCE': 'Finance',
        'role.LEGAL': 'Legal',
        'role.INVESTOR': 'Investor',
        'role.EMPLOYEE': 'Employee',
        'status.ACTIVE': 'Active',
        'status.PENDING': 'Pending',
        'status.REMOVED': 'Removed',
        'dialog.invite.title': 'Invite member',
        'dialog.invite.email': 'Email',
        'dialog.invite.emailPlaceholder': 'name@company.com',
        'dialog.invite.role': 'Role',
        'dialog.invite.message': 'Message (optional)',
        'dialog.invite.messagePlaceholder': 'Custom message...',
        'dialog.invite.cancel': 'Cancel',
        'dialog.invite.confirm': 'Send invitation',
        'dialog.invite.sending': 'Sending...',
        'dialog.remove.title': 'Remove member',
        'dialog.remove.message': 'Are you sure you want to remove {name}?',
        'dialog.remove.cancel': 'Cancel',
        'dialog.remove.confirm': 'Remove',
        'dialog.changeRole.title': 'Change role',
        'dialog.changeRole.label': 'New role',
        'dialog.changeRole.cancel': 'Cancel',
        'dialog.changeRole.confirm': 'Save',
        'actions.changeRole': 'Change role',
        'actions.remove': 'Remove',
        'actions.resend': 'Resend invitation',
        'success.invited': 'Invitation sent successfully',
        'success.removed': 'Member removed successfully',
        resendSuccess: 'Invitation resent successfully',
        resendError: 'Failed to resend invitation',
        roleChangeSuccess: 'Member role changed successfully',
        roleChangeError: 'Failed to change member role',
        'pagination.showing': 'Showing {from} to {to} of {total}',
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'pagination.page': 'Page',
        'pagination.of': 'of',
      },
      common: {
        save: 'Save',
        cancel: 'Cancel',
        loading: 'Loading...',
      },
    };
    return (key: string, params?: Record<string, unknown>) => {
      let value = allKeys[namespace]?.[key] ?? `${namespace}.${key}`;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(`{${k}}`, String(v));
        });
      }
      return value;
    };
  },
}));

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock company context
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// Mock hooks
const mockUseMembers = jest.fn();
const mockUseInviteMember = jest.fn();
const mockUseUpdateMember = jest.fn();
const mockUseRemoveMember = jest.fn();
const mockUseResendInvitation = jest.fn();
const mockUseCompanyDetail = jest.fn();
const mockUseUpdateCompany = jest.fn();
jest.mock('@/hooks/use-members', () => ({
  useMembers: (...args: unknown[]) => mockUseMembers(...args),
  useInviteMember: (...args: unknown[]) => mockUseInviteMember(...args),
  useUpdateMember: (...args: unknown[]) => mockUseUpdateMember(...args),
  useRemoveMember: (...args: unknown[]) => mockUseRemoveMember(...args),
  useResendInvitation: (...args: unknown[]) => mockUseResendInvitation(...args),
  useCompanyDetail: (...args: unknown[]) => mockUseCompanyDetail(...args),
  useUpdateCompany: (...args: unknown[]) => mockUseUpdateCompany(...args),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock useErrorToast
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => jest.fn(),
}));

// --- Mock data ---

const mockCompany = {
  id: 'c1',
  name: 'Acme Ltda.',
  entityType: 'LTDA' as const,
  cnpj: '12.345.678/0001-90',
  status: 'ACTIVE' as const,
  logoUrl: null,
  role: 'ADMIN',
  memberCount: 3,
  createdAt: '2026-01-15T10:00:00.000Z',
};

const mockCompanyDetail = {
  id: 'c1',
  name: 'Acme Ltda.',
  entityType: 'LTDA' as const,
  cnpj: '12.345.678/0001-90',
  description: 'A test company',
  logoUrl: null,
  foundedDate: '2025-06-01',
  status: 'ACTIVE' as const,
  cnpjValidatedAt: '2026-01-16T10:00:00.000Z',
  defaultCurrency: 'BRL',
  fiscalYearEnd: '12-31',
  timezone: 'America/Sao_Paulo',
  locale: 'pt-BR',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
};

const mockMembers = [
  {
    id: 'm1',
    companyId: 'c1',
    userId: 'u1',
    email: 'admin@acme.com',
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
    permissions: null,
    invitedBy: null,
    invitedAt: '2026-01-15T10:00:00.000Z',
    acceptedAt: '2026-01-15T10:30:00.000Z',
    removedAt: null,
    removedBy: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    user: {
      id: 'u1',
      firstName: 'Nelson',
      lastName: 'Pereira',
      profilePictureUrl: null,
      walletAddress: null,
    },
  },
  {
    id: 'm2',
    companyId: 'c1',
    userId: 'u2',
    email: 'finance@acme.com',
    role: 'FINANCE' as const,
    status: 'ACTIVE' as const,
    permissions: null,
    invitedBy: 'u1',
    invitedAt: '2026-01-16T10:00:00.000Z',
    acceptedAt: '2026-01-16T14:00:00.000Z',
    removedAt: null,
    removedBy: null,
    createdAt: '2026-01-16T10:00:00.000Z',
    updatedAt: '2026-01-16T10:00:00.000Z',
    user: {
      id: 'u2',
      firstName: 'Maria',
      lastName: 'Santos',
      profilePictureUrl: null,
      walletAddress: null,
    },
  },
  {
    id: 'm3',
    companyId: 'c1',
    userId: null,
    email: 'pending@acme.com',
    role: 'EMPLOYEE' as const,
    status: 'PENDING' as const,
    permissions: null,
    invitedBy: 'u1',
    invitedAt: '2026-02-01T10:00:00.000Z',
    acceptedAt: null,
    removedAt: null,
    removedBy: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    user: null,
  },
];

const defaultMutationReturn = {
  mutateAsync: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
  reset: jest.fn(),
};

// --- Helpers ---

function setupMocks(overrides?: {
  companyLoading?: boolean;
  selectedCompany?: typeof mockCompany | null;
  membersData?: typeof mockMembers;
  membersLoading?: boolean;
  membersError?: Error | null;
  companyDetailData?: typeof mockCompanyDetail | null;
  companyDetailLoading?: boolean;
}) {
  const {
    companyLoading = false,
    selectedCompany = mockCompany,
    membersData = mockMembers,
    membersLoading = false,
    membersError = null,
    companyDetailData = mockCompanyDetail,
    companyDetailLoading = false,
  } = overrides || {};

  mockUseCompany.mockReturnValue({
    companies: selectedCompany ? [selectedCompany] : [],
    selectedCompany,
    setSelectedCompanyId: jest.fn(),
    isLoading: companyLoading,
    error: null,
  });

  mockUseMembers.mockReturnValue({
    data: membersData
      ? {
          data: membersData,
          meta: { total: membersData.length, page: 1, limit: 20, totalPages: 1 },
        }
      : undefined,
    isLoading: membersLoading,
    error: membersError,
  });

  mockUseInviteMember.mockReturnValue(defaultMutationReturn);
  mockUseUpdateMember.mockReturnValue(defaultMutationReturn);
  mockUseRemoveMember.mockReturnValue(defaultMutationReturn);
  mockUseResendInvitation.mockReturnValue(defaultMutationReturn);

  mockUseCompanyDetail.mockReturnValue({
    data: companyDetailData,
    isLoading: companyDetailLoading,
    error: null,
  });

  mockUseUpdateCompany.mockReturnValue(defaultMutationReturn);
}

// --- Tests ---

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  // === Page Header ===

  it('renders the settings page title', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Manage your company settings.')).toBeInTheDocument();
  });

  // === Tab Navigation ===

  it('renders both tab buttons', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('shows Company tab as active by default', () => {
    render(<SettingsPage />);
    const companyTab = screen.getByText('Company');
    expect(companyTab.closest('button')).toHaveClass('border-ocean-600');
  });

  it('switches to Members tab on click', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Members'));
    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('Invite member')).toBeInTheDocument();
  });

  // === No Company State ===

  it('shows empty state when no company is selected', () => {
    setupMocks({ selectedCompany: null });
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  // === Company Info Tab ===

  it('renders company info form with data', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Company Information')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme Ltda.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test company')).toBeInTheDocument();
  });

  it('shows entity type as read-only', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Ltda.')).toBeInTheDocument();
  });

  it('shows CNPJ as read-only', () => {
    render(<SettingsPage />);
    expect(screen.getByText('12.345.678/0001-90')).toBeInTheDocument();
  });

  it('shows company status', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows loading skeleton when company detail is loading', () => {
    setupMocks({ companyDetailLoading: true, companyDetailData: null });
    render(<SettingsPage />);
    // Should show skeletons (no form fields visible)
    expect(screen.queryByDisplayValue('Acme Ltda.')).not.toBeInTheDocument();
  });

  it('enables save button when name is changed', () => {
    render(<SettingsPage />);
    const nameInput = screen.getByDisplayValue('Acme Ltda.');
    fireEvent.change(nameInput, { target: { value: 'Acme Updated Ltda.' } });
    const saveButton = screen.getByText('Save');
    expect(saveButton).not.toBeDisabled();
  });

  it('disables save button when name is empty', () => {
    render(<SettingsPage />);
    const nameInput = screen.getByDisplayValue('Acme Ltda.');
    fireEvent.change(nameInput, { target: { value: '' } });
    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
  });

  // === Members Tab ===

  describe('Members Tab', () => {
    beforeEach(() => {
      setupMocks();
    });

    function renderMembersTab() {
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Members'));
    }

    it('renders member list with data', () => {
      renderMembersTab();
      expect(screen.getByText('Nelson Pereira')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('pending@acme.com')).toBeInTheDocument();
    });

    it('renders stat cards', () => {
      renderMembersTab();
      expect(screen.getByText('Total Members')).toBeInTheDocument();
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Administrators')).toBeInTheDocument();
    });

    it('shows role badges', () => {
      renderMembersTab();
      // Role names appear both in table badges and filter options, use getAllByText
      expect(screen.getAllByText('Administrator').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Finance').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Employee').length).toBeGreaterThanOrEqual(1);
    });

    it('shows status badges', () => {
      renderMembersTab();
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    });

    it('shows invite member button', () => {
      renderMembersTab();
      expect(screen.getByText('Invite member')).toBeInTheDocument();
    });

    it('shows filter controls', () => {
      renderMembersTab();
      expect(screen.getByPlaceholderText('Search by email or name...')).toBeInTheDocument();
      expect(screen.getByText('All roles')).toBeInTheDocument();
      expect(screen.getByText('All statuses')).toBeInTheDocument();
    });

    it('renders loading skeleton', () => {
      setupMocks({ membersLoading: true, membersData: undefined as unknown as typeof mockMembers });
      mockUseMembers.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      renderMembersTab();
      // Should show skeleton, not table rows
      expect(screen.queryByText('Nelson Pereira')).not.toBeInTheDocument();
    });

    it('shows empty state', () => {
      mockUseMembers.mockReturnValue({
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
        error: null,
      });
      renderMembersTab();
      expect(screen.getByText('No members found.')).toBeInTheDocument();
    });

    it('shows error state', () => {
      mockUseMembers.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
      });
      renderMembersTab();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // === Invite Dialog ===

    it('opens invite dialog when clicking invite button', () => {
      renderMembersTab();
      fireEvent.click(screen.getByText('Invite member'));
      expect(screen.getByText('Invite member', { selector: 'h3' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    });

    it('closes invite dialog when clicking cancel', () => {
      renderMembersTab();
      fireEvent.click(screen.getByText('Invite member'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByPlaceholderText('name@company.com')).not.toBeInTheDocument();
    });

    it('submits invite form', async () => {
      const mockInvite = jest.fn().mockResolvedValue({});
      mockUseInviteMember.mockReturnValue({
        ...defaultMutationReturn,
        mutateAsync: mockInvite,
      });
      renderMembersTab();
      fireEvent.click(screen.getByText('Invite member'));

      const emailInput = screen.getByPlaceholderText('name@company.com');
      fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });

      fireEvent.click(screen.getByText('Send invitation'));

      await waitFor(() => {
        expect(mockInvite).toHaveBeenCalledWith({
          email: 'new@acme.com',
          role: 'EMPLOYEE',
          message: undefined,
        });
      });
    });

    // === Action Menu ===

    it('shows action menu with options for active members', () => {
      renderMembersTab();
      // Click the first member's action button (Nelson - ACTIVE)
      const actionButtons = screen.getAllByLabelText('Actions');
      fireEvent.click(actionButtons[0]);
      expect(screen.getByText('Change role')).toBeInTheDocument();
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('shows resend option for pending members', () => {
      renderMembersTab();
      // Click the pending member's action button (3rd member)
      const actionButtons = screen.getAllByLabelText('Actions');
      fireEvent.click(actionButtons[2]);
      expect(screen.getByText('Resend invitation')).toBeInTheDocument();
    });

    // === Change Role Dialog ===

    it('opens change role dialog', () => {
      renderMembersTab();
      const actionButtons = screen.getAllByLabelText('Actions');
      fireEvent.click(actionButtons[1]); // Maria Santos (FINANCE, ACTIVE)
      fireEvent.click(screen.getByText('Change role'));
      expect(screen.getByText('Change role', { selector: 'h3' })).toBeInTheDocument();
    });

    it('submits role change', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({});
      mockUseUpdateMember.mockReturnValue({
        ...defaultMutationReturn,
        mutateAsync: mockUpdate,
      });
      renderMembersTab();
      const actionButtons = screen.getAllByLabelText('Actions');
      fireEvent.click(actionButtons[1]); // Maria Santos
      fireEvent.click(screen.getByText('Change role'));

      // Change role to LEGAL
      const roleSelect = screen.getByLabelText('New role');
      fireEvent.change(roleSelect, { target: { value: 'LEGAL' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          memberId: 'm2',
          data: { role: 'LEGAL' },
        });
      });
    });

    // === Remove Dialog ===

    it('opens remove dialog', () => {
      renderMembersTab();
      const actionButtons = screen.getAllByLabelText('Actions');
      fireEvent.click(actionButtons[0]); // Nelson Pereira
      fireEvent.click(screen.getByText('Remove'));
      expect(screen.getByText('Remove member')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove Nelson Pereira/)).toBeInTheDocument();
    });

    it('submits member removal', async () => {
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      mockUseRemoveMember.mockReturnValue({
        ...defaultMutationReturn,
        mutateAsync: mockRemove,
      });
      renderMembersTab();
      const actionButtons = screen.getAllByLabelText('Actions');
      fireEvent.click(actionButtons[0]); // Nelson
      fireEvent.click(screen.getByText('Remove'));

      // Click confirm Remove in dialog
      const removeButtons = screen.getAllByText('Remove');
      const confirmButton = removeButtons[removeButtons.length - 1]; // The one in the dialog
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockRemove).toHaveBeenCalledWith('m1');
      });
    });

    // === Search and Filters ===

    it('updates search input', () => {
      renderMembersTab();
      const searchInput = screen.getByPlaceholderText('Search by email or name...');
      fireEvent.change(searchInput, { target: { value: 'nelson' } });
      expect(searchInput).toHaveValue('nelson');
    });

    it('filters by role', () => {
      renderMembersTab();
      const roleSelect = screen.getByDisplayValue('All roles');
      fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });
      expect(roleSelect).toHaveValue('ADMIN');
    });

    it('filters by status', () => {
      renderMembersTab();
      const statusSelect = screen.getByDisplayValue('All statuses');
      fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });
      expect(statusSelect).toHaveValue('ACTIVE');
    });

    // === Member Display ===

    it('shows member name and email for users with names', () => {
      renderMembersTab();
      expect(screen.getByText('Nelson Pereira')).toBeInTheDocument();
      expect(screen.getByText('admin@acme.com')).toBeInTheDocument();
    });

    it('shows email as name for pending members without user data', () => {
      renderMembersTab();
      // Pending member has no user data, should show email as the name
      const pendingEmails = screen.getAllByText('pending@acme.com');
      expect(pendingEmails.length).toBeGreaterThanOrEqual(1);
    });

    it('shows member initials in avatar', () => {
      renderMembersTab();
      expect(screen.getByText('NP')).toBeInTheDocument(); // Nelson Pereira
      expect(screen.getByText('MS')).toBeInTheDocument(); // Maria Santos
      expect(screen.getByText('P')).toBeInTheDocument(); // pending@acme.com (first letter)
    });

    it('hides action menu for REMOVED members', () => {
      const removedMember = {
        ...mockMembers[1],
        id: 'm4',
        status: 'REMOVED' as const,
        removedAt: '2026-02-10T10:00:00.000Z',
      };
      mockUseMembers.mockReturnValue({
        data: {
          data: [mockMembers[0], removedMember],
          meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
        },
        isLoading: false,
        error: null,
      });
      renderMembersTab();
      // Only 1 action button (for the active member), not for the removed one
      const actionButtons = screen.getAllByLabelText('Actions');
      expect(actionButtons.length).toBe(1);
    });
  });
});
