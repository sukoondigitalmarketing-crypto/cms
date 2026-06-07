import React, { useState, useEffect } from 'react';
import { ShoppingCart, Download, Printer } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';

interface GrnRegisterReportProps {
  filters: any;
}

export function GrnRegisterReport({ filters }: GrnRegisterReportProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const queryParams = new URLSearchParams({
          from_date: filters.from_date,
          to_date: filters.to_date,
          vendor: filters.vendor,
          project_id: filters.project_id,
          inventory_id: filters.inventory_id
        });

        const response = await fetch(`${API_CONFIG.BASE_URL}/reports/grn-register?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await response.json();
        setData(Array.isArray(resData) ? resData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const handleExport = async () => {
    if (data.length === 0) return;
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/export/excel`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'GRN Register Report',
          columns: [
            { header: 'GRN No', key: 'grn_number', width: 15 },
            { header: 'Date', key: 'grn_date', width: 15 },
            { header: 'Vendor', key: 'vendor_name', width: 25 },
            { header: 'Item', key: 'item_name', width: 30 },
            { header: 'Qty', key: 'quantity', width: 12 },
            { header: 'Rate (₹)', key: 'unit_rate', width: 15 },
            { header: 'Taxable (₹)', key: 'taxable_value', width: 15 },
            { header: 'Final (₹)', key: 'total_amount', width: 15 },
            { header: 'Project', key: 'project_name', width: 20 },
            { header: 'Created By', key: 'created_by', width: 15 }
          ],
          data: data.map(row => ({
            ...row,
            grn_date: new Date(row.grn_date).toLocaleDateString(),
            unit_rate: parseFloat(row.unit_rate).toFixed(2),
            taxable_value: parseFloat(row.taxable_value).toFixed(2),
            total_amount: parseFloat(row.total_amount).toFixed(2)
          }))
        })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'GRN_Register_Report.xlsx'; a.click();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <ShoppingCart className="w-6 h-6 mr-3 text-indigo-600" />
            GRN REGISTER
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Procurement audit & Inward Register</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">GRN / Date</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor / GST</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item / Project</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rate</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={6} className="py-20 text-center"><div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mx-auto"></div></td></tr>
            ) : data.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-4">
                  <div className="text-sm font-black text-slate-800">{row.grn_number}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(row.grn_date).toLocaleDateString()}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-bold text-slate-700">{row.vendor_name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{row.gstNumber || 'No GST'}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-bold text-slate-800">{row.item_name}</div>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{row.project_name || 'Central Store'}</div>
                </td>
                <td className="py-4 text-sm font-black text-slate-700 text-right">{row.quantity}</td>
                <td className="py-4 text-sm font-medium text-slate-500 text-right">₹{parseFloat(row.unit_rate).toLocaleString()}</td>
                <td className="py-4 text-sm font-black text-indigo-600 text-right">₹{parseFloat(row.taxable_value).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && data.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400 text-sm font-medium">No procurement records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
