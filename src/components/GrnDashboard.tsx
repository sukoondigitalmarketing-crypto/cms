import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Printer, Package, User, Building2, Calendar, FileText, Eye, Pencil, XCircle, FileCheck, ShieldAlert, Lock, Info } from 'lucide-react';
import { API_CONFIG, ROLE_PERMISSIONS } from '../config';
import { createAuthHeaders } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { FilterBar } from './common/FilterBar';
import { QuickRegisterMaterialModal } from './common/QuickRegisterMaterialModal';
import { useAuth } from './AuthProvider';
import { toMaterialOptions } from '../lib/search/materialOption';
import { SearchableSelect } from './common/SearchableSelect';

interface GrnDashboardProps {
  role: string;
  userName: string;
}

interface GrnViewModalProps {
  grn: any;
  onClose: () => void;
  onDownloadPdf: (id: number, grnNumber: string) => void;
}

function GrnViewModal({ grn, onClose, onDownloadPdf }: GrnViewModalProps) {
  if (!grn) return null;

  console.log("GRN Details Data:", grn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white/80 backdrop-blur-md no-print">
          <h3 className="text-lg font-bold text-gray-900">GRN Details</h3>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => onDownloadPdf(grn.id, grn.grn_number)} 
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center text-sm font-bold shadow-sm transition-all"
            >
              <FileText className="w-4 h-4 mr-2" /> Download PDF
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div id="grn-printable" className="p-4 sm:p-8 space-y-8">
          {/* Report Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-4 border-blue-600 pb-6 gap-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mr-4 shrink-0 shadow-lg shadow-blue-100">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">BuildCore CMS</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Material Receipt Document</p>
              </div>
            </div>
            <div className="text-left sm:text-right w-full sm:w-auto">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800">GRN</h1>
              <p className="text-blue-600 font-black text-lg sm:text-xl">{grn.grn_number}</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              {grn.projectName && (
                <div className="flex items-start">
                  <div className="p-2 bg-slate-100 rounded-lg mr-3">
                    <Building2 className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project / Destination</span>
                    <span className="text-sm font-bold text-slate-800">{grn.projectName}</span>
                    <span className={`block text-[9px] font-black mt-0.5 uppercase ${grn.destination_type === 'DIRECT_PROJECT' ? 'text-red-500' : 'text-blue-500'}`}>
                      {grn.destination_type === 'DIRECT_PROJECT' ? '⚡ Direct Project Purchase' : '📦 Warehouse Receipt'}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-start">
                <div className="p-2 bg-slate-100 rounded-lg mr-3">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor / Supplier</span>
                  <span className="text-sm font-bold text-slate-800">{grn.vendorName || 'No Vendor Selected'}</span>
                  {grn.gstNumber && (
                    <span className="block text-[10px] text-slate-500 mt-0.5">GST: {grn.gstNumber}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="p-2 bg-slate-100 rounded-lg mr-3">
                  <Calendar className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date of Receipt</span>
                  <span className="text-sm font-bold text-slate-800">{new Date(grn.grn_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-slate-100 rounded-lg mr-3">
                  <FileText className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Status</span>
                  <span className={`px-2 py-0.5 mt-1 inline-block ${grn.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'} text-[10px] font-black rounded uppercase`}>
                    {grn.status || 'ACTIVE'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-5 shadow-sm">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
              <FileCheck className="w-4.5 h-4.5 mr-1.5 text-slate-500" />
              Financial Status
            </h4>
            {grn.financial_status === 'FINALIZED' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor Invoice</span>
                  <span className="text-sm font-black text-blue-600">{grn.invoice_number}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                  <span className="px-2 py-0.5 mt-0.5 inline-block bg-emerald-100 text-emerald-800 text-[10px] font-black rounded uppercase">
                    {grn.invoice_status}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirmed On</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {grn.confirmed_at ? new Date(grn.confirmed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance</span>
                  <span className={`text-sm font-bold ${grn.variance > 0 ? 'text-red-600' : grn.variance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {grn.variance > 0 ? '+' : grn.variance < 0 ? '-' : ''}₹{Math.abs(grn.variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-slate-800">Awaiting Vendor Invoice</span>
                  <span className="block text-[11px] text-slate-400 font-medium mt-0.5">Material received. Financial verification pending.</span>
                </div>
                <span className="px-2 py-0.5 inline-block bg-amber-100 text-amber-800 text-[10px] font-black rounded uppercase w-fit">
                  PENDING VERIFICATION
                </span>
              </div>
            )}
          </div>

          {/* Dynamic Info Banner regarding financial state */}
          {grn.financial_status === 'FINALIZED' ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start space-x-3 text-emerald-800 mb-4 shadow-sm">
              <Info className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-emerald-500" />
              <div className="text-xs font-semibold leading-relaxed">
                This GRN has been financially finalized. Financial values shown below are confirmed through Vendor Invoice <span className="font-bold">{grn.invoice_number}</span>.
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start space-x-3 text-blue-800 mb-4 shadow-sm">
              <Info className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-blue-500" />
              <div className="text-xs font-semibold leading-relaxed">
                Estimated values recorded when the material was physically received. Final financial values will be available once the Vendor Invoice is finalized.
              </div>
            </div>
          )}

          {/* Items Table with inner Scroll */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-4 py-4 text-center">Qty</th>
                    <th className="px-4 py-4 text-right">
                      {grn.financial_status === 'FINALIZED' ? 'Confirmed Rate' : 'Estimated Rate'}
                    </th>
                    <th className="px-6 py-4 text-right">
                      {grn.financial_status === 'FINALIZED' ? 'Confirmed Amount' : 'Estimated Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {grn.items && grn.items.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{item.item_name}</div>
                        <div className="text-[10px] text-slate-400">{item.category}</div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-700 whitespace-nowrap">{item.quantity} {item.unit || ''}</td>
                      <td className="px-4 py-4 text-right text-slate-600 whitespace-nowrap">₹{parseFloat(item.rate).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 whitespace-nowrap">₹{parseFloat(item.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  {(() => {
                    const subtotal = parseFloat(grn.total_amount || grn.subtotal) || 0;
                    const finalTotal = grn.finalAmount != null ? parseFloat(grn.finalAmount) : subtotal;
                    
                    if (grn.finalAmount == null) {
                      console.warn("Missing finalAmount for GRN:", grn.grn_number, grn);
                    }

                    const discountValue = parseFloat(grn.discountValue) || 0;
                    const discountAmount = grn.discountType === 'PERCENTAGE'
                      ? (subtotal * discountValue / 100)
                      : discountValue;
                    const transport = parseFloat(grn.transportCharges) || 0;
                    const other = parseFloat(grn.otherCharges) || 0;

                    return (
                      <>
                        <tr>
                          <td colSpan={3} className="px-6 py-2 text-right text-xs text-slate-500">
                            {grn.financial_status === 'FINALIZED' ? 'Confirmed Subtotal' : 'Subtotal'}
                          </td>
                          <td className="px-6 py-2 text-right text-sm font-bold text-slate-600">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        
                        {discountAmount > 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-1 text-right text-xs text-red-500">
                              Discount {grn.discountType === 'PERCENTAGE' ? `(${discountValue}%)` : '(Flat)'}
                            </td>
                            <td className="px-6 py-1 text-right text-sm font-bold text-red-500">- ₹{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        )}
                        
                        {transport > 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-1 text-right text-xs text-emerald-600">Transport Charges</td>
                            <td className="px-6 py-1 text-right text-sm font-bold text-emerald-600">+ ₹{transport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        )}
                        
                        {other > 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-1 text-right text-xs text-emerald-600">Other Charges</td>
                            <td className="px-6 py-1 text-right text-sm font-bold text-emerald-600">+ ₹{other.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        )}
                        
                        <tr className="border-t border-slate-200">
                          <td colSpan={3} className="px-6 py-5 text-right text-xs font-black text-slate-500 uppercase tracking-widest">
                            {grn.financial_status === 'FINALIZED' ? 'Confirmed Final Total' : 'Final Total'}
                          </td>
                          <td className="px-6 py-5 text-right text-2xl font-black text-blue-700">₹{finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>

          {grn.remarks && (
            <div className="bg-slate-50 p-4 rounded-lg border-l-4 border-slate-300">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Additional Notes</span>
              <p className="text-sm text-slate-600 leading-relaxed italic">"{grn.remarks}"</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-20 pt-20 pb-10">
            <div className="text-center">
              <div className="border-t-2 border-slate-900 pt-3">
                <p className="text-xs text-slate-400 uppercase font-black tracking-widest mb-1">Authorization</p>
                <p className="text-sm font-bold text-slate-800">AUTHORIZED SIGNATURE</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-slate-900 pt-3">
                <p className="text-xs text-slate-400 uppercase font-black tracking-widest mb-1">Acknowledgment</p>
                <p className="text-sm font-bold text-slate-800">SITE INCHARGE SIGNATURE</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GrnDashboard({ role, userName }: GrnDashboardProps) {
  const { user: currentUser } = useAuth();
  const { hasPermission, canCreate, canEdit } = usePermissions();
  const [grns, setGrns] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [masterUnits, setMasterUnits] = useState<any[]>([]);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickRegisterRowIndex, setQuickRegisterRowIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancellingGrn, setCancellingGrn] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingGrnId, setEditingGrnId] = useState<number | null>(null);
  const [viewingGrn, setViewingGrn] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CANCELLED' | 'EDITED'>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  
  // Filtering states
  const [filters, setFilters] = useState({
    search: '',
    vendor: '',
    fromDate: '',
    toDate: '',
    invoiceStatus: '',
    pendingOlderThanDays: ''
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [tabCounts, setTabCounts] = useState({ active: 0, cancelled: 0, edited: 0 });
  
  const permissions = ROLE_PERMISSIONS[role] || {};
  const canEditGrn = canEdit('grn');
  
  const [vendorName, setVendorName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [editReason, setEditReason] = useState('');
  const [destinationType, setDestinationType] = useState<'CENTRAL_STORE' | 'DIRECT_PROJECT'>('CENTRAL_STORE');
  const [isUsedForEdit, setIsUsedForEdit] = useState(false);
  
  // 🛡️ Procurement Governance States
  const [poId, setPoId] = useState<string>('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // Master Data
  const [masterVendors, setMasterVendors] = useState<any[]>([]);
  const [masterProjects, setMasterProjects] = useState<any[]>([]);


  const fetchData = async () => {
    try {
      const headers = createAuthHeaders();
      
      // Construct filter query
      const params = new URLSearchParams();
      params.append('status', activeTab);
      params.append('page', currentPage.toString());
      params.append('limit', '10');

      if (filters.search) params.append('search', filters.search);
      if (filters.vendor) params.append('vendor', filters.vendor);
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      if (filters.invoiceStatus) params.append('invoiceStatus', filters.invoiceStatus);
      if (filters.pendingOlderThanDays) params.append('pendingOlderThanDays', filters.pendingOlderThanDays);
      
      const grnQuery = `?${params.toString()}`;
      const historyQuery = `?page=${currentPage}&limit=10${filters.search ? `&search=${filters.search}` : ''}`;

      const [grnRes, invRes, vendorRes, projectRes, historyRes, poRes, catRes, unitRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/grns${grnQuery}`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/inventory`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/vendors`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/projects`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/grn-edit-history${historyQuery}`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/procurement/po`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/categories`, { headers }),
        fetch(`${API_CONFIG.BASE_URL}/master/units`, { headers })
      ]);
      
      if (activeTab === 'EDITED') {
        if (historyRes.ok) {
          const responseData = await historyRes.json();
          setGrns(responseData.data || []);
          setTotalPages(responseData.totalPages || 0);
          setTotalItems(responseData.total || 0);
        } else {
          console.error('Failed to fetch history:', historyRes.status);
          setGrns([]);
          setTotalItems(0);
        }
        // Still need stats from grnRes for counts
        if (grnRes.ok) {
          const responseData = await grnRes.json();
          setTabCounts(responseData.stats || { active: 0, cancelled: 0, edited: 0 });
        }
      } else if (grnRes.ok) {
        const responseData = await grnRes.json();
        setGrns(responseData.data || []);
        setTotalPages(responseData.totalPages || 0);
        setTotalItems(responseData.total || 0);
        setTabCounts(responseData.stats || { active: 0, cancelled: 0, edited: 0 });
      }
      
      if (invRes.ok) setInventory(await invRes.json());
      if (vendorRes.ok) setMasterVendors(await vendorRes.json());
      if (projectRes.ok) setMasterProjects(await projectRes.json());
      if (poRes.ok) setPurchaseOrders(await poRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (unitRes.ok) setMasterUnits(await unitRes.json());
    } catch (error) {
      console.error('Failed to fetch GRN data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, activeTab, currentPage]);

  useEffect(() => {
    const applyNavQuery = (queryStr: string | null) => {
      if (!queryStr) return;
      const params = new URLSearchParams(queryStr);
      const invoiceStatus = params.get('invoiceStatus') || '';
      const pendingOlderThanDays = params.get('pendingOlderThanDays') || '';

      if (!invoiceStatus && !pendingOlderThanDays) return;

      setActiveTab('ACTIVE');
      setCurrentPage(1);
      setFilters(prev => ({
        ...prev,
        invoiceStatus,
        pendingOlderThanDays
      }));
      sessionStorage.removeItem('activity_feed_nav_query');
    };

    applyNavQuery(sessionStorage.getItem('activity_feed_nav_query'));

    const handleNav = (event: Event) => {
      applyNavQuery((event as CustomEvent<string>).detail);
    };

    window.addEventListener('activity_feed_nav', handleNav);
    return () => window.removeEventListener('activity_feed_nav', handleNav);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, activeTab]);

  const roundToTwo = (value: number) => Number.isFinite(value) ? value.toFixed(2) : '';

  const handleAddItem = () => {
    setItems([...items, {
      inventory_id: '',
      quantity: '',
      rate: '',
      totalAmount: '',
      lastEditedField: 'rate',
      item_name: ''
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'inventory_id') {
      const invItem = inventory.find(i => i.id === parseInt(value));
      newItems[index].inventory_id = value;
      newItems[index].item_name = invItem?.item_name || '';
    } else {
      const currentItem = { ...newItems[index], [field]: value };
      
      const q = parseFloat(currentItem.quantity) || 0;
      const r = parseFloat(currentItem.rate) || 0;
      const t = parseFloat(currentItem.totalAmount) || 0;

      if (field === 'rate') {
        currentItem.lastEditedField = 'rate';
        currentItem.totalAmount = q * r;
      } else if (field === 'totalAmount') {
        currentItem.lastEditedField = 'totalAmount';
        if (q > 0) {
          currentItem.rate = t / q;
        }
      } else if (field === 'quantity') {
        if (currentItem.lastEditedField === 'rate') {
          currentItem.totalAmount = q * r;
        } else if (currentItem.lastEditedField === 'totalAmount') {
          if (q > 0) {
            currentItem.rate = t / q;
          }
        }
      }
      
      newItems[index] = currentItem;
    }
    setItems(newItems);
  };

  const handleMaterialCreated = async (newMaterial: any) => {
    console.log('[GRN] Material creation result:', newMaterial);
    
    try {
      const invRes = await fetch(`${API_CONFIG.BASE_URL}/inventory`, {
        headers: createAuthHeaders()
      });
      if (invRes.ok) {
        const invData = await invRes.json();
        console.log('[GRN] Fetched inventory, count:', Array.isArray(invData) ? invData.length : 0);
        setInventory(Array.isArray(invData) ? invData : []);
        
        if (quickRegisterRowIndex !== null && quickRegisterRowIndex >= 0) {
          console.log('[GRN] Auto-selecting material ID', newMaterial.id, 'in row', quickRegisterRowIndex);
          const newItems = [...items];
          // Store inventory_id as numeric string for consistency
          const materialId = parseInt(newMaterial.id) || 0;
          if (materialId > 0) {
            newItems[quickRegisterRowIndex].inventory_id = materialId.toString();
            newItems[quickRegisterRowIndex].item_name = newMaterial.item_name;
            setItems(newItems);
            console.log('[GRN] Row', quickRegisterRowIndex, 'updated with material:', materialId);
          } else {
            console.error('[GRN] Invalid material ID received:', newMaterial.id);
          }
          setQuickRegisterRowIndex(null);
        } else {
          console.warn('[GRN] quickRegisterRowIndex is null or invalid:', quickRegisterRowIndex);
        }
      } else {
        console.error('[GRN] Inventory fetch failed:', invRes.status);
      }
    } catch (error) {
      console.error('[GRN] Error in handleMaterialCreated:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnDate || items.length === 0) {
      alert('Please fill all required fields and add at least one item.');
      return;
    }

    if (isEditMode && !editReason) {
      alert('Please provide a reason for editing this GRN.');
      return;
    }

    if (isEditMode && !window.confirm('Editing this GRN will adjust inventory stock based on the changes. Are you sure?')) {
      return;
    }

    const grn_number = isEditMode ? undefined : `GRN-${Date.now().toString().slice(-6)}`;
    const url = isEditMode 
      ? `${API_CONFIG.BASE_URL}/grns/${editingGrnId}`
      : `${API_CONFIG.BASE_URL}/grns`;
    const method = isEditMode ? 'PUT' : 'POST';

    setSubmitting(true);
    try {
      const subtotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.totalAmount) || 0), 0);

      const response = await fetch(url, {
        method,
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          grn_number,
          vendorName: vendorName || null,
          gstNumber: gstNumber || null,
          projectId: projectId || null,
          grn_date: grnDate,
          items,
          remarks,
          created_by: userName,
          edited_by: userName,
          edit_reason: editReason,
          destination_type: destinationType,
          po_id: poId || null,
          is_emergency: isEmergency,
          emergency_reason: emergencyReason,
          finalAmount: subtotal
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save GRN');
      }

      const isEdit = !!editingGrnId;

      alert(isEdit ? 'GRN Updated Successfully!' : 'GRN Saved Successfully');
      setIsModalOpen(false);
      setEditingGrnId(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setVendorName('');
    setGstNumber('');
    setProjectId('');
    setGrnDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
    setItems([]);
    setIsEditMode(false);
    setEditingGrnId(null);
    setEditReason('');
    setDestinationType('CENTRAL_STORE');
    setPoId('');
    setIsEmergency(false);
    setEmergencyReason('');
  };

  const handleEditClick = (grn: any) => {
    setIsEditMode(true);
    setEditingGrnId(grn.id);
    setVendorName(grn.vendorName || '');
    setGstNumber(grn.gstNumber || '');
    setProjectId(grn.projectId?.toString() || '');
    setGrnDate(grn.grn_date.split('T')[0]);
    setRemarks(grn.remarks || '');
    setDestinationType(grn.destination_type || 'CENTRAL_STORE');
    
    // Fetch full details to get items
    handleFetchAndSetItems(grn.id);
    setIsModalOpen(true);
  };

  const handleFetchAndSetItems = async (id: number) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/grns/${id}`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setIsUsedForEdit(data.is_used || false);
        setItems(data.items.map((it: any) => ({
          inventory_id: it.inventory_id,
          item_name: it.item_name,
          quantity: it.quantity,
          rate: it.rate,
          totalAmount: it.total,
          lastEditedField: 'rate'
        })));
      }
    } catch (e) {
      console.error('Error fetching items for edit:', e);
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/grns/${id}`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        setViewingGrn(await res.json());
      }
    } catch (error) {
      alert('Failed to fetch GRN details');
    }
  };

  const handleDownloadPdf = async (id: number, grnNumber: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/grns/${id}/pdf`, {
        headers: createAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GRN-${grnNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF Download Error:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handleCancelClick = (grn: any) => {
    setCancellingGrn(grn);
    setCancelReason('');
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason) {
      alert('Please provide a reason for cancellation.');
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/grns/${cancellingGrn.id}/cancel`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          reason: cancelReason,
          cancelled_by: userName,
          role: role
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to cancel GRN');
      }

      alert('GRN Cancelled Successfully. Stock has been reverted.');
      setCancellingGrn(null);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading GRN Module...</div>;

  const todayStr = new Date().toISOString().split('T')[0];
  let minDateStr = undefined;
  if (currentUser?.backdateLimit !== undefined && currentUser.backdateLimit !== -1) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - currentUser.backdateLimit);
    minDateStr = minDate.toISOString().split('T')[0];
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New GRN
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex-1 w-full space-y-4">
          <div className="flex space-x-1 bg-white p-1 rounded-xl border border-gray-200 w-fit">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'ACTIVE' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Active GRNs ({tabCounts.active})
            </button>
            <button
              onClick={() => setActiveTab('CANCELLED')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'CANCELLED' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Cancelled History ({tabCounts.cancelled})
            </button>
            <button
              onClick={() => setActiveTab('EDITED')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'EDITED' 
                  ? 'bg-amber-600 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Edit History ({tabCounts.edited})
            </button>
          </div>

          <FilterBar 
            searchPlaceholder="GRN # or Vendor name..."
            filterType="vendor"
            entities={masterVendors.map(v => ({ id: v.id, name: v.vendor_name }))}
            onChange={(f) => {
              const vendorName = masterVendors.find(v => String(v.id) === String(f.entityId))?.vendor_name || '';
              setFilters({
                search: f.search,
                vendor: vendorName,
                fromDate: f.fromDate,
                toDate: f.toDate,
                invoiceStatus: filters.invoiceStatus,
                pendingOlderThanDays: filters.pendingOlderThanDays
              });
            }}
          />
          {(filters.invoiceStatus || filters.pendingOlderThanDays) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-black uppercase tracking-wider">
                Invoice Status: {filters.invoiceStatus === 'PENDING' ? 'Pending' : filters.invoiceStatus}
              </span>
              {filters.pendingOlderThanDays && (
                <span className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs font-black uppercase tracking-wider">
                  GRN Date &gt; {filters.pendingOlderThanDays} Days
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setFilters(prev => ({ ...prev, invoiceStatus: '', pendingOlderThanDays: '' }));
                }}
                className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gray-700"
              >
                Clear invoice filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GRN List Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-[10px] uppercase font-black tracking-widest">
                <th className="px-6 py-4">GRN #</th>
                <th className="px-6 py-4">Date</th>
                {activeTab === 'EDITED' ? (
                  <>
                    <th className="px-6 py-4">Edited By</th>
                    <th className="px-6 py-4">Edit Reason</th>
                  </>
                ) : (
                  <th className="px-6 py-4">Vendor</th>
                )}
                {activeTab === 'CANCELLED' && (
                  <>
                    <th className="px-6 py-4">Cancelled By</th>
                    <th className="px-6 py-4">Cancellation Reason</th>
                  </>
                )}
                {activeTab !== 'EDITED' && <th className="px-6 py-4 text-right">Estimated Amount</th>}
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {grns.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No {activeTab.toLowerCase()} GRNs found.</td></tr>
              ) : grns.map((grn) => (
                <tr key={grn.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-blue-600">{grn.grn_number}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {grn.grn_date ? new Date(grn.grn_date).toLocaleDateString() : (grn.edited_at ? new Date(grn.edited_at).toLocaleDateString() : 'N/A')}
                    </td>
                    
                    {activeTab === 'EDITED' ? (
                      <>
                        <td className="px-6 py-4">
                          <div className="text-gray-900 font-medium">{grn.edited_by || 'Unknown'}</div>
                          <div className="text-[10px] text-gray-400">
                            {grn.edited_at ? new Date(grn.edited_at).toLocaleString() : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-gray-500 italic" title={grn.edit_reason}>
                          "{grn.edit_reason || 'No reason provided'}"
                        </td>
                      </>
                    ) : (
                      <td className="px-6 py-4 font-medium text-gray-800">{grn.vendorName || 'No Vendor Selected'}</td>
                    )}
                    
                    {activeTab === 'CANCELLED' && (
                      <>
                        <td className="px-6 py-4">
                          <div className="text-gray-900 font-medium">{grn.cancelled_by || 'System'}</div>
                          <div className="text-[10px] text-gray-400">
                            {grn.cancelled_at ? new Date(grn.cancelled_at).toLocaleString() : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-gray-500 italic" title={grn.cancellation_reason}>
                          "{grn.cancellation_reason || 'No reason provided'}"
                        </td>
                      </>
                    )}

                  {activeTab !== 'EDITED' && (
                    <td className="px-6 py-4 text-right">
                      <div className="font-black text-slate-900">
                        ₹{parseFloat(grn.finalAmount ?? (grn.total_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {grn.finalAmount == null && (
                        <div className="text-[10px] text-amber-500 font-bold italic">Missing finalAmount</div>
                      )}
                      {(grn.discountValue > 0 || grn.transportCharges > 0 || grn.otherCharges > 0) && (
                        <div className="text-[10px] text-gray-400 font-normal">
                          subtotal ₹{parseFloat(grn.total_amount || grn.subtotal || 0).toLocaleString()}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center gap-1">
                      {activeTab === 'EDITED' ? (
                        <button 
                          onClick={() => {
                            // Logic to show snapshot comparison could go here
                            // For now, just view the original GRN details if possible
                            handleViewDetails(grn.grn_id);
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-all"
                          title="View Original Snapshot"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleViewDetails(grn.id)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDownloadPdf(grn.id, grn.grn_number)}
                            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                            title="Download PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          
                          {activeTab === 'ACTIVE' && canEditGrn && (
                            <>
                              <button 
                                onClick={() => handleEditClick(grn)}
                                className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-all"
                                title="Edit GRN"
                              >
                                <Pencil className="w-4 h-4" /> 
                              </button>
                              <button 
                                onClick={() => handleCancelClick(grn)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                                title="Cancel GRN"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create GRN Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm overflow-y-auto pt-20 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden my-auto mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Package className="w-5 h-5 mr-2 text-blue-600" />
                {isEditMode ? `Edit GRN: ${grns.find(g => g.id === editingGrnId)?.grn_number}` : 'Create New GRN'}
                {isEditMode && isUsedForEdit && (
                  <span className="ml-3 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] uppercase font-bold rounded-full border border-amber-200 flex items-center">
                    <Lock className="w-3 h-3 mr-1" /> Metadata-Only Mode
                  </span>
                )}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* 🛡️ PROCUREMENT GOVERNANCE SECTION */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white mr-3">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 tracking-tight">Procurement Authorization</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Controlled Procurement Validation</p>
                    </div>
                  </div>
                  
                  {hasPermission('grn', 'view') && (
                    <label className="flex items-center cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={isEmergency}
                        onChange={(e) => {
                          setIsEmergency(e.target.checked);
                          if (e.target.checked) setPoId('');
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600 relative"></div>
                      <span className="ml-3 text-xs font-black text-slate-500 group-hover:text-rose-600 transition-colors uppercase tracking-widest">Emergency Manual GRN</span>
                    </label>
                  )}
                </div>

                {!isEmergency ? (
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Link Purchase Order (PO)</label>
                    <select 
                      required={!isEmergency}
                      value={poId}
                      onChange={async (e) => {
                        const pid = e.target.value;
                        setPoId(pid);
                        // Auto-fill vendor and items if PO selected
                        if (pid) {
                          const po = purchaseOrders.find(p => p.id == pid);
                          if (po) {
                            setVendorName(po.vendor_name);
                            // Fetch PO items from backend
                            try {
                              const headers = createAuthHeaders();
                              const poRes = await fetch(`${API_CONFIG.BASE_URL}/procurement/po/${pid}`, { headers });
                              if (poRes.ok) {
                                const poData = await poRes.json();
                                // Filter only pending items (remaining quantity > 0)
                                const pendingItems = poData.items
                                  .filter((item: any) => (parseFloat(item.quantity) - parseFloat(item.received_quantity || 0)) > 0.01)
                                  .map((item: any) => ({
                                    inventory_id: String(item.inventory_id),
                                    item_name: item.item_name,
                                    quantity: (parseFloat(item.quantity) - parseFloat(item.received_quantity || 0)).toString(),
                                    rate: String(item.approved_rate || 0),
                                    totalAmount: String((parseFloat(item.quantity) - parseFloat(item.received_quantity || 0)) * parseFloat(item.approved_rate || 0))
                                  }));
                                setItems(pendingItems);
                              }
                            } catch (error) {
                              console.error("Failed to fetch PO items:", error);
                            }
                          }
                        } else {
                          // Clear items if PO is unselected
                          setItems([]);
                        }
                      }}
                      className="w-full px-4 py-3 bg-white border-blue-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    >
                      <option value="">Select Authorized PO...</option>
                      {purchaseOrders.filter(p => p.po_status !== 'FULFILLED' && parseFloat(p.total_remaining_quantity || 0) > 0.01).map(p => (
                        <option key={p.id} value={p.id}>{p.po_number} - {p.vendor_name} ({p.project_name}) | Remaining: {parseFloat(p.total_remaining_quantity || 0).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="md:col-span-2 space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black text-rose-600 uppercase tracking-wider ml-1 flex items-center">
                      <ShieldAlert className="w-3 h-3 mr-1.5" />
                      Emergency Justification (Mandatory)
                    </label>
                    <textarea 
                      required={isEmergency}
                      value={emergencyReason}
                      onChange={(e) => setEmergencyReason(e.target.value)}
                      placeholder="Explain why this GRN is being created without a formal Purchase Order..."
                      className="w-full px-4 py-3 bg-rose-50 border-rose-200 rounded-xl text-sm font-bold focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-50 outline-none transition-all h-20 resize-none"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Vendor <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <select
                    value={vendorName}
                    onChange={e => {
                      const selectedName = e.target.value;
                      setVendorName(selectedName);
                      
                      // Auto-fill GST number from master data
                      const vendor = masterVendors.find(v => v.vendor_name === selectedName);
                      if (vendor && vendor.gst_number) {
                        setGstNumber(vendor.gst_number);
                      } else if (!selectedName) {
                        setGstNumber(''); // Clear if selection is reset
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Vendor...</option>
                    {masterVendors.map(v => (
                      <option key={v.id} value={v.vendor_name}>{v.vendor_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST No <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={e => setGstNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 27AABCU9603R1ZX"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    required
                    min={minDateStr}
                    max={todayStr}
                    value={grnDate}
                    onChange={e => setGrnDate(e.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {currentUser?.backdateLimit !== -1 && (
                    <p className="text-[10px] text-gray-500 mt-1 italic">
                      {currentUser?.backdateLimit === 0 
                        ? 'You can only create GRN for today\'s date.' 
                        : `You can backdate up to ${currentUser?.backdateLimit} day(s).`}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-700 px-2 uppercase tracking-wider">Received Items</h4>
                  {!isUsedForEdit && (
                    <button 
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-white px-3 py-1.5 rounded-md border border-blue-200 shadow-sm"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Row
                    </button>
                  )}
                  {isUsedForEdit && (
                    <div className="text-[10px] text-amber-600 font-medium flex items-center bg-amber-50 px-3 py-1 rounded border border-amber-100">
                      <Lock className="w-2.5 h-2.5 mr-1" /> Items Locked (Already Issued)
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50 p-3 rounded-lg border border-gray-100 relative">
                      <div className="md:col-span-5">
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Inventory Item</label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={toMaterialOptions(inventory)}
                              value={item.inventory_id}
                              onChange={(val: any) => updateItem(index, 'inventory_id', val)}
                              placeholder="Choose item..."
                              disabled={isUsedForEdit}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={isUsedForEdit}
                            onClick={() => {
                              setQuickRegisterRowIndex(index);
                              setQuickRegisterOpen(true);
                            }}
                            className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${isUsedForEdit ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                          placeholder="0.00"
                          disabled={isUsedForEdit}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Estimated Rate (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.rate}
                          onChange={e => updateItem(index, 'rate', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${isUsedForEdit ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                          placeholder="0.00"
                          disabled={isUsedForEdit}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Estimated Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.totalAmount}
                          onChange={e => updateItem(index, 'totalAmount', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${isUsedForEdit ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'}`}
                          placeholder="0.00"
                          disabled={isUsedForEdit}
                        />
                      </div>
                      {!isUsedForEdit && items.length > 1 && (
                        <div className="md:col-span-1 text-right">
                          <button 
                            type="button" 
                            onClick={() => removeItem(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                      Click "Add Row" to start adding received materials.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 flex flex-col md:flex-row justify-between items-start gap-4">
                {/* Remarks */}
                <div className="w-full md:max-w-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-bold">Additional Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none h-16 text-sm"
                    placeholder="Reference PO number, delivery notes, etc."
                  />
                </div>

                {/* Totals */}
                <div className="w-full md:w-auto md:min-w-[280px] space-y-3">
                  {(() => {
                    const subtotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.totalAmount) || 0), 0);

                    return (
                      <>
                        {/* Subtotal */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-medium">Estimated Subtotal</span>
                          <span className="font-bold text-gray-800">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200" />

                        {/* Final Total */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Estimated Total</span>
                          <span className="text-3xl font-black text-blue-800">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                {isEditMode && (
                  <div className="flex-1 mr-4">
                    <input 
                      type="text"
                      required
                      placeholder="Mandatory reasoning for edit..."
                      value={editReason}
                      onChange={e => setEditReason(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-amber-50"
                    />
                  </div>
                )}
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  disabled={submitting || (isEditMode ? !canEditGrn : !canCreate('grn'))}
                  className={`px-8 py-2.5 ${isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-sm font-bold rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center`}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    isEditMode ? 'Update GRN & Recalculate' : 'Save & Finalize GRN'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GrnViewModal
        grn={viewingGrn}
        onClose={() => setViewingGrn(null)}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* Cancellation Reason Modal */}
      {cancellingGrn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-red-50">
              <h3 className="text-lg font-bold text-red-700 flex items-center">
                <X className="w-5 h-5 mr-2" />
                Cancel GRN: {cancellingGrn.grn_number}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed">
                <strong>Warning:</strong> Cancelling this GRN will reverse all inventory quantities and valuations added by this entry. This action cannot be undone.
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Reason for Cancellation</label>
                <textarea
                  required
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 h-24 text-sm"
                  placeholder="Explain why this GRN is being cancelled..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button 
                  onClick={() => setCancellingGrn(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Go Back
                </button>
                <button 
                  onClick={handleCancelSubmit}
                  className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Basic Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #grn-printable, #grn-printable * { visibility: visible; }
          #grn-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <QuickRegisterMaterialModal
        isOpen={quickRegisterOpen}
        onClose={() => setQuickRegisterOpen(false)}
        onMaterialCreated={handleMaterialCreated}
        categories={categories}
        units={masterUnits}
      />
    </div>
  );
}
