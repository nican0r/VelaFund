import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateShareholderPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const keys: Record<string, Record<string, string>> = {
      shareholders: {
        title: 'Shareholders',
        createTitle: 'Add Shareholder',
        createDescription: 'Register a new shareholder with identification, contact, and compliance information.',
        empty: 'No shareholders found.',
        'success.created': 'Shareholder added successfully',
        'type.founder': 'Founder',
        'type.investor': 'Investor',
        'type.employee': 'Employee',
        'type.advisor': 'Advisor',
        'type.corporate': 'Corporate',
        'form.sectionType': 'Shareholder Type',
        'form.sectionIdentity': 'Identification',
        'form.sectionContact': 'Contact Information',
        'form.sectionAddress': 'Address',
        'form.sectionCompliance': 'Tax & Compliance',
        'form.name': 'Full name',
        'form.namePlaceholder': 'e.g. João da Silva',
        'form.cpf': 'CPF',
        'form.cpfPlaceholder': '000.000.000-00',
        'form.cnpj': 'CNPJ',
        'form.cnpjPlaceholder': '00.000.000/0000-00',
        'form.email': 'Email',
        'form.emailPlaceholder': 'name@company.com',
        'form.phone': 'Phone',
        'form.phonePlaceholder': 'e.g. +55 11 98765-4321',
        'form.nationality': 'Nationality',
        'form.taxResidency': 'Tax Residency',
        'form.foreignWarning': 'Foreign shareholder detected. RDE-IED registration recommended.',
        'form.rdeIedNumber': 'RDE-IED Number',
        'form.rdeIedNumberPlaceholder': 'Registration number',
        'form.rdeIedDate': 'RDE-IED Date',
        'form.corporateNote': 'Beneficial owners can be added after registering the corporate shareholder.',
        'form.addressStreet': 'Street Address',
        'form.addressStreetPlaceholder': 'e.g. Av. Paulista, 1000',
        'form.addressCity': 'City',
        'form.addressCityPlaceholder': 'e.g. São Paulo',
        'form.addressState': 'State',
        'form.addressStatePlaceholder': 'e.g. SP',
        'form.addressCountry': 'Country',
        'form.addressPostalCode': 'Postal Code',
        'form.addressPostalCodePlaceholder': 'e.g. 01310-100',
        'form.typeFounderDescription': 'Company co-founder.',
        'form.typeInvestorDescription': 'Individual investor (angel, VC, etc.).',
        'form.typeEmployeeDescription': 'Employee with equity participation.',
        'form.typeAdvisorDescription': 'Advisor or board consultant.',
        'form.typeCorporateDescription': 'Legal entity, investment fund, or corporate entity.',
        'form.errorCorporateNeedsCnpj': 'Corporate shareholders must provide a CNPJ (14 digits)',
        'form.errorIndividualNeedsCpf': 'Individual shareholders must provide a CPF (11 digits)',
        'form.errorInvalidCpf': 'Invalid CPF (incorrect check digits)',
        'form.errorInvalidCnpj': 'Invalid CNPJ (incorrect check digits)',
      },
      common: {
        cancel: 'Cancel',
        save: 'Save',
      },
      '': {
        'errors.val.required': 'This field is required',
        'errors.val.minLength': 'Text is too short',
        'errors.val.maxLength': 'Exceeds maximum length',
        'errors.val.invalidEmail': 'Invalid email format',
        'errors.val.invalidFormat': 'Invalid format',
        'shareholders.form.errorCorporateNeedsCnpj': 'Corporate shareholders must provide a CNPJ (14 digits)',
        'shareholders.form.errorIndividualNeedsCpf': 'Individual shareholders must provide a CPF (11 digits)',
        'shareholders.form.errorInvalidCpf': 'Invalid CPF (incorrect check digits)',
        'shareholders.form.errorInvalidCnpj': 'Invalid CNPJ (incorrect check digits)',
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
const mockUseCreateShareholder = jest.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));

