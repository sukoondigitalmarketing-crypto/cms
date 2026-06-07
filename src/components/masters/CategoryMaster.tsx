import React, { useState, useEffect } from 'react';
import { Tags, Plus, Search, Edit2, Trash2, X, Layers, Info } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { Category } from '../../types';
import { getAuthToken } from '../../services/api';

interface CategoryMasterProps {
  userRole: string;
  permissions: any;
}

export function CategoryMaster({ userRole, permissions }: CategoryMasterProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    category_name: '',
    sub_category_name: 'MISCELLANEOUS'
  });

  const canManage = permissions?.canDeleteMasters;
  const canCreate = permissions?.canCreateMasters;

  useEffect(() => {
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
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch categories:', response.status, errorText);
      }
    } catch (error) {
      console.error('Network or parsing error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCategory 
      ? `${API_CONFIG.BASE_URL}/master/categories/${editingCategory.id}`
      : `${API_CONFIG.BASE_URL}/master/categories`;
    const method = editingCategory ? 'PUT' : 'POST';

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
        setEditingCategory(null);
        setFormData({ category_name: '', sub_category_name: 'MISCELLANEOUS' });
        fetchCategories();
      } else {
        const err = await response.json();
        console.error('Failed to save category:', response.status, err);
        alert(err.error || 'Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('A network error occurred while saving.');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name,
      sub_category_name: category.sub_category_name
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) fetchCategories();
      else {
        const err = await response.json();
        console.error('Delete failed:', err);
        alert(err.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sub_category_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingCategory(null); setFormData({ category_name: '', sub_category_name: 'MISCELLANEOUS' }); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
              <th className="px-6 py-4 font-bold">Category Name</th>
              <th className="px-6 py-4 font-bold">Sub-Category</th>
              <th className="px-6 py-4 font-bold text-center">Items Group</th>
              {canCreate && <th className="px-6 py-4 font-bold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Loading categories...</td></tr>
            ) : filteredCategories.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No categories found</td></tr>
            ) : (
              filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-2 text-blue-500" />
                      {category.category_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {category.sub_category_name}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">
                      {category.category_name.split(' ')[0]}
                    </span>
                  </td>
                  {canCreate && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(category)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button onClick={() => handleDelete(category.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
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

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Note:</strong> Categories defined here will appear as dropdown options in the Inventory and GRN modules. 
          Deleting a category will not delete existing items but may affect future selections.
        </p>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Tags className="w-5 h-5 mr-2 text-blue-600" />
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g., CEMENT"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase"
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sub-Category</label>
                <input
                  type="text"
                  placeholder="e.g., 53 GRADE"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase"
                  value={formData.sub_category_name}
                  onChange={(e) => setFormData({ ...formData, sub_category_name: e.target.value.toUpperCase() })}
                />
                <p className="text-[10px] text-gray-400 mt-1 italic">Default is MISCELLANEOUS if left empty.</p>
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
