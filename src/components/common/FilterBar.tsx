import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface FilterBarProps {
  searchPlaceholder: string;
  filterType: 'vendor' | 'contractor' | 'none';
  entities?: { id: number | string; name: string }[];
  onChange: (filters: { search: string; fromDate: string; toDate: string; entityId?: string }) => void;
}

export function FilterBar({ searchPlaceholder, filterType, entities = [], onChange }: FilterBarProps) {
  const [search, setSearch] = useState('');
  const [entityId, setEntityId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Use a debounced effect for search to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ search, fromDate, toDate, entityId });
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fromDate, toDate, entityId]);

  const handleReset = () => {
    setSearch('');
    setEntityId('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="flex flex-wrap items-end gap-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
      {/* Search Input */}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Quick Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Entity Filter (Vendor or Contractor) */}
      {filterType !== 'none' && (
        <div className="min-w-[150px]">
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">
            {filterType === 'vendor' ? 'Vendor' : 'Contractor'}
          </label>
          <select
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{filterType === 'vendor' ? 'All Vendors' : 'All Contractors'}</option>
            {entities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date Range */}
      <div className="flex items-end space-x-2">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Date Range</label>
          <input 
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="pb-2 text-gray-400">→</div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">&nbsp;</label>
          <input 
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Reset Button */}
      <button 
        type="button"
        onClick={handleReset}
        className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors mb-0.5"
      >
        Reset
      </button>
    </div>
  );
}
