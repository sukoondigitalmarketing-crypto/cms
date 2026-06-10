import React, { useState, useEffect } from 'react';
import { ShoppingCart, Download, Search, Filter, Calendar, FileText, CheckCircle2, Clock } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';

export function ProcurementRegisterReport() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/procurement-register`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const result = await response.json();
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExport = async () => {
    try {
      const columns = [
        { header: 'PO Number', key: 'po_number' },
        { header: 'Date', key: 'po_date' },
        { header: 'Vendor', key: 'vendor_name' },
        { header: 'Project', key: 'project_name' },
        { header: 'Item', key: 'item_name' },
        { header: 'Authorized Qty', key: 'authorized_qty' },
        { header: 'Received Qty', key: 'received_quantity' },
        { header: 'Pending Qty', key: 'pending_qty' },
        { header: 'Tentative Rate', key: 'tentative_rate' },
        { header: 'Tentative Value', key: 'tentative_value' },
        { header: 'GRN Actual Value', key: 'grn_actual_value' },
        { header: 'Status', key: 'po_status' }
      ];

      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/export/excel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          title: 'Procurement_Register_Report',
          columns,
          data: data.map(row => ({
            ...row,
            po_date: new Date(row.po_date).toLocaleDateString()
          }))
        })
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Procurement_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
    } catch (e) {
      alert('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <ShoppingCart className="w-6 h-6 mr-3 text-indigo-600" />
            Procurement Register
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">PO instruction vs GRN actual procurement audit report</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            EXPORT EXCEL
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search PO#, Vendor, or Item..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">PO Detail</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Authorized Qty</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Received Qty</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Pending Qty</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Tentative</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">GRN Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.filter(row => 
                row.po_number.toLowerCase().includes(search.toLowerCase()) ||
                row.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
                row.item_name.toLowerCase().includes(search.toLowerCase())
              ).map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[10px]">
                        PO
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{row.po_number} <span className="text-[10px] text-indigo-500 font-bold ml-2">v{row.version}</span></p>
                        <p className="text-[11px] font-bold text-slate-500">{row.vendor_name} • {row.item_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">{row.authorized_qty}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Tentative: ₹{row.tentative_rate}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-emerald-600">{row.received_quantity}</span>
                      {row.received_quantity >= row.authorized_qty && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${row.pending_qty > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {row.pending_qty}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-black text-slate-900">₹{Number(row.tentative_value || 0).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-black text-emerald-700">₹{Number(row.grn_actual_value || 0).toLocaleString()}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
