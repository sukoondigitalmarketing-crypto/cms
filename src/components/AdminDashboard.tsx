import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Briefcase,
  Users,
  ShoppingCart,
  Percent,
  Truck,
  PackagePlus,
  Wallet,
  Package,
  ReceiptText,
  FileWarning
} from 'lucide-react';
import { API_CONFIG } from '../config';
import { createAuthHeaders } from '../services/api';
import { formatCurrency, formatCompactCurrency } from '../services/format';

function StatCard({ title, value, icon, trend, trendType, subtitle, onClick }: any) {
  const valStr = String(value);
  const isVeryLong = valStr.length > 10;
  const isLong = valStr.length > 7;
  
  const valueSizeClass = isVeryLong 
    ? 'text-lg sm:text-xl' 
    : isLong 
      ? 'text-xl sm:text-2xl' 
      : 'text-2xl sm:text-3xl';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left bg-white px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${trendType === 'danger' ? 'bg-red-50 text-red-600' : 
                                         trendType === 'warning' ? 'bg-amber-50 text-amber-600' : 
                                         'bg-blue-50 text-blue-600'}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-bold ${trendType === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendType === 'success' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trend}
          </div>
        )}
      </div>
      <div className="mt-auto">
        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate" title={title}>{title}</p>
        <h4 className={`${valueSizeClass} font-bold text-gray-900 tracking-tight leading-tight truncate`} title={valStr}>{value}</h4>
        {subtitle && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">{subtitle}</p>}
      </div>
    </button>
  );
}

