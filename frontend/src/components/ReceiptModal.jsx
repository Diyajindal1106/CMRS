import React from 'react';
import { Printer, X, CheckCircle, ShieldCheck } from 'lucide-react';

export const ReceiptModal = ({ collection, onClose }) => {
  if (!collection) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        
        {/* Receipt Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <CheckCircle className="w-4 h-4" />
            <span>Repayment Acknowledgment Receipt</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">FinTech Cash Collection</h2>
          <p className="text-xs text-slate-400">Cash Management & Reconciliation System (CMRS)</p>

          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Receipt Ref:</span>
            <span className="font-mono font-bold text-emerald-400">{collection.receipt_number}</span>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-center">
            <div className="text-xs text-blue-700 font-medium uppercase tracking-wide">Amount Collected</div>
            <div className="text-3xl font-extrabold text-blue-900 mt-1">
              ₹{parseFloat(collection.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Mode: <span className="font-semibold">{collection.payment_mode}</span>
              {collection.payment_reference && (
                <span className="block text-[11px] font-mono text-slate-500 mt-0.5">Ref: {collection.payment_reference}</span>
              )}
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Customer Name:</span>
              <span className="font-semibold text-slate-800">{collection.customer_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Customer ID:</span>
              <span className="font-mono font-semibold text-slate-800">{collection.customer_code}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Loan Account:</span>
              <span className="font-mono font-semibold text-slate-800">{collection.loan_account_number}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Collected By:</span>
              <span className="font-semibold text-slate-800">{collection.agent_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Branch:</span>
              <span className="font-semibold text-slate-800">{collection.branch_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Date & Time:</span>
              <span className="font-semibold text-slate-800">
                {new Date(collection.collected_at).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Lifecycle Status:</span>
              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                {collection.status}
              </span>
            </div>
          </div>

          {collection.notes && (
            <div className="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-600 italic">
              "{collection.notes}"
            </div>
          )}

          <div className="pt-2 flex items-center justify-center space-x-1 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Digital Cryptographic Receipt | Tamper-Proof Financial Record</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 px-6 py-4 flex space-x-3 border-t border-slate-200">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl text-sm font-medium transition cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
