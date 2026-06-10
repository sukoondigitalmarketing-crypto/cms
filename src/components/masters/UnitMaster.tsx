import React, { useState, useEffect } from 'react';
import { Boxes, Plus, Search, Edit2, Trash2, X, Scale } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { Unit } from '../../types';
import { getAuthToken } from '../../services/api';

interface UnitMasterProps {
  userRole: string;
  permissions: any;
}

export function UnitMaster({ userRole, permissions }: UnitMasterProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    unit_name: ''
  });

  const canManage = permissions?.canDeleteMasters;
  const canCreate = permissions?.canCreateMasters;

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/units`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUnits(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch units:', response.status, errorText);
      }
    } catch (error) {
      console.error('Network or parsing error fetching units:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUnit 
      ? `${API_CONFIG.BASE_URL}/master/units/${editingUnit.id}`
      : `${API_CONFIG.BASE_URL}/master/units`;
    const method = editingUnit ? 'PUT' : 'POST';

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
        setEditingUnit(null);
        setFormData({ unit_name: '' });
        fetchUnits();
      } else {
        const err = await response.json();
        console.error('Failed to save unit:', response.status, err);
        alert(err.error || 'Failed to save unit');
      }
    } catch (error) {
      console.error('Error saving unit:', error);
      alert('A network error occurred while saving.');
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({ unit_name: unit.unit_name });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this unit?')) return;
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/units/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) fetchUnits();
      else {
        const err = await response.json();
        console.error('Delete failed:', err);
        alert(err.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting unit:', error);
    }
  };

  const filteredUnits = units.filter(u => 
    u.unit_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search units..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingUnit(null); setFormData({ unit_name: '' }); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Unit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-10 text-center text-gray-500">Loading units...</div>
        ) : filteredUnits.length === 0 ? (
          <div className="col-span-full py-10 text-center text-gray-500">No units found</div>
        ) : (
          filteredUnits.map((unit) => (
            <div key={unit.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Scale className="w-5 h-5 text-blue-600 group-hover:text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 uppercase tracking-wider">{unit.unit_name}</div>
                  <div className="text-[10px] text-gray-400 font-medium">MEASUREMENT UNIT</div>
                </div>
              </div>
              {canCreate && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(unit)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {canManage && (
                    <button onClick={() => handleDelete(unit.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Boxes className="w-5 h-5 mr-2 text-blue-600" />
                {editingUnit ? 'Edit Unit' : 'Add New Unit'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Unit Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g., KG, PCS, BOX"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase font-bold"
                  value={formData.unit_name}
                  onChange={(e) => setFormData({ ...formData, unit_name: e.target.value.toUpperCase() })}
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                  {editingUnit ? 'Update Unit' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
