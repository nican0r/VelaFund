import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OwnershipChart } from './ownership-chart';
import type { CapTableEntry } from '@/types/company';

// Mock Recharts to avoid rendering issues in jsdom
jest.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

function makeEntry(overrides: Partial<CapTableEntry> = {}): CapTableEntry {
  return {
    shareholderId: 'sh-1',
    shareholderName: 'João Silva',
    shareholderType: 'FOUNDER',
    shareClassId: 'sc-1',
    shareClassName: 'ON',
    shareClassType: 'COMMON_SHARES',
    shares: '10000',
    ownershipPercentage: '50.000000',
    votingPower: '10000',
    votingPercentage: '50.000000',
    ...overrides,
  };
}

describe('OwnershipChart', () => {
  it('renders empty state when no entries', () => {
    render(<OwnershipChart entries={[]} othersLabel="Others" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders chart with entries', () => {
    const entries = [
      makeEntry({
        shareholderId: 'sh-1',
        shareholderName: 'João',
        ownershipPercentage: '60.000000',
      }),
      makeEntry({
        shareholderId: 'sh-2',
        shareholderName: 'Maria',
        ownershipPercentage: '40.000000',
      }),
    ];

    render(<OwnershipChart entries={entries} othersLabel="Outros" />);

    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('60,0%')).toBeInTheDocument();
    expect(screen.getByText('40,0%')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('aggregates entries by shareholder across share classes', () => {
    const entries = [
      makeEntry({
        shareholderId: 'sh-1',
        shareholderName: 'João',
        shareClassId: 'sc-1',
        ownershipPercentage: '30.000000',
      }),
      makeEntry({
        shareholderId: 'sh-1',
        shareholderName: 'João',
        shareClassId: 'sc-2',
        ownershipPercentage: '20.000000',
      }),
      makeEntry({
        shareholderId: 'sh-2',
        shareholderName: 'Maria',
        ownershipPercentage: '50.000000',
      }),
    ];

    render(<OwnershipChart entries={entries} othersLabel="Outros" />);

    // João should show 50% (30 + 20), Maria 50%
    const percentages = screen.getAllByText('50,0%');
    expect(percentages).toHaveLength(2);
  });

  it('groups shareholders beyond top 6 as Others', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeEntry({
        shareholderId: `sh-${i}`,
        shareholderName: `Shareholder ${i}`,
        ownershipPercentage: `${12.5}`,
      }),
    );

    render(<OwnershipChart entries={entries} othersLabel="Outros" />);

    // Should show 6 individual + "Outros"
    expect(screen.getByText('Outros')).toBeInTheDocument();
    expect(screen.getByText('Shareholder 0')).toBeInTheDocument();
    expect(screen.getByText('Shareholder 5')).toBeInTheDocument();
    // Shareholder 6 and 7 should be grouped
    expect(screen.queryByText('Shareholder 6')).not.toBeInTheDocument();
    expect(screen.queryByText('Shareholder 7')).not.toBeInTheDocument();
  });

  it('does not show Others when 7 or fewer shareholders', () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeEntry({
        shareholderId: `sh-${i}`,
        shareholderName: `Holder ${i}`,
        ownershipPercentage: `${100 / 7}`,
      }),
    );

    render(<OwnershipChart entries={entries} othersLabel="Outros" />);
    expect(screen.queryByText('Outros')).not.toBeInTheDocument();
  });
});
