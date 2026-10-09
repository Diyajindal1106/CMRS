import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { discrepanciesApi } from '../api';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  ArrowRight,
  Filter,
  FileText
} from 'lucide-react';

export const DiscrepanciesView = () => {
  const { user } = useAuth();
  const [discrepancies, setDiscrepancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState(null);
  const [resStatus, setResStatus] = useState('RESOLVED');
  const [resNotes, setResNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await discrepanciesApi.getDiscrepancies();
      setDiscrepancies(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to load discrepancies', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await discrepanciesApi.resolve(selectedDiscrepancy.id, {
        resolution_status: resStatus,
        resolution_notes: resNotes
      });
      setSelectedDiscrepancy(null);
      setResNotes('');
      await loadData();
    } catch (err) {
      alert('Failed to update discrepancy resolution.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reconciliation Discrepancy Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit and resolve physical cash shortages and excesses flagged during branch verification
          </p>
        </div>
      </div>

      {/* Discrepancies Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900">
            Recorded Discrepancy Log ({discrepancies.length})
          </h2>
          <span className="text-xs text-slate-500">
            Audit Guarantee: Immutably linked to agent handover batches
          </span>
        </div>

        {discrepancies.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            ✓ No reconciliation discrepancies currently logged.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Discrepancy Ref</th>
                  <th className="py-3 px-4">Submission Batch</th>
                  <th className="py-3 px-4">Agent & Branch</th>
                  <th className="py-3 px-4">Expected vs Actual</th>
                  <th className="py-3 px-4">Difference</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Resolution Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discrepancies.map((d) => {
                  const isShortage = d.discrepancy_type === 'SHORTAGE';

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        DISC-#{d.id}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {new Date(d.created_at).toLocaleDateString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {d.submission_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{d.agent_name}</span>
                        <span className="text-[10px] text-slate-400">{d.branch_name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>Exp: ₹{parseFloat(d.expected_amount).toLocaleString('en-IN')}</div>
                        <div className="text-slate-500">Act: ₹{parseFloat(d.actual_amount).toLocaleString('en-IN')}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          isShortage ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isShortage ? '-' : '+'}₹{Math.abs(parseFloat(d.difference)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold text-[10px] uppercase ${
                          isShortage ? 'text-red-700' : 'text-amber-700'
                        }`}>
                          {d.discrepancy_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          d.resolution_status === 'OPEN' ? 'bg-red-100 text-red-800' :
                          d.resolution_status === 'INVESTIGATING' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {d.resolution_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDiscrepancy(d);
                            setResStatus(d.resolution_status);
                            setResNotes(d.resolution_notes || '');
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolve Discrepancy Modal */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Resolve Discrepancy #{selectedDiscrepancy.id}</h3>
                <p className="text-xs text-slate-400">Agent: {selectedDiscrepancy.agent_name} ({selectedDiscrepancy.branch_name})</p>
              </div>
              <button onClick={() => setSelectedDiscrepancy(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Expected Amount:</span>
                  <span className="font-bold text-slate-900">₹{parseFloat(selectedDiscrepancy.expected_amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Physical Received:</span>
                  <span className="font-bold text-slate-900">₹{parseFloat(selectedDiscrepancy.actual_amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-700">Variance:</span>
                  <span className={selectedDiscrepancy.discrepancy_type === 'SHORTAGE' ? 'text-red-700' : 'text-amber-700'}>
                    ₹{selectedDiscrepancy.difference}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Status *</label>
                <select
                  value={resStatus}
                  onChange={(e) => setResStatus(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                  required
                >
                  <option value="INVESTIGATING">Under Investigation</option>
                  <option value="RECOVERED_FROM_AGENT">Recovered / Reimbursed by Agent</option>
                  <option value="WRITTEN_OFF">Approved Write-Off (Finance)</option>
                  <option value="RESOLVED">Resolved & Cleared</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Explanation / Audit Notes *</label>
                <textarea
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder="e.g. Agent reimbursed ₹1,500 cash shortage at branch counter; discrepancy cleared."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 h-24"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedDiscrepancy(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
