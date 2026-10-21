"use client";

import { useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Sparkles, LogIn, UserPlus, LogOut, User, Database, 
  Layers, BarChart2, ShieldCheck, ChevronDown
} from 'lucide-react';
import AuthModal from './AuthModal';

interface NavbarProps {
  workspaceId?: string;
  datasetId?: string;
}

export default function Navbar({ workspaceId, datasetId }: NavbarProps) {
  const { user, token, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleSignOut = () => {
    clearAuth();
    router.push('/');
  };

  return (
    <>
      <nav className="border-b border-white/10 bg-[#060709]/85 backdrop-blur-xl sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between text-slate-100 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]">
        {/* Brand & Left Navigation */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff3c02] via-[#f45b31] to-[#fa7041] flex items-center justify-center font-bold text-white shadow-lg shadow-[#ff3c02]/30 group-hover:scale-105 transition-transform text-xs">
              IF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm md:text-base tracking-tight text-white group-hover:text-[#ffba86] transition-colors">
                  InsightForge AI
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-[#9ca3af] hidden sm:block">Deterministic Analytics & Strategic AI</p>
            </div>
          </button>

          {/* Quick Links */}
          <div className="hidden lg:flex items-center gap-1.5 border-l border-white/10 pl-6 text-xs font-semibold text-[#9ca3af]">
            <button
              onClick={() => router.push('/')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                pathname === '/' ? 'text-white bg-white/10 border border-white/15 shadow-sm' : 'hover:text-white hover:bg-white/5'
              }`}
            >
              Dashboard Hub
            </button>
            {workspaceId && datasetId && (
              <button
                onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}/analytics`)}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  pathname.includes('/analytics') ? 'text-white bg-white/10 border border-white/15 shadow-sm' : 'hover:text-white hover:bg-white/5'
                }`}
              >
                Analytics Suite
              </button>
            )}
          </div>
        </div>

        {/* Top Right: User & Authentication Buttons */}
        <div className="flex items-center gap-3">
          {token && user ? (
            /* Logged in state */
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0e0f14] border border-white/10 text-xs">
                <div className="w-5 h-5 rounded-full bg-[#ff3c02]/20 border border-[#ff3c02]/40 text-[#fa7041] flex items-center justify-center font-bold text-[10px]">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300 font-medium truncate max-w-[150px]">
                  {user.email}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#14151b] hover:bg-[#1e1f28] text-slate-300 hover:text-white border border-white/10 transition-all shadow-sm"
                title="Sign out of session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            /* Not logged in: Cryptox styled Sign In & Sign Up buttons */
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => handleOpenAuth('login')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#121318] hover:bg-[#1a1b22] text-slate-200 border border-white/15 transition-all hover:border-white/25 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 text-[#fa7041]" />
                Sign In
              </button>

              <button
                onClick={() => handleOpenAuth('register')}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-lg shadow-[#ff3c02]/30 transition-all active:scale-98"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Sign Up
              </button>
            </div>
          )}
        </div>
      </nav>

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}
