import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, X, Trash2, Calendar, User, Building2, Receipt, 
  AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, Check, ArrowRight,
  ChevronLeft, Printer, FileDown, Clock, Paperclip, Eye, RefreshCw, FileText, ChevronRight,
  Edit, CheckSquare, Zap
} from 'lucide-react';
import { API_CONFIG } from '../config';
import { createAuthHeaders } from '../services/api';
import { hasPermission } from '../rbac';

interface VendorInvoicesDashboardProps {
  role: string;
}

interface Vendor {
  id: number;
  vendor_name: string;
  contact_person: string;
  phone: string;
  address: string;
  gst_number: string;
}

interface AvailableGRN {
  id: number;
  grn_number: string;
  grn_date: string;
  projectName: string;
  finalAmount: number;
  total_amount: number;
}

interface Invoice {
  id: number;
  vendor_id: number;
  invoice_number: string;
  invoice_date: string;
  remarks: string;
  reference_amount: number;
  invoice_amount: number;
  variance: number;
  status: string;
  vendor_name_snapshot: string;
  vendor_gst_snapshot: string;
  vendor_address_snapshot: string;
  created_by: string;
  grn_count: number;
  grn_ids?: string;
  grn_numbers?: string;
  project_names?: string;
  item_count: number;
  createdAt: string;
  amount_paid?: number;
  pending_amount?: number;
  payment_status?: string;
}

interface Project {
  id: number;
  name: string;
}

