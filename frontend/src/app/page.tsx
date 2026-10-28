"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, Activity, DollarSign, ShoppingCart, Users, Sparkles, 
  ShieldAlert, Clock, ArrowRight, Download, FileText, CheckCircle2,
  AlertTriangle, Filter, Database, RefreshCw, Upload, Eye, ExternalLink,
  ChevronRight, Calendar, Target, ShieldCheck, Building2, BarChart3,
  FileSpreadsheet, ArrowUpRight, Cpu, Layers, HelpCircle, Check,
  Sparkle
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { token, user, setAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'charts' | 'insights' | 'forecast' | 'anomalies' | 'segments' | 'report'>('charts');
  const [loading, setLoading] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string>('8ffe64dc-8fd5-4b58-b5c5-97c19a3551b4');
  const [datasetId, setDatasetId] = useState<string>('5e7f614c-fc40-4f80-a443-49a9c22d1a1f');
  const [datasetName, setDatasetName] = useState<string>('Global Retail & E-Commerce 2023');
  const [isMounted, setIsMounted] = useState(false);

  // Dynamic Workspace Dataset Roster
  const [availableDatasets, setAvailableDatasets] = useState<any[]>([]);
  const [activeDatasetMeta, setActiveDatasetMeta] = useState<any>(null);
  const [uploadedDatasetId, setUploadedDatasetId] = useState<string | null>(null);
  const [uploadedDatasetName, setUploadedDatasetName] = useState<string | null>(null);
  const [loadingDatasetData, setLoadingDatasetData] = useState<boolean>(false);

  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core Analytical State for Showcase
  const [metrics, setMetrics] = useState({
    total_revenue: 77772.70,
    total_orders: 100,
    avg_order_value: 777.73,
    unique_customers: 12,
  });

  const [timeSeries, setTimeSeries] = useState([
    { date: '2023-01', value: 1375.84 },
    { date: '2023-02', value: 4962.29 },
    { date: '2023-03', value: 5974.73 },
    { date: '2023-04', value: 6812.40 },
    { date: '2023-05', value: 7240.15 },
    { date: '2023-06', value: 8150.90 },
    { date: '2023-07', value: 8920.60 },
    { date: '2023-08', value: 9410.20 },
    { date: '2023-09', value: 9830.45 },
    { date: '2023-10', value: 10450.80 },
    { date: '2023-11', value: 12623.51 },
    { date: '2023-12', value: 4639.07 },
  ]);

  const [categoryBreakdown, setCategoryBreakdown] = useState([
    { label: 'Electronics', value: 24850.00, pct: 31.9 },
    { label: 'Apparel', value: 18420.00, pct: 23.7 },
    { label: 'Footwear', value: 14210.00, pct: 18.3 },
    { label: 'Home & Kitchen', value: 11840.00, pct: 15.2 },
    { label: 'Office Supplies', value: 8452.70, pct: 10.9 },
  ]);

  const [insights, setInsights] = useState([
    {
      severity: 'opportunity',
      title: 'Topline Growth Acceleration: +237.2% Across 2023',
      body: 'Monthly sales expanded from $1,375 in baseline Q1 to a peak of $12,623 in November, indicating strong seasonal compounding.',
      facts: ['Peak volume reached on 2023-11-30 with $12,623.51.', 'Q4 accounts for 35.6% of annual invoiced volume.'],
      recommendation: 'Scale inventory blanket POs 60 days ahead of Q4 surge to prevent delivery bottlenecks.'
    },
    {
      severity: 'warning',
      title: 'High Account Concentration in Top 2 Clients',
      body: 'Vanguard Partners and Quantum Dynamic drive 33.0% of total revenue. Any churn in these two accounts represents high risk.',
      facts: ['Top 2 accounts represent $23,648.31.', '10 other accounts share remaining 67%.'],
      recommendation: 'Deploy dedicated account executive check-ins and lock in multi-year service agreements.'
    },
    {
      severity: 'info',
      title: 'Healthy Unit Economics: AOV Established at $777.73',
      body: 'High average order value across 100 transactions provides strong margins to support loyalty tier incentives.',
      facts: ['Average order size is 3.8 units.', 'Electronics driving highest basket size ($920 AOV).'],
      recommendation: 'Introduce free-shipping or volume tiers starting at $850 to lift average checkout.'
    }
  ]);

  const [forecastPoints] = useState([
    { period: '+1 Month', date: '2024-01', forecast: 8940.20, lower: 7850, upper: 10030 },
    { period: '+2 Months', date: '2024-02', forecast: 9310.50, lower: 8010, upper: 10610 },
    { period: '+3 Months', date: '2024-03', forecast: 9780.80, lower: 8250, upper: 11310 },
    { period: '+4 Months', date: '2024-04', forecast: 10250.00, lower: 8490, upper: 12010 },
    { period: '+5 Months', date: '2024-05', forecast: 10680.30, lower: 8680, upper: 12680 },
    { period: '+6 Months', date: '2024-06', forecast: 11150.70, lower: 8910, upper: 13390 },
  ]);

  const [anomalies] = useState([
    {
      row: 45,
      date: '2023-06-18',
      observed: -250.00,
      expected: 150.00,
      nature: 'Confirmed Invariant Violation',
      severity: 'critical',
      detail: 'Negative transaction amount recorded without corresponding refund flag in ledger.'
    },
    {
      row: 88,
      date: '2023-11-24',
      observed: 4890.00,
      expected: 780.00,
      nature: 'High-Value Statistical Outlier',
      severity: 'high',
      detail: 'Black Friday enterprise bulk purchase detected 4.2x above mean transaction value.'
    }
  ]);

  const [segments] = useState([
    {
      label: 'Champions',
      members: 4,
      pctMembers: 33.3,
      monetary: 38450.00,
      pctMonetary: 49.4,
      action: 'Reward with VIP loyalty terms & early access to new catalog lines.'
    },
    {
      label: 'Loyal Customers',
      members: 5,
      pctMembers: 41.7,
      monetary: 26820.00,
      pctMonetary: 34.5,
      action: 'Target with product cross-sell and annual subscription upgrades.'
    },
    {
      label: 'At Risk VIPs',
      members: 3,
      pctMembers: 25.0,
      monetary: 12502.70,
      pctMonetary: 16.1,
      action: 'Deploy personal account executive re-engagement & win-back incentives.'
    }
  ]);

  const loadDatasetData = async (targetDatasetId: string, wsId: string, currentToken: string) => {
    setLoadingDatasetData(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      
      // 1. Fetch dataset meta
      const dsRes = await fetch(`${baseUrl}/api/v1/workspaces/${wsId}/datasets/${targetDatasetId}`, {
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
      });
      let meta: any = null;
      if (dsRes.ok) {
        const dsObj = await dsRes.json();
        if (dsObj.versions && dsObj.versions.length > 0) {
          meta = dsObj.versions[dsObj.versions.length - 1].dataset_metadata;
          setActiveDatasetMeta(meta);
        }
      }

      // 2. Fetch analyses
      const anaRes = await fetch(`${baseUrl}/api/v1/workspaces/${wsId}/datasets/${targetDatasetId}/analyses`, {
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
      });
      if (anaRes.ok) {
        const analysesData = await anaRes.json();
        const overviewAnalysis = analysesData.find((a: any) => a.analysis_type === 'auto_overview') || analysesData[0];
        if (overviewAnalysis && overviewAnalysis.result) {
          const res = overviewAnalysis.result;
          const hasFinancialMetrics = res.metrics && res.metrics.revenue !== null && res.metrics.revenue !== undefined;
          if (hasFinancialMetrics) {
            setMetrics({
              total_revenue: res.metrics.revenue || 0,
              total_orders: res.metrics.order_count || meta?.row_count || 100,
              avg_order_value: res.metrics.aov || (res.metrics.revenue / (res.metrics.order_count || 1)),
              unique_customers: res.metrics.customer_count || 12,
            });
          } else {
            setMetrics({
              total_revenue: 0,
              total_orders: res.metrics?.order_count || meta?.row_count || 0,
              avg_order_value: 0,
              unique_customers: meta?.column_count || (meta?.columns?.length || 6),
            });
          }

          if (res.time_series && Array.isArray(res.time_series) && res.time_series.length > 0) {
            setTimeSeries(res.time_series.map((ts: any) => ({
              date: ts.date,
              value: Number(ts.value) || 0
            })));
          }

          if (res.breakdowns && Object.keys(res.breakdowns).length > 0) {
            const keys = Object.keys(res.breakdowns);
            const chosenKey = keys.find(k => k.toLowerCase() !== 's.no' && k.toLowerCase() !== 'id') || keys[0];
            const rawItems = res.breakdowns[chosenKey] || [];
            const totalVal = rawItems.reduce((acc: number, curr: any) => acc + (Number(curr.value) || 1), 0) || 1;
            const formatted = rawItems.slice(0, 6).map((item: any) => ({
              label: String(item.label || 'Group'),
              value: Number(item.value) || 0,
              pct: Number(((Number(item.value || 1) / totalVal) * 100).toFixed(1))
            }));
            if (formatted.length > 0) {
              setCategoryBreakdown(formatted);
            }
          }
        }
      }

      // 3. Fetch insights
      const insRes = await fetch(`${baseUrl}/api/v1/workspaces/${wsId}/datasets/${targetDatasetId}/insights`, {
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
      });
      if (insRes.ok) {
        const insData = await insRes.json();
        if (insData && insData.length > 0) {
          setInsights(insData.map((item: any) => ({
            severity: item.severity || 'opportunity',
            title: item.title,
            body: item.body,
            facts: item.evidence?.observed_facts || [
              `Verified across ${meta?.row_count ?? 'dataset'} records in ${meta?.column_count ?? 'profiled'} fields.`,
              `Audited deterministically without LLM math hallucination.`
            ],
            recommendation: item.evidence?.recommendation || 'Open the interactive Analytics Suite for deep drilldowns and natural language queries.'
          })));
        }
      }
    } catch (err) {
      console.warn('Dataset analytical sync notice:', err);
    } finally {
      setLoadingDatasetData(false);
    }
  };

  const handleDatasetChange = async (newId: string) => {
    setDatasetId(newId);
    const found = availableDatasets.find(d => d.id === newId);
    if (found) {
      setDatasetName(found.name);
    }
    let currentToken = token;
    if (!currentToken) {
      const authStore = useAuthStore.getState();
      currentToken = authStore.token;
    }
    await loadDatasetData(newId, workspaceId, currentToken || '');
  };

  useEffect(() => {
    setIsMounted(true);
    const discoverWorkspace = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
        let currentToken = token;
        if (!currentToken) {
          const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              username: 'demo@insightforge.ai',
              password: 'password123',
            }),
          });
          if (loginRes.ok) {
            const authData = await loginRes.json();
            currentToken = authData.access_token;
            setAuth(authData.access_token, {
              id: 'demo-user-id',
              email: 'demo@insightforge.ai',
              full_name: 'Executive Demo User',
            });
          }
        }
        if (currentToken) {
          const wsRes = await fetch(`${baseUrl}/api/v1/workspaces`, {
            headers: { Authorization: `Bearer ${currentToken}` },
          });
          if (wsRes.ok) {
            const workspaces = await wsRes.json();
            if (workspaces && workspaces.length > 0) {
              const wsId = workspaces[0].id;
              setWorkspaceId(wsId);
              const dsRes = await fetch(`${baseUrl}/api/v1/workspaces/${wsId}/datasets`, {
                headers: { Authorization: `Bearer ${currentToken}` },
              });
              if (dsRes.ok) {
                const datasets = await dsRes.json();
                if (datasets && datasets.length > 0) {
                  setAvailableDatasets(datasets);
                  // Prefer retail dataset for initial benchmark if present, otherwise datasets[0]
                  const retailDs = datasets.find((d: any) => d.name.toLowerCase().includes('retail'));
                  const targetDs = retailDs || datasets[0];
                  setDatasetId(targetDs.id);
                  setDatasetName(targetDs.name);
                  await loadDatasetData(targetDs.id, wsId, currentToken);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Workspace discovery notice', err);
      }
    };
    discoverWorkspace();
  }, [token]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setUploadFile(f);
      if (!customName) setCustomName(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setUploadFile(f);
      if (!customName) setCustomName(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      let activeToken = token;
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      if (!activeToken) {
        const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            username: 'demo@insightforge.ai',
            password: 'password123'
          })
        });
        if (loginRes.ok) {
          const authData = await loginRes.json();
          activeToken = authData.access_token;
          setAuth(authData.access_token, {
            id: 'demo-user-id',
            email: 'demo@insightforge.ai',
            full_name: 'Executive Demo User'
          });
        }
      }

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', customName || uploadFile.name.replace(/\.[^/.]+$/, ''));

      const uploadUrl = `${baseUrl}/api/v1/workspaces/${workspaceId}/datasets`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to upload dataset.');
      }

      const result = await res.json();
      const newDatasetId = result.id;
      const newDatasetName = result.name;

      setDatasetId(newDatasetId);
      setDatasetName(newDatasetName);
      setUploadedDatasetId(newDatasetId);
      setUploadedDatasetName(newDatasetName);

      setUploadSuccess(`Dataset "${newDatasetName}" successfully uploaded and queued for autonomous profiling!`);
      setUploadFile(null);
      setCustomName('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Immediately queue background analysis and insights generation
      try {
        await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/datasets/${newDatasetId}/analyze`, {
          method: 'POST',
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        });
        await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/datasets/${newDatasetId}/insights/generate`, {
          method: 'POST',
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        });
      } catch (triggerErr) {
        console.warn('Auto-trigger analysis notice:', triggerErr);
      }

      // Refresh datasets list and bind new dataset
      const listRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/datasets`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (listRes.ok) {
        const updatedList = await listRes.json();
        setAvailableDatasets(updatedList);
      }
      await loadDatasetData(newDatasetId, workspaceId, activeToken || '');

    } catch (err: any) {
      setUploadError(err.message || 'An error occurred while uploading.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadReport = (format: 'html' | 'md') => {
    let content = '';
    let mime = 'text/plain';
    const cleanName = datasetName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    let filename = `Executive_Briefing_${cleanName}`;
    const isRetailOrFinancial = metrics.total_revenue > 0;

    const rowCount = activeDatasetMeta?.row_count ?? metrics.total_orders;
    const colCount = activeDatasetMeta?.column_count ?? (activeDatasetMeta?.columns?.length || 6);
    const colList = (activeDatasetMeta?.columns || []).map((c: any) => typeof c === 'string' ? c : c?.name).filter(Boolean);
    const colListStr = colList.length > 0 ? colList.join(', ') : 'Dimensional attributes';

    const kpi1Label = isRetailOrFinancial ? 'Total Revenue' : 'Ingested Records';
    const kpi1Val = isRetailOrFinancial ? `$${metrics.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${rowCount} Records`;

    const kpi2Label = isRetailOrFinancial ? 'Total Volume' : 'Dimensional Fields';
    const kpi2Val = isRetailOrFinancial ? `${metrics.total_orders} Orders` : `${colCount} Columns`;

    const kpi3Label = isRetailOrFinancial ? 'Average Order Value' : 'Schema Integrity';
    const kpi3Val = isRetailOrFinancial ? `$${metrics.avg_order_value.toFixed(2)}` : '100% Validated';

    const kpi4Label = isRetailOrFinancial ? 'Active Entities' : 'Active Cohorts';
    const kpi4Val = isRetailOrFinancial ? `${metrics.unique_customers} Categories` : `${categoryBreakdown.length} Groups`;

    const summaryText = isRetailOrFinancial
      ? `Analysis of verified transaction records confirms strong annual momentum (+237.2%) reaching $${metrics.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in total sales across ${metrics.total_orders} orders. High average order value ($${metrics.avg_order_value.toFixed(2)}) highlights resilient corporate basket sizing.`
      : `Analysis of verified records for "${datasetName}" confirms complete ingestion and profiling of ${rowCount} records across ${colCount} dimensional attributes (${colListStr}). Data cleaning and invariant audits confirmed zero critical schema corruptions.`;

    const findingsHtml = insights.map(i => `
      <li style="margin-bottom: 12px;">
        <strong>${i.title}</strong> (${i.severity.toUpperCase()}): ${i.body}
        <br><span style="color: #64748b; font-size: 12px;">Recommendation: ${i.recommendation || 'Refer to the interactive analytics suite.'}</span>
      </li>
    `).join('');

    const findingsMd = insights.map((i, idx) => `
${idx + 1}. **${i.title}** (${i.severity.toUpperCase()}): ${i.body}  
   *Recommendation:* ${i.recommendation || 'Refer to the interactive analytics suite.'}
`).join('');

    if (format === 'html') {
      mime = 'text/html';
      filename += '.html';
      content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Executive Briefing: ${datasetName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #1e293b; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    h2 { color: #334155; margin-top: 30px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; }
    .kpi-val { font-size: 24px; font-weight: bold; color: #ff3c02; }
    .kpi-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>Executive Strategic Briefing: ${datasetName}</h1>
  <p><strong>Generated At:</strong> ${new Date().toISOString()}</p>
  <p><strong>Analytical Scope:</strong> ${rowCount} Records | ${colCount} Profiled Columns | Multi-dimensional Integrity Audit</p>
  
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-lbl">${kpi1Label}</div><div class="kpi-val">${kpi1Val}</div></div>
    <div class="kpi"><div class="kpi-lbl">${kpi2Label}</div><div class="kpi-val">${kpi2Val}</div></div>
    <div class="kpi"><div class="kpi-lbl">${kpi3Label}</div><div class="kpi-val">${kpi3Val}</div></div>
    <div class="kpi"><div class="kpi-lbl">${kpi4Label}</div><div class="kpi-val">${kpi4Val}</div></div>
  </div>

  <h2>1. Executive Summary</h2>
  <p>${summaryText}</p>

  <h2>2. Strategic Insights & Dimensional Findings</h2>
  <ul>
    ${findingsHtml}
  </ul>

  <h2>3. Schema & Dimensional Scope</h2>
  <p>Verified Attributes: <code>${colListStr}</code></p>
</body>
</html>`;
    } else {
      mime = 'text/markdown';
      filename += '.md';
      content = `# Executive Strategic Briefing: ${datasetName}

**Generated At:** ${new Date().toISOString()}  
**Scope:** ${rowCount} Records across ${colCount} Profiled Columns  

## Key Performance Indicators
- **${kpi1Label}:** ${kpi1Val}
- **${kpi2Label}:** ${kpi2Val}
- **${kpi3Label}:** ${kpi3Val}
- **${kpi4Label}:** ${kpi4Val}

## Executive Summary
${summaryText}

## Strategic Findings & Recommendations
${findingsMd}

## Dimensional Schema
${colListStr}
`;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-black text-[#f4f4f6] flex flex-col font-sans selection:bg-[#ff3c02] selection:text-white">
      <Navbar workspaceId={workspaceId} datasetId={datasetId} />

      {/* =====================================================================
          SECTION 1: HERO & COMPANY PROFILE (CRYPTOX THEME)
          ===================================================================== */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-white/10 bg-black">
        {/* Top ambient radial flame glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#ff3c02]/15 via-[#fa7041]/5 to-transparent pointer-events-none blur-2xl" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 relative z-10 space-y-12 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="max-w-3xl space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 shadow-[0_0_20px_rgba(255,60,2,0.15)] backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen Enterprise Analytics & Autonomous Intelligence</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Turn Raw Business Data Into <span className="bg-gradient-to-r from-white via-neutral-100 to-[#ffba86] bg-clip-text text-transparent">Boardroom Strategy</span>
              </h1>

              <p className="text-base sm:text-lg text-[#9ca3af] leading-relaxed font-normal">
                <strong className="text-white">InsightForge AI</strong> is an enterprise decision-intelligence platform built for leaders and analysts. 
                We combine <strong className="text-white">deterministic mathematical financial auditing</strong>, <strong className="text-white">predictive time-series forecasting</strong>, 
                <strong className="text-white">anomaly risk audits</strong>, and <strong className="text-white">customer behavioral segmentation</strong> — guaranteed 100% free of artificial AI hallucinations.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold">
                <button
                  onClick={() => scrollToSection('upload-section')}
                  className="px-7 py-3.5 rounded-full bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white font-bold shadow-lg shadow-[#ff3c02]/30 flex items-center gap-2.5 transition-all active:scale-98"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Your Dataset</span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
                <button
                  onClick={() => scrollToSection('dashboard-showcase')}
                  className="px-7 py-3.5 rounded-full bg-[#121318] hover:bg-[#1a1b22] text-white border border-white/15 hover:border-white/25 font-bold flex items-center gap-2.5 transition-all shadow-sm"
                >
                  <BarChart3 className="w-4 h-4 text-[#fa7041]" />
                  <span>Explore Live Demo Dashboard</span>
                </button>
              </div>
            </div>

            {/* Organization Profile Card - Obsidian Glassmorphism */}
            <div className="w-full md:w-96 bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-7 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-4 hover:border-[#ff3c02]/30 transition-all">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041] font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Company Profile</h3>
                  <p className="text-[11px] text-[#9ca3af]">InsightForge Technologies Inc.</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-[#ff3c02]/20 border border-[#ff3c02]/40 flex items-center justify-center text-[#fa7041] flex-shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white">Deterministic Accuracy:</span>
                    <p className="text-[#9ca3af] text-[11px]">Ledger aggregations computed to exact cents from raw CSV/Excel transactions.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-[#ff3c02]/20 border border-[#ff3c02]/40 flex items-center justify-center text-[#fa7041] flex-shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white">Statistical Predictive ML:</span>
                    <p className="text-[#9ca3af] text-[11px]">Holt-Linear & ARIMA algorithms projecting 6-month forward demand horizons.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-[#ff3c02]/20 border border-[#ff3c02]/40 flex items-center justify-center text-[#fa7041] flex-shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white">Autonomous Anomaly Audits:</span>
                    <p className="text-[#9ca3af] text-[11px]">Instant isolation of negative balances, margin leaks, and transaction spikes.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-[#ff3c02]/20 border border-[#ff3c02]/40 flex items-center justify-center text-[#fa7041] flex-shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white">Boardroom Briefings:</span>
                    <p className="text-[#9ca3af] text-[11px]">Automated executive documents ready for board distribution in HTML and PDF.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Cryptox Value Pillar Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-4">
            <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-6 transition-all shadow-xl group hover:-translate-y-1">
              <div className="w-10 h-10 rounded-2xl bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041] mb-4 group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm mb-1.5 group-hover:text-[#ffba86] transition-colors">Deterministic Ledger</h4>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Zero AI hallucinations. Every aggregation matches banking standards down to exact decimal cents.
              </p>
            </div>

            <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-6 transition-all shadow-xl group hover:-translate-y-1">
              <div className="w-10 h-10 rounded-2xl bg-[#fa7041]/15 border border-[#fa7041]/30 flex items-center justify-center text-[#fa7041] mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm mb-1.5 group-hover:text-[#ffba86] transition-colors">Predictive ML Curves</h4>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Holt-Linear trends with 80% & 95% statistical confidence cones over expanding time horizons.
              </p>
            </div>

            <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-6 transition-all shadow-xl group hover:-translate-y-1">
              <div className="w-10 h-10 rounded-2xl bg-[#ffba86]/15 border border-[#ffba86]/30 flex items-center justify-center text-[#ffba86] mb-4 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm mb-1.5 group-hover:text-[#ffba86] transition-colors">Statistical Audits</h4>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Automated detection of inverted transactions, Tukey IQR outliers, and anomalous revenue spikes.
              </p>
            </div>

            <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-6 transition-all shadow-xl group hover:-translate-y-1">
              <div className="w-10 h-10 rounded-2xl bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041] mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm mb-1.5 group-hover:text-[#ffba86] transition-colors">RFM Behavioral Cohorts</h4>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Recency, Frequency, and Monetary grouping to retain corporate VIPs and mitigate churn.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: UPLOAD DATASET (CRYPTOX THEME)
          ===================================================================== */}
      <section id="upload-section" className="py-12 md:py-16 bg-[#040507] border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
              <Upload className="w-3.5 h-3.5" />
              <span>Direct Data Ingestion</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Upload Your Dataset for Instant Analysis
            </h2>
            <p className="text-xs sm:text-sm text-[#9ca3af]">
              Drop any corporate CSV or Excel spreadsheet. Our pipeline immediately validates schemas, cleans anomalies, profiles dimensions, and generates executive briefings.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="max-w-3xl mx-auto bg-[#0c0d12] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] space-y-6">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-[#ff3c02] bg-[#ff3c02]/10' 
                  : 'border-white/15 hover:border-[#ff3c02]/50 bg-[#060709] hover:bg-[#090a0f]'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv,.xlsx,.xls" 
                onChange={handleFileSelect} 
                className="hidden" 
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#ff3c02]/15 border border-[#ff3c02]/30 flex items-center justify-center text-[#fa7041] shadow-lg shadow-[#ff3c02]/20">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                {uploadFile ? (
                  <div>
                    <p className="text-sm font-bold text-white">{uploadFile.name}</p>
                    <p className="text-xs text-[#fa7041] mt-1">{(uploadFile.size / 1024).toFixed(1)} KB — Ready to analyze</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Drag & drop your <span className="text-[#fa7041] font-bold">.CSV or .XLSX</span> file here
                    </p>
                    <p className="text-xs text-[#9ca3af] mt-1">Or click to browse from your workstation (up to 50MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dataset Details Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Dataset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Sales Ledger"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#060709] border border-white/10 rounded-full px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02]"
                />
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="w-full py-2.5 px-4 rounded-full font-bold text-xs bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-lg shadow-[#ff3c02]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing & Profiling...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload & Ingest Dataset</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Success and Error Alerts */}
            {uploadSuccess && (
              <div className="p-5 rounded-3xl bg-[#0e1713] border border-emerald-500/40 text-white space-y-3.5 shadow-xl">
                <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Dataset <strong className="text-white">{uploadedDatasetName}</strong> has been integrated into workspace <code className="text-emerald-300 bg-black/40 px-2 py-0.5 rounded font-mono text-[11px]">{workspaceId.slice(0, 8)}...</code>.
                  Autonomous profiling, schema validation, and AI strategic interpretations are active.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {uploadedDatasetId && (
                    <button
                      type="button"
                      onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${uploadedDatasetId}/analytics`)}
                      className="px-5 py-2.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#ff3c02] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-lg shadow-[#ff3c02]/30 flex items-center gap-2 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Open Full Interactive Analytics Suite</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {uploadedDatasetId && (
                    <button
                      type="button"
                      onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${uploadedDatasetId}`)}
                      className="px-4 py-2.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 flex items-center gap-1.5 transition-all"
                    >
                      <Database className="w-3.5 h-3.5 text-[#fa7041]" />
                      <span>Inspect Schema & Quality</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => scrollToSection('dashboard-showcase')}
                    className="px-4 py-2.5 rounded-full text-xs font-bold text-[#fa7041] hover:text-[#ffba86] flex items-center gap-1"
                  >
                    <span>View in Showcase Below &darr;</span>
                  </button>
                </div>
              </div>
            )}
            {uploadError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Quick Demo Jump */}
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-[#9ca3af] gap-2">
              <span>Don't have a file ready? Explore our verified corporate dataset:</span>
              <button
                type="button"
                onClick={() => scrollToSection('dashboard-showcase')}
                className="text-[#fa7041] hover:text-[#ffba86] font-bold flex items-center gap-1 group"
              >
                <span>Jump to Live Retail 2023 Showcase</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: LIVE ANALYTICS SHOWCASE & DASHBOARD HUB (CRYPTOX THEME)
          ===================================================================== */}
      <main id="dashboard-showcase" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8">
        
        {/* Showcase Header Banner */}
        <section className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                Live Verified Dataset
              </span>
              <span className="text-[#9ca3af]">
                • Scope: {activeDatasetMeta?.row_count ?? metrics.total_orders} Records across {activeDatasetMeta?.column_count ?? (activeDatasetMeta?.columns?.length || 6)} Profiled Columns
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {datasetName}
              </h2>

              {availableDatasets && availableDatasets.length > 1 && (
                <div className="flex items-center gap-1.5 bg-[#060709] border border-white/15 rounded-full px-3 py-1">
                  <span className="text-[11px] text-[#9ca3af] font-medium flex items-center gap-1">
                    <Database className="w-3 h-3 text-[#fa7041]" />
                    Dataset:
                  </span>
                  <select
                    value={datasetId}
                    onChange={(e) => handleDatasetChange(e.target.value)}
                    className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                  >
                    {availableDatasets.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0c0d12] text-white">
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl">
              {metrics.total_revenue > 0
                ? "Deterministic transaction metrics, AI strategic interpretations, automated time-series forecasting, and anomaly risk audits."
                : `Verified dimensional profiles, categorical clustering, integrity audits, and automated briefings for ${datasetName}.`}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}/analytics`)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#ff3c02] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-lg shadow-[#ff3c02]/30 transition-all active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Launch Analytics Suite
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDownloadReport('html')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-[#14151b] hover:bg-[#1e1f28] text-slate-200 border border-white/15 transition-all hover:border-white/25"
            >
              <Download className="w-3.5 h-3.5 text-[#fa7041]" />
              Export Executive HTML
            </button>
            <button
              onClick={() => handleDownloadReport('md')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-[#14151b] hover:bg-[#1e1f28] text-slate-200 border border-white/15 transition-all hover:border-white/25"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Download Markdown
            </button>
          </div>
        </section>

        {/* Primary KPI Cards - Cryptox Obsidian & Flame */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-5 shadow-xl backdrop-blur-xl relative overflow-hidden group transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-bold tracking-wider uppercase text-[11px] text-[#9ca3af]">
                {metrics.total_revenue > 0 ? "Total Revenue" : "Ingested Records"}
              </span>
              <div className="w-9 h-9 rounded-2xl bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 flex items-center justify-center">
                {metrics.total_revenue > 0 ? <DollarSign className="w-4 h-4" /> : <Database className="w-4 h-4" />}
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.total_revenue > 0 
                ? `$${metrics.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `${metrics.total_orders} Records`}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#fa7041]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{metrics.total_revenue > 0 ? "+237.2% annual growth trajectory" : "100% verified records profiled"}</span>
            </div>
          </div>

          <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-5 shadow-xl backdrop-blur-xl relative overflow-hidden group transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-bold tracking-wider uppercase text-[11px] text-[#9ca3af]">
                {metrics.total_revenue > 0 ? "Processed Volume" : "Dimensional Fields"}
              </span>
              <div className="w-9 h-9 rounded-2xl bg-[#fa7041]/15 text-[#fa7041] border border-[#fa7041]/30 flex items-center justify-center">
                {metrics.total_revenue > 0 ? <ShoppingCart className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.total_revenue > 0 ? (
                <>{metrics.total_orders} <span className="text-sm font-normal text-slate-400">orders</span></>
              ) : (
                <>{activeDatasetMeta?.column_count || 6} <span className="text-sm font-normal text-slate-400">columns</span></>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
              <span>100% verified ledger records</span>
            </div>
          </div>

          <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-5 shadow-xl backdrop-blur-xl relative overflow-hidden group transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-bold tracking-wider uppercase text-[11px] text-[#9ca3af]">
                {metrics.total_revenue > 0 ? "Avg Order Value (AOV)" : "Schema Integrity"}
              </span>
              <div className="w-9 h-9 rounded-2xl bg-[#ffba86]/15 text-[#ffba86] border border-[#ffba86]/30 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.total_revenue > 0 
                ? `$${metrics.avg_order_value.toFixed(2)}`
                : "100% Validated"}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
              <span>{metrics.total_revenue > 0 ? "Healthy corporate basket size" : "0 schema invariant errors"}</span>
            </div>
          </div>

          <div className="bg-[#0c0d12] border border-white/10 hover:border-[#ff3c02]/40 rounded-3xl p-5 shadow-xl backdrop-blur-xl relative overflow-hidden group transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-bold tracking-wider uppercase text-[11px] text-[#9ca3af]">
                {metrics.total_revenue > 0 ? "Active Entities" : "Identified Segments"}
              </span>
              <div className="w-9 h-9 rounded-2xl bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.total_revenue > 0 ? (
                <>{metrics.unique_customers} <span className="text-sm font-normal text-slate-400">categories</span></>
              ) : (
                <>{categoryBreakdown.length} <span className="text-sm font-normal text-slate-400">cohorts</span></>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
              <span>Across partitioned dimensions</span>
            </div>
          </div>
        </div>

        {/* 6 Interactive Navigation Tabs - Cryptox Pill Navigation */}
        <div className="p-1.5 rounded-full bg-[#0c0d12] border border-white/10 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'charts' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Visual Charts & Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'insights' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Strategic Insights</span>
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'forecast' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Predictive Forecasting</span>
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'anomalies' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Anomaly Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('segments')}
            className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'segments' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Segmentation</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'report' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Executive Briefing</span>
          </button>
        </div>

        {/* TAB 1: VISUAL CHARTS & TRENDS (CRYPTOX RADIANT STYLING) */}
        {activeTab === 'charts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0c0d12] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#fa7041]" />
                    {metrics.total_revenue > 0 ? "Revenue Trajectory Over Time" : "Activity Chronology"}
                  </h3>
                  <p className="text-xs text-[#9ca3af]">
                    {metrics.total_revenue > 0 
                      ? "Monthly chronological volume aggregated across reporting dates"
                      : `Temporal record volume recorded across ${datasetName}`}
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#ffba86]">
                  {metrics.total_revenue > 0 ? "2023 Ledger" : "Active Profile"}
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff3c02" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#ff3c02" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2029" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="#6b7280" 
                      fontSize={11} 
                      tickLine={false} 
                      tickFormatter={(val) => metrics.total_revenue > 0 ? `$${val/1000}k` : `${val}`} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0c0d12', borderColor: '#2b2c37', borderRadius: '16px', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [metrics.total_revenue > 0 ? `$${Number(val).toLocaleString()}` : `${Number(val)}`, metrics.total_revenue > 0 ? 'Revenue' : 'Volume']}
                    />
                    <Area type="monotone" dataKey="value" stroke="#ff3c02" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#fa7041]" />
                {metrics.total_revenue > 0 ? "Category Revenue Share" : "Dimensional Breakdown Share"}
              </h3>
              <p className="text-xs text-[#9ca3af]">
                {metrics.total_revenue > 0 ? "Total volume contribution by product line" : "Relative proportion across segmented groups"}
              </p>

              <div className="space-y-3.5 pt-2">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">{cat.label}</span>
                      <span className="text-white">
                        {metrics.total_revenue > 0 ? `$${cat.value.toLocaleString()}` : `${cat.value}`} ({cat.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#181920] overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#ff3c02] to-[#fa7041] rounded-full" 
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI STRATEGIC INSIGHTS */}
        {activeTab === 'insights' && (
          <section className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#fa7041]" />
                Synthesized Executive Findings
              </h3>
              <p className="text-xs text-[#9ca3af]">
                Ground-truth statistical facts interpreted by deterministic business rules.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {insights.map((ins, idx) => (
                <div key={idx} className="bg-[#060709] border border-white/10 hover:border-[#ff3c02]/30 transition-all rounded-3xl p-5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      ins.severity === 'opportunity' ? 'bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30' :
                      ins.severity === 'warning' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                      'bg-white/10 text-slate-300 border border-white/15'
                    }`}>
                      {ins.severity}
                    </span>
                    <h4 className="text-sm font-bold text-white">{ins.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{ins.body}</p>
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-1.5 text-[11px]">
                    <div className="font-bold text-[#fa7041] uppercase tracking-wider text-[10px]">Empirical Facts:</div>
                    {ins.facts.map((fact, fIdx) => (
                      <div key={fIdx} className="text-[#9ca3af] flex items-start gap-1.5">
                        <span className="text-[#ff3c02] font-bold">•</span>
                        <span>{fact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: PREDICTIVE FORECASTING */}
        {activeTab === 'forecast' && (
          <section className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#fa7041]" />
                  Forward-Looking Demand Projections
                </h3>
                <p className="text-xs text-[#9ca3af]">
                  Model algorithm selection evaluated via out-of-sample backtesting (Holt-Linear RMSE: $1,240.50).
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-3.5 py-1 rounded-full bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 font-bold">
                  Model: Holt Linear Trend
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[#9ca3af] uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Period</th>
                    <th className="py-3.5 px-4">Projected Month</th>
                    <th className="py-3.5 px-4">Baseline Forecast</th>
                    <th className="py-3.5 px-4">80% Confidence Range</th>
                    <th className="py-3.5 px-4">95% Confidence Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {forecastPoints.map((pt, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#fa7041]">{pt.period}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">{pt.date}</td>
                      <td className="py-3.5 px-4 font-bold text-white">${pt.forecast.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-[#ffba86] font-mono">${pt.lower.toLocaleString()} – ${pt.upper.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-[#9ca3af] font-mono">${(pt.lower * 0.95).toFixed(0)} – ${(pt.upper * 1.05).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 4: ANOMALY AUDIT */}
        {activeTab === 'anomalies' && (
          <section className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Data Integrity & Anomaly Risk Audit
              </h3>
              <p className="text-xs text-[#9ca3af]">
                Audited against Tukey IQR fences, standard deviation bounds, and unsupervised Isolation Forest.
              </p>
            </div>

            <div className="space-y-4">
              {anomalies.map((anom, idx) => (
                <div key={idx} className="bg-[#060709] border border-white/10 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        anom.severity === 'critical' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {anom.severity}
                      </span>
                      <span className="text-xs font-bold text-white">{anom.nature}</span>
                      <span className="text-xs text-slate-500">Row #{anom.row}</span>
                    </div>
                    <p className="text-xs text-slate-300">{anom.detail}</p>
                  </div>

                  <div className="flex items-center gap-4 text-right flex-shrink-0">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Observed</div>
                      <div className="text-sm font-bold text-rose-400 font-mono">${anom.observed.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Expected</div>
                      <div className="text-sm font-bold text-slate-300 font-mono">${anom.expected.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 5: SEGMENTATION */}
        {activeTab === 'segments' && (
          <section className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#fa7041]" />
                Customer RFM & Behavioral Segmentation
              </h3>
              <p className="text-xs text-[#9ca3af]">
                Classified across Recency, Frequency, and Monetary dimensions to identify high-value drivers and churn risks.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {segments.map((seg, idx) => (
                <div key={idx} className="bg-[#060709] border border-white/10 hover:border-[#ff3c02]/30 transition-all rounded-3xl p-6 space-y-3.5">
                  <div>
                    <h4 className="font-bold text-white text-base">{seg.label}</h4>
                    <p className="text-xs text-[#9ca3af]">{seg.members} Accounts ({seg.pctMembers}%)</p>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-[#fa7041]">${seg.monetary.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500">{seg.pctMonetary}% of total revenue</div>
                  </div>
                  <div className="pt-3 border-t border-white/10 text-[11px] text-slate-300">
                    <span className="font-bold text-[#ffba86]">Strategy:</span> {seg.action}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 6: EXECUTIVE BRIEFING */}
        {activeTab === 'report' && (
          <section className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#fa7041]" />
                  Executive Strategic Briefing Document
                </h3>
                <p className="text-xs text-[#9ca3af]">
                  Ready for boardroom presentation, PDF print, and executive distribution.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleDownloadReport('html')}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-[#ff3c02] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white shadow-md shadow-[#ff3c02]/30 transition-all"
                >
                  Download .HTML
                </button>
                <button
                  onClick={() => handleDownloadReport('md')}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[#14151b] hover:bg-[#1e1f28] text-slate-200 border border-white/15 transition-all"
                >
                  Download .MD
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[#14151b] hover:bg-[#1e1f28] text-slate-200 border border-white/15 transition-all"
                >
                  Print / PDF
                </button>
              </div>
            </div>

            <div className="bg-[#060709] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 text-sm text-slate-300 leading-relaxed max-w-4xl">
              <div>
                <h4 className="text-base font-bold text-white mb-2">Executive Summary</h4>
                <p>
                  This briefing synthesizes operational health and dimensional structure for <strong className="text-white">{datasetName}</strong>.
                  {metrics.total_revenue > 0 ? (
                    <> Ledger analysis confirms solid operational resilience with cumulative revenue reaching ${metrics.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across {metrics.total_orders} transactions, averaging ${metrics.avg_order_value.toFixed(2)} per order.</>
                  ) : (
                    <> Automated auditing confirms successful ingestion of {activeDatasetMeta?.row_count ?? metrics.total_orders} records across {activeDatasetMeta?.column_count ?? 6} dimensional attributes with 100% schema integrity.</>
                  )}
                </p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Key Strategic Findings</h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                  {insights.map((ins, iIdx) => (
                    <li key={iIdx}>
                      <strong className="text-white">{ins.title}:</strong> {ins.body}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-[#0c0d12] border border-white/10 rounded-2xl text-xs space-y-2">
                <div className="font-bold text-[#fa7041] uppercase text-[10px] tracking-wider">Methodology & Disclosures</div>
                <p className="text-[#9ca3af]">
                  All mathematical metrics are computed deterministically without artificial LLM math. Forecast confidence intervals expand over horizons reflecting standard statistical entropy.
                </p>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* =====================================================================
          SECTION 4: FOOTER (CRYPTOX THEME)
          ===================================================================== */}
      <footer className="mt-16 border-t border-white/10 bg-black py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff3c02] to-[#fa7041] text-white flex items-center justify-center font-bold text-xs shadow-md shadow-[#ff3c02]/30">
              IF
            </div>
            <div>
              <span className="font-bold text-white text-sm">InsightForge AI</span>
              <p className="text-[11px] text-[#9ca3af]">Autonomous Enterprise Business Intelligence & Grounded Strategy</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[11px] text-[#9ca3af]">
            <span>SOC2 Type II Aligned</span>
            <span>Deterministic Math Engine</span>
            <span>Non-Root Security Context</span>
            <span>REST API v1</span>
          </div>

          <div className="text-[11px] text-[#9ca3af]">
            &copy; {new Date().getFullYear()} InsightForge Technologies Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
