"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';

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

  const fetchData = async () => {
    try {
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
      alert('Analytics job started! Please refresh in a few seconds.');
      setTimeout(fetchData, 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to start analytics job');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return <div className="p-8 text-black">Loading...</div>;

  const autoAnalysis = analyses.find(a => a.analysis_type === 'auto_overview');
  const metrics = autoAnalysis?.result?.metrics;
  const ts = autoAnalysis?.result?.time_series;
  const breakdowns = autoAnalysis?.result?.breakdowns;

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics: {dataset?.name}</h1>
          <p className="text-gray-600">Business insights and deterministic analytics.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={runAnalytics}
            disabled={submitting}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Running...' : 'Run Auto Analysis'}
          </button>
          <button onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}`)} className="text-blue-600 hover:underline">
            &larr; Back to Profile
          </button>
        </div>
      </header>

      {!autoAnalysis ? (
        <div className="bg-white p-8 rounded shadow text-center text-gray-500 border-dashed border-2">
          <p className="mb-4">No analytical overview has been generated for this dataset yet.</p>
          <button onClick={runAnalytics} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
            Generate Overview Now
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Key Metrics */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Order Count" value={metrics.order_count} />
              <MetricCard title="Revenue" value={metrics.revenue ? `$${metrics.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'} />
              <MetricCard title="Customers" value={metrics.customer_count || 'N/A'} />
              <MetricCard title="Avg Order Value" value={metrics.aov ? `$${metrics.aov.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Time Series */}
            {ts && ts.length > 0 && (
              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-xl font-semibold mb-4 border-b pb-2">Trend over Time</h3>
                <div className="space-y-2">
                  {ts.map((point: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{point.date}</span>
                      <span className="font-semibold text-gray-900">{point.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Breakdowns */}
            {breakdowns && Object.keys(breakdowns).length > 0 && (
              <div className="bg-white p-6 rounded shadow">
                <h3 className="text-xl font-semibold mb-4 border-b pb-2">Top Dimensions</h3>
                <div className="space-y-6">
                  {Object.entries(breakdowns).map(([dim, data]: [string, any]) => (
                    <div key={dim}>
                      <h4 className="font-medium text-gray-800 capitalize mb-2">{dim.replace(/_/g, ' ')}</h4>
                      <div className="space-y-1">
                        {data.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 truncate w-2/3">{item.label}</span>
                            <span className="font-medium text-gray-900">{item.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white p-6 rounded shadow border-t-4 border-indigo-500">
      <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