interface AdminDashboardProps {
  onNavigate?: (url: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/dashboard-summary`, {
        headers: createAuthHeaders()
      });
      if (response.ok) {
        setData(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!data) return <div className="p-8 text-center text-gray-500">Failed to load dashboard data.</div>;

  const navigateToPendingGrns = () => onNavigate?.('/grn?invoiceStatus=PENDING');
  const navigateToOverduePendingGrns = () => onNavigate?.('/grn?invoiceStatus=PENDING&pendingOlderThanDays=30');

  return (
    <div className="space-y-8 p-2">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Executive Overview</h1>
          <p className="text-gray-500 mt-1">Real-time financial performance across all construction projects.</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Last Updated</p>
          <p className="text-sm font-black text-gray-900">{new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="Total Payments Received" 
          value={formatCompactCurrency(data.totalPaymentsReceived || 0)} 
          icon={<Wallet className="w-6 h-6" />} 
          trendType="success"
        />
        <StatCard 
          title="Total Expense" 
          value={formatCompactCurrency(data.expense || 0)} 
          icon={<DollarSign className="w-6 h-6" />} 
          trendType="default"
        />
        <StatCard 
          title="Gross Profit" 
          value={formatCompactCurrency(data.profit || 0)} 
          icon={<CheckCircle2 className="w-6 h-6" />} 
          trendType={data.profit >= 0 ? 'success' : 'danger'}
        />
        <StatCard 
          title="Inventory Asset Value" 
          value={formatCompactCurrency(data.inventoryAssetValue || 0)} 
          icon={<Package className="w-6 h-6" />} 
          trendType="default"
        />
        <StatCard 
          title="Pending Approvals" 
          value={data.pendingCount} 
          icon={<Clock className="w-6 h-6" />} 
          trendType={data.pendingCount > 0 ? 'warning' : 'success'}
        />
        <StatCard 
          title="Pending PRs" 
          value={data.pendingPRsCount || 0} 
          icon={<Clock className="w-6 h-6" />} 
          trendType={(data.pendingPRsCount || 0) > 0 ? 'warning' : 'success'}
        />
        <StatCard 
          title="Awaiting PO Creation" 
          value={data.awaitingPOCreation || 0} 
          icon={<Clock className="w-6 h-6" />} 
          trendType={(data.awaitingPOCreation || 0) > 0 ? 'warning' : 'success'}
        />
        <StatCard 
          title="Discount Given" 
          value={formatCompactCurrency(data.totalDiscount || 0)} 
          icon={<Percent className="w-6 h-6" />} 
          trendType="warning"
        />
        <StatCard 
          title="Transport Charges" 
          value={formatCompactCurrency(data.totalTransport || 0)} 
          icon={<Truck className="w-6 h-6" />} 
          trendType="default"
        />
        <StatCard 
          title="Other Charges" 
          value={formatCompactCurrency(data.totalOtherCharges || 0)} 
          icon={<PackagePlus className="w-6 h-6" />} 
          trendType="default"
        />
      </div>

      {/* Vendor Invoice Monitoring */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight">Vendor Invoice Monitoring</h2>
          <p className="text-sm text-gray-500">Goods receipts awaiting vendor invoice creation.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <StatCard
            title="Awaiting Vendor Invoice"
            value={data.vendorInvoiceMonitoring?.awaitingVendorInvoice || 0}
            icon={<ReceiptText className="w-6 h-6" />}
            trendType={(data.vendorInvoiceMonitoring?.awaitingVendorInvoice || 0) > 0 ? 'warning' : 'success'}
            onClick={navigateToPendingGrns}
          />
          <StatCard
            title="Overdue Vendor Invoices"
            value={data.vendorInvoiceMonitoring?.overdueVendorInvoices || 0}
            subtitle=">30 Days"
            icon={<FileWarning className="w-6 h-6" />}
            trendType={(data.vendorInvoiceMonitoring?.overdueVendorInvoices || 0) > 0 ? 'danger' : 'success'}
            onClick={navigateToOverduePendingGrns}
          />
          <StatCard
            title="Pending Invoice Value"
            value={formatCompactCurrency(data.vendorInvoiceMonitoring?.pendingInvoiceValue || 0)}
            icon={<DollarSign className="w-6 h-6" />}
            trendType={(data.vendorInvoiceMonitoring?.pendingInvoiceValue || 0) > 0 ? 'warning' : 'success'}
            onClick={navigateToPendingGrns}
          />
        </div>
      </section>

      {/* Top Projects by Expense — full width row */}
      <div className="mt-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-gray-900 flex items-center">
              <Briefcase className="w-5 h-5 mr-3 text-blue-600" />
              Top Projects by Expenditure
            </h3>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">Top 5</span>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b border-gray-50">
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4 text-right">Material Cost</th>
                  <th className="px-6 py-4 text-right">Contractor Cost</th>
                  <th className="px-6 py-4 text-right">Total Expense</th>
                  <th className="px-6 py-4 text-right">Est. Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topProjects.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(p.materialCost || 0)}</td>
                    <td className="px-6 py-4 text-right text-indigo-600">{formatCurrency(p.contractorCost || 0)}</td>
                    <td className="px-6 py-4 text-right font-black text-blue-600">{formatCurrency(p.expense || 0)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(p.profit || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Contractors + Vendors — 2-column row below */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
        {/* Top Contractors */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-3 text-indigo-600" />
              Highest Paid Contractors
            </h3>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">Active</span>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b border-gray-50">
                  <th className="px-6 py-4">Contractor Name</th>
                  <th className="px-6 py-4 text-right">Total Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topContractors.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold text-gray-900">{c.contractor_name}</td>
                    <td className="px-6 py-4 text-right font-black text-indigo-600">₹{Math.round(c.total_paid).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Vendors by GRN Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-gray-900 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-3 text-emerald-600" />
              Top Vendor Payments
            </h3>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">By GRN</span>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b border-gray-50">
                  <th className="px-6 py-4">Vendor Name</th>
                  <th className="px-6 py-4 text-right">GRNs</th>
                  <th className="px-6 py-4 text-right">Total Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data.topVendors || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">No vendor payments recorded yet.</td>
                  </tr>
                ) : (
                  (data.topVendors || []).map((v: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-bold text-gray-900">{v.vendor_name}</td>
                      <td className="px-6 py-4 text-right text-gray-500 font-medium">{v.grn_count}</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">{formatCurrency(v.total_paid || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
