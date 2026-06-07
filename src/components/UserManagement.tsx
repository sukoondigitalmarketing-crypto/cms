import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, RefreshCcw, KeyRound, ShieldAlert, X, CheckCircle2, AlertTriangle, Play, Pause, Lock, CalendarClock } from 'lucide-react';
import { API_CONFIG, ADMIN_CONFIG, ROLES, ROLE_LABELS } from '../config';
import { createAuthHeaders } from '../services/api';
import { useAuth } from './AuthProvider';

type AssignableRole = Exclude<(typeof ROLES)[keyof typeof ROLES], 'CEO'>;

export function UserManagement() {
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { user: currentUser } = useAuth();
  
  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: AssignableRole;
    password: string;
    status: string;
    backdateLimit: number | string;
  }>({ name: '', email: '', role: ROLES.EXECUTIVE, password: '', status: 'Active', backdateLimit: 0 });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/users`, {
        headers: createAuthHeaders()
      });
      if (response.ok) {
        setSystemUsers(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const isRootCEO = (user: any) => user.email === ADMIN_CONFIG.ROOT_CEO_EMAIL;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/users`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setIsAddModalOpen(false);
        setTempPassword(formData.password);
        setSelectedUser({ name: formData.name, email: formData.email });
        setResetModalOpen(true);
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/users/${selectedUser.uid}`, {
        method: 'PUT',
        headers: createAuthHeaders(true),
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setIsEditModalOpen(false);
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleStatus = async (user: any) => {
    if (isRootCEO(user)) return alert('Cannot modify root CEO account');
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await fetch(`${API_CONFIG.BASE_URL}/admin/users/${user.uid}/status`, {
        method: 'PATCH',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ status: newStatus })
      });
      fetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteRestore = async (user: any) => {
    if (isRootCEO(user)) return alert('Cannot delete root CEO account');
    try {
      if (user.is_deleted) {
        await fetch(`${API_CONFIG.BASE_URL}/admin/users/${user.uid}/restore`, {
          method: 'PATCH',
          headers: createAuthHeaders(true)
        });
      } else {
        if (!window.confirm(`Are you sure you want to deactivate and hide ${user.name}?`)) return;
        await fetch(`${API_CONFIG.BASE_URL}/admin/users/${user.uid}`, {
          method: 'DELETE',
          headers: createAuthHeaders(true)
        });
      }
      fetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetPassword = async (user: any) => {
    if (isRootCEO(user)) return alert('Cannot reset root CEO account here. Please use normal change password flow.');
    const generatedPassword = Math.random().toString(36).slice(-8) + "!";
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/users/${user.uid}/reset-password`, {
        method: 'PATCH',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ newPassword: generatedPassword })
      });

      if (response.ok) {
        setSelectedUser(user);
        setTempPassword(generatedPassword);
        setResetModalOpen(true);
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openAddModal = () => {
    const generatedPassword = Math.random().toString(36).slice(-8) + "!";
    setFormData({ name: '', email: '', role: ROLES.EXECUTIVE, password: generatedPassword, status: 'Active', backdateLimit: 0 });
    setIsAddModalOpen(true);
  };

  const openEditModal = (user: any) => {
    if (isRootCEO(user)) return alert('Cannot edit root CEO account here');
    setSelectedUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role, password: '', status: user.status, backdateLimit: user.backdate_limit || 0 });
    setIsEditModalOpen(true);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage system access, roles, and security credentials.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">User Details</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Backdate Limit</th>
                <th className="px-6 py-3 font-medium">Security</th>
                <th className="px-6 py-3 font-medium">Created Date</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {systemUsers.map((user) => (
                <tr key={user.uid} className={`hover:bg-gray-50 transition-colors ${user.is_deleted ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 flex items-center">
                      {user.name} 
                      {isRootCEO(user) && (
                        <span title="Root Account">
                          <ShieldAlert className="w-4 h-4 ml-2 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      isRootCEO(user) 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {ROLE_LABELS[user.role] || user.role}
                      {isRootCEO(user) && <span className="ml-1.5 flex items-center text-[9px] uppercase tracking-tighter text-amber-800"><Lock className="w-3 h-3 mr-0.5" /> System Locked</span>}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleToggleStatus(user)}
                      disabled={isRootCEO(user) || user.is_deleted}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        user.status === 'Active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      } ${isRootCEO(user) ? 'opacity-100 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {user.status === 'Active' ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                      {user.status}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                      <CalendarClock className="w-3 h-3 mr-1" />
                      {user.backdate_limit === -1 ? 'Unlimited' : user.backdate_limit === 0 ? 'Same Day Only' : `${user.backdate_limit} Days`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.mustChangePwd ? (
                      <span className="inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        Pending Password Change
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium text-gray-500">Secure</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    {!isRootCEO(user) && !user.is_deleted && (
                      <>
                        <button onClick={() => openEditModal(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleResetPassword(user)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Reset Password">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteRestore(user)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {!isRootCEO(user) && user.is_deleted && (
                      <button onClick={() => handleDeleteRestore(user)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Restore">
                        <RefreshCcw className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {isAddModalOpen ? 'Add New User' : 'Edit User'}
              </h3>
              <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={isAddModalOpen ? handleAddSubmit : handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  value={formData.role} 
                  onChange={(e) => setFormData({...formData, role: e.target.value as AssignableRole})} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={ROLES.CA}>{ROLE_LABELS[ROLES.CA]}</option>
                  <option value={ROLES.GENERAL_MANAGER}>{ROLE_LABELS[ROLES.GENERAL_MANAGER]}</option>
                  <option value={ROLES.STORE_KEEPER}>{ROLE_LABELS[ROLES.STORE_KEEPER]}</option>
                  <option value={ROLES.SITE_INCHARGE}>{ROLE_LABELS[ROLES.SITE_INCHARGE]}</option>
                  <option value={ROLES.SITE_ENGINEER}>{ROLE_LABELS[ROLES.SITE_ENGINEER]}</option>
                  <option value={ROLES.SALES}>{ROLE_LABELS[ROLES.SALES]}</option>
                  <option value={ROLES.EXECUTIVE}>{ROLE_LABELS[ROLES.EXECUTIVE]}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Backdate Limit</label>
                <select 
                  value={formData.backdateLimit} 
                  onChange={(e) => setFormData({...formData, backdateLimit: e.target.value})} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="0">Same Day Only (0 Days)</option>
                  <option value="1">1 Day</option>
                  <option value="3">3 Days</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  {currentUser?.role === ROLES.CEO && (
                    <option value="-1">Unlimited</option>
                  )}
                </select>
                {formData.backdateLimit == -1 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center"><ShieldAlert className="w-3 h-3 mr-1" /> High privilege: Allows backdating to any date.</p>
                )}
              </div>
              <div className="flex justify-end pt-4 space-x-3">
                <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetModalOpen && selectedUser && tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-emerald-50">
              <h3 className="text-lg font-bold text-emerald-900 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
                Password Set Successfully
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                The temporary password for <span className="font-semibold text-gray-900">{selectedUser.name}</span> has been generated.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Temporary Password</p>
                <div className="flex items-center justify-between bg-white border border-amber-200 rounded p-3">
                  <code className="text-lg font-mono font-bold text-gray-900 tracking-widest">{tempPassword}</code>
                  <button onClick={() => navigator.clipboard.writeText(tempPassword)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Copy</button>
                </div>
                <p className="text-xs text-amber-700 mt-2 flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  Please copy this now. It will not be shown again.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button onClick={() => { setResetModalOpen(false); setSelectedUser(null); setTempPassword(null); }} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
