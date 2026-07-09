import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  X, 
  Calendar, 
  Building2, 
  User, 
  ChevronDown, 
  ChevronUp, 
  ShoppingCart, 
  Truck, 
  Package, 
  FileText, 
  CreditCard, 
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { API_CONFIG } from '../config';
import { createAuthHeaders } from '../services/api';
import { useAdaptivePolling } from '../hooks/useAdaptivePolling';

interface ActivityLogsPageProps {
  onNavigate: (url: string) => void;
}

export function ActivityLogsPage({ onNavigate }: ActivityLogsPageProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  // Master lists for filters
  const [projects, setProjects] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 25;

  // Filter state
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    project_id: '',
    vendor_id: '',
    from_date: '',
    to_date: '',
    search: ''
  });

  // Fetch Master Data
  useEffect(() => {
    const fetchMasters = async () => {
      const headers = createAuthHeaders();
      try {
        const [projRes, vendRes] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}/master/projects`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/master/vendors`, { headers })
        ]);
        if (projRes.ok) setProjects(await projRes.json());
        if (vendRes.ok) setVendors(await vendRes.json());
      } catch (e) {
        console.error('Failed to load masters for activity filter', e);
      }
    };
    fetchMasters();
  }, []);

  // Fetch Logs
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit),
        module: filters.module,
        action: filters.action,
        project_id: filters.project_id,
        vendor_id: filters.vendor_id,
        from_date: filters.from_date,
        to_date: filters.to_date
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/erp/activity-logs?${queryParams}`, {
        headers: createAuthHeaders()
      });

      if (response.ok) {
        const result = await response.json();
        let logs = result.data || [];
        
        // Client-side search filtering on record number, remarks or actor name
        if (filters.search.trim()) {
          const searchLower = filters.search.toLowerCase();
          logs = logs.filter((act: any) => {
            const details = act.details ? JSON.parse(JSON.stringify(act.details)) : {};
            return (
              (details.recordNumber && details.recordNumber.toLowerCase().includes(searchLower)) ||
              (details.remarks && details.remarks.toLowerCase().includes(searchLower)) ||
              act.actor_name_snapshot.toLowerCase().includes(searchLower) ||
              act.entity_type.toLowerCase().includes(searchLower)
            );
          });
        }

        setActivities(logs);
        setTotalPages(result.pagination?.totalPages || 1);
        setTotalRecords(result.pagination?.total || 0);
      }
    } catch (e) {
      console.error('Failed to fetch activity logs', e);
    } finally {
      setLoading(false);
    }
  };

  // Run fetching adaptively (updates when tab visibility focuses or user mutations happen)
  useAdaptivePolling(fetchLogs, { delay: 30000 }, [currentPage, filters.module, filters.action, filters.project_id, filters.vendor_id, filters.from_date, filters.to_date, filters.search]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Reset page on filter change
  };

  const clearFilters = () => {
    setFilters({
      module: '',
      action: '',
      project_id: '',
      vendor_id: '',
      from_date: '',
      to_date: '',
      search: ''
    });
    setCurrentPage(1);
  };

  // Icon mapping for modules
  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'procurement':
        return <ShoppingCart className="w-4 h-4 text-blue-600" />;
      case 'grn':
        return <Truck className="w-4 h-4 text-indigo-600" />;
      case 'inventory':
        return <Package className="w-4 h-4 text-amber-600" />;
      case 'vendor_invoices':
        return <FileText className="w-4 h-4 text-emerald-600" />;
      case 'vendor_payments':
        return <CreditCard className="w-4 h-4 text-violet-600" />;
      case 'approvals':
        return <ShieldCheck className="w-4 h-4 text-teal-600" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  // Action styling mapping
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-100">CREATE</span>;
      case 'UPDATE':
        return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold border border-blue-100">UPDATE</span>;
      case 'DELETE':
      case 'VOID':
        return <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[11px] font-bold border border-red-100">VOID</span>;
      case 'APPROVE':
        return <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-[11px] font-bold border border-teal-100">APPROVE</span>;
      case 'CANCEL':
        return <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[11px] font-bold border border-orange-100">REJECT</span>;
      case 'REVERT':
        return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px] font-bold border border-amber-100">RETURN</span>;
      case 'SUBMIT':
        return <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-bold border border-indigo-100">SUBMIT</span>;
      case 'ASSIGN':
        return <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px] font-bold border border-purple-100">ASSIGN</span>;
      case 'CLOSE':
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200">CLOSE</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-bold border border-gray-200">{action}</span>;
    }
  };

  const handleRowClick = (activity: any, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.expand-trigger') || target.closest('.details-panel')) {
      return;
    }

    if (activity.target_url) {
      onNavigate(activity.target_url);
    }
  };

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
            <History className="w-8 h-8 mr-3 text-blue-600" />
            BUSINESS ACTIVITY LOGS
          </h1>
          <p className="text-slate-500 font-medium mt-1">Complete, tamper-proof history of ERP operational activities</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center text-xs font-black bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-3.5 py-2 rounded-xl transition-colors shadow-sm uppercase tracking-wider"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Dynamic Search & Filters Dashboard */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 tracking-tight text-sm">Filter Activity History</h3>
          </div>
          <button 
            onClick={clearFilters}
            className="flex items-center text-xs font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Keyword Search */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Keywords</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Search code, remarks, user..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium outline-none"
              />
            </div>
          </div>

          {/* Module Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Module</label>
            <select
              name="module"
              value={filters.module}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium outline-none appearance-none"
            >
              <option value="">All Modules</option>
              <option value="procurement">Procurement</option>
              <option value="grn">Goods Receipts (GRN)</option>
              <option value="vendor_invoices">Vendor Invoices</option>
              <option value="vendor_payments">Vendor Payments</option>
              <option value="approvals">Approvals</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Action Type</label>
            <select
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium outline-none appearance-none"
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="VOID">VOID / DELETE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="CANCEL">REJECT</option>
              <option value="REVERT">RETURN</option>
              <option value="SUBMIT">SUBMIT</option>
              <option value="ASSIGN">ASSIGN</option>
              <option value="CLOSE">CLOSE</option>
            </select>
          </div>

          {/* Project Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                name="project_id"
                value={filters.project_id}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium outline-none appearance-none"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Vendor Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                name="vendor_id"
                value={filters.vendor_id}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium outline-none appearance-none"
              >
                <option value="">All Vendors</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
              </select>
            </div>
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                name="from_date"
                value={filters.from_date}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium outline-none"
              />
            </div>
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                name="to_date"
                value={filters.to_date}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 w-12">Module</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4 w-10">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && activities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                    No matching activity logs found.
                  </td>
                </tr>
              ) : (
                activities.map(act => {
                  const isExpanded = expandedId === act.id;
                  const details = act.details ? JSON.parse(JSON.stringify(act.details)) : {};
                  const hasChanges = details.changes && details.changes.length > 0;

                  return (
                    <React.Fragment key={act.id}>
                      <tr 
                        onClick={(e) => handleRowClick(act, e)}
                        className={`hover:bg-slate-50/30 transition-all ${
                          act.target_url ? 'cursor-pointer' : ''
                        }`}
                      >
                        {/* Module Icon */}
                        <td className="px-6 py-4">
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 w-fit" title={act.module}>
                            {getModuleIcon(act.module)}
                          </div>
                        </td>

                        {/* Action badge */}
                        <td className="px-6 py-4">
                          {getActionBadge(act.action)}
                        </td>

                        {/* Document Code / Target URL link */}
                        <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                          <div>
                            {details.recordNumber || `${act.entity_type} #${act.entity_id}`}
                            {details.remarks && (
                              <p className="text-xs text-slate-400 font-medium normal-case mt-0.5 font-sans">
                                {details.remarks}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Project */}
                        <td className="px-6 py-4 text-xs font-bold text-slate-700 truncate max-w-[150px]">
                          {act.project_name || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Vendor */}
                        <td className="px-6 py-4 text-xs font-bold text-slate-700 truncate max-w-[150px]">
                          {act.vendor_name || details.vendorName || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Actor name + role */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{act.actor_name_snapshot}</span>
                            <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mt-0.5">
                              {act.actor_role_snapshot.replace('_', ' ')}
                            </span>
                          </div>
                        </td>

                        {/* Date Timestamp */}
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                          {new Date(act.created_at).toLocaleString()}
                        </td>

                        {/* Expandable triggers */}
                        <td className="px-6 py-4 text-center">
                          {hasChanges ? (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : act.id)}
                              className="expand-trigger p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-all focus:outline-none"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded panel row */}
                      {isExpanded && hasChanges && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="px-8 py-4 border-l-4 border-blue-500">
                            <div className="details-panel grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-2">
                              {details.changes.map((change: any, idx: number) => (
                                <div key={idx} className="p-3 bg-white border border-slate-100 rounded-xl space-y-1.5 shadow-sm">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {change.field}
                                  </p>
                                  <div className="flex items-center space-x-2 text-xs font-bold">
                                    <span className="text-red-500 line-through truncate max-w-[80px]">
                                      {change.oldValue || 'None'}
                                    </span>
                                    <span className="text-slate-300">→</span>
                                    <span className="text-emerald-600 truncate max-w-[80px]">
                                      {change.newValue || 'None'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <span className="text-xs text-slate-500 font-bold">
              Showing page {currentPage} of {totalPages} ({totalRecords} total logs)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
