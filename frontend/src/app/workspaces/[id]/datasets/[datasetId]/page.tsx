"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { 
  Database, Sparkles, Filter, ArrowLeft, Table, FileText, 
  CheckCircle2, Layers, Activity, ChevronRight, Hash, Columns, Copy
} from 'lucide-react';

export default function DatasetProfilePage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const datasetId = params.datasetId as string;

  const [dataset, setDataset] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchDataset = async () => {
      try {
        const res = await apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDataset(res);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch dataset');
      }
    };

    fetchDataset();
  }, [token, workspaceId, datasetId, router]);

  if (!user) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col">
        <Navbar workspaceId={workspaceId} datasetId={datasetId} />
        <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
          <div className="p-6 bg-[#1a0c0c] border border-rose-500/30 text-rose-300 rounded-2xl shadow-xl flex items-center gap-3">
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col">
        <Navbar workspaceId={workspaceId} datasetId={datasetId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-[#9ca3af] bg-[#0c0d12] border border-white/10 px-6 py-4 rounded-2xl shadow-xl">
            <div className="w-5 h-5 rounded-full border-2 border-[#ff3c02] border-t-transparent animate-spin" />
            <span className="text-sm font-semibold">Loading Dataset Profile...</span>
          </div>
        </div>
      </div>
    );
  }

  const currentVer = dataset.versions?.[dataset.versions.length - 1];
  const metadata = currentVer?.dataset_metadata;
  const profile = metadata?.profile;

  return (
    <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col selection:bg-[#ff3c02] selection:text-white">
      <Navbar workspaceId={workspaceId} datasetId={datasetId} />
      
      <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm text-[#9ca3af]">
              <button 
                onClick={() => router.push(`/workspaces/${workspaceId}`)} 
                className="hover:text-[#fa7041] transition-colors"
              >
                Workspace Datasets
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" />
              <span className="font-semibold text-white truncate max-w-[250px]">{dataset.name}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[#fa7041] font-semibold">Schema & Profile</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">{dataset.name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
                v{currentVer?.version_number ?? 1}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-slate-300">
                {currentVer?.status ?? 'active'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}/analytics`)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white px-5 py-2.5 rounded-full font-bold text-xs shadow-lg shadow-[#ff3c02]/30 transition-all active:scale-98"
            >
              <Sparkles className="w-4 h-4" />
              Launch Analytics Suite
            </button>
            <button 
              onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}/clean`)}
              className="flex items-center gap-2 bg-[#14151b] border border-white/15 hover:border-[#ff3c02]/40 text-slate-200 hover:text-white px-5 py-2.5 rounded-full font-semibold text-xs transition-colors shadow-sm"
            >
              <Filter className="w-4 h-4 text-[#fa7041]" />
              Clean Data
            </button>
            <button 
              onClick={() => router.push(`/workspaces/${workspaceId}`)} 
              className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 px-4 py-2.5 rounded-full text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          </div>
        </header>

        {metadata ? (
          <>
            {/* Stat Cards - Cryptox Obsidian Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#0c0d12] border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-[#ff3c02]/40 transition-all shadow-xl">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Total Rows</span>
                  <div className="w-8 h-8 rounded-xl bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041]">
                    <Hash className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-white tracking-tight">
                  {metadata.row_count?.toLocaleString() ?? 0}
                </p>
                <p className="text-xs text-[#9ca3af] mt-1">Total recorded observations</p>
              </div>

              <div className="bg-[#0c0d12] border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-[#fa7041]/40 transition-all shadow-xl">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#fa7041]/10 to-transparent pointer-events-none rounded-bl-full" />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Schema Columns</span>
                  <div className="w-8 h-8 rounded-xl bg-[#fa7041]/15 border border-[#fa7041]/30 flex items-center justify-center text-[#ffba86]">
                    <Columns className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-white tracking-tight">
                  {metadata.column_count ?? 0}
                </p>
                <p className="text-xs text-[#9ca3af] mt-1">Features available for analytics</p>
              </div>

              <div className="bg-[#0c0d12] border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-[#ffba86]/40 transition-all shadow-xl">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ffba86]/10 to-transparent pointer-events-none rounded-bl-full" />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Duplicate Rows</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Copy className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-white tracking-tight">
                  {profile?.overview?.duplicate_rows ?? 0}
                </p>
                <p className="text-xs text-[#9ca3af] mt-1">Identical duplicate observations</p>
              </div>
            </div>

            {/* Columns Profiling Table */}
            <div className="bg-[#0c0d12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl mb-8">
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041]">
                    <Table className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Columns & Statistical Profiling</h2>
                </div>
                <span className="text-xs text-[#9ca3af]">
                  {metadata.columns?.length || 0} columns detected
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-[#14151b]">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#9ca3af] uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#9ca3af] uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#9ca3af] uppercase tracking-wider">Missing</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#9ca3af] uppercase tracking-wider">Unique</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#9ca3af] uppercase tracking-wider">Min / Max Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#0c0d12]">
                    {metadata.columns?.map((col: any) => {
                      const colProf = profile?.columns?.[col.name] || {};
                      const missingCount = colProf.missing ?? 0;
                      return (
                        <tr key={col.name} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap font-semibold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#ff3c02]" />
                            {col.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs">
                            <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 font-mono">
                              {col.dtype}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={missingCount > 0 ? "text-amber-400 font-semibold" : "text-slate-400"}>
                              {missingCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {colProf.unique ?? 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                            {colProf.min !== undefined && colProf.min !== null ? (
                              <span>{Number(colProf.min).toFixed(2)} &rarr; {Number(colProf.max).toFixed(2)}</span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Cleaning History */}
            {currentVer.jobs && currentVer.jobs.filter((j: any) => j.job_type === 'clean' && j.status === 'succeeded').length > 0 && (
              <div className="bg-[#0c0d12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Cleaning Pipeline History</h2>
                </div>
                <div className="p-6 space-y-4">
                  {currentVer.jobs.filter((j: any) => j.job_type === 'clean' && j.status === 'succeeded').map((job: any) => (
                    <div key={job.id} className="border border-white/10 p-5 rounded-2xl bg-[#14151b] text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Job #{job.id.substring(0, 8)}
                        </p>
                        <span className="text-xs text-[#9ca3af]">{new Date(job.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mb-3 text-xs text-slate-300">
                        Row Count Transition: <span className="font-bold text-white">{job.result?.initial_rows}</span> &rarr; <span className="font-bold text-[#fa7041]">{job.result?.final_rows}</span>
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-300 pl-4 border-l-2 border-white/10">
                        {job.result?.history?.map((h: any, i: number) => (
                          <li key={i}>
                            <span className="font-semibold text-white">{h.operation}</span>
                            {h.columns && h.columns.length > 0 && ` on columns: ${h.columns.join(', ')}`}
                            {h.params && Object.keys(h.params).length > 0 && ` (params: ${JSON.stringify(h.params)})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-[#0c0d12] border border-white/10 p-12 rounded-3xl text-center text-[#9ca3af] shadow-xl">
            <Database className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Profile Data Not Ready</h3>
            <p className="text-xs text-[#9ca3af]">Statistical profile data is being computed or unavailable for this dataset.</p>
          </div>
        )}
      </div>
    </div>
  );
}
