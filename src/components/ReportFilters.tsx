import React from 'react';
import { Search, Filter, X, Calendar, Building2, Package, User } from 'lucide-react';

interface ReportFiltersProps {
  filters: {
    from_date: string;
    to_date: string;
    project_id: string;
    vendor: string;
    inventory_id: string;
    category: string;
    grn_no: string;
  };
  setFilters: (filters: any) => void;
  projects: any[];
  vendors: any[];
  items: any[];
  categories: any[];
  onClear: () => void;
}

export function ReportFilters({ 
  filters, 
  setFilters, 
  projects, 
  vendors, 
  items, 
  categories,
  onClear 
}: ReportFiltersProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Filter className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-800 tracking-tight">Report Filters</h3>
        </div>
        <button 
          onClick={onClear}
          className="flex items-center text-sm font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
        >
          <X className="w-4 h-4 mr-1" />
          Reset All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Date Range */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              name="from_date"
              value={filters.from_date}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              name="to_date"
              value={filters.to_date}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
            />
          </div>
        </div>

        {/* Project Selection */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Project</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              name="project_id"
              value={filters.project_id}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium appearance-none"
            >
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Item Selection */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Item</label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              name="inventory_id"
              value={filters.inventory_id}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium appearance-none"
            >
              <option value="">All Items</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
            </select>
          </div>
        </div>

        {/* Vendor Selection */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Vendor</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              name="vendor"
              value={filters.vendor}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium appearance-none"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.vendor_name}>{v.vendor_name}</option>)}
            </select>
          </div>
        </div>

        {/* Category Selection */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              name="category"
              value={filters.category}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium appearance-none"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.category_name}>{c.category_name}</option>)}
            </select>
          </div>
        </div>

        {/* GRN No Search */}
        <div className="space-y-1.5 lg:col-span-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference No (GRN/Issue)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              name="grn_no"
              value={filters.grn_no}
              onChange={handleChange}
              placeholder="Search by Reference Number..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
