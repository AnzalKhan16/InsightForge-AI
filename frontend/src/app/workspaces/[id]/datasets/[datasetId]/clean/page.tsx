"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { 
  Sparkles, Filter, Trash2, Play, ArrowLeft, CheckCircle2, 
  Plus, Database, Columns, ChevronRight, X, AlertCircle
} from 'lucide-react';

export default function CleanDatasetPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const datasetId = params.datasetId as string;

  const [dataset, setDataset] = useState<any>(null);
  const [operations, setOperations] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Available operations
  const availableOps = [
    { value: 'drop_duplicates', label: 'Drop Duplicates' },
    { value: 'drop_na', label: 'Drop Missing Values (NA)' },
    { value: 'fill_na', label: 'Fill Missing Values' },
    { value: 'trim_whitespace', label: 'Trim Whitespace' },
    { value: 'convert_type', label: 'Convert Data Type' }
  ];

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

  const addOperation = (opName: string) => {
    setOperations([...operations, { op: opName, columns: [], params: {} }]);
  };

  const removeOperation = (index: number) => {
    const newOps = [...operations];
    newOps.splice(index, 1);
    setOperations(newOps);
  };

  const updateOperation = (index: number, key: string, value: any) => {
    const newOps = [...operations];
    newOps[index] = { ...newOps[index], [key]: value };
    setOperations(newOps);
  };

  const submitCleaningJob = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payloadOps = operations.map(op => ({
        op: op.op,
        columns: Array.isArray(op.columns) ? op.columns : op.columns.split(',').map((c: string) => c.trim()).filter(Boolean),
        params: op.params
      }));

      await apiFetch(`/workspaces/${workspaceId}/datasets/${datasetId}/clean`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operations: payloadOps })
      });
      router.push(`/workspaces/${workspaceId}/datasets/${datasetId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start cleaning job');
      setSubmitting(false);
    }
  };

  if (!user || !dataset) {
    return (
      <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col">
        <Navbar workspaceId={workspaceId} datasetId={datasetId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-[#9ca3af] bg-[#0c0d12] border border-white/10 px-6 py-4 rounded-2xl shadow-xl">
            <div className="w-5 h-5 rounded-full border-2 border-[#ff3c02] border-t-transparent animate-spin" />
            <span className="text-sm font-semibold">Loading Dataset...</span>
          </div>
        </div>
      </div>
    );
  }

  const metadata = dataset.versions?.[dataset.versions.length - 1]?.dataset_metadata;
  const colNames = metadata?.columns?.map((c: any) => c.name) || [];

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
              <button 
                onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}`)} 
                className="hover:text-[#fa7041] transition-colors truncate max-w-[200px]"
              >
                {dataset.name}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[#fa7041] font-semibold">Clean Pipeline</span>
            </div>
            
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">Clean Dataset: {dataset.name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Pipeline Orchestration
              </span>
            </div>
            <p className="text-xs text-[#9ca3af] mt-1">Configure sequence of data transformation and cleansing operations.</p>
          </div>

          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-1.5 bg-[#14151b] border border-white/10 text-slate-300 hover:text-white px-4 py-2 rounded-full text-xs font-medium transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cancel
          </button>
        </header>

        {error && (
          <div className="bg-[#1a0c0c] border border-rose-500/30 text-rose-300 p-4 mb-6 rounded-2xl flex items-center gap-3 text-sm shadow-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Pipeline Steps Panel */}
          <div className="lg:col-span-2">
            <div className="bg-[#0c0d12] border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl mb-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041]">
                    <Play className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Pipeline Execution Steps</h2>
                    <p className="text-xs text-[#9ca3af]">Operations will execute sequentially on the dataset.</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                  {operations.length} {operations.length === 1 ? 'step' : 'steps'}
                </span>
              </div>
              
              {operations.length === 0 && (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-[#060709] mb-6">
                  <Filter className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No operations added yet</p>
                  <p className="text-xs text-[#9ca3af] mt-1">Select an operation from the panel on the right to append it to the pipeline.</p>
                </div>
              )}

              <div className="space-y-4">
                {operations.map((op, index) => (
                  <div 
                    key={index} 
                    className="border border-white/10 rounded-2xl p-5 relative bg-[#14151b] group hover:border-[#ff3c02]/30 transition-all shadow-md"
                  >
                    <button 
                      onClick={() => removeOperation(index)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-white/5 transition-colors"
                      title="Remove Step"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-lg bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-xs font-bold text-[#fa7041]">
                        {index + 1}
                      </span>
                      <h3 className="font-bold text-sm text-white">
                        {availableOps.find(a => a.value === op.op)?.label}
                      </h3>
                    </div>
                    
                    <div className="grid gap-4 mt-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                          Target Columns (comma-separated, leave blank to apply to all)
                        </label>
                        <input 
                          type="text" 
                          value={Array.isArray(op.columns) ? op.columns.join(', ') : op.columns}
                          onChange={(e) => updateOperation(index, 'columns', e.target.value)}
                          className="w-full bg-[#060709] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02] transition-colors"
                          placeholder="e.g. age, revenue, status"
                        />
                      </div>

                      {op.op === 'fill_na' && (
                        <div>
                          <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">Fill Value</label>
                          <input 
                            type="text" 
                            value={op.params.value || ''}
                            onChange={(e) => updateOperation(index, 'params', { ...op.params, value: e.target.value })}
                            className="w-full bg-[#060709] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#ff3c02] transition-colors"
                            placeholder="e.g. 0 or Unknown"
                          />
                        </div>
                      )}
                      
                      {op.op === 'convert_type' && (
                        <div>
                          <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">Target Data Type</label>
                          <select
                            value={op.params.type || ''}
                            onChange={(e) => updateOperation(index, 'params', { ...op.params, type: e.target.value })}
                            className="w-full bg-[#060709] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#ff3c02] transition-colors"
                          >
                            <option value="">Select type...</option>
                            <option value="numeric">Numeric (Integer/Float)</option>
                            <option value="datetime">Datetime (Timestamp)</option>
                            <option value="string">String (Text)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                <button
                  onClick={submitCleaningJob}
                  disabled={operations.length === 0 || submitting}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white px-7 py-3 rounded-full font-bold text-xs shadow-lg shadow-[#ff3c02]/30 disabled:opacity-50 transition-all active:scale-98"
                >
                  <Play className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                  {submitting ? 'Executing Pipeline...' : 'Run Pipeline Transformation'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Available Operations & Schema */}
          <div>
            <div className="bg-[#0c0d12] border border-white/10 p-6 rounded-3xl shadow-2xl sticky top-24">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#fa7041]/15 border border-[#fa7041]/30 flex items-center justify-center text-[#ffba86]">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-white">Available Operations</h2>
              </div>
              <p className="text-xs text-[#9ca3af] mb-4">Click to append to your active sequence:</p>
              
              <div className="space-y-2.5">
                {availableOps.map(op => (
                  <button
                    key={op.value}
                    onClick={() => addOperation(op.value)}
                    className="w-full text-left px-4 py-3 border border-white/10 rounded-2xl bg-[#14151b] hover:bg-[#ff3c02]/15 hover:border-[#ff3c02]/40 text-slate-200 hover:text-white transition-all text-xs font-semibold flex items-center justify-between group shadow-sm"
                  >
                    <span>{op.label}</span>
                    <Plus className="w-3.5 h-3.5 text-[#fa7041] group-hover:scale-125 transition-transform" />
                  </button>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Columns className="w-4 h-4 text-[#fa7041]" />
                  <h3 className="font-bold text-white text-xs">Dataset Schema Columns</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {colNames.map((name: string) => (
                    <span 
                      key={name} 
                      className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-slate-300 font-mono text-[11px]"
                    >
                      {name}
                    </span>
                  ))}
                  {colNames.length === 0 && (
                    <span className="text-xs text-[#9ca3af] italic">No columns detected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