export function VendorInvoicesDashboard({ role }: VendorInvoicesDashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableGrns, setAvailableGrns] = useState<AvailableGRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states (Creation Modal)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [selectedGrnIds, setSelectedGrnIds] = useState<number[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState<string>('');
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);

  // Edit states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [editingLineItems, setEditingLineItems] = useState<any[]>([]);

  // Local Toast & Confirmation Dialog states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'success';
  } | null>(null);

  // List Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterVerificationStatus, setFilterVerificationStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Detail View Navigation States
  const [activeView, setActiveView] = useState<'list' | 'detail'>('list');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailedGrns, setDetailedGrns] = useState<any[]>([]);
  const [detailedItems, setDetailedItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Permissions
  const canCreateInvoice = hasPermission(role, 'vendor_invoices', 'create');
  const canDeleteInvoice = hasPermission(role, 'vendor_invoices', 'delete');
  const canEditInvoice = hasPermission(role, 'vendor_invoices', 'edit');
  const canApproveInvoice = hasPermission(role, 'vendor_invoices', 'approve');

  useEffect(() => {
    fetchInvoices();
    fetchVendors();
    fetchProjects();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVendorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/master/vendors`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProjects(data);
        } else if (data && Array.isArray(data.data)) {
          setProjects(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchAvailableGrns = async (vendorId: number) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/grns/available-for-invoice?vendor_id=${vendorId}`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableGrns(data);
      }
    } catch (err) {
      console.error('Error fetching available GRNs:', err);
    }
  };

  const handleVendorSelect = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.vendor_name);
    setShowVendorDropdown(false);
    setSelectedGrnIds([]);
    setInvoiceAmount('');
    setIsAmountManuallyEdited(false);
    fetchAvailableGrns(vendor.id);
  };

  // Checkbox handlers
  const handleToggleGrn = (grnId: number) => {
    let newGrnIds = [...selectedGrnIds];
    if (newGrnIds.includes(grnId)) {
      newGrnIds = newGrnIds.filter(id => id !== grnId);
    } else {
      newGrnIds.push(grnId);
    }
    setSelectedGrnIds(newGrnIds);

    // Recalculate reference sum and update invoice amount if not manual
    const refSum = newGrnIds.reduce((sum, id) => {
      const grn = availableGrns.find(g => g.id === id);
      return sum + (grn ? (Number(grn.finalAmount) || Number(grn.total_amount) || 0) : 0);
    }, 0);

    if (!isAmountManuallyEdited) {
      setInvoiceAmount(refSum > 0 ? refSum.toString() : '');
    }
  };

  const handleSelectAllGrns = () => {
    if (selectedGrnIds.length === availableGrns.length) {
      setSelectedGrnIds([]);
      if (!isAmountManuallyEdited) setInvoiceAmount('');
    } else {
      const allIds = availableGrns.map(g => g.id);
      setSelectedGrnIds(allIds);
      const refSum = availableGrns.reduce((sum, g) => sum + (Number(g.finalAmount) || Number(g.total_amount) || 0), 0);
      if (!isAmountManuallyEdited) setInvoiceAmount(refSum.toString());
    }
  };

  const fetchInvoiceDetails = async (invoice: Invoice) => {
    setLoadingDetail(true);
    setSelectedInvoice(invoice);
    setActiveView('detail');
    setDetailedGrns([]);
    setDetailedItems([]);
    setExpandedItems({});

    let grnIds: number[] = [];
    if (invoice.grn_ids) {
      if (Array.isArray(invoice.grn_ids)) {
        grnIds = invoice.grn_ids.map(Number);
      } else if (typeof invoice.grn_ids === 'string') {
        grnIds = invoice.grn_ids.split(',').map(Number);
      }
    }
    if (grnIds.length === 0) {
      setLoadingDetail(false);
      return;
    }

    try {
      const promises = grnIds.map(async (id) => {
        const res = await fetch(`${API_CONFIG.BASE_URL}/grns/${id}`, {
          headers: createAuthHeaders()
        });
        if (res.ok) {
          return await res.json();
        }
        return null;
      });

      const results = await Promise.all(promises);
      const validGrns = results.filter(g => g !== null);
      
      setDetailedGrns(validGrns);

      // Extract items from the linked GRNs
      const allItems: any[] = [];
      validGrns.forEach(grn => {
        if (Array.isArray(grn.items)) {
          grn.items.forEach((item: any) => {
            allItems.push({
              ...item,
              grn_number: grn.grn_number,
              grn_date: grn.grn_date,
              project_name: grn.projectName || 'Central Store'
            });
          });
        }
      });
      setDetailedItems(allItems);
    } catch (err) {
      console.error('Error fetching linked GRNs:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev && prev.message === message ? null : prev);
    }, 4000);
  };

  // Show confirmation helper
  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type: 'danger' | 'info' | 'success' = 'info'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText,
      type
    });
  };

  // Calculations for Creation / Edit Form
  const referenceAmount = useMemo(() => {
    if (isEditMode) {
      return editingLineItems.reduce((sum, line) => {
        const qty = parseFloat(line.billed_quantity) || 0;
        const estRate = parseFloat(line.estimated_rate) || 0;
        return sum + (qty * estRate);
      }, 0);
    }
    return selectedGrnIds.reduce((sum, id) => {
      const grn = availableGrns.find(g => g.id === id);
      return sum + (grn ? (Number(grn.finalAmount) || Number(grn.total_amount) || 0) : 0);
    }, 0);
  }, [isEditMode, editingLineItems, selectedGrnIds, availableGrns]);

  const currentInvoiceAmount = parseFloat(invoiceAmount) || 0;
  const currentVariance = referenceAmount > 0 ? currentInvoiceAmount - referenceAmount : 0;

  // Decoupled Workflow Config
  interface InvoiceWorkflowConfig {
    approvalStatus: 'Draft' | 'Approved' | 'Finalized' | 'Cancelled';
    paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
    isEditable: boolean;
    isDeletable: boolean;
    canApprove: boolean;
    canFinalize: boolean;
    canPrint: boolean;
  }

  const getWorkflowConfig = (input: any): InvoiceWorkflowConfig => {
    const status = typeof input === 'string' ? input : input?.status;
    const s = (status || '').toUpperCase();
    const canApproveRole = hasPermission(role, 'vendor_invoices', 'approve');
    const canEditRole = hasPermission(role, 'vendor_invoices', 'edit');
    const canDeleteRole = hasPermission(role, 'vendor_invoices', 'delete');

    // Default configuration
    let approvalStatus: 'Draft' | 'Approved' | 'Finalized' | 'Cancelled' = 'Draft';
    let paymentStatus: 'Unpaid' | 'Partial' | 'Paid' = 'Unpaid';
    let isEditable = false;
    let isDeletable = false;
    let canApprove = false;
    let canFinalize = false;
    let canPrint = true;

    if (s === 'DRAFT') {
      approvalStatus = 'Draft';
      paymentStatus = 'Unpaid';
      isEditable = canEditRole;
      isDeletable = canDeleteRole;
      canApprove = canApproveRole;
    } else if (s === 'CONFIRMED' || s === 'APPROVED') {
      approvalStatus = 'Approved';
      paymentStatus = 'Unpaid';
      canFinalize = canApproveRole;
    } else if (s === 'FINALIZED' || s === 'UNPAID') {
      approvalStatus = 'Finalized';
      paymentStatus = 'Unpaid';
    } else if (s === 'PARTIALLY_PAID') {
      approvalStatus = 'Finalized';
      paymentStatus = 'Partial';
    } else if (s === 'PAID') {
      approvalStatus = 'Finalized';
      paymentStatus = 'Paid';
    } else if (s === 'CANCELLED') {
      approvalStatus = 'Cancelled';
      paymentStatus = 'Unpaid';
      canPrint = false;
    } else {
      approvalStatus = 'Finalized';
      paymentStatus = 'Unpaid';
    }

    if (input && typeof input === 'object') {
      const ps = (input.payment_status || '').toUpperCase();
      if (ps === 'PAID') {
        paymentStatus = 'Paid';
      } else if (ps === 'PARTIALLY PAID' || ps === 'PARTIALLY_PAID' || ps === 'PARTIAL') {
        paymentStatus = 'Partial';
      } else if (input.amount_paid !== undefined) {
        const paid = Number(input.amount_paid || 0);
        const total = Number(input.invoice_amount || 0);
        if (paid >= total && total > 0) paymentStatus = 'Paid';
        else if (paid > 0) paymentStatus = 'Partial';
        else paymentStatus = 'Unpaid';
      }
    }

    return {
      approvalStatus,
      paymentStatus,
      isEditable,
      isDeletable,
      canApprove,
      canFinalize,
      canPrint,
    };
  };

  // Variance styling helpers
  const getVarianceStyles = (refVal: number, invVal: number) => {
    if (refVal <= 0) return { bg: 'bg-slate-50 border-slate-200 text-slate-700', label: 'No Reference' };
    const diff = invVal - refVal;
    const pct = (Math.abs(diff) / refVal) * 100;
    
    if (pct <= 5) {
      return { 
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
        label: 'Acceptable Variance (≤ 5%)',
        badge: 'bg-emerald-100 text-emerald-800'
      };
    } else if (pct <= 10) {
      return { 
        bg: 'bg-amber-50 border-amber-200 text-amber-800', 
        label: 'Warning Variance (5% - 10%)',
        badge: 'bg-amber-100 text-amber-800'
      };
    } else {
      return { 
        bg: 'bg-red-50 border-red-200 text-red-800', 
        label: 'Critical Variance (> 10%)',
        badge: 'bg-red-100 text-red-800'
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !invoiceNumber || !invoiceDate || invoiceAmount === '') {
      showToast('Please fill in all mandatory fields.', 'warning');
      return;
    }

    if (!isEditMode && !selectedGrnIds.length) {
      showToast('Please select at least one GRN.', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      if (isEditMode) {
        // Edit mode (PUT)
        const payload = {
          invoice_date: invoiceDate,
          remarks,
          invoice_amount: parseFloat(invoiceAmount),
          line_items: editingLineItems.map(item => ({
            id: item.id,
            billed_quantity: parseFloat(item.billed_quantity),
            confirmed_rate: parseFloat(item.confirmed_rate),
            gst_amount: parseFloat(item.gst_amount || 0),
            discount_amount: parseFloat(item.discount_amount || 0)
          }))
        };

        const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${editingInvoiceId}`, {
          method: 'PUT',
          headers: createAuthHeaders(true),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('Vendor Invoice updated successfully.', 'success');
          setIsModalOpen(false);
          resetForm();
          fetchInvoices();
          
          // Re-fetch selected invoice details if currently viewing it
          if (selectedInvoice && selectedInvoice.id === editingInvoiceId) {
            const detailRes = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${editingInvoiceId}`, {
              headers: createAuthHeaders()
            });
            if (detailRes.ok) {
              const data = await detailRes.json();
              setSelectedInvoice(data);
              fetchInvoiceDetails(data);
            }
          }
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to update vendor invoice.', 'error');
        }
      } else {
        // Create mode (POST)
        const payload = {
          vendor_id: selectedVendor.id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          remarks,
          grn_ids: selectedGrnIds,
          invoice_amount: parseFloat(invoiceAmount)
        };

        const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices`, {
          method: 'POST',
          headers: createAuthHeaders(true),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('Vendor Invoice recorded successfully.', 'success');
          setIsModalOpen(false);
          resetForm();
          fetchInvoices();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to save vendor invoice.', 'error');
        }
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      showToast('Failed to save vendor invoice. Please check logs.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, invNum: string) => {
    showConfirm(
      'Confirm Deletion',
      `Are you sure you want to delete Invoice ${invNum}? This will unlock all its linked GRNs.`,
      async () => {
        try {
          const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${id}`, {
            method: 'DELETE',
            headers: createAuthHeaders()
          });
          if (res.ok) {
            showToast(`Invoice ${invNum} deleted successfully.`, 'success');
            fetchInvoices();
            if (selectedInvoice && selectedInvoice.id === id) {
              setSelectedInvoice(null);
              setActiveView('list');
            }
          } else {
            const err = await res.json();
            showToast(err.error || 'Failed to delete invoice.', 'error');
          }
        } catch (err) {
          console.error('Error deleting invoice:', err);
          showToast('Failed to delete invoice.', 'error');
        }
      },
      'Delete',
      'Cancel',
      'danger'
    );
  };

  const handleStartEdit = async (inv: Invoice) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${inv.id}`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedVendor({
          id: data.vendor_id,
          vendor_name: data.vendor_name,
          contact_person: '',
          phone: '',
          address: data.address || '',
          gst_number: data.gst_number || ''
        });
        setVendorSearch(data.vendor_name);
        setInvoiceNumber(data.invoice_number);
        setInvoiceDate(data.invoice_date.split('T')[0]);
        setRemarks(data.remarks || '');
        setInvoiceAmount(data.invoice_amount.toString());
        setIsAmountManuallyEdited(true); // Prevent overwrite automatically
        setSelectedGrnIds(data.grn_ids || []);
        setEditingLineItems(data.line_items || []);
        setIsEditMode(true);
        setEditingInvoiceId(inv.id);
        setIsModalOpen(true);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to fetch invoice details.', 'error');
      }
    } catch (err) {
      console.error('Error starting edit:', err);
      showToast('Error starting edit.', 'error');
    }
  };

  const handleApprove = async (id: number, invNum: string) => {
    showConfirm(
      'Approve Invoice',
      `Are you sure you want to approve Invoice ${invNum}? This will lock the invoice and make it read-only.`,
      async () => {
        try {
          const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${id}/confirm`, {
            method: 'POST',
            headers: createAuthHeaders()
          });
          if (res.ok) {
            showToast(`Invoice ${invNum} approved successfully.`, 'success');
            fetchInvoices();
            if (selectedInvoice && selectedInvoice.id === id) {
              const detailRes = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${id}`, {
                headers: createAuthHeaders()
              });
              if (detailRes.ok) {
                const data = await detailRes.json();
                setSelectedInvoice(data);
              }
            }
          } else {
            const err = await res.json();
            showToast(err.error || 'Failed to approve invoice.', 'error');
          }
        } catch (err) {
          console.error('Error approving invoice:', err);
          showToast('Failed to approve invoice due to server error.', 'error');
        }
      },
      'Approve',
      'Cancel',
      'success'
    );
  };

  const handleFinalize = async (id: number, invNum: string) => {
    showConfirm(
      'Execute Financial Finalization',
      `Financial Finalization will update confirmed rates across Inventory, Material Issues, Project Costing and ERP Reports.\n\nThis operation is intended to establish the Vendor Invoice as the Financial Source of Truth.\n\nContinue?`,
      async () => {
        try {
          const res = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${id}/finalize`, {
            method: 'POST',
            headers: createAuthHeaders()
          });
          if (res.ok) {
            showToast(`Invoice ${invNum} finalized and revalued successfully.`, 'success');
            fetchInvoices();
            if (selectedInvoice && selectedInvoice.id === id) {
              const detailRes = await fetch(`${API_CONFIG.BASE_URL}/vendor-invoices/${id}`, {
                headers: createAuthHeaders()
              });
              if (detailRes.ok) {
                const data = await detailRes.json();
                setSelectedInvoice(data);
                fetchInvoiceDetails(data);
              }
            }
          } else {
            const err = await res.json();
            showToast(err.error || 'Financial Finalization failed.', 'error');
          }
        } catch (err) {
          console.error('Error finalizing invoice:', err);
          showToast('Financial Finalization failed due to a server error.', 'error');
        }
      },
      'Finalize',
      'Cancel',
      'danger'
    );
  };

  const handlePrintDirect = async (inv: Invoice) => {
    await fetchInvoiceDetails(inv);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const resetForm = () => {
    setSelectedVendor(null);
    setVendorSearch('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
    setSelectedGrnIds([]);
    setAvailableGrns([]);
    setInvoiceAmount('');
    setIsAmountManuallyEdited(false);
    setIsEditMode(false);
    setEditingInvoiceId(null);
    setEditingLineItems([]);
  };

  // Filter and Search logic for list
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // 1. Search Query
      const matchSearch = searchQuery === '' || 
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.vendor_name_snapshot.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.grn_numbers && inv.grn_numbers.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inv.project_names && inv.project_names.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // 2. Filters
      const matchVendor = filterVendor === '' || inv.vendor_id.toString() === filterVendor;
      
      let matchProject = true;
      if (filterProject !== '') {
        const proj = projects.find(p => p.id.toString() === filterProject);
        if (proj) {
          matchProject = inv.project_names?.toLowerCase().split(',').map(s => s.trim()).includes(proj.name.toLowerCase()) || false;
        }
      }
      
      const config = getWorkflowConfig(inv);
      const appStatus = config.approvalStatus;
      const payStatus = config.paymentStatus;
      
      const matchVStatus = filterVerificationStatus === '' || appStatus.toLowerCase() === filterVerificationStatus.toLowerCase();
      const matchPStatus = filterPaymentStatus === '' || payStatus.toLowerCase() === filterPaymentStatus.toLowerCase();
      
      const matchInvoiceNumber = filterInvoiceNumber === '' || inv.invoice_number.toLowerCase().includes(filterInvoiceNumber.toLowerCase());
      
      let matchDate = true;
      if (fromDate) {
        matchDate = matchDate && new Date(inv.invoice_date) >= new Date(fromDate);
      }
      if (toDate) {
        matchDate = matchDate && new Date(inv.invoice_date) <= new Date(toDate);
      }

      return matchSearch && matchVendor && matchProject && matchVStatus && matchPStatus && matchInvoiceNumber && matchDate;
    });
  }, [invoices, searchQuery, filterVendor, filterProject, filterVerificationStatus, filterPaymentStatus, filterInvoiceNumber, fromDate, toDate, projects]);

  // Summary Metrics calculations
  const summaryMetrics = useMemo(() => {
    let totalLiability = 0;
    let pendingApproval = 0;
    let approvedCount = 0;
    let finalizedCount = 0;
    let unpaidCount = 0;
    let partiallyPaidCount = 0;
    let paidCount = 0;

    invoices.forEach(inv => {
      const amt = Number(inv.invoice_amount) || 0;
      const config = getWorkflowConfig(inv);
      const appStatus = config.approvalStatus;
      const payStatus = config.paymentStatus;

      if (appStatus !== 'Cancelled') {
        totalLiability += amt;
      }
      if (appStatus === 'Draft') {
        pendingApproval++;
      } else if (appStatus === 'Approved') {
        approvedCount++;
      } else if (appStatus === 'Finalized') {
        finalizedCount++;
      }

      if (payStatus === 'Unpaid') {
        unpaidCount++;
      } else if (payStatus === 'Partial') {
        partiallyPaidCount++;
      } else if (payStatus === 'Paid') {
        paidCount++;
      }
    });

    return {
      totalInvoices: invoices.length,
      totalLiability,
      pendingApproval,
      approvedCount,
      finalizedCount,
      unpaidCount,
      partiallyPaidCount,
      paidCount
    };
  }, [invoices]);

  // Autocomplete filtered vendors
  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    return vendors.filter(v => v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase()));
  }, [vendors, vendorSearch]);

  // Grouped items calculations for Detail View
  const groupedItems = useMemo(() => {
    const groups: Record<string, {
      item_name: string;
      unit: string;
      total_quantity: number;
      lines: any[];
    }> = {};

    detailedItems.forEach(item => {
      const key = `${item.inventory_id}_${item.item_name}`;
      if (!groups[key]) {
        groups[key] = {
          item_name: item.item_name,
          unit: item.unit || 'Nos',
          total_quantity: 0,
          lines: []
        };
      }
      groups[key].total_quantity += Number(item.quantity) || 0;
      groups[key].lines.push(item);
    });

    return Object.values(groups);
  }, [detailedItems]);

  // Financial summary details
  const getGrnDiscountAmount = (grn: any) => {
    const subtotal = grn.total_amount || grn.items?.reduce((sum: number, it: any) => sum + (Number(it.total) || 0), 0) || 0;
    if (grn.discountType === 'PERCENTAGE') {
      return (subtotal * (Number(grn.discountValue) || 0)) / 100;
    }
    return Number(grn.discountValue) || 0;
  };

  const financialSummary = useMemo(() => {
    if (!selectedInvoice) return null;

    let materialTotal = 0;
    let totalDiscount = 0;
    let transportCharges = 0;
    let otherCharges = 0;
    let taxableAmount = 0;
    let gstAmount = 0;

    detailedGrns.forEach(grn => {
      const subtotal = Number(grn.total_amount) || 0;
      materialTotal += subtotal;

      const disc = getGrnDiscountAmount(grn);
      totalDiscount += disc;

      transportCharges += Number(grn.transportCharges) || 0;
      otherCharges += Number(grn.otherCharges) || 0;
    });

    taxableAmount = materialTotal - totalDiscount;

    // GST calculation
    detailedItems.forEach(item => {
      const lineAmt = (Number(item.quantity) * Number(item.rate)) || 0;
      const gstPct = Number(item.gst_percent) || 0;
      gstAmount += lineAmt * (gstPct / 100);
    });

    const finalInvoiceAmount = Number(selectedInvoice.invoice_amount) || 0;
    const variance = Number(selectedInvoice.variance) || 0;

    return {
      materialTotal,
      totalDiscount,
      transportCharges,
      otherCharges,
      taxableAmount,
      gstAmount,
      finalInvoiceAmount,
      variance
    };
  }, [selectedInvoice, detailedGrns, detailedItems]);

  const toggleItemExpansion = (key: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Mock functions for Print / Download placeholders
  const handlePrintPlaceholder = () => {
    window.print();
  };

  const handleDownloadPDFPlaceholder = () => {
    alert("PDF generation & download functionality (Coming Soon in Vendor Invoice Phase 3).");
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* INVOICE LIST VIEW                                             */}
      {/* ------------------------------------------------------------- */}
      {activeView === 'list' && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                <Receipt className="w-7 h-7 mr-3 text-blue-600 animate-pulse" />
                Accounts Payable Workspace
              </h1>
              <p className="text-slate-500 text-sm mt-1 font-medium">Record liability and audits of Vendor Invoices linked to Goods Receipts.</p>
            </div>
            {canCreateInvoice && (
              <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 flex items-center shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Vendor Invoice
              </button>
            )}
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Total Invoices</span>
              <div className="text-3xl font-black text-slate-900">{summaryMetrics.totalInvoices}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Active invoice documents</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Total Liability</span>
              <div className="text-3xl font-black text-slate-900">₹{summaryMetrics.totalLiability.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Sum of active invoices</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Pending Approval</span>
              <div className="text-3xl font-black text-amber-600">{summaryMetrics.pendingApproval}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Approval status: Draft</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Approved & Finalized</span>
              <div className="text-3xl font-black text-emerald-600">
                {summaryMetrics.approvedCount + summaryMetrics.finalizedCount}
              </div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Approved: {summaryMetrics.approvedCount} | Finalized: {summaryMetrics.finalizedCount}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Unpaid Invoices</span>
              <div className="text-3xl font-black text-red-600">{summaryMetrics.unpaidCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Liability pending payment</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Partially Paid</span>
              <div className="text-3xl font-black text-indigo-600">{summaryMetrics.partiallyPaidCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Partial payouts registered</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Fully Paid</span>
              <div className="text-3xl font-black text-emerald-600">{summaryMetrics.paidCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Zero balance liability</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow bg-slate-50/50">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Liability Variance</span>
              <div className="text-3xl font-black text-slate-700 flex items-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
                ₹{(invoices.reduce((sum, i) => sum + (Number(i.variance) || 0), 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <span className="text-[10px] text-slate-500 font-semibold mt-2">Invoice vs GRN variance sum</span>
            </div>
          </div>

          {/* Filters Area */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                <Search className="w-4 h-4 mr-2" /> Filter & Search Invoices
              </h3>
              <button 
                onClick={() => {
                  setSearchQuery(''); setFilterVendor(''); setFilterProject('');
                  setFilterVerificationStatus(''); setFilterPaymentStatus('');
                  setFilterInvoiceNumber(''); setFromDate(''); setToDate('');
                }}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center"
              >
                Reset Filters
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Global search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Invoice Number..."
                  value={filterInvoiceNumber}
                  onChange={(e) => setFilterInvoiceNumber(e.target.value)}
                  className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                />
              </div>

              <div>
                <select
                  value={filterVendor}
                  onChange={(e) => setFilterVendor(e.target.value)}
                  className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                >
                  <option value="">All Vendors</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.vendor_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                >
                  <option value="">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterVerificationStatus}
                  onChange={(e) => setFilterVerificationStatus(e.target.value)}
                  className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                >
                  <option value="">All Approval Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Approved">Approved</option>
                  <option value="Finalized">Finalized</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => setFilterPaymentStatus(e.target.value)}
                  className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                >
                  <option value="">All Payment Statuses</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <input
                  type="date"
                  placeholder="From Date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                />
              </div>

              <div>
                <input
                  type="date"
                  placeholder="To Date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-2 w-full bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Table Listing */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500 font-medium">Loading Invoices...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 text-[10px] uppercase font-bold tracking-widest">
                      <th className="px-6 py-4">Invoice details</th>
                      <th className="px-6 py-4">Vendor Details</th>
                      <th className="px-6 py-4 text-center">GRNs & Items</th>
                      <th className="px-6 py-4 text-right">Reference Sum (₹)</th>
                      <th className="px-6 py-4 text-right">Invoice Amount (₹)</th>
                      <th className="px-6 py-4 text-center">Variance (₹)</th>
                      <th className="px-6 py-4 text-center">Approval Status</th>
                      <th className="px-6 py-4 text-center">Payment Status</th>
                      <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-gray-400 font-medium">
                          No invoices found matching the search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const varianceStyles = getVarianceStyles(Number(inv.reference_amount), Number(inv.invoice_amount));
                        const config = getWorkflowConfig(inv);
                        const appStatus = config.approvalStatus;
                        const payStatus = config.paymentStatus;
                        
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/20 transition-colors group cursor-pointer" onClick={() => fetchInvoiceDetails(inv)}>
                            <td className="px-6 py-4">
                              <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center">
                                <Receipt className="w-4 h-4 mr-2 text-slate-400 group-hover:text-blue-500" />
                                {inv.invoice_number}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                Created: {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} By {inv.created_by}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{inv.vendor_name_snapshot}</div>
                              {inv.vendor_gst_snapshot && (
                                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                  GST: {inv.vendor_gst_snapshot}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="text-slate-800 font-bold">{inv.grn_count} GRN{inv.grn_count !== 1 ? 's' : ''}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">{inv.item_count} Item{inv.item_count !== 1 ? 's' : ''}</div>
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-slate-500">
                              ₹{Number(inv.reference_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">
                              ₹{Number(inv.invoice_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border text-xs font-bold ${varianceStyles.bg}`}>
                                <span>₹{Number(inv.variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                {Number(inv.reference_amount) > 0 && (
                                  <span className="text-[9px] opacity-80 mt-0.5">
                                    ({((Math.abs(Number(inv.variance)) / Number(inv.reference_amount)) * 100).toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                                appStatus === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                appStatus === 'Finalized' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                appStatus === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {appStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                                payStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                payStatus === 'Partial' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                'bg-red-50 text-red-700 border-red-200'
                              }`}>
                              {payStatus === 'Partial' ? 'PARTIALLY PAID' : payStatus === 'Paid' ? 'PAID' : 'UNPAID'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => fetchInvoiceDetails(inv)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="View Invoice Detail"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                
                                {config.isEditable && (
                                  <button
                                    onClick={() => handleStartEdit(inv)}
                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                    title="Edit Invoice"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}

                                {config.canApprove && (
                                  <button
                                    onClick={() => handleApprove(inv.id, inv.invoice_number)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    title="Approve Invoice"
                                  >
                                    <CheckSquare className="w-4 h-4" />
                                  </button>
                                )}

                                {config.canFinalize && (
                                  <button
                                    onClick={() => handleFinalize(inv.id, inv.invoice_number)}
                                    className="p-1.5 text-purple-650 hover:bg-purple-50 rounded-lg transition-all"
                                    title="Finalize Invoice"
                                  >
                                    <Zap className="w-4 h-4" />
                                  </button>
                                )}

                                {config.isDeletable && (
                                  <button
                                    onClick={() => handleDelete(inv.id, inv.invoice_number)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Delete Invoice"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}

                                {config.canPrint && (
                                  <button
                                    onClick={() => handlePrintDirect(inv)}
                                    className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                    title="Print Invoice"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* INVOICE DETAIL VIEW                                           */}
      {/* ------------------------------------------------------------- */}
      {activeView === 'detail' && selectedInvoice && (
        <div className="space-y-6 animate-fade-in" id="printable-invoice-detail">
          {/* Top Navigation / Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl border border-gray-200 shadow-sm print:hidden gap-4">
            <button 
              onClick={() => setActiveView('list')}
              className="flex items-center text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4 mr-1.5" />
              Back to Workspace
            </button>
            <div className="flex items-center space-x-3">
              {(() => {
                const config = getWorkflowConfig(selectedInvoice);
                return (
                  <>
                    {config.isEditable && (
                      <button 
                        onClick={() => handleStartEdit(selectedInvoice)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center shadow-lg shadow-blue-100"
                      >
                        Edit Invoice
                      </button>
                    )}
                    {config.canApprove && (
                      <button 
                        onClick={() => handleApprove(selectedInvoice.id, selectedInvoice.invoice_number)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center shadow-lg shadow-emerald-100"
                      >
                        Approve
                      </button>
                    )}
                    {config.canFinalize && (
                      <button 
                        onClick={() => handleFinalize(selectedInvoice.id, selectedInvoice.invoice_number)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all flex items-center shadow-lg shadow-purple-100"
                      >
                        Finalize
                      </button>
                    )}
                    {config.isDeletable && (
                      <button 
                        onClick={() => handleDelete(selectedInvoice.id, selectedInvoice.invoice_number)}
                        className="px-4 py-2 bg-red-650 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all flex items-center shadow-lg shadow-red-100"
                      >
                        Delete
                      </button>
                    )}
                  </>
                );
              })()}
              <button 
                onClick={handlePrintPlaceholder}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all flex items-center shadow-lg shadow-slate-100"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Details
              </button>
              <button 
                onClick={handleDownloadPDFPlaceholder}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center shadow-lg shadow-blue-100"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Download PDF
              </button>
              <button 
                onClick={() => setActiveView('list')}
                className="px-4 py-2 bg-white border border-gray-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>

          {/* Detailed Print Invoice Header (Visible only when printing) */}
          <div className="hidden print:flex justify-between items-center border-b pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900">BUILDCORE ERP</h1>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Vendor Invoice Audit Sheet</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-800">Invoice: {selectedInvoice.invoice_number}</h2>
              <p className="text-xs text-slate-500">Printed on: {new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          {loadingDetail ? (
            <div className="p-20 text-center bg-white rounded-2xl border border-gray-200">
              <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-4" />
              <div className="text-slate-500 font-bold">Loading detailed ERP invoice data...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column (Core Tables) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Section 1 – Invoice Information */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center">
                      <FileText className="w-4.5 h-4.5 text-blue-600 mr-2" />
                      Section 1: Invoice Information
                    </h3>
                    <div className="flex items-center space-x-2">
                      {(() => {
                        const config = getWorkflowConfig(selectedInvoice);
                        return (
                          <>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              config.approvalStatus === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              config.approvalStatus === 'Finalized' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              config.approvalStatus === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              Approval Status: {config.approvalStatus}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              config.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              config.paymentStatus === 'Partial' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              Payment Status: {config.paymentStatus === 'Partial' ? 'PARTIALLY PAID' : config.paymentStatus === 'Paid' ? 'PAID' : 'UNPAID'}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Invoice Number</span>
                      <span className="text-sm font-bold text-slate-800">{selectedInvoice.invoice_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vendor Name</span>
                      <span className="text-sm font-bold text-slate-800">{selectedInvoice.vendor_name_snapshot}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vendor GST</span>
                      <span className="text-sm font-bold text-blue-600">{selectedInvoice.vendor_gst_snapshot || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Invoice Date</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {new Date(selectedInvoice.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Invoice Amount</span>
                      <span className="text-sm font-bold text-slate-900">₹{Number(selectedInvoice.invoice_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Amount Paid</span>
                      <span className="text-sm font-bold text-emerald-600">₹{Number(selectedInvoice.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pending Amount</span>
                      <span className="text-sm font-bold text-amber-600">₹{Number(selectedInvoice.pending_amount !== undefined ? selectedInvoice.pending_amount : Number(selectedInvoice.invoice_amount) - Number(selectedInvoice.amount_paid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Reference GRN Sum</span>
                      <span className="text-sm font-semibold text-slate-600">₹{Number(selectedInvoice.reference_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Variance</span>
                      <span className={`text-sm font-bold ${Number(selectedInvoice.variance) === 0 ? 'text-slate-800' : Number(selectedInvoice.variance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₹{Number(selectedInvoice.variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Remarks</span>
                      <span className="text-sm text-slate-600 font-medium italic block mt-0.5">
                        "{selectedInvoice.remarks || 'No internal remarks provided'}"
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2 – Linked GRNs */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase border-b pb-3 flex items-center">
                    <Building2 className="w-4.5 h-4.5 text-blue-600 mr-2" />
                    Section 2: Linked Goods Receipts (GRNs)
                  </h3>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-2.5">GRN Number</th>
                          <th className="px-4 py-2.5">Receipt Date</th>
                          <th className="px-4 py-2.5">Project</th>
                          <th className="px-4 py-2.5 text-right">GRN Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs font-medium">
                        {detailedGrns.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-slate-400 font-medium">
                              No linked GRN details loaded.
                            </td>
                          </tr>
                        ) : (
                          detailedGrns.map((grn) => (
                            <tr key={grn.id} className="hover:bg-slate-50/40">
                              <td className="px-4 py-3 font-bold text-slate-900">{grn.grn_number}</td>
                              <td className="px-4 py-3 text-slate-500">
                                {new Date(grn.grn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-slate-700 uppercase">{grn.projectName || 'Central Store'}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">
                                ₹{Number(grn.finalAmount || grn.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3 – Invoice Items (Prototype) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center">
                      <Receipt className="w-4.5 h-4.5 text-blue-600 mr-2" />
                      Section 3: Invoice Items (Audit Prototype)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">
                      Items loaded exactly as received on the linked GRNs. Click a row to audit detailed GRN origins.
                    </p>
                  </div>

                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3">Item Name</th>
                          <th className="px-6 py-3">Unit</th>
                          <th className="px-6 py-3 text-center">Total Quantity</th>
                          <th className="px-6 py-3 text-center">Details</th>
                          <th className="px-6 py-3 text-right">Line Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {groupedItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-6 text-center text-slate-400 font-semibold">
                              No items found in linked GRNs.
                            </td>
                          </tr>
                        ) : (
                          groupedItems.map((group, idx) => {
                            const groupKey = `${group.item_name}_${idx}`;
                            const isExpanded = !!expandedItems[groupKey];
                            const groupAmount = group.lines.reduce((sum, line) => sum + (Number(line.quantity) * Number(line.rate) || 0), 0);

                            return (
                              <React.Fragment key={groupKey}>
                                <tr 
                                  onClick={() => toggleItemExpansion(groupKey)}
                                  className="hover:bg-blue-50/10 cursor-pointer font-semibold transition-colors"
                                >
                                  <td className="px-6 py-4 text-slate-900 flex items-center">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 mr-2 text-slate-500" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 mr-2 text-slate-500" />
                                    )}
                                    {group.item_name}
                                  </td>
                                  <td className="px-6 py-4 text-slate-500 font-medium">{group.unit}</td>
                                  <td className="px-6 py-4 text-center text-slate-800 font-bold">{group.total_quantity}</td>
                                  <td className="px-6 py-4 text-center text-blue-600 font-bold">
                                    {group.lines.length} receipt{group.lines.length !== 1 ? 's' : ''}
                                  </td>
                                  <td className="px-6 py-4 text-right font-black text-slate-900">
                                    ₹{groupAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr>
                                    <td colSpan={5} className="p-0 bg-slate-50/50">
                                      <div className="px-6 py-4 border-t border-b border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">GRN Receipt Lines Details</h4>
                                        <div className="border border-slate-200/80 rounded-lg overflow-hidden bg-white">
                                          <table className="w-full text-left border-collapse text-[11px]">
                                            <thead className="bg-slate-100/50 text-[9px] font-black uppercase text-slate-500 border-b">
                                              <tr>
                                                <th className="px-3 py-2">Receipt Document #</th>
                                                <th className="px-3 py-2">Receipt Date</th>
                                                <th className="px-3 py-2 text-center">Quantity</th>
                                                <th className="px-3 py-2 text-right">Estimated Rate</th>
                                                <th className="px-3 py-2 text-center">GST %</th>
                                                <th className="px-3 py-2 text-right">Estimated Subtotal</th>
                                                <th className="px-3 py-2 text-right">Estimated Total</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                              {group.lines.map((line, lIdx) => {
                                                const subtotal = (Number(line.quantity) * Number(line.rate)) || 0;
                                                const gstPct = Number(line.gst_percent) || 0;
                                                const lineGst = subtotal * (gstPct / 100);
                                                const lineTotal = subtotal + lineGst;

                                                return (
                                                  <tr key={lIdx} className="hover:bg-slate-50/30">
                                                    <td className="px-3 py-2 font-bold text-slate-900">{line.grn_number}</td>
                                                    <td className="px-3 py-2 text-slate-500">
                                                      {new Date(line.grn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-semibold text-slate-900">{line.quantity}</td>
                                                    <td className="px-3 py-2 text-right font-mono">₹{Number(line.rate).toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-center text-slate-600">{gstPct}%</td>
                                                    <td className="px-3 py-2 text-right font-mono text-slate-600">₹{subtotal.toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">₹{lineTotal.toFixed(2)}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
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
                </div>
              </div>

              {/* Right Column (Sidebar Analytics & Summaries) */}
              <div className="space-y-6">
                {/* Section 4 – Financial Summary */}
                {financialSummary && (
                  <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                    <h3 className="text-sm font-black tracking-tight uppercase border-b border-slate-800 pb-3 flex items-center text-slate-200">
                      <Receipt className="w-4.5 h-4.5 text-blue-500 mr-2 animate-bounce" />
                      Section 4: Financial Summary
                    </h3>

                    <div className="space-y-3.5 text-xs font-semibold text-slate-300">
                      <div className="flex justify-between">
                        <span>Material Total (Taxable Items)</span>
                        <span className="font-mono text-white">₹{financialSummary.materialTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>Discount Deductions</span>
                        <span className="font-mono">- ₹{financialSummary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transport Charges</span>
                        <span className="font-mono text-white">₹{financialSummary.transportCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Other Charges</span>
                        <span className="font-mono text-white">₹{financialSummary.otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="border-t border-slate-800 my-2"></div>
                      <div className="flex justify-between text-slate-200 text-sm font-bold">
                        <span>Taxable Amount</span>
                        <span className="font-mono text-white">₹{financialSummary.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-blue-400">
                        <span>GST Tax Amount</span>
                        <span className="font-mono">₹{financialSummary.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="border-t border-slate-800 my-2"></div>
                      <div className="flex justify-between text-slate-200 text-sm font-bold bg-slate-850 p-2.5 rounded-xl border border-slate-800">
                        <span>Final Invoice Amount</span>
                        <span className="font-mono text-blue-400 text-base font-black">₹{financialSummary.finalInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-200 font-bold pt-2">
                        <span>Variance</span>
                        <span className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-black ${
                          financialSummary.variance === 0 ? 'bg-slate-800 text-slate-300 border-slate-700' :
                          financialSummary.variance > 0 ? 'bg-red-950 text-red-400 border-red-900' :
                          'bg-emerald-950 text-emerald-400 border-emerald-900'
                        }`}>
                          ₹{financialSummary.variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 5 – Future Placeholders (Disabled Cards) */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest print:hidden">
                    Future Modules (Placeholders)
                  </h4>

                  {/* Payment History Placeholder */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-start gap-4 opacity-60 relative group overflow-hidden cursor-not-allowed print:hidden select-none">
                    <div className="p-3 bg-slate-200 rounded-xl text-slate-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
                        Payment History
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-200 text-[8px] font-black text-slate-500 rounded">COMING SOON</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">Track accounts payouts, payment voucher lineage, and banking reconciliation sheets.</p>
                    </div>
                  </div>

                  {/* Attachments Placeholder */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-start gap-4 opacity-60 relative group overflow-hidden cursor-not-allowed print:hidden select-none">
                    <div className="p-3 bg-slate-200 rounded-xl text-slate-400">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
                        Attachments Archive
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-200 text-[8px] font-black text-slate-500 rounded">COMING SOON</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">Upload invoice scanned copies, vendor challans, and validation documents.</p>
                    </div>
                  </div>

                  {/* Audit Trail Placeholder */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-start gap-4 opacity-60 relative group overflow-hidden cursor-not-allowed print:hidden select-none">
                    <div className="p-3 bg-slate-200 rounded-xl text-slate-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
                        Audit & Verification logs
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-200 text-[8px] font-black text-slate-500 rounded">COMING SOON</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">Timeline traces of CEO validations, invoice corrections, and internal status changes.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ------------------------------------------------------------- */}
      {/* CREATION DRAWER / DIALOG MODAL (UNCHANGED CORE WORKFLOW)       */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-blue-600" />
                {isEditMode ? 'Edit Vendor Invoice' : 'Record Vendor Invoice'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Header Inputs Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/40 p-5 rounded-2xl border border-slate-100">
                  
                  {/* Searchable Vendor Autocomplete Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Vendor <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Type to search Vendor..."
                        value={vendorSearch}
                        disabled={isEditMode}
                        onChange={(e) => {
                          setVendorSearch(e.target.value);
                          setShowVendorDropdown(true);
                          if (selectedVendor && e.target.value !== selectedVendor.vendor_name) {
                            setSelectedVendor(null);
                            setSelectedGrnIds([]);
                            setAvailableGrns([]);
                            setInvoiceAmount('');
                          }
                        }}
                        onFocus={() => !isEditMode && setShowVendorDropdown(true)}
                        className={`w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium bg-white ${isEditMode ? 'cursor-not-allowed opacity-60' : ''}`}
                      />
                      {!isEditMode && <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />}
                    </div>

                    {showVendorDropdown && !isEditMode && filteredVendors.length > 0 && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar animate-fade-in">
                        {filteredVendors.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleVendorSelect(v)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50/50 flex items-center justify-between border-b border-gray-50 last:border-0 font-medium"
                          >
                            <span className="text-slate-800">{v.vendor_name}</span>
                            {selectedVendor?.id === v.id && <Check className="w-4 h-4 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Read-Only GST Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Vendor GST (Auto-fetched)
                    </label>
                    <input 
                      type="text"
                      readOnly
                      value={selectedVendor?.gst_number || 'TBD'}
                      className="w-full px-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm text-slate-500 font-bold uppercase tracking-wide cursor-not-allowed"
                    />
                  </div>

                  {/* Invoice Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. INV-2026-009"
                      value={invoiceNumber}
                      disabled={isEditMode}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className={`w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold ${isEditMode ? 'cursor-not-allowed opacity-60 bg-gray-50' : ''}`}
                    />
                  </div>

                  {/* Invoice Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Remarks / Notes (Optional)
                    </label>
                    <textarea 
                      placeholder="Provide internal notes, accounting details, etc."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Line Items Editor or GRNs Grid Section */}
                {isEditMode ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-slate-900 tracking-tight">
                      Edit Invoice Line Items
                    </h4>
                    <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                          <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <th className="px-4 py-2">Item Name</th>
                            <th className="px-4 py-2">Unit</th>
                            <th className="px-4 py-2 text-right">Est. Rate (₹)</th>
                            <th className="px-4 py-2 text-center w-24">Billed Qty</th>
                            <th className="px-4 py-2 text-center w-28">Confirmed Rate (₹)</th>
                            <th className="px-4 py-2 text-right">Line Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs font-medium">
                          {editingLineItems.map((item, index) => {
                            const qty = parseFloat(item.billed_quantity) || 0;
                            const rate = parseFloat(item.confirmed_rate) || 0;
                            const gst = parseFloat(item.gst_amount) || 0;
                            const disc = parseFloat(item.discount_amount) || 0;
                            const lineTotal = (qty * rate) + gst - disc;
                            
                            return (
                              <tr key={item.id || index} className="hover:bg-slate-50/20">
                                <td className="px-4 py-3 font-bold text-slate-800">{item.item_name}</td>
                                <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                                <td className="px-4 py-3 text-right text-slate-650">₹{parseFloat(item.estimated_rate).toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required
                                    value={item.billed_quantity}
                                    onChange={(e) => {
                                      const newLines = [...editingLineItems];
                                      newLines[index].billed_quantity = e.target.value;
                                      setEditingLineItems(newLines);
                                      
                                      if (!isAmountManuallyEdited) {
                                        const refSum = newLines.reduce((sum, line) => {
                                          const q = parseFloat(line.billed_quantity) || 0;
                                          const r = parseFloat(line.confirmed_rate) || 0;
                                          const g = parseFloat(line.gst_amount) || 0;
                                          const d = parseFloat(line.discount_amount) || 0;
                                          return sum + (q * r) + g - d;
                                        }, 0);
                                        setInvoiceAmount(refSum > 0 ? refSum.toFixed(2) : '');
                                      }
                                    }}
                                    className="w-20 px-2 py-1 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    step="0.000001"
                                    min="0.00"
                                    required
                                    value={item.confirmed_rate}
                                    onChange={(e) => {
                                      const newLines = [...editingLineItems];
                                      newLines[index].confirmed_rate = e.target.value;
                                      setEditingLineItems(newLines);
                                      
                                      if (!isAmountManuallyEdited) {
                                        const refSum = newLines.reduce((sum, line) => {
                                          const q = parseFloat(line.billed_quantity) || 0;
                                          const r = parseFloat(line.confirmed_rate) || 0;
                                          const g = parseFloat(line.gst_amount) || 0;
                                          const d = parseFloat(line.discount_amount) || 0;
                                          return sum + (q * r) + g - d;
                                        }, 0);
                                        setInvoiceAmount(refSum > 0 ? refSum.toFixed(2) : '');
                                      }
                                    }}
                                    className="w-24 px-2 py-1 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800">
                                  ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center">
                        Select Available Goods Receipts (GRNs)
                        {selectedVendor && (
                          <span className="ml-2.5 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold border border-blue-100">
                            {availableGrns.length} Available
                          </span>
                        )}
                      </h4>
                      {availableGrns.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSelectAllGrns}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          {selectedGrnIds.length === availableGrns.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>

                    {!selectedVendor ? (
                      <div className="p-8 text-center text-slate-400 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-xs font-medium">
                        Select a vendor above to fetch its uninvoiced GRNs.
                      </div>
                    ) : availableGrns.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-xs font-medium">
                        No uninvoiced GRNs found for this vendor.
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                            <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                              <th className="px-4 py-2 text-center w-12">Select</th>
                              <th className="px-4 py-2">GRN Number</th>
                              <th className="px-4 py-2">Receipt Date</th>
                              <th className="px-4 py-2">Project</th>
                              <th className="px-4 py-2 text-right">Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-xs font-medium">
                            {availableGrns.map(g => (
                              <tr 
                                key={g.id} 
                                className={`hover:bg-blue-50/20 transition-colors cursor-pointer ${selectedGrnIds.includes(g.id) ? 'bg-blue-50/10' : ''}`}
                                onClick={() => handleToggleGrn(g.id)}
                              >
                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedGrnIds.includes(g.id)}
                                    onChange={() => handleToggleGrn(g.id)}
                                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-850">{g.grn_number}</td>
                                <td className="px-4 py-3 text-slate-500">
                                  {new Date(g.grn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-3 text-slate-650 uppercase">{g.projectName || 'Central Store'}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800">
                                  ₹{Number(g.finalAmount || g.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Financial Summary & Live Variance Panel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 bg-gray-50/50 p-5 rounded-2xl">
                  
                  {/* Reference Sum Panel */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Reference Sum (GRNs)
                    </span>
                    <div className="text-xl font-black text-slate-800 mt-2">
                      ₹{referenceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                      {isEditMode ? `${editingLineItems.length} items editing` : `${selectedGrnIds.length} GRN(s) selected`}
                    </span>
                  </div>

                  {/* Invoice Amount Input Panel */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      Invoice Amount (₹) <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={invoiceAmount}
                      onChange={(e) => {
                        setInvoiceAmount(e.target.value);
                        setIsAmountManuallyEdited(true);
                      }}
                      className="text-lg font-black text-slate-900 mt-1 pb-1 border-b border-gray-200 outline-none focus:border-blue-500 focus:ring-0 w-full"
                    />
                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                      Input invoice billing total
                    </span>
                  </div>

                  {/* Live Variance Panel */}
                  <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-all duration-300 ${
                    getVarianceStyles(referenceAmount, currentInvoiceAmount).bg
                  }`}>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                      Live Variance Alert
                    </span>
                    <div className="text-xl font-black mt-2">
                      ₹{currentVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {referenceAmount > 0 && (
                        <span className="text-xs font-bold ml-1.5 opacity-90 font-mono">
                          ({currentVariance >= 0 ? '+' : ''}{((currentVariance / referenceAmount) * 100).toFixed(2)}%)
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold mt-1 flex items-center">
                      {currentVariance !== 0 ? (
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      )}
                      {getVarianceStyles(referenceAmount, currentInvoiceAmount).label}
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedVendor || (!isEditMode && !selectedGrnIds.length) || invoiceAmount === ''}
                    className="flex-[2] px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
                  >
                    {submitting ? (isEditMode ? 'Saving Changes...' : 'Creating Invoice...') : (isEditMode ? 'Save Changes' : 'Save & Link GRNs')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification component */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[9999] flex items-center p-4 rounded-xl border shadow-xl max-w-sm transition-all duration-300 animate-slide-in bg-white ${
          toast.type === 'success' ? 'border-emerald-250 text-emerald-800 bg-emerald-50' :
          toast.type === 'error' ? 'border-red-250 text-red-800 bg-red-50' :
          'border-amber-250 text-amber-800 bg-amber-50'
        }`}>
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 mr-3 text-red-600 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 mr-3 text-amber-600 shrink-0" />}
          <div className="text-sm font-bold flex-1">{toast.message}</div>
          <button 
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Custom Confirmation Dialog Modal component */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scale-up border border-slate-100">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3 text-slate-900">
                {confirmDialog.type === 'danger' ? (
                  <div className="p-2 bg-red-50 text-red-650 rounded-xl">
                    <AlertCircle className="w-6 h-6 animate-bounce" />
                  </div>
                ) : confirmDialog.type === 'success' ? (
                  <div className="p-2 bg-emerald-50 text-emerald-650 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 animate-pulse" />
                  </div>
                ) : (
                  <div className="p-2 bg-blue-50 text-blue-650 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                )}
                <h3 className="text-lg font-black tracking-tight">{confirmDialog.title}</h3>
              </div>
              <p className="text-slate-500 text-sm font-medium leading-relaxed whitespace-pre-line">
                {confirmDialog.message}
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end space-x-3 border-t border-slate-100">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-white border border-gray-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all active:scale-95"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={async () => {
                  const callback = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await callback();
                }}
                className={`px-4 py-2 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg ${
                  confirmDialog.type === 'danger'
                    ? 'bg-red-600 hover:bg-red-750 shadow-red-100'
                    : confirmDialog.type === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled slide-in keyframes block */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(100%) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
