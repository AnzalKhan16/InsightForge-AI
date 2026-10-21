"use client";

import { useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
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
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-black relative overflow-hidden">
      {/* Background ambient radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ff3c02]/12 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 w-full max-w-md bg-[#0c0d12] border border-white/10 text-white p-8 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff3c02] to-[#fa7041] flex items-center justify-center font-bold text-white shadow-lg shadow-[#ff3c02]/30 text-sm">
            IF
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Login to InsightForge</h2>
            <p className="text-xs text-[#9ca3af]">Enter your corporate credentials</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-3 mb-5 rounded-2xl text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#060709] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#060709] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02]"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full py-2.5 px-4 mt-2 rounded-full font-bold text-xs bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-lg shadow-[#ff3c02]/30 transition-all active:scale-98"
          >
            Sign In to Platform
          </button>
        </form>
      </div>
    </main>
  );
}
