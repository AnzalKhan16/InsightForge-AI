"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from 'recharts';
import { 
  ArrowUpRight, TrendingUp, Users, DollarSign, ShoppingCart, Activity, RefreshCw,
  Sparkles, ShieldCheck, AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronUp,
  Layers, Filter, Database, CheckCircle2
} from 'lucide-react';

const COLORS = ['#4f46e5', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981'];

interface InsightItem {
  id: string;
  version_id: string;
  analysis_id?: string;
  source: 'ai' | 'deterministic';
  severity: 'info' | 'warning' | 'critical';
  category?: string;
  title: string;
  body: string;
  evidence?: {
    observed_facts?: string[];
    calculated_metrics?: Record<string, any>;
    evidence_context?: any;
    interpretation?: string;
    recommendations?: string[];
    [key: string]: any;
  };
  model_name?: string;
  prompt_version?: string;
  created_at: string;
}

export default function AnalyticsPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const datasetId = params.datasetId as string;

  const [dataset, setDataset] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingAnalysis, setSubmittingAnalysis] = useState(false);
  const [submittingInsights, setSubmittingInsights] = useState(false);
  
  // Tabs & filters
  const [activeTab, setActiveTab] = useState<'insights' | 'charts' | 'all'>('insights');
  const [selectedDimension, setSelectedDimension] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ds, an, ins] = await Promise.all([
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/analyses`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch<InsightItem[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      setDataset(ds);
      setAnalyses(an);
      setInsights(ins);
    } catch (err: any) {
      console.error("Failed to fetch analytics or insights", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token, workspaceId, datasetId]);

  const runAnalytics = async () => {
    setSubmittingAnalysis(true);
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
          setSubmittingAnalysis(false);
        }
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to start analytics job');
      setSubmittingAnalysis(false);
    }
  };

  const generateInsights = async () => {
    setSubmittingInsights(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/datasets/${datasetId}/insights/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Poll for completion
      const poll = setInterval(async () => {
        const [an, ins] = await Promise.all([
          apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/analyses`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          apiFetch<InsightItem[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/insights`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);
        if (ins.length > 0) {
          setAnalyses(an);
          setInsights(ins);
          clearInterval(poll);
          setSubmittingInsights(false);
        }
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to start insight generation');
      setSubmittingInsights(false);
    }
  };

  const autoAnalysis = analyses.find(a => a.analysis_type === 'auto_overview');
  const metrics = autoAnalysis?.result?.metrics;
  const ts = autoAnalysis?.result?.time_series || [];
  const breakdowns = autoAnalysis?.result?.breakdowns || {};
  
  const dimensionKeys = Object.keys(breakdowns);
  const activeDimension = selectedDimension || (dimensionKeys.length > 0 ? dimensionKeys[0] : '');

  // Filtered insights
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    insights.forEach(i => { if (i.category) cats.add(i.category); });
    return Array.from(cats);
  }, [insights]);

  const filteredInsights = useMemo(() => {
    return insights.filter(ins => {
      if (severityFilter !== 'all' && ins.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && ins.category !== categoryFilter) return false;
      return true;
    });
  }, [insights, severityFilter, categoryFilter]);

  if (!user) return null;
  if (loading && analyses.length === 0 && insights.length === 0) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-slate-500 text-sm font-medium">Loading Intelligence Engine...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 text-slate-900 font-sans">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm text-slate-500">
            <button onClick={() => router.push(`/workspaces/${workspaceId}`)} className="hover:text-indigo-600 transition-colors">Datasets</button>
            <span>/</span>
            <button onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}`)} className="hover:text-indigo-600 truncate max-w-[200px] transition-colors">{dataset?.name}</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Business Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Analytics & AI Insights</h1>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Phase 9 Grounded AI
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={generateInsights}
            disabled={submittingInsights}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-2.5 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 font-medium text-sm"
          >
            <Sparkles className={`w-4 h-4 ${submittingInsights ? 'animate-spin text-indigo-200' : 'text-indigo-200'}`} />
            {submittingInsights ? 'Synthesizing Grounded Insights...' : 'Generate AI Insights'}
          </button>
          
          <button 
            onClick={runAnalytics}
            disabled={submittingAnalysis}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${submittingAnalysis ? 'animate-spin text-indigo-600' : ''}`} />
            {submittingAnalysis ? 'Refreshing...' : 'Recalculate Metrics'}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-8 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'insights' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Executive AI Insights
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'insights' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {insights.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('charts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'charts' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            Visual KPIs & Trends
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'all' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            Complete Overview
          </button>
        </div>

        {/* Zero-hallucination trust badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Strict Deterministic Grounding (No LLM Math)</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-10">

        {/* SECTION 1: AI STRATEGIC INSIGHTS */}
        {(activeTab === 'insights' || activeTab === 'all') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Strategic Findings & Executive Interpretation
                </h2>
                <p className="text-sm text-slate-500">
                  Insights synthesized directly from verified quantitative aggregations. Mathematical calculations are strictly deterministic.
                </p>
              </div>

              {/* Filters */}
              {insights.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
                    <Filter className="w-3.5 h-3.5" /> Filter:
                  </div>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Information</option>
                  </select>

                  {availableCategories.length > 0 && (
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">All Categories</option>
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Empty State for Insights */}
            {insights.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[350px]">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No AI Business Insights Generated Yet</h3>
                <p className="text-slate-500 mb-6 max-w-lg text-sm">
                  Run the insight engine to extract verified facts, compute trends, and generate strategic recommendations anchored to analytical evidence.
                </p>
                <button 
                  onClick={generateInsights} 
                  disabled={submittingInsights}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-md flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${submittingInsights ? 'animate-spin' : ''}`} />
                  {submittingInsights ? 'Generating Grounded Insights...' : 'Synthesize First Insights'}
                </button>
              </div>
            ) : filteredInsights.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
                No insights match the selected severity and category filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredInsights.map((ins) => (
                  <InsightCard 
                    key={ins.id} 
                    insight={ins} 
                    isExpanded={expandedEvidenceId === ins.id}
                    onToggleEvidence={() => setExpandedEvidenceId(expandedEvidenceId === ins.id ? null : ins.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 2: VISUAL ANALYTICS & KPIS */}
        {(activeTab === 'charts' || activeTab === 'all') && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Quantitative Dashboards & Performance Visuals
              </h2>
              <p className="text-sm text-slate-500">
                Core statistical aggregates and dimension breakdowns powering the deterministic analytics layer.
              </p>
            </div>

            {!autoAnalysis ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[350px]">
                <Activity className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No Visual Analytics Found</h3>
                <p className="text-slate-500 mb-6 max-w-md text-sm">Execute the business analytics engine to profile key dimensions, volume trends, and transaction velocity.</p>
                <button 
                  onClick={runAnalytics} 
                  disabled={submittingAnalysis}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-md flex items-center gap-2 text-sm"
                >
                  <TrendingUp className="w-4 h-4" />
                  Run Analysis Engine
                </button>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                {metrics && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard 
                      title="Total Revenue" 
                      value={metrics.revenue !== null && metrics.revenue !== undefined ? `$${metrics.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'} 
                      icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
                      trend="Deterministic Sum"
                      trendUp={true}
                    />
                    <MetricCard 
                      title="Total Volume" 
                      value={metrics.order_count.toLocaleString()} 
                      icon={<ShoppingCart className="w-6 h-6 text-blue-600" />}
                      trend="Recorded Transactions"
                    />
                    <MetricCard 
                      title="Unique Accounts" 
                      value={metrics.customer_count ? metrics.customer_count.toLocaleString() : 'N/A'} 
                      icon={<Users className="w-6 h-6 text-indigo-600" />}
                      trend="Distinct Entities"
                    />
                    <MetricCard 
                      title="Avg Order Value" 
                      value={metrics.aov ? `$${metrics.aov.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'} 
                      icon={<Activity className="w-6 h-6 text-purple-600" />}
                      trend="Revenue / Transactions"
                    />
                  </div>
                )}

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Time Series Chart */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Trajectory Over Time</h3>
                        <p className="text-xs text-slate-500">Chronological volume aggregated across reporting dates</p>
                      </div>
                    </div>
                    
                    {ts && ts.length > 0 ? (
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={ts} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: any) => [Number(value).toLocaleString(), 'Metric Value']}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#4f46e5" 
                              strokeWidth={3}
                              dot={{ r: 4, strokeWidth: 2, fill: '#4f46e5' }}
                              activeDot={{ r: 7, strokeWidth: 0, fill: '#6366f1' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[350px] flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed text-sm">
                        No temporal/date column identified for time-series visualization.
                      </div>
                    )}
                  </div>

                  {/* Dimension Breakdowns Chart */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Segment Distribution</h3>
                        <p className="text-xs text-slate-500">Ranking by categorical share</p>
                      </div>
                      {dimensionKeys.length > 0 && (
                        <select 
                          value={activeDimension}
                          onChange={(e) => setSelectedDimension(e.target.value)}
                          className="text-xs border-slate-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1.5 pl-2.5 pr-8 text-slate-700 bg-slate-50 font-medium"
                        >
                          {dimensionKeys.map(k => (
                            <option key={k} value={k}>{k.replace(/_/g, ' ').toUpperCase()}</option>
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
                            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis 
                              type="category" 
                              dataKey="label" 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#475569', fontSize: 12 }}
                              width={90}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: any) => [Number(value).toLocaleString(), 'Value']}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                              {breakdowns[activeDimension].map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed text-sm">
                        No categorical dimensions detected.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, trendUp }: { title: string; value: string | number; icon: React.ReactNode; trend?: string; trendUp?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        {trend && (
          <p className="text-xs mt-2.5 font-medium text-slate-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}

function InsightCard({ 
  insight, 
  isExpanded, 
  onToggleEvidence 
}: { 
  insight: InsightItem; 
  isExpanded: boolean; 
  onToggleEvidence: () => void; 
}) {
  const isCritical = insight.severity === 'critical';
  const isWarning = insight.severity === 'warning';
  const isInfo = insight.severity === 'info';

  const severityBadge = () => {
    if (isCritical) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertOctagon className="w-3.5 h-3.5" /> CRITICAL RISK
        </span>
      );
    }
    if (isWarning) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" /> STRATEGIC WARNING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <Info className="w-3.5 h-3.5" /> BUSINESS OPPORTUNITY
      </span>
    );
  };

  const borderHighlight = isCritical 
    ? 'border-l-4 border-l-rose-500' 
    : isWarning 
    ? 'border-l-4 border-l-amber-500' 
    : 'border-l-4 border-l-indigo-500';

  // Parse sections if available in evidence or parse from body
  const observedFacts = insight.evidence?.observed_facts || [];
  const calculatedMetrics = insight.evidence?.calculated_metrics || {};
  const recommendations = insight.evidence?.recommendations || [];
  const interpretation = insight.evidence?.interpretation;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 ${borderHighlight} transition-all`}>
      {/* Top Meta Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {severityBadge()}
          {insight.category && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {insight.category}
            </span>
          )}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-1">
            {insight.source === 'ai' ? (
              <>
                <Sparkles className="w-3 h-3 text-indigo-500" /> AI Synthesized
              </>
            ) : (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Grounded Rules
              </>
            )}
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Model: {insight.model_name || 'deterministic-v1'}
        </div>
      </div>

      {/* Main Title */}
      <h3 className="text-xl font-bold text-slate-900 mb-6 tracking-tight leading-snug">
        {insight.title}
      </h3>

      {/* Structured 4-Part Executive Breakdown */}
      <div className="space-y-6">
        
        {/* 1. Observed Facts */}
        {observedFacts.length > 0 && (
          <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>📊</span> Observed Quantitative Facts
            </h4>
            <ul className="space-y-1.5">
              {observedFacts.map((fact, idx) => (
                <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 2. Calculated Metrics */}
        {Object.keys(calculatedMetrics).length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>📐</span> Deterministically Calculated Metrics
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(calculatedMetrics).map(([key, val]) => (
                <div key={key} className="bg-indigo-50/60 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">{key.replace(/_/g, ' ').toUpperCase()}:</span>
                  <span className="text-indigo-900 font-bold">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Strategic Interpretation */}
        {interpretation ? (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>💡</span> Strategic Business Interpretation
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed bg-white border border-slate-100 p-4 rounded-xl shadow-xs">
              {interpretation}
            </p>
          </div>
        ) : (
          /* Fallback rendering from markdown body if structured fields aren't in evidence */
          <div className="prose prose-sm text-slate-700 whitespace-pre-line leading-relaxed">
            {insight.body}
          </div>
        )}

        {/* 4. Actionable Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-50/40 to-slate-50 rounded-xl p-4 border border-indigo-100/60">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>🎯</span> Actionable Executive Recommendations
            </h4>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Traceability Accordion Button */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
        <button 
          onClick={onToggleEvidence}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <Database className="w-3.5 h-3.5" />
          {isExpanded ? 'Hide Grounded Evidence & Formulas' : 'Inspect Analytical Evidence (Traceability)'}
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="text-xs text-slate-400">
          Created {new Date(insight.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Traceability Raw JSON Evidence Drawer */}
      {isExpanded && (
        <div className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Grounded Analytical Context (Anti-Hallucination)
            </span>
            <span>Version: {insight.prompt_version || 'v1.0'}</span>
          </div>
          <pre className="text-emerald-400 leading-relaxed">
            {JSON.stringify(insight.evidence || {}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
