"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Layers, ArrowRight, ShieldCheck, Sparkles, Database, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { token, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<any[]>([]);

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
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-[#ff3c02] selection:text-white">
      <Navbar />

      <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/10 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Corporate Intelligence Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, <span className="bg-gradient-to-r from-white via-slate-100 to-[#ffba86] bg-clip-text text-transparent">{user.full_name || user.email}</span>
            </h1>
            <p className="text-xs text-[#9ca3af] mt-1">Select an active workspace to access dataset analytics, neural forecasts, and executive reports.</p>
          </div>
          
          <button 
            onClick={handleLogout} 
            className="px-5 py-2 rounded-full text-xs font-bold bg-[#14151b] hover:bg-[#1e1f28] text-slate-300 hover:text-white border border-white/15 transition-all shadow-sm"
          >
            Logout
          </button>
        </header>
        
        <main>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041]">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">Your Analytical Workspaces</h2>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
              {workspaces.length} active spaces
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws: any) => (
              <div 
                key={ws.id} 
                className="bg-[#0c0d12] border border-white/10 p-6 rounded-3xl cursor-pointer hover:border-[#ff3c02]/40 transition-all shadow-xl group hover:-translate-y-1 relative overflow-hidden"
                onClick={() => router.push(`/workspaces/${ws.id}`)}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041] font-bold text-sm">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                    {ws.role}
                  </span>
                </div>
                <h3 className="text-lg font-bold group-hover:text-[#ffba86] transition-colors text-white">{ws.name}</h3>
                <p className="text-xs text-[#9ca3af] mt-1">Enterprise Ingestion & Analytical Audits</p>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-[#fa7041] group-hover:translate-x-1 transition-transform">
                  <span>Manage Datasets</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
            {workspaces.length === 0 && (
              <div className="col-span-full p-12 text-center bg-[#0c0d12] border border-white/10 rounded-3xl text-sm text-[#9ca3af]">
                <Database className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-white">No workspaces found</p>
                <p className="text-xs text-[#9ca3af] mt-1">Create or join a workspace to begin ingesting datasets.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
