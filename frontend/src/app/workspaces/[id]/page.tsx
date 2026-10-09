"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';

export default function WorkspacePage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;

  const [datasets, setDatasets] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = async () => {
    try {
      const res = await apiFetch<any[]>(`/workspaces/${workspaceId}/datasets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDatasets(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch datasets');
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
    }, 3000);

    return () => clearInterval(interval);
  }, [token, workspaceId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.split('.')[0]); // Use filename as default dataset name

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
    if (!confirm('Are you sure you want to delete this dataset?')) return;
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
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Workspace Datasets</h1>
        <button onClick={() => router.push('/dashboard')} className="text-blue-600 hover:underline">
          Back to Dashboard
        </button>
      </header>

      {error && <div className="bg-red-100 text-red-700 p-4 mb-6 rounded shadow">{error}</div>}

      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Upload New Dataset</h2>
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            accept=".csv,.xlsx,.xls"
            onChange={handleUpload}
            disabled={uploading}
            ref={fileInputRef}
            className="border p-2 rounded w-full max-w-md"
          />
          {uploading && <span className="text-blue-600 animate-pulse">Uploading...</span>}
        </div>
        <p className="text-sm text-gray-500 mt-2">Supported formats: CSV, Excel (Max 50MB)</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {datasets.map((dataset) => (
          <div key={dataset.id} className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold truncate pr-2" title={dataset.name}>{dataset.name}</h3>
              <button 
                onClick={() => handleDelete(dataset.id)} 
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </div>
            {dataset.versions && dataset.versions.length > 0 ? (
              <div className="text-sm text-gray-600 mt-4">
                {(() => {
                  const currentVer = dataset.versions[dataset.versions.length - 1];
                  const isProcessing = currentVer.status === 'processing' || currentVer.status === 'uploaded';
                  return (
                    <>
                      <p><span className="font-semibold">Current Version:</span> v{currentVer.version_number}</p>
                      <p><span className="font-semibold">Format:</span> {currentVer.format.toUpperCase()}</p>
                      <p><span className="font-semibold">Size:</span> {(currentVer.size_bytes / 1024).toFixed(1)} KB</p>
                      <p className="flex items-center gap-2 mt-1"><span className="font-semibold">Status:</span> 
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${currentVer.status === 'completed' ? 'bg-green-100 text-green-800' : currentVer.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {currentVer.status.toUpperCase()}
                        </span>
                      </p>
                      {currentVer.dataset_metadata && (
                        <div className="mt-3 pt-3 border-t">
                          <p><span className="font-semibold">Rows:</span> {currentVer.dataset_metadata.row_count}</p>
                          <p><span className="font-semibold">Columns:</span> {currentVer.dataset_metadata.column_count}</p>
                        </div>
                      )}
                      
                      <div className="mt-4 flex gap-2">
                         <button 
                           onClick={() => router.push(`/workspaces/${workspaceId}/datasets/${dataset.id}`)}
                           className="bg-blue-50 text-blue-600 px-3 py-1 rounded text-sm font-semibold hover:bg-blue-100 transition-colors"
                           disabled={currentVer.status !== 'completed'}
                         >
                           {currentVer.status === 'completed' ? 'View Profile' : 'Processing...'}
                         </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No versions found.</p>
            )}
          </div>
        ))}
        {datasets.length === 0 && !uploading && (
          <div className="col-span-full text-center p-12 bg-white rounded shadow text-gray-500">
            No datasets uploaded yet. Upload a CSV or Excel file to get started.
          </div>
        )}
      </div>
    </div>
  );
}
