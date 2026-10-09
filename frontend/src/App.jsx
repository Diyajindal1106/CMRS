import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { CollectionsView } from './views/CollectionsView';
import { ReconciliationView } from './views/ReconciliationView';
import { BankingView } from './views/BankingView';
import { LoansView } from './views/LoansView';
import { DiscrepanciesView } from './views/DiscrepanciesView';
import { AuditLogView } from './views/AuditLogView';
import { SandboxView } from './views/SandboxView';
import { ShieldCheck, Info } from 'lucide-react';

const MainLayout = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wider uppercase text-slate-300">Loading CMRS Fintech Portal...</p>
      </div>
    );
  }

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'collections':
        return <CollectionsView />;
      case 'reconciliation':
        return <ReconciliationView />;
      case 'banking':
        return <BankingView />;
      case 'loans':
        return <LoansView />;
      case 'discrepancies':
        return <DiscrepanciesView />;
      case 'audit':
        return <AuditLogView />;
      case 'sandbox':
        return <SandboxView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full">
          {renderView()}
        </main>
      </div>

      <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>CMRS — Cash Management & Reconciliation System (Django + React + PostgreSQL)</span>
        </div>
        <div className="text-[11px] text-slate-400">
          Precision Financial Lifecycle: Customer → Field Agent → Branch Vault → Bank Deposit → Settled
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
