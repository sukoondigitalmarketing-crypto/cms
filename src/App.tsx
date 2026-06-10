import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  Package, 
  Users, 
  Bell, 
  Search, 
  Menu,
  Building2,
  UserCog,
  KeyRound,
  ShieldAlert,
  X,
  CreditCard,
  LogOut,
  FolderKanban,
  FileText,
  Truck,
  Settings,
  BarChart3,
  ShoppingCart,
  History
} from 'lucide-react';
import { useAuth } from './components/AuthProvider';
import { API_CONFIG, ROLES, ROLE_LABELS } from './config';
import { ProjectsDashboard } from './components/ProjectsDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ApprovalsDashboard } from './components/ApprovalsDashboard';
import { SalesDashboard } from './components/SalesDashboard';
import { InventoryDashboard } from './components/InventoryDashboard';
import { UserManagement } from './components/UserManagement';
import { MasterPage } from './components/MasterPage';
import { GrnDashboard } from './components/GrnDashboard';
import { ContractorPaymentsDashboard } from './components/ContractorPaymentsDashboard';
import { CeoSecuritySettings } from './components/CeoSecuritySettings';
import { ReportsDashboard } from './components/ReportsDashboard';
import { ProcurementDashboard } from './components/procurement/ProcurementDashboard';
import { getAuthToken } from './services/api';
import { hasPermission } from './rbac';

