import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnalyticsPage from '@/app/workspaces/[id]/datasets/[datasetId]/analytics/page';
import { useAuthStore } from '@/lib/auth';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: '88e9b75e-944d-4031-8d00-d3d5d1541818', datasetId: '6655e6d0-8986-4d4d-a0b1-2bb30f5ceada' }),
  usePathname: () => '/workspaces/88e9b75e-944d-4031-8d00-d3d5d1541818/datasets/6655e6d0-8986-4d4d-a0b1-2bb30f5ceada/analytics',
}));

vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

describe('AnalyticsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing when user is logged in', () => {
    useAuthStore.setState({
      token: 'fake-token',
      user: { id: 'test-user', email: 'demo@insightforge.ai' },
    });

    const { container } = render(<AnalyticsPage />);
    expect(container).toBeDefined();
  });

  it('does not render a blank screen when user is null', () => {
    useAuthStore.setState({
      token: null,
      user: null,
    });

    const { container } = render(<AnalyticsPage />);
    expect(container.innerHTML).not.toBe('');
    expect(container.textContent).toContain('Loading Intelligence Suite');
  });
});
