import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingCart, 
  Truck, 
  Package, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  Plus, 
  Edit3, 
  Trash, 
  Check, 
  CornerUpLeft, 
  Send, 
  UserPlus, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle 
} from 'lucide-react';
import { API_CONFIG } from '../config';
import { createAuthHeaders } from '../services/api';
import { useAdaptivePolling } from '../hooks/useAdaptivePolling';

interface ActivityCenterSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

export function ActivityCenterSlideOver({ isOpen, onClose, onNavigate }: ActivityCenterSlideOverProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchRecentActivities = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/erp/activity-logs?limit=20`, {
        headers: createAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        setActivities(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
    }
  };

  // Poll every 30s automatically using our adaptive polling hook
  useAdaptivePolling(fetchRecentActivities, { delay: 30000 }, [isOpen]);

  if (!isOpen) return null;

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Humanize time ago
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  // Icon mapping for modules
  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'procurement':
        return <ShoppingCart className="w-5 h-5 text-blue-600" />;
      case 'grn':
        return <Truck className="w-5 h-5 text-indigo-600" />;
      case 'inventory':
        return <Package className="w-5 h-5 text-amber-600" />;
      case 'vendor_invoices':
        return <FileText className="w-5 h-5 text-emerald-600" />;
      case 'vendor_payments':
        return <CreditCard className="w-5 h-5 text-violet-600" />;
      case 'approvals':
        return <ShieldCheck className="w-5 h-5 text-teal-600" />;
      default:
        return <Package className="w-5 h-5 text-gray-500" />;
    }
  };

  // Icon mapping for actions
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">CREATE</span>;
      case 'UPDATE':
        return <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">UPDATE</span>;
      case 'DELETE':
      case 'VOID':
        return <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">VOID</span>;
      case 'APPROVE':
        return <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded text-[10px] font-bold">APPROVE</span>;
      case 'CANCEL':
        return <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-bold">REJECT</span>;
      case 'REVERT':
        return <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">RETURN</span>;
      case 'SUBMIT':
        return <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">SUBMIT</span>;
      case 'ASSIGN':
        return <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold">ASSIGN</span>;
      case 'CLOSE':
        return <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">CLOSE</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{action}</span>;
    }
  };

  const getModuleLabel = (module: string) => {
    return module.replace('_', ' ').toUpperCase();
  };

  const handleItemClick = (activity: any, e: React.MouseEvent) => {
    // If clicked expand arrow or child element, don't trigger navigation
    const target = e.target as HTMLElement;
    if (target.closest('.expand-trigger') || target.closest('.details-panel')) {
      return;
    }

    if (activity.target_url) {
      onNavigate(activity.target_url);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full border-l border-slate-100">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">ERP Activity Center</h2>
              <p className="text-xs text-slate-500 font-medium">Real-time log of business operations</p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Activities List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-2">
                <AlertTriangle className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-medium">No recent business activity logged.</p>
              </div>
            ) : (
              activities.map((act) => {
                const isExpanded = expandedId === act.id;
                const details = act.details ? JSON.parse(JSON.stringify(act.details)) : {};
                const hasChanges = details.changes && details.changes.length > 0;

                return (
                  <div 
                    key={act.id}
                    onClick={(e) => handleItemClick(act, e)}
                    className={`p-4 rounded-xl border border-slate-100 bg-white transition-all select-none ${
                      act.target_url ? 'hover:border-blue-200 hover:shadow-sm cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Module Icon Container */}
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0">
                        {getModuleIcon(act.module)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                            {getModuleLabel(act.module)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            {formatTimeAgo(act.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 mb-1">
                          {getActionBadge(act.action)}
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {details.recordNumber || `${act.entity_type} #${act.entity_id}`}
                          </span>
                        </div>

                        {/* Project / Vendor info */}
                        <div className="text-xs text-slate-500 font-medium space-y-0.5">
                          {act.project_name && (
                            <p className="truncate"><span className="text-slate-400">Project:</span> {act.project_name}</p>
                          )}
                          {details.vendorName && (
                            <p className="truncate"><span className="text-slate-400">Vendor:</span> {details.vendorName}</p>
                          )}
                          {details.amount != null && (
                            <p className="text-slate-900 font-bold mt-1">₹{Number(details.amount).toLocaleString()}</p>
                          )}
                        </div>

                        {/* Actor Snapshot */}
                        <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-700 uppercase">
                              {act.actor_name_snapshot.substring(0, 2)}
                            </div>
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                              {act.actor_name_snapshot}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            {act.actor_role_snapshot.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Expandable Changes Panel */}
                        {hasChanges && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleExpand(act.id)}
                              className="expand-trigger flex items-center text-[11px] font-bold text-blue-600 hover:text-blue-700 focus:outline-none uppercase tracking-wider"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5 mr-1" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5 mr-1" />
                                  Show Changes ({details.changes.length})
                                </>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="details-panel mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                                {details.changes.map((change: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center text-slate-600 font-medium">
                                    <span className="text-slate-400 font-bold">{change.field}:</span>
                                    <span className="flex items-center space-x-1">
                                      <span className="text-red-500 line-through">{change.oldValue || 'None'}</span>
                                      <span className="text-slate-400">→</span>
                                      <span className="text-emerald-600 font-bold">{change.newValue || 'None'}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Full History Redirect */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col space-y-2">
            <button
              onClick={() => {
                onNavigate('/activity-logs');
                onClose();
              }}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center shadow-sm"
            >
              View Full History Page
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
