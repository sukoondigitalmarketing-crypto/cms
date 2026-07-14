import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  FileText, 
  Package, 
  ClipboardList, 
  Download, 
  Printer,
  ChevronRight,
  TrendingUp,
  History,
  ShoppingCart,
  HardHat,
  ShieldCheck
} from 'lucide-react';
import { API_CONFIG } from '../config';
import { getAuthToken } from '../services/api';
import { ReportFilters } from './ReportFilters';
import { InventoryLedgerReport } from './reports/InventoryLedgerReport';
import { GrnRegisterReport } from './reports/GrnRegisterReport';
import { MaterialConsumptionReport } from './reports/MaterialConsumptionReport';
import { ProjectConsumptionReport } from './reports/ProjectConsumptionReport';
import { ProcurementRegisterReport } from './reports/ProcurementRegisterReport';

type ReportType = 'inventory-ledger' | 'grn-register' | 'material-consumption' | 'project-consumption' | 'procurement-register';

export function ReportsDashboard() {
  const [activeReport, setActiveReport] = useState<ReportType>('inventory-ledger');
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    project_id: '',
    vendor: '',
    inventory_id: '',
    category: '',
    grn_no: ''
  });

  const clearFilters = () => {
    setFilters({
      from_date: '',
      to_date: '',
      project_id: '',
      vendor: '',
      inventory_id: '',
      category: '',
      grn_no: ''
    });
  };

  useEffect(() => {
    const fetchMasters = async () => {
      const token = getAuthToken();
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        const [pRes, vRes, iRes, cRes] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}/master/projects`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/master/vendors`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/inventory`, { headers }),
          fetch(`${API_CONFIG.BASE_URL}/master/categories`, { headers })
        ]);
        
        const [pData, vData, iData, cData] = await Promise.all([
          pRes.json(), vRes.json(), iRes.json(), cRes.json()
        ]);
        
        setProjects(Array.isArray(pData) ? pData : []);
        setVendors(Array.isArray(vData) ? vData : []);
        setItems(Array.isArray(iData) ? iData : []);
        setCategories(Array.isArray(cData) ? cData : []);
      } catch (err) {
        console.error("Failed to fetch masters for reports", err);
      }
    };
    
    fetchMasters();
  }, []);

  const reports = [
    { 
      id: 'inventory-ledger' as ReportType, 
      name: 'Inventory Ledger', 
      desc: 'Stock movement lifecycle tracking',
      icon: <History className="w-5 h-5" />,
      color: 'blue'
    },
    { 
      id: 'procurement-register' as ReportType, 
      name: 'Procurement Register', 
      desc: 'PO vs Received quantity audit',
      icon: <ShieldCheck className="w-5 h-5" />,
      color: 'indigo'
    },
    { 
      id: 'grn-register' as ReportType, 
      name: 'GRN Register', 
      desc: 'Inward material receipt audit',
      icon: <ShoppingCart className="w-5 h-5" />,
      color: 'indigo'
    },
    { 
      id: 'material-consumption' as ReportType, 
      name: 'Material Consumption', 
      desc: 'GRN-wise issuance traceability',
      icon: <Package className="w-5 h-5" />,
      color: 'emerald'
    },
    { 
      id: 'project-consumption' as ReportType, 
      name: 'Project Costing', 
      desc: 'Project-level material expense',
      icon: <HardHat className="w-5 h-5" />,
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">OPERATIONAL INTELLIGENCE</h1>
          <p className="text-slate-500 font-medium">ERP Reporting & Financial Visibility Portal</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl shadow-sm flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-slate-100 uppercase tracking-widest">Live Database Truth</span>
          </div>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id)}
            className={`group p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
              activeReport === report.id 
                ? 'bg-white border-blue-500 shadow-md ring-4 ring-blue-50' 
                : 'bg-white border-transparent hover:border-slate-200 shadow-sm'
            }`}
          >
            <div className={`p-3 rounded-xl w-fit mb-4 transition-colors ${
              activeReport === report.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
            }`}>
              {report.icon}
            </div>
            <h3 className={`font-bold transition-colors ${activeReport === report.id ? 'text-blue-600' : 'text-slate-800'}`}>
              {report.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{report.desc}</p>
            
            {activeReport === report.id && (
              <div className="absolute top-4 right-4 text-blue-500">
                <ChevronRight className="w-5 h-5" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Global Filter Engine */}
      <ReportFilters 
        filters={filters}
        setFilters={setFilters}
        projects={projects}
        vendors={vendors}
        items={items}
        categories={categories}
        onClear={clearFilters}
      />

      {/* Active Report View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {activeReport === 'inventory-ledger' && (
          <InventoryLedgerReport
            filters={filters}
            items={items}
            onSelectItem={(inventoryId: string) => setFilters((prev: any) => ({ ...prev, inventory_id: inventoryId }))}
          />
        )}
        {activeReport === 'procurement-register' && <ProcurementRegisterReport />}
        {activeReport === 'grn-register' && <GrnRegisterReport filters={filters} />}
        {activeReport === 'material-consumption' && <MaterialConsumptionReport filters={filters} />}
        {activeReport === 'project-consumption' && <ProjectConsumptionReport filters={filters} />}
      </div>
    </div>
  );
}
