import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collectionsApi, loansApi } from '../api';
import { ReceiptModal } from '../components/ReceiptModal';
import {
  WalletCards,
  PlusCircle,
  Send,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  QrCode
} from 'lucide-react';

export const CollectionsView = () => {
  const { user, refreshUser } = useAuth();
  const [collections, setCollections] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Active Receipt
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Record Repayment Form state
  const [formData, setFormData] = useState({
    loan_id: '',
    amount: '',
    payment_mode: 'CASH',
    notes: '',
  });
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Batch submission selection
  const [submissionNotes, setSubmissionNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [colRes, summaryRes, loansRes] = await Promise.all([
        collectionsApi.getCollections(),
        collectionsApi.getDailySummary(),
        loansApi.getLoans({ status: 'ACTIVE' })
      ]);
      setCollections(colRes.data.results || colRes.data);
      setDailySummary(summaryRes.data);
      setLoans(loansRes.data.results || loansRes.data);
    } catch (err) {
      console.error('Failed to load collections', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLoanChange = (e) => {
    const loanId = e.target.value;
    setFormData({ ...formData, loan_id: loanId });
    const found = loans.find(l => String(l.id) === String(loanId));
    setSelectedLoan(found || null);
    if (found && !formData.amount) {
      // Pre-fill with next pending installment if available
      const nextPending = found.schedules?.find(s => s.status === 'PENDING' || s.status === 'PARTIAL');
      if (nextPending) {
        setFormData(prev => ({ ...prev, amount: nextPending.remaining_amount || nextPending.due_amount }));
      }
    }
  };

  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.loan_id || !formData.amount) {
      setFormError('Please select a loan and enter repayment amount.');
      return;
    }

    const amt = parseFloat(formData.amount);
    if (amt <= 0) {
      setFormError('Collection amount must be strictly greater than zero.');
      return;
    }

    if (selectedLoan && amt > parseFloat(selectedLoan.outstanding_balance)) {
      setFormError(`Over-collection rejected. Repayment amount ₹${amt} exceeds outstanding loan balance ₹${selectedLoan.outstanding_balance}.`);
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const payload = {
        loan: parseInt(formData.loan_id),
        amount: formData.amount,
        payment_mode: formData.payment_mode,
        notes: formData.notes,
        idempotency_key: idempotencyKey
      };

      const res = await collectionsApi.recordCollection(payload);
      setShowRecordModal(false);
      setFormData({ loan_id: '', amount: '', payment_mode: 'CASH', notes: '' });
      setSelectedLoan(null);
      setActiveReceipt(res.data);
      await refreshUser();
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.amount || err.response?.data?.detail || err.response?.data?.idempotency_key || 'Failed to record repayment.';
      setFormError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBatch = async () => {
    setSubmitting(true);
    try {
      await collectionsApi.submitBatch({ agent_notes: submissionNotes });
      setShowSubmitModal(false);
      setSubmissionNotes('');
      await refreshUser();
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit cash batch to branch.');
    } finally {
      setSubmitting(false);
    }
  };

  const unsubmittedCollections = collections.filter(
    c => c.status === 'COLLECTED' && c.payment_mode === 'CASH'
  );

  return (
    <div className="space-y-6">
      
      {/* Top Header & Quick Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Field Cash Collections Portal</h1>
          <p className="text-xs text-slate-500 mt-0.5">Record customer repayments, issue digital receipts, and submit collected cash to branch</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Repayment</span>
          </button>

          {unsubmittedCollections.length > 0 && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-sm cursor-pointer animate-pulse"
            >
              <Send className="w-4 h-4" />
              <span>Submit Cash to Branch ({unsubmittedCollections.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Agent's Daily Cash Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Today's Total Collected</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            ₹{parseFloat(dailySummary?.today_total_amount || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400">{dailySummary?.today_collections_count || 0} receipts issued today</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-amber-600 font-medium">Cash in Hand (Unsubmitted)</span>
          <div className="text-xl font-bold text-amber-700 mt-1">
            ₹{parseFloat(dailySummary?.unsubmitted_cash_amount || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-amber-600">{dailySummary?.unsubmitted_count || 0} collections pending handover</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-blue-600 font-medium">Assigned Branch</span>
          <div className="text-base font-bold text-blue-900 mt-1 truncate">
            {user?.branch_details?.name || 'Central Head Office'}
          </div>
          <span className="text-[11px] text-slate-400">{user?.branch_details?.code || 'HQ'}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-emerald-600 font-medium">Collection Agent Status</span>
          <div className="text-base font-bold text-emerald-800 mt-1">
            Active in Field
          </div>
          <span className="text-[11px] text-emerald-600 font-mono">{user?.employee_id || user?.username}</span>
        </div>
      </div>

      {/* Collections Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900">Recent Collections & Receipt Ledger</h2>
          <span className="text-xs text-slate-500">Showing {collections.length} transactions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Receipt Ref</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Loan Account</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Lifecycle Status</th>
                <th className="py-3 px-4">Collected At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {collections.map((col) => {
                const getStatusPill = (status) => {
                  switch(status) {
                    case 'COLLECTED':
                      return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px]">Cash with Agent</span>;
                    case 'SUBMITTED':
                      return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold text-[10px]">Submitted to Branch</span>;
                    case 'RECONCILED':
                      return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">Branch Received</span>;
                    case 'BANK_DEPOSITED':
                      return <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold text-[10px]">Bank Deposited</span>;
                    case 'SETTLED':
                      return <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold text-[10px]">Settled</span>;
                    default:
                      return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">{status}</span>;
                  }
                };

                return (
                  <tr key={col.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {col.receipt_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {col.customer_name}
                      <span className="text-[10px] text-slate-400 block font-mono">{col.customer_code}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {col.loan_account_number}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{parseFloat(col.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-medium text-[10px] ${
                        col.payment_mode === 'CASH' ? 'bg-slate-100 text-slate-800' : 'bg-indigo-50 text-indigo-700 font-bold'
                      }`}>
                        {col.payment_mode === 'CASH' ? <WalletCards className="w-3 h-3 mr-1" /> : <QrCode className="w-3 h-3 mr-1 text-indigo-600" />}
                        {col.payment_mode}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusPill(col.status)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(col.collected_at).toLocaleDateString('en-IN')} {new Date(col.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setActiveReceipt(col)}
                        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer p-1"
                        title="View & Print Official Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Repayment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Record Customer Repayment</h3>
                <p className="text-xs text-slate-400">Issue instant receipt and reduce outstanding balance</p>
              </div>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Select Borrower / Loan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Borrower Loan Account *</label>
                <select
                  value={formData.loan_id}
                  onChange={handleLoanChange}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select Active Loan --</option>
                  {loans.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.customer_name} ({l.customer_code}) — {l.loan_account_number} — Bal: ₹{parseFloat(l.outstanding_balance).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Loan Details Box */}
              {selectedLoan && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between text-blue-900 font-semibold">
                    <span>Outstanding Balance:</span>
                    <span className="text-blue-800 font-bold">₹{parseFloat(selectedLoan.outstanding_balance).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Total Loan Payable:</span>
                    <span>₹{parseFloat(selectedLoan.total_amount_payable).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Already Collected:</span>
                    <span>₹{parseFloat(selectedLoan.total_amount_collected).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium pt-1">
                    ✓ Supports partial payment & multi-installment allocation. Over-collection prevented.
                  </div>
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount to Collect (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedLoan ? selectedLoan.outstanding_balance : 1000000}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 5000"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Channel *</label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-medium"
                  >
                    <option value="CASH">Cash (Agent Holds)</option>
                    <option value="UPI_SANDBOX">UPI / QR (Sandbox Direct)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Repayment Remarks (Optional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Monthly installment received with signature"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Generate Receipt & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Cash to Branch Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Handover Cash to Branch</h3>
                <p className="text-xs text-emerald-300">Submit collected cash batch for Branch Manager physical count</p>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-emerald-300 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <span className="text-xs text-emerald-800 font-medium uppercase tracking-wide">Total Batch Handover Amount</span>
                <div className="text-3xl font-extrabold text-emerald-950 mt-1">
                  ₹{unsubmittedCollections.reduce((sum, c) => sum + parseFloat(c.amount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-xs text-emerald-700 block mt-1">
                  Comprises {unsubmittedCollections.length} individual collection receipts
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Handover Notes to Cashier / BM</label>
                <textarea
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="e.g. Morning collections packet from Dharavi market route"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 h-20"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                ⚠️ Once submitted, transactions enter <strong>SUBMITTED</strong> state pending verification by Branch Manager. Discrepancies (if any) will be counted during physical note tally.
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitBatch}
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Submitting Batch...' : 'Confirm Cash Handover'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <ReceiptModal
          collection={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

    </div>
  );
};
