"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { token, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchWorkspaces = async () => {
      try {
        const res = await apiFetch<any[]>('/workspaces', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWorkspaces(res);
      } catch (err) {
        console.error('Failed to fetch workspaces', err);
      }
    };

    fetchWorkspaces();
  }, [token, router]);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Welcome, {user.full_name || user.email}</h1>
        <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
          Logout
        </button>
      </header>
      
      <main>
        <h2 className="text-2xl font-semibold mb-4">Your Workspaces</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws: any) => (
            <div key={ws.id} className="bg-white p-6 rounded shadow">
              <h3 className="text-xl font-bold mb-2">{ws.name}</h3>
              <p className="text-gray-600">Role: {ws.role}</p>
            </div>
          ))}
          {workspaces.length === 0 && <p>No workspaces found.</p>}
        </div>
      </main>
    </div>
  );
}
