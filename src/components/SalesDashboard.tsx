import React, { useState, useEffect } from 'react';
import { UserPlus, CreditCard, TrendingUp, Wallet, Clock, X } from 'lucide-react';
import { API_CONFIG, ROLE_PERMISSIONS } from '../config';
import { hasPermission } from '../rbac';
import { validateCustomerForm, validatePaymentForm } from '../services/validation';
import { createAuthHeaders } from '../services/api';
import { formatCurrency, formatCompactCurrency } from '../services/format';

interface SalesDashboardProps {
  role: string;
}

function KpiCard({ title, value, icon }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
      <div className="p-4 bg-gray-50 rounded-full mr-4 border border-gray-100">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-500 mb-1 truncate" title={title}>{title}</p>
        <h4 className="text-2xl font-bold text-gray-900 truncate" title={String(value)}>{value}</h4>
      </div>
    </div>
  );
}

export function SalesDashboard({ role }: SalesDashboardProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [customerErrors, setCustomerErrors] = useState<string[]>([]);
  const [paymentErrors, setPaymentErrors] = useState<string[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [plotNumber, setPlotNumber] = useState('');
  const [totalPayment, setTotalPayment] = useState('');

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState('');

  const permissions = ROLE_PERMISSIONS[role] || {};
  const canManageSales = hasPermission(role, 'customers', 'view');
  const canManageLedger = hasPermission(role, 'customers', 'create') || hasPermission(role, 'customers', 'edit');

  useEffect(() => {
    fetchCustomers();
    fetchLedger();
    
    const interval = setInterval(() => {
      fetchCustomers();
      fetchLedger();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/customers`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/ledger`, {
        headers: createAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data);
      }
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
    }
  };

  const totalExpected = customers.reduce((sum, c) => sum + (c.totalPayment || 0), 0);
  const totalReceived = customers.reduce((sum, c) => sum + (c.paymentReceived || 0), 0);
  const totalPending = customers.reduce((sum, c) => sum + (c.pendingPayment || 0), 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerErrors([]);

    const validation = validateCustomerForm({
      name: customerName,
      plotNumber,
      totalPayment,
    });

    if (!validation.isValid) {
      setCustomerErrors(validation.errors);
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/customers`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          name: customerName.trim(),
          plotNumber: plotNumber.trim().toUpperCase(),
          totalPayment: Number(totalPayment),
        })
      });

      if (response.ok) {
        setIsCustomerModalOpen(false);
        setCustomerName('');
        setPlotNumber('');
        setTotalPayment('');
        setCustomerErrors([]);
        fetchCustomers();
        alert('✅ Customer created successfully!');
      } else {
        const error = await response.json();
        setCustomerErrors([error.error || 'Failed to create customer']);
      }
    } catch (error) {
      setCustomerErrors(['Failed to create customer. Please try again.']);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentErrors([]);

    const customer = customers.find(c => String(c.id) === selectedCustomerId);
    const pendingPayment = customer?.pendingPayment || 0;

    const validation = validatePaymentForm(
      {
        customerId: selectedCustomerId,
        amount: paymentAmount,
        mode: paymentMode,
        date: paymentDate,
      },
      pendingPayment
    );

    if (!validation.isValid) {
      setPaymentErrors(validation.errors);
      return;
    }

    try {
      if (!customer) {
        setPaymentErrors(['Selected customer not found. Please refresh and try again.']);
        return;
      }

      const amountNum = Number(paymentAmount);

      // Record payment and update customer balance in one atomic transaction
      const response = await fetch(`${API_CONFIG.BASE_URL}/payments`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({
          customerId: selectedCustomerId,
          customerName: customer.name,
          plotNumber: customer.plotNumber,
          amount: amountNum,
          mode: paymentMode,
          date: paymentDate,
          type: 'CREDIT', // Use uppercase CREDIT as suggested
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to record payment');
      }

      setIsPaymentModalOpen(false);
      setSelectedCustomerId('');
      setPaymentAmount('');
      setPaymentMode('Bank Transfer');
      setPaymentDate('');
      setPaymentErrors([]);
      fetchCustomers();
      fetchLedger();
      alert('✅ Payment recorded successfully.');
    } catch (error: any) {
      setPaymentErrors([error.message || 'Failed to record payment. Please try again.']);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer & Ledger</h1>
          <p className="text-gray-500 text-sm mt-1">Track plot sales, customer ledgers, and payments.</p>
        </div>
        <div className="flex space-x-3">
          {canManageLedger && (
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Record Payment
            </button>
          )}
          {canManageSales && (
            <button 
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-3 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 flex items-center"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              New Customer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard className="truncate" title="Total Expected" value={formatCompactCurrency(totalExpected)} icon={<TrendingUp className="text-blue-500" />} />
        <KpiCard className="truncate" title="Total Received" value={formatCompactCurrency(totalReceived)} icon={<Wallet className="text-emerald-500" />} />
        <KpiCard className="truncate" title="Total Pending" value={formatCompactCurrency(totalPending)} icon={<Clock className="text-amber-500" />} />
        <KpiCard className="truncate" title="Collection Efficiency" value={`${totalExpected > 0 ? ((totalReceived/totalExpected)*100).toFixed(1) : 0}%`} icon={<CreditCard className="text-indigo-500" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Customer Directory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Customer & Plot</th>
                  <th className="px-6 py-3 font-medium text-right">Total Value</th>
                  <th className="px-6 py-3 font-medium text-right">Received</th>
                  <th className="px-6 py-3 font-medium text-right">Pending</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No customers found.
                    </td>
                  </tr>
                ) : customers.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">Plot: {c.plotNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{formatCurrency(c.totalPayment)}</div>
                      <div className="text-xs text-gray-500">Target Value</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-600">{formatCurrency(c.paymentReceived)}</div>
                      <div className="text-xs text-gray-500">Collected</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-amber-600">{formatCurrency(c.pendingPayment)}</div>
                      <div className="text-xs text-gray-500">Balance Due</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {c.pendingPayment === 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Cleared
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Recent Payment Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Mode</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No ledger entries found.
                    </td>
                  </tr>
                ) : ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-500">{entry.date}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{entry.customerName}</div>
                      <div className="text-xs text-gray-500">Plot: {entry.plotNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {entry.mode}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">
                      {formatCurrency(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                Add New Customer
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              {customerErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">❌ Please fix the following issues:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {customerErrors.map((error, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input 
                  type="text" 
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plot Number</label>
                <input 
                  type="text" 
                  required
                  value={plotNumber}
                  onChange={e => setPlotNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. A-101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Payment (₹)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={totalPayment}
                  onChange={e => setTotalPayment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                Record Payment
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {paymentErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">❌ Please fix the following issues:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {paymentErrors.map((error, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select 
                  required
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select a customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Plot: {c.plotNumber})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
                <input 
                  type="number" 
                  required
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select 
                  required
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input 
                  type="date" 
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
