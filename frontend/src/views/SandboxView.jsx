import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { loansApi, collectionsApi } from '../api';
import { ReceiptModal } from '../components/ReceiptModal';
import {
  QrCode,
  Smartphone,
  CheckCircle,
  CreditCard,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const SandboxView = () => {
  const { refreshUser } = useAuth();
  const [loans, setLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amount, setAmount] = useState('2500');
  const [vpa, setVpa] = useState('borrower@okhdfcbank');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loansApi.getLoans({ status: 'ACTIVE' }).then(res => {
      const list = res.data.results || res.data;
      setLoans(list);
      if (list.length > 0) setSelectedLoanId(list[0].id);
    });
  }, []);

  const handleSimulatePayment = async (e) => {
    e.preventDefault();
    if (!selectedLoanId || !amount) return;

    setProcessing(true);
    setSuccessMsg('');
    try {
      const idempotencyKey = `UPI-SANDBOX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const payload = {
        loan: parseInt(selectedLoanId),
        amount: amount,
        payment_mode: 'UPI_SANDBOX',
        notes: `Simulated UPI App payment from ${vpa}`,
        idempotency_key: idempotencyKey
      };

      const res = await collectionsApi.recordCollection(payload);
      setReceipt(res.data);
      setSuccessMsg(`Payment of ₹${amount} successfully captured via UPI Sandbox!`);
      await refreshUser();
    } catch (err) {
      alert(err.response?.data?.amount || err.response?.data?.detail || 'Sandbox payment failed.');
    } finally {
      setProcessing(false);
    }
  };

  const selectedLoanObj = loans.find(l => String(l.id) === String(selectedLoanId));

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white p-6 rounded-2xl shadow-md">
        <div className="flex items-center space-x-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Payment Gateway Sandbox Integration</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">UPI & Digital Repayment Gateway</h1>
        <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
          Demonstrates how omni-channel digital repayments (UPI QR / NetBanking) bypass physical agent cash holdings and vault counts, settling directly into company bank accounts while updating the unified reconciliation ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Simulator Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <span>Simulate Customer UPI Repayment</span>
          </h2>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSimulatePayment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Borrower Loan Account</label>
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-medium"
                required
              >
                {loans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.customer_name} ({l.customer_code}) — {l.loan_account_number} — Bal: ₹{parseFloat(l.outstanding_balance).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Repayment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedLoanObj ? selectedLoanObj.outstanding_balance : 1000000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Simulated Customer VPA</label>
                <input
                  type="text"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono text-slate-800"
                  required
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center text-indigo-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                <span>Sandbox Mode (No actual funds debited)</span>
              </div>
              <p>
                Generates mock bank UTR reference, immediately sets lifecycle status to <strong>SETTLED</strong>, and decrements loan balance.
              </p>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>{processing ? 'Processing Sandbox UPI...' : 'Authorize Digital Repayment'}</span>
            </button>
          </form>
        </div>

        {/* Dynamic Simulated UPI QR Code Widget */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
            Simulated BharatQR / UPI QR Code
          </div>

          <div className="w-48 h-48 bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
            <QrCode className="w-36 h-36 text-white" />
            <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <span className="text-[10px] font-mono text-white bg-slate-900/90 px-2 py-1 rounded">UPI-INT-CMRS</span>
            </div>
          </div>

          <div className="text-xs text-slate-600">
            <div className="font-semibold text-slate-900">Scan to Pay ₹{parseFloat(amount || 0).toLocaleString('en-IN')}</div>
            <div className="font-mono text-slate-500 text-[11px] mt-0.5">payee: cmrs.collections@hdfcbank</div>
          </div>

          <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 text-left">
            <strong>Reconciliation Workflow Integration:</strong> Unlike cash collections which require physical handover to Branch Manager and physical bank deposit slip generation, digital sandbox transactions automatically credit Company Account and complete settlement.
          </div>
        </div>

      </div>

      {receipt && (
        <ReceiptModal
          collection={receipt}
          onClose={() => setReceipt(null)}
        />
      )}

    </div>
  );
};
