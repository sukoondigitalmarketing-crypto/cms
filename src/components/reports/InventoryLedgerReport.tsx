import React, { useState, useEffect } from 'react';
import { History, Download, Printer, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { API_CONFIG } from '../../config';
import { getAuthToken } from '../../services/api';

interface InventoryLedgerReportProps {
  filters: any;
  items: any[];
}

export function InventoryLedgerReport({ filters, items }: InventoryLedgerReportProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!filters.inventory_id) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const token = getAuthToken();
        const queryParams = new URLSearchParams({
          inventory_id: filters.inventory_id,
          from_date: filters.from_date,
          to_date: filters.to_date,
          project_id: filters.project_id
        });

        const response = await fetch(`${API_CONFIG.BASE_URL}/reports/inventory-ledger?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch ledger data');
        const ledgerData = await response.json();
        setData(ledgerData);
      } catch (err: any) {
        setError(err.message);
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
      const selectedItem = items.find(i => i.id.toString() === filters.inventory_id.toString());
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/export/excel`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Inventory Ledger - ${selectedItem?.item_name || 'Item'}`,
          columns: [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Type', key: 'type', width: 12 },
            { header: 'Ref Type', key: 'ref_type', width: 15 },
            { header: 'Ref No', key: 'ref_no', width: 20 },
            { header: 'Qty In', key: 'qty_in', width: 12 },
            { header: 'Qty Out', key: 'qty_out', width: 12 },
            { header: 'Balance', key: 'running_balance', width: 15 },
            { header: 'Inv Value (₹)', key: 'inventory_value', width: 20 },
            { header: 'Project', key: 'project_name', width: 25 }
          ],
          data: data.map(row => ({
            ...row,
            date: new Date(row.date).toLocaleDateString()
          }))
        })
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Inventory_Ledger_${selectedItem?.item_name || 'Item'}.xlsx`;
      a.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  if (!filters.inventory_id) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <Info className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Please select an item to view its ledger</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <History className="w-6 h-6 mr-3 text-blue-600" />
            INVENTORY LEDGER
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Movement lifecycle & Valuation Audit</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleExport}
            disabled={data.length === 0}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold text-center uppercase">
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty In</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty Out</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Inv Value (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((row, idx) => (
                <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4 text-sm font-bold text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      row.type === 'INWARD' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {row.type === 'INWARD' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                      {row.type}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-black text-slate-800">{row.ref_no}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{row.ref_type} {row.project_name ? `• ${row.project_name}` : ''}</div>
                  </td>
                  <td className="py-4 text-sm font-bold text-green-600 text-right">{parseFloat(row.qty_in) > 0 ? `+${row.qty_in}` : '-'}</td>
                  <td className="py-4 text-sm font-bold text-red-600 text-right">{parseFloat(row.qty_out) > 0 ? `-${row.qty_out}` : '-'}</td>
                  <td className="py-4 text-sm font-black text-slate-900 text-right">{row.running_balance.toLocaleString()}</td>
                  <td className="py-4 text-sm font-black text-blue-600 text-right">₹{row.inventory_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-sm font-medium">No movement records found for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
