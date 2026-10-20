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

  it('renders primary KPI cards with deterministic values and growth indicators', () => {
    render(<HomePage />);

    expect(screen.getByText('Global Retail & E-Commerce 2023')).toBeInTheDocument();
    expect(screen.getByText('$77,772.70')).toBeInTheDocument();
    expect(screen.getByText(/orders/i)).toBeInTheDocument();
    expect(screen.getByText('$777.73')).toBeInTheDocument();
    expect(screen.getByText(/categories/i)).toBeInTheDocument();
    expect(screen.getByText(/annual growth trajectory/i)).toBeInTheDocument();
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

  it('switches to AI Strategic Insights tab and displays findings and facts', () => {
    render(<HomePage />);

    const insightsTab = screen.getByRole('button', { name: /AI Strategic Insights/i });
    fireEvent.click(insightsTab);

    expect(screen.getByText(/Synthesized Executive Findings/i)).toBeInTheDocument();
    expect(screen.getByText(/Topline Growth Acceleration/i)).toBeInTheDocument();
    expect(screen.getByText(/High Account Concentration/i)).toBeInTheDocument();
    expect(screen.getByText(/Healthy Unit Economics/i)).toBeInTheDocument();
  });

  it('switches to Predictive Forecasting tab and displays horizon table', () => {
    render(<HomePage />);

    const forecastTab = screen.getByRole('button', { name: /Predictive Forecasting/i });
    fireEvent.click(forecastTab);

    expect(screen.getByText(/Forward-Looking Demand Projections/i)).toBeInTheDocument();
    expect(screen.getByText(/Holt Linear Trend/i)).toBeInTheDocument();
    expect(screen.getByText('+1 Month')).toBeInTheDocument();
    expect(screen.getByText('+6 Months')).toBeInTheDocument();
  });

  it('switches to Anomaly Audit tab and displays detected deviations', () => {
    render(<HomePage />);

    const anomaliesTab = screen.getByRole('button', { name: /Anomaly Audit/i });
    fireEvent.click(anomaliesTab);

    expect(screen.getByText(/Data Integrity & Anomaly Risk Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed Invariant Violation/i)).toBeInTheDocument();
    expect(screen.getByText(/High-Value Statistical Outlier/i)).toBeInTheDocument();
  });

  it('switches to Customer Segmentation tab and renders RFM cohorts', () => {
    render(<HomePage />);

    const segmentsTab = screen.getByRole('button', { name: /Customer Segmentation/i });
    fireEvent.click(segmentsTab);

    expect(screen.getByText(/Customer RFM & Behavioral Segmentation/i)).toBeInTheDocument();
    expect(screen.getByText('Champions')).toBeInTheDocument();
    expect(screen.getByText('Loyal Customers')).toBeInTheDocument();
    expect(screen.getByText('At Risk VIPs')).toBeInTheDocument();
  });

  it('switches to Executive Briefing tab and renders export buttons', () => {
    render(<HomePage />);

    const reportTab = screen.getByRole('button', { name: /Executive Briefing/i });
    fireEvent.click(reportTab);

    expect(screen.getByText(/Executive Strategic Briefing Document/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download .HTML/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download .MD/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print \/ PDF/i })).toBeInTheDocument();
  });
});
