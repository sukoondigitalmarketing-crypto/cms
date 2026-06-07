import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Pencil, Trash2, Calendar, User, Building2, CreditCard, FileText, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { API_CONFIG, ROLE_PERMISSIONS } from '../config';
import { createAuthHeaders } from '../services/api';
import { canDelete } from '../rbac';
import { FilterBar } from './common/FilterBar';

interface ContractorPaymentsDashboardProps {
  role: string;
}

export function ContractorPaymentsDashboard({ role }: ContractorPaymentsDashboardProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'LEDGER'>('PAYMENTS');
  const [ledger, setLedger] = useState<any[]>([]);

  // Form states
  const [projectId, setProjectId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Bank');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [approvalId, setApprovalId] = useState('');

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    contractor: '',
    fromDate: '',
    toDate: ''
  });
  const permissions = ROLE_PERMISSIONS[role] || {};
  const canDeletePayment = canDelete(role, 'contractor_payments');

  useEffect(() => {
    fetchData();
  }, [filters, activeTab]);

  const fetchData = async () => {
    try {
      const headers = createAuthHeaders();
      const params = new URLSearchParams();
      
      // Date Normalization Helper (dd-mm-yyyy to yyyy-mm-dd)
      const formatDateForBackend = (dateStr: string) => {
        if (!dateStr) return '';
        // If it's already yyyy-mm-dd (from HTML5 date input), return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const [dd, mm, yyyy] = parts;
        return `${yyyy}-${mm}-${dd}`;
      };

      if (filters.search) params.append('search', filters.search);
      if (filters.contractor) params.append('contractor_id', filters.contractor);
      if (filters.fromDate) params.append('from_date', formatDateForBackend(filters.fromDate));
      if (filters.toDate) params.append('to_date', formatDateForBackend(filters.toDate));

      console.log("Filters Sent:", params.toString());

      const query = params.toString() ? `?${params.toString()}` : '';

      const [payRes, projRes, appRes, ledgerRes, conRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/contractor-payments${query}`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/projects`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/approval-requests/approved/contractor`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/contractor-ledger${query}`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/contractors`, { headers })
      ]);
      
      if (payRes.ok) setPayments(await payRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (appRes.ok) setApprovedRequests(await appRes.json());
      if (ledgerRes.ok) setLedger(await ledgerRes.json());
      if (conRes.ok) {
        const cons = await conRes.json();
        setContractors(cons.filter((c: any) => c.status === 'ACTIVE'));
      }
    } catch (error) {
      console.error('Failed to fetch contractor payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = useMemo(() => {
    // Backend now handles filtering, so we just return the payments list
    return payments;
  }, [payments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || (!contractorName && !contractorId) || !amount || !paymentDate || !paymentMode) {
      alert('Please fill all required fields.');
      return;
    }

    const payload = {
      project_id: projectId,
      contractor_id: contractorId || null,
      contractor_name: contractorName || '',
      amount: parseFloat(amount),
      payment_date: paymentDate,
      payment_mode: paymentMode,
      reference_no: referenceNo || null,
      remarks: remarks || null,
      approval_id: approvalId ? parseInt(approvalId) : null
    };

    const url = isEditMode 
      ? `${API_CONFIG.BASE_URL}/contractor-payments/${editingId}`
      : `${API_CONFIG.BASE_URL}/contractor-payments`;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: createAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(isEditMode ? 'Payment updated successfully' : 'Payment recorded successfully');
        setIsModalOpen(false);
        resetForm();
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save payment');
      }
    } catch (error) {
      alert('Failed to save payment. Please try again.');
    }
  };

  const resetForm = () => {
    setProjectId('');
    setContractorId('');
    setContractorName('');
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('Bank');
    setReferenceNo('');
    setRemarks('');
    setApprovalId('');
    setSelectedRequestId('');
    setIsEditMode(false);
    setEditingId(null);
  };

  const handleRequestSelection = (requestId: string) => {
    setSelectedRequestId(requestId);
    if (requestId === '') {
      setContractorId('');
      setContractorName('');
      setAmount('');
      setProjectId('');
      setApprovalId('');
      return;
    }

    const request = approvedRequests.find(r => r.id.toString() === requestId);
    if (request) {
      if (request.contractor_id) {
        setContractorId(request.contractor_id.toString());
      }
      setContractorName(request.party_name || '');
      setAmount(request.amount.toString());
      setProjectId(request.project_id?.toString() || '');
      setApprovalId(request.id.toString());
    }
  };

  const handleEdit = (payment: any) => {
    setEditingId(payment.id);
    setProjectId(payment.project_id.toString());
    setContractorId(payment.contractor_id?.toString() || '');
    setContractorName(payment.contractor_name || payment.display_contractor_name || '');
    setAmount(payment.amount.toString());
    setPaymentDate(payment.payment_date.split('T')[0]);
    setPaymentMode(payment.payment_mode);
    setReferenceNo(payment.reference_no || '');
    setRemarks(payment.remarks || '');
    setApprovalId(payment.approval_id?.toString() || '');
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this payment record?')) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/contractor-payments/${id}`, {
        method: 'DELETE',
        headers: createAuthHeaders()
      });
      if (res.ok) {
        setPayments(payments.filter(p => p.id !== id));
      } else {
        alert('Failed to delete payment');
      }
    } catch (error) {
      alert('Failed to delete payment');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Contractor Payments...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contractor Payments</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Manage and track all contractor disbursements across projects.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 flex items-center shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Payment Record
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
        <div className="flex space-x-1 bg-white p-1 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'PAYMENTS' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Payment history
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'LEDGER' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Ledger Summary
          </button>
        </div>

        <div className="w-full">
          <FilterBar 
            searchPlaceholder="Search contractor, project or reference..."
            filterType="contractor"
            entities={contractors.map(c => ({ id: c.id, name: c.contractor_name }))}
            onChange={(f) => setFilters({
              search: f.search,
              contractor: f.entityId || '',
              fromDate: f.fromDate,
              toDate: f.toDate
            })}
          />
        </div>
      </div>

      {activeTab === 'PAYMENTS' ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 text-[10px] uppercase font-bold tracking-widest">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Project / Contractor</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Mode / Reference</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredPayments.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">No payment records found.</td></tr>
              ) : filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{new Date(p.payment_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div>
                        <div className="font-black text-blue-600 uppercase text-xs">{p.projectName}</div>
                        <div className="text-gray-900 font-bold mt-0.5">{p.contractor_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-black text-slate-900 text-base">₹{Number(p.amount).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                       <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-black uppercase">{p.payment_mode}</span>
                       <span className="text-gray-400 text-xs font-medium">{p.reference_no || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {p.approval_id ? (
                      <div className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase">Approved</span>
                        <span className="text-[10px] text-emerald-400 font-medium">#{p.approval_id}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 font-black uppercase tracking-tighter">Manual Entry</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-2">
                      <button 
                        onClick={() => handleEdit(p)}
                        className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                        title="Edit Record"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {canDeletePayment && (
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        <>
        <div className="flex justify-end space-x-3 mb-4">
          <button 
            onClick={() => window.open(`${API_CONFIG.BASE_URL}/reports/contractor-ledger/pdf?token=${localStorage.getItem('token')}`, '_blank')}
            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center border border-red-200"
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            Export PDF
          </button>
          <button 
            onClick={() => window.open(`${API_CONFIG.BASE_URL}/reports/contractor-ledger/excel?token=${localStorage.getItem('token')}`, '_blank')}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 flex items-center border border-emerald-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
            Export Excel
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 text-[10px] uppercase font-bold tracking-widest">
                  <th className="px-6 py-4">Contractor Name</th>
                  <th className="px-6 py-4 text-right">Total Approved (₹)</th>
                  <th className="px-6 py-4 text-right">Total Paid (₹)</th>
                  <th className="px-6 py-4 text-right">Balance Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-medium">
                {ledger.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium">No ledger data available.</td></tr>
                ) : ledger.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{l.contractor_name || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-gray-600">₹{Number(l.total_approved).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-blue-600">₹{Number(l.total_paid).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-black text-base ${Number(l.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₹{Number(l.balance).toLocaleString()}
                        {Number(l.balance) <= 0 && (
                          <span className="ml-2 text-[10px] bg-emerald-100 px-1 py-0.5 rounded uppercase tracking-tighter">Settled</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                {isEditMode ? 'Edit Payment Record' : 'Add Contractor Payment'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!isEditMode && (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col space-y-2">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Auto-fill from Approved Request</label>
                  <select
                    value={selectedRequestId}
                    onChange={e => handleRequestSelection(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  >
                    <option value="">-- Manual Entry --</option>
                    {approvedRequests.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.approval_code}: {r.title} (₹{Number(r.amount).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Project Assignment</label>
                  <select
                    required
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    disabled={!!selectedRequestId}
                    className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium ${selectedRequestId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select Project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Contractor</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <select
                      required
                      value={contractorId}
                      onChange={e => {
                        setContractorId(e.target.value);
                        const c = contractors.find(con => String(con.id) === e.target.value);
                        if (c) setContractorName(c.contractor_name);
                      }}
                      disabled={!!selectedRequestId}
                      className={`w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium ${selectedRequestId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                    >
                      <option value="">-- Choose Contractor --</option>
                      {contractors.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.contractor_name} ({c.mobile_number})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Amount (₹)</label>
                  <input 
                    type="number"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    readOnly={!!selectedRequestId}
                    className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold ${selectedRequestId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Payment Date</label>
                  <input 
                    type="date"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Payment Mode</label>
                  <select
                    required
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Reference No.</label>
                  <input 
                    type="text"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    placeholder="Ref or Txn ID"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Remarks (Optional)</label>
                  <textarea 
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    placeholder="Provide additional details..."
                    rows={2}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Approval ID (Optional)</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input 
                      type="number"
                      value={approvalId}
                      onChange={e => setApprovalId(e.target.value)}
                      readOnly={!!selectedRequestId}
                      className={`w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium ${selectedRequestId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                      placeholder="Link to an approval request ID"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-500 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
                >
                  {isEditMode ? 'Update Record' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
