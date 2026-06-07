import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, Edit2, Trash2, X, Phone, User, MapPin, Hash, XCircle } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { Vendor, Category } from '../../types';
import { getAuthToken } from '../../services/api';

interface VendorMasterProps {
  userRole: string;
  permissions: any;
}

export function VendorMaster({ userRole, permissions }: VendorMasterProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    vendor_name: '',
    contact_person: '',
    phone: '',
    address: '',
    gst_number: '',
    category_ids: [] as number[]
  });

  const canManage = permissions?.canDeleteMasters;
  const canCreate = permissions?.canCreateMasters;

  useEffect(() => {
    fetchVendors();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/categories`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/vendors`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch vendors:', response.status, errorText);
      }
    } catch (error) {
      console.error('Network or parsing error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingVendor 
      ? `${API_CONFIG.BASE_URL}/master/vendors/${editingVendor.id}`
      : `${API_CONFIG.BASE_URL}/master/vendors`;
    const method = editingVendor ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsModalOpen(false);
        setEditingVendor(null);
        setFormData({ 
          vendor_name: '', 
          contact_person: '', 
          phone: '', 
          address: '', 
          gst_number: '',
          category_ids: [] 
        });
        fetchVendors();
      } else {
        const err = await response.json();
        console.error('Failed to save vendor:', response.status, err);
        alert(err.error || 'Failed to save vendor');
      }
    } catch (error) {
      console.error('Error saving vendor:', error);
      alert('A network error occurred while saving.');
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      vendor_name: vendor.vendor_name,
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      gst_number: vendor.gst_number || '',
      category_ids: vendor.categories?.map(c => c.id) || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/vendors/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) fetchVendors();
      else {
        const err = await response.json();
        console.error('Delete failed:', err);
        alert(err.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting vendor:', error);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendors..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingVendor(null); setFormData({ vendor_name: '', contact_person: '', phone: '', address: '', gst_number: '', category_ids: [] }); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Vendor
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
              <th className="px-6 py-4 font-bold">Vendor Name</th>
              <th className="px-6 py-4 font-bold">Contact Details</th>
              <th className="px-6 py-4 font-bold">GST Number</th>
              {canCreate && <th className="px-6 py-4 font-bold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Loading vendors...</td></tr>
            ) : filteredVendors.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No vendors found</td></tr>
            ) : (
              filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{vendor.vendor_name}</div>
                    <div className="text-xs text-gray-500 flex items-center mt-1">
                      <MapPin className="w-3 h-3 mr-1" /> {vendor.address || 'No address'}
                    </div>
                    {vendor.categories && vendor.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Array.from(new Set(vendor.categories.map(cat => cat.category_name))).map(catName => (
                          <span key={catName} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                            {catName}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-gray-700">
                      <User className="w-3 h-3 mr-2 text-gray-400" /> {vendor.contact_person || 'N/A'}
                    </div>
                    <div className="flex items-center text-gray-500 mt-1">
                      <Phone className="w-3 h-3 mr-2 text-gray-400" /> {vendor.phone || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                      <Hash className="w-3 h-3 mr-1" /> {vendor.gst_number || 'NOT PROVIDED'}
                    </div>
                  </td>
                  {canCreate && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(vendor)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button onClick={() => handleDelete(vendor.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vendor Name *</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Person</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">GST Number</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vendor Categories</label>
                <select
                  multiple
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  value={formData.category_ids.map(id => String(id))}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions);
                    const selectedIds = selectedOptions.map(option => parseInt(option.value, 10));
                    setFormData({ ...formData, category_ids: selectedIds });
                  }}
                >
                  {Array.from(new Map(categories.map(c => [c.category_name, c])).values()).map(category => (
                    <option key={category.id} value={String(category.id)}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.category_ids.map(catId => {
                    const cat = categories.find(c => c.id === catId);
                    return cat ? (
                      <span key={catId} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                        {cat.category_name}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, category_ids: formData.category_ids.filter(id => id !== catId) })}
                          className="ml-1 hover:text-blue-900"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Address</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95"
                >
                  {editingVendor ? 'Update Vendor' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
