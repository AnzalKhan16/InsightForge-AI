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
    <main className="flex min-h-screen items-center justify-center p-24">
      <div className="z-10 w-full max-w-md bg-white text-black p-8 rounded shadow-lg">
        <h2 className="text-2xl font-bold mb-6">Login to InsightForge</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded"
            required
          />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
