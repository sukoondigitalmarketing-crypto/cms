import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, X, Trash2, Calendar, User, Building2, Receipt, 
  AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, Check, ArrowRight
} from 'lucide-react';
import { API_CONFIG } from '../config';
import { createAuthHeaders } from '../services/api';
import { hasPermission } from '../rbac';

interface VendorInvoicesDashboardProps {
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

interface AvailableGRN {
  id: number;
  grn_number: string;
  grn_date: string;
  projectName: string;
  finalAmount: number;
  total_amount: number;
}

interface Invoice {
  id: number;
  vendor_id: number;
  invoice_number: string;
  invoice_date: string;
  remarks: string;
  reference_amount: number;
  invoice_amount: number;
  variance: number;
  status: string;
  vendor_name_snapshot: string;
  vendor_gst_snapshot: string;
  vendor_address_snapshot: string;
  created_by: string;
  grn_count: number;
  createdAt: string;
}

export function VendorInvoicesDashboard({ role }: VendorInvoicesDashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [availableGrns, setAvailableGrns] = useState<AvailableGRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [selectedGrnIds, setSelectedGrnIds] = useState<number[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState<string>('');
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);

  // List Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Permissions
  const canCreateInvoice = hasPermission(role, 'vendor_invoices', 'create');
  const canDeleteInvoice = hasPermission(role, 'vendor_invoices', 'delete');

  useEffect(() => {
    fetchInvoices();
    fetchVendors();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVendorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/master/vendors`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const fetchAvailableGrns = async (vendorId: number) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/grns/available-for-invoice?vendor_id=${vendorId}`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableGrns(data);
      }
    } catch (err) {
      console.error('Error fetching available GRNs:', err);
    }
  };

