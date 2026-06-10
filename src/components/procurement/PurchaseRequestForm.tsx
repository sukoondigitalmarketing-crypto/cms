import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart, AlertCircle, Save, Send } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';
import { QuickRegisterMaterialModal } from '../common/QuickRegisterMaterialModal';

interface PurchaseRequestFormProps {
  onClose: () => void;
  initialData?: any;
}

export function PurchaseRequestForm({ onClose, initialData }: PurchaseRequestFormProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickRegisterRowIndex, setQuickRegisterRowIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    procurement_type: initialData?.procurement_type || 'PROJECT',
    project_id: initialData?.project_id || '',
    request_reason: initialData?.request_reason || '',
    priority: initialData?.priority || 'MEDIUM',
    items: initialData?.items || []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch projects, inventory, and categories for dropdowns
    const fetchData = async () => {
      try {
        const [projRes, invRes, catRes] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}/master/projects`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }),
          fetch(`${API_CONFIG.BASE_URL}/inventory`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }),
          fetch(`${API_CONFIG.BASE_URL}/master/categories`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } })
        ]);
        const [projData, invData, catData, unitData] = await Promise.all([
          projRes.ok ? projRes.json() : Promise.resolve([]),
          invRes.ok ? invRes.json() : Promise.resolve([]),
          catRes.ok ? catRes.json() : Promise.resolve([]),
          fetch(`${API_CONFIG.BASE_URL}/master/units`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }).then(r => r.ok ? r.json() : [])
        ]);
        setProjects(Array.isArray(projData) ? projData : []);
        setInventory(Array.isArray(invData) ? invData : []);
        setCategories(Array.isArray(catData) ? catData : []);
        setUnits(Array.isArray(unitData) ? unitData : []);

        if (initialData?.id) {
          const res = await fetch(`${API_CONFIG.BASE_URL}/procurement/pr/${initialData.id}`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
          });
          if (res.ok) {
            const fullPr = await res.json();
            setFormData(prev => ({
              ...prev,
              procurement_type: fullPr.procurement_type || 'PROJECT',
              project_id: fullPr.project_id,
              request_reason: fullPr.request_reason,
              priority: fullPr.priority,
              items: fullPr.items
            }));
          }
        }
      } catch (e) {
        console.error("Fetch error", e);
      }
    };
    fetchData();
  }, []);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { inventory_id: '', item_name: '', quantity: 1, remarks: '' }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    if (field === 'inventory_id') {
      // Ensure we always store as numeric ID string for consistent state
      const numericId = parseInt(value) || 0;
      const selectedItem = inventory.find(i => i.id === numericId);
      newItems[index].inventory_id = numericId > 0 ? numericId.toString() : '';
      newItems[index].item_name = selectedItem?.item_name || '';
    } else {
      newItems[index][field] = value;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleMaterialCreated = async (newMaterial: any) => {
    console.log('[PR Form] Material creation result:', newMaterial);
    
    try {
      const invRes = await fetch(`${API_CONFIG.BASE_URL}/inventory`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (invRes.ok) {
        const invData = await invRes.json();
        console.log('[PR Form] Fetched inventory, count:', Array.isArray(invData) ? invData.length : 0);
        setInventory(Array.isArray(invData) ? invData : []);
        
        if (quickRegisterRowIndex !== null && quickRegisterRowIndex >= 0) {
          console.log('[PR Form] Auto-selecting material ID', newMaterial.id, 'in row', quickRegisterRowIndex);
          const newItems = [...formData.items];
          // Store inventory_id as numeric string for consistency
          const materialId = parseInt(newMaterial.id) || 0;
          if (materialId > 0) {
            newItems[quickRegisterRowIndex].inventory_id = materialId.toString();
            newItems[quickRegisterRowIndex].item_name = newMaterial.item_name;
            setFormData({ ...formData, items: newItems });
            console.log('[PR Form] Row', quickRegisterRowIndex, 'updated with material:', materialId);
          } else {
            console.error('[PR Form] Invalid material ID received:', newMaterial.id);
          }
          setQuickRegisterRowIndex(null);
        } else {
          console.warn('[PR Form] quickRegisterRowIndex is null or invalid:', quickRegisterRowIndex);
        }
      } else {
        console.error('[PR Form] Inventory fetch failed:', invRes.status);
      }
    } catch (error) {
      console.error('[PR Form] Error in handleMaterialCreated:', error);
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    const isGeneralStock = formData.procurement_type === 'GENERAL_STOCK';
    if ((!isGeneralStock && !formData.project_id) || formData.items.length === 0) {
      alert('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const method = initialData ? 'PUT' : 'POST';
      const url = `${API_CONFIG.BASE_URL}/procurement/pr${initialData ? `/${initialData.id}` : ''}`;
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save PR');
      
      const result = await response.json();
      if (!isDraft && !initialData) {
        // Automatically submit if it's a new non-draft PR (though usually we create as draft first)
        await fetch(`${API_CONFIG.BASE_URL}/procurement/pr/${result.id}/submit`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
      }
      
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isViewOnly = initialData && initialData.status !== 'DRAFT' && initialData.status !== 'RETURNED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform animate-in zoom-in-95 duration-300 border border-white">
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {initialData ? (isViewOnly ? 'Review Purchase Request' : 'Edit Purchase Request') : 'New Purchase Request'}
              </h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">Procurement Intent Form</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Procurement Type</label>
              <select 
                disabled={isViewOnly}
                value={formData.procurement_type}
                onChange={(e) => setFormData({ ...formData, procurement_type: e.target.value, project_id: e.target.value === 'GENERAL_STOCK' ? '' : formData.project_id })}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all disabled:opacity-60"
              >
                <option value="PROJECT">Project Procurement</option>
                <option value="GENERAL_STOCK">General Inventory</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Target Project</label>
              <select 
                disabled={isViewOnly || formData.procurement_type === 'GENERAL_STOCK'}
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all disabled:opacity-60"
              >
                <option value="">Select Project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Priority Level</label>
              <select 
                disabled={isViewOnly}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all disabled:opacity-60"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Reason for Request</label>
              <textarea 
                disabled={isViewOnly}
                value={formData.request_reason}
                onChange={(e) => setFormData({ ...formData, request_reason: e.target.value })}
                placeholder="Briefly explain why these items are required..."
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all h-20 resize-none disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
                <Plus className="w-4 h-4 mr-2 text-blue-600" />
                Line Items
              </h3>
              {!isViewOnly && (
                <button 
                  onClick={addItem}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100 transition-colors"
                >
                  ADD ITEM
                </button>
              )}
            </div>

            <div className="space-y-3">
              {formData.items.map((item: any, index: number) => (
                <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Material Item</label>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          disabled={isViewOnly}
                          value={item.inventory_id}
                          onChange={(e) => updateItem(index, 'inventory_id', e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60"
                        >
                          <option value="">Select Item...</option>
                          {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.unit})</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={isViewOnly}
                          onClick={() => {
                            setQuickRegisterRowIndex(index);
                            setQuickRegisterOpen(true);
                          }}
                          className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Quantity</label>
                      <input 
                        disabled={isViewOnly}
                        type="number" 
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 bg-white border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Purpose / Remarks</label>
                      <input 
                        disabled={isViewOnly}
                        type="text" 
                        value={item.remarks || ''}
                        onChange={(e) => updateItem(index, 'remarks', e.target.value)}
                        className="w-full px-3 py-2 bg-white border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60"
                      />
                    </div>
                  </div>
                  {!isViewOnly && (
                    <button 
                      onClick={() => removeItem(index)}
                      className="mt-6 p-2 text-slate-300 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center text-slate-500 font-bold text-xs uppercase tracking-widest">
            <AlertCircle className="w-4 h-4 mr-2" />
            Immutable Audit Trace active
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors"
            >
              CANCEL
            </button>
            {!isViewOnly && (
              <>
                <button 
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="flex items-center px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  SAVE DRAFT
                </button>
                <button 
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 mr-2" />
                  SUBMIT FOR APPROVAL
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <QuickRegisterMaterialModal
        isOpen={quickRegisterOpen}
        onClose={() => setQuickRegisterOpen(false)}
        onMaterialCreated={handleMaterialCreated}
        categories={categories}
        units={units}
      />
    </div>
  );
}
