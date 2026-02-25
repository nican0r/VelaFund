import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateShareClassPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const keys: Record<string, Record<string, string>> = {
      shareClasses: {
        title: 'Share Classes',
        createTitle: 'Create Share Class',
        createDescription: 'Define the type, name, and rights of the new share class.',
        empty: 'No share classes found.',
        'success.created': 'Share class created successfully',
        'type.quota': 'Quotas',
        'type.commonShares': 'Common Shares',
        'type.preferredShares': 'Preferred Shares',
        'form.sectionType': 'Class Type',
        'form.sectionBasicInfo': 'Basic Information',
        'form.sectionVoting': 'Voting Rights',
        'form.sectionPreferences': 'Liquidation Preferences',
        'form.sectionRestrictions': 'Transfer Restrictions',
        'form.className': 'Class Name',
        'form.classNamePlaceholder': 'E.g., Common Shares',
        'form.totalAuthorized': 'Total Authorized',
        'form.totalAuthorizedPlaceholder': 'E.g., 1000000',
        'form.votesPerShare': 'Votes per Share',
        'form.votesPerSharePlaceholder': 'E.g., 1',
        'form.liquidationMultiple': 'Liquidation Preference Multiple',
        'form.liquidationMultiplePlaceholder': 'E.g., 1.5',
        'form.participatingRights': 'Participating Rights',
        'form.participatingRightsDescription': 'Participates in remaining profits',
        'form.preferredNote': 'Preferred shares do not have voting rights.',
        'form.rightOfFirstRefusal': 'Right of First Refusal',
        'form.rightOfFirstRefusalDescription': 'Priority in acquiring shares',
        'form.lockUpMonths': 'Lock-up Period (months)',
        'form.lockUpMonthsPlaceholder': 'E.g., 12',
        'form.tagAlong': 'Tag-along (%)',
        'form.tagAlongPlaceholder': 'E.g., 80',
        'form.typeLtdaNote': 'Ltda. companies can only have Quota share classes.',
        'form.typeQuotaDescription': 'Ownership quotas for limited liability companies.',
        'form.typeCommonDescription': 'Shares with mandatory voting rights.',
        'form.typePreferredDescription': 'Shares with liquidation preference.',
      },
      common: {
        cancel: 'Cancel',
        save: 'Save',
      },
      '': {
        'errors.val.required': 'This field is required',
        'errors.val.mustBePositive': 'Must be a valid number',
        'errors.val.maxLength': 'Exceeds maximum length',
        'errors.val.maxValue': 'Exceeds maximum value',
      },
    };

    return (key: string) => {
      const ns = namespace ?? '';
      return keys[ns]?.[key] ?? key;
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

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock sonner
const mockToastSuccess = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock company context
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// Mock hooks
const mockMutateAsync = jest.fn();
const mockUseCreateShareClass = jest.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));

jest.mock('@/hooks/use-share-classes', () => ({
  useCreateShareClass: (...args: unknown[]) => mockUseCreateShareClass(...args),
}));

// Mock error toast
const mockShowErrorToast = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => mockShowErrorToast,
}));

// --- Helpers ---

