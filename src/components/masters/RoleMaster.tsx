import React, { useState, useEffect } from 'react';
import { Shield, Plus, Search, Edit2, Trash2, X, CheckCircle2, XCircle } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';

interface Role {
  id: number;
  role_name: string;
  role_code: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
}

export function RoleMaster() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    role_name: '',
    role_code: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/roles/all`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingRole 
      ? `${API_CONFIG.BASE_URL}/master/roles/${editingRole.id}`
      : `${API_CONFIG.BASE_URL}/master/roles`;
    const method = editingRole ? 'PUT' : 'POST';

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
        setEditingRole(null);
        setFormData({ role_name: '', role_code: '', description: '', is_active: true });
        fetchRoles();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to save role');
      }
    } catch (error) {
      console.error('Error saving role:', error);
    }
  };

  const handleEdit = (role: Role) => {
    if (role.is_system) {
      alert('System roles cannot be modified.');
      return;
    }
    setEditingRole(role);
    setFormData({
      role_name: role.role_name,
      role_code: role.role_code,
      description: role.description || '',
      is_active: role.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const role = roles.find(r => r.id === id);
    if (role?.is_system) {
      alert('System roles cannot be deleted.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this role? Deletion may fail if users are assigned.')) return;
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/roles/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) fetchRoles();
      else {
        const err = await response.json();
        alert(err.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
    }
  };

  const filteredRoles = roles.filter(r => 
    r.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.role_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search roles..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditingRole(null); setFormData({ role_name: '', role_code: '', description: '', is_active: true }); setIsModalOpen(true); }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Business Role
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
              <th className="px-6 py-4 font-bold">Role Name</th>
              <th className="px-6 py-4 font-bold">Code</th>
              <th className="px-6 py-4 font-bold">Description</th>
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Loading roles...</td></tr>
            ) : filteredRoles.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No roles found</td></tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 flex items-center">
                      {role.role_name}
                      {role.is_system && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] uppercase rounded">System</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">{role.role_code}</td>
                  <td className="px-6 py-4 text-gray-500">{role.description || '-'}</td>
                  <td className="px-6 py-4">
                    {role.is_active ? (
                      <span className="inline-flex items-center text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-gray-400 font-medium">
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!role.is_system && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(role)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(role.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-blue-600" />
                {editingRole ? 'Edit Role' : 'Add New Role'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Role Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Site Engineer"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  value={formData.role_name}
                  onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Role Code *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. SITE_ENG"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-sm"
                  value={formData.role_code}
                  onChange={(e) => setFormData({ ...formData, role_code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2 py-2">
                <input
                  type="checkbox"
                  id="role_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="role_active" className="text-sm font-medium text-gray-700">Active and assignable</label>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
