import React, { useState, useEffect } from 'react';
import { HardHat, Download, TrendingUp } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';

interface ProjectConsumptionReportProps {
  filters: any;
}

export function ProjectConsumptionReport({ filters }: ProjectConsumptionReportProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const queryParams = new URLSearchParams({
          project_id: filters.project_id,
          from_date: filters.from_date,
          to_date: filters.to_date
        });

        const response = await fetch(`${API_CONFIG.BASE_URL}/reports/project-consumption?${queryParams}`, {
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
          title: 'Project Consumption Costing Report',
          columns: [
            { header: 'Project', key: 'project_name', width: 25 },
            { header: 'Item', key: 'item_name', width: 30 },
            { header: 'Total Qty', key: 'total_qty', width: 15 },
            { header: 'Unit', key: 'unit', width: 10 },
            { header: 'Total FIFO Cost (₹)', key: 'total_fifo_cost', width: 20 },
            { header: 'Last Consumption', key: 'last_consumption_date', width: 15 }
          ],
          data: data.map(row => ({
            ...row,
            last_consumption_date: new Date(row.last_consumption_date).toLocaleDateString(),
            total_fifo_cost: parseFloat(row.total_fifo_cost).toFixed(2)
          }))
        })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Project_Consumption_Report.xlsx'; a.click();
    } catch (err) { console.error(err); }
  };

  const grandTotal = data.reduce((acc, row) => acc + parseFloat(row.total_fifo_cost), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <HardHat className="w-6 h-6 mr-3 text-amber-600" />
            PROJECT COSTING SUMMARY
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Project-level material expense aggregation</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Period Cost</span>
            <span className="text-lg font-black text-amber-600">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all disabled:opacity-50"
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
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Name</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Qty Consumed</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total FIFO Cost (₹)</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Last Movement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><div className="w-8 h-8 border-4 border-amber-600/20 border-t-amber-600 rounded-full animate-spin mx-auto"></div></td></tr>
            ) : data.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-4">
                  <div className="text-sm font-black text-slate-800">{row.project_name}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-bold text-slate-700">{row.item_name}</div>
                </td>
                <td className="py-4 text-right">
                  <div className="text-sm font-black text-slate-700">{row.total_qty}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{row.unit}</div>
                </td>
                <td className="py-4 text-right">
                  <div className="text-sm font-black text-amber-600">₹{parseFloat(row.total_fifo_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </td>
                <td className="py-4 text-right">
                  <div className="text-sm font-bold text-slate-500">{new Date(row.last_consumption_date).toLocaleDateString()}</div>
                </td>
              </tr>
            ))}
            {!loading && data.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-400 text-sm font-medium">No project consumption data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