const defaultCompany = {
  id: 'company-1',
  name: 'Test Ltda.',
  entityType: 'LTDA' as const,
  cnpj: '12.345.678/0001-90',
  status: 'ACTIVE' as const,
  logoUrl: null,
  role: 'ADMIN',
  memberCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const saCompany = {
  ...defaultCompany,
  id: 'company-2',
  name: 'Test S.A.',
  entityType: 'SA_CAPITAL_FECHADO' as const,
};

function setup(company = defaultCompany) {
  mockUseCompany.mockReturnValue({
    companies: [company],
    selectedCompany: company,
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
  });
}

// --- Tests ---

describe('CreateShareClassPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: 'new-sc', className: 'Test' });
  });

  describe('Rendering', () => {
    it('renders page title and description', () => {
      setup();
      render(<CreateShareClassPage />);
      expect(screen.getByText('Create Share Class')).toBeInTheDocument();
      expect(screen.getByText('Define the type, name, and rights of the new share class.')).toBeInTheDocument();
    });

    it('renders back link to share classes list', () => {
      setup();
      render(<CreateShareClassPage />);
      const backLink = screen.getByText('Share Classes');
      expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/share-classes');
    });

    it('renders empty state when no company selected', () => {
      mockUseCompany.mockReturnValue({
        companies: [],
        selectedCompany: null,
        setSelectedCompanyId: jest.fn(),
        isLoading: false,
        error: null,
      });
      render(<CreateShareClassPage />);
      expect(screen.getByText('No share classes found.')).toBeInTheDocument();
    });

    it('renders cancel and save buttons', () => {
      setup();
      render(<CreateShareClassPage />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders cancel button linking to share classes list', () => {
      setup();
      render(<CreateShareClassPage />);
      const cancelLink = screen.getByText('Cancel');
      expect(cancelLink.closest('a')).toHaveAttribute('href', '/dashboard/share-classes');
    });
  });

  describe('LTDA company type', () => {
    it('shows only QUOTA type option for LTDA', () => {
      setup(defaultCompany);
      render(<CreateShareClassPage />);
      expect(screen.getByText('Quotas')).toBeInTheDocument();
      expect(screen.queryByText('Common Shares')).not.toBeInTheDocument();
      expect(screen.queryByText('Preferred Shares')).not.toBeInTheDocument();
    });

    it('shows LTDA note for quota-only restriction', () => {
      setup(defaultCompany);
      render(<CreateShareClassPage />);
      expect(screen.getByText('Ltda. companies can only have Quota share classes.')).toBeInTheDocument();
    });

    it('does not show liquidation preferences section for QUOTA type', () => {
      setup(defaultCompany);
      render(<CreateShareClassPage />);
      expect(screen.queryByText('Liquidation Preferences')).not.toBeInTheDocument();
    });
  });

  describe('S.A. company type', () => {
    it('shows COMMON_SHARES and PREFERRED_SHARES options for S.A.', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);
      expect(screen.getByText('Common Shares')).toBeInTheDocument();
      expect(screen.getByText('Preferred Shares')).toBeInTheDocument();
      expect(screen.queryByText('Quotas')).not.toBeInTheDocument();
    });

    it('does not show LTDA note for S.A.', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);
      expect(screen.queryByText('Ltda. companies can only have Quota share classes.')).not.toBeInTheDocument();
    });

    it('shows liquidation preferences when PREFERRED_SHARES is selected', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      // Click the Preferred Shares type card
      const preferredCard = screen.getByTestId('type-card-PREFERRED_SHARES');
      fireEvent.click(preferredCard);

      expect(screen.getByText('Liquidation Preferences')).toBeInTheDocument();
      expect(screen.getByText('Liquidation Preference Multiple')).toBeInTheDocument();
      expect(screen.getByText('Participating Rights')).toBeInTheDocument();
    });

    it('hides liquidation preferences when COMMON_SHARES is selected', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      // Default is COMMON_SHARES for S.A.
      expect(screen.queryByText('Liquidation Preferences')).not.toBeInTheDocument();
    });

    it('disables votes per share input for PREFERRED_SHARES', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      const preferredCard = screen.getByTestId('type-card-PREFERRED_SHARES');
      fireEvent.click(preferredCard);

      const votesInput = screen.getByTestId('input-votesPerShare');
      expect(votesInput).toBeDisabled();
      expect(votesInput).toHaveValue(0);
    });

    it('shows preferred note when PREFERRED_SHARES is selected', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      const preferredCard = screen.getByTestId('type-card-PREFERRED_SHARES');
      fireEvent.click(preferredCard);

      expect(screen.getByText('Preferred shares do not have voting rights.')).toBeInTheDocument();
    });
  });

  describe('Type selection', () => {
    it('highlights selected type card with ocean-600 border', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      const commonCard = screen.getByTestId('type-card-COMMON_SHARES');
      expect(commonCard.className).toContain('border-ocean-600');

      const preferredCard = screen.getByTestId('type-card-PREFERRED_SHARES');
      expect(preferredCard.className).not.toContain('border-ocean-600');
    });

    it('switches selected type on click', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      const preferredCard = screen.getByTestId('type-card-PREFERRED_SHARES');
      fireEvent.click(preferredCard);
      expect(preferredCard.className).toContain('border-ocean-600');

      const commonCard = screen.getByTestId('type-card-COMMON_SHARES');
      expect(commonCard.className).not.toContain('border-ocean-600');
    });
  });

  describe('Form validation', () => {
    it('shows error when className is empty', async () => {
      setup();
      render(<CreateShareClassPage />);

      const submitBtn = screen.getByTestId('submit-button');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        // Both className and totalAuthorized are required, so multiple errors
        expect(screen.getAllByText('This field is required').length).toBeGreaterThanOrEqual(1);
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('shows error when totalAuthorized is empty', async () => {
      setup();
      render(<CreateShareClassPage />);

      // Fill className but leave totalAuthorized empty
      const nameInput = screen.getByTestId('input-className');
      fireEvent.change(nameInput, { target: { value: 'Test Class' } });

      const submitBtn = screen.getByTestId('submit-button');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        // Only totalAuthorized should be required now
        expect(screen.getAllByText('This field is required').length).toBe(1);
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('does not submit when className exceeds max length', async () => {
      setup();
      render(<CreateShareClassPage />);

      const longName = 'A'.repeat(101);
      fireEvent.change(screen.getByTestId('input-className'), { target: { value: longName } });
      fireEvent.change(screen.getByTestId('input-totalAuthorized'), { target: { value: '1000' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Exceeds maximum length')).toBeInTheDocument();
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('clears field error when user types after validation', async () => {
      setup();
      render(<CreateShareClassPage />);

      // Trigger validation
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
      });

      // Start typing in className field - error should clear
      fireEvent.change(screen.getByTestId('input-className'), { target: { value: 'T' } });

      // className error should be gone but totalAuthorized error remains
      const errors = screen.getAllByText('This field is required');
      expect(errors.length).toBe(1);
    });
  });

  describe('Form sections', () => {
    it('renders all form sections', () => {
      setup();
      render(<CreateShareClassPage />);

      expect(screen.getByText('Class Type')).toBeInTheDocument();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Voting Rights')).toBeInTheDocument();
      expect(screen.getByText('Transfer Restrictions')).toBeInTheDocument();
    });

    it('renders basic info fields', () => {
      setup();
      render(<CreateShareClassPage />);

      expect(screen.getByText('Class Name')).toBeInTheDocument();
      expect(screen.getByText('Total Authorized')).toBeInTheDocument();
    });

    it('renders transfer restriction fields', () => {
      setup();
      render(<CreateShareClassPage />);

      expect(screen.getByText('Right of First Refusal')).toBeInTheDocument();
      expect(screen.getByText('Lock-up Period (months)')).toBeInTheDocument();
      expect(screen.getByText('Tag-along (%)')).toBeInTheDocument();
    });

    it('has right of first refusal checked by default', () => {
      setup();
      render(<CreateShareClassPage />);

      const checkbox = screen.getByTestId('input-rightOfFirstRefusal');
      expect(checkbox).toBeChecked();
    });
  });

  describe('Form submission', () => {
    it('submits QUOTA form correctly for LTDA company', async () => {
      setup(defaultCompany);
      render(<CreateShareClassPage />);

      fireEvent.change(screen.getByTestId('input-className'), { target: { value: 'Quotas Ordinárias' } });
      fireEvent.change(screen.getByTestId('input-totalAuthorized'), { target: { value: '1000000' } });
      fireEvent.change(screen.getByTestId('input-votesPerShare'), { target: { value: '1' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          className: 'Quotas Ordinárias',
          type: 'QUOTA',
          totalAuthorized: '1000000',
          votesPerShare: 1,
          liquidationPreferenceMultiple: null,
          participatingRights: false,
          rightOfFirstRefusal: true,
          lockUpPeriodMonths: null,
          tagAlongPercentage: null,
        });
      });
    });

    it('submits COMMON_SHARES form correctly for S.A. company', async () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      fireEvent.change(screen.getByTestId('input-className'), { target: { value: 'Ações Ordinárias' } });
      fireEvent.change(screen.getByTestId('input-totalAuthorized'), { target: { value: '5000000' } });
      fireEvent.change(screen.getByTestId('input-votesPerShare'), { target: { value: '1' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          className: 'Ações Ordinárias',
          type: 'COMMON_SHARES',
          totalAuthorized: '5000000',
          votesPerShare: 1,
          liquidationPreferenceMultiple: null,
          participatingRights: false,
          rightOfFirstRefusal: true,
          lockUpPeriodMonths: null,
          tagAlongPercentage: null,
        });
      });
    });

    it('submits PREFERRED_SHARES form with liquidation preferences', async () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      // Select Preferred Shares
      fireEvent.click(screen.getByTestId('type-card-PREFERRED_SHARES'));

      fireEvent.change(screen.getByTestId('input-className'), { target: { value: 'Ações Preferenciais A' } });
      fireEvent.change(screen.getByTestId('input-totalAuthorized'), { target: { value: '2000000' } });
      fireEvent.change(screen.getByTestId('input-liquidationMultiple'), { target: { value: '1.5' } });
      // Click checkbox to toggle it on (fireEvent.click works for checkboxes)
      fireEvent.click(screen.getByTestId('input-participatingRights'));

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          className: 'Ações Preferenciais A',
          type: 'PREFERRED_SHARES',
          totalAuthorized: '2000000',
          votesPerShare: 0,
          liquidationPreferenceMultiple: 1.5,
          participatingRights: true,
          rightOfFirstRefusal: true,
          lockUpPeriodMonths: null,
          tagAlongPercentage: null,
        });
      });
    });

    it('submits form with optional fields (lockUp, tagAlong)', async () => {
      setup(defaultCompany);
      render(<CreateShareClassPage />);

      fireEvent.change(screen.getByTestId('input-className'), { target: { value: 'Quotas' } });
      fireEvent.change(screen.getByTestId('input-totalAuthorized'), { target: { value: '500000' } });
      fireEvent.change(screen.getByTestId('input-lockUpMonths'), { target: { value: '12' } });
      fireEvent.change(screen.getByTestId('input-tagAlong'), { target: { value: '80' } });

      // Uncheck right of first refusal
      fireEvent.click(screen.getByTestId('input-rightOfFirstRefusal'));

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          className: 'Quotas',
          type: 'QUOTA',
          totalAuthorized: '500000',
          votesPerShare: 1,
          liquidationPreferenceMultiple: null,
          participatingRights: false,
          rightOfFirstRefusal: false,
          lockUpPeriodMonths: 12,
          tagAlongPercentage: 80,
        });
      });
    });

    it('shows success toast and navigates on successful creation', async () => {
      setup();
      render(<CreateShareClassPage />);

      fireEvent.change(screen.getByTestId('input-className'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('input-totalAuthorized'), { target: { value: '1000' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Share class created successfully');
        expect(mockPush).toHaveBeenCalledWith('/dashboard/share-classes');
      });
    });

    it('shows error toast on API error', async () => {
      const apiError = new Error('API Error');
      mockMutateAsync.mockRejectedValueOnce(apiError);
      setup();
      render(<CreateShareClassPage />);

      fireEvent.change(screen.getByTestId('input-className'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('input-totalAuthorized'), { target: { value: '1000' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
      });
    });

    it('disables submit button while pending', () => {
      mockUseCreateShareClass.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      });
      setup();
      render(<CreateShareClassPage />);

      const submitBtn = screen.getByTestId('submit-button');
      expect(submitBtn).toBeDisabled();
      expect(submitBtn.textContent).toBe('...');
    });
  });

  describe('Votes per share behavior', () => {
    it('sets default votes to 1 for QUOTA', () => {
      setup(defaultCompany);
      render(<CreateShareClassPage />);

      const votesInput = screen.getByTestId('input-votesPerShare');
      expect(votesInput).toHaveValue(1);
      expect(votesInput).not.toBeDisabled();
    });

    it('sets default votes to 1 for COMMON_SHARES', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      const votesInput = screen.getByTestId('input-votesPerShare');
      expect(votesInput).toHaveValue(1);
      expect(votesInput).not.toBeDisabled();
    });

    it('resets votes to 0 when switching to PREFERRED_SHARES', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      // Change votes for common
      fireEvent.change(screen.getByTestId('input-votesPerShare'), { target: { value: '3' } });

      // Switch to preferred
      fireEvent.click(screen.getByTestId('type-card-PREFERRED_SHARES'));

      const votesInput = screen.getByTestId('input-votesPerShare');
      expect(votesInput).toHaveValue(0);
      expect(votesInput).toBeDisabled();
    });

    it('restores votes to 1 when switching back from PREFERRED to COMMON', () => {
      setup(saCompany);
      render(<CreateShareClassPage />);

      // Switch to preferred
      fireEvent.click(screen.getByTestId('type-card-PREFERRED_SHARES'));
      expect(screen.getByTestId('input-votesPerShare')).toHaveValue(0);

      // Switch back to common
      fireEvent.click(screen.getByTestId('type-card-COMMON_SHARES'));
      expect(screen.getByTestId('input-votesPerShare')).toHaveValue(1);
      expect(screen.getByTestId('input-votesPerShare')).not.toBeDisabled();
    });
  });
});
