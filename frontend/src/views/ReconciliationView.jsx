import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { submissionsApi } from '../api';
import {
  Scale,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Eye,
  Building,
  UserCheck,
  FileCheck2,
  DollarSign
} from 'lucide-react';

export const ReconciliationView = () => {
  const { user, refreshUser } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING_APPROVAL');

  // Reconcile / Reject Modal
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [actualAmount, setActualAmount] = useState('');
  const [branchNotes, setBranchNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [mode, setMode] = useState('reconcile'); // 'reconcile' | 'reject'
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const res = await submissionsApi.getSubmissions();
      setSubmissions(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to load submissions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const openReconcileModal = (sub) => {
    setSelectedSubmission(sub);
    setActualAmount(sub.total_expected_amount); // Pre-fill with expected for convenience
    setBranchNotes('');
    setRejectionReason('');
    setMode('reconcile');
    setError('');
  };

  const handleReconcileSubmit = async () => {
    setError('');
    if (!actualAmount || parseFloat(actualAmount) < 0) {
      setError('Please enter valid physical cash amount counted.');
      return;
    }

    setProcessing(true);
    try {
      await submissionsApi.reconcile(selectedSubmission.id, {
        total_actual_amount: actualAmount,
        branch_notes: branchNotes
      });
      setSelectedSubmission(null);
      await refreshUser();
      await loadSubmissions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reconcile submission.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectSubmit = async () => {
    setError('');
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      setError('A valid rejection reason (at least 5 characters) is required.');
      return;
    }

    setProcessing(true);
    try {
      await submissionsApi.reject(selectedSubmission.id, {
        rejection_reason: rejectionReason
      });
      setSelectedSubmission(null);
      await refreshUser();
      await loadSubmissions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject submission.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredSubmissions = submissions.filter(s => {
    if (activeTab === 'ALL') return true;
    return s.status === activeTab;
  });

  const pendingCount = submissions.filter(s => s.status === 'PENDING_APPROVAL').length;

  // Calculate live difference in reconcile modal
  const expectedNum = selectedSubmission ? parseFloat(selectedSubmission.total_expected_amount) : 0;
  const actualNum = actualAmount ? parseFloat(actualAmount) : 0;
  const diff = actualNum - expectedNum;

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Branch Cash Reconciliation Console</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical cash count verification, discrepancy logging, and vault intake for {user?.branch_details?.name || 'Branch'}
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('PENDING_APPROVAL')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'PENDING_APPROVAL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pending Count</span>
            {pendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('RECONCILED')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'RECONCILED' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reconciled
          </button>

          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'REJECTED' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rejected
          </button>

          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Submissions
          </button>
        </div>
      </div>

      {/* Submissions List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900">
            Agent Handover Batches ({filteredSubmissions.length})
          </h2>
          <span className="text-xs text-slate-500">
            Branch: {user?.branch_details?.name || 'All'}
          </span>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No submissions found in this category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Field Agent</th>
                  <th className="py-3 px-4">Expected (Receipts)</th>
                  <th className="py-3 px-4">Actual (Physical Count)</th>
                  <th className="py-3 px-4">Discrepancy</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub) => {
                  const hasDiscrepancy = parseFloat(sub.discrepancy_amount || 0) !== 0;

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {sub.submission_number}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {sub.collections_count || sub.collections?.length || 0} receipts
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {sub.agent_name}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{parseFloat(sub.total_expected_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {sub.total_actual_amount !== null ? (
                          <span className="font-bold text-slate-900">
                            ₹{parseFloat(sub.total_actual_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pending Count</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {hasDiscrepancy ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            parseFloat(sub.discrepancy_amount) < 0 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {parseFloat(sub.discrepancy_amount) < 0 ? 'SHORTAGE ' : 'EXCESS '}
                            ₹{Math.abs(parseFloat(sub.discrepancy_amount)).toLocaleString('en-IN')}
                          </span>
                        ) : sub.status === 'RECONCILED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                            Matched (₹0)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          sub.status === 'PENDING_APPROVAL' ? 'bg-blue-100 text-blue-800' :
                          sub.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-800' :
                          sub.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-indigo-100 text-indigo-800'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(sub.submission_date).toLocaleDateString('en-IN')} {new Date(sub.submission_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sub.status === 'PENDING_APPROVAL' ? (
                          <button
                            onClick={() => openReconcileModal(sub)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition shadow-xs cursor-pointer inline-flex items-center space-x-1"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>Verify Cash</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setMode('view');
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium text-xs cursor-pointer inline-flex items-center space-x-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verification & Reconciliation Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-0.5">
                  <FileCheck2 className="w-4 h-4" />
                  <span>Physical Cash Count & Reconciliation</span>
                </div>
                <h3 className="font-bold text-base">Batch #{selectedSubmission.submission_number}</h3>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Handover Details */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Submitting Agent:</span>
                  <span className="font-bold text-slate-900">{selectedSubmission.agent_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Branch Destination:</span>
                  <span className="font-bold text-slate-900">{selectedSubmission.branch_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Receipts Sum:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{parseFloat(selectedSubmission.total_expected_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Individual Receipts Table in this Submission */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Line-Item Receipts in Packet ({selectedSubmission.collections?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Receipt No</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedSubmission.collections || []).map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-medium">{c.receipt_number}</td>
                          <td className="py-2 px-3">{c.customer_name}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            ₹{parseFloat(c.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{c.payment_mode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mode Selector (Verify & Reconcile OR Reject) */}
              {selectedSubmission.status === 'PENDING_APPROVAL' && (
                <div className="flex border-b border-slate-200 pb-2 space-x-4">
                  <button
                    onClick={() => setMode('reconcile')}
                    className={`text-xs font-bold pb-2 border-b-2 transition cursor-pointer ${
                      mode === 'reconcile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Count Cash & Reconcile
                  </button>
                  <button
                    onClick={() => setMode('reject')}
                    className={`text-xs font-bold pb-2 border-b-2 transition cursor-pointer ${
                      mode === 'reject' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Reject Submission to Agent
                  </button>
                </div>
              )}

              {/* RECONCILE MODE FORM */}
              {mode === 'reconcile' && selectedSubmission.status === 'PENDING_APPROVAL' && (
                <div className="space-y-4">
                  
                  {/* Expected vs Actual Cash Counter */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 font-medium">Expected from Receipts:</span>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        ₹{expectedNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-[11px] text-slate-400">Sum of agent's digital receipts</span>
                    </div>

                    <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200">
                      <label className="text-xs text-blue-900 font-semibold block">
                        Actual Physical Cash Counted (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={actualAmount}
                        onChange={(e) => setActualAmount(e.target.value)}
                        className="w-full text-xl font-bold bg-white border border-blue-300 rounded-lg p-2 mt-1 text-blue-950 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 48500"
                        required
                      />
                      <span className="text-[11px] text-blue-700 block mt-1">
                        Tally notes from agent's handover packet
                      </span>
                    </div>
                  </div>

                  {/* Live Discrepancy Calculator Callout */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    diff === 0 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : diff < 0 
                        ? 'bg-red-50 border-red-200 text-red-900' 
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {diff === 0 ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className={`w-5 h-5 ${diff < 0 ? 'text-red-600' : 'text-amber-600'}`} />
                      )}
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider">
                          {diff === 0 ? 'Exact Match (Reconciled)' : diff < 0 ? 'Cash Shortage Detected' : 'Cash Excess Detected'}
                        </div>
                        <div className="text-xs mt-0.5">
                          {diff === 0 
                            ? 'Physical currency notes exactly equal receipt total.' 
                            : diff < 0 
                              ? `Agent handed in less cash than receipts. A shortage discrepancy of ₹${Math.abs(diff).toLocaleString('en-IN')} will be logged.`
                              : `Physical count exceeds receipts by ₹${diff.toLocaleString('en-IN')}. Excess discrepancy will be logged.`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Variance</span>
                      <span className={`text-xl font-extrabold font-mono ${
                        diff === 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-amber-700'
                      }`}>
                        {diff >= 0 ? '+' : ''}₹{diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Branch Manager Verification Remarks */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verification / Vault Notes
                    </label>
                    <input
                      type="text"
                      value={branchNotes}
                      onChange={(e) => setBranchNotes(e.target.value)}
                      placeholder="e.g. Physical count verified in branch cashier cage"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                    />
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSubmission(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReconcileSubmit}
                      disabled={processing}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {processing ? 'Processing Intake...' : 'Approve & Accept into Vault'}
                    </button>
                  </div>

                </div>
              )}

              {/* REJECT MODE FORM */}
              {mode === 'reject' && selectedSubmission.status === 'PENDING_APPROVAL' && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5 text-red-800">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span>Rejection Action Warning</span>
                    </div>
                    <p>
                      Rejecting will return all collection receipts back to <strong>COLLECTED (Cash in Hand)</strong> status with the agent. The agent will be notified to recount or rectify discrepancies.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mandatory Rejection Reason *
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Discrepancy too large, mutilated notes, or recount required by agent before acceptance"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 h-24"
                      required
                    />
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setMode('reconcile')}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleRejectSubmit}
                      disabled={processing}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {processing ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW ONLY (Already reconciled/rejected) */}
              {selectedSubmission.status !== 'PENDING_APPROVAL' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reconciled Status:</span>
                    <span className="font-bold text-slate-900">{selectedSubmission.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reconciled By:</span>
                    <span className="font-bold text-slate-900">{selectedSubmission.reconciled_by_name || 'System'}</span>
                  </div>
                  {selectedSubmission.rejection_reason && (
                    <div className="text-red-700 pt-2 border-t border-slate-200">
                      <strong>Rejection Reason:</strong> {selectedSubmission.rejection_reason}
                    </div>
                  )}
                  {selectedSubmission.branch_notes && (
                    <div className="text-slate-600 pt-1">
                      <strong>Notes:</strong> {selectedSubmission.branch_notes}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
