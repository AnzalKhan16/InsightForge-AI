"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';

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
    return <div className="p-8 text-red-600 bg-red-50 m-8 rounded">{error}</div>;
  }

  if (!dataset) {
    return <div className="p-8 text-black">Loading...</div>;
  }

  const currentVer = dataset.versions?.[dataset.versions.length - 1];
  const metadata = currentVer?.dataset_metadata;
  const profile = metadata?.profile;

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{dataset.name} Profile</h1>
          <p className="text-gray-600">v{currentVer?.version_number}</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${datasetId}/clean`)}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-semibold"
          >
            Clean Data
          </button>
          <button onClick={() => router.push(`/workspaces/${workspaceId}`)} className="text-blue-600 hover:underline">
            &larr; Back to Datasets
          </button>
        </div>
      </header>

      {metadata ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded shadow border-t-4 border-blue-500">
              <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Rows</h3>
              <p className="text-3xl font-bold text-gray-800">{metadata.row_count}</p>
            </div>
            <div className="bg-white p-6 rounded shadow border-t-4 border-green-500">
              <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Columns</h3>
              <p className="text-3xl font-bold text-gray-800">{metadata.column_count}</p>
            </div>
            <div className="bg-white p-6 rounded shadow border-t-4 border-yellow-500">
              <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Duplicate Rows</h3>
              <p className="text-3xl font-bold text-gray-800">{profile?.overview?.duplicate_rows ?? 0}</p>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Columns Profiling</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Missing</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min / Max</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metadata.columns?.map((col: any) => {
                    const colProf = profile?.columns?.[col.name] || {};
                    return (
                      <tr key={col.name}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{col.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{col.dtype}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{colProf.missing ?? 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{colProf.unique ?? 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {colProf.min !== undefined && colProf.min !== null ? (
                            <span>{Number(colProf.min).toFixed(2)} / {Number(colProf.max).toFixed(2)}</span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {currentVer.jobs && currentVer.jobs.filter((j: any) => j.job_type === 'clean' && j.status === 'succeeded').length > 0 && (
            <div className="bg-white rounded shadow overflow-hidden mt-8">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Cleaning History</h2>
              </div>
              <div className="p-6">
                {currentVer.jobs.filter((j: any) => j.job_type === 'clean' && j.status === 'succeeded').map((job: any) => (
                  <div key={job.id} className="mb-4 last:mb-0 border p-4 rounded bg-gray-50 text-sm">
                    <p className="font-semibold text-gray-700 mb-2">Job {job.id.substring(0, 8)} - {new Date(job.created_at).toLocaleString()}</p>
                    <p className="mb-2">Rows: {job.result?.initial_rows} &rarr; {job.result?.final_rows}</p>
                    <ul className="list-disc pl-5 space-y-1 text-gray-600">
                      {job.result?.history?.map((h: any, i: number) => (
                        <li key={i}>
                          <span className="font-medium">{h.operation}</span>
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
        <div className="bg-white p-8 rounded shadow text-center text-gray-500">
          Profile data not available for this dataset.
        </div>
      )}
    </div>
  );
}
