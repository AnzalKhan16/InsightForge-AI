import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '@/app/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock Recharts ResponsiveContainer to avoid jsdom zero-dimension measurement warnings
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

describe('HomePage & Interactive Analytics Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders primary KPI cards with human-understandable values and indicators', () => {
    render(<HomePage />);

    expect(screen.getByText('Metaversity_Selected_Members')).toBeInTheDocument();
    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Main Department')).toBeInTheDocument();
    expect(screen.getAllByText('Technical Team').length).toBeGreaterThan(0);
    expect(screen.getByText('Details Tracked')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getByText('Data Health')).toBeInTheDocument();
    expect(screen.getByText('100% Clean')).toBeInTheDocument();
  });

  it('renders all 6 interactive dashboard navigation tabs', () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: /Visual Charts & Trends/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI Strategic Insights/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Predictive Forecasting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anomaly Audit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Customer Segmentation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Executive Briefing/i })).toBeInTheDocument();
  });

  it('switches to AI Strategic Insights tab and displays plain-English findings', () => {
    render(<HomePage />);

    const insightsTab = screen.getByRole('button', { name: /AI Strategic Insights/i });
    fireEvent.click(insightsTab);

    expect(screen.getByText(/Key Findings Explained in Plain English/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Technical Team Concentration/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Health: 100% Complete & Clean/i)).toBeInTheDocument();
    expect(screen.getByText(/7 Dedicated Non-Overlapping Slots/i)).toBeInTheDocument();
  });

  it('switches to Predictive Forecasting tab and displays interview timeline schedule', () => {
    render(<HomePage />);

    const forecastTab = screen.getByRole('button', { name: /Predictive Forecasting/i });
    fireEvent.click(forecastTab);

    expect(screen.getByText(/Candidate Interview Schedule & Timeline/i)).toBeInTheDocument();
    expect(screen.getByText('Slot 1')).toBeInTheDocument();
    expect(screen.getByText('Slot 7')).toBeInTheDocument();
    expect(screen.getByText('ABHISHEK KUMAR')).toBeInTheDocument();
  });

  it('switches to Anomaly Audit tab and displays data quality checklist', () => {
    render(<HomePage />);

    const anomaliesTab = screen.getByRole('button', { name: /Anomaly Audit/i });
    fireEvent.click(anomaliesTab);

    expect(screen.getByText(/Data Quality & Integrity Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing Data Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Duplicate Record Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Schedule Overlap Audit/i)).toBeInTheDocument();
  });

  it('switches to Customer Segmentation tab and renders cohort breakdown', () => {
    render(<HomePage />);

    const segmentsTab = screen.getByRole('button', { name: /Customer Segmentation/i });
    fireEvent.click(segmentsTab);

    expect(screen.getByText(/Departments & Cohort Groups/i)).toBeInTheDocument();
    expect(screen.getByText('Technical Department')).toBeInTheDocument();
    expect(screen.getByText(/100% Roster/i)).toBeInTheDocument();
  });

  it('switches to Executive Briefing tab and renders export buttons and records table', () => {
    render(<HomePage />);

    const reportTab = screen.getByRole('button', { name: /Executive Briefing/i });
    fireEvent.click(reportTab);

    expect(screen.getByText(/Executive Strategic Briefing Document/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download .HTML/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download .MD/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print \/ PDF/i })).toBeInTheDocument();
  });
});

