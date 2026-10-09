import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { bankingApi, branchesApi } from '../api';
import {
  Landmark,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building,
  FileCheck,
  ShieldCheck,
  XCircle,
  HelpCircle
} from 'lucide-react';

export const BankingView = () => {
  const { user, refreshUser } = useAuth();
  const [deposits, setDeposits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Create Deposit Form
  const [formData, setFormData] = useState({
    branch: '',
    bank_name: 'HDFC Bank',
    bank_account_number: '50200049281734',
    deposit_date: new Date().toISOString().split('T')[0],
    amount: '',
    bank_reference_number: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [depRes, branchRes] = await Promise.all([
        bankingApi.getDeposits(),
        branchesApi.getBranches()
      ]);
      setDeposits(depRes.data.results || depRes.data);
      const bList = branchRes.data.results || branchRes.data;
      setBranches(bList);
      if (bList.length > 0 && !formData.branch) {
        setFormData(prev => ({ ...prev, branch: user?.branch || bList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load banking data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const targetBranch = branches.find(b => String(b.id) === String(formData.branch));
    const depositAmt = parseFloat(formData.amount);

    if (targetBranch && depositAmt > parseFloat(targetBranch.vault_cash_balance)) {
      setError(`Deposit amount ₹${depositAmt} exceeds branch vault cash balance ₹${targetBranch.vault_cash_balance}.`);
      return;
    }

    setSubmitting(true);
    try {
      await bankingApi.createDeposit(formData);
      setShowCreateModal(false);
      setFormData({
        branch: branches[0]?.id || '',
        bank_name: 'HDFC Bank',
        bank_account_number: '50200049281734',
        deposit_date: new Date().toISOString().split('T')[0],
        amount: '',
        bank_reference_number: '',
        notes: ''
      });
      await refreshUser();
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.bank_reference_number || err.response?.data?.amount || err.response?.data?.detail || 'Failed to create bank deposit.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleSubmit = async () => {
    setError('');
    if (!settleAmount || parseFloat(settleAmount) < 0) {
      setError('Please enter valid settled bank amount.');
      return;
    }

    setSubmitting(true);
    try {
      await bankingApi.settleDeposit(selectedDeposit.id, {
        settled_amount: settleAmount,
        settlement_notes: settleNotes
      });
      setSelectedDeposit(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to settle deposit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkFailed = async (deposit) => {
    const reason = prompt('Please specify reason for bounced or failed bank deposit:');
    if (!reason) return;

    try {
      await bankingApi.markFailed(deposit.id, { reason });
      await loadData();
    } catch (err) {
      alert('Failed to mark deposit as failed.');
    }
  };

  const selectedBranchObj = branches.find(b => String(b.id) === String(formData.branch));

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bank Deposits & Settlement Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deposit reconciled branch cash into company bank accounts and reconcile statement UTRs
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setError('');
          }}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Bank Deposit Slip</span>
        </button>
      </div>

      {/* Deposits Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900">
            Bank Deposit & Settlement Ledger ({deposits.length})
          </h2>
          <span className="text-xs text-slate-500">
            Lifecycle: Branch Received → Bank Deposited → Settled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Deposit Slip</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Bank & Account</th>
                <th className="py-3 px-4">Deposited Amount</th>
                <th className="py-3 px-4">Bank Ref (UTR / Challan)</th>
                <th className="py-3 px-4">Settlement Status</th>
                <th className="py-3 px-4">Settled Amount / Variance</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deposits.map((dep) => {
                const isMismatch = dep.status === 'SETTLEMENT_MISMATCH';

                return (
                  <tr key={dep.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {dep.deposit_slip_number}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        Date: {dep.deposit_date}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {dep.branch_name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-semibold text-slate-900 block">{dep.bank_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">A/C: {dep.bank_account_number}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      ₹{parseFloat(dep.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {dep.bank_reference_number}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-flex items-center space-x-1 ${
                        dep.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' :
                        dep.status === 'DEPOSITED' ? 'bg-blue-100 text-blue-800' :
                        dep.status === 'SETTLEMENT_MISMATCH' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {dep.status === 'SETTLED' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {dep.status === 'SETTLEMENT_MISMATCH' && <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />}
                        <span>{dep.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {dep.settled_amount !== null ? (
                        <div>
                          <span className="font-bold text-slate-900">
                            ₹{parseFloat(dep.settled_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {parseFloat(dep.settlement_variance || 0) !== 0 && (
                            <span className="block text-[10px] text-red-600 font-bold">
                              Variance: ₹{parseFloat(dep.settlement_variance).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Awaiting Statement</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {dep.status === 'DEPOSITED' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedDeposit(dep);
                              setSettleAmount(dep.amount); // Pre-fill
                              setSettleNotes('');
                              setError('');
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-lg font-semibold text-xs transition cursor-pointer shadow-xs inline-flex items-center space-x-1"
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>Settle</span>
                          </button>

                          <button
                            onClick={() => handleMarkFailed(dep)}
                            className="text-red-500 hover:text-red-700 font-medium text-xs cursor-pointer p-1"
                            title="Mark Deposit Failed"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {dep.status === 'SETTLED' && (
                        <span className="text-emerald-600 text-xs font-semibold">✓ Completed</span>
                      )}

                      {dep.status === 'SETTLEMENT_MISMATCH' && (
                        <button
                          onClick={() => {
                            setSelectedDeposit(dep);
                            setSettleAmount(dep.settled_amount);
                            setSettleNotes(dep.settlement_notes);
                            setError('');
                          }}
                          className="text-amber-700 hover:text-amber-900 font-semibold text-xs cursor-pointer underline"
                        >
                          Resolve Mismatch
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Bank Deposit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Create Bank Deposit Slip</h3>
                <p className="text-xs text-slate-400">Transfer reconciled physical cash from branch vault to bank</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Branch Selector & Vault balance */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Originating Branch *</label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} — Current Vault Cash: ₹{parseFloat(b.vault_cash_balance).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
                {selectedBranchObj && (
                  <div className="mt-1 text-[11px] text-blue-700 font-semibold">
                    Branch Vault Balance Available: ₹{parseFloat(selectedBranchObj.vault_cash_balance).toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              {/* Bank Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Bank *</label>
                  <select
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                    required
                  >
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="State Bank of India">State Bank of India</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Axis Bank">Axis Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Account No *</label>
                  <input
                    type="text"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Amount & Bank Reference (UTR) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedBranchObj ? selectedBranchObj.vault_cash_balance : 10000000}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 50000"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bank Reference / UTR Number *
                  </label>
                  <input
                    type="text"
                    value={formData.bank_reference_number}
                    onChange={(e) => setFormData({ ...formData, bank_reference_number: e.target.value })}
                    placeholder="e.g. UTR-20261009-8821"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Must be unique (prevents duplicates)</span>
                </div>
              </div>

              {/* Deposit Date & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Date *</label>
                  <input
                    type="date"
                    value={formData.deposit_date}
                    onChange={(e) => setFormData({ ...formData, deposit_date: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Challan Ref</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Teller slip stamped at branch"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Generating Slip...' : 'Confirm Bank Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement Verification Modal */}
      {selectedDeposit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Verify Bank Statement Credit</h3>
                <p className="text-xs text-purple-200">Reconcile Bank Deposit against company bank account credit</p>
              </div>
              <button onClick={() => setSelectedDeposit(null)} className="text-purple-300 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Deposit Slip:</span>
                  <span className="font-mono font-bold text-purple-900">{selectedDeposit.deposit_slip_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Branch Reconciled Amount:</span>
                  <span className="font-bold text-purple-900">₹{parseFloat(selectedDeposit.amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Bank UTR Reference:</span>
                  <span className="font-mono text-purple-900">{selectedDeposit.bank_reference_number}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Actual Bank Credited Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full text-base font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. 50000"
                  required
                />
              </div>

              {/* Variance Indicator */}
              {settleAmount && (
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  parseFloat(settleAmount) === parseFloat(selectedDeposit.amount)
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <span>
                    {parseFloat(settleAmount) === parseFloat(selectedDeposit.amount)
                      ? '✓ Exact Match: 100% Settled'
                      : '⚠️ Settlement Mismatch will be flagged'}
                  </span>
                  <span className="font-mono font-bold">
                    Variance: ₹{(parseFloat(settleAmount) - parseFloat(selectedDeposit.amount)).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Settlement Verification Remarks
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. Verified against bank netbanking credit statement"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedDeposit(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettleSubmit}
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Verifying...' : 'Confirm Bank Settlement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
