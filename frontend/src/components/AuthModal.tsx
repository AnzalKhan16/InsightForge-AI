"use client";

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { X, Lock, Mail, Sparkles, User, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, initialMode = 'login', onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await apiFetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName || 'Executive User',
          }),
        });
      }

      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);

      const loginRes = await apiFetch<{ access_token: string }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      const userRes = await apiFetch<{ id: string; email: string; full_name?: string }>('/auth/me', {
        headers: { Authorization: `Bearer ${loginRes.access_token}` },
      });

      setAuth(loginRes.access_token, userRes);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Invalid credentials' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append('username', 'demo@insightforge.ai');
      form.append('password', 'password123');

      const loginRes = await apiFetch<{ access_token: string }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      const userRes = await apiFetch<{ id: string; email: string; full_name?: string }>('/auth/me', {
        headers: { Authorization: `Bearer ${loginRes.access_token}` },
      });

      setAuth(loginRes.access_token, userRes);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0c0d12] border border-white/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] p-6 md:p-8 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ff3c02]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#fa7041]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff3c02] to-[#fa7041] flex items-center justify-center font-bold text-white shadow-md shadow-[#ff3c02]/30 text-xs">
              IF
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {mode === 'login' ? 'Sign in to InsightForge' : 'Create an Account'}
              </h3>
              <p className="text-xs text-[#9ca3af]">AI-Powered Business Intelligence</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Click Demo Button */}
        <div className="mb-5 relative z-10">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold bg-[#171821] hover:bg-[#20222e] text-[#ffba86] border border-[#ff3c02]/30 shadow-md shadow-black/40 transition-all active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#fa7041]" />
            1-Click Demo Login (Preloaded Data)
          </button>
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-white/10 w-full" />
            <span className="bg-[#0c0d12] px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Or with credentials
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 relative z-10">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#060709] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02] transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#060709] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02] transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#060709] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02] transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 mt-2 rounded-full text-xs font-bold bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-lg shadow-[#ff3c02]/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">Authenticating...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="mt-5 text-center text-xs text-slate-400 relative z-10">
          {mode === 'login' ? (
            <span>
              Don&apos;t have an account?{' '}
              <button 
                onClick={() => { setMode('register'); setError(''); }} 
                className="text-[#fa7041] hover:text-[#ffba86] font-semibold underline underline-offset-2 ml-1"
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button 
                onClick={() => { setMode('login'); setError(''); }} 
                className="text-[#fa7041] hover:text-[#ffba86] font-semibold underline underline-offset-2 ml-1"
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
