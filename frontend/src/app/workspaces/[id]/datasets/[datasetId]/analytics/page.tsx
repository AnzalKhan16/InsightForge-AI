"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Area, AreaChart, ComposedChart 
} from 'recharts';
import { 
  ArrowUpRight, TrendingUp, Users, DollarSign, ShoppingCart, Activity, RefreshCw,
  Sparkles, ShieldCheck, AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronUp,
  Layers, Filter, Database, CheckCircle2, MessageSquare, Send, CornerDownRight,
  HelpCircle, BarChart3, Search, Calendar, Gauge, ShieldAlert, EyeOff, Check, X,
  FileText, Download, Copy, Printer, CheckCircle, Target, Clock, ArrowRight
} from 'lucide-react';

const COLORS = ['#4f46e5', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981'];

interface RecommendationItem {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  impact_summary: string;
  evidence?: Record<string, any>;
  rationale: string;
  action_plan: string[];
}

interface ExecutiveReportItem {
  id: string;
  title: string;
  status: string;
  storage_key?: string;
  created_at?: string;
  content?: {
    title: string;
    dataset_name: string;
    dataset_id?: string;
    version_id?: string;
    generated_at: string;
    executive_summary: string[];
    kpis: Array<{ label: string; value: string; detail: string }>;
    recommendations: RecommendationItem[];
    has_forecast: boolean;
    has_anomalies: boolean;
    has_segments: boolean;
    markdown_content: string;
  };
}

interface AnomalyItem {
  id: string;
  version_id?: string;
  column_name: string;
  method: string;
  row_index: number | null;
  observed_value: number;
  expected_value: number;
  score: number;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'reviewed' | 'dismissed';
  nature: 'statistical_outlier' | 'detected_anomaly' | 'confirmed_business_issue';
  title: string;
  explanation: string;
  details?: Record<string, any>;
  created_at?: string;
}

interface SegmentItem {
  id?: string;
  label: string;
  subtitle: string;
  member_count: number;
  percentage_of_members: number;
  total_monetary: number;
  percentage_of_monetary: number;
  profile?: Record<string, any>;
  recommendation?: string;
  sample_members?: Array<Record<string, any>>;
  created_at?: string;
}

interface SegmentationResult {
  run_id?: string;
  method: string;
  total_entities?: number;
  total_monetary?: number;
  k?: number;
  silhouette_score?: number;
  segments: SegmentItem[];
  assumptions?: string[];
  limitations?: string[];
}

interface SegmentationSchema {
  entity_columns: string[];
  customer_columns: string[];
  product_columns: string[];
  date_columns: string[];
  monetary_columns: string[];
  numeric_columns: string[];
  rfm_supported: boolean;
  abc_supported: boolean;
  kmeans_supported: boolean;
  suggested_method: string;
  suggested_entity_column: string | null;
  suggested_date_column: string | null;
  suggested_monetary_column: string | null;
}

interface ForecastResult {
  id?: string;
  target_column: string;
  time_column: string;
  frequency: string;
  horizon: number;
  selected_model: string;
  model_parameters: Record<string, any>;
  validation_metrics: {
    mae: number;
    rmse: number;
    mape_pct: number;
    holdout_periods: number;
  };
  all_model_evaluations: Record<string, any>;
  historical_points: Array<{ date: string; value: number }>;
  forecast_points: Array<{
    date: string;
    period_index: number;
    forecast: number;
    lower_bound_80: number;
    upper_bound_80: number;
    lower_bound_95: number;
    upper_bound_95: number;
  }>;
  assumptions: string[];
  limitations: string[];
}

interface NLQueryResult {
  question: string;
  operation: string;
  interpreted_intent: string;
  answer_markdown: string;
  data: any[];
  columns: string[];
  chart_suggestion?: {
    type: string;
    x_axis?: string;
    y_axis?: string;
    title?: string;
    series_name?: string;
    previous_period?: string;
    previous_value?: string;
    current_period?: string;
    current_value?: string;
    delta?: string;
    pct_change?: string;
    primary_metric?: string;
    secondary_metric?: string;
  };
  summary_metrics: Record<string, any>;
  suggested_followups: string[];
}

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
  
  // NL Analytics state
  const [nlQuestion, setNlQuestion] = useState('');
  const [submittingNlQuery, setSubmittingNlQuery] = useState(false);
  const [nlResult, setNlResult] = useState<NLQueryResult | null>(null);
  const [nlError, setNlError] = useState<string | null>(null);

  // Forecasting state
  const [forecastSchema, setForecastSchema] = useState<any>(null);
  const [selectedForecastMetric, setSelectedForecastMetric] = useState<string>('');
  const [forecastHorizon, setForecastHorizon] = useState<number>(6);
  const [selectedForecastModel, setSelectedForecastModel] = useState<string>('auto');
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [loadingForecast, setLoadingForecast] = useState<boolean>(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // Anomaly Detection state
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [runningAnomalyDetect, setRunningAnomalyDetect] = useState<boolean>(false);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);
  const [anomalyTargetCol, setAnomalyTargetCol] = useState<string>('');
  const [anomalyMethod, setAnomalyMethod] = useState<string>('all');
  const [anomalyNatureFilter, setAnomalyNatureFilter] = useState<string>('all');
  const [anomalyStatusFilter, setAnomalyStatusFilter] = useState<string>('all');

  // Segmentation state
  const [segSchema, setSegSchema] = useState<SegmentationSchema | null>(null);
  const [selectedSegMethod, setSelectedSegMethod] = useState<string>('auto');
  const [selectedSegEntity, setSelectedSegEntity] = useState<string>('');
  const [selectedSegMonetary, setSelectedSegMonetary] = useState<string>('');
  const [selectedSegDate, setSelectedSegDate] = useState<string>('');
  const [selectedKmeansK, setSelectedKmeansK] = useState<number>(3);
  const [segmentationResult, setSegmentationResult] = useState<SegmentationResult | null>(null);
  const [runningSegmentation, setRunningSegmentation] = useState<boolean>(false);
  const [segmentationError, setSegmentationError] = useState<string | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);

  // Recommendations & Executive Reports state
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);
  const [reportsList, setReportsList] = useState<Array<{ id: string; title: string; status: string; storage_key: string; created_at: string }>>([]);
  const [activeReport, setActiveReport] = useState<ExecutiveReportItem | null>(null);
  const [loadingReportDetails, setLoadingReportDetails] = useState<boolean>(false);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [reportTitleInput, setReportTitleInput] = useState<string>('');
  const [reportViewMode, setReportViewMode] = useState<'document' | 'markdown'>('document');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [recPriorityFilter, setRecPriorityFilter] = useState<string>('all');
  const [recCategoryFilter, setRecCategoryFilter] = useState<string>('all');
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<'insights' | 'nlq' | 'forecast' | 'anomalies' | 'segments' | 'reports' | 'charts' | 'all'>('insights');
  const [selectedDimension, setSelectedDimension] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  const loadReportDetails = async (reportId: string) => {
    try {
      setLoadingReportDetails(true);
      const rep = await apiFetch<ExecutiveReportItem>(`/workspaces/${workspaceId}/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveReport(rep);
    } catch (err: any) {
      console.error("Failed to load report details", err);
    } finally {
      setLoadingReportDetails(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const payload: { title?: string } = {};
      if (reportTitleInput.trim()) {
        payload.title = reportTitleInput.trim();
      }
      const newReport = await apiFetch<ExecutiveReportItem>(`/workspaces/${workspaceId}/datasets/${datasetId}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      setActiveReport(newReport);
      setReportsList(prev => [
        {
          id: newReport.id,
          title: newReport.title,
          status: newReport.status,
          storage_key: newReport.storage_key || '',
          created_at: newReport.created_at || new Date().toISOString(),
        },
        ...prev
      ]);
      if (newReport.content?.recommendations) {
        setRecommendations(newReport.content.recommendations);
      }
      setReportTitleInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to compile executive report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleRefreshRecommendations = async () => {
    try {
      setLoadingRecommendations(true);
      const res = await apiFetch<{ recommendations: RecommendationItem[] }>(`/workspaces/${workspaceId}/datasets/${datasetId}/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res && res.recommendations) {
        setRecommendations(res.recommendations);
      }
    } catch (err: any) {
      console.error('Failed to refresh recommendations', err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleDownloadReport = (rep?: ExecutiveReportItem | null) => {
    const target = rep || activeReport;
    if (!target || !target.content?.markdown_content) {
      alert("No report markdown content available for download");
      return;
    }
    const blob = new Blob([target.content.markdown_content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanTitle = (target.title || 'executive_report').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    link.setAttribute('download', `${cleanTitle}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = (content?: string) => {
    const text = content || activeReport?.content?.markdown_content || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      if (recPriorityFilter !== 'all' && rec.priority !== recPriorityFilter) return false;
      if (recCategoryFilter !== 'all' && rec.category !== recCategoryFilter) return false;
      return true;
    });
  }, [recommendations, recPriorityFilter, recCategoryFilter]);

  const runSegmentation = async () => {
    setRunningSegmentation(true);
    setSegmentationError(null);
    try {
      const payload: Record<string, any> = {
        method: selectedSegMethod,
      };
      if (selectedSegEntity) payload.entity_column = selectedSegEntity;
      if (selectedSegMonetary) payload.monetary_column = selectedSegMonetary;
      if (selectedSegDate) payload.date_column = selectedSegDate;
      if (selectedSegMethod === 'kmeans') payload.k = Number(selectedKmeansK);

      const res = await apiFetch<SegmentationResult>(`/workspaces/${workspaceId}/datasets/${datasetId}/segmentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      setSegmentationResult(res);
      setActiveSegmentIndex(0);
    } catch (err: any) {
      setSegmentationError(err.message || 'Failed to generate segmentation');
    } finally {
      setRunningSegmentation(false);
    }
  };

  const runAnomalyDetection = async () => {
    setRunningAnomalyDetect(true);
    setAnomalyError(null);
    try {
      const payload: Record<string, any> = {};
      if (anomalyTargetCol) payload.target_column = anomalyTargetCol;
      if (anomalyMethod !== 'all') payload.method = anomalyMethod;
      const res = await apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}/anomalies/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      if (res.anomalies) {
        setAnomalies(res.anomalies);
      }
    } catch (err: any) {
      setAnomalyError(err.message || 'Failed to detect anomalies');
    } finally {
      setRunningAnomalyDetect(false);
    }
  };

  const updateAnomalyStatus = async (anomalyId: string, newStatus: 'open' | 'reviewed' | 'dismissed') => {
    try {
      await apiFetch<any>(`/workspaces/${workspaceId}/anomalies/${anomalyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });
      setAnomalies(prev => prev.map(a => a.id === anomalyId ? { ...a, status: newStatus } : a));
    } catch (err: any) {
      console.error('Failed to update anomaly status', err);
    }
  };

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter(a => {
      if (anomalyNatureFilter !== 'all' && a.nature !== anomalyNatureFilter) return false;
      if (anomalyStatusFilter !== 'all' && a.status !== anomalyStatusFilter) return false;
      return true;
    });
  }, [anomalies, anomalyNatureFilter, anomalyStatusFilter]);

  const anomalyMetrics = useMemo(() => {
    const total = anomalies.length;
    const confirmedIssues = anomalies.filter(a => a.nature === 'confirmed_business_issue').length;
    const detectedAnomalies = anomalies.filter(a => a.nature === 'detected_anomaly').length;
    const statisticalOutliers = anomalies.filter(a => a.nature === 'statistical_outlier').length;
    const reviewedOrDismissed = anomalies.filter(a => a.status === 'reviewed' || a.status === 'dismissed').length;
    return { total, confirmedIssues, detectedAnomalies, statisticalOutliers, reviewedOrDismissed };
  }, [anomalies]);

  const numericColumns = useMemo(() => {
    if (forecastSchema?.metric_columns && forecastSchema.metric_columns.length > 0) {
      return forecastSchema.metric_columns;
    }
    if (dataset?.current_version?.metadata_obj?.columns) {
      return dataset.current_version.metadata_obj.columns
        .filter((c: any) => c.data_type === 'number' || c.data_type === 'integer' || c.data_type === 'float')
        .map((c: any) => c.name);
    }
    return ['revenue', 'amount', 'quantity', 'sales', 'price'];
  }, [forecastSchema, dataset]);

  const handleNlQuery = async (queryText?: string) => {
    const q = queryText || nlQuestion;
    if (!q.trim()) return;
    setSubmittingNlQuery(true);
    setNlError(null);
    try {
      const res = await apiFetch<NLQueryResult>(`/workspaces/${workspaceId}/datasets/${datasetId}/nl-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ question: q.trim() }),
      });
      setNlResult(res);
      setNlQuestion(q);
    } catch (err: any) {
      setNlError(err.message || 'Failed to execute natural language query');
    } finally {
      setSubmittingNlQuery(false);
    }
  };

  const runForecast = async () => {
    setLoadingForecast(true);
    setForecastError(null);
    try {
      const target = selectedForecastMetric || forecastSchema?.primary_metric;
      const res = await apiFetch<ForecastResult>(`/workspaces/${workspaceId}/datasets/${datasetId}/forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_column: target,
          horizon: Number(forecastHorizon),
          model_type: selectedForecastModel,
        }),
      });
      setForecastResult(res);
    } catch (err: any) {
      setForecastError(err.message || 'Failed to generate forecast');
    } finally {
      setLoadingForecast(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ds, an, ins, fcSchema, fcs, anoms, sSchema, sResult, recs, reps] = await Promise.all([
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/analyses`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch<InsightItem[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}/forecast/schema`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/forecasts`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => []),
        apiFetch<AnomalyItem[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/anomalies`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => []),
        apiFetch<SegmentationSchema>(`/workspaces/${workspaceId}/datasets/${datasetId}/segmentation/schema`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}/segments`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        apiFetch<{ recommendations: RecommendationItem[] }>(`/workspaces/${workspaceId}/datasets/${datasetId}/recommendations`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ recommendations: [] })),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/reports`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => []),
      ]);
      setDataset(ds);
      setAnalyses(an);
      setInsights(ins);
      if (fcSchema) {
        setForecastSchema(fcSchema);
        if (fcSchema.primary_metric && !selectedForecastMetric) {
          setSelectedForecastMetric(fcSchema.primary_metric);
        }
        if (fcSchema.primary_metric && !anomalyTargetCol) {
          setAnomalyTargetCol(fcSchema.primary_metric);
        }
      }
      if (fcs && fcs.length > 0 && fcs[0].result) {
        setForecastResult(fcs[0].result);
      }
      if (anoms && Array.isArray(anoms)) {
        setAnomalies(anoms);
      }
      if (sSchema) {
        setSegSchema(sSchema);
        if (sSchema.suggested_entity_column && !selectedSegEntity) {
          setSelectedSegEntity(sSchema.suggested_entity_column);
        }
        if (sSchema.suggested_monetary_column && !selectedSegMonetary) {
          setSelectedSegMonetary(sSchema.suggested_monetary_column);
        }
        if (sSchema.suggested_date_column && !selectedSegDate) {
          setSelectedSegDate(sSchema.suggested_date_column);
        }
      }
      if (sResult && sResult.segments && sResult.segments.length > 0) {
        setSegmentationResult(sResult);
      }
      if (recs && recs.recommendations) {
        setRecommendations(recs.recommendations);
      }
      if (reps && Array.isArray(reps)) {
        setReportsList(reps);
        if (reps.length > 0 && reps[0].id) {
          loadReportDetails(reps[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch analytics or insights", err);
    } finally {
      setLoading(false);
    }
  };

  const forecastChartData = useMemo(() => {
    if (!forecastResult) return [];
    const points: any[] = [];
    const hist = forecastResult.historical_points || [];
    const fcast = forecastResult.forecast_points || [];

    hist.forEach(h => {
      points.push({
        date: h.date,
        historical: h.value,
        forecast: null,
        lower_95: null,
        upper_95: null,
        confidence_range: null,
      });
    });

    if (hist.length > 0 && fcast.length > 0) {
      points[points.length - 1].forecast = hist[hist.length - 1].value;
    }

    fcast.forEach(f => {
      points.push({
        date: f.date,
        historical: null,
        forecast: f.forecast,
        lower_95: f.lower_bound_95,
        upper_95: f.upper_bound_95,
        confidence_range: [f.lower_bound_95, f.upper_bound_95],
      });
    });

    return points;
  }, [forecastResult]);

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
            onClick={() => setActiveTab('nlq')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'nlq' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Ask Data (NL Query)
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'forecast' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Forecasting
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'anomalies' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            Anomaly Detection
            {anomalies.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'anomalies' ? 'bg-indigo-500 text-white' : 'bg-rose-100 text-rose-700 font-bold'}`}>
                {anomalies.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'segments' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Segmentation (RFM / K-Means / ABC)
            {segmentationResult?.segments && segmentationResult.segments.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'segments' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700 font-bold'}`}>
                {segmentationResult.segments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'reports' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Executive Reports & Actions
            {recommendations.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'reports' ? 'bg-indigo-500 text-white' : 'bg-amber-100 text-amber-800 font-bold'}`}>
                {recommendations.length}
              </span>
            )}
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

        {/* SECTION 1.5: NATURAL LANGUAGE ANALYTICS QUERY INTERFACE */}
        {(activeTab === 'nlq' || activeTab === 'all') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  Natural Language Analytics & Data Querying
                </h2>
                <p className="text-sm text-slate-500">
                  Ask conversational business questions. Computations are strictly executed using deterministic analytics engines.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sandboxed Query Execution</span>
              </div>
            </div>

            {/* Search Prompt Input & Quick Pills */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNlQuery();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nlQuestion}
                    onChange={(e) => setNlQuestion(e.target.value)}
                    placeholder="Ask anything (e.g. Which products generated the most revenue? Compare this quarter with previous quarter...)"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingNlQuery || !nlQuestion.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {submittingNlQuery ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{submittingNlQuery ? 'Analyzing...' : 'Ask Data'}</span>
                </button>
              </form>

              {/* Suggested Quick Prompt Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Try asking:
                </span>
                {[
                  "What was our revenue last month?",
                  "Which products generated the most revenue?",
                  "Which region grew the fastest?",
                  "Compare this quarter with the previous quarter",
                  "Why did revenue decrease?",
                  "What were our top customers?",
                ].map((pill, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleNlQuery(pill)}
                    className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Alert */}
            {nlError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{nlError}</span>
              </div>
            )}

            {/* Empty State before any query */}
            {!nlResult && !submittingNlQuery && !nlError && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[220px]">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Interactive Conversational BI</h3>
                <p className="text-xs text-slate-500 max-w-md">
                  Type any business query or select a quick question above to run deterministic aggregations, produce markdown analysis, and generate interactive charts.
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {submittingNlQuery && (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-sm font-semibold text-slate-700">Validating query plan and executing deterministic data engine...</p>
                <p className="text-xs text-slate-400">Enforcing zero-hallucination mathematical bounds</p>
              </div>
            )}

            {/* Result Container */}
            {nlResult && !submittingNlQuery && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {/* Header with question & operation badge */}
                <div className="p-6 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {nlResult.operation.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500">
                        {nlResult.interpreted_intent}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      "{nlResult.question}"
                    </h3>
                  </div>
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1 self-start md:self-auto font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Deterministic Math Verified</span>
                  </div>
                </div>

                {/* Narrative Answer Section */}
                <div className="p-6">
                  <div className="prose prose-slate max-w-none text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                    {nlResult.answer_markdown}
                  </div>
                </div>

                {/* Visual Chart Section if suggested */}
                {nlResult.chart_suggestion && (
                  <div className="p-6 bg-slate-50/30">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      Recommended Visualization: {nlResult.chart_suggestion.title || 'Analysis Chart'}
                    </h4>

                    {nlResult.chart_suggestion.type === 'bar_chart' && nlResult.data.length > 0 && (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={nlResult.data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey={nlResult.chart_suggestion.x_axis || nlResult.columns[0]} 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748b', fontSize: 12 }} 
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748b', fontSize: 12 }} 
                              tickFormatter={(v) => Number(v) >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              formatter={(val: any) => [Number(val).toLocaleString(), nlResult.chart_suggestion?.series_name || 'Value']}
                            />
                            <Bar 
                              dataKey={nlResult.chart_suggestion.y_axis || 'total_value'} 
                              radius={[6, 6, 0, 0]}
                            >
                              {nlResult.data.map((_, idx) => (
                                <Cell key={`bar-${idx}`} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {nlResult.chart_suggestion.type === 'comparison_cards' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <div className="text-xs text-slate-500 uppercase font-semibold">Previous Period ({nlResult.chart_suggestion.previous_period})</div>
                          <div className="text-2xl font-bold text-slate-800 mt-1">{nlResult.chart_suggestion.previous_value}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <div className="text-xs text-slate-500 uppercase font-semibold">Current Period ({nlResult.chart_suggestion.current_period})</div>
                          <div className="text-2xl font-bold text-slate-800 mt-1">{nlResult.chart_suggestion.current_value}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/30">
                          <div className="text-xs text-indigo-700 uppercase font-semibold">Net Variance & Change</div>
                          <div className="text-2xl font-bold text-indigo-900 mt-1">{nlResult.chart_suggestion.delta} ({nlResult.chart_suggestion.pct_change})</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Structured Data Table */}
                {nlResult.data && nlResult.data.length > 0 && (
                  <div className="p-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-slate-500" />
                      Verified Data Records ({nlResult.data.length} rows)
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider">
                          <tr>
                            {nlResult.columns.map((col) => (
                              <th key={col} className="px-4 py-3">
                                {col.replace('_', ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {nlResult.data.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                              {nlResult.columns.map((col) => (
                                <td key={col} className="px-4 py-2.5 font-medium">
                                  {typeof row[col] === 'number' ? Number(row[col]).toLocaleString() : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Suggested Follow-up Questions */}
                {nlResult.suggested_followups && nlResult.suggested_followups.length > 0 && (
                  <div className="p-6 bg-slate-50/50 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
                      <CornerDownRight className="w-3.5 h-3.5" /> Next Steps:
                    </span>
                    {nlResult.suggested_followups.map((fUp, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleNlQuery(fUp)}
                        className="text-xs bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer"
                      >
                        {fUp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* SECTION 1.8: TIME-SERIES FORECASTING */}
        {(activeTab === 'forecast' || activeTab === 'all') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Statistical Time-Series Forecasting
                </h2>
                <p className="text-sm text-slate-500">
                  Forward-looking projections with empirical backtesting, out-of-sample validation error, and confidence intervals.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Empirical Backtesting Verified</span>
              </div>
            </div>

            {/* If dataset lacks temporal suitability */}
            {forecastSchema && !forecastSchema.is_forecastable ? (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-900">Insufficient Temporal Data For Forecasting</h3>
                  <p className="text-xs text-amber-700 mt-1">
                    This dataset does not contain valid parseable date or timestamp columns. Forecasting requires chronological observations to construct a time series.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Control Bar: Target Metric, Horizon, Model Selection */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Target Metric
                      </label>
                      <select
                        value={selectedForecastMetric}
                        onChange={(e) => setSelectedForecastMetric(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        {forecastSchema?.metric_columns?.map((m: string) => (
                          <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                        )) || (
                          <option value="revenue">REVENUE</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Forecast Horizon
                      </label>
                      <select
                        value={forecastHorizon}
                        onChange={(e) => setForecastHorizon(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value={3}>3 Periods Forward</option>
                        <option value={6}>6 Periods Forward</option>
                        <option value={12}>12 Periods Forward</option>
                        <option value={24}>24 Periods Forward</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Forecasting Model
                      </label>
                      <select
                        value={selectedForecastModel}
                        onChange={(e) => setSelectedForecastModel(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="auto">Auto (Best Backtest RMSE)</option>
                        <option value="holt_linear">Holt's Linear Exponential</option>
                        <option value="linear_trend">Linear Trend (OLS)</option>
                        <option value="moving_average">Moving Average with Drift</option>
                      </select>
                    </div>

                    <div>
                      <button
                        onClick={runForecast}
                        disabled={loadingForecast}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingForecast ? 'animate-spin' : ''}`} />
                        <span>{loadingForecast ? 'Computing Forecast...' : 'Generate Forecast'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {forecastError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{forecastError}</span>
                  </div>
                )}

                {/* Empty State before running forecast */}
                {!forecastResult && !loadingForecast && !forecastError && (
                  <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                      <TrendingUp className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Time-Series Forecasting Ready</h3>
                    <p className="text-slate-500 max-w-md text-xs mb-6">
                      Select your target metric and horizon above, then click Generate Forecast to compute statistical projections with 80% and 95% confidence bounds.
                    </p>
                    <button
                      onClick={runForecast}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      Run Initial Forecast
                    </button>
                  </div>
                )}

                {/* Result Section */}
                {forecastResult && !loadingForecast && (
                  <div className="space-y-6">
                    {/* Performance & Model Info Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Model</div>
                        <div className="text-base font-bold text-slate-900 mt-1 truncate">{forecastResult.selected_model}</div>
                        <div className="text-xs text-indigo-600 font-medium mt-1">
                          Horizon: {forecastResult.horizon} periods ({forecastResult.frequency})
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Validation RMSE</div>
                        <div className="text-2xl font-extrabold text-slate-900 mt-1">
                          {forecastResult.validation_metrics?.rmse != null 
                            ? `$${Number(forecastResult.validation_metrics.rmse).toLocaleString()}` 
                            : 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          Holdout error ({forecastResult.validation_metrics?.holdout_periods} test periods)
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Validation MAE</div>
                        <div className="text-2xl font-extrabold text-slate-900 mt-1">
                          {forecastResult.validation_metrics?.mae != null 
                            ? `$${Number(forecastResult.validation_metrics.mae).toLocaleString()}` 
                            : 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">Mean absolute deviation</div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">MAPE Accuracy</div>
                        <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                          {forecastResult.validation_metrics?.mape_pct != null 
                            ? `${Number(forecastResult.validation_metrics.mape_pct).toFixed(1)}%` 
                            : 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">Mean percentage error</div>
                      </div>
                    </div>

                    {/* Interactive Forecast Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            Historical vs. Projected {forecastResult.target_column.replace('_', ' ').toUpperCase()}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Solid indigo line displays historical recordings; dashed emerald line shows {forecastResult.horizon}-period projections with shaded 95% confidence intervals.
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <span className="w-3 h-0.5 bg-indigo-600 inline-block"></span> Historical
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <span className="w-3 h-0.5 bg-emerald-500 border-dashed border-t-2 border-emerald-500 inline-block"></span> Forecast
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <span className="w-3 h-3 bg-indigo-100 rounded-sm inline-block"></span> 95% Confidence
                          </span>
                        </div>
                      </div>

                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={forecastChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748b', fontSize: 11 }} 
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748b', fontSize: 11 }} 
                              tickFormatter={(v) => Number(v) >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              formatter={(val: any, name: any) => {
                                if (Array.isArray(val)) {
                                  return [`$${Number(val[0]).toLocaleString()} - $${Number(val[1]).toLocaleString()}`, '95% Confidence Band'];
                                }
                                if (val == null) return null;
                                return [`$${Number(val).toLocaleString()}`, name === 'historical' ? 'Historical Actual' : 'Projected Forecast'];
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="confidence_range" 
                              fill="#e0e7ff" 
                              stroke="transparent" 
                              fillOpacity={0.6} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="historical" 
                              stroke="#4f46e5" 
                              strokeWidth={2.5} 
                              dot={{ r: 3, fill: '#4f46e5' }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="forecast" 
                              stroke="#10b981" 
                              strokeWidth={2.5} 
                              strokeDasharray="5 5" 
                              dot={{ r: 4, fill: '#10b981' }} 
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Projections Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Forecast Values & Uncertainty Intervals
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                          <thead className="bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Horizon Period</th>
                              <th className="px-4 py-3">Projected Date</th>
                              <th className="px-4 py-3">Projected Value</th>
                              <th className="px-4 py-3">80% Confidence Range</th>
                              <th className="px-4 py-3">95% Confidence Range</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {forecastResult.forecast_points.map((pt) => (
                              <tr key={pt.date} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-2.5 font-bold text-indigo-600">+{pt.period_index}</td>
                                <td className="px-4 py-2.5 font-medium">{pt.date}</td>
                                <td className="px-4 py-2.5 font-bold text-slate-900">${pt.forecast.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-slate-600">${pt.lower_bound_80.toLocaleString()} - ${pt.upper_bound_80.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-slate-600">${pt.lower_bound_95.toLocaleString()} - ${pt.upper_bound_95.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Assumptions & Limitations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-indigo-600" />
                          Model Assumptions
                        </h4>
                        <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                          {forecastResult.assumptions?.map((assm, aIdx) => (
                            <li key={aIdx}>{assm}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Limitations & Risk Boundaries
                        </h4>
                        <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                          {forecastResult.limitations?.map((lim, lIdx) => (
                            <li key={lIdx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* SECTION 1.9: ANOMALY DETECTION */}
        {(activeTab === 'anomalies' || activeTab === 'all') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-indigo-600" />
                  Statistically Grounded Anomaly & Outlier Detection
                </h2>
                <p className="text-sm text-slate-500">
                  Parametric Z-Score, Tukey IQR fences, and unsupervised Isolation Forest with explainable business classifications.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero-False-Accusation Guarantee (Outliers ≠ Fraud)</span>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Flagged</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{anomalyMetrics.total}</div>
                <div className="text-xs text-slate-500 mt-1">Across all algorithms</div>
              </div>

              <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-200 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  Confirmed Issues
                </div>
                <div className="text-2xl font-extrabold text-rose-900 mt-1">{anomalyMetrics.confirmedIssues}</div>
                <div className="text-xs text-rose-600 mt-1">Invariants (e.g. negative values)</div>
              </div>

              <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Detected Anomalies
                </div>
                <div className="text-2xl font-extrabold text-amber-900 mt-1">{anomalyMetrics.detectedAnomalies}</div>
                <div className="text-xs text-amber-600 mt-1">Volume drops & multivariate pattern</div>
              </div>

              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-200 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  Statistical Outliers
                </div>
                <div className="text-2xl font-extrabold text-indigo-900 mt-1">{anomalyMetrics.statisticalOutliers}</div>
                <div className="text-xs text-indigo-600 mt-1">Legitimate high-value VIP spikes</div>
              </div>

              <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Triaged / Resolved
                </div>
                <div className="text-2xl font-extrabold text-emerald-900 mt-1">{anomalyMetrics.reviewedOrDismissed}</div>
                <div className="text-xs text-emerald-600 mt-1">Reviewed or dismissed</div>
              </div>
            </div>

            {/* Scan Controls Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Target Numeric Dimension
                  </label>
                  <select
                    value={anomalyTargetCol}
                    onChange={(e) => setAnomalyTargetCol(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {numericColumns.map((col: string) => (
                      <option key={col} value={col}>{col.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Detection Algorithm
                  </label>
                  <select
                    value={anomalyMethod}
                    onChange={(e) => setAnomalyMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="all">All Methods (Z-Score + IQR + Isolation Forest)</option>
                    <option value="zscore">Z-Score (Gaussian Standard Deviation Bounds)</option>
                    <option value="iqr">Tukey's IQR Fences (Distribution-Free)</option>
                    <option value="isolation_forest">Isolation Forest (Multivariate Isolation)</option>
                  </select>
                </div>

                <div>
                  <button
                    onClick={runAnomalyDetection}
                    disabled={runningAnomalyDetect}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${runningAnomalyDetect ? 'animate-spin' : ''}`} />
                    <span>{runningAnomalyDetect ? 'Running Statistical & ML Scans...' : 'Scan For Anomalies'}</span>
                  </button>
                </div>
              </div>
            </div>

            {anomalyError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{anomalyError}</span>
              </div>
            )}

            {/* Triage & Nature Filters Bar */}
            {anomalies.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">Classification:</span>
                  <button
                    onClick={() => setAnomalyNatureFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    All ({anomalies.length})
                  </button>
                  <button
                    onClick={() => setAnomalyNatureFilter('confirmed_business_issue')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'confirmed_business_issue'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    Confirmed Issues ({anomalyMetrics.confirmedIssues})
                  </button>
                  <button
                    onClick={() => setAnomalyNatureFilter('detected_anomaly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'detected_anomaly'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    Detected Anomalies ({anomalyMetrics.detectedAnomalies})
                  </button>
                  <button
                    onClick={() => setAnomalyNatureFilter('statistical_outlier')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'statistical_outlier'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                    }`}
                  >
                    Statistical Outliers ({anomalyMetrics.statisticalOutliers})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Triage:</span>
                  <select
                    value={anomalyStatusFilter}
                    onChange={(e) => setAnomalyStatusFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="open">Open Only</option>
                    <option value="reviewed">Reviewed Only</option>
                    <option value="dismissed">Dismissed Only</option>
                  </select>
                </div>
              </div>
            )}

            {/* Empty state when no anomalies */}
            {anomalies.length === 0 && !runningAnomalyDetect && (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                  <AlertOctagon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Anomaly Detection Engine Ready</h3>
                <p className="text-slate-500 max-w-md text-xs mb-6">
                  Run a scan to evaluate statistical outlier bounds (Z-Score & IQR) and multidimensional Isolation Forest paths without false fraud accusations.
                </p>
                <button
                  onClick={runAnomalyDetection}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Scan Dataset Now
                </button>
              </div>
            )}

            {/* Anomaly Cards List */}
            {filteredAnomalies.length > 0 && (
              <div className="space-y-4">
                {filteredAnomalies.map((item) => {
                  const isConfirmed = item.nature === 'confirmed_business_issue';
                  const isOutlier = item.nature === 'statistical_outlier';
                  const isAnomaly = item.nature === 'detected_anomaly';

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md ${
                        item.status === 'dismissed' 
                          ? 'opacity-60 border-slate-200 bg-slate-50/50' 
                          : isConfirmed
                            ? 'border-rose-200 ring-1 ring-rose-100'
                            : isOutlier
                              ? 'border-indigo-200'
                              : 'border-amber-200'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          {/* Badges row */}
                          <div className="flex flex-wrap items-center gap-2">
                            {isConfirmed && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                                Confirmed Business Issue
                              </span>
                            )}
                            {isAnomaly && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Detected Anomaly
                              </span>
                            )}
                            {isOutlier && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                                Statistical Outlier (Non-Defective)
                              </span>
                            )}

                            <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 uppercase">
                              {item.method.replace('_', ' ')}
                            </span>

                            {item.row_index != null && (
                              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-600">
                                Row #{item.row_index}
                              </span>
                            )}

                            <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                              Metric: <strong className="font-semibold">{item.column_name}</strong>
                            </span>

                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                              item.status === 'reviewed' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : item.status === 'dismissed' 
                                  ? 'bg-slate-200 text-slate-700' 
                                  : 'bg-rose-100 text-rose-800'
                            }`}>
                              Status: {item.status.toUpperCase()}
                            </span>
                          </div>

                          {/* Title & Business Explanation */}
                          <div>
                            <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.explanation}</p>
                          </div>

                          {/* Contextual dimension tags if available */}
                          {item.details?.row_context && Object.keys(item.details.row_context).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {Object.entries(item.details.row_context).map(([k, v]) => (
                                <span key={k} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                                  <strong className="text-slate-800 capitalize">{k.replace('_', ' ')}:</strong> {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Observed vs Expected Baseline & Triage Controls */}
                        <div className="flex lg:flex-col items-end justify-between lg:justify-start gap-4 lg:min-w-[200px] border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-6">
                          <div className="text-right">
                            <div className="text-xs text-slate-500 font-medium">Observed vs Expected</div>
                            <div className="text-lg font-extrabold text-slate-900">
                              ${item.observed_value.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">
                              Baseline: ${item.expected_value.toLocaleString()}
                            </div>
                            <div className="text-xs text-indigo-600 font-semibold mt-1">
                              Score: {Math.round(item.score * 100)}% Confidence
                            </div>
                          </div>

                          {/* Triage action buttons */}
                          <div className="flex items-center gap-2">
                            {item.status === 'open' ? (
                              <>
                                <button
                                  onClick={() => updateAnomalyStatus(item.id, 'reviewed')}
                                  title="Mark as reviewed"
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                                <button
                                  onClick={() => updateAnomalyStatus(item.id, 'dismissed')}
                                  title="Dismiss anomaly"
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Dismiss</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => updateAnomalyStatus(item.id, 'open')}
                                title="Re-open anomaly"
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                Re-open
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Methodology & Limitations Box */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Z-Score Parametric Model
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Evaluates observations against mean and standard deviation (|z| &gt; 2.5). Invariants like negative revenues are immediately escalated.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Tukey's IQR Fences
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Distribution-free quartile spread [Q1 - 1.5×IQR, Q3 + 1.5×IQR]. Robust against heavy skewness and extreme tail distortion.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Isolation Forest ML
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Unsupervised decision tree partitioning. Measures structural isolation across multiple continuous dimensions simultaneously.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 1.95: CUSTOMER & PRODUCT SEGMENTATION */}
        {(activeTab === 'segments' || activeTab === 'all') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Customer & Product Segmentation Suite
                </h2>
                <p className="text-sm text-slate-500">
                  Behavioral RFM quintiles, multidimensional K-Means with Silhouette validation, and Pareto ABC inventory analysis.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Deterministic Behavioral & Statistical Clustering</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Methodology
                  </label>
                  <select
                    value={selectedSegMethod}
                    onChange={(e) => setSelectedSegMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="auto">Auto (Smart Schema Detect)</option>
                    <option value="rfm">RFM Customer Segmentation</option>
                    <option value="kmeans">K-Means Multi-Feature Clustering</option>
                    <option value="abc_pareto">ABC / Pareto Product Analysis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Entity Identifier
                  </label>
                  <select
                    value={selectedSegEntity}
                    onChange={(e) => setSelectedSegEntity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {segSchema?.entity_columns?.map((col: string) => (
                      <option key={col} value={col}>{col.replace('_', ' ').toUpperCase()}</option>
                    )) || (
                      <option value="customer_name">CUSTOMER NAME</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Monetary / Spend Metric
                  </label>
                  <select
                    value={selectedSegMonetary}
                    onChange={(e) => setSelectedSegMonetary(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {segSchema?.monetary_columns?.map((col: string) => (
                      <option key={col} value={col}>{col.replace('_', ' ').toUpperCase()}</option>
                    )) || (
                      <option value="revenue">REVENUE</option>
                    )}
                  </select>
                </div>

                {selectedSegMethod === 'rfm' || selectedSegMethod === 'auto' ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Date Column (Recency)
                    </label>
                    <select
                      value={selectedSegDate}
                      onChange={(e) => setSelectedSegDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      {segSchema?.date_columns?.map((col: string) => (
                        <option key={col} value={col}>{col.replace('_', ' ').toUpperCase()}</option>
                      )) || (
                        <option value="order_date">ORDER DATE</option>
                      )}
                    </select>
                  </div>
                ) : selectedSegMethod === 'kmeans' ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Clusters (k)
                    </label>
                    <select
                      value={selectedKmeansK}
                      onChange={(e) => setSelectedKmeansK(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value={2}>2 Clusters</option>
                      <option value={3}>3 Clusters</option>
                      <option value={4}>4 Clusters</option>
                      <option value={5}>5 Clusters</option>
                      <option value={6}>6 Clusters</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Pareto Cutoffs
                    </label>
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 font-medium">
                      80% / 15% / 5%
                    </div>
                  </div>
                )}

                <div>
                  <button
                    onClick={runSegmentation}
                    disabled={runningSegmentation}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${runningSegmentation ? 'animate-spin' : ''}`} />
                    <span>{runningSegmentation ? 'Clustering Data...' : 'Generate Segments'}</span>
                  </button>
                </div>
              </div>
            </div>

            {segmentationError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{segmentationError}</span>
              </div>
            )}

            {/* Empty state */}
            {!segmentationResult && !runningSegmentation && (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Customer & Product Segmentation Ready</h3>
                <p className="text-slate-500 max-w-md text-xs mb-6">
                  Select your model above to classify accounts into behavioral RFM tiers, multi-feature K-Means clusters, or ABC Pareto catalog classes.
                </p>
                <button
                  onClick={runSegmentation}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Run Segmentation Now
                </button>
              </div>
            )}

            {/* Results Display */}
            {segmentationResult && segmentationResult.segments && segmentationResult.segments.length > 0 && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Entities</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                      {segmentationResult.total_entities?.toLocaleString() || segmentationResult.segments.reduce((acc, s) => acc + s.member_count, 0)}
                    </div>
                    <div className="text-xs text-indigo-600 font-medium mt-1">
                      Method: {segmentationResult.method.toUpperCase()}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Gross Monitored Value</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                      ${(segmentationResult.total_monetary || segmentationResult.segments.reduce((acc, s) => acc + s.total_monetary, 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Cumulative spend across segments</div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Tier Dominance</div>
                    <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                      {segmentationResult.segments[0]?.percentage_of_monetary}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {segmentationResult.segments[0]?.label} revenue share
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {segmentationResult.silhouette_score != null ? 'Silhouette Validation' : 'Active Segments'}
                    </div>
                    <div className="text-2xl font-extrabold text-indigo-900 mt-1">
                      {segmentationResult.silhouette_score != null 
                        ? segmentationResult.silhouette_score 
                        : `${segmentationResult.segments.length} Tiers`}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {segmentationResult.silhouette_score != null ? 'Cluster separation score [-1, 1]' : 'Distinct business classifications'}
                    </div>
                  </div>
                </div>

                {/* Master-Detail Segment Explorer */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: Segments List */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Identified Segments ({segmentationResult.segments.length})
                    </div>
                    {segmentationResult.segments.map((seg, idx) => {
                      const isSelected = activeSegmentIndex === idx;
                      return (
                        <div
                          key={seg.label + idx}
                          onClick={() => setActiveSegmentIndex(idx)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-50/60 border-indigo-400 shadow-sm ring-1 ring-indigo-300' 
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">{seg.label}</h4>
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {seg.percentage_of_monetary}% Rev
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{seg.subtitle}</p>

                          {/* Dual metric progress bar: Member share vs Revenue share */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-600">
                              <span>Revenue Contribution (${seg.total_monetary.toLocaleString()})</span>
                              <span className="font-semibold">{seg.percentage_of_monetary}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, seg.percentage_of_monetary)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Customer Share ({seg.member_count} members)</span>
                              <span>{seg.percentage_of_members}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-slate-400 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, seg.percentage_of_members)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Active Segment Deep Dive */}
                  <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    {segmentationResult.segments[activeSegmentIndex] && (() => {
                      const activeSeg = segmentationResult.segments[activeSegmentIndex];
                      return (
                        <>
                          <div className="border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                                Segment Details
                              </span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-500">
                                {activeSeg.member_count} Members ({activeSeg.percentage_of_members}% of total)
                              </span>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900">{activeSeg.label}</h3>
                            <p className="text-sm text-slate-600 mt-1">{activeSeg.subtitle}</p>
                          </div>

                          {/* Profile Statistics Grid */}
                          {activeSeg.profile && (() => {
                            const prof = activeSeg.profile;
                            return (
                              <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                                  Behavioral Centroid Profile
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {prof.avg_recency_days != null && (
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                      <div className="text-[11px] text-slate-500 font-medium">Avg Recency</div>
                                      <div className="text-base font-bold text-slate-900 mt-0.5">
                                        {prof.avg_recency_days} days
                                      </div>
                                      <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                        R-Score: {prof.avg_r_score} / 5
                                      </div>
                                    </div>
                                  )}

                                  {prof.avg_frequency != null && (
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                      <div className="text-[11px] text-slate-500 font-medium">Avg Orders</div>
                                      <div className="text-base font-bold text-slate-900 mt-0.5">
                                        {prof.avg_frequency} txns
                                      </div>
                                      <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                        F-Score: {prof.avg_f_score} / 5
                                      </div>
                                    </div>
                                  )}

                                  {prof.avg_monetary != null && (
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                      <div className="text-[11px] text-slate-500 font-medium">Avg Spend</div>
                                      <div className="text-base font-bold text-slate-900 mt-0.5">
                                        ${prof.avg_monetary.toLocaleString()}
                                      </div>
                                      <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                        M-Score: {prof.avg_m_score} / 5
                                      </div>
                                    </div>
                                  )}

                                  {prof.centroids && Object.entries(prof.centroids).map(([feat, val]) => (
                                    <div key={feat} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                      <div className="text-[11px] text-slate-500 font-medium capitalize">{feat.replace('_', ' ')}</div>
                                      <div className="text-base font-bold text-slate-900 mt-0.5">
                                        {Number(val).toLocaleString()}
                                      </div>
                                      {prof.global_averages && prof.global_averages[feat] != null && (
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                          Global: {prof.global_averages[feat]}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Actionable Strategy Playbook */}
                          {activeSeg.recommendation && (
                            <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-1 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                Actionable Business Playbook
                              </h4>
                              <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                                {activeSeg.recommendation}
                              </p>
                            </div>
                          )}

                          {/* Sample Members Table */}
                          {activeSeg.sample_members && activeSeg.sample_members.length > 0 && (
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Representative Segment Members
                              </div>
                              <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                                    <tr>
                                      <th className="px-3 py-2">Entity</th>
                                      {activeSeg.sample_members[0].monetary != null && <th className="px-3 py-2">Monetary</th>}
                                      {activeSeg.sample_members[0].revenue != null && <th className="px-3 py-2">Revenue</th>}
                                      {activeSeg.sample_members[0].frequency != null && <th className="px-3 py-2">Orders</th>}
                                      {activeSeg.sample_members[0].recency_days != null && <th className="px-3 py-2">Recency</th>}
                                      {activeSeg.sample_members[0].r_score != null && <th className="px-3 py-2">R / F / M</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {activeSeg.sample_members.map((m, mIdx) => (
                                      <tr key={mIdx} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-2 font-bold text-slate-900">{m.entity || m.product || `Entity #${mIdx + 1}`}</td>
                                        {m.monetary != null && <td className="px-3 py-2 font-semibold text-indigo-600">${m.monetary.toLocaleString()}</td>}
                                        {m.revenue != null && <td className="px-3 py-2 font-semibold text-indigo-600">${m.revenue.toLocaleString()}</td>}
                                        {m.frequency != null && <td className="px-3 py-2">{m.frequency}</td>}
                                        {m.recency_days != null && <td className="px-3 py-2">{m.recency_days}d ago</td>}
                                        {m.r_score != null && (
                                          <td className="px-3 py-2 font-mono text-slate-500">
                                            {m.r_score}-{m.f_score}-{m.m_score}
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Methodology Reference Box */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      RFM Behavioral Quantiles
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Scores Recency, Frequency, and Monetary parameters on standardized 1-5 rank percentiles to build actionable customer lifecycle cohorts.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-indigo-600" />
                      K-Means with Silhouette Validation
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Evaluates multi-feature clusters using standardized Euclidean distance. Automatically discovers optimal separation without arbitrary guessing.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      ABC Pareto Catalog Distribution
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Decomposes inventory revenue into Class A core drivers (top 80%), Class B steady contributors (15%), and Class C long-tail SKUs (5%).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 1.98: PRESCRIPTIVE RECOMMENDATIONS & EXECUTIVE REPORTS */}
        {(activeTab === 'reports' || activeTab === 'all') && (
          <section className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Prescriptive Recommendations & Executive Briefing
                </h2>
                <p className="text-sm text-slate-500">
                  Cross-layer synthesis translating empirical metrics, forecasts, anomalies, and customer cohorts into prioritized actions and boardroom-ready briefs.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Empirically Grounded Prescriptive Strategy</span>
              </div>
            </div>

            {/* Generator Card & Report Switcher */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Boardroom Briefing Generator
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Compile Automated Executive Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Synthesizes verified KPIs, strategic findings, forward projections, detected risks, and prioritized recommendations into structured JSON and publishable Markdown.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={reportTitleInput}
                    onChange={(e) => setReportTitleInput(e.target.value)}
                    placeholder="Report title (e.g. Q4 Executive Briefing)"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[280px]"
                  />
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                  >
                    <FileText className={`w-4 h-4 ${generatingReport ? 'animate-spin' : ''}`} />
                    {generatingReport ? 'Compiling Report...' : 'Compile Briefing'}
                  </button>
                </div>
              </div>

              {/* Historical Reports Drawer & Quick Switcher */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Compiled Reports:
                  </span>
                  {reportsList.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No reports compiled yet</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {reportsList.map((rep) => {
                        const isCurrent = activeReport?.id === rep.id;
                        return (
                          <button
                            key={rep.id}
                            onClick={() => loadReportDetails(rep.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                            <span className="truncate max-w-[160px]">{rep.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleRefreshRecommendations}
                  disabled={loadingRecommendations}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRecommendations ? 'animate-spin' : ''}`} />
                  Refresh Recommendations
                </button>
              </div>
            </div>

            {/* Prescriptive Recommendations Cards Header & Filters */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-600" />
                    Prioritized Prescriptive Playbooks
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {filteredRecommendations.length} {filteredRecommendations.length === 1 ? 'Action' : 'Actions'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Concrete, empirical recommendations ranked by business priority and risk exposure.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500">Priority:</label>
                    <select
                      value={recPriorityFilter}
                      onChange={(e) => setRecPriorityFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">All Priorities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500">Category:</label>
                    <select
                      value={recCategoryFilter}
                      onChange={(e) => setRecCategoryFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="risk_mitigation">Risk Mitigation</option>
                      <option value="customer_retention">Customer Retention</option>
                      <option value="revenue_growth">Revenue Growth</option>
                      <option value="inventory_optimization">Inventory Optimization</option>
                      <option value="operational_efficiency">Operational Efficiency</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Recommendations Grid */}
              {filteredRecommendations.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-slate-700">No Pending Strategic Alerts</div>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    {recommendations.length > 0
                      ? 'No recommendations match your current priority and category filter.'
                      : 'All data integrity invariants and operational metrics are currently stable. Run additional analyses to identify new growth vectors.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredRecommendations.map((rec) => {
                    const isCritical = rec.priority === 'critical';
                    const isHigh = rec.priority === 'high';
                    const isMedium = rec.priority === 'medium';
                    const isExpanded = expandedRecId === rec.id;

                    let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                    let icon = <CheckCircle className="w-4 h-4 text-slate-600" />;
                    if (isCritical) {
                      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                      icon = <AlertOctagon className="w-4 h-4 text-rose-600" />;
                    } else if (isHigh) {
                      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                      icon = <AlertTriangle className="w-4 h-4 text-amber-600" />;
                    } else if (isMedium) {
                      badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                      icon = <Info className="w-4 h-4 text-blue-600" />;
                    }

                    const categoryLabels: Record<string, string> = {
                      risk_mitigation: 'Risk Mitigation',
                      customer_retention: 'Customer Retention',
                      revenue_growth: 'Revenue Growth',
                      inventory_optimization: 'Inventory & Catalog',
                      operational_efficiency: 'Operations & Scaling',
                    };

                    return (
                      <div
                        key={rec.id}
                        className={`bg-white rounded-2xl border transition-all p-6 shadow-sm hover:shadow-md flex flex-col justify-between ${
                          isCritical
                            ? 'border-rose-200/90'
                            : isHigh
                            ? 'border-amber-200/90'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="space-y-4">
                          {/* Priority and Category Tag */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${badgeColor}`}>
                              {icon}
                              {rec.priority} Priority
                            </span>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full capitalize">
                              {categoryLabels[rec.category] || rec.category.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Recommendation Title */}
                          <h4 className="text-base font-bold text-slate-900 leading-snug">
                            {rec.title}
                          </h4>

                          {/* Impact Highlight Banner */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-2.5">
                            <span className="text-sm">⚡</span>
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estimated Impact</div>
                              <div className="text-xs text-slate-800 font-medium mt-0.5">{rec.impact_summary}</div>
                            </div>
                          </div>

                          {/* Empirical Rationale */}
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Empirical Rationale
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                              {rec.rationale}
                            </p>
                          </div>

                          {/* Action Plan Steps */}
                          {rec.action_plan && rec.action_plan.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                                <span>🎯</span> Recommended Action Steps
                              </div>
                              <div className="space-y-1.5">
                                {rec.action_plan.map((step, sIdx) => (
                                  <div key={sIdx} className="flex items-start gap-2 text-xs text-slate-800 bg-indigo-50/30 p-2 rounded-lg border border-indigo-100/40">
                                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                                      {sIdx + 1}
                                    </span>
                                    <span className="font-medium leading-relaxed">{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Evidence Collapsible */}
                        {rec.evidence && Object.keys(rec.evidence).length > 0 && (
                          <div className="mt-5 pt-3 border-t border-slate-100">
                            <button
                              onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                            >
                              <Database className="w-3 h-3" />
                              {isExpanded ? 'Hide Data Citations' : 'Inspect Data Citations'}
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {isExpanded && (
                              <div className="mt-2.5 p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800">
                                <pre>{JSON.stringify(rec.evidence, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compiled Executive Report Viewer */}
            {activeReport && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Report Header Bar */}
                <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Executive Briefing Document
                      <span>•</span>
                      <span>{activeReport.content?.generated_at || new Date(activeReport.created_at || '').toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                      {activeReport.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Dataset: <span className="font-semibold text-white">{activeReport.content?.dataset_name || dataset?.name}</span>
                    </p>
                  </div>

                  {/* Actions & Export toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View mode toggle */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-1 flex items-center">
                      <button
                        onClick={() => setReportViewMode('document')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          reportViewMode === 'document' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Document
                      </button>
                      <button
                        onClick={() => setReportViewMode('markdown')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          reportViewMode === 'markdown' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Markdown
                      </button>
                    </div>

                    <button
                      onClick={() => handleCopyMarkdown()}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                      title="Copy full Markdown report to clipboard"
                    >
                      {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedReport ? 'Copied' : 'Copy'}
                    </button>

                    <button
                      onClick={() => handleDownloadReport(activeReport)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shadow-sm"
                      title="Download Markdown Report File"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download (.md)
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                      title="Print or Save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </button>
                  </div>
                </div>

                {/* Report Body */}
                <div className="p-6 md:p-8">
                  {reportViewMode === 'document' ? (
                    <div className="space-y-8 max-w-5xl mx-auto">
                      {/* Executive Summary Callout */}
                      {activeReport.content?.executive_summary && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            Executive Briefing & Strategic Overview
                          </h4>
                          <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
                            {activeReport.content.executive_summary.map((para, pIdx) => (
                              <p key={pIdx} className="font-normal">{para}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* KPI Performance Grid */}
                      {activeReport.content?.kpis && activeReport.content.kpis.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                            Key Performance Indicators
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {activeReport.content.kpis.map((kpi, kIdx) => (
                              <div key={kIdx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
                                <div className="text-xs text-slate-500 font-medium">{kpi.label}</div>
                                <div className="text-xl font-bold text-slate-900 mt-1">{kpi.value}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{kpi.detail}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cross-Layer Modules Presence Flags */}
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700">
                        <span className="font-bold text-indigo-900 uppercase text-[10px] tracking-wider">Synthesized Modules:</span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Deterministic Metrics
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> AI Insights
                        </span>
                        <span className="flex items-center gap-1.5">
                          {activeReport.content?.has_forecast ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />} Time-Series Forecasts
                        </span>
                        <span className="flex items-center gap-1.5">
                          {activeReport.content?.has_anomalies ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />} Anomaly Risk Audit
                        </span>
                        <span className="flex items-center gap-1.5">
                          {activeReport.content?.has_segments ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />} Customer & Catalog Segmentation
                        </span>
                      </div>

                      {/* Strategic Playbook Summary */}
                      {activeReport.content?.recommendations && activeReport.content.recommendations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                            Executive Action Matrix ({activeReport.content.recommendations.length} Items)
                          </h4>
                          <div className="space-y-3">
                            {activeReport.content.recommendations.map((rec, rIdx) => (
                              <div key={rIdx} className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                      {rec.priority}
                                    </span>
                                    <span className="text-xs text-slate-500 capitalize">
                                      {rec.category.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <div className="text-sm font-bold text-slate-900">{rec.title}</div>
                                  <div className="text-xs text-slate-600">{rec.impact_summary}</div>
                                </div>
                                <div className="text-xs text-indigo-600 font-semibold md:text-right flex-shrink-0">
                                  {rec.action_plan?.length || 0} Step Action Plan
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Raw Markdown view */
                    <div className="relative">
                      <pre className="p-6 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed max-h-[700px] border border-slate-800">
                        {activeReport.content?.markdown_content || '# No markdown available'}
                      </pre>
                    </div>
                  )}
                </div>
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
