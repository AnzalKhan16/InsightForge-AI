"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { 
  TrendingUp, BarChart3, Database, Sparkles, Trash2, RefreshCw, 
  FileSpreadsheet, Layers, ArrowRight, CheckCircle2, Clock, 
  AlertCircle, Upload, ArrowLeft, ShieldCheck, Sparkle
} from 'lucide-react';

export default function WorkspacePage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;

  const [datasets, setDatasets] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await apiFetch<any[]>(`/workspaces/${workspaceId}/datasets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDatasets(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch datasets');
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchDatasets();

    // Auto-refresh every 3 seconds if any dataset is uploading/processing
    const interval = setInterval(() => {
      setDatasets((prevDatasets) => {
        const needsRefresh = prevDatasets.some(d => {
          const currentVer = d.versions?.[d.versions.length - 1];
          return currentVer && (currentVer.status === 'uploaded' || currentVer.status === 'processing');
        });
        if (needsRefresh) {
          fetchDatasets();
        }
        return prevDatasets;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [token, workspaceId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.split('.')[0]);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/workspaces/${workspaceId}/datasets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Upload failed');
      }
      
      await fetchDatasets();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset? All associated analytics, forecasts, and reports will be removed.')) return;
    try {
      await apiFetch(`/workspaces/${workspaceId}/datasets/${datasetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDatasets();
    } catch (err: any) {
      setError(err.message || 'Failed to delete dataset');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-[#f4f4f6] flex flex-col font-sans selection:bg-[#ff3c02] selection:text-white">
      <Navbar workspaceId={workspaceId} />

      {/* Sub-bar with Breadcrumb & Refresh */}
      <div className="border-b border-white/10 bg-[#060709] px-6 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[#9ca3af]">
          <button onClick={() => router.push('/')} className="hover:text-[#fa7041] transition-colors flex items-center gap-1 font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard Hub
          </button>
          <span>/</span>
          <span className="text-white font-semibold">Workspace Datasets</span>
        </div>

        <button
          onClick={() => fetchDatasets(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#14151b] hover:bg-[#1e1f28] text-slate-300 transition-all border border-white/10"
          title="Refresh datasets status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#fa7041]' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-200 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Zone Card */}
        <section className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Ingest & Process
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Upload New Business Dataset</h2>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Import sales ledgers, customer transactions, or inventory logs. The engine deterministically profiles columns, computes distributions, and powers the interactive analytics suite.
              </p>
            </div>

            <div className="w-full md:w-auto flex-shrink-0">
              <div className="flex flex-col items-center gap-2">
                <label className={`cursor-pointer w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold text-white shadow-lg transition-all ${
                  uploading 
                    ? 'bg-[#181920] cursor-not-allowed opacity-80' 
                    : 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] shadow-[#ff3c02]/30 active:scale-98'
                }`}>
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Ingesting File...' : 'Select CSV or Excel File'}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleUpload}
                    disabled={uploading}
                    ref={fileInputRef}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-[#9ca3af]">
                  Supported formats: CSV, XLSX, XLS (Max 50MB)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Datasets Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-[#fa7041]" />
                Available Datasets ({datasets.length})
              </h3>
              <p className="text-xs text-[#9ca3af]">
                Select any dataset to launch the interactive dashboard, view profiles, or run ML forecasting.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {datasets.map((dataset) => {
              const currentVer = dataset.versions?.[dataset.versions.length - 1];
              const isCompleted = currentVer?.status === 'completed';
              const isProcessing = currentVer?.status === 'uploaded' || currentVer?.status === 'processing';
              const isFailed = currentVer?.status === 'failed';
              const meta = currentVer?.dataset_metadata;

              return (
                <div 
                  key={dataset.id} 
                  className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all group"
                >
                  <div className="space-y-4">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10">
                            v{currentVer?.version_number || 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
                            {currentVer?.format?.toUpperCase() || 'CSV'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white truncate group-hover:text-[#ffba86] transition-colors" title={dataset.name}>
                          {dataset.name}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleDelete(dataset.id)}
                        className="text-slate-400 hover:text-rose-400 p-1.5 rounded-full hover:bg-white/5 transition-colors"
                        title="Delete dataset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Metadata & Status Badges */}
                    <div className="bg-[#060709] border border-white/10 rounded-2xl p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#9ca3af]">Processing Status</span>
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                            <Clock className="w-3 h-3" /> Processing...
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                        <div>
                          <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Rows</div>
                          <div className="font-bold text-slate-200 mt-0.5">{meta?.row_count ? meta.row_count.toLocaleString() : '—'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Columns</div>
                          <div className="font-bold text-slate-200 mt-0.5">{meta?.column_count || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#9ca3af] uppercase">File Size</div>
                          <div className="font-bold text-slate-200 mt-0.5">{currentVer?.size_bytes ? `${(currentVer.size_bytes / 1024).toFixed(1)} KB` : '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-6 space-y-2">
                    {/* PRIMARY ACTION: DIRECT TO INTERACTIVE ANALYTICS DASHBOARD */}
                    <button
                      onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${dataset.id}/analytics`)}
                      disabled={!isCompleted}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs font-bold transition-all shadow-md ${
                        isCompleted
                          ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-[#ff3c02]/30 active:scale-98 cursor-pointer'
                          : 'bg-[#14151b] text-slate-500 border border-white/10 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 text-[#ffba86]" />
                      Open Interactive Dashboard
                      <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-200" />
                    </button>

                    {/* Secondary Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${dataset.id}`)}
                        disabled={!isCompleted}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-[#14151b] hover:bg-[#1e1f28] text-slate-300 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Layers className="w-3 h-3 text-[#fa7041]" />
                        Data Profile
                      </button>

                      <button
                        onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${dataset.id}/clean`)}
                        disabled={!isCompleted}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-[#14151b] hover:bg-[#1e1f28] text-slate-300 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ShieldCheck className="w-3 h-3 text-[#ffba86]" />
                        Clean Data
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {datasets.length === 0 && !uploading && (
              <div className="col-span-full bg-[#0c0d12] border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                <Database className="w-12 h-12 text-slate-600 mb-3" />
                <h4 className="text-base font-bold text-slate-300 mb-1">No Datasets Uploaded Yet</h4>
                <p className="text-xs text-[#9ca3af] max-w-sm mb-4">
                  Upload a CSV or Excel transaction file above to automatically generate KPIs, charts, forecasts, and AI insights.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
