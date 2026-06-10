import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  FileText, 
  History, 
  Plus, 
  Search, 
  ChevronRight,
  Edit3,
  Download,
  MessageCircle
} from 'lucide-react';
import { API_CONFIG, ROLE_PERMISSIONS } from '../../config';
import { getAuthToken } from '../../services/api';
import { canApprove, hasPermission } from '../../rbac';
import { PurchaseRequestForm } from './PurchaseRequestForm';
import { PurchaseOrderForm } from './PurchaseOrderForm';
import { ProcurementAuditDashboard } from './ProcurementAuditDashboard';

interface ProcurementDashboardProps {
  role: string;
}

export function ProcurementDashboard({ role }: ProcurementDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'pr' | 'po' | 'audit'>('pr');
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [revisionMode, setRevisionMode] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const permissions = {
    ...((ROLE_PERMISSIONS as any)[role] || {}),
    canRaisePR: hasPermission(role, 'procurement', 'create'),
    canCreatePO: hasPermission(role, 'procurement', 'create'),
    canApprovePR: canApprove(role, 'procurement'),
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const endpoint = activeSubTab === 'audit' ? '/procurement/audit' : `/procurement/${activeSubTab}`;
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error(`Error fetching ${activeSubTab}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const handleAction = async (id: number, action: string) => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/procurement/pr/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ action, remarks: `Actioned by ${role}` })
      });
      if (!response.ok) throw new Error('Action failed');
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Action failed');
    }
  };

  const handleSubmitPR = async (id: number) => {
    if (!window.confirm('Submit this PR for approval?')) return;
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/procurement/pr/${id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error('Submission failed');
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Submission failed');
    }
  };

  const handleDownloadPO = async (po: any) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/procurement/po/${po.id}/pdf`, {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (!response.ok) {
      alert('Unable to generate PO PDF');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PO-${po.po_number}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSharePO = async (po: any) => {
    try {
      // Fetch full PO details with items and unit information
      const response = await fetch(`${API_CONFIG.BASE_URL}/procurement/po/${po.id}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error('Failed to fetch PO details');
      
      const fullPo = await response.json();
      
      // Build the WhatsApp message according to vendor-facing format
      const projectName = fullPo.project_name || 'General Inventory';
      let message = `Project: ${projectName}\n\n`;
      message += `PO Number: ${fullPo.po_number}\n\n`;
      message += `Required Materials:\n\n`;

      if (fullPo.items && fullPo.items.length > 0) {
        fullPo.items.forEach((item: any) => {
          const unit = item.unit || 'Nos';
          // Preserve stored order and include item name, quantity and unit
          message += `• ${item.item_name} - ${item.quantity} ${unit}\n`;
        });
      }

      message += `\nKindly confirm availability and delivery schedule.`;

      const text = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to share PO on WhatsApp');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'FULFILLED':
      case 'CONVERTED_TO_PO':
      case 'PO_CREATED':
      case 'CLOSED':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'PENDING_APPROVAL':
      case 'PENDING_GM':
      case 'PENDING_CA':
      case 'PENDING_CEO':
      case 'OPEN':
      case 'PARTIAL':
      case 'DRAFT':
      case 'VENDOR_ASSIGNED':
      case 'SENT_TO_VENDOR':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'RETURNED':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <ShoppingCart className="w-8 h-8 mr-3 text-blue-600" />
            Procurement Governance
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage governed procurement lifecycles and commercial authorizations.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {activeSubTab === 'pr' && permissions.canRaisePR && (
            <button 
              onClick={() => { setSelectedItem(null); setRevisionMode(false); setShowForm(true); }}
              className="flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              RAISE PURCHASE REQUEST
            </button>
          )}
          {activeSubTab === 'po' && permissions.canCreatePO && (
            <button 
              onClick={() => { setSelectedItem(null); setRevisionMode(false); setShowForm(true); }}
              className="flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              CREATE PURCHASE ORDER
            </button>
          )}
        </div>
      </div>

      {/* Tabs Section */}
      <div className="flex border-b border-slate-200">
        <TabButton 
          active={activeSubTab === 'pr'} 
          onClick={() => setActiveSubTab('pr')} 
          icon={<FileText className="w-4 h-4" />} 
          label="Purchase Requests" 
        />
        <TabButton 
          active={activeSubTab === 'po'} 
          onClick={() => setActiveSubTab('po')} 
          icon={<ShoppingCart className="w-4 h-4" />} 
          label="Purchase Orders" 
        />
        {permissions.canApprovePR && (
          <TabButton 
            active={activeSubTab === 'audit'} 
            onClick={() => setActiveSubTab('audit')} 
            icon={<History className="w-4 h-4" />} 
            label="Audit Trail" 
          />
        )}
      </div>

      {/* Search Bar */}
      {activeSubTab !== 'audit' && (
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={`Search ${activeSubTab.toUpperCase()}...`} 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Governance Data...</p>
          </div>
        ) : activeSubTab === 'audit' ? (
          <ProcurementAuditDashboard data={data} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Number</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Project / Party</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">{activeSubTab === 'pr' ? 'Intent' : 'Governance'}</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status / Progress</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.filter(item => 
                  (item.pr_number || item.po_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (item.project_name || "").toLowerCase().includes(searchQuery.toLowerCase())
                ).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          {activeSubTab.toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-black text-slate-900">{item.pr_number || item.po_number}</p>
                          <p className="text-xs text-slate-400 font-medium">
                            {new Date(item.createdAt).toLocaleDateString()} 
                            {item.version > 1 && <span className="ml-2 px-1.5 py-0.5 bg-slate-900 text-white rounded text-[8px]">REV {item.version}</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">
                        {item.procurement_type === 'GENERAL_STOCK' ? 'General Inventory Procurement' : item.project_name}
                      </p>
                      <p className="text-xs text-slate-400">{item.vendor_name || item.contractor_name || item.requested_by || "General"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        {activeSubTab === 'pr' ? 'Requirement only' : 'Tentative only'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(item.status || item.po_status)}`}>
                          {item.status || item.po_status}
                        </span>
                        {activeSubTab === 'po' && item.fulfillment_progress !== undefined && (
                          <div className="w-32">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Fulfillment</span>
                              <span className="text-[9px] font-black text-slate-900">{Math.round(item.fulfillment_progress)}%</span>
                            </div>
                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${item.fulfillment_progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                style={{ width: `${Math.min(100, item.fulfillment_progress)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeSubTab === 'po' && item.po_status === 'DRAFT' && (permissions.canCreatePO || permissions.canApprovePR) && (
                          <button 
                            onClick={() => { setSelectedItem(item); setRevisionMode(false); setShowForm(true); }}
                            className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest"
                          >
                            <Edit3 className="w-3 h-3 mr-1.5" />
                            Edit Draft
                          </button>
                        )}
                        {activeSubTab === 'po' && item.po_status !== 'DRAFT' && item.po_status !== 'CANCELLED' && permissions.canCreatePO && (
                          <button 
                            onClick={() => { setSelectedItem(item); setRevisionMode(true); setShowForm(true); }}
                            className="flex items-center px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black hover:bg-amber-600 hover:text-white transition-all uppercase tracking-widest"
                          >
                            <Edit3 className="w-3 h-3 mr-1.5" />
                            Revise
                          </button>
                        )}
                        {activeSubTab === 'pr' && ['PENDING_APPROVAL', 'PENDING_GM', 'PENDING_CA', 'PENDING_CEO'].includes(item.status) && permissions.canApprovePR && (
                          <div className="flex gap-1">
                            <button onClick={() => handleAction(item.id, 'approve')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-wider">Approve</button>
                            <button onClick={() => handleAction(item.id, 'reject')} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black hover:bg-rose-600 hover:text-white transition-all uppercase tracking-wider">Reject</button>
                            <button onClick={() => handleAction(item.id, 'return')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-wider">Return</button>
                          </div>
                        )}
                        {activeSubTab === 'po' && (
                          <>
                            <button
                              onClick={() => handleDownloadPO(item)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Download PO PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSharePO(item)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Share PO on WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => { setSelectedItem(item); setRevisionMode(false); setShowForm(true); }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && activeSubTab === 'pr' && (
        <PurchaseRequestForm 
          onClose={() => { setShowForm(false); fetchData(); }} 
          initialData={selectedItem}
        />
      )}
      {showForm && activeSubTab === 'po' && (
        <PurchaseOrderForm 
          onClose={() => { setShowForm(false); fetchData(); }} 
          initialData={selectedItem}
          mode={selectedItem ? (revisionMode ? 'REVISE' : (selectedItem.po_status === 'DRAFT' ? 'EDIT' : 'VIEW')) : 'CREATE'}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center px-6 py-4 text-sm font-bold border-b-2 transition-all ${
        active 
          ? 'border-blue-600 text-blue-600 bg-blue-50/30' 
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );
}