jest.mock('@/hooks/use-shareholders', () => ({
  useCreateShareholder: (...args: unknown[]) => mockUseCreateShareholder(...args),
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

function setup(company = defaultCompany) {
  mockUseCompany.mockReturnValue({
    companies: [company],
    selectedCompany: company,
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
  });
}

// Valid CPF: 529.982.247-25 (passes Modulo 11)
const VALID_CPF = '529.982.247-25';
const VALID_CPF_DIGITS = '52998224725';

// Valid CNPJ: 11.222.333/0001-81 (passes Modulo 11)
const VALID_CNPJ = '11.222.333/0001-81';
const VALID_CNPJ_DIGITS = '11222333000181';

// --- Tests ---

describe('CreateShareholderPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: 'new-sh', name: 'Test' });
    // Reset to default (clearAllMocks doesn't reset mockReturnValue)
    mockUseCreateShareholder.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  describe('Rendering', () => {
    it('renders page title and description', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('Add Shareholder')).toBeInTheDocument();
      expect(screen.getByText('Register a new shareholder with identification, contact, and compliance information.')).toBeInTheDocument();
    });

    it('renders back link to shareholders list', () => {
      setup();
      render(<CreateShareholderPage />);
      const backLink = screen.getByText('Shareholders');
      expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/shareholders');
    });

    it('renders empty state when no company selected', () => {
      mockUseCompany.mockReturnValue({
        companies: [],
        selectedCompany: null,
        setSelectedCompanyId: jest.fn(),
        isLoading: false,
        error: null,
      });
      render(<CreateShareholderPage />);
      expect(screen.getByText('No shareholders found.')).toBeInTheDocument();
    });

    it('renders cancel and save buttons', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders cancel button linking to shareholders list', () => {
      setup();
      render(<CreateShareholderPage />);
      const cancelLink = screen.getByText('Cancel');
      expect(cancelLink.closest('a')).toHaveAttribute('href', '/dashboard/shareholders');
    });
  });

  describe('Type selection', () => {
    it('renders all 5 shareholder type cards', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByTestId('type-card-FOUNDER')).toBeInTheDocument();
      expect(screen.getByTestId('type-card-INVESTOR')).toBeInTheDocument();
      expect(screen.getByTestId('type-card-EMPLOYEE')).toBeInTheDocument();
      expect(screen.getByTestId('type-card-ADVISOR')).toBeInTheDocument();
      expect(screen.getByTestId('type-card-CORPORATE')).toBeInTheDocument();
    });

    it('selects FOUNDER by default', () => {
      setup();
      render(<CreateShareholderPage />);
      const founderCard = screen.getByTestId('type-card-FOUNDER');
      expect(founderCard.className).toContain('border-ocean-600');
    });

    it('highlights selected type card and deselects others', () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-INVESTOR'));
      expect(screen.getByTestId('type-card-INVESTOR').className).toContain('border-ocean-600');
      expect(screen.getByTestId('type-card-FOUNDER').className).not.toContain('border-ocean-600');
    });

    it('shows CPF label for individual types', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('CPF')).toBeInTheDocument();
    });

    it('shows CNPJ label when CORPORATE is selected', () => {
      setup();
      render(<CreateShareholderPage />);
      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));
      expect(screen.getByText('CNPJ')).toBeInTheDocument();
    });

    it('clears document field when type changes', () => {
      setup();
      render(<CreateShareholderPage />);

      // Type a CPF
      const docInput = screen.getByTestId('input-cpfCnpj');
      fireEvent.change(docInput, { target: { value: '123.456.789-01' } });
      expect(docInput).toHaveValue('123.456.789-01');

      // Switch to CORPORATE
      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));
      expect(screen.getByTestId('input-cpfCnpj')).toHaveValue('');
    });

    it('shows corporate note when CORPORATE is selected', () => {
      setup();
      render(<CreateShareholderPage />);
      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));
      expect(screen.getByText('Beneficial owners can be added after registering the corporate shareholder.')).toBeInTheDocument();
    });

    it('shows type descriptions', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('Company co-founder.')).toBeInTheDocument();
      expect(screen.getByText('Individual investor (angel, VC, etc.).')).toBeInTheDocument();
    });
  });

  describe('Form sections', () => {
    it('renders all form sections', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('Shareholder Type')).toBeInTheDocument();
      expect(screen.getByText('Identification')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Tax & Compliance')).toBeInTheDocument();
    });

    it('renders identity fields', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('Full name')).toBeInTheDocument();
      expect(screen.getByText('CPF')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders contact fields', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('renders compliance fields', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.getByText('Nationality')).toBeInTheDocument();
      expect(screen.getByText('Tax Residency')).toBeInTheDocument();
    });
  });

  describe('CPF/CNPJ formatting', () => {
    it('formats CPF input as user types', () => {
      setup();
      render(<CreateShareholderPage />);

      const docInput = screen.getByTestId('input-cpfCnpj');
      fireEvent.change(docInput, { target: { value: '52998224725' } });
      expect(docInput).toHaveValue('529.982.247-25');
    });

    it('formats CNPJ input when CORPORATE is selected', () => {
      setup();
      render(<CreateShareholderPage />);
      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));

      const docInput = screen.getByTestId('input-cpfCnpj');
      fireEvent.change(docInput, { target: { value: '11222333000181' } });
      expect(docInput).toHaveValue('11.222.333/0001-81');
    });

    it('strips non-digit characters from input', () => {
      setup();
      render(<CreateShareholderPage />);

      const docInput = screen.getByTestId('input-cpfCnpj');
      fireEvent.change(docInput, { target: { value: 'abc529def982ghi247jkl25' } });
      expect(docInput).toHaveValue('529.982.247-25');
    });
  });

  describe('CPF/CNPJ validation', () => {
    it('validates CPF checksum and shows error for invalid CPF', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'João da Silva' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: '123.456.789-00' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid CPF (incorrect check digits)')).toBeInTheDocument();
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('accepts valid CPF', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'João da Silva' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: VALID_CPF_DIGITS } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
    });

    it('shows error when individual provides wrong-length document', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: '12345' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Individual shareholders must provide a CPF (11 digits)')).toBeInTheDocument();
      });
    });

    it('shows error when CORPORATE provides wrong-length document', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Corp Inc' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: '12345' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Corporate shareholders must provide a CNPJ (14 digits)')).toBeInTheDocument();
      });
    });

    it('validates CNPJ checksum for CORPORATE type', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Corp Inc' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: '11222333000199' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid CNPJ (incorrect check digits)')).toBeInTheDocument();
      });
    });

    it('accepts valid CNPJ for CORPORATE type', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Corp Inc' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: VALID_CNPJ_DIGITS } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
    });

    it('rejects all-same-digit CPF', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: '11111111111' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid CPF (incorrect check digits)')).toBeInTheDocument();
      });
    });

    it('allows submission without CPF/CNPJ (optional)', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test User' } });
      // Leave cpfCnpj empty

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Foreign shareholder detection', () => {
    it('shows foreign warning when tax residency is not BR', () => {
      setup();
      render(<CreateShareholderPage />);

      const taxResidencySelect = screen.getByTestId('input-taxResidency');
      fireEvent.change(taxResidencySelect, { target: { value: 'US' } });

      expect(screen.getByText('Foreign shareholder detected. RDE-IED registration recommended.')).toBeInTheDocument();
    });

    it('shows RDE-IED fields when foreign', () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-taxResidency'), { target: { value: 'US' } });

      expect(screen.getByText('RDE-IED Number')).toBeInTheDocument();
      expect(screen.getByText('RDE-IED Date')).toBeInTheDocument();
    });

    it('hides RDE-IED fields when tax residency is BR', () => {
      setup();
      render(<CreateShareholderPage />);

      // Default is BR — no foreign fields
      expect(screen.queryByText('RDE-IED Number')).not.toBeInTheDocument();
    });

    it('hides foreign warning when tax residency is changed back to BR', () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-taxResidency'), { target: { value: 'US' } });
      expect(screen.getByText('Foreign shareholder detected. RDE-IED registration recommended.')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('input-taxResidency'), { target: { value: 'BR' } });
      expect(screen.queryByText('Foreign shareholder detected. RDE-IED registration recommended.')).not.toBeInTheDocument();
    });
  });

  describe('Address section', () => {
    it('hides address fields by default', () => {
      setup();
      render(<CreateShareholderPage />);
      expect(screen.queryByTestId('input-addressStreet')).not.toBeInTheDocument();
    });

    it('shows address fields when toggle is clicked', () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('toggle-address'));

      expect(screen.getByTestId('input-addressStreet')).toBeInTheDocument();
      expect(screen.getByTestId('input-addressCity')).toBeInTheDocument();
      expect(screen.getByTestId('input-addressState')).toBeInTheDocument();
      expect(screen.getByTestId('input-addressCountry')).toBeInTheDocument();
      expect(screen.getByTestId('input-addressPostalCode')).toBeInTheDocument();
    });

    it('hides address fields when toggle is clicked again', () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('toggle-address'));
      expect(screen.getByTestId('input-addressStreet')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('toggle-address'));
      expect(screen.queryByTestId('input-addressStreet')).not.toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('shows error when name is empty', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('This field is required')).toBeInTheDocument();
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('shows error when name is too short', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'A' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Text is too short')).toBeInTheDocument();
      });
    });

    it('shows error for invalid email format', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test User' } });
      fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'not-an-email' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      });
    });

    it('validates address fields when partially filled', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test User' } });

      // Open address and fill only street
      fireEvent.click(screen.getByTestId('toggle-address'));
      fireEvent.change(screen.getByTestId('input-addressStreet'), { target: { value: 'Av. Paulista' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        // City and State should show required errors
        const errors = screen.getAllByText('This field is required');
        expect(errors.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('clears field error when user types after validation', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('This field is required')).toBeInTheDocument();
      });

      // Start typing in name field
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test' } });
      expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('submits FOUNDER form with minimum required fields', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'João da Silva' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: VALID_CPF_DIGITS } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          name: 'João da Silva',
          type: 'FOUNDER',
          cpfCnpj: VALID_CPF,
          nationality: 'BR',
          taxResidency: 'BR',
        });
      });
    });

    it('submits CORPORATE form with CNPJ', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-CORPORATE'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Acme Investimentos' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: VALID_CNPJ_DIGITS } });
      fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'contato@acme.com.br' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          name: 'Acme Investimentos',
          type: 'CORPORATE',
          cpfCnpj: VALID_CNPJ,
          email: 'contato@acme.com.br',
          nationality: 'BR',
          taxResidency: 'BR',
        });
      });
    });

    it('submits form with all optional fields', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-INVESTOR'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Jane Smith' } });
      fireEvent.change(screen.getByTestId('input-cpfCnpj'), { target: { value: VALID_CPF_DIGITS } });
      fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'jane@example.com' } });
      fireEvent.change(screen.getByTestId('input-phone'), { target: { value: '+1 555 123 4567' } });

      // Change nationality and tax residency to US
      fireEvent.change(screen.getByTestId('input-nationality'), { target: { value: 'US' } });
      fireEvent.change(screen.getByTestId('input-taxResidency'), { target: { value: 'US' } });

      // Fill RDE-IED fields (shown because foreign)
      fireEvent.change(screen.getByTestId('input-rdeIedNumber'), { target: { value: 'RDE-12345' } });
      fireEvent.change(screen.getByTestId('input-rdeIedDate'), { target: { value: '2026-01-15' } });

      // Open and fill address
      fireEvent.click(screen.getByTestId('toggle-address'));
      fireEvent.change(screen.getByTestId('input-addressStreet'), { target: { value: '123 Main St' } });
      fireEvent.change(screen.getByTestId('input-addressCity'), { target: { value: 'New York' } });
      fireEvent.change(screen.getByTestId('input-addressState'), { target: { value: 'NY' } });
      fireEvent.change(screen.getByTestId('input-addressCountry'), { target: { value: 'US' } });
      fireEvent.change(screen.getByTestId('input-addressPostalCode'), { target: { value: '10001' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          name: 'Jane Smith',
          type: 'INVESTOR',
          cpfCnpj: VALID_CPF,
          email: 'jane@example.com',
          phone: '+1 555 123 4567',
          nationality: 'US',
          taxResidency: 'US',
          rdeIedNumber: 'RDE-12345',
          rdeIedDate: '2026-01-15',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            country: 'US',
            postalCode: '10001',
          },
        });
      });
    });

    it('does not include empty optional fields in payload', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        const payload = mockMutateAsync.mock.calls[0][0];
        expect(payload).not.toHaveProperty('cpfCnpj');
        expect(payload).not.toHaveProperty('email');
        expect(payload).not.toHaveProperty('phone');
        expect(payload).not.toHaveProperty('address');
        expect(payload).not.toHaveProperty('rdeIedNumber');
        expect(payload).not.toHaveProperty('rdeIedDate');
      });
    });

    it('shows success toast and navigates on successful creation', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test User' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Shareholder added successfully');
        expect(mockPush).toHaveBeenCalledWith('/dashboard/shareholders');
      });
    });

    it('shows error toast on API error', async () => {
      const apiError = new Error('API Error');
      mockMutateAsync.mockRejectedValueOnce(apiError);
      setup();
      render(<CreateShareholderPage />);

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
      });
    });

    it('disables submit button while pending', () => {
      mockUseCreateShareholder.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      });
      setup();
      render(<CreateShareholderPage />);

      const submitBtn = screen.getByTestId('submit-button');
      expect(submitBtn).toBeDisabled();
      expect(submitBtn.textContent).toBe('...');
    });
  });

  describe('INVESTOR type', () => {
    it('can select INVESTOR type and submit', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-INVESTOR'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Investidor Anjo' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'INVESTOR' }),
        );
      });
    });
  });

  describe('EMPLOYEE type', () => {
    it('can select EMPLOYEE type and submit', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-EMPLOYEE'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Maria Santos' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'EMPLOYEE' }),
        );
      });
    });
  });

  describe('ADVISOR type', () => {
    it('can select ADVISOR type and submit', async () => {
      setup();
      render(<CreateShareholderPage />);

      fireEvent.click(screen.getByTestId('type-card-ADVISOR'));
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Dr. Consultor' } });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'ADVISOR' }),
        );
      });
    });
  });
});
