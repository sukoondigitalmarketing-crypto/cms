import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Calendar, Clock, IndianRupee, X, Trash2, Ban, AlertTriangle, RefreshCcw, Filter, Pencil, Download, FileText, FileSpreadsheet, Briefcase, Activity, History as HistoryIcon } from 'lucide-react';
import { API_CONFIG, ROLE_PERMISSIONS } from '../config';
import { canEdit, hasPermission } from '../rbac';
import { validateProjectForm } from '../services/validation';
import { createAuthHeaders } from '../services/api';
import { formatCurrency, formatCompactCurrency } from '../services/format';

interface ProjectsDashboardProps {
  role: string;
}

function TabButton({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
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
      {count !== undefined && (
        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
          active ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

export function ProjectsDashboard({ role }: ProjectsDashboardProps) {
  const [statusTab, setStatusTab] = useState('ACTIVE'); // ACTIVE, NEW, ONGOING, COMPLETED, DEACTIVATED, ALL
  const [projects, setProjects] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [tempBudget, setTempBudget] = useState('');
  const [editingRevenueId, setEditingRevenueId] = useState<number | null>(null);
  const [tempRevenue, setTempRevenue] = useState('');

  // Smart Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProjectForDelete, setSelectedProjectForDelete] = useState<any>(null);
  const [projectUsage, setProjectUsage] = useState<{ usageCount: number; details: any } | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [projectStatus, setProjectStatus] = useState('NEW');
  const [budget, setBudget] = useState('');
  const [renameReason, setRenameReason] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [statusTab]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      if (statusTab === 'FINANCIALS') {
        const response = await fetch(`${API_CONFIG.BASE_URL}/project-financials`, {
          headers: createAuthHeaders()
        });
        if (response.ok) {
          setFinancials(await response.json());
        }
      } else {
        let url = `${API_CONFIG.BASE_URL}/projects`;
        if (statusTab !== 'ACTIVE') {
          url += `?status=${statusTab}`;
        } else {
          url += `?status=ACTIVE`; // Explicitly call active
        }
        const response = await fetch(url, {
          headers: createAuthHeaders()
        });
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (id: number) => {
    if (!window.confirm('Are you sure you want to reactivate this project?')) return;
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${id}/reactivate`, {
        method: 'POST',
        headers: createAuthHeaders()
      });

      if (response.ok) {
        fetchProjects();
        alert('Project reactivated successfully and moved to ACTIVE list.');
      } else {
        alert('Failed to reactivate project');
      }
    } catch (error) {
      console.error('Reactivate error:', error);
      alert('Failed to reactivate project');
    }
  };

  const filteredProjects = projects;

  const permissions = ROLE_PERMISSIONS[role] || {};
  const canCreate = hasPermission(role, 'projects', 'create');
  const canEditStatus = canEdit(role, 'projects');

  const handleEditClick = (project: any) => {
    setSelectedProjectForEdit(project);
    setName(project.name);
    setCode(project.code);
    setLocation(project.location);
    setStartDate(project.startDate);
    setExpectedEndDate(project.expectedEndDate);
    setBudget(project.budget?.toString() || '0');
    setRenameReason('');
    setIsEditModalOpen(true);
    fetchHistory(project.id);
  };

  const fetchHistory = async (projectId: number) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${projectId}/history`, {
        headers: createAuthHeaders()
      });
      if (response.ok) {
        setHistory(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectForEdit) return;
    setValidationErrors([]);

    const validation = validateProjectForm({
      code,
      name,
      location,
      startDate,
      expectedEndDate,
      totalValue: selectedProjectForEdit.totalValue,
      estimatedCost: selectedProjectForEdit.estimatedCost,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Require reason if name changed
    if (name.trim() !== selectedProjectForEdit.name && !renameReason.trim()) {
      setValidationErrors(['Please provide a reason for renaming this project.']);
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/master/projects/${selectedProjectForEdit.id}`, {
        method: 'PUT',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          location: location.trim(),
          startDate,
          expectedEndDate,
          status: selectedProjectForEdit.status,
          budget: Number(budget),
          revenue: selectedProjectForEdit.revenue,
          rename_reason: renameReason.trim()
        })
      });

      if (response.ok) {
        setIsEditModalOpen(false);
        fetchProjects();
        alert('✅ Project updated successfully!');
      } else {
        const error = await response.json();
        setValidationErrors([error.error || 'Failed to update project']);
      }
    } catch (error) {
      setValidationErrors(['Failed to update project. Please try again.']);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${id}/status`, {
        method: 'PUT',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchProjects();
      } else {
        alert('Failed to update project status');
      }
    } catch (error) {
      console.error('Status update error:', error);
      alert('Failed to update project status');
    }
  };

  const handleDeleteClick = async (project: any) => {
    setSelectedProjectForDelete(project);
    setIsCheckingUsage(true);
    setIsDeleteModalOpen(true);
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${project.id}/usage`, {
        headers: createAuthHeaders()
      });
      if (response.ok) {
        const usageData = await response.json();
        setProjectUsage(usageData);
      }
    } catch (error) {
      console.error('Failed to check project usage:', error);
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const confirmDeleteAction = async (mode: 'permanent' | 'deactivate') => {
    if (!selectedProjectForDelete) return;
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${selectedProjectForDelete.id}?mode=${mode}`, {
        method: 'DELETE',
        headers: createAuthHeaders()
      });

      if (response.ok) {
        setIsDeleteModalOpen(false);
        setSelectedProjectForDelete(null);
        setProjectUsage(null);
        fetchProjects();
        alert(mode === 'permanent' ? 'Project deleted permanently' : 'Project deactivated successfully');
      } else {
        alert('Failed to process project removal');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to process project removal');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const validation = validateProjectForm({
      code,
      name,
      location,
      startDate,
      expectedEndDate,
      totalValue,
      estimatedCost,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          location: location.trim(),
          startDate,
          expectedEndDate,
          totalValue: totalValue ? Number(totalValue) : 0,
          estimatedCost: estimatedCost ? Number(estimatedCost) : 0,
          status: projectStatus,
          budget: budget ? Number(budget) : 0
        })
      });

      if (response.ok) {
        setIsModalOpen(false);
        setCode('');
        setName('');
        setLocation('');
        setStartDate('');
        setExpectedEndDate('');
        setTotalValue('');
        setEstimatedCost('');
        setBudget('');
        setValidationErrors([]);
        fetchProjects();
        alert('✅ Project created successfully!');
      } else {
        const error = await response.json();
        setValidationErrors([error.error || 'Failed to create project']);
      }
    } catch (error) {
      setValidationErrors(['Failed to create project. Please try again.']);
    }
  };

  const handleUpdateRevenue = async (id: number) => {
    if (!tempRevenue || isNaN(Number(tempRevenue))) {
      alert('Please enter a valid amount');
      return;
    }
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${id}/revenue`, {
        method: 'PUT',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ revenue: Number(tempRevenue) })
      });
      if (response.ok) {
        setEditingRevenueId(null);
        fetchProjects();
      } else {
        alert('Failed to update revenue');
      }
    } catch (error) {
      console.error('Revenue update error:', error);
      alert('Failed to update revenue');
    }
  };

  const handleUpdateBudget = async (id: number) => {
    if (!tempBudget || isNaN(Number(tempBudget))) {
      alert('Please enter a valid amount');
      return;
    }
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${id}/budget`, {
        method: 'PUT',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ budget: Number(tempBudget) })
      });
      if (response.ok) {
        setEditingBudgetId(null);
        fetchProjects();
      } else {
        alert('Failed to update budget');
      }
    } catch (error) {
      console.error('Budget update error:', error);
      alert('Failed to update budget');
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage construction projects across all stages.</p>
        </div>
        {canCreate && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 sm:pb-0">
          <Filter className="w-4 h-4 text-gray-400 mr-2" />
          <TabButton active={statusTab === 'ACTIVE'} label="Active Projects" count={statusTab === 'ACTIVE' ? projects.length : undefined} onClick={() => setStatusTab('ACTIVE')} />
          <TabButton active={statusTab === 'DEACTIVATED'} label="Inactive" count={statusTab === 'DEACTIVATED' ? projects.length : undefined} onClick={() => setStatusTab('DEACTIVATED')} />
          <TabButton active={statusTab === 'COMPLETED'} label="Completed" count={statusTab === 'COMPLETED' ? projects.length : undefined} onClick={() => setStatusTab('COMPLETED')} />
          <TabButton active={statusTab === 'FINANCIALS'} label="Financial Summary" onClick={() => setStatusTab('FINANCIALS')} />
          <TabButton active={statusTab === 'ALL'} label="All Projects" count={statusTab === 'ALL' ? projects.length : undefined} onClick={() => setStatusTab('ALL')} />
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setStatusTab('NEW')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${statusTab === 'NEW' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              New
            </button>
            <button 
              onClick={() => setStatusTab('ONGOING')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${statusTab === 'ONGOING' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Ongoing
            </button>
          </div>
        </div>
      </div>

      {statusTab === 'FINANCIALS' && (
        <div className="flex justify-end space-x-3 mb-4">
          <button 
            onClick={() => window.open(`${API_CONFIG.BASE_URL}/reports/project-financials/pdf?token=${localStorage.getItem('token')}`, '_blank')}
            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center border border-red-200"
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            Export PDF
          </button>
          <button 
            onClick={() => window.open(`${API_CONFIG.BASE_URL}/reports/project-financials/excel?token=${localStorage.getItem('token')}`, '_blank')}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 flex items-center border border-emerald-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
            Export Excel
          </button>
        </div>
      )}

      {statusTab !== 'FINANCIALS' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-white">
                  <th className="px-6 py-4 font-medium">Project Details</th>
                  <th className="px-6 py-4 font-medium">Timeline</th>
                  <th className="px-6 py-4 font-medium text-right">Finance</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  {canEditStatus && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={canEditStatus ? 5 : 4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <AlertTriangle className="w-10 h-10 text-gray-200 mb-3" />
                        <p className="text-gray-500 font-medium">No projects found in this category.</p>
                        <p className="text-gray-400 text-xs mt-1">Try switching filters or add a new project.</p>
                      </div>
                    </td>
                  </tr>
                ) : projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 text-base">{project.name}</div>
                      <div className="text-xs font-mono text-gray-500 mt-1">{project.code}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center">
                        <MapPin className="w-3 h-3 mr-1" /> {project.location}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        Start: {project.startDate}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center mt-1">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        End: {project.actualEndDate || project.expectedEndDate}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-blue-600 text-sm">
                        {formatCurrency(project.total_expense || 0)}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-wider">
                        Budget: {formatCompactCurrency(project.budget || 0)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        project.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                        project.status === 'ONGOING' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    {canEditStatus && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <select 
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={project.is_deleted ? 'DEACTIVATED' : project.status}
                            onChange={(e) => handleStatusChange(project.id, e.target.value)}
                            disabled={project.is_deleted}
                          >
                            <option value="NEW" disabled={project.status === 'NEW'}>NEW</option>
                            <option value="ONGOING" disabled={project.status === 'ONGOING'}>ONGOING</option>
                            <option value="COMPLETED" disabled={project.status === 'COMPLETED'}>COMPLETED</option>
                            <option value="DEACTIVATED" disabled>INACTIVE</option>
                          </select>
                          
                          {project.is_deleted ? (
                            <button 
                              onClick={() => handleReactivate(project.id)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Reactivate Project"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleEditClick(project)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit Project Details"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteClick(project)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Remove/Deactivate Project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50/50">
                  <th className="px-6 py-4 font-black">Project Name</th>
                  <th className="px-6 py-4 text-right font-black">Budget</th>
                  <th className="px-6 py-4 text-right font-black">Material Cost</th>
                  <th className="px-6 py-4 text-right font-black">Contractor Cost</th>
                  <th className="px-6 py-4 text-right font-black">Total Expense</th>
                  <th className="px-6 py-4 text-right font-black bg-blue-50/50">Projected Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {financials.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">No financial records found.</td></tr>
                ) : financials.map((f, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 truncate w-40" title={f.project_name}>{f.project_name}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingBudgetId === f.project_id ? (
                        <div className="flex items-center justify-end space-x-1">
                          <input 
                            type="number" 
                            value={tempBudget}
                            onChange={(e) => setTempBudget(e.target.value)}
                            className="w-20 px-2 py-1 border border-blue-400 rounded focus:outline-none text-xs font-bold shadow-sm"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateBudget(f.project_id)} className="text-emerald-600 font-bold p-1 hover:bg-emerald-50 rounded">✔</button>
                        </div>
                      ) : (
                        <div 
                          className="font-bold text-gray-400 cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => { setEditingBudgetId(f.project_id); setTempBudget(f.budget.toString()); }}
                        >
                          {formatCurrency(f.budget)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-gray-600 font-medium">₹{Math.round(f.total_grn_amount).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-indigo-600 font-medium">₹{Math.round(f.total_contractor_payment).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right bg-blue-50/20">
                      <div className="font-black text-blue-700">{formatCurrency(f.total_expense)}</div>
                    </td>
                    <td className="px-6 py-4 text-right bg-blue-50/20">
                       {(() => {
                         const budgetValue = Number(f.budget || 0);
                         const expenseValue = Number(f.total_expense || 0);
                         const profitValue = budgetValue - expenseValue;
                         return (
                           <div className={`font-black ${profitValue < 0 ? 'text-red-600' : profitValue > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                             {formatCurrency(profitValue)}
                           </div>
                         );
                       })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Smart Delete Modal */}
      {isDeleteModalOpen && selectedProjectForDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
                Project Removal
              </h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {isCheckingUsage ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-sm text-gray-500">Checking project dependencies...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Project Name</p>
                    <p className="font-bold text-gray-900">{selectedProjectForDelete.name}</p>
                  </div>
                  
                  {projectUsage && projectUsage.usageCount > 0 ? (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex">
                          <Ban className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-amber-800">Cannot Delete Permanently</p>
                            <p className="text-xs text-amber-700 mt-1">
                              This project is linked to <span className="font-bold">{projectUsage.usageCount}</span> existing records.
                            </p>
                            <ul className="text-[10px] text-amber-600 mt-2 list-disc list-inside">
                              {projectUsage.details.approvals > 0 && <li>{projectUsage.details.approvals} Approval Requests</li>}
                              {projectUsage.details.materialIssues > 0 && <li>{projectUsage.details.materialIssues} Legacy Material Issues</li>}
                              {projectUsage.details.materialIssueVouchers > 0 && <li>{projectUsage.details.materialIssueVouchers} Material Issue Vouchers</li>}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        To maintain data integrity, you can only <span className="font-semibold text-gray-900">Deactivate</span> this project. It will be hidden from the main list but linked data will remain safe.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <div className="flex">
                          <Trash2 className="w-5 h-5 text-emerald-600 mr-3 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-emerald-800">Safe for Permanent Deletion</p>
                            <p className="text-xs text-emerald-700 mt-1">
                              This project has no linked records in other modules.
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        You can permanently remove this project from the database. This action <span className="font-semibold text-red-600">cannot be undone</span>.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              
              {!isCheckingUsage && (
                projectUsage && projectUsage.usageCount > 0 ? (
                  <button 
                    onClick={() => confirmDeleteAction('deactivate')}
                    className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors flex items-center"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Deactivate Project
                  </button>
                ) : (
                  <button 
                    onClick={() => confirmDeleteAction('permanent')}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Permanently
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Pencil className="w-5 h-5 mr-2 text-blue-600" />
                Edit Project: {selectedProjectForEdit?.name}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateProject} className="p-6 space-y-4">
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">❌ Please fix the following issues:</p>
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Project Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Project Code *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono uppercase"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              {name.trim() !== selectedProjectForEdit?.name && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Rename Reason * (Required for Audit)</label>
                  <textarea
                    required
                    placeholder="Why is this project being renamed?"
                    className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                    rows={2}
                    value={renameReason}
                    onChange={(e) => setRenameReason(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location *</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Expected End Date</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={expectedEndDate}
                    onChange={(e) => setExpectedEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Project Budget</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="number"
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  Save Changes
                </button>
              </div>

              {history.length > 0 && (
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                    <HistoryIcon className="w-3 h-3 mr-2" />
                    Project Rename History
                  </h4>
                  <div className="space-y-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {history.map((h, i) => (
                      <div key={h.id} className="relative pl-4 border-l-2 border-blue-100 pb-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-blue-200 rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                        </div>
                        <div className="flex justify-between items-start">
                          <div className="text-sm font-bold text-gray-800">
                            {h.old_name} <span className="text-gray-400 font-normal">→</span> {h.new_name}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium">
                            {new Date(h.renamed_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 italic">
                          "{h.rename_reason}"
                        </div>
                        <div className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-tighter">
                          By: {h.renamed_by}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