export default function App() {
  const { user, isAuthReady, logout } = useAuth();
  const loggedInRole = user?.role ?? null;
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); 

  useEffect(() => {
    if (isAuthReady && user?.role) {
      setActiveTab('dashboard');
    }
  }, [user, isAuthReady]);

  const permissions = {
    hasPermission: (module: any, action: any) => hasPermission(loggedInRole, module, action),
    canManageUsers: hasPermission(loggedInRole, 'rbac', 'manage_users'),
    canManageMasters: hasPermission(loggedInRole, 'masters', 'edit'),
    canViewMasters: true,
    canCreateMasters: hasPermission(loggedInRole, 'masters', 'create'),
    canDeleteMasters: hasPermission(loggedInRole, 'masters', 'delete'),
    canEditMastersAdmin: hasPermission(loggedInRole, 'masters', 'edit'),
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  if (!user || !loggedInRole) {
    return <LoginScreen />;
  }

  if (user.mustChangePwd) {
    return <ForcePasswordChangeScreen />;
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col h-full flex-shrink-0 z-20 shadow-xl`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-800">
          <Building2 className="w-8 h-8 text-blue-500" />
          {sidebarOpen && <span className="ml-3 font-bold text-xl tracking-tight">BuildCore CMS</span>}
        </div>
        
        <nav className="flex-1 py-6 space-y-1.5 px-3 overflow-y-auto custom-scrollbar">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" isOpen={sidebarOpen} onClick={() => setActiveTab('dashboard')} active={activeTab === 'dashboard'} />

          {hasPermission(loggedInRole, 'rbac', 'manage_rbac') && (
            <NavItem icon={<KeyRound />} label="Security Settings" isOpen={sidebarOpen} onClick={() => setActiveTab('security')} active={activeTab === 'security'} />
          )}
          
          <NavItem icon={<Settings />} label="System Masters" isOpen={sidebarOpen} onClick={() => setActiveTab('masters')} active={activeTab === 'masters'} />
          <NavItem icon={<ShoppingCart />} label="Procurement" isOpen={sidebarOpen} onClick={() => setActiveTab('procurement')} active={activeTab === 'procurement'} />
          <NavItem icon={<Package />} label="Inventory" isOpen={sidebarOpen} onClick={() => setActiveTab('inventory')} active={activeTab === 'inventory'} />
          <NavItem icon={<Truck />} label="Goods Receipt (GRN)" isOpen={sidebarOpen} onClick={() => setActiveTab('grn')} active={activeTab === 'grn'} />
          <NavItem icon={<BarChart3 />} label="ERP Reports" isOpen={sidebarOpen} onClick={() => setActiveTab('reports')} active={activeTab === 'reports'} />
          <NavItem icon={<FolderKanban />} label="Projects" isOpen={sidebarOpen} onClick={() => setActiveTab('projects')} active={activeTab === 'projects'} />
          <NavItem icon={<FileText />} label="Approval Requests" isOpen={sidebarOpen} onClick={() => setActiveTab('approvals')} active={activeTab === 'approvals'} />
          <NavItem icon={<Users />} label="Customer & Ledger" isOpen={sidebarOpen} onClick={() => setActiveTab('sales')} active={activeTab === 'sales'} />
          <NavItem icon={<CreditCard />} label="Contractor Payments" isOpen={sidebarOpen} onClick={() => setActiveTab('contractor-payments')} active={activeTab === 'contractor-payments'} />
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
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
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
        <div className={`flex-1 overflow-y-auto custom-scrollbar ${activeTab === 'masters' ? '' : 'p-6'}`}>
          {activeTab === 'security' && hasPermission(loggedInRole, 'rbac', 'manage_rbac') ? (
            <CeoSecuritySettings />
          ) : activeTab === 'masters' ? (
            <MasterPage userRole={loggedInRole} permissions={permissions} />
          ) : activeTab === 'sales' ? (
            <SalesDashboard role={loggedInRole} />
          ) : activeTab === 'projects' ? (
            <ProjectsDashboard role={loggedInRole} />
          ) : activeTab === 'approvals' ? (
            <ApprovalsDashboard role={loggedInRole} userName={user?.name || ''} userUid={user?.uid || ''} />
          ) : activeTab === 'inventory' ? (
            <InventoryDashboard role={loggedInRole} />
          ) : activeTab === 'grn' ? (
            <GrnDashboard role={loggedInRole} userName={user?.name || ''} />
          ) : activeTab === 'contractor-payments' ? (
            <ContractorPaymentsDashboard role={loggedInRole} />
          ) : activeTab === 'reports' ? (
            <ReportsDashboard />
          ) : activeTab === 'procurement' ? (
            <ProcurementDashboard role={loggedInRole} />
          ) : (
            <AdminDashboard />
          )}

        </div>
      </main>
    </div>
  );
}

// Login Screen Component
function LoginScreen() {
  const { login } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'CEO' | 'STAFF'>('CEO');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Staff Portal States
  const [publicRoles, setPublicRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}/auth/public-roles`)
      .then(res => res.json())
      .then(data => {
        setPublicRoles(data);
      })
      .catch(err => console.error("Failed to fetch public roles", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      if (loginMethod === 'CEO') {
        if (!email) throw new Error('Email is required for CEO login');
        await login(email, password, undefined, undefined, rememberMe);
      } else {
        if (!selectedRole) throw new Error('Please select a Role');
        await login('', password, undefined, selectedRole, rememberMe);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const isAdminTheme = loginMethod === 'CEO';

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isAdminTheme ? 'bg-slate-50' : 'bg-indigo-50'} flex flex-col justify-center py-12 sm:px-6 lg:px-8`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className={`w-20 h-20 transition-all duration-500 rounded-3xl flex items-center justify-center shadow-xl transform hover:rotate-6 ${isAdminTheme ? 'bg-blue-600' : 'bg-indigo-600'}`}>
            <Building2 className="w-12 h-12 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          BuildCore CMS
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Integrated Project & Inventory Management
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white shadow-2xl sm:rounded-2xl border border-white overflow-hidden">
          {/* Tab Selection */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 p-1">
            <button
              onClick={() => setLoginMethod('CEO')}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                isAdminTheme 
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              <KeyRound className={`w-4 h-4 mr-2 ${isAdminTheme ? 'text-blue-500' : ''}`} />
              👑 CEO Access
            </button>
            <button
              onClick={() => setLoginMethod('STAFF')}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                !isAdminTheme 
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              <Users className={`w-4 h-4 mr-2 ${!isAdminTheme ? 'text-indigo-500' : ''}`} />
              🛠️ Staff Portal
            </button>
          </div>

          <div className="py-8 px-4 sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {isAdminTheme ? (
                /* CEO LOGIN FIELDS */
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ceo@company.com"
                      className="block w-full px-4 py-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                    />
                  </div>
                </div>
              ) : (
                /* STAFF LOGIN FIELDS */
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Work Role</label>
                    <select
                      required
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="block w-full px-4 py-3 bg-indigo-50 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm appearance-none"
                    >
                      <option value="">Select your role...</option>
                      {publicRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Security Password</label>
                  <button 
                    type="button" 
                    onClick={() => setForgotPasswordModalOpen(true)}
                    className={`text-xs font-bold hover:underline ${isAdminTheme ? 'text-blue-600' : 'text-indigo-600'}`}
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`block w-full px-4 py-3 border-0 rounded-xl focus:ring-2 transition-all text-sm ${isAdminTheme ? 'bg-slate-50 focus:ring-blue-500' : 'bg-indigo-50 focus:ring-indigo-500'}`}
                />
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={`h-5 w-5 rounded-md border-0 focus:ring-offset-0 transition-colors ${isAdminTheme ? 'text-blue-600 bg-slate-100' : 'text-indigo-600 bg-indigo-100'}`}
                />
                <label htmlFor="remember-me" className="ml-3 block text-sm font-semibold text-slate-600 cursor-pointer">
                  Maintain session
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center items-center py-4 px-4 rounded-xl shadow-lg text-sm font-black text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                  isLoading 
                    ? 'bg-slate-300 cursor-wait' 
                    : isAdminTheme 
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {isAdminTheme ? 'AUTHORIZE CEO ACCESS' : 'START STAFF SESSION'}
                  </>
                )}
              </button>
              
              {error && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 animate-bounce">
                  <p className="text-xs font-bold text-red-600 text-center uppercase tracking-tight">{error}</p>
                </div>
              )}
            </form>
          </div>
        </div>

        <p className="mt-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
          BuildCore Production v2.0 • Secure Environment
        </p>
      </div>

      {forgotPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-white transform animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
              <ShieldAlert className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Security Protocol</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">
              For security reasons, password resets must be initiated by the **Super Admin (CEO)**. 
              Please contact the administration office to verify your identity and receive a temporary security token.
            </p>
            <button 
              onClick={() => setForgotPasswordModalOpen(false)}
              className="w-full py-4 bg-slate-100 text-slate-900 text-sm font-black rounded-2xl hover:bg-slate-200 transition-colors"
            >
              UNDERSTOOD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ForcePasswordChangeScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      // Reload window to fetch fresh user state and clear mustChangePwd flag
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldAlert className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Action Required
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          You must change your temporary password before continuing.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center bg-red-50 py-2 rounded">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
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
