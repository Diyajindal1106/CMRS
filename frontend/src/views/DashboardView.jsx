import React, { useState, useEffect } from 'react';
import { dashboardApi, branchesApi } from '../api';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Landmark,
  Wallet,
  Vault,
  Building,
  CheckCircle,
  Filter,
  RefreshCw,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export const DashboardView = () => {
  const [data, setData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    branch_id: '',
    start_date: '',
    end_date: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, branchesRes] = await Promise.all([
        dashboardApi.getAnalytics(filters),
        branchesApi.getBranches()
      ]);
      setData(analyticsRes.data);
      setBranches(branchesRes.data.results || branchesRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const kpis = data?.kpis || {};
  const funnel = data?.funnel || {};

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard & Cash Flow Funnel</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time tracking of cash collections, branch reconciliation, and bank settlements</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={filters.branch_id}
            onChange={(e) => setFilters({ ...filters, branch_id: e.target.value })}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
            placeholder="End Date"
          />

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Delayed Settlements Alert Banner */}
      {kpis.delayed_settlements_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-amber-900 animate-in fade-in">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold text-sm">Delayed Bank Settlement Warning: </span>
              <span className="text-xs text-amber-800">
                {kpis.delayed_settlements_count} bank deposit(s) have been pending bank verification for over 48 hours. Please review the Bank Settlement ledger.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 8 Primary Financial KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Expected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Expected Collections</span>
            <CalendarIcon />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            ₹{parseFloat(kpis.expected_collections || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Due from active loan schedules</p>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-medium">
            <span>Total Collected</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2">
            ₹{parseFloat(kpis.total_collected || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cash + Digital repayments</p>
        </div>

        {/* Cash with Agents */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 text-xs font-medium">
            <span>Cash Held by Agents</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-amber-700 mt-2">
            ₹{parseFloat(kpis.cash_held_by_agents || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cash in hand pending branch deposit</p>
        </div>

        {/* Cash in Branches */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 text-xs font-medium">
            <span>Branch Vaults</span>
            <Vault className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-blue-700 mt-2">
            ₹{parseFloat(kpis.cash_in_branches || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Verified cash in branch vaults</p>
        </div>

        {/* Bank Deposits */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 text-xs font-medium">
            <span>Bank Deposits</span>
            <Landmark className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-indigo-700 mt-2">
            ₹{parseFloat(kpis.bank_deposits_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Total deposited via bank challans</p>
        </div>

        {/* Settled Amount */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 text-xs font-medium">
            <span>Settled Amount</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-purple-700 mt-2">
            ₹{parseFloat(kpis.settled_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Bank verified & company credited</p>
        </div>

        {/* Outstanding Loan Balance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Outstanding Loans</span>
            <Building className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-slate-800 mt-2">
            ₹{parseFloat(kpis.outstanding_loan_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active loan portfolio balance</p>
        </div>

        {/* Reconciliation Discrepancies */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-red-600 text-xs font-medium">
            <span>Discrepancies</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-red-700 mt-2 flex items-baseline space-x-1.5">
            <span>₹{Math.abs(parseFloat(kpis.discrepancy_amount || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="text-xs font-normal text-slate-500">({kpis.open_discrepancies_count || 0} open)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Branch shortages or variances</p>
        </div>

      </div>

      {/* Suggested Lifecycle Funnel Visual */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Transaction Lifecycle Funnel</h2>
            <p className="text-xs text-slate-500">Complete audit stage progression: Expected → Collected → Branch Received → Bank Deposited → Settled</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            End-to-End Tracking
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          
          {/* 1. Expected */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center relative">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">1. Expected</div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              ₹{parseFloat(funnel.expected?.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{funnel.expected?.count || 0} installments due</div>
            <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-300">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* 2. Collected */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 text-center relative">
            <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">2. Collected</div>
            <div className="text-lg font-bold text-emerald-900 mt-1">
              ₹{parseFloat(funnel.collected?.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-emerald-700 mt-0.5">{funnel.collected?.count || 0} receipts issued</div>
            <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-emerald-300">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* 3. Branch Received */}
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 text-center relative">
            <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">3. Branch Received</div>
            <div className="text-lg font-bold text-blue-900 mt-1">
              ₹{parseFloat(funnel.branch_received?.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-blue-700 mt-0.5">{funnel.branch_received?.count || 0} verified in vault</div>
            <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-blue-300">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* 4. Bank Deposited */}
          <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 text-center relative">
            <div className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">4. Bank Deposited</div>
            <div className="text-lg font-bold text-indigo-900 mt-1">
              ₹{parseFloat(funnel.bank_deposited?.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-indigo-700 mt-0.5">{funnel.bank_deposited?.count || 0} bank slips created</div>
            <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-indigo-300">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* 5. Settled */}
          <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200 text-center">
            <div className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">5. Settled</div>
            <div className="text-lg font-bold text-purple-900 mt-1">
              ₹{parseFloat(funnel.settled?.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-purple-700 mt-0.5">{funnel.settled?.count || 0} bank verified</div>
          </div>

        </div>
      </div>

      {/* Branch Performance & Daily Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Branch Overview Table */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Branch Vault & Collection Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Branch Name</th>
                  <th className="py-2.5 px-3 font-semibold">Vault Cash</th>
                  <th className="py-2.5 px-3 font-semibold">Total Collected</th>
                  <th className="py-2.5 px-3 font-semibold">Bank Deposited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.branch_summary || []).map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {b.name} <span className="text-[10px] text-slate-400 block">{b.city}</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-blue-700">
                      ₹{b.vault_balance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      ₹{b.total_collected.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-700 font-medium">
                      ₹{b.bank_deposited.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7-Day Collection Daily Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Recent Collections Trend (Last 7 Days)</h3>
            <p className="text-xs text-slate-500 mb-4">Daily field repayments collected across branches</p>
          </div>

          <div className="space-y-2.5">
            {(data?.daily_trend || []).map((t, idx) => {
              const maxVal = Math.max(...(data.daily_trend.map(d => d.amount) || [1]));
              const widthPct = maxVal > 0 ? (t.amount / maxVal) * 100 : 0;

              return (
                <div key={idx} className="flex items-center space-x-3 text-xs">
                  <span className="w-16 font-medium text-slate-600">{t.date}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, widthPct)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-bold text-slate-900">
                    ₹{t.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>High collection density observed in early month cycle</span>
            <span className="text-blue-600 font-medium">Automated Daily Rollup</span>
          </div>
        </div>

      </div>

    </div>
  );
};

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
