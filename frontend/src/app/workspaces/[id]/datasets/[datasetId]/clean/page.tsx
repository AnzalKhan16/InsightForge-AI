"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';

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
      // transform columns string to array if necessary
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

  if (!user || !dataset) return <div className="p-8 text-black">Loading...</div>;

  const metadata = dataset.versions?.[dataset.versions.length - 1]?.dataset_metadata;
  const colNames = metadata?.columns?.map((c: any) => c.name) || [];

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Clean Dataset: {dataset.name}</h1>
          <p className="text-gray-600">Configure data cleaning pipeline steps.</p>
        </div>
        <button onClick={() => router.back()} className="text-blue-600 hover:underline">
          &larr; Cancel
        </button>
      </header>

      {error && <div className="bg-red-100 text-red-700 p-4 mb-6 rounded shadow">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded shadow mb-6 border-t-4 border-blue-500">
            <h2 className="text-xl font-semibold mb-4">Pipeline Steps</h2>
            
            {operations.length === 0 && (
              <p className="text-gray-500 italic mb-4">No operations added yet. Add an operation from the panel on the right.</p>
            )}

            <div className="space-y-4">
              {operations.map((op, index) => (
                <div key={index} className="border rounded p-4 relative bg-gray-50">
                  <button 
                    onClick={() => removeOperation(index)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    title="Remove Step"
                  >
                    &times;
                  </button>
                  <h3 className="font-bold mb-2">
                    {index + 1}. {availableOps.find(a => a.value === op.op)?.label}
                  </h3>
                  
                  <div className="grid gap-4 mt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Apply to Columns (comma-separated, leave blank for all)</label>
                      <input 
                        type="text" 
                        value={Array.isArray(op.columns) ? op.columns.join(', ') : op.columns}
                        onChange={(e) => updateOperation(index, 'columns', e.target.value)}
                        className="mt-1 block w-full border rounded p-2"
                        placeholder="e.g. age, revenue"
                      />
                    </div>

                    {op.op === 'fill_na' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fill Value</label>
                        <input 
                          type="text" 
                          value={op.params.value || ''}
                          onChange={(e) => updateOperation(index, 'params', { ...op.params, value: e.target.value })}
                          className="mt-1 block w-full border rounded p-2"
                        />
                      </div>
                    )}
                    
                    {op.op === 'convert_type' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Target Type</label>
                        <select
                          value={op.params.type || ''}
                          onChange={(e) => updateOperation(index, 'params', { ...op.params, type: e.target.value })}
                          className="mt-1 block w-full border rounded p-2"
                        >
                          <option value="">Select type...</option>
                          <option value="numeric">Numeric</option>
                          <option value="datetime">Datetime</option>
                          <option value="string">String</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={submitCleaningJob}
                disabled={operations.length === 0 || submitting}
                className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Starting...' : 'Run Pipeline'}
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white p-6 rounded shadow sticky top-8">
            <h2 className="text-xl font-semibold mb-4">Available Operations</h2>
            <div className="space-y-2">
              {availableOps.map(op => (
                <button
                  key={op.value}
                  onClick={() => addOperation(op.value)}
                  className="w-full text-left px-4 py-2 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  + {op.label}
                </button>
              ))}
            </div>
            
            <div className="mt-8 pt-4 border-t">
              <h3 className="font-semibold text-gray-700 text-sm mb-2">Available Columns</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {colNames.map((name: string) => (
                  <span key={name} className="bg-gray-100 px-2 py-1 rounded text-gray-600">{name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
