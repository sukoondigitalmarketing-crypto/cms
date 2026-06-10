import { ROLES } from './config';

export type RbacModule =
  | 'dashboard'
  | 'masters'
  | 'procurement'
  | 'inventory'
  | 'grn'
  | 'reports'
  | 'projects'
  | 'approvals'
  | 'customers'
  | 'contractor_payments'
  | 'rbac';

export type RbacAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'cancel'
  | 'export'
  | 'rollback'
  | 'manage_users'
  | 'manage_rbac';

export type PermissionMatrix = Record<string, Partial<Record<RbacModule, Partial<Record<RbacAction, boolean>>>>>;

export const RBAC_MODULES: { key: RbacModule; label: string; actions: RbacAction[] }[] = [
  { key: 'dashboard',           label: 'Dashboard',            actions: ['view'] },
  { key: 'rbac',                label: 'Security Settings',    actions: ['view', 'edit'] },
  { key: 'masters',             label: 'System Masters',       actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'procurement',         label: 'Procurement',          actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { key: 'inventory',           label: 'Inventory',            actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'grn',                 label: 'Goods Receipt (GRN)',  actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { key: 'reports',             label: 'ERP Reports',          actions: ['view', 'export'] },
  { key: 'projects',            label: 'Projects',             actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { key: 'approvals',           label: 'Approval Requests',    actions: ['view', 'create', 'approve', 'delete', 'export'] },
  { key: 'customers',           label: 'Customer & Ledger',    actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'contractor_payments', label: 'Contractor Payments',  actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
];

export const MATRIX_ACTIONS: RbacAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

export const GOVERNANCE_ROLES = [
  ROLES.CEO,
  ROLES.GENERAL_MANAGER,
  ROLES.CA,
  ROLES.STORE_KEEPER,
  ROLES.SITE_INCHARGE,
  ROLES.SITE_ENGINEER,
  ROLES.SALES,
  ROLES.EXECUTIVE,
] as const;

export const normalizeRole = (role?: unknown): string => {
  if (!role || typeof role !== 'string') return '';
  const candidate = role.trim().replace(/\s+/g, '_').toUpperCase();
  if (candidate === 'SALES') return ROLES.SALES;
  return Object.values(ROLES).includes(candidate as any) ? candidate : candidate;
};

const allActions = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  approve: true,
  cancel: true,
  export: true,
  rollback: true,
};

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  [ROLES.CEO]: {
    dashboard: { view: true },
    masters: allActions,
    procurement: allActions,
    inventory: allActions,
    grn: allActions,
    reports: allActions,
    projects: allActions,
    approvals: allActions,
    customers: allActions,
    contractor_payments: allActions,
    rbac: { view: true, edit: true, manage_users: true, manage_rbac: true, delete: true, export: true },
  },
  [ROLES.CA]: {
    dashboard: { view: true, export: true },
    masters: { view: true, export: true },
    procurement: { view: true, approve: true, export: true },
    inventory: { view: true },
    grn: { view: true },
    reports: { view: true, export: true },
    projects: { view: true, export: true },
    approvals: { view: true, approve: true, export: true },
    customers: { view: true, create: true, edit: true, export: true },
    contractor_payments: { view: true, create: true, edit: true, approve: true, export: true },
    rbac: { view: false, manage_users: false, manage_rbac: false },
  },
  [ROLES.GENERAL_MANAGER]: {
    dashboard: { view: true, export: true },
    masters: { view: true, create: true, edit: true, export: true },
    procurement: { view: true, create: true, edit: true, approve: true, export: true },
    inventory: { view: true, create: true, edit: true, export: true },
    grn: { view: true, create: true, edit: true, approve: true, export: true },
    reports: { view: true, export: true },
    projects: { view: true, create: true, edit: true, approve: true, export: true },
    approvals: { view: true, create: true, approve: true, export: true },
    customers: { view: true, export: true },
    contractor_payments: { view: true, approve: true, export: true },
    rbac: { view: false, manage_users: false, manage_rbac: false },
  },
  [ROLES.STORE_KEEPER]: {
    dashboard: { view: true },
    masters: { view: true },
    procurement: { view: true, create: true, edit: true },
    inventory: { view: true, create: true, edit: true },
    grn: { view: true, create: true, edit: true },
    reports: { view: true, export: true },
    projects: { view: true },
    approvals: { view: true, create: true },
    customers: { view: true },
    contractor_payments: { view: true },
    rbac: { view: false, manage_users: false, manage_rbac: false },
  },
  [ROLES.SITE_INCHARGE]: {
    dashboard: { view: true },
    masters: { view: true },
    procurement: { view: true, create: true, edit: true, approve: true },
    inventory: { view: true, create: true, edit: true },
    grn: { view: true, create: true, edit: true },
    reports: { view: true, export: true },
    projects: { view: true, edit: true },
    approvals: { view: true, create: true, approve: true },
    customers: { view: true },
    contractor_payments: { view: true },
    rbac: { view: false, manage_users: false, manage_rbac: false },
  },
  [ROLES.SITE_ENGINEER]: {
    dashboard: { view: true },
    masters: { view: true },
    procurement: { view: true, create: true, edit: true },
    inventory: { view: true },
    grn: { view: true },
    reports: { view: true, export: true },
    projects: { view: true },
    approvals: { view: true, create: true },
    customers: { view: true },
    contractor_payments: { view: true },
    rbac: { view: false, manage_users: false, manage_rbac: false },
  },
  [ROLES.SALES]: {
    dashboard: { view: true },
    masters: { view: true },
    procurement: { view: true },
    inventory: { view: true },
    grn: { view: true },
    reports: { view: true, export: true },
    projects: { view: true },
    approvals: { view: true, create: true },
    customers: { view: true, create: true, edit: true, export: true },
    contractor_payments: { view: true },
    rbac: { view: false, manage_users: false, manage_rbac: false },
  },
  [ROLES.EXECUTIVE]: {
    dashboard: { view: true },
    masters: { view: true },
    procurement: { view: true },
    inventory: { view: true },
    grn: { view: true },
    reports: { view: true, export: true },
    projects: { view: true },
    approvals: { view: true, create: true },
    customers: { view: true },
    contractor_payments: { view: true },
    rbac: { view: false, manage_users: false, manage_rbac: false },
  },
};

export function hasPermission(role: string | null | undefined, module: RbacModule, action: RbacAction, effectivePermissions?: any): boolean {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === ROLES.CEO) return true;
  if (effectivePermissions && effectivePermissions[module]) {
    return effectivePermissions[module][action] === true;
  }
  return DEFAULT_PERMISSION_MATRIX[normalizedRole]?.[module]?.[action] === true;
}

export const canApprove = (role: string | null | undefined, module: RbacModule, effectivePermissions?: any) => hasPermission(role, module, 'approve', effectivePermissions);
export const canCreate = (role: string | null | undefined, module: RbacModule, effectivePermissions?: any) => hasPermission(role, module, 'create', effectivePermissions);
export const canDelete = (role: string | null | undefined, module: RbacModule, effectivePermissions?: any) => hasPermission(role, module, 'delete', effectivePermissions);
export const canEdit = (role: string | null | undefined, module: RbacModule, effectivePermissions?: any) => hasPermission(role, module, 'edit', effectivePermissions);
export const canExport = (role: string | null | undefined, module: RbacModule, effectivePermissions?: any) => hasPermission(role, module, 'export', effectivePermissions);
