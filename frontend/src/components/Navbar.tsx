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
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between text-slate-100">
        {/* Brand & Left Navigation */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform text-xs">
              IF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm md:text-base tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                  InsightForge AI
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Deterministic Analytics & Strategic AI</p>
            </div>
          </button>

          {/* Quick Links */}
          <div className="hidden lg:flex items-center gap-1 border-l border-slate-800 pl-6 text-xs font-semibold text-slate-400">
            <button
              onClick={() => router.push('/')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/' ? 'text-white bg-slate-800' : 'hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Dashboard Hub
            </button>
            {workspaceId && datasetId && (
              <button
                onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}/analytics`)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  pathname.includes('/analytics') ? 'text-white bg-slate-800' : 'hover:text-white hover:bg-slate-800/50'
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
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300 font-medium truncate max-w-[150px]">
                  {user.email}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
                title="Sign out of session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            /* Not logged in: Clean Sign In & Sign Up buttons at top right */
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenAuth('login')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all hover:border-slate-600 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-400" />
                Sign In
              </button>

              <button
                onClick={() => handleOpenAuth('register')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-98"
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