  const handleVendorSelect = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.vendor_name);
    setShowVendorDropdown(false);
    setSelectedGrnIds([]);
    setInvoiceAmount('');
    setIsAmountManuallyEdited(false);
    fetchAvailableGrns(vendor.id);
  };

  // Checkbox handlers
  const handleToggleGrn = (grnId: number) => {
    let newGrnIds = [...selectedGrnIds];
    if (newGrnIds.includes(grnId)) {
      newGrnIds = newGrnIds.filter(id => id !== grnId);
    } else {
      newGrnIds.push(grnId);
    }
    setSelectedGrnIds(newGrnIds);

    // Recalculate reference sum and update invoice amount if not manual
    const refSum = newGrnIds.reduce((sum, id) => {
      const grn = availableGrns.find(g => g.id === id);
      return sum + (grn ? (Number(grn.finalAmount) || Number(grn.total_amount) || 0) : 0);
    }, 0);

    if (!isAmountManuallyEdited) {
      setInvoiceAmount(refSum > 0 ? refSum.toString() : '');
    }
  };

  const handleSelectAllGrns = () => {
    if (selectedGrnIds.length === availableGrns.length) {
      setSelectedGrnIds([]);
      if (!isAmountManuallyEdited) setInvoiceAmount('');
    } else {
      const allIds = availableGrns.map(g => g.id);
      setSelectedGrnIds(allIds);
      const refSum = availableGrns.reduce((sum, g) => sum + (Number(g.finalAmount) || Number(g.total_amount) || 0), 0);
      if (!isAmountManuallyEdited) setInvoiceAmount(refSum.toString());
    }
  };

  // Calculations for Creation Form
  const referenceAmount = useMemo(() => {
    return selectedGrnIds.reduce((sum, id) => {
      const grn = availableGrns.find(g => g.id === id);
      return sum + (grn ? (Number(grn.finalAmount) || Number(grn.total_amount) || 0) : 0);
    }, 0);
  }, [selectedGrnIds, availableGrns]);


  const currentInvoiceAmount = parseFloat(invoiceAmount) || 0;
  const currentVariance = referenceAmount > 0 ? currentInvoiceAmount - referenceAmount : 0;
  const variancePercentage = referenceAmount > 0 ? (Math.abs(currentVariance) / referenceAmount) * 100 : 0;

  // Variance styling helpers
  const getVarianceStyles = (refVal: number, invVal: number) => {
    if (refVal <= 0) return { bg: 'bg-slate-50 border-slate-200 text-slate-700', label: 'No Reference' };
    const diff = invVal - refVal;
    const pct = (Math.abs(diff) / refVal) * 100;
    
    if (pct <= 5) {
      return { 
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', 
        label: 'Acceptable Variance (≤ 5%)',
        badge: 'bg-emerald-100 text-emerald-800'
      };
    } else if (pct <= 10) {
      return { 
        bg: 'bg-amber-50 border-amber-200 text-amber-700', 
        label: 'Warning Variance (5% - 10%)',
        badge: 'bg-amber-100 text-amber-800'
      };
    } else {
      return { 
        bg: 'bg-red-50 border-red-200 text-red-700', 
        label: 'Critical Variance (> 10%)',
        badge: 'bg-red-100 text-red-800'
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !invoiceNumber || !invoiceDate || !selectedGrnIds.length || invoiceAmount === '') {
      alert('Please fill in all mandatory fields and select at least one GRN.');
      return;
    }

    setSubmitting(true);
    const payload = {
      vendor_id: selectedVendor.id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      remarks,
      grn_ids: selectedGrnIds,
      invoice_amount: parseFloat(invoiceAmount)
    };

    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Vendor Invoice recorded successfully.');
        setIsModalOpen(false);
        resetForm();
        fetchInvoices();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save vendor invoice');
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      alert('Failed to save vendor invoice. Please check logs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, invNum: string) => {
    if (!window.confirm(`Are you sure you want to delete Invoice ${invNum}? This will unlock all its linked GRNs.`)) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${id}`, {
        method: 'DELETE',
        headers: createAuthHeaders()
      });
      if (res.ok) {
        setInvoices(invoices.filter(i => i.id !== id));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete invoice');
      }
    } catch (err) {
      console.error('Error deleting invoice:', err);
      alert('Failed to delete invoice');
    }
  };

  const resetForm = () => {
    setSelectedVendor(null);
    setVendorSearch('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
    setSelectedGrnIds([]);
    setAvailableGrns([]);
    setInvoiceAmount('');
    setIsAmountManuallyEdited(false);
  };

  // Filter and Search logic for list
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = 
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.vendor_name_snapshot.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchVendor = filterVendor === '' || inv.vendor_id.toString() === filterVendor;
      
      let matchDate = true;
      if (fromDate) {
        matchDate = matchDate && new Date(inv.invoice_date) >= new Date(fromDate);
      }
      if (toDate) {
        matchDate = matchDate && new Date(inv.invoice_date) <= new Date(toDate);
      }

      return matchSearch && matchVendor && matchDate;
    });
  }, [invoices, searchQuery, filterVendor, fromDate, toDate]);

  // Autocomplete filtered vendors
  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    return vendors.filter(v => v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase()));
  }, [vendors, vendorSearch]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <Receipt className="w-7 h-7 mr-3 text-blue-600" />
            Vendor Invoices
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Record liability and associate GRNs to Vendor Invoices.</p>
        </div>
        {canCreateInvoice && (
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 flex items-center shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Invoice
          </button>
        )}
      </div>

      {/* Filters Area */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filter Invoices</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search Invoice # or Vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.vendor_name}</option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="date"
              placeholder="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <input
              type="date"
              placeholder="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading Invoices...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 text-[10px] uppercase font-bold tracking-widest">
                  <th className="px-6 py-4">Invoice Details</th>
                  <th className="px-6 py-4">Vendor Snapshot</th>
                  <th className="px-6 py-4 text-right">Reference Sum (₹)</th>
                  <th className="px-6 py-4 text-right">Invoice Amount (₹)</th>
                  <th className="px-6 py-4 text-center">Variance (₹)</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const varianceStyles = getVarianceStyles(Number(inv.reference_amount), Number(inv.invoice_amount));
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/40 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 flex items-center">
                            {inv.invoice_number}
                          </div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5 flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-1" />
                            {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            <span className="mx-2">•</span>
                            <span>{inv.grn_count} GRN{inv.grn_count !== 1 ? 's' : ''}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{inv.vendor_name_snapshot}</div>
                          {inv.vendor_gst_snapshot && (
                            <div className="text-[10px] font-black text-blue-600 mt-0.5 bg-blue-50/80 border border-blue-100 rounded px-1.5 py-0.5 w-fit uppercase">
                              GST: {inv.vendor_gst_snapshot}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-semibold text-slate-600">₹{Number(inv.reference_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-slate-900">₹{Number(inv.invoice_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border text-xs font-bold ${varianceStyles.bg}`}>
                            <span>₹{Number(inv.variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            {Number(inv.reference_amount) > 0 && (
                              <span className="text-[10px] opacity-80 mt-0.5">
                                ({((Math.abs(Number(inv.variance)) / Number(inv.reference_amount)) * 100).toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-bold uppercase tracking-wider">
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {canDeleteInvoice && (
                            <button
                              onClick={() => handleDelete(inv.id, inv.invoice_number)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Drawer / Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-blue-600" />
                Record Vendor Invoice
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Header Inputs Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/40 p-5 rounded-2xl border border-slate-100">
                  
                  {/* Searchable Vendor Autocomplete Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
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
                            setSelectedGrnIds([]);
                            setAvailableGrns([]);
                            setInvoiceAmount('');
                          }
                        }}
                        onFocus={() => setShowVendorDropdown(true)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium bg-white"
                      />
                      <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>

                    {showVendorDropdown && filteredVendors.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar animate-fade-in">
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

                  {/* Read-Only GST Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Vendor GST (Auto-fetched)
                    </label>
                    <input 
                      type="text"
                      readOnly
                      value={selectedVendor?.gst_number || 'TBD'}
                      className="w-full px-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm text-slate-500 font-bold uppercase tracking-wide cursor-not-allowed"
                    />
                  </div>

                  {/* Invoice Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. INV-2026-009"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Invoice Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Remarks / Notes (Optional)
                    </label>
                    <textarea 
                      placeholder="Provide internal notes, accounting details, etc."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      rows={2}
                    />
                  </div>
                </div>

                {/* GRNs Grid Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center">
                      Select Available Goods Receipts (GRNs)
                      {selectedVendor && (
                        <span className="ml-2.5 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold border border-blue-100">
                          {availableGrns.length} Available
                        </span>
                      )}
                    </h4>
                    {availableGrns.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllGrns}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {selectedGrnIds.length === availableGrns.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {!selectedVendor ? (
                    <div className="p-8 text-center text-slate-400 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-xs font-medium">
                      Select a vendor above to fetch its uninvoiced GRNs.
                    </div>
                  ) : availableGrns.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-xs font-medium">
                      No uninvoiced GRNs found for this vendor.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                          <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <th className="px-4 py-2 text-center w-12">Select</th>
                            <th className="px-4 py-2">GRN Number</th>
                            <th className="px-4 py-2">Receipt Date</th>
                            <th className="px-4 py-2">Project</th>
                            <th className="px-4 py-2 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {availableGrns.map(g => (
                            <tr 
                              key={g.id} 
                              className={`hover:bg-blue-50/20 transition-colors cursor-pointer ${selectedGrnIds.includes(g.id) ? 'bg-blue-50/10' : ''}`}
                              onClick={() => handleToggleGrn(g.id)}
                            >
                              <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedGrnIds.includes(g.id)}
                                  onChange={() => handleToggleGrn(g.id)}
                                  className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-4 py-3 font-black text-slate-800">{g.grn_number}</td>
                              <td className="px-4 py-3 font-medium text-slate-500">
                                {new Date(g.grn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-600 uppercase">{g.projectName || 'Central Store'}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-800">
                                ₹{Number(g.finalAmount || g.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Financial Summary & Live Variance Panel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 bg-gray-50/50 p-5 rounded-2xl">
                  
                  {/* Reference Sum Panel */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Reference Sum (GRNs)
                    </span>
                    <div className="text-xl font-black text-slate-800 mt-2">
                      ₹{referenceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                      {selectedGrnIds.length} GRN(s) selected
                    </span>
                  </div>

                  {/* Invoice Amount Input Panel */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      Invoice Amount (₹) <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={invoiceAmount}
                      onChange={(e) => {
                        setInvoiceAmount(e.target.value);
                        setIsAmountManuallyEdited(true);
                      }}
                      className="text-lg font-black text-slate-900 mt-1 pb-1 border-b border-gray-200 outline-none focus:border-blue-500 focus:ring-0 w-full"
                    />
                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                      Input invoice billing total
                    </span>
                  </div>

                  {/* Live Variance Panel */}
                  <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-all duration-300 ${
                    getVarianceStyles(referenceAmount, currentInvoiceAmount).bg
                  }`}>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                      Live Variance Alert
                    </span>
                    <div className="text-xl font-black mt-2">
                      ₹{currentVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {referenceAmount > 0 && (
                        <span className="text-xs font-bold ml-1.5 opacity-90">
                          ({currentVariance >= 0 ? '+' : ''}{((currentVariance / referenceAmount) * 100).toFixed(2)}%)
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold mt-1 flex items-center">
                      {currentVariance !== 0 ? (
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      )}
                      {getVarianceStyles(referenceAmount, currentInvoiceAmount).label}
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedVendor || !selectedGrnIds.length || invoiceAmount === ''}
                    className="flex-[2] px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
                  >
                    {submitting ? 'Creating Invoice...' : 'Save & Link GRNs'}
                    <ArrowRight className="w-4 h-4 ml-2" />
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
