import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  Package, 
  Users, 
  Settings, 
  Bell, 
  Search, 
  Menu,
  TrendingUp,
  Building2,
  UserPlus,
  FileText,
  CreditCard,
  CheckCircle2,
  Clock,
  UserCog,
  KeyRound,
  ShieldAlert,
  X,
  Lock,
  LogOut,
  FolderKanban,
  Plus,
  MapPin,
  Calendar,
  IndianRupee,
  Trash2,
  Edit,
  ArrowDownRight
} from 'lucide-react';
import { useAuth } from './components/AuthProvider';
import { API_CONFIG, ROLES, ROLE_LABELS } from './config';
import { usePermissions } from './hooks/usePermissions';

export default function App() {
  const { user, isAuthReady, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const [loggedInRole, setLoggedInRole] = useState<string | null>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  
  // Password Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthReady && user) {
      setLoggedInRole(user.role);
      if (user.role === ROLES.CEO) setActiveTab('dashboard');
      else if (user.role === ROLES.GENERAL_MANAGER) setActiveTab('dashboard');
      else if (user.role === ROLES.SALES) setActiveTab('sales');
      else if (user.role === ROLES.SITE_INCHARGE) setActiveTab('inventory');
      else if (user.role === ROLES.EXECUTIVE) setActiveTab('approvals');
    } else {
      setLoggedInRole(null);
    }
  }, [user, isAuthReady]);

  useEffect(() => {
    if (activeTab === 'users' && loggedInRole === ROLES.CEO) {
      fetchUsers();
      const interval = setInterval(fetchUsers, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loggedInRole]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/users`);
      if (response.ok) {
        const users = await response.json();
        setSystemUsers(users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleResetPassword = async (user: any) => {
    const generatedPassword = Math.random().toString(36).slice(-8) + "!";
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/users/${user.uid}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: generatedPassword })
      });

      if (response.ok) {
        setSelectedUser(user);
        setTempPassword(generatedPassword);
        setResetModalOpen(true);
      } else {
        alert('Failed to reset password');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      alert('Failed to reset password');
    }
  };

  const closeResetModal = () => {
    setResetModalOpen(false);
    setSelectedUser(null);
    setTempPassword(null);
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  if (!user || !loggedInRole) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-800">
          <Building2 className="w-8 h-8 text-blue-500" />
          {sidebarOpen && <span className="ml-3 font-bold text-xl tracking-tight">BuildCore CMS</span>}
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-3">
          {hasPermission('dashboard', 'view') && (
            <NavItem icon={<LayoutDashboard />} label="Admin Dashboard" isOpen={sidebarOpen} onClick={() => setActiveTab('dashboard')} active={activeTab === 'dashboard'} />
          )}

          {hasPermission('rbac', 'view') && (
            <NavItem icon={<UserCog />} label="User Management" isOpen={sidebarOpen} onClick={() => setActiveTab('users')} active={activeTab === 'users'} />
          )}
          
          {hasPermission('customers', 'view') && (
            <NavItem icon={<Users />} label="Customer & Ledger" isOpen={sidebarOpen} onClick={() => setActiveTab('sales')} active={activeTab === 'sales'} />
          )}

          {hasPermission('projects', 'view') && (
            <NavItem icon={<FolderKanban />} label="Projects" isOpen={sidebarOpen} onClick={() => setActiveTab('projects')} active={activeTab === 'projects'} />
          )}

          {hasPermission('approvals', 'view') && (
            <NavItem icon={<FileText />} label="Approval Requests" isOpen={sidebarOpen} onClick={() => setActiveTab('approvals')} active={activeTab === 'approvals'} />
          )}

          {hasPermission('inventory', 'view') && (
            <NavItem icon={<Package />} label="Inventory" isOpen={sidebarOpen} onClick={() => setActiveTab('inventory')} active={activeTab === 'inventory'} />
          )}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
                {loggedInRole.substring(0, 2).toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="ml-3">
                  <p className="text-sm font-medium truncate w-24">{ROLE_LABELS[loggedInRole as keyof typeof ROLE_LABELS] || loggedInRole}</p>
                  <p className="text-xs text-slate-400">Active Session</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700">
              <Menu className="w-6 h-6" />
            </button>
            <div className="ml-6 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none w-64 transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-6">
          
          {activeTab === 'users' && hasPermission('rbac', 'view') ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                  <p className="text-gray-500 text-sm mt-1">Manage system access, roles, and security credentials.</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">System Users</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-3 font-medium">User</th>
                        <th className="px-6 py-3 font-medium">Role</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Security</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {systemUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {user.status === 'Active' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-emerald-700">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-gray-500">
                                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span> Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {user.mustChangePwd ? (
                              <span className="inline-flex items-center text-xs font-medium text-amber-600">
                                <ShieldAlert className="w-4 h-4 mr-1" /> Pending Password Change
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs font-medium text-gray-500">
                                Secure
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleResetPassword(user)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <KeyRound className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                              Reset Password
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : activeTab === 'sales' && hasPermission('customers', 'view') ? (
            <SalesDashboard role={loggedInRole} />
          ) : activeTab === 'projects' && hasPermission('projects', 'view') ? (
            <ProjectsDashboard role={loggedInRole} />
          ) : activeTab === 'approvals' && hasPermission('approvals', 'view') ? (
            <ApprovalsDashboard role={loggedInRole} userName={user?.name || ''} userUid={user?.uid || ''} />
          ) : activeTab === 'inventory' && hasPermission('inventory', 'view') ? (
            <InventoryDashboard role={loggedInRole} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Building2 className="w-16 h-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">Dashboard Portal</h2>
              <p className="mt-2 text-center max-w-md">Welcome to the {ROLE_LABELS[loggedInRole as keyof typeof ROLE_LABELS] || loggedInRole} portal.</p>
            </div>
          )}

        </div>

        {/* Password Reset Modal */}
        {resetModalOpen && selectedUser && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <KeyRound className="w-5 h-5 mr-2 text-blue-600" />
                  Password Reset Successful
                </h3>
                <button onClick={closeResetModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    You have successfully reset the password for <span className="font-semibold text-gray-900">{selectedUser.name}</span> ({selectedUser.email}).
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    They will be forced to change this password upon their next login.
                  </p>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Temporary Password</p>
                  <div className="flex items-center justify-between bg-white border border-amber-200 rounded p-3">
                    <code className="text-lg font-mono font-bold text-gray-900 tracking-widest">{tempPassword}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(tempPassword || '')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 mt-2 flex items-center">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                    This password will only be shown once. Please copy it now.
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button 
                  onClick={closeResetModal}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// Login Screen Component
function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CEO');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const mappedEmail = `${role.toLowerCase().replace(' ', '')}@buildcore.com`;
    
    try {
      await login(mappedEmail, password, role, role);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          BuildCore CMS
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Role-Based Access Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Select Role</label>
              <div className="mt-1">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value={ROLES.CEO}>{ROLE_LABELS[ROLES.CEO]}</option>
                  <option value={ROLES.GENERAL_MANAGER}>{ROLE_LABELS[ROLES.GENERAL_MANAGER]}</option>
                  <option value={ROLES.SALES}>{ROLE_LABELS[ROLES.SALES]}</option>
                  <option value={ROLES.SITE_INCHARGE}>{ROLE_LABELS[ROLES.SITE_INCHARGE]}</option>
                  <option value={ROLES.EXECUTIVE}>{ROLE_LABELS[ROLES.EXECUTIVE]}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password for this role"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                First time logging in with a role will set its password.
              </p>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Sign In
              </button>
            </div>
            
            {error && <p className="mt-2 text-sm text-red-600 text-center bg-red-50 py-2 rounded">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, isOpen, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
    >
      <div className="flex-shrink-0">{icon}</div>
      {isOpen && <span className="ml-3 font-medium text-sm">{label}</span>}
    </button>
  );
}

function KpiCard({ title, value, icon }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
      <div className="p-4 bg-gray-50 rounded-full mr-4 border border-gray-100">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
      </div>
    </div>
  );
}
