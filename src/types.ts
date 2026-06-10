/**
 * Type-safe interfaces for all Firestore collections
 * and application data structures
 */

// ─────────────────────────────────────────
// User Management
// ─────────────────────────────────────────
export enum UserRole {
  CEO = 'CEO',
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  CA = 'CA',
  SALES_MANAGER = 'SALES_MANAGER',
  SITE_INCHARGE = 'SITE_INCHARGE',
  SITE_ENGINEER = 'SITE_ENGINEER',
  EXECUTIVE = 'EXECUTIVE'
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  mustChangePwd: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────
// Projects
// ─────────────────────────────────────────
export enum ProjectStatus {
  NEW = 'NEW',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

export interface Project {
  id: string;
  code: string;
  name: string;
  location: string;
  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string;
  totalValue: number;
  estimatedCost: number;
  budget: number;
  revenue: number;
  status: ProjectStatus;
  is_deleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────
// Approval Requests
// ─────────────────────────────────────────
export enum ApprovalType {
  EXPENSE = 'Expense',
  MATERIAL = 'Material',
  CONTRACTOR = 'Contractor Payment',
  OTHER = 'Other'
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  VOIDED = 'VOIDED'
}

export interface ApprovalRequest {
  id: string;
  approval_code: string;
  title: string;
  projectId?: string;
  projectName?: string;
  type: ApprovalType;
  amount: number;
  description: string;
  vendorName?: string;
  contractor_id?: number;
  attachments?: string;
  status: ApprovalStatus;
  raised_by: string;
  raised_by_uid: string;
  raised_by_role: UserRole;
  approved_by?: string;
  voidedBy?: string;
  voidedAt?: string;
  is_deleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────
// Customers & Payments
// ─────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  plotNumber: string;
  totalPayment: number;
  paymentReceived: number;
  pendingPayment: number;
  is_deleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  customerName: string;
  plotNumber: string;
  date: string;
  amount: number;
  mode: 'Bank Transfer' | 'Cash' | 'Cheque';
  type: 'Payment Received' | 'Refund' | 'Adjustment';
  is_deleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────
export interface InventoryItem {
  id?: string;
  item_name: string;
  category: string;
  sub_category: string;
  unit: string;
  quantity: number;
  price_per_unit: number;
  total_value: number;
  last_updated: string;
  is_deleted: boolean;
  createdAt?: string;
}

export interface MaterialIssue {
  id?: string;
  inventory_id: number;
  item_name: string;
  quantity_issued: number;
  project_name: string;
  issued_to: string;
  issued_by: string;
  issue_date: string;
  remarks?: string;
  is_deleted: boolean;
  createdAt?: string;
}

// ─────────────────────────────────────────
// Contractor Payments
// ─────────────────────────────────────────
export interface ContractorPayment {
  id: number;
  project_id: number;
  projectName?: string;
  contractor_name: string;
  contractor_id?: number;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_no?: string;
  remarks?: string;
  approval_id?: number;
  is_deleted: boolean;
  created_at: string;
}

// ─────────────────────────────────────────
// Master Data
// ─────────────────────────────────────────
export interface Contractor {
  id: number;
  contractor_name: string;
  mobile_number: string;
  contractor_type: string;
  status: 'ACTIVE' | 'INACTIVE';
  linked_project_id?: number;
  notes?: string;
  source: string;
  verification_status: 'VERIFIED' | 'UNVERIFIED';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: number;
  vendor_name: string;
  contact_person: string;
  phone: string;
  address: string;
  gst_number?: string;
  categories?: Category[];
  is_deleted: boolean;
  createdAt: string;
  last_updated: string;
}

export interface Category {
  id: number;
  category_name: string;
  sub_category_name: string;
  is_deleted: boolean;
  createdAt: string;
}

export interface Unit {
  id: number;
  unit_name: string;
  is_deleted: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────
// Application State
// ─────────────────────────────────────────
export interface AppContextType {
  currentUser: SystemUser | null;
  isLoading: boolean;
  error: string | null;
}
