import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  WalletCards,
  Scale,
  Landmark,
  FileSpreadsheet,
  AlertTriangle,
  History,
  QrCode,
  CheckCircle2
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard & Reports',
      icon: LayoutDashboard,
      description: 'Collections & reconciliation metrics',
      roles: ['ADMIN', 'FINANCE_CONTROLLER', 'BRANCH_MANAGER', 'COLLECTION_AGENT']
    },
    {
      id: 'collections',
      label: 'Cash Collections',
      icon: WalletCards,
      description: 'Record repayments & daily cash',
      roles: ['ADMIN', 'BRANCH_MANAGER', 'COLLECTION_AGENT'],
      highlightFor: 'COLLECTION_AGENT'
    },
    {
      id: 'reconciliation',
      label: 'Branch Reconciliation',
      icon: Scale,
      description: 'Verify cash & discrepancies',
      roles: ['ADMIN', 'FINANCE_CONTROLLER', 'BRANCH_MANAGER'],
      highlightFor: 'BRANCH_MANAGER'
    },
    {
      id: 'banking',
      label: 'Bank Deposits & Settlement',
      icon: Landmark,
      description: 'Deposit slips & UTR settlements',
      roles: ['ADMIN', 'FINANCE_CONTROLLER', 'BRANCH_MANAGER']
    },
    {
      id: 'loans',
      label: 'Borrowers & Loans',
      icon: FileSpreadsheet,
      description: 'Repayment schedules & balances',
      roles: ['ADMIN', 'FINANCE_CONTROLLER', 'BRANCH_MANAGER', 'COLLECTION_AGENT']
    },
    {
      id: 'discrepancies',
      label: 'Discrepancy Center',
      icon: AlertTriangle,
      description: 'Cash shortages & excesses',
      roles: ['ADMIN', 'FINANCE_CONTROLLER', 'BRANCH_MANAGER']
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: History,
      description: 'Immutable financial activity logs',
      roles: ['ADMIN', 'FINANCE_CONTROLLER', 'BRANCH_MANAGER']
    },
    {
      id: 'sandbox',
      label: 'UPI Sandbox Gateway',
      icon: QrCode,
      description: 'Simulate digital repayments',
      roles: ['ADMIN', 'FINANCE_CONTROLLER', 'BRANCH_MANAGER', 'COLLECTION_AGENT']
    }
  ];

  const filteredItems = menuItems.filter(item => 
    !user || item.roles.includes(user.role)
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 border-r border-slate-800">
      <div>
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          FinTech Navigation
        </div>

        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isHighlighted = item.highlightFor === user?.role;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-500/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="flex-1 truncate">
                  <div className="text-sm leading-tight flex items-center justify-between">
                    <span>{item.label}</span>
                    {isHighlighted && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    )}
                  </div>
                  <div className={`text-[11px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Lifecycle Flow badge in sidebar */}
      <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 text-xs">
        <div className="font-semibold text-slate-200 mb-1.5 flex items-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mr-1.5" />
          Cash Lifecycle Flow
        </div>
        <div className="space-y-1 text-[11px] text-slate-400">
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
            1. Expected Schedule
          </div>
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
            2. Collected by Agent
          </div>
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"></span>
            3. Branch Received & Verified
          </div>
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
            4. Bank Deposited
          </div>
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5"></span>
            5. Settled & Reconciled
          </div>
        </div>
      </div>
    </aside>
  );
};
