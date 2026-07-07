import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, X, Calendar, Building2, CreditCard, FileText, ChevronDown, Check, Info, Receipt
} from 'lucide-react';
import { API_CONFIG } from '../config';
import { createAuthHeaders } from '../services/api';
import { FilterBar } from './common/FilterBar';

interface VendorPaymentsDashboardProps {
  role: string;
}

interface Vendor {
  id: number;
  vendor_name: string;
  contact_person: string;
  phone: string;
  address: string;
  gst_number: string;
}

interface Invoice {
  id: number;
  vendor_id: number;
  invoice_number: string;
  invoice_date: string;
  remarks: string;
  reference_amount: number;
  invoice_amount: number;
  status: string;
  project_id?: number;
  projectId?: number;
  amount_paid?: number;
  pending_amount?: number;
  payment_status?: string;
}

export function VendorPaymentsDashboard({ role }: VendorPaymentsDashboardProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Validation & Info states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Filter state for the workspace list
  const [filters, setFilters] = useState({
    search: '',
    vendor: '',
    fromDate: '',
    toDate: ''
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const formatCurrency = (value: number | string | undefined) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Fetch vendors and invoices
  useEffect(() => {
    fetchData();
  }, []);

  // Handle click outside vendor dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVendorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = createAuthHeaders();
      const [vRes, invRes, pRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/master/vendors`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/vendor-invoices?outstanding_only=true`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/vendor-payments`, { headers })
      ]);

      if (vRes.ok) {
        setVendors(await vRes.json());
      }
      if (invRes.ok) {
        setInvoices(await invRes.json());
      }
      if (pRes.ok) {
        setPayments(await pRes.json());
      }
    } catch (error) {
      console.error('Failed to load Vendor Payments data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter vendors based on input string
  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors;
    return vendors.filter(v => 
      v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())
    );
  }, [vendors, vendorSearch]);

  // Server supplies only outstanding invoices; keep this local guard for vendor/status matching.
  const filteredInvoices = useMemo(() => {
    if (!selectedVendor) return [];
    return invoices.filter(inv => 
      inv.vendor_id === selectedVendor.id &&
      inv.status === 'FINALIZED' &&
      Number(inv.pending_amount !== undefined ? inv.pending_amount : Number(inv.invoice_amount) - Number(inv.amount_paid || 0)) > 0.001
    );
  }, [invoices, selectedVendor]);
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (filters.vendor && p.vendor_id !== parseInt(filters.vendor)) return false;
      if (filters.fromDate && new Date(p.payment_date) < new Date(filters.fromDate)) return false;
      if (filters.toDate && new Date(p.payment_date) > new Date(filters.toDate)) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const vendorMatch = p.display_vendor_name?.toLowerCase().includes(s);
        const refMatch = p.reference_no?.toLowerCase().includes(s);
        const remarkMatch = p.remarks?.toLowerCase().includes(s);
        const invMatch = p.invoice_numbers?.toLowerCase().includes(s);
        if (!vendorMatch && !refMatch && !remarkMatch && !invMatch) return false;
      }
      return true;
    });
  }, [payments, filters]);
  const handleVendorSelect = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.vendor_name);
    setShowVendorDropdown(false);
    setSelectedInvoice(null);
    setValidationError(null);
    setInfoMessage(null);
  };

  const handleResetForm = () => {
    setSelectedVendor(null);
    setVendorSearch('');
    setSelectedInvoice(null);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('Bank Transfer');
    setReferenceNo('');
    setRemarks('');
    setValidationError(null);
    setInfoMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setInfoMessage(null);

    if (!selectedVendor) {
      setValidationError('Please select a vendor.');
      return;
    }
    if (!selectedInvoice) {
      setValidationError('Please select an invoice.');
      return;
    }
    if (!paymentAmount) {
      setValidationError('Please enter a payment amount.');
      return;
    }

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setValidationError('Payment amount must be greater than zero.');
      return;
    }

    if (selectedInvoice) {
      const pending = selectedInvoice.pending_amount !== undefined 
        ? Number(selectedInvoice.pending_amount) 
        : (Number(selectedInvoice.invoice_amount) - Number(selectedInvoice.amount_paid || 0));
      if (amountNum - pending > 0.001) {
        setValidationError(`Overpayment violation: Attempted payment amount (₹${amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) exceeds pending amount (₹${pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).`);
        return;
      }
    }

    // Prepare payload for backend
    const payload = {
      vendor_id: selectedVendor?.id,
      project_id: selectedInvoice?.project_id || selectedInvoice?.projectId || 1,
      payment_date: paymentDate,
      payment_amount: parseFloat(paymentAmount),
      payment_mode: paymentMode,
      reference_no: referenceNo,
      remarks,
      allocations: selectedInvoice ? [{ vendor_invoice_id: selectedInvoice.id, allocated_amount: parseFloat(paymentAmount) }] : []
    };

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/vendor-payments`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to record payment');
      }
      const data = await response.json();
      handleResetForm();
      setIsModalOpen(false);
      setInfoMessage(`Payment recorded successfully (ID: ${data.id}).`);
      fetchData(); // Reload payments table
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <CreditCard className="w-7 h-7 mr-3 text-blue-600 animate-pulse" />
            Vendor Payments Workspace
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Manage vendor payment settlements.</p>
        </div>
        <button 
          onClick={() => { handleResetForm(); setIsModalOpen(true); }}
          className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 flex items-center shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Vendor Payment
        </button>
      </div>

      {/* Feedback messages on main workspace */}
      {infoMessage && !isModalOpen && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center">
            <span className="mr-2">ℹ️</span>
            {infoMessage}
          </div>
          <button onClick={() => setInfoMessage(null)} className="text-blue-500 hover:text-blue-700 font-bold ml-4">
            ✕
          </button>
        </div>
      )}
      {validationError && !isModalOpen && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center">
            <span className="mr-2">⚠️</span>
            {validationError}
          </div>
          <button onClick={() => setValidationError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="w-full">
        <FilterBar 
          searchPlaceholder="Search invoice number, reference or remarks..."
          filterType="vendor"
          entities={vendors.map(v => ({ id: v.id, name: v.vendor_name }))}
          onChange={(f) => setFilters({
            search: f.search,
            vendor: f.entityId || '',
            fromDate: f.fromDate,
            toDate: f.toDate
          })}
        />
      </div>

      {/* Workspace Payments Table Placeholder */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                <th className="px-6 py-4">Payment Date</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Invoice Number</th>
                <th className="px-6 py-4 text-right">Amount Paid</th>
                <th className="px-6 py-4">Payment Mode</th>
                <th className="px-6 py-4">Reference No</th>
                <th className="px-6 py-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium bg-slate-50/20">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-6 py-4 text-slate-800 font-semibold">{p.display_vendor_name}</td>
                    <td className="px-6 py-4 text-slate-600">{p.invoice_numbers || '—'}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-700">₹{Number(p.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">{p.payment_mode}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{p.reference_no || '—'}</td>
                    <td className="px-6 py-4 text-slate-500">{p.remarks || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Vendor Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-blue-600" />
                Record Vendor Payment
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Feedback messages */}
              {validationError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold flex items-start animate-fade-in">
                  <span className="mr-2">⚠️</span>
                  {validationError}
                </div>
              )}

              {infoMessage && (
                <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold flex items-start animate-fade-in">
                  <span className="mr-2">ℹ️</span>
                  {infoMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Section 1 — Vendor Selection */}
                <div className="bg-slate-50/40 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Section 1 — Vendor Selection</h4>
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-xs font-bold text-slate-505 mb-1.5">
                      Vendor <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Type to search Vendor..."
                        value={vendorSearch}
                        onChange={(e) => {
                          setVendorSearch(e.target.value);
                          setShowVendorDropdown(true);
                          if (selectedVendor && e.target.value !== selectedVendor.vendor_name) {
                            setSelectedVendor(null);
                            setSelectedInvoice(null);
                            setValidationError(null);
                            setInfoMessage(null);
                          }
                        }}
                        onFocus={() => setShowVendorDropdown(true)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium bg-white"
                      />
                      <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>

                    {showVendorDropdown && filteredVendors.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredVendors.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleVendorSelect(v)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50/50 flex items-center justify-between border-b border-gray-50 last:border-0 font-medium"
                          >
                            <span className="text-slate-800">{v.vendor_name}</span>
                            {selectedVendor?.id === v.id && <Check className="w-4 h-4 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2 — Invoice Selection */}
                <div className="bg-slate-50/40 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Section 2 — Invoice Selection</h4>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={!selectedVendor}
                      value={selectedInvoice?.id || ''}
                      onChange={(e) => {
                        const invId = parseInt(e.target.value);
                        const inv = filteredInvoices.find(i => i.id === invId);
                        setSelectedInvoice(inv || null);
                        setValidationError(null);
                        setInfoMessage(null);
                      }}
                      className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white ${!selectedVendor ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Select Invoice...</option>
                      {filteredInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} | Invoice: {formatCurrency(inv.invoice_amount)} | Pending: {formatCurrency(inv.pending_amount !== undefined ? inv.pending_amount : Number(inv.invoice_amount) - Number(inv.amount_paid || 0))} | Status: {inv.payment_status || 'UNPAID'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section 3 — Invoice Summary (Read Only) */}
                {selectedInvoice && (
                  <div className="bg-slate-50/40 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Section 3 — Invoice Summary (Read Only)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium">
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider mb-1">Invoice Number</span>
                        <span className="text-slate-800 font-bold">{selectedInvoice.invoice_number}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider mb-1">Vendor</span>
                        <span className="text-slate-800 font-bold">{selectedVendor?.vendor_name}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider mb-1">Invoice Date</span>
                        <span className="text-slate-800 font-bold">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider mb-1">Invoice Amount</span>
                        <span className="text-slate-800 font-bold">₹{selectedInvoice.invoice_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider mb-1">Amount Paid</span>
                        <span className="text-emerald-600 font-bold">₹{Number(selectedInvoice.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider mb-1">Pending Amount</span>
                        <span className="text-amber-600 font-bold">₹{Number(selectedInvoice.pending_amount !== undefined ? selectedInvoice.pending_amount : Number(selectedInvoice.invoice_amount) - Number(selectedInvoice.amount_paid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="col-span-1 md:col-span-2 bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider mb-1">Payment Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border inline-block ${
                          (selectedInvoice.payment_status || 'UNPAID').toUpperCase() === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          (selectedInvoice.payment_status || 'UNPAID').toUpperCase() === 'PARTIALLY PAID' || (selectedInvoice.payment_status || 'UNPAID').toUpperCase() === 'PARTIAL' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {selectedInvoice.payment_status || 'UNPAID'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4 — Payment Entry */}
                <div className="bg-slate-50/40 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Section 4 — Payment Entry</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-505 mb-1.5">
                        Payment Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => {
                          setPaymentAmount(e.target.value);
                          setValidationError(null);
                          setInfoMessage(null);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-505 mb-1.5">
                        Payment Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => {
                            setPaymentDate(e.target.value);
                            setValidationError(null);
                            setInfoMessage(null);
                          }}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-505 mb-1.5">
                        Payment Mode <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => {
                          setPaymentMode(e.target.value);
                          setValidationError(null);
                          setInfoMessage(null);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-505 mb-1.5">
                        Reference Number
                      </label>
                      <input
                        type="text"
                        placeholder="UTR, Txn ID, Cheque No..."
                        value={referenceNo}
                        onChange={(e) => {
                          setReferenceNo(e.target.value);
                          setValidationError(null);
                          setInfoMessage(null);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-505 mb-1.5">
                        Remarks
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Add optional notes..."
                        value={remarks}
                        onChange={(e) => {
                          setRemarks(e.target.value);
                          setValidationError(null);
                          setInfoMessage(null);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white rounded-xl shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Record Payment
                  </button>
                </div>

              </form>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
