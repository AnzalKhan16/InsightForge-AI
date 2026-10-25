"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Area, AreaChart, ComposedChart 
} from 'recharts';
import { 
  ArrowUpRight, TrendingUp, Users, DollarSign, ShoppingCart, Activity, RefreshCw,
  Sparkles, ShieldCheck, AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronUp,
  Layers, Filter, Database, CheckCircle2, MessageSquare, Send, CornerDownRight,
  HelpCircle, BarChart3, Search, Calendar, Gauge, ShieldAlert, EyeOff, Check, X,
  FileText, Download, Copy, Printer, CheckCircle, Target, Clock, ArrowRight, ExternalLink
} from 'lucide-react';

const COLORS = ['#ff3c02', '#fa7041', '#f45b31', '#ffba86', '#e04318', '#ffa266'];

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
  reporting_period?: string;
  analytical_scope?: string;
  assumptions?: string[];
  limitations?: string[];
  content?: {
    title: string;
    dataset_name: string;
    dataset_id?: string;
    version_id?: string;
    generated_at: string;
    generated_time?: string;
    reporting_period?: string;
    analytical_scope?: string;
    assumptions?: string[];
    limitations?: string[];
    executive_summary: string[];
    kpis: Array<{ label: string; value: string; detail: string }>;
    recommendations: RecommendationItem[];
    has_forecast: boolean;
    forecast_model?: string;
    forecast_points?: any[];
    has_anomalies: boolean;
    anomalies?: any[];
    has_segments: boolean;
    segments?: any[];
    markdown_content: string;
    html_content?: string;
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
  const { token, user, setAuth } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const datasetId = params.datasetId as string;

  const [mounted, setMounted] = useState(false);
  const [dataset, setDataset] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
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

  const handleDownloadReport = async (fmt: 'markdown' | 'html' | 'json' = 'markdown', rep?: ExecutiveReportItem | null) => {
    const target = rep || activeReport;
    if (!target) {
      alert("No report available for download");
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/workspaces/${workspaceId}/reports/${target.id}/download?format=${fmt}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get('content-disposition');
        let filename = `${(target.title || 'executive_report').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${fmt === 'html' ? 'html' : fmt === 'json' ? 'json' : 'md'}`;
        if (disposition && disposition.indexOf('filename=') !== -1) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      console.warn("Direct download endpoint failed, falling back to local memory buffer", err);
    }

    // Local in-memory buffer fallback
    let blob: Blob;
    let ext = 'md';
    if (fmt === 'html') {
      const htmlText = target.content?.html_content || '';
      blob = new Blob([htmlText], { type: 'text/html;charset=utf-8;' });
      ext = 'html';
    } else if (fmt === 'json') {
      blob = new Blob([JSON.stringify(target, null, 2)], { type: 'application/json;charset=utf-8;' });
      ext = 'json';
    } else {
      blob = new Blob([target.content?.markdown_content || ''], { type: 'text/markdown;charset=utf-8;' });
      ext = 'md';
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanTitle = (target.title || 'executive_report').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    link.setAttribute('download', `${cleanTitle}.${ext}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenPresentationView = async (rep?: ExecutiveReportItem | null) => {
    const target = rep || activeReport;
    if (!target) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/workspaces/${workspaceId}/reports/${target.id}/view`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        return;
      }
    } catch (e) {
      console.warn('Could not fetch /view endpoint, using local content', e);
    }
    if (target.content?.html_content) {
      const blob = new Blob([target.content.html_content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
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

  const fetchData = async (activeAuthToken?: string) => {
    const currentToken = activeAuthToken || token;
    if (!currentToken) return;
    try {
      setLoading(true);
      setFetchError(null);
      const [ds, an, ins, fcSchema, fcs, anoms, sSchema, sResult, recs, reps] = await Promise.all([
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/analyses`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
        apiFetch<InsightItem[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/insights`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}/forecast/schema`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }).catch(() => null),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/forecasts`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }).catch(() => []),
        apiFetch<AnomalyItem[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/anomalies`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }).catch(() => []),
        apiFetch<SegmentationSchema>(`/workspaces/${workspaceId}/datasets/${datasetId}/segmentation/schema`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }).catch(() => null),
        apiFetch<any>(`/workspaces/${workspaceId}/datasets/${datasetId}/segments`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }).catch(() => null),
        apiFetch<{ recommendations: RecommendationItem[] }>(`/workspaces/${workspaceId}/datasets/${datasetId}/recommendations`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }).catch(() => ({ recommendations: [] })),
        apiFetch<any[]>(`/workspaces/${workspaceId}/datasets/${datasetId}/reports`, {
          headers: { Authorization: `Bearer ${currentToken}` },
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
      setFetchError(err.message || 'Failed to load analytics data.');
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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let isSubscribed = true;

    const initAuthAndFetch = async () => {
      let currentToken = token;
      if (!currentToken || !user) {
        try {
          const loginRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/auth/login`, {
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
            if (isSubscribed) {
              setAuth(authData.access_token, {
                id: '7a99714b32364f8fb36135428ab46443',
                email: 'demo@insightforge.ai',
                full_name: 'Executive Demo User',
              });
            }
          }
        } catch (err) {
          console.warn("Auto-login fallback error", err);
        }
      }

      if (isSubscribed) {
        if (currentToken) {
          fetchData(currentToken);
        } else {
          setLoading(false);
        }
      }
    };

    initAuthAndFetch();

    return () => {
      isSubscribed = false;
    };
  }, [mounted, token, user, workspaceId, datasetId]);

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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col">
        <Navbar workspaceId={workspaceId} datasetId={datasetId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-[#9ca3af] bg-[#0c0d12] border border-white/10 px-6 py-4 rounded-full shadow-2xl">
            <div className="w-5 h-5 rounded-full border-2 border-[#ff3c02] border-t-transparent animate-spin" />
            <span className="text-sm font-semibold">Initializing Workspace Session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !dataset && analyses.length === 0 && insights.length === 0) {
    return (
      <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col">
        <Navbar workspaceId={workspaceId} datasetId={datasetId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center bg-[#0c0d12] border border-white/10 px-10 py-8 rounded-3xl shadow-2xl max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-[#ff3c02]/10 border border-[#ff3c02]/30 flex items-center justify-center text-[#ff3c02]">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Loading Intelligence Suite</h3>
              <p className="text-xs text-[#9ca3af]">Connecting to analytical engines, neural forecasts, and executive reports...</p>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-[#ff3c02] border-t-transparent animate-spin mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (fetchError && !dataset) {
    return (
      <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col">
        <Navbar workspaceId={workspaceId} datasetId={datasetId} />
        <div className="flex-1 p-8 max-w-3xl mx-auto w-full flex items-center justify-center">
          <div className="p-8 bg-[#140b0b] border border-rose-500/30 text-rose-200 rounded-3xl shadow-2xl flex flex-col items-center text-center gap-4">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Failed to Load Analytics Suite</h3>
              <p className="text-xs text-rose-300/80 max-w-md">{fetchError}</p>
            </div>
            <button
              onClick={() => fetchData()}
              className="mt-2 px-5 py-2.5 rounded-full bg-[#ff3c02] hover:bg-[#fa7041] text-white text-xs font-bold transition-all shadow-lg shadow-[#ff3c02]/25"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#f4f4f6] font-sans flex flex-col selection:bg-[#ff3c02] selection:text-white">
      <Navbar workspaceId={workspaceId} datasetId={datasetId} />
      <div className="flex-1 p-6 md:p-10">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm text-[#9ca3af]">
            <button onClick={() => router.push(`/workspaces/${workspaceId}`)} className="hover:text-[#fa7041] transition-colors">Datasets</button>
            <span>/</span>
            <button onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}`)} className="hover:text-[#fa7041] truncate max-w-[200px] transition-colors">{dataset?.name}</button>
            <span>/</span>
            <span className="font-semibold text-white">Business Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">Analytics & AI Insights</h1>
            <span className="bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Grounded Strategic Engine
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={generateInsights}
            disabled={submittingInsights}
            className="flex items-center gap-2 bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white px-6 py-2.5 rounded-full transition-all shadow-lg shadow-[#ff3c02]/30 disabled:opacity-50 font-bold text-xs"
          >
            <Sparkles className={`w-4 h-4 ${submittingInsights ? 'animate-spin text-white' : 'text-white'}`} />
            {submittingInsights ? 'Synthesizing Grounded Insights...' : 'Generate AI Insights'}
          </button>
          
          <button 
            onClick={runAnalytics}
            disabled={submittingAnalysis}
            className="flex items-center gap-2 bg-[#14151b] border border-white/10 text-slate-200 px-5 py-2.5 rounded-full hover:bg-[#1e1f28] transition-colors shadow-sm disabled:opacity-50 font-semibold text-xs"
          >
            <RefreshCw className={`w-4 h-4 ${submittingAnalysis ? 'animate-spin text-[#fa7041]' : ''}`} />
            {submittingAnalysis ? 'Refreshing...' : 'Recalculate Metrics'}
          </button>
        </div>
      </header>

      {/* Navigation Tabs - Cryptox Pill Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 mb-8 pb-4 gap-4">
        <div className="p-1.5 rounded-full bg-[#0c0d12] border border-white/10 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'insights' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Executive AI Insights
            <span className={`text-[10px] px-2 py-0.2 rounded-full ${activeTab === 'insights' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'}`}>
              {insights.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('nlq')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'nlq' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Ask Data (NL Query)
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'forecast' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Forecasting
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'anomalies' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            Anomaly Detection
            {anomalies.length > 0 && (
              <span className={`text-[10px] px-2 py-0.2 rounded-full ${activeTab === 'anomalies' ? 'bg-white/20 text-white' : 'bg-[#ff3c02]/20 text-[#fa7041] font-bold'}`}>
                {anomalies.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'segments' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            Segmentation (RFM / K-Means / ABC)
            {segmentationResult?.segments && segmentationResult.segments.length > 0 && (
              <span className={`text-[10px] px-2 py-0.2 rounded-full ${activeTab === 'segments' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300 font-bold'}`}>
                {segmentationResult.segments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'reports' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            Executive Reports & Actions
            {recommendations.length > 0 && (
              <span className={`text-[10px] px-2 py-0.2 rounded-full ${activeTab === 'reports' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300 font-bold'}`}>
                {recommendations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('charts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'charts' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            Visual KPIs & Trends
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
              activeTab === 'all' 
                ? 'bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30 font-bold' 
                : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            Complete Overview
          </button>
        </div>

        {/* Zero-hallucination trust badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
                <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#fa7041]" />
                  Strategic Findings & Executive Interpretation
                </h2>
                <p className="text-xs md:text-sm text-[#9ca3af] mt-1">
                  Insights synthesized directly from verified quantitative aggregations. Mathematical calculations are strictly deterministic.
                </p>
              </div>

              {/* Filters */}
              {insights.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#9ca3af] mr-1">
                    <Filter className="w-3.5 h-3.5 text-[#fa7041]" /> Filter:
                  </div>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="text-xs bg-[#0c0d12] border border-white/10 rounded-xl px-3 py-1.5 text-slate-200 shadow-sm focus:outline-none focus:border-[#ff3c02]"
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
                      className="text-xs bg-[#0c0d12] border border-white/10 rounded-xl px-3 py-1.5 text-slate-200 shadow-sm focus:outline-none focus:border-[#ff3c02]"
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
              <div className="bg-[#0c0d12] p-12 rounded-3xl shadow-2xl border border-white/10 text-center flex flex-col items-center justify-center min-h-[350px]">
                <div className="w-16 h-16 bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No AI Business Insights Generated Yet</h3>
                <p className="text-[#9ca3af] mb-6 max-w-lg text-xs md:text-sm">
                  Run the insight engine to extract verified facts, compute trends, and generate strategic recommendations anchored to analytical evidence.
                </p>
                <button 
                  onClick={generateInsights} 
                  disabled={submittingInsights}
                  className="bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white px-7 py-3 rounded-full transition-all font-bold shadow-lg shadow-[#ff3c02]/30 flex items-center gap-2 text-xs disabled:opacity-50 active:scale-98"
                >
                  <Sparkles className={`w-4 h-4 ${submittingInsights ? 'animate-spin' : ''}`} />
                  {submittingInsights ? 'Generating Grounded Insights...' : 'Synthesize First Insights'}
                </button>
              </div>
            ) : filteredInsights.length === 0 ? (
              <div className="bg-[#0c0d12] p-8 rounded-3xl border border-white/10 text-center text-[#9ca3af] text-xs">
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
                <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#fa7041]" />
                  Natural Language Analytics & Data Querying
                </h2>
                <p className="text-xs md:text-sm text-[#9ca3af] mt-1">
                  Ask conversational business questions. Computations are strictly executed using deterministic analytics engines.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sandboxed Query Execution</span>
              </div>
            </div>

            {/* Search Prompt Input & Quick Pills */}
            <div className="bg-[#0c0d12] p-6 md:p-8 rounded-3xl shadow-2xl border border-white/10 space-y-4">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNlQuery();
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nlQuestion}
                    onChange={(e) => setNlQuestion(e.target.value)}
                    placeholder="Ask anything (e.g. Which products generated the most revenue? Compare this quarter with previous quarter...)"
                    className="w-full pl-12 pr-4 py-3 bg-[#060709] border border-white/10 rounded-2xl text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#ff3c02] focus:ring-1 focus:ring-[#ff3c02] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingNlQuery || !nlQuestion.trim()}
                  className="bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] disabled:opacity-50 text-white px-7 py-3 rounded-full font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ff3c02]/30 transition-all cursor-pointer active:scale-98"
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
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider flex items-center gap-1.5 mr-1">
                  <HelpCircle className="w-3.5 h-3.5 text-[#fa7041]" /> Try asking:
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
                    className="text-xs bg-[#14151b] hover:bg-[#ff3c02]/15 hover:text-white hover:border-[#ff3c02]/40 text-slate-300 px-3.5 py-1.5 rounded-full border border-white/10 transition-all cursor-pointer shadow-sm"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Alert */}
            {nlError && (
              <div className="p-4 bg-[#1a0c0c] border border-rose-500/30 rounded-2xl text-rose-300 text-xs md:text-sm flex items-center gap-2.5 shadow-xl">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{nlError}</span>
              </div>
            )}

            {/* Empty State before any query */}
            {!nlResult && !submittingNlQuery && !nlError && (
              <div className="bg-[#0c0d12] p-10 rounded-3xl shadow-2xl border border-white/10 text-center flex flex-col items-center justify-center min-h-[220px]">
                <div className="w-12 h-12 bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 rounded-2xl flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Interactive Conversational BI</h3>
                <p className="text-xs text-[#9ca3af] max-w-md">
                  Type any business query or select a quick question above to run deterministic aggregations, produce markdown analysis, and generate interactive charts.
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {submittingNlQuery && (
              <div className="bg-[#0c0d12] p-12 rounded-3xl border border-white/10 text-center flex flex-col items-center justify-center space-y-3 shadow-2xl">
                <RefreshCw className="w-8 h-8 text-[#fa7041] animate-spin" />
                <p className="text-sm font-semibold text-white">Validating query plan and executing deterministic data engine...</p>
                <p className="text-xs text-[#9ca3af]">Enforcing zero-hallucination mathematical bounds</p>
              </div>
            )}

            {/* Result Container */}
            {nlResult && !submittingNlQuery && (
              <div className="bg-[#0c0d12] rounded-3xl shadow-2xl border border-white/10 overflow-hidden divide-y divide-white/10">
                {/* Header with question & operation badge */}
                <div className="p-6 bg-[#14151b] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
                        {nlResult.operation.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-[#9ca3af]">
                        {nlResult.interpreted_intent}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      "{nlResult.question}"
                    </h3>
                  </div>
                  <div className="text-xs text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 self-start md:self-auto font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Deterministic Math Verified</span>
                  </div>
                </div>

                {/* Narrative Answer Section */}
                <div className="p-6 md:p-8 bg-[#0c0d12]">
                  <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {nlResult.answer_markdown}
                  </div>
                </div>

                {/* Visual Chart Section if suggested */}
                {nlResult.chart_suggestion && (
                  <div className="p-6 md:p-8 bg-[#14151b]/40">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-4 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#fa7041]" />
                      Recommended Visualization: {nlResult.chart_suggestion.title || 'Analysis Chart'}
                    </h4>

                    {nlResult.chart_suggestion.type === 'bar_chart' && nlResult.data.length > 0 && (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={nlResult.data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis 
                              dataKey={nlResult.chart_suggestion.x_axis || nlResult.columns[0]} 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#9ca3af', fontSize: 11 }} 
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#9ca3af', fontSize: 11 }} 
                              tickFormatter={(v) => Number(v) >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                              contentStyle={{ backgroundColor: '#0c0d12', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
                        <div className="bg-[#14151b] p-4 rounded-2xl border border-white/10">
                          <div className="text-[11px] text-[#9ca3af] uppercase font-semibold">Previous Period ({nlResult.chart_suggestion.previous_period})</div>
                          <div className="text-2xl font-bold text-white mt-1">{nlResult.chart_suggestion.previous_value}</div>
                        </div>
                        <div className="bg-[#14151b] p-4 rounded-2xl border border-white/10">
                          <div className="text-[11px] text-[#9ca3af] uppercase font-semibold">Current Period ({nlResult.chart_suggestion.current_period})</div>
                          <div className="text-2xl font-bold text-white mt-1">{nlResult.chart_suggestion.current_value}</div>
                        </div>
                        <div className="bg-[#ff3c02]/10 p-4 rounded-2xl border border-[#ff3c02]/30">
                          <div className="text-[11px] text-[#fa7041] uppercase font-semibold">Net Variance & Change</div>
                          <div className="text-2xl font-bold text-[#ffba86] mt-1">{nlResult.chart_suggestion.delta} ({nlResult.chart_suggestion.pct_change})</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Structured Data Table */}
                {nlResult.data && nlResult.data.length > 0 && (
                  <div className="p-6 md:p-8">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-3 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-[#fa7041]" />
                      Verified Data Records ({nlResult.data.length} rows)
                    </h4>
                    <div className="overflow-x-auto border border-white/10 rounded-2xl">
                      <table className="min-w-full divide-y divide-white/10 text-left text-xs">
                        <thead className="bg-[#14151b] text-[#9ca3af] font-semibold uppercase tracking-wider">
                          <tr>
                            {nlResult.columns.map((col) => (
                              <th key={col} className="px-4 py-3">
                                {col.replace('_', ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-[#0c0d12] text-slate-200">
                          {nlResult.data.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
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
                  <div className="p-6 bg-[#14151b] flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[#9ca3af] flex items-center gap-1 mr-1">
                      <CornerDownRight className="w-3.5 h-3.5 text-[#fa7041]" /> Next Steps:
                    </span>
                    {nlResult.suggested_followups.map((fUp, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleNlQuery(fUp)}
                        className="text-xs bg-[#0c0d12] hover:bg-[#ff3c02]/15 hover:text-white hover:border-[#ff3c02]/40 text-slate-300 px-3.5 py-1.5 rounded-full border border-white/10 transition-all cursor-pointer shadow-sm"
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
                <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#fa7041]" />
                  Statistical Time-Series Forecasting
                </h2>
                <p className="text-xs md:text-sm text-[#9ca3af] mt-1">
                  Forward-looking projections with empirical backtesting, out-of-sample validation error, and confidence intervals.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Empirical Backtesting Verified</span>
              </div>
            </div>

            {/* If dataset lacks temporal suitability */}
            {forecastSchema && !forecastSchema.is_forecastable ? (
              <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl flex items-start gap-3 shadow-xl">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-300">Insufficient Temporal Data For Forecasting</h3>
                  <p className="text-xs text-amber-200/80 mt-1">
                    This dataset does not contain valid parseable date or timestamp columns. Forecasting requires chronological observations to construct a time series.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Control Bar: Target Metric, Horizon, Model Selection */}
                <div className="bg-[#0c0d12] p-6 rounded-3xl shadow-2xl border border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                        Target Metric
                      </label>
                      <select
                        value={selectedForecastMetric}
                        onChange={(e) => setSelectedForecastMetric(e.target.value)}
                        className="w-full bg-[#060709] border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-[#ff3c02] font-medium"
                      >
                        {forecastSchema?.metric_columns?.map((m: string) => (
                          <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                        )) || (
                          <option value="revenue">REVENUE</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                        Forecast Horizon
                      </label>
                      <select
                        value={forecastHorizon}
                        onChange={(e) => setForecastHorizon(Number(e.target.value))}
                        className="w-full bg-[#060709] border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-[#ff3c02] font-medium"
                      >
                        <option value={3}>3 Periods Forward</option>
                        <option value={6}>6 Periods Forward</option>
                        <option value={12}>12 Periods Forward</option>
                        <option value={24}>24 Periods Forward</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                        Forecasting Model
                      </label>
                      <select
                        value={selectedForecastModel}
                        onChange={(e) => setSelectedForecastModel(e.target.value)}
                        className="w-full bg-[#060709] border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-[#ff3c02] font-medium"
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
                        className="w-full bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-full shadow-lg shadow-[#ff3c02]/30 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-98"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingForecast ? 'animate-spin' : ''}`} />
                        <span>{loadingForecast ? 'Computing Forecast...' : 'Generate Forecast'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {forecastError && (
                  <div className="p-4 bg-[#1a0c0c] border border-rose-500/30 rounded-2xl text-rose-300 text-xs md:text-sm flex items-center gap-2 shadow-xl">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{forecastError}</span>
                  </div>
                )}

                {/* Empty State before running forecast */}
                {!forecastResult && !loadingForecast && !forecastError && (
                  <div className="bg-[#0c0d12] p-12 rounded-3xl shadow-2xl border border-white/10 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-14 h-14 bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 rounded-2xl flex items-center justify-center mb-4">
                      <TrendingUp className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Time-Series Forecasting Ready</h3>
                    <p className="text-[#9ca3af] max-w-md text-xs mb-6">
                      Select your target metric and horizon above, then click Generate Forecast to compute statistical projections with 80% and 95% confidence bounds.
                    </p>
                    <button
                      onClick={runForecast}
                      className="bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-lg shadow-[#ff3c02]/30 transition-all cursor-pointer active:scale-98"
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
                      <div className="bg-[#0c0d12] p-5 rounded-2xl border border-white/10 shadow-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Selected Model</div>
                        <div className="text-base font-bold text-white mt-1 truncate">{forecastResult.selected_model}</div>
                        <div className="text-xs text-[#fa7041] font-medium mt-1">
                          Horizon: {forecastResult.horizon} periods ({forecastResult.frequency})
                        </div>
                      </div>

                      <div className="bg-[#0c0d12] p-5 rounded-2xl border border-white/10 shadow-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Validation RMSE</div>
                        <div className="text-2xl font-extrabold text-white mt-1">
                          {forecastResult.validation_metrics?.rmse != null 
                            ? `$${Number(forecastResult.validation_metrics.rmse).toLocaleString()}` 
                            : 'N/A'}
                        </div>
                        <div className="text-xs text-[#9ca3af] font-medium mt-1">
                          Holdout error ({forecastResult.validation_metrics?.holdout_periods} test periods)
                        </div>
                      </div>

                      <div className="bg-[#0c0d12] p-5 rounded-2xl border border-white/10 shadow-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Validation MAE</div>
                        <div className="text-2xl font-extrabold text-white mt-1">
                          {forecastResult.validation_metrics?.mae != null 
                            ? `$${Number(forecastResult.validation_metrics.mae).toLocaleString()}` 
                            : 'N/A'}
                        </div>
                        <div className="text-xs text-[#9ca3af] font-medium mt-1">Mean absolute deviation</div>
                      </div>

                      <div className="bg-[#0c0d12] p-5 rounded-2xl border border-white/10 shadow-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">MAPE Accuracy</div>
                        <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                          {forecastResult.validation_metrics?.mape_pct != null 
                            ? `${Number(forecastResult.validation_metrics.mape_pct).toFixed(1)}%` 
                            : 'N/A'}
                        </div>
                        <div className="text-xs text-[#9ca3af] font-medium mt-1">Mean percentage error</div>
                      </div>
                    </div>

                    {/* Interactive Forecast Chart */}
                    <div className="bg-[#0c0d12] p-6 rounded-3xl border border-white/10 shadow-2xl">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                        <div>
                          <h3 className="text-base font-bold text-white">
                            Historical vs. Projected {forecastResult.target_column.replace('_', ' ').toUpperCase()}
                          </h3>
                          <p className="text-xs text-[#9ca3af] mt-0.5">
                            Solid orange line displays historical recordings; dashed amber line shows {forecastResult.horizon}-period projections with shaded 95% confidence intervals.
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-3 h-0.5 bg-[#fa7041] inline-block"></span> Historical
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-3 h-0.5 bg-[#ffba86] border-dashed border-t-2 border-[#ffba86] inline-block"></span> Forecast
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-3 h-3 bg-[#ff3c02]/20 border border-[#ff3c02]/40 rounded-sm inline-block"></span> 95% Confidence
                          </span>
                        </div>
                      </div>

                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={forecastChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#9ca3af', fontSize: 11 }} 
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#9ca3af', fontSize: 11 }} 
                              tickFormatter={(v) => Number(v) >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0c0d12', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
                              fill="#ff3c02" 
                              stroke="transparent" 
                              fillOpacity={0.12} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="historical" 
                              stroke="#fa7041" 
                              strokeWidth={2.5} 
                              dot={{ r: 3, fill: '#fa7041' }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="forecast" 
                              stroke="#ffba86" 
                              strokeWidth={2.5} 
                              strokeDasharray="5 5" 
                              dot={{ r: 4, fill: '#ffba86' }} 
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Projections Table */}
                    <div className="bg-[#0c0d12] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                      <div className="p-4 bg-[#14151b] border-b border-white/10">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          Forecast Values & Uncertainty Intervals
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10 text-left text-xs">
                          <thead className="bg-[#14151b]/50 text-[#9ca3af] font-semibold uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Horizon Period</th>
                              <th className="px-4 py-3">Projected Date</th>
                              <th className="px-4 py-3">Projected Value</th>
                              <th className="px-4 py-3">80% Confidence Range</th>
                              <th className="px-4 py-3">95% Confidence Range</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 bg-[#0c0d12] text-slate-200">
                            {forecastResult.forecast_points.map((pt) => (
                              <tr key={pt.date} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-2.5 font-bold text-[#fa7041]">+{pt.period_index}</td>
                                <td className="px-4 py-2.5 font-medium">{pt.date}</td>
                                <td className="px-4 py-2.5 font-bold text-white">${pt.forecast.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-slate-400">${pt.lower_bound_80.toLocaleString()} - ${pt.upper_bound_80.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-slate-400">${pt.lower_bound_95.toLocaleString()} - ${pt.upper_bound_95.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Assumptions & Limitations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#14151b] p-5 rounded-2xl border border-white/10">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-[#fa7041]" />
                          Model Assumptions
                        </h4>
                        <ul className="text-xs text-[#9ca3af] space-y-1.5 list-disc list-inside">
                          {forecastResult.assumptions?.map((assm, aIdx) => (
                            <li key={aIdx}>{assm}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-[#14151b] p-5 rounded-2xl border border-white/10">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Limitations & Risk Boundaries
                        </h4>
                        <ul className="text-xs text-[#9ca3af] space-y-1.5 list-disc list-inside">
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
                <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-[#fa7041]" />
                  Statistically Grounded Anomaly & Outlier Detection
                </h2>
                <p className="text-xs md:text-sm text-[#9ca3af] mt-1">
                  Parametric Z-Score, Tukey IQR fences, and unsupervised Isolation Forest with explainable business classifications.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero-False-Accusation Guarantee (Outliers ≠ Fraud)</span>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-[#0c0d12] p-5 rounded-2xl border border-white/10 shadow-xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Total Flagged</div>
                <div className="text-2xl font-extrabold text-white mt-1">{anomalyMetrics.total}</div>
                <div className="text-xs text-[#9ca3af] mt-1">Across all algorithms</div>
              </div>

              <div className="bg-rose-500/10 p-5 rounded-2xl border border-rose-500/30 shadow-xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Confirmed Issues
                </div>
                <div className="text-2xl font-extrabold text-rose-300 mt-1">{anomalyMetrics.confirmedIssues}</div>
                <div className="text-xs text-rose-400/80 mt-1">Invariants (e.g. negative values)</div>
              </div>

              <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/30 shadow-xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Detected Anomalies
                </div>
                <div className="text-2xl font-extrabold text-amber-300 mt-1">{anomalyMetrics.detectedAnomalies}</div>
                <div className="text-xs text-amber-400/80 mt-1">Volume drops & multivariate pattern</div>
              </div>

              <div className="bg-[#ff3c02]/10 p-5 rounded-2xl border border-[#ff3c02]/30 shadow-xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#fa7041] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#fa7041]" />
                  Statistical Outliers
                </div>
                <div className="text-2xl font-extrabold text-[#ffba86] mt-1">{anomalyMetrics.statisticalOutliers}</div>
                <div className="text-xs text-[#fa7041]/80 mt-1">Legitimate high-value VIP spikes</div>
              </div>

              <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/30 shadow-xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Triaged / Resolved
                </div>
                <div className="text-2xl font-extrabold text-emerald-300 mt-1">{anomalyMetrics.reviewedOrDismissed}</div>
                <div className="text-xs text-emerald-400/80 mt-1">Reviewed or dismissed</div>
              </div>
            </div>

            {/* Scan Controls Bar */}
            <div className="bg-[#0c0d12] p-6 rounded-3xl shadow-2xl border border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Target Numeric Dimension
                  </label>
                  <select
                    value={anomalyTargetCol}
                    onChange={(e) => setAnomalyTargetCol(e.target.value)}
                    className="w-full bg-[#060709] border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-[#ff3c02] font-medium"
                  >
                    {numericColumns.map((col: string) => (
                      <option key={col} value={col}>{col.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Detection Algorithm
                  </label>
                  <select
                    value={anomalyMethod}
                    onChange={(e) => setAnomalyMethod(e.target.value)}
                    className="w-full bg-[#060709] border border-white/10 rounded-xl px-3 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-[#ff3c02] font-medium"
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
                    className="w-full bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-full shadow-lg shadow-[#ff3c02]/30 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-98"
                  >
                    <RefreshCw className={`w-4 h-4 ${runningAnomalyDetect ? 'animate-spin' : ''}`} />
                    <span>{runningAnomalyDetect ? 'Running Statistical & ML Scans...' : 'Scan For Anomalies'}</span>
                  </button>
                </div>
              </div>
            </div>

            {anomalyError && (
              <div className="p-4 bg-[#1a0c0c] border border-rose-500/30 rounded-2xl text-rose-300 text-xs md:text-sm flex items-center gap-2 shadow-xl">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{anomalyError}</span>
              </div>
            )}

            {/* Triage & Nature Filters Bar */}
            {anomalies.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#14151b] p-4 rounded-2xl border border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mr-1">Classification:</span>
                  <button
                    onClick={() => setAnomalyNatureFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'all'
                        ? 'bg-white text-black shadow-md'
                        : 'bg-[#0c0d12] text-slate-300 border border-white/10 hover:border-white/25'
                    }`}
                  >
                    All ({anomalies.length})
                  </button>
                  <button
                    onClick={() => setAnomalyNatureFilter('confirmed_business_issue')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'confirmed_business_issue'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                        : 'bg-[#0c0d12] text-rose-400 border border-rose-500/30 hover:bg-rose-500/10'
                    }`}
                  >
                    Confirmed Issues ({anomalyMetrics.confirmedIssues})
                  </button>
                  <button
                    onClick={() => setAnomalyNatureFilter('detected_anomaly')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'detected_anomaly'
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                        : 'bg-[#0c0d12] text-amber-400 border border-amber-500/30 hover:bg-amber-500/10'
                    }`}
                  >
                    Detected Anomalies ({anomalyMetrics.detectedAnomalies})
                  </button>
                  <button
                    onClick={() => setAnomalyNatureFilter('statistical_outlier')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      anomalyNatureFilter === 'statistical_outlier'
                        ? 'bg-gradient-to-r from-[#ff3c02] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30'
                        : 'bg-[#0c0d12] text-[#fa7041] border border-[#ff3c02]/30 hover:bg-[#ff3c02]/10'
                    }`}
                  >
                    Statistical Outliers ({anomalyMetrics.statisticalOutliers})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Triage:</span>
                  <select
                    value={anomalyStatusFilter}
                    onChange={(e) => setAnomalyStatusFilter(e.target.value)}
                    className="bg-[#0c0d12] border border-white/10 text-xs font-medium text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#ff3c02]"
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
              <div className="bg-[#0c0d12] p-12 rounded-3xl shadow-2xl border border-white/10 text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-14 h-14 bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 rounded-2xl flex items-center justify-center mb-4">
                  <AlertOctagon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Anomaly Detection Engine Ready</h3>
                <p className="text-[#9ca3af] max-w-md text-xs mb-6">
                  Run a scan to evaluate statistical outlier bounds (Z-Score & IQR) and multidimensional Isolation Forest paths without false fraud accusations.
                </p>
                <button
                  onClick={runAnomalyDetection}
                  className="bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:from-[#ff4d15] hover:to-[#ff8152] text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-lg shadow-[#ff3c02]/30 transition-all cursor-pointer active:scale-98"
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
                      className={`bg-[#0c0d12] rounded-3xl border p-6 shadow-xl transition-all hover:border-[#ff3c02]/40 ${
                        item.status === 'dismissed' 
                          ? 'opacity-60 border-white/5 bg-[#0c0d12]/50' 
                          : isConfirmed
                            ? 'border-rose-500/40 bg-rose-500/[0.03]'
                            : isOutlier
                              ? 'border-[#ff3c02]/30 bg-[#ff3c02]/[0.02]'
                              : 'border-amber-500/30 bg-amber-500/[0.02]'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          {/* Badges row */}
                          <div className="flex flex-wrap items-center gap-2">
                            {isConfirmed && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                                Confirmed Business Issue
                              </span>
                            )}
                            {isAnomaly && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                Detected Anomaly
                              </span>
                            )}
                            {isOutlier && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
                                <TrendingUp className="w-3.5 h-3.5 text-[#fa7041]" />
                                Statistical Outlier (Non-Defective)
                              </span>
                            )}

                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 text-slate-300 uppercase">
                              {item.method.replace('_', ' ')}
                            </span>

                            {item.row_index != null && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/5 border border-white/10 text-slate-300">
                                Row #{item.row_index}
                              </span>
                            )}

                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 text-slate-300">
                              Metric: <strong className="font-semibold text-white">{item.column_name}</strong>
                            </span>

                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              item.status === 'reviewed' 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                : item.status === 'dismissed' 
                                  ? 'bg-white/5 text-slate-400 border border-white/10' 
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}>
                              Status: {item.status.toUpperCase()}
                            </span>
                          </div>

                          {/* Title & Business Explanation */}
                          <div>
                            <h3 className="text-base font-bold text-white">{item.title}</h3>
                            <p className="text-sm text-slate-300 mt-1 leading-relaxed">{item.explanation}</p>
                          </div>

                          {/* Contextual dimension tags if available */}
                          {item.details?.row_context && Object.keys(item.details.row_context).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {Object.entries(item.details.row_context).map(([k, v]) => (
                                <span key={k} className="text-xs bg-[#14151b] border border-white/10 text-slate-300 px-2.5 py-0.5 rounded-xl">
                                  <strong className="text-white capitalize">{k.replace('_', ' ')}:</strong> {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Observed vs Expected Baseline & Triage Controls */}
                        <div className="flex lg:flex-col items-end justify-between lg:justify-start gap-4 lg:min-w-[200px] border-t lg:border-t-0 lg:border-l border-white/10 pt-3 lg:pt-0 lg:pl-6">
                          <div className="text-right">
                            <div className="text-xs text-[#9ca3af] font-medium">Observed vs Expected</div>
                            <div className="text-lg font-extrabold text-white">
                              ${item.observed_value.toLocaleString()}
                            </div>
                            <div className="text-xs text-[#9ca3af]">
                              Baseline: ${item.expected_value.toLocaleString()}
                            </div>
                            <div className="text-xs text-[#fa7041] font-semibold mt-1">
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
                                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                                <button
                                  onClick={() => updateAnomalyStatus(item.id, 'dismissed')}
                                  title="Dismiss anomaly"
                                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Dismiss</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => updateAnomalyStatus(item.id, 'open')}
                                title="Re-open anomaly"
                                className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
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
            <div className="bg-[#0c0d12] p-6 rounded-3xl border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-xl">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#fa7041]" />
                  Z-Score Parametric Model
                </h4>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Evaluates observations against mean and standard deviation (|z| &gt; 2.5). Invariants like negative revenues are immediately escalated.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#fa7041]" />
                  Tukey's IQR Fences
                </h4>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Distribution-free quartile spread [Q1 - 1.5×IQR, Q3 + 1.5×IQR]. Robust against heavy skewness and extreme tail distortion.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#fa7041]" />
                  Isolation Forest ML
                </h4>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
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
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#fa7041]" />
                  Customer & Product Segmentation Suite
                </h2>
                <p className="text-sm text-[#9ca3af]">
                  Behavioral RFM quintiles, multidimensional K-Means with Silhouette validation, and Pareto ABC inventory analysis.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#0c0d12] border border-white/10 px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Deterministic Behavioral & Statistical Clustering</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-[#0c0d12] p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Methodology
                  </label>
                  <select
                    value={selectedSegMethod}
                    onChange={(e) => setSelectedSegMethod(e.target.value)}
                    className="w-full bg-[#060709] border border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#ff3c02]/60 font-medium"
                  >
                    <option value="auto">Auto (Smart Schema Detect)</option>
                    <option value="rfm">RFM Customer Segmentation</option>
                    <option value="kmeans">K-Means Multi-Feature Clustering</option>
                    <option value="abc_pareto">ABC / Pareto Product Analysis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Entity Identifier
                  </label>
                  <select
                    value={selectedSegEntity}
                    onChange={(e) => setSelectedSegEntity(e.target.value)}
                    className="w-full bg-[#060709] border border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#ff3c02]/60 font-medium"
                  >
                    {segSchema?.entity_columns?.map((col: string) => (
                      <option key={col} value={col}>{col.replace('_', ' ').toUpperCase()}</option>
                    )) || (
                      <option value="customer_name">CUSTOMER NAME</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Monetary / Spend Metric
                  </label>
                  <select
                    value={selectedSegMonetary}
                    onChange={(e) => setSelectedSegMonetary(e.target.value)}
                    className="w-full bg-[#060709] border border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#ff3c02]/60 font-medium"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                      Date Column (Recency)
                    </label>
                    <select
                      value={selectedSegDate}
                      onChange={(e) => setSelectedSegDate(e.target.value)}
                      className="w-full bg-[#060709] border border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#ff3c02]/60 font-medium"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                      Clusters (k)
                    </label>
                    <select
                      value={selectedKmeansK}
                      onChange={(e) => setSelectedKmeansK(Number(e.target.value))}
                      className="w-full bg-[#060709] border border-white/10 rounded-full px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#ff3c02]/60 font-medium"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                      Pareto Cutoffs
                    </label>
                    <div className="w-full bg-[#060709] border border-white/10 rounded-full px-4 py-2.5 text-xs text-slate-400 font-medium">
                      80% / 15% / 5%
                    </div>
                  </div>
                )}

                <div>
                  <button
                    onClick={runSegmentation}
                    disabled={runningSegmentation}
                    className="w-full bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:brightness-110 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-full shadow-lg shadow-[#ff3c02]/25 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${runningSegmentation ? 'animate-spin' : ''}`} />
                    <span>{runningSegmentation ? 'Clustering Data...' : 'Generate Segments'}</span>
                  </button>
                </div>
              </div>
            </div>

            {segmentationError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{segmentationError}</span>
              </div>
            )}

            {/* Empty state */}
            {!segmentationResult && !runningSegmentation && (
              <div className="bg-[#0c0d12] p-12 rounded-3xl shadow-2xl border border-white/10 text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-14 h-14 bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Customer & Product Segmentation Ready</h3>
                <p className="text-[#9ca3af] max-w-md text-xs mb-6">
                  Select your model above to classify accounts into behavioral RFM tiers, multi-feature K-Means clusters, or ABC Pareto catalog classes.
                </p>
                <button
                  onClick={runSegmentation}
                  className="bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:brightness-110 text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-lg shadow-[#ff3c02]/25 transition-all cursor-pointer"
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
                  <div className="bg-[#0c0d12] p-5 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-[#ff3c02]/40 transition-all shadow-xl">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                    <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Total Entities</div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {segmentationResult.total_entities?.toLocaleString() || segmentationResult.segments.reduce((acc, s) => acc + s.member_count, 0)}
                    </div>
                    <div className="text-xs text-[#fa7041] font-medium mt-1">
                      Method: {segmentationResult.method.toUpperCase()}
                    </div>
                  </div>

                  <div className="bg-[#0c0d12] p-5 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-[#ff3c02]/40 transition-all shadow-xl">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                    <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Gross Monitored Value</div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      ${(segmentationResult.total_monetary || segmentationResult.segments.reduce((acc, s) => acc + s.total_monetary, 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-[#9ca3af] mt-1">Cumulative spend across segments</div>
                  </div>

                  <div className="bg-[#0c0d12] p-5 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-[#ff3c02]/40 transition-all shadow-xl">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                    <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Top Tier Dominance</div>
                    <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                      {segmentationResult.segments[0]?.percentage_of_monetary}%
                    </div>
                    <div className="text-xs text-[#9ca3af] mt-1">
                      {segmentationResult.segments[0]?.label} revenue share
                    </div>
                  </div>

                  <div className="bg-[#0c0d12] p-5 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-[#ff3c02]/40 transition-all shadow-xl">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                    <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
                      {segmentationResult.silhouette_score != null ? 'Silhouette Validation' : 'Active Segments'}
                    </div>
                    <div className="text-2xl font-extrabold text-[#ffba86] mt-1">
                      {segmentationResult.silhouette_score != null 
                        ? segmentationResult.silhouette_score 
                        : `${segmentationResult.segments.length} Tiers`}
                    </div>
                    <div className="text-xs text-[#9ca3af] mt-1">
                      {segmentationResult.silhouette_score != null ? 'Cluster separation score [-1, 1]' : 'Distinct business classifications'}
                    </div>
                  </div>
                </div>

                {/* Master-Detail Segment Explorer */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: Segments List */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                      Identified Segments ({segmentationResult.segments.length})
                    </div>
                    {segmentationResult.segments.map((seg, idx) => {
                      const isSelected = activeSegmentIndex === idx;
                      return (
                        <div
                          key={seg.label + idx}
                          onClick={() => setActiveSegmentIndex(idx)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                            isSelected 
                              ? 'bg-[#14151b] border-[#ff3c02] shadow-lg shadow-[#ff3c02]/15 ring-1 ring-[#ff3c02]/40' 
                              : 'bg-[#0c0d12] border-white/10 hover:border-white/20 hover:bg-[#14151b]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white">{seg.label}</h4>
                            <span className="text-xs font-mono font-bold text-[#ffba86] bg-[#ff3c02]/15 border border-[#ff3c02]/30 px-2.5 py-0.5 rounded-full">
                              {seg.percentage_of_monetary}% Rev
                            </span>
                          </div>
                          <p className="text-xs text-[#9ca3af] mt-0.5 line-clamp-1">{seg.subtitle}</p>

                          {/* Dual metric progress bar: Member share vs Revenue share */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-300">
                              <span>Revenue Contribution (${seg.total_monetary.toLocaleString()})</span>
                              <span className="font-semibold text-white">{seg.percentage_of_monetary}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#ff3c02] to-[#fa7041] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, seg.percentage_of_monetary)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[#9ca3af]">
                              <span>Customer Share ({seg.member_count} members)</span>
                              <span>{seg.percentage_of_members}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-slate-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, seg.percentage_of_members)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Active Segment Deep Dive */}
                  <div className="lg:col-span-7 bg-[#0c0d12] p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative overflow-hidden">
                    {segmentationResult.segments[activeSegmentIndex] && (() => {
                      const activeSeg = segmentationResult.segments[activeSegmentIndex];
                      return (
                        <>
                          <div className="border-b border-white/10 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#fa7041] bg-[#ff3c02]/15 border border-[#ff3c02]/30 px-3 py-0.5 rounded-full">
                                Segment Details
                              </span>
                              <span className="text-xs text-white/20">•</span>
                              <span className="text-xs text-[#9ca3af]">
                                {activeSeg.member_count} Members ({activeSeg.percentage_of_members}% of total)
                              </span>
                            </div>
                            <h3 className="text-xl font-extrabold text-white">{activeSeg.label}</h3>
                            <p className="text-sm text-slate-300 mt-1">{activeSeg.subtitle}</p>
                          </div>

                          {/* Profile Statistics Grid */}
                          {activeSeg.profile && (() => {
                            const prof = activeSeg.profile;
                            return (
                              <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-3">
                                  Behavioral Centroid Profile
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {prof.avg_recency_days != null && (
                                    <div className="bg-[#14151b] p-3 rounded-2xl border border-white/10">
                                      <div className="text-[11px] text-[#9ca3af] font-medium">Avg Recency</div>
                                      <div className="text-base font-bold text-white mt-0.5">
                                        {prof.avg_recency_days} days
                                      </div>
                                      <div className="text-[10px] text-[#ffba86] font-semibold mt-0.5">
                                        R-Score: {prof.avg_r_score} / 5
                                      </div>
                                    </div>
                                  )}

                                  {prof.avg_frequency != null && (
                                    <div className="bg-[#14151b] p-3 rounded-2xl border border-white/10">
                                      <div className="text-[11px] text-[#9ca3af] font-medium">Avg Orders</div>
                                      <div className="text-base font-bold text-white mt-0.5">
                                        {prof.avg_frequency} txns
                                      </div>
                                      <div className="text-[10px] text-[#ffba86] font-semibold mt-0.5">
                                        F-Score: {prof.avg_f_score} / 5
                                      </div>
                                    </div>
                                  )}

                                  {prof.avg_monetary != null && (
                                    <div className="bg-[#14151b] p-3 rounded-2xl border border-white/10">
                                      <div className="text-[11px] text-[#9ca3af] font-medium">Avg Spend</div>
                                      <div className="text-base font-bold text-white mt-0.5">
                                        ${prof.avg_monetary.toLocaleString()}
                                      </div>
                                      <div className="text-[10px] text-[#ffba86] font-semibold mt-0.5">
                                        M-Score: {prof.avg_m_score} / 5
                                      </div>
                                    </div>
                                  )}

                                  {prof.centroids && Object.entries(prof.centroids).map(([feat, val]) => (
                                    <div key={feat} className="bg-[#14151b] p-3 rounded-2xl border border-white/10">
                                      <div className="text-[11px] text-[#9ca3af] font-medium capitalize">{feat.replace('_', ' ')}</div>
                                      <div className="text-base font-bold text-white mt-0.5">
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
                            <div className="bg-[#14151b] p-4 rounded-2xl border border-[#ff3c02]/30 relative overflow-hidden">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#fa7041] mb-1 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#ff3c02]" />
                                Actionable Business Playbook
                              </h4>
                              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                                {activeSeg.recommendation}
                              </p>
                            </div>
                          )}

                          {/* Sample Members Table */}
                          {activeSeg.sample_members && activeSeg.sample_members.length > 0 && (
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                                Representative Segment Members
                              </div>
                              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#060709]">
                                <table className="min-w-full divide-y divide-white/5 text-left text-xs">
                                  <thead className="bg-[#14151b] text-slate-400 font-semibold border-b border-white/10">
                                    <tr>
                                      <th className="px-3 py-2">Entity</th>
                                      {activeSeg.sample_members[0].monetary != null && <th className="px-3 py-2">Monetary</th>}
                                      {activeSeg.sample_members[0].revenue != null && <th className="px-3 py-2">Revenue</th>}
                                      {activeSeg.sample_members[0].frequency != null && <th className="px-3 py-2">Orders</th>}
                                      {activeSeg.sample_members[0].recency_days != null && <th className="px-3 py-2">Recency</th>}
                                      {activeSeg.sample_members[0].r_score != null && <th className="px-3 py-2">R / F / M</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5 text-slate-200">
                                    {activeSeg.sample_members.map((m, mIdx) => (
                                      <tr key={mIdx} className="hover:bg-white/5 transition-colors">
                                        <td className="px-3 py-2 font-bold text-white">{m.entity || m.product || `Entity #${mIdx + 1}`}</td>
                                        {m.monetary != null && <td className="px-3 py-2 font-semibold text-[#ffba86]">${m.monetary.toLocaleString()}</td>}
                                        {m.revenue != null && <td className="px-3 py-2 font-semibold text-[#ffba86]">${m.revenue.toLocaleString()}</td>}
                                        {m.frequency != null && <td className="px-3 py-2 text-slate-300">{m.frequency}</td>}
                                        {m.recency_days != null && <td className="px-3 py-2 text-slate-300">{m.recency_days}d ago</td>}
                                        {m.r_score != null && (
                                          <td className="px-3 py-2 font-mono text-slate-400">
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
                <div className="bg-[#0c0d12] p-6 rounded-3xl border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#fa7041]" />
                      RFM Behavioral Quantiles
                    </h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">
                      Scores Recency, Frequency, and Monetary parameters on standardized 1-5 rank percentiles to build actionable customer lifecycle cohorts.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1.5 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[#fa7041]" />
                      K-Means with Silhouette Validation
                    </h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">
                      Evaluates multi-feature clusters using standardized Euclidean distance. Automatically discovers optimal separation without arbitrary guessing.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#fa7041]" />
                      ABC Pareto Catalog Distribution
                    </h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">
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
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#fa7041]" />
                  Prescriptive Recommendations & Executive Briefing
                </h2>
                <p className="text-sm text-[#9ca3af]">
                  Cross-layer synthesis translating empirical metrics, forecasts, anomalies, and customer cohorts into prioritized actions and boardroom-ready briefs.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#0c0d12] border border-white/10 px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Empirically Grounded Prescriptive Strategy</span>
              </div>
            </div>

            {/* Generator Card & Report Switcher */}
            <div className="bg-[#0c0d12] p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-white/10">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#fa7041] mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Boardroom Briefing Generator
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Compile Automated Executive Report
                  </h3>
                  <p className="text-xs text-[#9ca3af] mt-1">
                    Synthesizes verified KPIs, strategic findings, forward projections, detected risks, and prioritized recommendations into structured JSON and publishable Markdown.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={reportTitleInput}
                    onChange={(e) => setReportTitleInput(e.target.value)}
                    placeholder="Report title (e.g. Q4 Executive Briefing)"
                    className="bg-[#060709] border border-white/10 rounded-full px-5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#ff3c02]/60 min-w-[280px]"
                  />
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] hover:brightness-110 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all shadow-lg shadow-[#ff3c02]/25 disabled:opacity-50 cursor-pointer"
                  >
                    <FileText className={`w-4 h-4 ${generatingReport ? 'animate-spin' : ''}`} />
                    {generatingReport ? 'Compiling Report...' : 'Compile Briefing'}
                  </button>
                </div>
              </div>

              {/* Historical Reports Drawer & Quick Switcher */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#fa7041]" /> Compiled Reports:
                  </span>
                  {reportsList.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No reports compiled yet</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {reportsList.map((rep) => {
                        const isCurrent = activeReport?.id === rep.id;
                        return (
                          <button
                            key={rep.id}
                            onClick={() => loadReportDetails(rep.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                              isCurrent
                                ? 'bg-[#ff3c02]/15 border-[#ff3c02]/40 text-[#ffba86] font-semibold'
                                : 'bg-[#14151b] border-white/10 text-slate-300 hover:border-white/20 hover:text-white'
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
                  className="flex items-center gap-1.5 text-xs text-[#fa7041] hover:text-[#ffba86] font-semibold transition-colors cursor-pointer"
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
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#fa7041]" />
                    Prioritized Prescriptive Playbooks
                    <span className="bg-[#ff3c02]/15 border border-[#ff3c02]/30 text-[#fa7041] text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {filteredRecommendations.length} {filteredRecommendations.length === 1 ? 'Action' : 'Actions'}
                    </span>
                  </h3>
                  <p className="text-xs text-[#9ca3af]">
                    Concrete, empirical recommendations ranked by business priority and risk exposure.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-[#9ca3af]">Priority:</label>
                    <select
                      value={recPriorityFilter}
                      onChange={(e) => setRecPriorityFilter(e.target.value)}
                      className="bg-[#060709] border border-white/10 rounded-full px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-[#ff3c02]/60"
                    >
                      <option value="all">All Priorities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-[#9ca3af]">Category:</label>
                    <select
                      value={recCategoryFilter}
                      onChange={(e) => setRecCategoryFilter(e.target.value)}
                      className="bg-[#060709] border border-white/10 rounded-full px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-[#ff3c02]/60"
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
                <div className="bg-[#0c0d12] p-8 rounded-3xl border border-white/10 text-center shadow-xl">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-white">No Pending Strategic Alerts</div>
                  <p className="text-xs text-[#9ca3af] mt-1 max-w-md mx-auto">
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

                    let badgeColor = 'bg-slate-500/15 text-slate-300 border-white/10';
                    let icon = <CheckCircle className="w-4 h-4 text-slate-300" />;
                    if (isCritical) {
                      badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                      icon = <AlertOctagon className="w-4 h-4 text-rose-400" />;
                    } else if (isHigh) {
                      badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                      icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
                    } else if (isMedium) {
                      badgeColor = 'bg-[#ff3c02]/15 text-[#fa7041] border-[#ff3c02]/30';
                      icon = <Info className="w-4 h-4 text-[#fa7041]" />;
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
                        className={`bg-[#0c0d12] rounded-3xl border transition-all p-6 shadow-xl hover:border-[#ff3c02]/40 flex flex-col justify-between relative overflow-hidden group ${
                          isCritical
                            ? 'border-rose-500/30'
                            : isHigh
                            ? 'border-amber-500/30'
                            : 'border-white/10'
                        }`}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                        <div className="space-y-4">
                          {/* Priority and Category Tag */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${badgeColor}`}>
                              {icon}
                              {rec.priority} Priority
                            </span>
                            <span className="text-xs font-semibold text-[#9ca3af] bg-[#14151b] border border-white/10 px-2.5 py-0.5 rounded-full capitalize">
                              {categoryLabels[rec.category] || rec.category.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Recommendation Title */}
                          <h4 className="text-base font-bold text-white leading-snug">
                            {rec.title}
                          </h4>

                          {/* Impact Highlight Banner */}
                          <div className="bg-[#14151b] border border-white/10 rounded-2xl p-3 flex items-start gap-2.5">
                            <span className="text-sm">⚡</span>
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Estimated Impact</div>
                              <div className="text-xs text-slate-200 font-medium mt-0.5">{rec.impact_summary}</div>
                            </div>
                          </div>

                          {/* Empirical Rationale */}
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                              Empirical Rationale
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-normal">
                              {rec.rationale}
                            </p>
                          </div>

                          {/* Action Plan Steps */}
                          {rec.action_plan && rec.action_plan.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <div className="text-xs font-bold uppercase tracking-wider text-[#fa7041] flex items-center gap-1.5">
                                <span>🎯</span> Recommended Action Steps
                              </div>
                              <div className="space-y-1.5">
                                {rec.action_plan.map((step, sIdx) => (
                                  <div key={sIdx} className="flex items-start gap-2 text-xs text-slate-200 bg-[#14151b] p-2.5 rounded-xl border border-white/10">
                                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-gradient-to-r from-[#ff3c02] to-[#fa7041] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
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
                          <div className="mt-5 pt-3 border-t border-white/10">
                            <button
                              onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                              className="text-[11px] font-semibold text-[#fa7041] hover:text-[#ffba86] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Database className="w-3 h-3" />
                              {isExpanded ? 'Hide Data Citations' : 'Inspect Data Citations'}
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {isExpanded && (
                              <div className="mt-2.5 p-3 bg-[#060709] text-[#ffba86] rounded-2xl text-[11px] font-mono overflow-x-auto border border-white/10">
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
                      onClick={() => handleOpenPresentationView(activeReport)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shadow-sm"
                      title="Open full-page Boardroom HTML in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Boardroom View
                    </button>

                    <button
                      onClick={() => handleDownloadReport('html', activeReport)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors"
                      title="Download Boardroom HTML (.html)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      HTML
                    </button>

                    <button
                      onClick={() => handleDownloadReport('markdown', activeReport)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors"
                      title="Download Markdown Report (.md)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      MD
                    </button>

                    <button
                      onClick={() => handleDownloadReport('json', activeReport)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors"
                      title="Export Structured Report Data (.json)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      JSON
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
                      {/* Executive Context & Scope Metadata Banner */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                        <div className="flex items-center gap-2.5 text-slate-700">
                          <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Reporting Period</div>
                            <div className="font-semibold text-slate-800">
                              {activeReport.content?.reporting_period || activeReport.reporting_period || 'Cross-Sectional Baseline'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 text-slate-700">
                          <Clock className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Generated At</div>
                            <div className="font-semibold text-slate-800">
                              {activeReport.content?.generated_at || (activeReport.created_at ? new Date(activeReport.created_at).toLocaleString() : 'Current Session')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 text-slate-700">
                          <Database className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Analytical Scope</div>
                            <div className="font-semibold text-slate-800 truncate" title={activeReport.content?.analytical_scope || activeReport.analytical_scope || 'Complete Transaction Ledger'}>
                              {activeReport.content?.analytical_scope || activeReport.analytical_scope || 'Complete Transaction Ledger'}
                            </div>
                          </div>
                        </div>
                      </div>

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

                      {/* Assumptions & Limitations Disclosures */}
                      {((activeReport.content?.assumptions && activeReport.content.assumptions.length > 0) || 
                        (activeReport.content?.limitations && activeReport.content.limitations.length > 0)) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activeReport.content.assumptions && activeReport.content.assumptions.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                Modeling Assumptions
                              </h5>
                              <ul className="space-y-2 text-xs text-slate-600">
                                {activeReport.content.assumptions.map((assump, aIdx) => (
                                  <li key={aIdx} className="flex items-start gap-2">
                                    <span className="text-slate-400 mt-0.5">•</span>
                                    <span>{assump}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {activeReport.content.limitations && activeReport.content.limitations.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                Scope Boundaries & Limitations
                              </h5>
                              <ul className="space-y-2 text-xs text-slate-600">
                                {activeReport.content.limitations.map((lim, lIdx) => (
                                  <li key={lIdx} className="flex items-start gap-2">
                                    <span className="text-slate-400 mt-0.5">•</span>
                                    <span>{lim}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
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
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#ff3c02]" />
                Quantitative Dashboards & Performance Visuals
              </h2>
              <p className="text-sm text-[#9ca3af]">
                Core statistical aggregates and dimension breakdowns powering the deterministic analytics layer.
              </p>
            </div>

            {!autoAnalysis ? (
              <div className="bg-[#0c0d12] p-12 rounded-3xl border border-white/10 shadow-2xl text-center flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                <div className="w-16 h-16 rounded-2xl bg-[#ff3c02]/10 border border-[#ff3c02]/30 flex items-center justify-center text-[#ff3c02] mb-4">
                  <Activity className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Visual Analytics Found</h3>
                <p className="text-[#9ca3af] mb-6 max-w-md text-sm">Execute the business analytics engine to profile key dimensions, volume trends, and transaction velocity.</p>
                <button 
                  onClick={runAnalytics} 
                  disabled={submittingAnalysis}
                  className="bg-gradient-to-r from-[#ff3c02] to-[#fa7041] hover:brightness-110 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-[#ff3c02]/25 flex items-center gap-2 text-sm transition-all"
                >
                  <TrendingUp className="w-4 h-4" />
                  {submittingAnalysis ? 'Running Intelligence Engine...' : 'Run Analysis Engine'}
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
                      icon={<DollarSign className="w-6 h-6 text-emerald-400" />}
                      trend="Deterministic Sum"
                      trendUp={true}
                    />
                    <MetricCard 
                      title="Total Volume" 
                      value={metrics.order_count.toLocaleString()} 
                      icon={<ShoppingCart className="w-6 h-6 text-blue-400" />}
                      trend="Recorded Transactions"
                    />
                    <MetricCard 
                      title="Unique Accounts" 
                      value={metrics.customer_count ? metrics.customer_count.toLocaleString() : 'N/A'} 
                      icon={<Users className="w-6 h-6 text-[#fa7041]" />}
                      trend="Distinct Entities"
                    />
                    <MetricCard 
                      title="Avg Order Value" 
                      value={metrics.aov ? `$${metrics.aov.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'} 
                      icon={<Activity className="w-6 h-6 text-[#ffba86]" />}
                      trend="Revenue / Transactions"
                    />
                  </div>
                )}

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Time Series Chart */}
                  <div className="lg:col-span-2 bg-[#0c0d12] p-6 md:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-white">Trajectory Over Time</h3>
                        <p className="text-xs text-[#9ca3af]">Chronological volume aggregated across reporting dates</p>
                      </div>
                    </div>
                    {ts && ts.length > 0 ? (
                      <div className="h-[350px] w-full pt-2">
                        <ResponsiveContainer width="100%" height={340} minWidth={100} minHeight={340}>
                          <AreaChart data={ts} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                              <linearGradient id="analyticsRevGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ff3c02" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#ff3c02" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#22242d" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                              tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#0c0d12', 
                                border: '1px solid rgba(255, 255, 255, 0.1)', 
                                borderRadius: '16px', 
                                color: '#f4f4f6', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' 
                              }}
                              itemStyle={{ color: '#ffba86' }}
                              labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                              formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue Volume']}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#ff3c02" 
                              strokeWidth={3} 
                              fillOpacity={1}
                              fill="url(#analyticsRevGrad)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[350px] flex items-center justify-center text-[#9ca3af] bg-[#14151b] rounded-2xl border border-white/5 border-dashed text-sm">
                        No temporal/date column identified for time-series visualization.
                      </div>
                    )}
                  </div>

                  {/* Dimension Breakdowns Chart */}
                  <div className="bg-[#0c0d12] p-6 md:p-8 rounded-3xl border border-white/10 shadow-xl flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-white">Segment Distribution</h3>
                        <p className="text-xs text-[#9ca3af]">Ranking by categorical share</p>
                      </div>
                      {dimensionKeys.length > 0 && (
                        <select 
                          value={activeDimension}
                          onChange={(e) => setSelectedDimension(e.target.value)}
                          className="text-xs border border-white/10 rounded-full shadow-sm focus:ring-[#ff3c02] focus:border-[#ff3c02] py-1.5 pl-3 pr-8 text-white bg-[#14151b] font-medium"
                        >
                          {dimensionKeys.map(k => (
                            <option key={k} value={k} className="bg-[#14151b] text-white">{k.replace(/_/g, ' ').toUpperCase()}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    
                    {activeDimension && breakdowns[activeDimension] ? (
                      <div className="flex-1 h-[350px] w-full pt-2">
                        <ResponsiveContainer width="100%" height={340} minWidth={100} minHeight={340}>
                          <BarChart 
                            data={breakdowns[activeDimension]} 
                            layout="vertical"
                            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#22242d" />
                            <XAxis type="number" hide />
                            <YAxis 
                              type="category" 
                              dataKey="label" 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                              width={90}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                              contentStyle={{ 
                                backgroundColor: '#0c0d12', 
                                border: '1px solid rgba(255, 255, 255, 0.1)', 
                                borderRadius: '16px', 
                                color: '#f4f4f6', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' 
                              }}
                              itemStyle={{ color: '#fa7041' }}
                              labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
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
                      <div className="flex-1 flex items-center justify-center text-[#9ca3af] bg-[#14151b] rounded-2xl border border-white/5 border-dashed text-sm">
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
    </div>
  );
}

function MetricCard({ title, value, icon, trend, trendUp }: { title: string; value: string | number; icon: React.ReactNode; trend?: string; trendUp?: boolean }) {
  return (
    <div className="bg-[#0c0d12] border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-[#ff3c02]/40 transition-all shadow-xl">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[#9ca3af] text-xs font-bold uppercase tracking-wider">{title}</h3>
        <div className="p-2.5 bg-[#ff3c02]/15 border border-[#ff3c02]/30 rounded-2xl text-[#fa7041]">{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
        {trend && (
          <p className="text-xs mt-2.5 font-medium text-[#9ca3af] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff3c02] inline-block shadow-sm shadow-[#ff3c02]"></span>
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
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertOctagon className="w-3.5 h-3.5" /> CRITICAL RISK
        </span>
      );
    }
    if (isWarning) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" /> STRATEGIC WARNING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ff3c02]/15 text-[#fa7041] border border-[#ff3c02]/30">
        <Info className="w-3.5 h-3.5" /> BUSINESS OPPORTUNITY
      </span>
    );
  };

  const borderHighlight = isCritical 
    ? 'border-l-4 border-l-rose-500' 
    : isWarning 
    ? 'border-l-4 border-l-amber-500' 
    : 'border-l-4 border-l-[#ff3c02]';

  // Parse sections if available in evidence or parse from body
  const observedFacts = insight.evidence?.observed_facts || [];
  const calculatedMetrics = insight.evidence?.calculated_metrics || {};
  const recommendations = insight.evidence?.recommendations || [];
  const interpretation = insight.evidence?.interpretation;

  return (
    <div className={`bg-[#0c0d12] rounded-3xl shadow-2xl border border-white/10 p-6 md:p-8 ${borderHighlight} hover:border-[#ff3c02]/40 transition-all relative overflow-hidden group`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#ff3c02]/10 to-transparent pointer-events-none rounded-bl-full" />
      
      {/* Top Meta Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {severityBadge()}
          {insight.category && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">
              {insight.category}
            </span>
          )}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10 flex items-center gap-1">
            {insight.source === 'ai' ? (
              <>
                <Sparkles className="w-3 h-3 text-[#fa7041]" /> AI Synthesized
              </>
            ) : (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Grounded Rules
              </>
            )}
          </span>
        </div>

        <div className="text-xs text-[#9ca3af] font-mono">
          Model: {insight.model_name || 'deterministic-v1'}
        </div>
      </div>

      {/* Main Title */}
      <h3 className="text-xl md:text-2xl font-extrabold text-white mb-6 tracking-tight leading-snug">
        {insight.title}
      </h3>

      {/* Structured 4-Part Executive Breakdown */}
      <div className="space-y-6">
        
        {/* 1. Observed Facts */}
        {observedFacts.length > 0 && (
          <div className="bg-[#14151b] rounded-2xl p-5 border border-white/10">
            <h4 className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>📊</span> Observed Quantitative Facts
            </h4>
            <ul className="space-y-2">
              {observedFacts.map((fact, idx) => (
                <li key={idx} className="text-sm text-slate-200 flex items-start gap-2">
                  <span className="text-[#ff3c02] font-bold">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 2. Calculated Metrics */}
        {Object.keys(calculatedMetrics).length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>📐</span> Deterministically Calculated Metrics
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(calculatedMetrics).map(([key, val]) => (
                <div key={key} className="bg-[#060709] border border-white/10 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs shadow-sm">
                  <span className="text-[#9ca3af] font-medium">{key.replace(/_/g, ' ').toUpperCase()}:</span>
                  <span className="text-[#ffba86] font-bold font-mono">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Strategic Interpretation */}
        {interpretation ? (
          <div>
            <h4 className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>💡</span> Strategic Business Interpretation
            </h4>
            <p className="text-sm text-slate-200 leading-relaxed bg-[#14151b] border border-white/10 p-5 rounded-2xl shadow-sm">
              {interpretation}
            </p>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm text-slate-200 whitespace-pre-line leading-relaxed bg-[#14151b] border border-white/10 p-5 rounded-2xl">
            {insight.body}
          </div>
        )}

        {/* 4. Actionable Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-gradient-to-br from-[#14151b] to-[#0c0d12] rounded-2xl p-5 border border-[#ff3c02]/25 shadow-sm">
            <h4 className="text-xs font-bold text-[#fa7041] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>🎯</span> Actionable Executive Recommendations
            </h4>
            <div className="space-y-2.5">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm text-slate-100">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#ff3c02] via-[#f45b31] to-[#fa7041] text-white text-xs font-bold flex items-center justify-center mt-0.5 shadow-md shadow-[#ff3c02]/30">
                    {idx + 1}
                  </span>
                  <span className="font-medium leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Traceability Accordion Button */}
      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
        <button 
          onClick={onToggleEvidence}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#fa7041] hover:text-[#ffba86] transition-colors"
        >
          <Database className="w-3.5 h-3.5" />
          {isExpanded ? 'Hide Grounded Evidence & Formulas' : 'Inspect Analytical Evidence (Traceability)'}
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="text-xs text-[#9ca3af]">
          Created {new Date(insight.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Traceability Raw JSON Evidence Drawer */}
      {isExpanded && (
        <div className="mt-4 p-4 bg-[#060709] text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto border border-white/10">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[#9ca3af]">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Grounded Analytical Context (Anti-Hallucination)
            </span>
            <span>Version: {insight.prompt_version || 'v1.0'}</span>
          </div>
          <pre className="text-[#ffba86] leading-relaxed">
            {JSON.stringify(insight.evidence || {}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
