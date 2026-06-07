import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck, Users, CheckCircle2, XCircle,
  ScrollText, Save, RotateCcw, Loader2
} from 'lucide-react';
import { API_CONFIG, ROLE_LABELS } from '../../config';
import { createAuthHeaders } from '../../services/api';
import {
  GOVERNANCE_ROLES, MATRIX_ACTIONS,
  RBAC_MODULES, hasPermission, type RbacAction
} from '../../rbac';
import { UserManagement } from '../UserManagement';

interface RbacMasterProps { userRole: string; }

interface UserPermsRaw {
  userId: number;
  userRole: string;
  effectivePermissions: Record<string, Record<string, boolean>>;
  overriddenPermissions: string[];
}

type PermDraft = Record<string, boolean>;

function buildDraft(effective: Record<string, Record<string, boolean>>): PermDraft {
  const draft: PermDraft = {};
  for (const mod of RBAC_MODULES) {
    for (const action of mod.actions) {
      draft[`${mod.key}:${action}`] = effective[mod.key]?.[action] ?? false;
    }
  }
  return draft;
}

export function RbacMaster({ userRole }: RbacMasterProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'audit'>('users');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // User Permission Matrix state
  const [selectedRole, setSelectedRole] = useState('');
  const [usersInRole, setUsersInRole] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userPermsRaw, setUserPermsRaw] = useState<UserPermsRaw | null>(null);
  const [draft, setDraft] = useState<PermDraft>({});
  const [isDirty, setIsDirty] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canManageRbac = hasPermission(userRole, 'rbac', 'manage_rbac');

  // ── Fetch audit logs ───────────────────────────────────────────
  useEffect(() => {
    if (!canManageRbac || activeTab !== 'audit') return;
    fetch(`${API_CONFIG.BASE_URL}/rbac/audit-logs`, { headers: createAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setAuditLogs)
      .catch(() => setAuditLogs([]));
  }, [activeTab, canManageRbac]);

  // ── Load users when role selected ─────────────────────────────
  useEffect(() => {
    if (!selectedRole || !canManageRbac) return;
    setLoadingUsers(true);
    setSelectedUser(null);
    setUserPermsRaw(null);
    setDraft({});
    setIsDirty(false);
    fetch(`${API_CONFIG.BASE_URL}/rbac/users-by-role/${selectedRole}`, { headers: createAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setUsersInRole)
      .catch(() => setUsersInRole([]))
      .finally(() => setLoadingUsers(false));
  }, [selectedRole, canManageRbac]);

  // ── Load user permissions when user selected ───────────────────
  const loadUserPerms = useCallback(async (userId: number) => {
    setLoadingPerms(true);
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/rbac/user-permissions/${userId}`,
        { headers: createAuthHeaders() }
      );
      const raw: UserPermsRaw = await res.json();
      setUserPermsRaw(raw);
      setDraft(buildDraft(raw.effectivePermissions));
      setIsDirty(false);
    } catch {
      setUserPermsRaw(null);
      setDraft({});
    } finally {
      setLoadingPerms(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedUser || !canManageRbac) return;
    loadUserPerms(selectedUser.id);
  }, [selectedUser, canManageRbac, loadUserPerms]);

  // ── Toggle a cell in the draft ─────────────────────────────────
  const toggleCell = (moduleKey: string, action: string) => {
    if (!canManageRbac) return;
    const key = `${moduleKey}:${action}`;
    setDraft(prev => ({ ...prev, [key]: !prev[key] }));
    setIsDirty(true);
    setSaveMsg(null);
  };

  // ── Reset draft to last-saved state ───────────────────────────
  const resetDraft = () => {
    if (!userPermsRaw) return;
    setDraft(buildDraft(userPermsRaw.effectivePermissions));
    setIsDirty(false);
    setSaveMsg(null);
  };

  // ── Save via batch endpoint ────────────────────────────────────
  const savePermissions = async () => {
    if (!selectedUser || !canManageRbac) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/rbac/user-permissions/${selectedUser.id}/batch`,
        {
          method: 'PUT',
          headers: createAuthHeaders(true),
          body: JSON.stringify({ permissions: draft }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveMsg({ type: 'err', text: d.error || 'Save failed' });
      } else {
        await loadUserPerms(selectedUser.id);
        setSaveMsg({ type: 'ok', text: `Permissions saved for ${selectedUser.name}` });
      }
    } catch (e: any) {
      setSaveMsg({ type: 'err', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const overriddenSet = new Set(userPermsRaw?.overriddenPermissions ?? []);

  const tabs = [
    { id: 'users',  label: 'User Management',       icon: <Users className="w-4 h-4" /> },
    { id: 'matrix', label: 'User Permission Matrix', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'audit',  label: 'Audit Logs',             icon: <ScrollText className="w-4 h-4" /> },
  ] as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">RBAC Master</h1>
        <p className="text-gray-500 text-sm mt-1">
          User-first permission governance. Role permissions are defaults — user permissions are the final authority.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200'
            }`}
          >
            {tab.icon}
            <span className="ml-2">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── USER MANAGEMENT ── */}
      {activeTab === 'users' && (
        canManageRbac
          ? <UserManagement />
          : <RestrictedPanel title="User Management is CEO-only" />
      )}

      {/* ── USER PERMISSION MATRIX ── */}
      {activeTab === 'matrix' && (
        canManageRbac ? (
          <div className="space-y-5">

            {/* Step 1 + 2: Role & User selectors */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-bold text-gray-900 mb-1">User Permission Matrix</h2>
              <p className="text-xs text-gray-500 mb-4">
                Select a role, then a user. Edit their individual permissions and save.
                Changes affect only the selected user — never other users in the same role.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Step 1 — Select Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={e => {
                      setSelectedRole(e.target.value);
                      setUsersInRole([]);
                      setSelectedUser(null);
                      setUserPermsRaw(null);
                      setDraft({});
                      setIsDirty(false);
                      setSaveMsg(null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">— Select a role —</option>
                    {GOVERNANCE_ROLES.filter(r => r !== 'CEO').map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Step 2 — Select User
                  </label>
                  <select
                    value={selectedUser?.id ?? ''}
                    onChange={e => {
                      const u = usersInRole.find(x => x.id === parseInt(e.target.value));
                      setSelectedUser(u ?? null);
                      setSaveMsg(null);
                    }}
                    disabled={!selectedRole || loadingUsers}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">
                      {loadingUsers
                        ? 'Loading users…'
                        : usersInRole.length === 0 && selectedRole
                          ? 'No users in this role'
                          : '— Select a user —'}
                    </option>
                    {usersInRole.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Permission matrix */}
            {selectedUser && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Matrix header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-gray-900">
                      Permissions — {selectedUser.name}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        ({ROLE_LABELS[userPermsRaw?.userRole ?? ''] || userPermsRaw?.userRole || selectedRole})
                      </span>
                    </h2>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Role default
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> User override (saved)
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Pending change
                      </span>
                    </div>
                  </div>

                  {/* Save / Reset actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isDirty && (
                      <button
                        onClick={resetDraft}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                    )}
                    <button
                      onClick={savePermissions}
                      disabled={saving || !isDirty}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {saving
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                        : <><Save className="w-3.5 h-3.5" /> Save Permissions</>
                      }
                    </button>
                  </div>
                </div>

                {/* Save feedback */}
                {saveMsg && (
                  <div className={`px-6 py-2 text-xs font-semibold border-b ${
                    saveMsg.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-red-50 text-red-700 border-red-100'
                  }`}>
                    {saveMsg.type === 'ok' ? '✓ ' : '✗ '}{saveMsg.text}
                  </div>
                )}

                {loadingPerms ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                    <p className="text-sm text-gray-400 mt-2">Loading permissions…</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-100">
                        <tr>
                          <th className="px-5 py-3 font-bold w-48">Module</th>
                          {MATRIX_ACTIONS.map(action => (
                            <th key={action} className="px-3 py-3 font-bold text-center">{action}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {RBAC_MODULES.map(mod => (
                          <tr key={mod.key} className="hover:bg-gray-50/60">
                            <td className="px-5 py-3 font-medium text-gray-800 text-sm">{mod.label}</td>
                            {MATRIX_ACTIONS.map(action => {
                              const key = `${mod.key}:${action}`;
                              const supported = (mod.actions as readonly RbacAction[]).includes(action);

                              if (!supported) {
                                return (
                                  <td key={action} className="px-3 py-3 text-center">
                                    <span className="text-gray-200 text-lg select-none">—</span>
                                  </td>
                                );
                              }

                              const currentVal = draft[key] ?? false;
                              const isSavedOverride = overriddenSet.has(key);
                              const loadedVal = userPermsRaw
                                ? (userPermsRaw.effectivePermissions[mod.key]?.[action] ?? false)
                                : false;
                              const isPending = currentVal !== loadedVal;

                              const iconColor = isPending
                                ? 'text-amber-400'
                                : isSavedOverride
                                  ? 'text-blue-500'
                                  : 'text-emerald-500';

                              return (
                                <td key={action} className="px-3 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleCell(mod.key, action)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
                                    title={
                                      isPending
                                        ? `Pending: will be ${currentVal ? 'granted' : 'denied'}`
                                        : isSavedOverride
                                          ? 'User override (saved) — click to toggle'
                                          : 'Role default — click to override'
                                    }
                                  >
                                    {currentVal
                                      ? <CheckCircle2 className={`w-4 h-4 ${iconColor}`} />
                                      : <XCircle className={`w-4 h-4 ${isPending ? 'text-amber-300' : 'text-gray-200'}`} />
                                    }
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                  Changes are local until you click <strong>Save Permissions</strong>.
                  Saving replaces all overrides for this user only — other users are unaffected.
                </div>
              </div>
            )}

            {/* Empty state */}
            {!selectedUser && selectedRole && !loadingUsers && usersInRole.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <p className="text-sm font-semibold text-amber-800">No active users found for this role.</p>
                <p className="text-xs text-amber-600 mt-1">Create users in the User Management tab first.</p>
              </div>
            )}
          </div>
        ) : <RestrictedPanel title="User Permission Matrix is CEO-only" />
      )}

      {/* ── AUDIT LOGS ── */}
      {activeTab === 'audit' && (
        canManageRbac ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Audit Logs</h2>
              <p className="text-xs text-gray-500 mt-1">
                User and permission governance events with actor identity and role.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                        No audit events found.
                      </td>
                    </tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs">{log.actor_email || '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        {ROLE_LABELS[log.actor_role] || log.actor_role || '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 text-xs">{log.event_type}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.target_uid || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {[log.module_key, log.action_key].filter(Boolean).join('.') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <RestrictedPanel title="Audit logs are CEO-only" />
      )}
    </div>
  );
}

function RestrictedPanel({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <h2 className="font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">This action is restricted by RBAC.</p>
    </div>
  );
}
