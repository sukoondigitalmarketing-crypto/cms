import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { API_CONFIG, ROLE_PERMISSIONS } from '../config';
import { validateApprovalForm } from '../services/validation';
import { createAuthHeaders } from '../services/api';
import { canApprove as canApproveModule, canDelete, hasPermission } from '../rbac';
import { useAdaptivePolling } from '../hooks/useAdaptivePolling';

interface ApprovalsDashboardProps {
  role: string;
  userName: string;
  userUid: string;
}

type ApprovalTab = 'ACTIVE' | 'VOIDED';

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {label}
      <span
        className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
          active ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export function ApprovalsDashboard({ role, userName, userUid }: ApprovalsDashboardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ApprovalTab>('ACTIVE');

  const [title, setTitle] = useState('');
  const [type, setType] = useState('Vendor Payment');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState('');

  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [filterProjectId, setFilterProjectId] = useState('ALL');
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddMobile, setQuickAddMobile] = useState('');

  const permissions = ROLE_PERMISSIONS[role] || {};
  const canRaiseApproval = hasPermission(role, 'approvals', 'create');
  const canApprove = canApproveModule(role, 'approvals');
  const canVoidApproval = canDelete(role, 'approvals');
  const canManageApprovals = canApprove || canVoidApproval;
  const canViewApprovals = hasPermission(role, 'approvals', 'view');

  useAdaptivePolling(() => {
    fetchProjects();
    fetchApprovals();
    fetchContractors();
  }, { delay: 30000 }, [role, userUid]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
        headers: createAuthHeaders(),
      });
      if (res.ok) {
        const projs = await res.json();
        const sorted = projs.sort((a: any, b: any) => {
          if (a.status === 'ONGOING' && b.status !== 'ONGOING') return -1;
          if (a.status !== 'ONGOING' && b.status === 'ONGOING') return 1;
          return 0;
        });
        setProjects(sorted);
      }
    } catch (err) {
      console.error('Projects Fetch Error:', err);
    }
  };

  const fetchContractors = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/master/contractors`, {
        headers: createAuthHeaders(),
      });
      if (res.ok) {
        const cons = await res.json();
        setContractors(cons.filter((c: any) => c.status === 'ACTIVE'));
      }
    } catch (err) {
      console.error('Contractors Fetch Error:', err);
    }
  };

  const fetchApprovals = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/approvals`, {
        headers: createAuthHeaders(),
      });
      if (res.ok) {
        const apps = await res.json();
        setApprovals(apps);
      }
    } catch (err) {
      console.error('Approvals Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const processedApprovals = useMemo(() => {
    return approvals.map((approval) => {
      let parsed = {
        desc: approval.description,
        projectId: approval.projectId,
        projectName: approval.projectName,
        vendorName: approval.vendorName,
        originalType: approval.type,
      };

      try {
        const data = JSON.parse(approval.description);
        if (data && data.desc !== undefined) {
          parsed = { ...parsed, ...data };
        }
      } catch (_error) {}

      return { ...approval, parsed };
    });
  }, [approvals]);

  const scopedApprovals = useMemo(() => {
    if (canApprove || canManageApprovals || canViewApprovals) return processedApprovals;
    if (canRaiseApproval) {
      return processedApprovals.filter((a) => a.raised_by_uid === userUid);
    }
    return processedApprovals;
  }, [processedApprovals, canApprove, canRaiseApproval, permissions, role, userUid]);

  const activeApprovals = useMemo(() => {
    let items = scopedApprovals.filter((a) => a.status !== 'VOIDED');

    if (filterProjectId !== 'ALL') {
      items = items.filter((a) => String(a.projectId) === filterProjectId);
    }

    return items;
  }, [scopedApprovals, role, filterProjectId]);

  const voidedApprovals = useMemo(() => {
    let items = scopedApprovals.filter((a) => a.status === 'VOIDED');

    if (filterProjectId !== 'ALL') {
      items = items.filter((a) => String(a.projectId) === filterProjectId);
    }

    return items;
  }, [scopedApprovals, filterProjectId]);

  const displayApprovals = activeTab === 'ACTIVE' ? activeApprovals : voidedApprovals;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const validation = validateApprovalForm({
      title,
      type,
      projectId: selectedProjectId,
      amount,
      description,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    try {
      if (!selectedProjectName) {
        const proj = projects.find((p) => String(p.id) === selectedProjectId);
        if (!proj) {
          setValidationErrors(['Selected project not found. Please refresh and try again.']);
          return;
        }
        setSelectedProjectName(proj.name);
      }

      const encodedDesc = JSON.stringify({
        desc: description,
        projectId: selectedProjectId,
        projectName: selectedProjectName || projects.find((p) => String(p.id) === selectedProjectId)?.name,
        vendorName: vendorName || '',
        attachments: attachments || '',
        originalType: type,
      });

      const safeType = type === 'Vendor Payment' ? 'Expense' : type;

      const response = await fetch(`${API_CONFIG.BASE_URL}/approvals`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          approval_code: `APP-${Date.now()}`,
          title: title.trim(),
          type: safeType,
          amount: Number(amount),
          description: encodedDesc,
          raised_by: userName,
          raised_by_uid: userUid,
          raised_by_role: role,
          projectId: selectedProjectId,
          projectName: selectedProjectName || projects.find((p) => String(p.id) === selectedProjectId)?.name,
          vendorName: vendorName || '',
          contractor_id: type === 'Contractor Payment' ? selectedContractorId : null,
          attachments: attachments || '',
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setTitle('');
        setAmount('');
        setDescription('');
        setSelectedProjectId('');
        setSelectedProjectName('');
        setVendorName('');
        setSelectedContractorId('');
        setAttachments('');
        setValidationErrors([]);
        fetchApprovals();
        alert('Approval request submitted successfully!');
      } else {
        const error = await response.json();
        setValidationErrors([error.error || 'Failed to submit approval request']);
      }
    } catch (_error) {
      setValidationErrors(['Failed to submit approval request. Please try again.']);
    }
  };

  const handleQuickAddContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/contractors`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          contractor_name: quickAddName,
          mobile_number: quickAddMobile,
          contractor_type: 'General',
          source: 'QUICK_ADD',
          verification_status: 'UNVERIFIED'
        })
      });
      if (response.ok) {
        const data = await response.json();
        await fetchContractors();
        setSelectedContractorId(data.id.toString());
        setIsQuickAddOpen(false);
        setQuickAddName('');
        setQuickAddMobile('');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to add contractor');
      }
    } catch (error) {
      console.error(error);
      alert('Error creating contractor');
    }
  };

  const handleAction = async (id: number, action: 'APPROVED') => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/approvals/${id}/status`, {
        method: 'PUT',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ status: action, approved_by: userName }),
      });

      if (response.ok) {
        setApprovals((current) =>
          current.map((approval) =>
            approval.id === id ? { ...approval, status: action, approved_by: userName } : approval
          )
        );
      } else {
        alert('Failed to update approval status');
      }
    } catch (error) {
      console.error('Approval action error:', error);
      alert('Failed to update approval status');
    }
  };

  const handleVoid = async (approval: any) => {
    console.log('[Approvals] Void button clicked', {
      approvalId: approval?.id,
      status: approval?.status,
      role,
      userName,
    });

    if (!approval?.id) {
      alert('Unable to void request: request ID is missing.');
      return;
    }

    if (!window.confirm(`Void approval request "${approval.title}"? This will move it to Voided Requests.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/approval-requests/${approval.id}/void`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({}),
      });

      console.log('[Approvals] Void API response', {
        approvalId: approval.id,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to void approval request');
      }

      const data = await response.json();
      const voidedApproval = data.approval || {
        ...approval,
        status: 'VOIDED',
        voidedBy: userName,
        voidedAt: new Date().toISOString(),
      };

      setApprovals((current) =>
        current.map((item) => (item.id === approval.id ? { ...item, ...voidedApproval } : item))
      );
      setActiveTab('VOIDED');
    } catch (error: any) {
      console.error('[Approvals] Void action failed', error);
      alert(error.message || 'Failed to void approval request');
    }
  };

  const handleRestore = async (approval: any) => {
    if (!window.confirm('Restore this request back to active workflow?')) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/approval-requests/${approval.id}/restore`, {
        method: 'POST',
        headers: createAuthHeaders(true),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restore approval request');
      }

      const data = await response.json();
      const restoredApproval = data.approval;

      setApprovals((current) =>
        current.map((item) => (item.id === approval.id ? { ...item, ...restoredApproval } : item))
      );
      setActiveTab('ACTIVE');
    } catch (error: any) {
      alert(error.message || 'Failed to restore approval request');
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Requests</h1>
          <p className="text-gray-500 text-sm mt-1">
            {canRaiseApproval ? 'Manage and track your approval requests.' : 'Review and process company approvals.'}
          </p>
        </div>
        {canRaiseApproval && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Raise Request
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-4 bg-gray-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 overflow-x-auto">
              <TabButton
                active={activeTab === 'ACTIVE'}
                label="Active Requests"
                count={activeApprovals.length}
                onClick={() => setActiveTab('ACTIVE')}
              />
              <TabButton
                active={activeTab === 'VOIDED'}
                label="Voided Requests"
                count={voidedApprovals.length}
                onClick={() => setActiveTab('VOIDED')}
              />
            </div>

            {(canViewApprovals || canRaiseApproval) && (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Filter By Project:</span>
                <select
                  value={filterProjectId}
                  onChange={(e) => setFilterProjectId(e.target.value)}
                  className="text-xs border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ALL">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900">
            {activeTab === 'ACTIVE'
              ? canRaiseApproval
                ? 'My Active Requests'
                : canApprove
                  ? 'Active Approval Requests'
                  : 'Pending Approval Requests'
              : 'Voided Approval Requests'}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-white">
                <th className="px-6 py-4 font-medium">Request Details</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Raised By</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                {activeTab === 'VOIDED' && (
                  <th className="px-6 py-4 font-medium">Voided Audit</th>
                )}
                {activeTab === 'VOIDED' && canVoidApproval && (
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                )}
                {activeTab === 'ACTIVE' && canApprove && (
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'VOIDED' ? (canVoidApproval ? 7 : 6) : canApprove ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                    Loading approval requests...
                  </td>
                </tr>
              ) : displayApprovals.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'VOIDED' ? (canVoidApproval ? 7 : 6) : canApprove ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                    No approval requests found.
                  </td>
                </tr>
              ) : (
                displayApprovals.map((approval) => (
                  <tr key={approval.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 text-base">{approval.title}</div>
                      {approval.parsed.projectName && (
                        <div className="text-xs text-blue-600 font-semibold mt-0.5">{approval.parsed.projectName}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{approval.parsed.desc}</div>
                      {approval.parsed.vendorName && (
                        <div className="text-xs text-indigo-600 mt-1 font-medium italic">
                          {approval.parsed.originalType === 'Contractor Payment' || approval.type === 'Contractor Payment' ? 'Contractor' : 'Vendor/Party'}: {approval.parsed.vendorName}
                        </div>
                      )}
                      <div className="text-xs font-mono text-gray-400 mt-1">
                        {approval.approval_code} • {new Date(approval.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {approval.parsed.originalType || approval.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium">{approval.raised_by}</div>
                      <div className="text-gray-500 text-xs">{approval.raised_by_role}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      ₹{Number(approval.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          approval.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : approval.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : (approval.status === 'VOIDED' || approval.status === 'REJECTED')
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {approval.status === 'REJECTED' ? 'VOIDED' : approval.status}
                      </span>
                    </td>

                    {activeTab === 'VOIDED' && (
                      <td className="px-6 py-4">
                        <div className="text-gray-900 font-medium">{approval.voidedBy || 'CEO'}</div>
                        <div className="text-gray-500 text-xs">
                          {approval.voidedAt ? new Date(approval.voidedAt).toLocaleString() : 'No timestamp'}
                        </div>
                      </td>
                    )}

                    {activeTab === 'VOIDED' && canVoidApproval && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRestore(approval)}
                          className="text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          Restore
                        </button>
                      </td>
                    )}

                    {activeTab === 'ACTIVE' && canApprove && (
                      <td className="px-6 py-4 text-right space-x-2">
                        {approval.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleAction(approval.id, 'APPROVED')}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                            >
                              Approve
                            </button>
                            {canVoidApproval && (
                              <button
                                onClick={() => handleVoid(approval)}
                                className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                              >
                                Delete (Void)
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">Raise Approval Request</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">Please fix the following issues:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationErrors.map((error, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Project (Mandatory)</label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    const p = projects.find((proj) => String(proj.id) === e.target.value);
                    setSelectedProjectName(p ? p.name : '');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.status === 'COMPLETED'}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Site A Material Purchase"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Vendor Payment">Vendor Payment</option>
                    <option value="Contractor Payment">Contractor Payment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {type === 'Contractor Payment' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Contractor</label>
                    <div className="flex space-x-2">
                      <select
                        required
                        value={selectedContractorId}
                        onChange={(e) => {
                          setSelectedContractorId(e.target.value);
                          const c = contractors.find((con) => String(con.id) === e.target.value);
                          if (c) setVendorName(c.contractor_name);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Choose Contractor --</option>
                        {contractors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.contractor_name} ({c.mobile_number})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsQuickAddOpen(true)}
                        className="px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center justify-center transition-colors"
                        title="Quick Add Contractor"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Party Name (Optional)</label>
                    <input
                      type="text"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={
                        type === 'Vendor Payment' 
                          ? "Enter vendor name" 
                          : "Enter reference (optional)"
                      }
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Remarks</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide details about this request..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachments (Link/Note - Optional)</label>
                <input
                  type="text"
                  value={attachments}
                  onChange={(e) => setAttachments(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste link to documents or specify reference"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Quick Add Contractor</h3>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAddContractor} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Contractor Name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="text"
                  required
                  value={quickAddMobile}
                  onChange={(e) => setQuickAddMobile(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Mobile Number"
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Add & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
