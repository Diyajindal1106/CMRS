import React, { useState, useEffect } from 'react';
import { loansApi } from '../api';
import {
  FileSpreadsheet,
  Search,
  User,
  Phone,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Eye,
  CreditCard
} from 'lucide-react';

export const LoansView = () => {
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [history, setHistory] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lRes, cRes] = await Promise.all([
        loansApi.getLoans(),
        loansApi.getCustomers()
      ]);
      setLoans(lRes.data.results || lRes.data);
      setCustomers(cRes.data.results || cRes.data);
    } catch (err) {
      console.error('Failed to load loans/customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInspect = async (loan) => {
    setSelectedLoan(loan);
    setInspectLoading(true);
    try {
      const [schedRes, histRes] = await Promise.all([
        loansApi.getLoanSchedules(loan.id),
        loansApi.getLoanHistory(loan.id)
      ]);
      setSchedules(schedRes.data);
      setHistory(histRes.data);
    } catch (err) {
      console.error('Failed to load loan details', err);
    } finally {
      setInspectLoading(false);
    }
  };

  const filteredLoans = loans.filter(l => 
    l.loan_account_number.toLowerCase().includes(search.toLowerCase()) ||
    l.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.customer_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header & Search */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Borrower Accounts & Loan Portfolio</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customers, active loans, EMI repayment schedules, and outstanding balances
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, loan ref, code..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
          />
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900">Active Loan Portfolio ({filteredLoans.length})</h2>
          <span className="text-xs text-slate-500">Registered Borrowers: {customers.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Loan Account</th>
                <th className="py-3 px-4">Borrower Details</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Principal & Tenure</th>
                <th className="py-3 px-4">Total Payable</th>
                <th className="py-3 px-4">Collected</th>
                <th className="py-3 px-4">Outstanding Balance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {l.loan_account_number}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{l.customer_name}</div>
                    <span className="text-[10px] text-slate-400 font-mono block">{l.customer_code} • {l.customer_phone}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {l.branch_name}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    ₹{parseFloat(l.principal_amount).toLocaleString('en-IN')}
                    <span className="text-[10px] text-slate-400 block">{l.tenure_months} months @ {l.interest_rate}% p.a.</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-medium">
                    ₹{parseFloat(l.total_amount_payable).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">
                    ₹{parseFloat(l.total_amount_collected).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                    ₹{parseFloat(l.outstanding_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      l.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                      l.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleInspect(l)}
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer p-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Schedules</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loan Inspection Modal (Schedules & Repayment Ledger) */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Loan Ledger: {selectedLoan.loan_account_number}</h3>
                <p className="text-xs text-slate-400">Borrower: {selectedLoan.customer_name} ({selectedLoan.customer_code})</p>
              </div>
              <button onClick={() => setSelectedLoan(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Payable:</span>
                  <span className="font-bold text-slate-900">₹{parseFloat(selectedLoan.total_amount_payable).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Collected:</span>
                  <span className="font-bold text-emerald-700">₹{parseFloat(selectedLoan.total_amount_collected).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Remaining Balance:</span>
                  <span className="font-bold text-blue-700">₹{parseFloat(selectedLoan.outstanding_balance).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Installment Repayment Schedule */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Installment Repayment Schedule (EMI Timeline)
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Inst #</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3">Due Amount</th>
                        <th className="py-2.5 px-3">Paid Amount</th>
                        <th className="py-2.5 px-3">Remaining</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedules.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-800">#{s.installment_number}</td>
                          <td className="py-2 px-3 text-slate-600">{s.due_date}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">₹{parseFloat(s.due_amount).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">₹{parseFloat(s.paid_amount).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-slate-700">₹{parseFloat(s.remaining_amount).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              s.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                              s.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                              s.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Repayment Collections History */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Repayment Receipts Recorded for this Loan ({history.length})
                </h4>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No repayments recorded yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-semibold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Receipt No</th>
                          <th className="py-2 px-3">Agent</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3">Mode</th>
                          <th className="py-2 px-3">Lifecycle Status</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map(h => (
                          <tr key={h.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-medium">{h.receipt_number}</td>
                            <td className="py-2 px-3">{h.agent_name}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">₹{parseFloat(h.amount).toLocaleString('en-IN')}</td>
                            <td className="py-2 px-3 text-slate-600">{h.payment_mode}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-slate-100 text-slate-800">
                                {h.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {new Date(h.collected_at).toLocaleDateString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
