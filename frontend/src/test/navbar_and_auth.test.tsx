import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import { useAuthStore } from '@/lib/auth';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
}));

describe('Navbar Component', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('renders brand name and top-right Sign In / Sign Up buttons when unauthenticated', () => {
    render(<Navbar />);

    expect(screen.getByText(/InsightForge AI/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Up/i })).toBeInTheDocument();
  });

  it('renders user profile and Sign Out button when authenticated', () => {
    useAuthStore.getState().setAuth('mock-token-123', {
      id: 'user-1',
      email: 'executive@enterprise.com',
      full_name: 'Executive User',
    });

    render(<Navbar />);

    expect(screen.getByText('executive@enterprise.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign In/i })).not.toBeInTheDocument();
  });

  it('opens AuthModal in login mode when clicking Sign In', () => {
    render(<Navbar />);

    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(signInBtn);

    expect(screen.getByText(/Sign in to InsightForge/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/name@company.com/i)).toBeInTheDocument();
  });

  it('opens AuthModal in register mode when clicking Sign Up', () => {
    render(<Navbar />);

    const signUpBtn = screen.getByRole('button', { name: /Sign Up/i });
    fireEvent.click(signUpBtn);

    expect(screen.getByText(/Create an Account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Jane Doe/i)).toBeInTheDocument();
  });
});

describe('AuthModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AuthModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders 1-Click Demo Login button', () => {
    render(
      <AuthModal isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByText(/1-Click Demo Login/i)).toBeInTheDocument();
  });

  it('switches between Sign In and Sign Up modes', () => {
    render(
      <AuthModal isOpen={true} initialMode="login" onClose={vi.fn()} />
    );

    expect(screen.getByText(/Sign in to InsightForge/i)).toBeInTheDocument();
    
    // Switch to Sign Up
    const signUpLink = screen.getByRole('button', { name: /Sign up/i });
    fireEvent.click(signUpLink);

    expect(screen.getByText(/Create an Account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Jane Doe/i)).toBeInTheDocument();
  });
});
