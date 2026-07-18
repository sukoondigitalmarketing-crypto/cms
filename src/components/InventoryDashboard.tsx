import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, ArrowDownRight, Search, X, Edit, Trash2 } from 'lucide-react';
import { API_CONFIG, ROLE_PERMISSIONS } from '../config';
import { canEdit, hasPermission } from '../rbac';
import { createAuthHeaders } from '../services/api';
import { FilterBar } from './common/FilterBar';
import { useAdaptivePolling } from '../hooks/useAdaptivePolling';
import { SearchableSelect } from './common/SearchableSelect';
import { toMaterialOptions } from '../lib/search/materialOption';

interface InventoryDashboardProps {
  role: string;
}

export function InventoryDashboard({ role }: InventoryDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'issues' | 'additions'>('inventory');
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSubCategory, setFilterSubCategory] = useState('All');
  const [issues, setIssues] = useState<any[]>([]);
  const [additions, setAdditions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedBatchItem, setSelectedBatchItem] = useState<any>(null);
  const [itemBatches, setItemBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [selectedIssueToRevert, setSelectedIssueToRevert] = useState<any>(null);
  const [revertReason, setRevertReason] = useState('');
  const [isReverting, setIsReverting] = useState(false);

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [remarks, setRemarks] = useState('');

  const [selectedItemId, setSelectedItemId] = useState('');
  const [issueQty, setIssueQty] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [issueRemarks, setIssueRemarks] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  const [isIssuing, setIsIssuing] = useState(false);
  const [qtyError, setQtyError] = useState<string | null>(null);

  // 📦 Update Opening Stock State
  const [isOpeningStockModalOpen, setIsOpeningStockModalOpen] = useState(false);
  const [osItemId, setOsItemId] = useState('');
  const [osQuantity, setOsQuantity] = useState('');
  const [osUnitCost, setOsUnitCost] = useState('');
  const [osDate, setOsDate] = useState(new Date().toISOString().split('T')[0]);
  const [osReason, setOsReason] = useState('');
  const [isSubmittingOpeningStock, setIsSubmittingOpeningStock] = useState(false);

  // 📝 Multi-Item Voucher State
  const [voucherItems, setVoucherItems] = useState<{
    inventory_id: string;
    quantity_issued: string;
    expected_issue_rate?: number;
    expected_total_cost?: number;
    remaining_unfulfilled?: number;
  }[]>([]);
  const estimateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [isVoucherDetailOpen, setIsVoucherDetailOpen] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'items' | 'vouchers'>('vouchers');

  // Filtering States
  const [additionsFilters, setAdditionsFilters] = useState({ search: '', fromDate: '', toDate: '' });
  const [issuesFilters, setIssuesFilters] = useState({ search: '', fromDate: '', toDate: '' });

  // Master Data States
  const [masterCategories, setMasterCategories] = useState<any[]>([]);
  const [masterUnits, setMasterUnits] = useState<any[]>([]);
  const [masterVendors, setMasterVendors] = useState<any[]>([]);
  const [masterProjects, setMasterProjects] = useState<any[]>([]);

  const uniqueIssuedTo = useMemo(() => {
    const names = issues.map(i => i.issued_to).filter(Boolean);
    const uniqueNames = Array.from(new Set(names.map(n => n.trim().toLowerCase())));
    return uniqueNames.map(n => names.find((original: string) => original.trim().toLowerCase() === n) || n).sort();
  }, [issues]);

  const QUICK_PURPOSES = ["Shuttering", "Electrical", "Plumbing", "Civil Work", "Finishing", "Repair"];

  const categoryNames = useMemo(() => {
    const names = new Set(masterCategories.map(c => c.category_name));
    return Array.from(names);
  }, [masterCategories]);

  const subCategoryMapping = useMemo(() => {
    const mapping: Record<string, string[]> = {};
    masterCategories.forEach(c => {
      if (!mapping[c.category_name]) mapping[c.category_name] = [];
      if (c.sub_category_name && !mapping[c.category_name].includes(c.sub_category_name)) {
        mapping[c.category_name].push(c.sub_category_name);
      }
    });
    return mapping;
  }, [masterCategories]);

  const permissions = ROLE_PERMISSIONS[role] || {};
  const canManageInventory = hasPermission(role, 'inventory', 'create');
  const canModifyInventory = canEdit(role, 'inventory');
  const canRevert = hasPermission(role, 'inventory', 'rollback');

  useEffect(() => {
    if (category && subCategoryMapping[category]) {
      const validSubs = subCategoryMapping[category];
      if (validSubs.length > 0 && !validSubs.includes(subCategory)) {
        setSubCategory(validSubs[0]); // Auto-select first valid sub-category
      }
    }
  }, [category, subCategoryMapping]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      const matchesSubCategory = filterSubCategory === 'All' || item.sub_category === filterSubCategory;
      return matchesSearch && matchesCategory && matchesSubCategory;
    });
  }, [inventory, searchTerm, filterCategory, filterSubCategory]);

  const fetchData = async () => {
    try {
      const headers = createAuthHeaders();
      const additionsParams = new URLSearchParams();
      if (additionsFilters.search) additionsParams.append('search', additionsFilters.search);
      if (additionsFilters.fromDate) additionsParams.append('from_date', additionsFilters.fromDate);
      if (additionsFilters.toDate) additionsParams.append('to_date', additionsFilters.toDate);

      const issuesParams = new URLSearchParams();
      if (issuesFilters.search) issuesParams.append('search', issuesFilters.search);
      if (issuesFilters.fromDate) issuesParams.append('from_date', issuesFilters.fromDate);
      if (issuesFilters.toDate) issuesParams.append('to_date', issuesFilters.toDate);

      const [invRes, issueRes, additionsRes, projectsRes, categoryRes, unitRes, vendorRes, vouchersRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/inventory`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/inventory/issues?${issuesParams.toString()}`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/inventory/additions?${additionsParams.toString()}`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/projects`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/categories`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/units`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/vendors`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/inventory/vouchers?${issuesParams.toString()}`, { headers })
      ]);

      if (invRes.ok) setInventory(await invRes.json());
      if (issueRes.ok) setIssues(await issueRes.json());
      if (additionsRes.ok) setAdditions(await additionsRes.json());
      if (projectsRes.ok) setMasterProjects(await projectsRes.json());
      if (categoryRes.ok) setMasterCategories(await categoryRes.json());
      if (unitRes.ok) setMasterUnits(await unitRes.json());
      if (vendorRes.ok) setMasterVendors(await vendorRes.json());
      if (vouchersRes.ok) setVouchers(await vouchersRes.json());
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async (item: any) => {
    setLoadingBatches(true);
    setSelectedBatchItem(item);
    setIsBatchModalOpen(true);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/inventory/${item.id}/batches`, {
        headers: createAuthHeaders()
      });
      if (res.ok) setItemBatches(await res.json());
      else console.error('Batches Fetch Failed');
    } catch (e) {
      console.error('Batch fetch error:', e);
    } finally {
      setLoadingBatches(false);
    }
  };

  useAdaptivePolling(fetchData, { delay: 30000 }, [additionsFilters, issuesFilters]);

  const resetForm = () => {
    setItemName('');
    setCategory('');
    setSubCategory('');
    setUnit('');
    setQuantity('');
    setPricePerUnit('');
    setSupplier('');
    setRemarks('');
    setEditingItem(null);
  };

  const triggerBatchEstimate = (updatedItems: typeof voucherItems) => {
    // Cancel any pending debounced triggers
    if (estimateTimeoutRef.current) {
      clearTimeout(estimateTimeoutRef.current);
    }

    // Debounce the call (400ms)
    estimateTimeoutRef.current = setTimeout(async () => {
      // Abort any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const validItems = updatedItems
        .filter(item => item.inventory_id && parseFloat(item.quantity_issued) > 0)
        .map(item => ({
          inventory_id: parseInt(item.inventory_id),
          quantity: parseFloat(item.quantity_issued)
        }));

      if (validItems.length === 0) return;

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        const headers = createAuthHeaders();
        const response = await fetch(`${API_CONFIG.BASE_URL}/inventory/issue-estimate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            voucher: {
              items: validItems
            }
          }),
          signal
        });

        if (response.ok) {
          const { estimates } = await response.json();
          setVoucherItems(prev =>
            prev.map(item => {
              const est = estimates.find((e: any) => e.inventory_id === parseInt(item.inventory_id));
              if (est && !est.error) {
                return {
                  ...item,
                  expected_issue_rate: est.expected_issue_rate,
                  expected_total_cost: est.expected_total_cost,
                  remaining_unfulfilled: est.remaining_unfulfilled
                };
              }
              // If not selected/valid, clear estimations
              if (!item.inventory_id || !parseFloat(item.quantity_issued)) {
                return {
                  ...item,
                  expected_issue_rate: undefined,
                  expected_total_cost: undefined,
                  remaining_unfulfilled: undefined
                };
              }
              return item;
            })
          );
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch MIV cost estimates:', err);
        }
      }
    }, 400);
  };

  const resetIssueForm = () => {
    if (estimateTimeoutRef.current) clearTimeout(estimateTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setSelectedProjectId('');
    setIssuedTo('');
    setIssueRemarks('');
    setIssueDate(new Date().toISOString().split('T')[0]);
    setVoucherItems([{ inventory_id: '', quantity_issued: '' }]);
    setQtyError(null);
    setIsIssuing(false);
  };

  const addVoucherItem = () => {
    setVoucherItems([...voucherItems, { inventory_id: '', quantity_issued: '' }]);
  };

  const removeVoucherItem = (index: number) => {
    const updated = voucherItems.filter((_, i) => i !== index);
    setVoucherItems(updated);
    triggerBatchEstimate(updated);
  };

  const updateVoucherItem = (index: number, field: string, value: string) => {
    const newItems = [...voucherItems];
    (newItems[index] as any)[field] = value;

    // Clear estimates when selection or quantity changes
    if (field === 'inventory_id' || field === 'quantity_issued') {
      newItems[index].expected_issue_rate = undefined;
      newItems[index].expected_total_cost = undefined;
      newItems[index].remaining_unfulfilled = undefined;
      triggerBatchEstimate(newItems);
    }

    setVoucherItems(newItems);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setItemName(item.item_name);
    setCategory(item.category);
    setSubCategory(item.sub_category);
    setUnit(item.unit);
    setQuantity(item.quantity.toString());
    setPricePerUnit(item.price_per_unit.toString());
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !category || !unit) {
      alert('Item Name, Category, and Unit are required.');
      return;
    }

    const inventoryData = {
      item_name: itemName,
      category,
      sub_category: subCategory,
      unit
    };

    try {
      const url = editingItem 
        ? `${API_CONFIG.BASE_URL}/inventory/${editingItem.id}` 
        : `${API_CONFIG.BASE_URL}/inventory/add`;
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: createAuthHeaders(true),
        body: JSON.stringify(inventoryData),
      });

      if (!response.ok) throw new Error('Action failed');
      setIsModalOpen(false);
      resetForm();
      fetchData();
      alert('Inventory item saved successfully!');
    } catch (error) {
      alert('Operation failed. Check server connection.');
    }
  };

  const resetOpeningStockForm = () => {
    setOsItemId('');
    setOsQuantity('');
    setOsUnitCost('');
    setOsDate(new Date().toISOString().split('T')[0]);
    setOsReason('');
    setIsSubmittingOpeningStock(false);
  };

  const handleOpeningStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingOpeningStock) return;

    const qty = parseFloat(osQuantity);
    const cost = parseFloat(osUnitCost);
    if (!osItemId) { alert('Please select an inventory item.'); return; }
    if (isNaN(qty) || qty <= 0) { alert('Quantity must be greater than zero.'); return; }
    if (isNaN(cost) || cost <= 0) { alert('Unit cost must be greater than zero.'); return; }
    if (!osReason.trim()) { alert('A reason is required for opening stock.'); return; }

    setIsSubmittingOpeningStock(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/inventory/opening-stock`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          inventory_id: osItemId,
          quantity: qty,
          unit_cost: cost,
          received_date: osDate,
          reason: osReason.trim()
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to record opening stock');
      }

      setIsOpeningStockModalOpen(false);
      resetOpeningStockForm();
      fetchData();
      alert('Opening stock recorded successfully!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmittingOpeningStock(false);
    }
  };

  const handleIssueMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isIssuing) return;

    if (!selectedProjectId || !issuedTo || voucherItems.length === 0) {
      alert('Please fill out all required fields.');
      return;
    }

    // Validation
    for (const item of voucherItems) {
      if (!item.inventory_id || !item.quantity_issued) {
        alert('All line items must have a material and quantity.');
        return;
      }
      const qty = parseFloat(item.quantity_issued);
      if (isNaN(qty) || qty <= 0) {
        alert('Quantities must be greater than zero.');
        return;
      }
      const invItem = inventory.find(i => i.id === parseInt(item.inventory_id));
      if (invItem && qty > invItem.quantity) {
        alert(`Insufficient stock for ${invItem.item_name}. Available: ${invItem.quantity}`);
        return;
      }
    }

    setIsIssuing(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/inventory/voucher`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          project_id: selectedProjectId,
          issued_to: issuedTo.trim(),
          issue_date: issueDate,
          purpose: remarks, // Using remarks as purpose for now or add purpose state
          remarks: issueRemarks,
          items: voucherItems
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Voucher issue failed');
      }

      setIsIssueModalOpen(false);
      resetIssueForm();
      fetchData();
      alert('Material Issue Voucher created successfully!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsIssuing(false);
    }
  };

  const openVoucherDetail = async (voucher: any) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/inventory/vouchers/${voucher.id}`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        setSelectedVoucher(await res.json());
        setIsVoucherDetailOpen(true);
      }
    } catch (e) {
      alert('Failed to load voucher details');
    }
  };

  const handleRevertVoucher = async (id: number, reason: string) => {
    if (!reason) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/inventory/vouchers/revert/${id}`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        alert('Voucher reverted successfully');
        setIsVoucherDetailOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      alert('Revert failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await fetch(`${API_CONFIG.BASE_URL}/inventory/${id}`, {
          method: 'DELETE',
          headers: createAuthHeaders()
        });
        fetchData();
      } catch (error) {
        alert('Delete failed');
      }
    }
  };

  if (loading && inventory.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory System</h1>
          <p className="text-gray-500 text-sm mt-1">Manage stock and issue materials to projects.</p>
        </div>
        <div className="flex space-x-3">
          {canManageInventory && (
            <>
              <button 
                onClick={() => { resetIssueForm(); setIsIssueModalOpen(true); }}
                className="px-4 py-2 bg-amber-600 rounded-lg text-sm font-medium text-white hover:bg-amber-700 flex items-center shadow-sm"
              >
                <ArrowDownRight className="w-4 h-4 mr-2" />
                Issue Material
              </button>
              <button
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 flex items-center shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Register New Material
              </button>
              <button
                onClick={() => { resetOpeningStockForm(); setIsOpeningStockModalOpen(true); }}
                className="px-4 py-2 bg-slate-700 rounded-lg text-sm font-medium text-white hover:bg-slate-800 flex items-center shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Update Opening Stock
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button 
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'inventory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveSubTab('inventory')}
        >
          Stock Inventory
        </button>
        <button 
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'additions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveSubTab('additions')}
        >
          Add Item History
        </button>
        <button 
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeSubTab === 'issues' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveSubTab('issues')}
        >
          Material Issue History
        </button>
      </div>

      {activeSubTab === 'inventory' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Current Stock</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Item Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setFilterSubCategory('All');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Categories</option>
                {categoryNames.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {filterCategory !== 'All' && (
                <select
                  value={filterSubCategory}
                  onChange={(e) => setFilterSubCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="All">All Sub Categories</option>
                  {subCategoryMapping[filterCategory]?.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              )}
              {(searchTerm || filterCategory !== 'All' || filterSubCategory !== 'All') && (
                <button
                  onClick={() => { setSearchTerm(''); setFilterCategory('All'); setFilterSubCategory('All'); }}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center"
                >
                  <X className="w-4 h-4 mr-1" /> Clear
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Item Name</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Sub Category</th>
                  <th className="px-6 py-4 font-medium">Stock Details</th>
                  <th className="px-6 py-4 font-medium text-right">Latest Price</th>
                  <th className="px-6 py-4 font-medium text-right">Total Value</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredInventory.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {inventory.length === 0 ? 'No items in inventory.' : 'No items found matching your filters.'}
                  </td></tr>
                ) : filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{item.item_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{item.category}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      {item.sub_category || 'Miscellaneous'}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${item.quantity <= 0 ? 'text-red-700' : item.quantity < 10 ? 'text-amber-600' : 'text-gray-900'}`}>{item.quantity <= 0 ? 0 : item.quantity} {item.unit}</div>
                      <button 
                        onClick={() => fetchBatches(item)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase mt-1 underline block"
                      >
                        View Batches
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">₹{parseFloat(item.price_per_unit || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">₹{Math.max(0, parseFloat(item.total_value || 0)).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right space-x-1">
                      {canModifyInventory && (
                        <>
                          <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit Master"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'additions' ? (
        <div className="space-y-4">
          <FilterBar 
            searchPlaceholder="Search item, GRN, supplier..."
            filterType="none"
            onChange={(filters) => setAdditionsFilters({ search: filters.search, fromDate: filters.fromDate, toDate: filters.toDate })}
          />
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Item Details</th>
                  <th className="px-6 py-4 font-medium">Qty Added</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Supplier</th>
                  <th className="px-6 py-4 font-medium">Added By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {additions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No addition history found.</td></tr>
                ) : additions.map((addition) => (
                  <tr key={addition.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{new Date(addition.addition_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{addition.item_name}</div>
                      <div className="text-xs text-gray-500 italic">{addition.remarks || 'No remarks'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-700">+{addition.quantity_added}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{addition.category}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{addition.supplier || 'N/A'}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{addition.added_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <FilterBar 
              searchPlaceholder="Search item, project, voucher, issued to..."
              filterType="none"
              onChange={(filters) => setIssuesFilters({ search: filters.search, fromDate: filters.fromDate, toDate: filters.toDate })}
            />
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveHistoryTab('vouchers')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeHistoryTab === 'vouchers' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Vouchers
              </button>
              <button 
                onClick={() => setActiveHistoryTab('items')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeHistoryTab === 'items' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Item Layers
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {activeHistoryTab === 'vouchers' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase font-black tracking-widest text-gray-500">
                      <th className="px-6 py-4">Voucher No</th>
                      <th className="px-6 py-4">Issue Date</th>
                      <th className="px-6 py-4">Project</th>
                      <th className="px-6 py-4">Issued To</th>
                      <th className="px-6 py-4 text-center">Items</th>
                      <th className="px-6 py-4 text-right">Total Value</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {vouchers.length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No vouchers found.</td></tr>
                    ) : vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => openVoucherDetail(v)}>
                        <td className="px-6 py-4 font-black text-blue-600 underline">{v.voucher_no}</td>
                        <td className="px-6 py-4 text-gray-600">{new Date(v.issue_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{v.project_name}</td>
                        <td className="px-6 py-4 text-gray-700">{v.issued_to}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-black text-gray-600">{v.total_items} Items</span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">₹{parseFloat(v.total_valuation).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            v.status === 'FULLY_REVERTED' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-blue-600 hover:underline text-xs font-bold">Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase font-black tracking-widest text-gray-500">
                      <th className="px-6 py-4">Issue Date</th>
                      <th className="px-6 py-4">Item Details</th>
                      <th className="px-6 py-4">Voucher/MIV</th>
                      <th className="px-6 py-4">Qty</th>
                      <th className="px-6 py-4 text-right">Consumption Cost</th>
                      <th className="px-6 py-4">Project</th>
                      <th className="px-6 py-4">Issued To/By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {issues.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No issue history found.</td></tr>
                    ) : issues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">{new Date(issue.issue_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{issue.item_name}</div>
                          <div className="text-[10px] text-gray-400 italic max-w-xs truncate">{issue.remarks || 'No remarks'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100">
                            {issue.voucher_no || 'Legacy'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-amber-700">-{issue.quantity}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">₹{parseFloat(issue.total_cost || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">{issue.project_name}</td>
                        <td className="px-6 py-4">
                          <div className="text-gray-900 font-medium">To: {issue.issued_to}</div>
                          <div className="text-[10px] text-gray-400">By: {issue.issued_by}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Inventory Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                {editingItem ? <Edit className="w-5 h-5 mr-2 text-blue-600" /> : <Plus className="w-5 h-5 mr-2 text-blue-600" />}
                {editingItem ? 'Edit Material Details' : 'Register New Material'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-amber-50 px-6 py-2 border-b border-amber-100 text-[11px] text-amber-700 font-bold uppercase tracking-wider">
              Note: Stock quantity and pricing can only be updated via the GRN (Goods Receipt Note) module.
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <input 
                    type="text" 
                    required
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. UltraTech Cement"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select Category...</option>
                    {categoryNames.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
                  <select
                    value={subCategory}
                    onChange={e => setSubCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {subCategoryMapping[category]?.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select Unit...</option>
                    {masterUnits.map(u => (
                      <option key={u.id} value={u.unit_name}>{u.unit_name}</option>
                    ))}
                  </select>
                </div>
                {!editingItem && (
                  <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs text-gray-500 italic">
                    New materials are registered with 0 stock. Use the GRN module to add initial or new stock.
                  </div>
                )}
                {/* Supplier and Remarks removed: metadata-only material registration */}
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
                  {editingItem ? 'Update Material' : 'Register Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📦 Update Opening Stock Modal */}
      {isOpeningStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-slate-700" />
                Update Opening Stock
              </h3>
              <button onClick={() => !isSubmittingOpeningStock && setIsOpeningStockModalOpen(false)} disabled={isSubmittingOpeningStock} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-amber-50 px-6 py-2 border-b border-amber-100 text-[11px] text-amber-700 font-bold uppercase tracking-wider">
              For ERP go-live initialization and exceptional corrections only. Creates a valued stock batch.
            </div>
            <form onSubmit={handleOpeningStockSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Item</label>
                <select
                  required
                  value={osItemId}
                  onChange={e => setOsItemId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select Material...</option>
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.item_name} ({i.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number" step="any" required min="0"
                    value={osQuantity}
                    onChange={e => setOsQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number" step="any" required min="0"
                    value={osUnitCost}
                    onChange={e => setOsUnitCost(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 450"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock Date</label>
                <input
                  type="date" required
                  value={osDate}
                  onChange={e => setOsDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
                <textarea
                  required
                  value={osReason}
                  onChange={e => setOsReason(e.target.value)}
                  placeholder="e.g. ERP go-live opening balance, physical stock reconciliation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  disabled={isSubmittingOpeningStock}
                  onClick={() => setIsOpeningStockModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpeningStock}
                  className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center"
                >
                  {isSubmittingOpeningStock ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Recording...
                    </>
                  ) : (
                    'Record Opening Stock'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 MULTI-ITEM MATERIAL ISSUE VOUCHER MODAL */}
      {isIssueModalOpen && (() => {
        const totalVoucherValuation = voucherItems.reduce((acc, item) => {
          return acc + (item.expected_total_cost || 0);
        }, 0);

        const hasInsufficientStock = voucherItems.some(item => {
          const qty = parseFloat(item.quantity_issued || '0');
          const invItem = inventory.find(i => i.id === parseInt(item.inventory_id));
          return (invItem && qty > invItem.quantity) || (item.remaining_unfulfilled !== undefined && item.remaining_unfulfilled > 0);
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-8">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-600 rounded-t-xl text-white shadow-sm">
                <h3 className="text-lg font-bold flex items-center">
                  <ArrowDownRight className="w-5 h-5 mr-2" />
                  Material Issue Voucher (MIV)
                </h3>
                <button onClick={() => !isIssuing && setIsIssueModalOpen(false)} disabled={isIssuing} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleIssueMaterial} className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Project</label>
                    <select
                      required
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                    >
                      <option value="">Select Project...</option>
                      {masterProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Issued To</label>
                    <input 
                      type="text" required placeholder="Person receiving materials"
                      value={issuedTo} onChange={e => setIssuedTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Issue Date</label>
                    <input 
                      type="date" required
                      value={issueDate} onChange={e => setIssueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-900 uppercase tracking-wider text-sm">Line Items</h4>
                    <button type="button" onClick={addVoucherItem} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-bold border border-blue-100 hover:bg-blue-100 transition-colors flex items-center">
                      <Plus className="w-3 h-3 mr-1" /> Add Material
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 text-[10px] uppercase font-black text-gray-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Material / Item</th>
                          <th className="px-4 py-3 text-left">Available Stock</th>
                          <th className="px-4 py-3 text-left w-32">Quantity</th>
                          <th className="px-4 py-3 text-right">Expected Issue Rate</th>
                          <th className="px-4 py-3 text-right">Expected Value</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {voucherItems.map((item, index) => {
                          const invItem = inventory.find(i => i.id === parseInt(item.inventory_id));
                          const qty = parseFloat(item.quantity_issued || '0');
                          const isOverStock = (invItem && qty > invItem.quantity) || (item.remaining_unfulfilled !== undefined && item.remaining_unfulfilled > 0);

                          return (
                            <tr key={index} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3">
                                <SearchableSelect
                                  options={toMaterialOptions(inventory)}
                                  value={item.inventory_id}
                                  onChange={(val) => updateVoucherItem(index, 'inventory_id', val.toString())}
                                  placeholder="Select Material..."
                                />
                              </td>
                              <td className="px-4 py-3 text-gray-500 font-medium">
                                {invItem ? `${invItem.quantity} ${invItem.unit}` : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="number" step="any" required
                                  value={item.quantity_issued}
                                  onChange={e => updateVoucherItem(index, 'quantity_issued', e.target.value)}
                                  className={`w-full px-2 py-1 border rounded font-black text-right ${isOverStock ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}
                                />
                                {isOverStock && (
                                  <div className="text-[10px] text-red-600 font-bold text-right mt-0.5">
                                    {item.remaining_unfulfilled !== undefined && item.remaining_unfulfilled > 0
                                      ? `Short of ${item.remaining_unfulfilled} unit(s)`
                                      : 'Insufficient stock'}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900">
                                {item.expected_issue_rate !== undefined 
                                  ? `₹${item.expected_issue_rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900">
                                {item.expected_total_cost !== undefined 
                                  ? `₹${item.expected_total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {voucherItems.length > 1 && (
                                  <button type="button" onClick={() => removeVoucherItem(index)} className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-500 uppercase text-xs">Total Voucher Valuation</td>
                          <td className="px-4 py-3 text-right font-black text-blue-600 text-lg">₹{totalVoucherValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Purpose / Activity</label>
                    <input 
                      type="text" placeholder="e.g. Slab Work, Foundation"
                      value={issueRemarks} onChange={e => setIssueRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                  <button 
                    type="button" disabled={isIssuing} onClick={() => setIsIssueModalOpen(false)}
                    className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" disabled={isIssuing || hasInsufficientStock}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg disabled:opacity-50 transition-all flex items-center"
                  >
                    {isIssuing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Processing...
                      </>
                    ) : hasInsufficientStock ? (
                      'Blocked: Insufficient Stock'
                    ) : (
                      'Confirm & Issue Voucher'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* 🚀 VOUCHER DETAIL MODAL */}
      {isVoucherDetailOpen && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-800 text-white rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold">{selectedVoucher.voucher_no}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedVoucher.project_name}</p>
              </div>
              <button onClick={() => setIsVoucherDetailOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                <div>
                  <span className="block text-gray-400 text-[10px] font-black uppercase tracking-wider mb-1">Issued To</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.issued_to}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-[10px] font-black uppercase tracking-wider mb-1">Issued By</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.issued_by}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-[10px] font-black uppercase tracking-wider mb-1">Issue Date</span>
                  <span className="font-bold text-gray-900">{new Date(selectedVoucher.issue_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-[10px] font-black uppercase tracking-wider mb-1">Status</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    selectedVoucher.status === 'FULLY_REVERTED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedVoucher.status}
                  </span>
                </div>
              </div>

              {selectedVoucher.remarks && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                  <span className="block text-blue-400 text-[10px] font-black uppercase tracking-wider mb-1">Purpose / Remarks</span>
                  <p className="text-blue-900 font-medium text-sm">{selectedVoucher.remarks}</p>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-[10px] uppercase font-black text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Material</th>
                      <th className="px-4 py-3 text-left">GRN Source</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Total Cost</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedVoucher.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-bold text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-black border border-blue-100">
                            {item.grn_number || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-amber-700">{item.quantity} {item.unit}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">₹{parseFloat(item.total_cost).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-black uppercase ${item.revert_status === 'REVERTED' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {item.revert_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-black">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right uppercase text-[10px] text-gray-500">Voucher Valuation</td>
                      <td className="px-4 py-3 text-right text-gray-900">₹{parseFloat(selectedVoucher.total_valuation).toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {canRevert && selectedVoucher.status !== 'FULLY_REVERTED' && (
                <div className="pt-4 border-t border-gray-100 flex flex-col items-end space-y-3">
                  <div className="w-full max-w-md">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Revert Reason (Governance Audit)</label>
                    <textarea 
                      placeholder="Mandatory explanation for restoration..."
                      className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm bg-red-50/30 focus:ring-2 focus:ring-red-500 outline-none"
                      onChange={(e) => setRevertReason(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => handleRevertVoucher(selectedVoucher.id, revertReason)}
                    className="px-6 py-2.5 bg-red-600 text-white text-sm font-black rounded-lg hover:bg-red-700 shadow-lg flex items-center transition-all"
                  >
                    <ArrowDownRight className="w-4 h-4 rotate-180 mr-2" />
                    Revert Entire Voucher
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Batches Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Stock Batches</h3>
                <p className="text-sm text-gray-500">{selectedBatchItem?.item_name} ({selectedBatchItem?.unit})</p>
              </div>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {loadingBatches ? (
                <div className="py-12 text-center text-gray-500">Loading batches...</div>
              ) : itemBatches.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No active batches found.</div>
              ) : (
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-200">
                        <th className="px-4 py-3">Received Date</th>
                        <th className="px-4 py-3">Batch/GRN</th>
                        <th className="px-4 py-3 text-right">Original Qty</th>
                        <th className="px-4 py-3 text-right">Remaining</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {itemBatches.map(batch => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{new Date(batch.received_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{batch.batch_number}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{batch.quantity_received}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">{batch.quantity_remaining}</td>
                          <td className="px-4 py-3 text-right text-gray-600">₹{parseFloat(batch.confirmed_unit_price || batch.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">₹{parseFloat(batch.total_value_remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold border-t border-gray-200">
                        <td colSpan={3} className="px-4 py-3 text-right">Total Inventory Value:</td>
                        <td colSpan={3} className="px-4 py-3 text-right text-blue-700 text-lg">
                          ₹{itemBatches.reduce((acc, b) => acc + parseFloat(b.total_value_remaining || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Revert Issue Modal */}
      {isRevertModalOpen && selectedIssueToRevert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-red-100">
            <div className="px-6 py-4 border-b border-red-50 flex justify-between items-center bg-red-50/50">
              <h3 className="text-lg font-black text-red-900 flex items-center uppercase tracking-tight">
                <ArrowDownRight className="w-5 h-5 mr-2 rotate-180" />
                Govern: Revert Material Issue
              </h3>
              <button onClick={() => !isReverting && setIsRevertModalOpen(false)} disabled={isReverting} className="text-red-400 hover:text-red-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Item</div>
                    <div className="text-sm font-bold text-slate-900">{selectedIssueToRevert.item_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Qty</div>
                    <div className="text-sm font-black text-red-600">-{selectedIssueToRevert.quantity_issued} {selectedIssueToRevert.unit || 'Units'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200/60">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GRN Source</div>
                    <div className="text-[11px] font-bold text-blue-600">{selectedIssueToRevert.grn_number || 'Direct/Legacy'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FIFO Value</div>
                    <div className="text-[11px] font-bold text-slate-900">₹{parseFloat(selectedIssueToRevert.total_cost || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200/60">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Assignment</div>
                  <div className="text-[11px] font-bold text-slate-700">{selectedIssueToRevert.project_name}</div>
                </div>
              </div>

              {/* Revert Reason */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Mandatory Revert Reason</label>
                <textarea
                  required
                  value={revertReason}
                  onChange={e => setRevertReason(e.target.value)}
                  placeholder="e.g. Wrong project assigned, Data entry mistake, Material returned to store..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-inner text-sm h-24 resize-none"
                />
                <p className="text-[10px] text-slate-400 italic font-medium">This action will restore stock levels to the original GRN batch and update valuation history.</p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  disabled={isReverting}
                  onClick={() => setIsRevertModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isReverting || revertReason.trim().length < 5}
                  onClick={async () => {
                    setIsReverting(true);
                    try {
                      const res = await fetch(`${API_CONFIG.BASE_URL}/inventory/issue/revert/${selectedIssueToRevert.id}`, {
                        method: 'POST',
                        headers: createAuthHeaders(true),
                        body: JSON.stringify({ reason: revertReason })
                      });
                      
                      if (res.ok) {
                        setIsRevertModalOpen(false);
                        fetchData();
                        alert('Inventory successfully restored and audit trail updated.');
                      } else {
                        const err = await res.json();
                        alert(err.error || 'Revert failed');
                      }
                    } catch (e) {
                      alert('Server communication error');
                    } finally {
                      setIsReverting(false);
                    }
                  }}
                  className="flex-2 px-4 py-3 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isReverting ? 'Restoring...' : 'Confirm Restoration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
