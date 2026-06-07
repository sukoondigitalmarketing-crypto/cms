import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart, AlertCircle, Save, FileCheck, Search, History, ShieldAlert, ArrowRight } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';
import { QuickRegisterMaterialModal } from '../common/QuickRegisterMaterialModal';

interface PurchaseOrderFormProps {
  onClose: () => void;
  initialData?: any;
  mode?: 'CREATE' | 'VIEW' | 'REVISE' | 'EDIT';
}

const PR_APPROVED_FOR_PO = new Set(['APPROVED', 'PO_CREATED', 'CONVERTED_TO_PO']);
const normalizeStatus = (status: any) => String(status || '').trim().toUpperCase();

export function PurchaseOrderForm({ onClose, initialData, mode = 'CREATE' }: PurchaseOrderFormProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [approvedPrs, setApprovedPrs] = useState<any[]>([]);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    procurement_type: initialData?.procurement_type || 'PROJECT',
    project_id: initialData?.project_id || '',
    vendor_id: initialData?.vendor_id || '',
    linked_pr_id: initialData?.linked_pr_id || '',
    items: initialData?.items || [],
    subtotal: initialData?.subtotal || 0,
    gst_total: initialData?.gst_total || 0,
    final_total: initialData?.final_total || 0,
    revision_reason: ''
  });

  const getItemCategories = () => {
    const categories = new Set<string>();
    formData.items.forEach(item => {
      const invItem = inventory.find(inv => inv.id === item.inventory_id);
      if (invItem?.category) categories.add(invItem.category);
    });
    return Array.from(categories);
  };

  const filteredVendors = () => {
    const itemCategories = getItemCategories();
    if (itemCategories.length === 0) return vendors;
    return vendors.filter(vendor => {
      const vendorCategoryNames = new Set((vendor.categories || []).map(c => c.category_name));
      return itemCategories.some(cat => vendorCategoryNames.has(cat));
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${getAuthToken()}` };
        const [projRes, vendRes, invRes, prRes, catRes] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}/master/projects`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/master/vendors`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/inventory`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/procurement/pr`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/master/categories`, { headers })
        ]);
        const [projData, vendData, invData, prData, catData] = await Promise.all([
          projRes.ok ? projRes.json() : Promise.resolve([]),
          vendRes.ok ? vendRes.json() : Promise.resolve([]),
          invRes.ok ? invRes.json() : Promise.resolve([]),
          prRes.ok ? prRes.json() : Promise.resolve([]),
          catRes.ok ? catRes.json() : Promise.resolve([])
        ]);
        setProjects(Array.isArray(projData) ? projData : []);
        setVendors(Array.isArray(vendData) ? vendData : []);
        setInventory(Array.isArray(invData) ? invData : []);
        setCategories(Array.isArray(catData) ? catData : []);
        setApprovedPrs(Array.isArray(prData) ? prData.filter((pr: any) => PR_APPROVED_FOR_PO.has(normalizeStatus(pr.status))) : []);

        if (initialData?.id) {
          const poDetailsRes = await fetch(`${API_CONFIG.BASE_URL}/procurement/po/${initialData.id}`, { headers });
          if (poDetailsRes.ok) {
            const fullPo = await poDetailsRes.json();
            const poItems = (fullPo.items || []).map((item: any) => ({
              inventory_id: item.inventory_id,
              item_name: item.item_name,
              quantity: parseFloat(item.quantity) || 0,
              received_quantity: parseFloat(item.received_quantity) || 0,
              approved_rate: parseFloat(item.approved_rate || item.tentative_rate || 0),
              gst_percent: parseFloat(item.gst_percent) || 0,
              tax_amount: parseFloat(item.tax_amount) || 0,
              total_amount: (parseFloat(item.quantity) || 0) * (parseFloat(item.approved_rate || item.tentative_rate || 0)),
              remarks: item.remarks || ''
            }));

            const subtotal = poItems.reduce((acc: number, item: any) => acc + (item.quantity * item.approved_rate), 0);

            setFormData(prev => ({
              ...prev,
              procurement_type: fullPo.procurement_type || 'PROJECT',
              project_id: fullPo.project_id || '',
              vendor_id: fullPo.vendor_id || '',
              linked_pr_id: fullPo.linked_pr_id || '',
              items: poItems,
              subtotal: subtotal,
              gst_total: parseFloat(fullPo.gst_total) || 0,
              final_total: subtotal
            }));
          }

          const revRes = await fetch(`${API_CONFIG.BASE_URL}/procurement/po/${initialData.id}/revisions`, { headers });
          if (revRes.ok) setRevisionHistory(await revRes.json());
        }
      } catch (e) {
        console.error("Fetch error", e);
      }
    };
    fetchData();
  }, [initialData]);

  const handlePrLink = async (prId: string) => {
    if (!prId) {
      setFormData({ ...formData, linked_pr_id: '', items: [] });
      return;
    }
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/procurement/pr/${prId}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const prDetails = await response.json();
      if (!response.ok) throw new Error(prDetails.error || 'Failed to fetch PR details');
      if (!PR_APPROVED_FOR_PO.has(normalizeStatus(prDetails.status))) {
        alert(`Selected PR is not approved for PO creation. Current status: ${normalizeStatus(prDetails.status) || 'UNKNOWN'}`);
        setFormData({ ...formData, linked_pr_id: '', items: [] });
        return;
      }
      
      const poItems = prDetails.items.map((item: any) => ({
        inventory_id: item.inventory_id,
        item_name: item.item_name,
        quantity: item.quantity,
        received_quantity: 0,
        approved_rate: 0,
        gst_percent: 0,
        tax_amount: 0,
        total_amount: 0,
        remarks: item.remarks
      }));

      setFormData({
        ...formData,
        linked_pr_id: prId,
        procurement_type: prDetails.procurement_type || 'PROJECT',
        project_id: prDetails.project_id,
        items: poItems
      });
    } catch (e) {
      console.error("Failed to fetch PR details", e);
    }
  };

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce((acc, item) => acc + (parseFloat(item.quantity) * parseFloat(item.approved_rate || 0)), 0);
    const gst_total = 0;
    const final_total = subtotal;
    return { subtotal, gst_total, final_total };
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'approved_rate') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const rate = parseFloat(newItems[index].approved_rate) || 0;
      
      newItems[index].gst_percent = 0;
      newItems[index].tax_amount = 0;
      newItems[index].total_amount = qty * rate;
    }

    const { subtotal, gst_total, final_total } = calculateTotals(newItems);
    setFormData({ ...formData, items: newItems, subtotal, gst_total, final_total });
  };

  const handleSubmit = async (finalize?: boolean) => {
    if (mode === 'REVISE' && !formData.revision_reason) {
      alert('Revision reason is mandatory');
      return;
    }

    const isGeneralStock = formData.procurement_type === 'GENERAL_STOCK';
    if (!formData.vendor_id || (!isGeneralStock && !formData.project_id) || formData.items.length === 0) {
      alert('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      let response;
      if (mode === 'EDIT') {
        response = await fetch(`${API_CONFIG.BASE_URL}/procurement/po/${initialData.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({
            ...formData,
            po_status: finalize ? 'SENT_TO_VENDOR' : 'VENDOR_ASSIGNED'
          })
        });
      } else {
        const url = mode === 'REVISE' 
          ? `${API_CONFIG.BASE_URL}/procurement/po/${initialData.id}/revise`
          : `${API_CONFIG.BASE_URL}/procurement/po`;
        
        response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({
            ...formData,
            reason: formData.revision_reason
          })
        });
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save PO');
      }
      alert(mode === 'EDIT' ? (finalize ? 'Purchase Order finalized successfully!' : 'Purchase Order draft saved successfully!') : 'Purchase Order saved successfully!');
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isViewOnly = mode === 'VIEW';
  const isRevision = mode === 'REVISE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col transform animate-in zoom-in-95 duration-300 border border-white">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
          <div className="flex items-center">
            <div className={`w-12 h-12 ${isRevision ? 'bg-amber-600' : 'bg-indigo-600'} rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100`}>
              {isRevision ? <History className="w-6 h-6" /> : <FileCheck className="w-6 h-6" />}
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {isRevision ? 'Revise Purchase Order' : mode === 'EDIT' ? 'Edit Purchase Order' : isViewOnly ? 'Review Purchase Order' : 'Vendor Instruction PO'}
                {initialData?.po_number && <span className="ml-3 text-indigo-600">#{initialData.po_number}</span>}
              </h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">
                {isRevision ? `Governance Revision (Current Version: ${initialData.version || 1})` : mode === 'EDIT' ? 'Assign vendor, set tentative rates, and send PO instruction' : 'Vendor Instruction Document'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {revisionHistory.length > 0 && (
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest"
              >
                <History className="w-4 h-4 mr-2" />
                History ({revisionHistory.length})
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {showHistory && (
            <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-200 animate-in slide-in-from-top-4 duration-300">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center">
                <History className="w-4 h-4 mr-2 text-indigo-600" />
                Revision Snapshot Timeline
              </h3>
              <div className="space-y-4">
                {revisionHistory.map((rev) => (
                  <div key={rev.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between group">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded uppercase">Rev {rev.revision_number}</span>
                        <span className="text-xs font-bold text-slate-500">{new Date(rev.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 italic">"{rev.reason}"</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Authorized by: {rev.created_by}</p>
                    </div>
                    <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isRevision && (
            <div className="mb-8 p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4">
              <div className="p-3 bg-amber-600 rounded-2xl text-white shadow-lg shadow-amber-100">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-black text-amber-700 uppercase tracking-wider mb-2">Revision Justification (Mandatory)</label>
                <textarea 
                  required
                  value={formData.revision_reason}
                  onChange={(e) => setFormData({ ...formData, revision_reason: e.target.value })}
                  placeholder="Explain why these commercial changes are required..."
                  className="w-full px-4 py-3 bg-white border-amber-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-amber-100 outline-none transition-all h-24 resize-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Link Approved PR</label>
              <select 
                disabled={isViewOnly || isRevision}
                value={formData.linked_pr_id}
                onChange={(e) => handlePrLink(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all disabled:opacity-60"
              >
                <option value="">Direct PO (No PR)...</option>
                {approvedPrs.map(pr => <option key={pr.id} value={pr.id}>{String(pr.pr_number)} - {pr.project_name || (pr.procurement_type === 'GENERAL_STOCK' ? 'General Inventory' : '')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Vendor / Supplier</label>
              <select 
                disabled={isViewOnly || isRevision}
                value={formData.vendor_id}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all disabled:opacity-60"
              >
                <option value="">Select Vendor...</option>
                {filteredVendors().map(v => {
                  const vendorCategoryNames = Array.from(new Set((v.categories || []).map(c => c.category_name)));
                  return (
                    <option key={v.id} value={v.id}>
                      {v.vendor_name} {vendorCategoryNames.length > 0 ? `[${vendorCategoryNames.join(', ')}]` : ''}
                    </option>
                  );
                })}
              </select>
              {formData.items.length > 0 && filteredVendors().length === 0 && (
                <p className="text-xs font-bold text-amber-600 mt-2 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> No vendors available for selected material categories.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Procurement Type</label>
              <select 
                disabled={isViewOnly || isRevision || !!formData.linked_pr_id}
                value={formData.procurement_type}
                onChange={(e) => setFormData({ ...formData, procurement_type: e.target.value, project_id: e.target.value === 'GENERAL_STOCK' ? '' : formData.project_id })}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all disabled:opacity-60"
              >
                <option value="PROJECT">Project Procurement</option>
                <option value="GENERAL_STOCK">General Inventory</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Target Project</label>
              <select 
                disabled={isViewOnly || isRevision || !!formData.linked_pr_id || formData.procurement_type === 'GENERAL_STOCK'}
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all disabled:opacity-60"
              >
                <option value="">Select Project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2 text-indigo-600" />
              PO Line Items (Tentative Rates)
            </h3>

            <div className="space-y-3">
              {formData.items.map((item: any, index: number) => (
                <div key={index} className="p-4 bg-white border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-6 gap-4 items-end shadow-sm hover:border-indigo-200 transition-all group">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Item</label>
                    <p className="text-sm font-black text-slate-800">{item.item_name}</p>
                    {item.received_quantity > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${Math.min(100, (item.received_quantity / item.quantity) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">
                          {item.received_quantity} / {item.quantity} Received
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Qty</label>
                    <input 
                      disabled={isViewOnly}
                      type="number" 
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Tentative Rate</label>
                    <input 
                      disabled={isViewOnly}
                      type="number" 
                      value={item.approved_rate}
                      onChange={(e) => updateItem(index, 'approved_rate', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">GRN GST Only</label>
                    <select 
                      disabled
                      value={item.gst_percent}
                      onChange={(e) => updateItem(index, 'gst_percent', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Tentative Value</label>
                    <p className="text-sm font-black text-slate-900">₹{item.total_amount?.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Summary */}
        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="grid grid-cols-3 gap-8 text-right">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</p>
              <p className="text-lg font-bold text-slate-700">₹{formData.subtotal.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST</p>
              <p className="text-lg font-bold text-slate-700">₹{formData.gst_total.toLocaleString()}</p>
            </div>
            <div className={`px-6 py-2 ${isRevision ? 'bg-amber-600' : 'bg-indigo-600'} rounded-2xl text-white shadow-lg`}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Not Accounting Truth</p>
              <p className="text-2xl font-black">₹{formData.final_total.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 uppercase tracking-widest">CANCEL</button>
            {!isViewOnly && mode === 'EDIT' && (
              <>
                <button 
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 flex items-center uppercase tracking-widest"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </button>
                <button 
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-100 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 flex items-center uppercase tracking-widest"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  Send PO
                </button>
              </>
            )}
            {!isViewOnly && mode !== 'EDIT' && (
              <button 
                disabled={isSubmitting}
                onClick={() => handleSubmit(false)}
                className={`px-8 py-3 ${isRevision ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'} text-white rounded-2xl font-black text-sm shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 flex items-center`}
              >
                <Save className="w-4 h-4 mr-2" />
                {isRevision ? 'AUTHORIZE REVISION' : 'AUTHORIZE PURCHASE ORDER'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
