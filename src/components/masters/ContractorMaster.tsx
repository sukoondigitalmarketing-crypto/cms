import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, Edit2, Trash2, X, Phone, User, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { Contractor } from '../../types';
import { getAuthToken } from '../../services/api';

interface ContractorMasterProps {
  userRole: string;
  permissions: any;
}

export function ContractorMaster({ userRole, permissions }: ContractorMasterProps) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [formData, setFormData] = useState({
    contractor_name: '',
    mobile_number: '',
    contractor_type: '',
    linked_project_id: '',
    notes: '',
    status: 'ACTIVE',
    verification_status: 'VERIFIED'
  });

  const canManage = permissions?.canDeleteMasters;
  const canCreate = permissions?.canCreateMasters;

  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/contractors`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setContractors(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch contractors:', response.status, errorText);
      }
    } catch (error) {
      console.error('Network or parsing error fetching contractors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingContractor 
      ? `${API_CONFIG.BASE_URL}/master/contractors/${editingContractor.id}`
      : `${API_CONFIG.BASE_URL}/master/contractors`;
    const method = editingContractor ? 'PUT' : 'POST';

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
        setEditingContractor(null);
        setFormData({ contractor_name: '', mobile_number: '', contractor_type: 'General', linked_project_id: '', notes: '', status: 'ACTIVE', verification_status: 'VERIFIED' });
        fetchContractors();
      } else {
        const err = await response.json();
        console.error('Failed to save contractor:', response.status, err);
        alert(err.error || 'Failed to save contractor');
      }
    } catch (error) {
      console.error('Error saving contractor:', error);
      alert('A network error occurred while saving.');
    }
  };

  const handleEdit = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setFormData({
      contractor_name: contractor.contractor_name,
      mobile_number: contractor.mobile_number || '',
      contractor_type: contractor.contractor_type || 'General',
      linked_project_id: contractor.linked_project_id?.toString() || '',
      notes: contractor.notes || '',
      status: contractor.status || 'ACTIVE',
      verification_status: contractor.verification_status || 'VERIFIED'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this contractor?')) return;
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/contractors/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) fetchContractors();
      else {
        const err = await response.json();
        console.error('Delete failed:', err);
        alert(err.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting contractor:', error);
    }
  };

  const filteredContractors = contractors.filter(c => 
    c.contractor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.mobile_number.includes(searchTerm) ||
    c.contractor_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search contractors..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingContractor(null); setFormData({ contractor_name: '', mobile_number: '', contractor_type: '', linked_project_id: '', notes: '', status: 'ACTIVE', verification_status: 'VERIFIED' }); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contractor
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
              <th className="px-6 py-4 font-bold">Contractor Identity</th>
              <th className="px-6 py-4 font-bold">Type</th>
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 font-bold">Verification</th>
              <th className="px-6 py-4 font-bold">Notes</th>
              {canCreate && <th className="px-6 py-4 font-bold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading contractors...</td>
              </tr>
            ) : filteredContractors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <User className="w-8 h-8 text-gray-300 mb-2" />
                    <p>No contractors found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredContractors.map((contractor) => (
                <tr key={contractor.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
                        {contractor.contractor_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{contractor.contractor_name}</div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {contractor.mobile_number}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{contractor.contractor_type}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      contractor.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {contractor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {contractor.verification_status === 'VERIFIED' ? (
                       <span className="inline-flex items-center text-green-600 text-xs font-medium">
                         <CheckCircle2 className="w-4 h-4 mr-1" /> Verified
                       </span>
                    ) : (
                       <span className="inline-flex items-center text-amber-600 text-xs font-medium">
                         <AlertCircle className="w-4 h-4 mr-1" /> Unverified
                       </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={contractor.notes}>
                    {contractor.notes || '-'}
                  </td>
                  {canCreate && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(contractor)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Contractor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => handleDelete(contractor.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Contractor"
                          >
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

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">
                {editingContractor ? 'Edit Contractor' : 'Add New Contractor'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.contractor_name}
                    onChange={(e) => setFormData({ ...formData, contractor_name: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="E.g. ABC Builders"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="E.g. 9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Type *</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.contractor_type}
                    onChange={(e) => setFormData({ ...formData, contractor_type: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="E.g. General, Electrical, Plumbing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification</label>
                  <select
                    value={formData.verification_status}
                    onChange={(e) => setFormData({ ...formData, verification_status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="UNVERIFIED">UNVERIFIED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Save Contractor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
