import React, { useState, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';

interface QuickRegisterMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMaterialCreated: (material: any) => void;
  categories: any[];
  units: any[];
}

export function QuickRegisterMaterialModal({ isOpen, onClose, onMaterialCreated, categories, units }: QuickRegisterMaterialModalProps) {
  const [formData, setFormData] = useState({
    item_name: '',
    category: '',
    sub_category: '',
    unit: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name || !formData.category || !formData.sub_category || !formData.unit) {
      alert('Please fill all required fields: Material Name, Category, Subcategory, Unit');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/inventory/quick-add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to register material');
      }

      const newMaterial = await response.json();
      console.log('[Quick Register] Material created:', newMaterial);
      onMaterialCreated(newMaterial);
      setFormData({ item_name: '', category: '', sub_category: '', unit: '' });
      onClose();
    } catch (error: any) {
      console.error('[Quick Register] Submission failed:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const uniqueCategories = Array.from(new Map(categories.map(c => [c.category_name, c])).values());
  const subCategoryMapping = useMemo(() => {
    const mapping: Record<string, string[]> = {};
    categories.forEach((c: any) => {
      if (!mapping[c.category_name]) mapping[c.category_name] = [];
      if (c.sub_category_name && !mapping[c.category_name].includes(c.sub_category_name)) {
        mapping[c.category_name].push(c.sub_category_name);
      }
    });
    return mapping;
  }, [categories]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform animate-in zoom-in-95 duration-300 border border-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-black text-slate-900">Quick Register Material</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Operational Registration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Material Name *</label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
              placeholder="e.g., OPC Cement 43 Grade"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value, sub_category: '' })}
              className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
            >
              <option value="">Select Category...</option>
              {uniqueCategories.map(cat => (
                <option key={cat.id} value={cat.category_name}>
                  {cat.category_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Subcategory *</label>
            <select
              value={formData.sub_category}
              onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
            >
              <option value="">Select Subcategory...</option>
              {(subCategoryMapping[formData.category] || []).map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Unit *</label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
            >
              <option value="">Select Unit...</option>
              {units.map(u => (
                <option key={u.id} value={u.unit_name}>{u.unit_name}</option>
              ))}
            </select>
          </div>

          {/* HSN and Description removed to keep Quick Register lightweight and governed */}

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSubmitting ? 'REGISTERING...' : 'REGISTER MATERIAL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
