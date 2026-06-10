import React, { useState, useEffect } from 'react';
import { Package, Download, Search, Info } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';

interface MaterialConsumptionReportProps {
  filters: any;
}

export function MaterialConsumptionReport({ filters }: MaterialConsumptionReportProps) {
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
          project_id: filters.project_id,
          inventory_id: filters.inventory_id,
          grn_no: filters.grn_no
        });

        const response = await fetch(`${API_CONFIG.BASE_URL}/reports/material-consumption?${queryParams}`, {
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
          title: 'Material Consumption Report',
          columns: [
            { header: 'Date', key: 'issue_date', width: 15 },
            { header: 'GRN Source', key: 'grn_source', width: 15 },
            { header: 'Project', key: 'project_name', width: 25 },
            { header: 'Item', key: 'item_name', width: 30 },
            { header: 'Qty Issued', key: 'quantity_issued', width: 12 },
            { header: 'FIFO Cost (₹)', key: 'fifo_cost', width: 15 },
            { header: 'Issued To', key: 'issued_to', width: 20 },
            { header: 'Issued By', key: 'issued_by', width: 15 }
          ],
          data: data.map(row => ({
            ...row,
            issue_date: new Date(row.issue_date).toLocaleDateString(),
            fifo_cost: parseFloat(row.fifo_cost).toFixed(2)
          }))
        })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Material_Consumption_Report.xlsx'; a.click();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <Package className="w-6 h-6 mr-3 text-emerald-600" />
            MATERIAL CONSUMPTION
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Project-wise issues with FIFO Traceability</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700 space-x-2 mr-2">
            <Info className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">GRN-Source Integrity Verified</span>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50"
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
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / GRN Source</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project / Site Rep</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name / Category</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">FIFO Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><div className="w-8 h-8 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin mx-auto"></div></td></tr>
            ) : data.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-4">
                  <div className="text-sm font-black text-slate-800">{new Date(row.issue_date).toLocaleDateString()}</div>
                  <div className="flex items-center mt-1">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-tighter">SOURCE:</span>
                    <span className="ml-1 text-[10px] font-bold text-blue-600">{row.grn_source}</span>
                  </div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-bold text-slate-700">{row.project_name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rep: {row.issued_to}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-bold text-slate-800">{row.item_name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{row.category}</div>
                </td>
                <td className="py-4 text-sm font-black text-slate-700 text-right">{row.quantity_issued} <span className="text-[10px] text-slate-400">{row.unit}</span></td>
                <td className="py-4 text-sm font-black text-emerald-600 text-right">₹{parseFloat(row.fifo_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
            {!loading && data.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-400 text-sm font-medium">No consumption records found for selected period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
