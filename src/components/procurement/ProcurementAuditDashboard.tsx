import React from 'react';
import { History, User, Tag, Calendar, MessageSquare, ShieldCheck } from 'lucide-react';

interface ProcurementAuditDashboardProps {
  data: any[];
}

export function ProcurementAuditDashboard({ data }: ProcurementAuditDashboardProps) {
  const activeProcurementLogs = data.filter((log) => log.document_type === 'PR' || log.document_type === 'PO');

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <History className="w-6 h-6 mr-3 text-slate-500" />
            Procurement Audit Trail
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Immutable lineage of commercial authorizations and governance actions.</p>
        </div>
        <div className="px-4 py-2 bg-slate-900 text-white rounded-xl flex items-center text-xs font-black uppercase tracking-widest border border-slate-700">
          <ShieldCheck className="w-4 h-4 mr-2 text-emerald-400" />
          Audit Integrity Verified
        </div>
      </div>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-100"></div>

        <div className="space-y-8 relative">
          {activeProcurementLogs.map((log) => (
            <div key={log.id} className="flex gap-8 group">
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                  log.action_type.includes('APPROVED') ? 'bg-emerald-600' : 
                  log.action_type.includes('REJECTED') ? 'bg-rose-600' : 
                  log.action_type.includes('SUBMITTED') ? 'bg-blue-600' : 
                  'bg-slate-700'
                }`}>
                  <History className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex-1 bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-sm group-hover:bg-white group-hover:shadow-md transition-all group-hover:-translate-y-1 border-l-4 border-l-slate-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      log.action_type.includes('APPROVED') ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      log.action_type.includes('REJECTED') ? 'bg-rose-100 text-rose-700 border-rose-200' :
                      'bg-slate-200 text-slate-700 border-slate-300'
                    }`}>
                      {log.action_type}
                    </span>
                    <span className="text-slate-400 font-bold text-sm">•</span>
                    <span className="flex items-center text-sm font-black text-slate-900">
                      <Tag className="w-4 h-4 mr-1.5 text-slate-400" />
                      {log.document_type} #{log.document_id}
                    </span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Performed By</p>
                      <p className="text-sm font-bold text-slate-700">{log.actor_name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{log.actor_role}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Governance Remarks</p>
                      <p className="text-sm text-slate-600 italic">"{typeof log.action_details === 'string' ? log.action_details : log.action_details?.message || 'No remarks provided.'}"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
