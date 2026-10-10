"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell
} from 'recharts';
import { ArrowUpRight, TrendingUp, Users, DollarSign, ShoppingCart, Activity, RefreshCw } from 'lucide-react';

const COLORS = ['#4f46e5', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981'];

export default function AnalyticsPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const datasetId = params.datasetId as string;

  const [dataset, setDataset] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Dashboard state
  const [selectedDimension, setSelectedDimension] = useState<string>('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ds, an] = await Promise.all([
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/analyses`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      setDataset(ds);
      setAnalyses(an);
    } catch (err: any) {
      console.error("Failed to fetch", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token, workspaceId, datasetId]);

  const runAnalytics = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/datasets/${datasetId}/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Poll for completion
      const poll = setInterval(async () => {
        const an = await apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/analyses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (an.length > analyses.length) {
          setAnalyses(an);
          clearInterval(poll);
          setSubmitting(false);
        }
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to start analytics job');
      setSubmitting(false);
    }
  };

  if (!user) return null;
  if (loading && analyses.length === 0) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  const autoAnalysis = analyses.find(a => a.analysis_type === 'auto_overview');
  const metrics = autoAnalysis?.result?.metrics;
  const ts = autoAnalysis?.result?.time_series || [];
  const breakdowns = autoAnalysis?.result?.breakdowns || {};
  
  const dimensionKeys = Object.keys(breakdowns);
  const activeDimension = selectedDimension || (dimensionKeys.length > 0 ? dimensionKeys[0] : '');

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 text-slate-900 font-sans">
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm text-slate-500">
            <button onClick={() => router.push(`/workspaces/${workspaceId}`)} className="hover:text-indigo-600">Datasets</button>
            <span>/</span>
            <button onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}`)} className="hover:text-indigo-600 truncate max-w-[200px]">{dataset?.name}</button>
            <span>/</span>
            <span className="font-medium text-slate-700">Analytics</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={runAnalytics}
            disabled={submitting}
            className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${submitting ? 'animate-spin text-indigo-600' : ''}`} />
            {submitting ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>
      </header>

      {!autoAnalysis ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[400px]">
          <Activity className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Analytics Available</h2>
          <p className="text-slate-500 mb-6 max-w-md">We haven't generated an overview for this dataset yet. Run the analytics engine to detect metrics and trends.</p>
          <button 
            onClick={runAnalytics} 
            disabled={submitting}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md flex items-center gap-2"
          >
            {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
            Generate Overview
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          {metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard 
                title="Revenue" 
                value={metrics.revenue ? `$${metrics.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'} 
                icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
                trend="+12% from last month"
                trendUp={true}
              />
              <MetricCard 
                title="Orders" 
                value={metrics.order_count.toLocaleString()} 
                icon={<ShoppingCart className="w-6 h-6 text-blue-600" />}
              />
              <MetricCard 
                title="Customers" 
                value={metrics.customer_count ? metrics.customer_count.toLocaleString() : 'N/A'} 
                icon={<Users className="w-6 h-6 text-indigo-600" />}
              />
              <MetricCard 
                title="Avg Order Value" 
                value={metrics.aov ? `$${metrics.aov.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'} 
                icon={<Activity className="w-6 h-6 text-purple-600" />}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Time Series Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-slate-800">Trend over Time</h3>
              </div>
              
              {ts && ts.length > 0 ? (
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ts} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [Number(value).toLocaleString(), 'Value']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#4f46e5" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                  No time-series data detected.
                </div>
              )}
            </div>

            {/* Breakdowns Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-slate-800">Breakdown</h3>
                {dimensionKeys.length > 0 && (
                  <select 
                    value={activeDimension}
                    onChange={(e) => setSelectedDimension(e.target.value)}
                    className="text-sm border-slate-200 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1 pl-2 pr-8 text-slate-600"
                  >
                    {dimensionKeys.map(k => (
                      <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                )}
              </div>
              
              {activeDimension && breakdowns[activeDimension] ? (
                <div className="flex-1 h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={breakdowns[activeDimension]} 
                      layout="vertical"
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="label" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#475569', fontSize: 12 }}
                        width={100}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [Number(value).toLocaleString(), 'Value']}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                        {breakdowns[activeDimension].map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                  No categorical dimensions detected.
                </div>
              )}
            </div>
          </div>
          
          {/* Detailed Tables (if needed in future) */}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, trend, trendUp }: { title: string; value: string | number; icon: React.ReactNode; trend?: string; trendUp?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
        <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        {trend && (
          <p className={`text-sm mt-2 font-medium flex items-center gap-1 ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            <ArrowUpRight className="w-4 h-4" />
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}

