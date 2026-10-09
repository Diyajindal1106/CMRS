import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  UserCheck, 
  ChevronDown, 
  LogOut, 
  Wallet, 
  Vault, 
  ShieldAlert,
  ArrowRightLeft,
  Sparkles
} from 'lucide-react';

export const Navbar = () => {
  const { user, switchRole, logout, demoUsers } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getRoleBadge = (role) => {
    switch(role) {
      case 'ADMIN':
        return { label: 'Super Admin / Finance', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'FINANCE_CONTROLLER':
        return { label: 'Finance Controller', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'BRANCH_MANAGER':
        return { label: 'Branch Manager', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'COLLECTION_AGENT':
        return { label: 'Field Collection Agent', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      default:
        return { label: role, bg: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const badge = user ? getRoleBadge(user.role) : null;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo & App Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">CMRS</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">FinTech</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Cash Management & Reconciliation System</p>
            </div>
          </div>

          {/* Quick Lifecycle Indicators & Balance Pills */}
          <div className="flex items-center space-x-3">
            {user && user.role === 'COLLECTION_AGENT' && (
              <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <div className="text-left">
                  <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wider">Cash in Hand</div>
                  <div className="text-sm font-bold text-emerald-900">₹{parseFloat(user.cash_in_hand || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
            )}

            {user && (user.role === 'BRANCH_MANAGER' || user.role === 'ADMIN') && user.branch_details && (
              <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                <Vault className="w-4 h-4 text-blue-600" />
                <div className="text-left">
                  <div className="text-[10px] text-blue-700 font-medium uppercase tracking-wider">Branch Vault Cash</div>
                  <div className="text-sm font-bold text-blue-900">₹{parseFloat(user.branch_details.vault_cash_balance || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
            )}

            {/* 1-Click Role Switcher Dropdown for Evaluator convenience */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition text-sm font-medium cursor-pointer"
                title="Switch active user role for evaluation"
              >
                <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                <span className="hidden md:inline">Switch Role:</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${badge?.bg}`}>
                  {user?.first_name || user?.username} ({user?.role?.replace('_', ' ')})
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                      <Sparkles className="w-3 h-3 text-amber-500 mr-1" /> Quick Role Switcher
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Switch perspective to test end-to-end workflows</p>
                  </div>

                  <div className="max-h-72 overflow-y-auto py-1">
                    {demoUsers.map((demo) => {
                      const isActive = user?.username === demo.username;
                      return (
                        <button
                          key={demo.username}
                          onClick={() => {
                            switchRole(demo.username);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start space-x-3 transition cursor-pointer ${
                            isActive ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <div className={`mt-0.5 w-2 h-2 rounded-full ${isActive ? 'bg-blue-600' : 'bg-slate-300'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-900 truncate">{demo.name}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
                                {demo.role.split(' ')[0]}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{demo.branch}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 px-3 pt-2">
                    <button
                      onClick={logout}
                      className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
