import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const server = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173', 'https://cms-3gdl.onrender.com'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

server.use(cors(corsOptions));
server.use(express.json());
const PORT = parseInt(process.env.PORT || '10000', 10);
const api = express.Router();

const ROLES = {
  CEO: 'CEO',
  STORE_KEEPER: 'STORE_KEEPER',
  GENERAL_MANAGER: 'GENERAL_MANAGER',
  CA: 'CA',
  SALES: 'SALES_MANAGER',
  SITE_INCHARGE: 'SITE_INCHARGE',
  SITE_ENGINEER: 'SITE_ENGINEER',
  EXECUTIVE: 'EXECUTIVE'
} as const;

type RbacModule = 'dashboard' | 'masters' | 'procurement' | 'inventory' | 'grn' | 'reports' | 'projects' | 'approvals' | 'customers' | 'contractor_payments' | 'rbac';
type RbacAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'cancel' | 'export' | 'rollback' | 'manage_users' | 'manage_rbac';

function normalizeRole(role?: any): string {
  const candidate = String(role || '').trim().replace(/\s+/g, '_').toUpperCase();
  if (candidate === 'SALES') return ROLES.SALES;
  return candidate;
}

const RBAC_MODULES: RbacModule[] = ['dashboard', 'masters', 'procurement', 'inventory', 'grn', 'reports', 'projects', 'approvals', 'customers', 'contractor_payments', 'rbac'];
const RBAC_ACTIONS: RbacAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'cancel', 'export', 'rollback', 'manage_users', 'manage_rbac'];

const DEFAULT_ROLE_PERMISSIONS: Record<string, Partial<Record<RbacModule, Partial<Record<RbacAction, boolean>>>>> = {
  [ROLES.CEO]: Object.fromEntries(RBAC_MODULES.map((module) => [module, Object.fromEntries(RBAC_ACTIONS.map((action) => [action, true]))])) as any,
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
  },
};

const PR_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
  // Legacy compatibility keys
  PO_CREATED: 'PO_CREATED',
  RETURNED: 'RETURNED',
  PENDING_GM: 'PENDING_GM',
  PENDING_CA: 'PENDING_CA',
  PENDING_CEO: 'PENDING_CEO',
  CONVERTED_TO_PO: 'CONVERTED_TO_PO'
} as const;

const PO_STATUS = {
  DRAFT: 'DRAFT',
  VENDOR_ASSIGNED: 'VENDOR_ASSIGNED',
  SENT_TO_VENDOR: 'SENT_TO_VENDOR',
  CLOSED: 'CLOSED',
  // Legacy compatibility keys
  OPEN: 'OPEN',
  PARTIAL: 'PARTIAL',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED'
} as const;

const GRN_STATUS = {
  DRAFT: 'DRAFT',
  VERIFIED: 'VERIFIED',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
  ACTIVE: 'ACTIVE'
} as const;

const PR_APPROVED_FOR_PO_STATUSES = new Set<string>([
  PR_STATUS.APPROVED,
  PR_STATUS.PO_CREATED,
  PR_STATUS.CONVERTED_TO_PO
]);

const PR_PENDING_APPROVAL_STATUSES = new Set<string>([
  PR_STATUS.PENDING_APPROVAL,
  PR_STATUS.PENDING_GM,
  PR_STATUS.PENDING_CA,
  PR_STATUS.PENDING_CEO
]);

function normalizeProcurementStatus(status: any): string {
  return String(status || '').trim().toUpperCase();
}

function isPrApprovedForPo(status: any): boolean {
  return PR_APPROVED_FOR_PO_STATUSES.has(normalizeProcurementStatus(status));
}

// Work Order status constants retired (SIPL procurement simplification)
// Historical work_orders table preserved for audit lineage.


const LEGACY_FINANCE_ROLE = ['C', 'F', 'O'].join('');

// ═══════════════════════════════════════════════════════════════
// MySQL Setup
// ═══════════════════════════════════════════════════════════════
function validateDbConfig() {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'ROOT_CEO_EMAIL', 'ROOT_CEO_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `SECURITY ERROR: Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these in .env or as system environment variables.`
    );
  }
}

try {
  validateDbConfig();
} catch (error: any) {
  console.error(error.message);
  process.exit(1);
}

const dbConfig = {
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};
const DB_NAME = process.env.DB_NAME || "railway";
const ROOT_CEO_EMAIL = process.env.ROOT_CEO_EMAIL!;
const ROOT_CEO_PASSWORD = process.env.ROOT_CEO_PASSWORD!;
let pool: mysql.Pool;

// ═══════════════════════════════════════════════════════════════
// Password Hashing Utilities
// ═══════════════════════════════════════════════════════════════
function hashPassword(password: string): string {
  // Use bcrypt with 10 salt rounds
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith('$2b$')) {
    // New Bcrypt hash
    return bcrypt.compareSync(password, hash);
  } else {
    // Legacy SHA256 hash
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === hash;
  }
}

// ═══════════════════════════════════════════════════════════════
// Session Management (Simple in-memory sessions)
// ═══════════════════════════════════════════════════════════════
interface Session {
  userId: number;
  uid: string;
  email: string;
  role: string;
  name: string;
  mustChangePwd: boolean;
  backdateLimit: number;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userId: number, uid: string, email: string, role: string, name: string, mustChangePwd: boolean, backdateLimit: number): string {
  const token = generateSessionToken();
  sessions.set(token, {
    userId,
    uid,
    email,
    role,
    name,
    mustChangePwd,
    backdateLimit,
    createdAt: Date.now()
  });
  return token;
}

function getSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;
  
  // Session expires after 24 hours
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  
  return session;
}

function deleteSession(token: string): void {
  sessions.delete(token);
}

function invalidateSessionsByEmail(email: string): void {
  for (const [token, session] of sessions.entries()) {
    if (session.email === email) {
      sessions.delete(token);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// GRN & Inventory Utility Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a GRN has any items that have been issued to projects.
 * A GRN is considered "used" if any associated batch has remaining quantity 
 * less than the received quantity.
 */
async function isGrnUsed(connection: mysql.PoolConnection | mysql.Pool, grnId: string | number): Promise<boolean> {
  // 1. Check Batches (Warehouse Stock)
  const [batches]: any = await connection.execute(
    'SELECT quantity_received, quantity_remaining FROM inventory_batches WHERE grn_id = ? AND is_void = FALSE',
    [grnId]
  );
  for (const batch of batches) {
    if (parseFloat(batch.quantity_remaining) < parseFloat(batch.quantity_received)) return true;
  }
  
  // 2. Check Material Issues (Direct Project / Auto-Issue / Manual Issue)
  const [issues]: any = await connection.execute(
    'SELECT COUNT(*) as count FROM material_issues WHERE grn_id = ? AND is_deleted = FALSE',
    [grnId]
  );
  if (issues[0].count > 0) return true;

  return false;
}

/**
 * Recalculates and synchronizes master inventory totals from active batches.
 */
async function syncInventoryFromBatches(connection: mysql.PoolConnection, inventoryId: string | number): Promise<void> {
  await connection.execute(`
    UPDATE inventory i
    SET 
      quantity = COALESCE((SELECT SUM(quantity_remaining) FROM inventory_batches WHERE inventory_id = i.id AND is_void = FALSE), 0),
      total_value = COALESCE((SELECT SUM(total_value_remaining) FROM inventory_batches WHERE inventory_id = i.id AND is_void = FALSE), 0)
    WHERE id = ?
  `, [inventoryId]);
}

/**
 * Generates a sequential, year-aware Voucher Number for Material Issue.
 * Format: MIV-YYYY-XXXXXX
 */
async function generateVoucherNumber(connection: mysql.PoolConnection | mysql.Pool): Promise<string> {
  const year = new Date().getFullYear();
  const [rows]: any = await connection.execute(
    'SELECT voucher_no FROM material_issue_vouchers WHERE voucher_no LIKE ? ORDER BY id DESC LIMIT 1',
    [`MIV-${year}-%`]
  );

  let nextNumber = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].voucher_no;
    const parts = lastNo.split('-');
    if (parts.length === 3) {
      nextNumber = parseInt(parts[2]) + 1;
    }
  }

  return `MIV-${year}-${nextNumber.toString().padStart(6, '0')}`;
}

function getRequestSession(req: any): Session | null {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  return getSession(token);
}

const requireAuth = (req: any, res: any, next: any) => {
  const session = getRequestSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.user = { ...session, role: normalizeRole(session.role) };
  next();
};

/**
 * Get permission with user override precedence
 * Priority: USER_OVERRIDE > ROLE_DEFAULT
 */
async function getEffectivePermission(userId: number, role: string, module: RbacModule, action: RbacAction): Promise<boolean> {
  const normalizedRole = normalizeRole(role);
  
  // CEO has unrestricted access
  if (normalizedRole === ROLES.CEO) return true;

  try {
    if (pool) {
      // Check if user has explicit override
      const [userOverride]: any = await pool.execute(
        `SELECT up.is_allowed
         FROM user_permissions up
         JOIN rbac_permissions p ON p.id = up.permission_id
         WHERE up.user_id = ? AND p.module_key = ? AND p.action_key = ?
         LIMIT 1`,
        [userId, module, action]
      );

      // User override takes priority (if exists)
      if (userOverride.length > 0) {
        return userOverride[0].is_allowed === 1 || userOverride[0].is_allowed === true;
      }

      // Fall back to role default permission
      const [roleDefault]: any = await pool.execute(
        `SELECT rp.is_allowed
         FROM role_permissions rp
         JOIN rbac_permissions p ON p.id = rp.permission_id
         WHERE rp.role_code = ? AND p.module_key = ? AND p.action_key = ?
         LIMIT 1`,
        [normalizedRole, module, action]
      );

      if (roleDefault.length > 0) {
        return roleDefault[0].is_allowed === 1 || roleDefault[0].is_allowed === true;
      }
    }
  } catch (error) {
    console.warn('[RBAC] Error getting effective permission:', (error as any).message);
  }

  // Fall back to static defaults
  return DEFAULT_ROLE_PERMISSIONS[normalizedRole]?.[module]?.[action] === true;
}

/**
 * Get all user permissions for a user (role defaults merged with overrides)
 */
export async function getUserEffectivePermissions(userId: number, role: string): Promise<Record<RbacModule, Record<RbacAction, boolean>>> {
  const normalizedRole = normalizeRole(role);
  const result: any = {};

  // Start with role defaults
  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[normalizedRole] || {};

  // Build result starting from role defaults
  for (const module of RBAC_MODULES) {
    result[module] = { ...roleDefaults[module] || {} };
  }

  // Apply user overrides
  if (pool) {
    try {
      const [userPerms]: any = await pool.execute(
        `SELECT p.module_key, p.action_key, up.is_allowed
         FROM user_permissions up
         JOIN rbac_permissions p ON p.id = up.permission_id
         WHERE up.user_id = ?`,
        [userId]
      );

      for (const perm of userPerms) {
        if (!result[perm.module_key]) result[perm.module_key] = {};
        result[perm.module_key][perm.action_key] = perm.is_allowed === 1 || perm.is_allowed === true;
      }
    } catch (error) {
      console.warn('[RBAC] Error loading user overrides:', (error as any).message);
    }
  }

  return result;
}

async function hasPermission(role: string, module: RbacModule, action: RbacAction): Promise<boolean> {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === ROLES.CEO) return true;

  try {
    if (pool) {
      const [rows]: any = await pool.execute(
        `SELECT rp.is_allowed
         FROM role_permissions rp
         JOIN rbac_permissions p ON p.id = rp.permission_id
         WHERE rp.role_code = ? AND p.module_key = ? AND p.action_key = ?
         LIMIT 1`,
        [normalizedRole, module, action]
      );
      if (rows.length > 0) return rows[0].is_allowed === 1 || rows[0].is_allowed === true;
    }
  } catch (error) {
    console.warn('[RBAC] Falling back to static permissions:', (error as any).message);
  }

  return DEFAULT_ROLE_PERMISSIONS[normalizedRole]?.[module]?.[action] === true;
}

function authorizeAction(module: RbacModule, action: RbacAction) {
  return async (req: any, res: any, next: any) => {
    const session = getRequestSession(req);
    if (!session) return res.status(401).json({ error: 'Session expired' });

    const normalizedRole = normalizeRole(session.role);
    // Use getEffectivePermission to support user overrides
    const hasAccess = await getEffectivePermission(session.userId, session.role, module, action);

    if (hasAccess) {
      req.user = { ...session, role: normalizedRole };
      if (['approve', 'delete', 'cancel', 'rollback', 'manage_users', 'manage_rbac'].includes(action)) {
        try {
          await pool.execute(
            `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_user_id, event_type, module_key, action_key, after_snapshot)
             VALUES (?, ?, ?, ?, 'ACTION_AUTHORIZED', ?, ?, ?)`,
            [
              session.uid,
              session.email,
              normalizedRole,
              session.userId,
              module,
              action,
              JSON.stringify({ method: req.method, path: req.originalUrl || req.url })
            ]
          );
        } catch (error) {
          console.warn('[RBAC_AUDIT] Failed to write authorization audit:', (error as any).message);
        }
      }
      return next();
    }

    return res.status(403).json({ error: 'Access denied', module, action });
  };
}

const canApprove = (module: RbacModule) => authorizeAction(module, 'approve');
const canDelete = (module: RbacModule) => authorizeAction(module, 'delete');
const canEdit = (module: RbacModule) => authorizeAction(module, 'edit');
const canExport = (module: RbacModule) => authorizeAction(module, 'export');

// Middleware for Role Control
const authorize = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    const session = getRequestSession(req);
    if (!session) return res.status(401).json({ error: 'Session expired' });
    
    const normalizedSessionRole = normalizeRole(session.role);
    const normalizedAllowedRoles = roles.map(r => normalizeRole(r));
    
    if (roles.includes('ANY') || normalizedAllowedRoles.includes(normalizedSessionRole)) {
      req.user = { ...session, role: normalizedSessionRole };
      next();
    } else {
      res.status(403).json({ error: 'Access denied' });
    }
  };
};

// ═══════════════════════════════════════════════════════════════
// Database Initialization
// ═══════════════════════════════════════════════════════════════
async function initDB() {
  let poolConnection: any;
  try {
    // === DB CONFIG CHECK ===
    console.log("=== DB CONFIG CHECK ===");
    console.log({
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_NAME: process.env.DB_NAME,
      ROOT_CEO_EMAIL: process.env.ROOT_CEO_EMAIL,
      HAS_DB_PASSWORD: !!process.env.DB_PASSWORD,
      HAS_ROOT_CEO_PASSWORD: !!process.env.ROOT_CEO_PASSWORD
    });

    // === TCP CONNECTIVITY TEST ===
    const tcpTest = new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      const tcpPort = Number(process.env.DB_PORT || 3306);
      const tcpHost = process.env.DB_HOST!;
      socket.setTimeout(10000);
      
      socket.on('connect', () => {
        console.log('TCP connection successful');
        socket.destroy();
        resolve();
      });
      socket.on('error', (err) => {
        console.error('TCP connection failed:', err.message);
        reject(err);
      });
      socket.on('timeout', () => {
        console.error('TCP connection timeout');
        socket.destroy();
        reject(new Error('TCP connection timeout'));
      });
      
      socket.connect(tcpPort, tcpHost);
    });
    await tcpTest;
    
    const tempConnection = await mysql.createConnection(dbConfig);
    console.log(`🔌 Connected to MySQL. Ensuring database '${DB_NAME}' exists...`);
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
    await tempConnection.end();

    pool = mysql.createPool({ ...dbConfig, database: DB_NAME });
    console.log(`✅ MySQL Pool Ready with database '${DB_NAME}'`);

    poolConnection = await pool.getConnection();

    // === LOG SCHEMA FOR TABLES WITH POSSIBLE PHONE COLUMNS
    console.log("=== SCHEMA: vendors");
    const [vendorsCols]: any = await poolConnection.query("SHOW COLUMNS FROM vendors");
    console.log(vendorsCols);
    console.log("=== SCHEMA: customers");
    const [customersCols]: any = await poolConnection.query("SHOW COLUMNS FROM customers");
    console.log(customersCols);
    console.log("=== SCHEMA: contractors");
    const [contractorsCols]: any = await poolConnection.query("SHOW COLUMNS FROM contractors");
    console.log(contractorsCols);

    // Helper for safe index addition
    const addIndexSafe = async (query: string) => {
      try {
        await poolConnection.query(query);
      } catch (e: any) {
        // Ignore "Duplicate key name" errors
        if (e.code !== 'ER_DUP_KEYNAME') {
          console.warn(`[INDEX_WARN] ${e.message}`);
        }
      }
    };

    // Users table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'Active',
        mustChangePwd BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        last_login TIMESTAMP NULL DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [userCols]: any = await poolConnection.query("SHOW COLUMNS FROM users");
    const userColNames = userCols.map((c: any) => c.Field);
    if (!userColNames.includes('last_login')) {
      await poolConnection.query("ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL AFTER is_deleted");
    }
    if (!userColNames.includes('password_changed_at')) {
      await poolConnection.query("ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL AFTER last_login");
    }
    if (!userColNames.includes('backdate_limit')) {
      await poolConnection.query("ALTER TABLE users ADD COLUMN backdate_limit INT DEFAULT 0 AFTER mustChangePwd");
    }

    await poolConnection.query(
      'UPDATE users SET role = ? WHERE role = ?',
      [ROLES.CA, LEGACY_FINANCE_ROLE]
    );
    await poolConnection.query(
      'UPDATE users SET role = ? WHERE role = ?',
      [ROLES.GENERAL_MANAGER, 'PROCUREMENT_MANAGER']
    );

    // Normalize all user roles to uppercase to match ROLES constants
    await poolConnection.query(
      'UPDATE users SET role = UPPER(role) WHERE role IS NOT NULL'
    );

    // Audit logs table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        details JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // GRN Edit History table (Audit Governance)
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS grn_edit_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grn_id INT NOT NULL,
        grn_number VARCHAR(100) NOT NULL,
        old_snapshot JSON NOT NULL,
        new_snapshot JSON NOT NULL,
        edited_by VARCHAR(255) NOT NULL,
        edit_reason TEXT NOT NULL,
        edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 🛡️ Ensure Root CEO exists ONLY if not already present
    const [rootUsers]: any = await poolConnection.query('SELECT * FROM users WHERE email = ?', [ROOT_CEO_EMAIL]);
    if (rootUsers.length === 0) {
      console.log(`🛡️ Seeding Root CEO: ${ROOT_CEO_EMAIL}`);
      const rootUid = crypto.randomBytes(16).toString('hex');
      const rootHash = hashPassword(ROOT_CEO_PASSWORD);
      await poolConnection.query(
        'INSERT INTO users (uid, name, email, password_hash, role, status, mustChangePwd) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [rootUid, 'Root CEO', ROOT_CEO_EMAIL, rootHash, ROLES.CEO, 'Active', true]
      );
    } else {
      console.log(`✅ Root CEO already exists, skipping password reset`);
      // Ensure CEO role is still set (security check)
      await poolConnection.query(
        'UPDATE users SET role = ?, status = ? WHERE email = ?',
        [ROLES.CEO, 'Active', ROOT_CEO_EMAIL]
      );
    }

    // 🧹 Clean up duplicate CEOs
    const [duplicateCeos]: any = await poolConnection.query(
      'SELECT email FROM users WHERE role = ? AND email != ?',
      [ROLES.CEO, ROOT_CEO_EMAIL]
    );
    if (duplicateCeos.length > 0) {
      console.log(`🧹 Downgrading ${duplicateCeos.length} duplicate CEO accounts to Executive...`);
      await poolConnection.query(
        'UPDATE users SET role = ? WHERE role = ? AND email != ?',
        [ROLES.EXECUTIVE, ROLES.CEO, ROOT_CEO_EMAIL]
      );
    }



    // Inventory table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(150),
        sub_category VARCHAR(150),
        unit VARCHAR(50),
        quantity DECIMAL(10,2) DEFAULT 0.00,
        price_per_unit DECIMAL(18,6) DEFAULT 0.00,
        total_value DECIMAL(15,2) DEFAULT 0.00,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure high precision for price_per_unit
    await poolConnection.query("ALTER TABLE inventory MODIFY COLUMN price_per_unit DECIMAL(18,6) DEFAULT 0.00");
    
    // Add hsn_code and description to inventory
    const [invCols]: any = await poolConnection.query("SHOW COLUMNS FROM inventory");
    const invColNames = invCols.map((c: any) => c.Field);
    if (!invColNames.includes('hsn_code')) await poolConnection.query("ALTER TABLE inventory ADD COLUMN hsn_code VARCHAR(50) DEFAULT NULL");
    if (!invColNames.includes('description')) await poolConnection.query("ALTER TABLE inventory ADD COLUMN description TEXT DEFAULT NULL");

    // Material Issues table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS material_issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inventory_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        quantity_issued DECIMAL(10,2) NOT NULL,
        total_cost DECIMAL(15,2) DEFAULT 0.00,
        batch_details JSON,
        issue_source ENUM('FIFO_ISSUE', 'DIRECT_PURCHASE') DEFAULT 'FIFO_ISSUE',
        grn_id INT DEFAULT NULL,
        project_id INT DEFAULT NULL,
        project_name VARCHAR(255) DEFAULT NULL,
        issued_to VARCHAR(255) NOT NULL,
        issued_by VARCHAR(255) NOT NULL,
        issue_date DATE NOT NULL,
        remarks TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE SET NULL
      )
    `);

    const [issueCols]: any = await poolConnection.query("SHOW COLUMNS FROM material_issues");
    const issueColNames = issueCols.map((c: any) => c.Field);
    if (!issueColNames.includes('total_cost')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN total_cost DECIMAL(15,2) DEFAULT 0.00 AFTER quantity_issued");
    }
    if (!issueColNames.includes('batch_details')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN batch_details JSON AFTER total_cost");
    }
    if (!issueColNames.includes('project_id')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN project_id INT DEFAULT NULL AFTER batch_details");
      try {
        await poolConnection.query("ALTER TABLE material_issues ADD FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL");
      } catch(e) {
        // FK might already exist or fails, safe to ignore
      }
    }
    if (!issueColNames.includes('issue_source')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN issue_source ENUM('FIFO_ISSUE', 'DIRECT_PURCHASE') DEFAULT 'FIFO_ISSUE' AFTER batch_details");
    }
    if (!issueColNames.includes('grn_id')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN grn_id INT DEFAULT NULL AFTER issue_source");
      try {
        await poolConnection.query("ALTER TABLE material_issues ADD FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE SET NULL");
      } catch(e) { }
    }
    if (!issueColNames.includes('grn_number')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN grn_number VARCHAR(100) DEFAULT NULL AFTER grn_id");
    }
    if (!issueColNames.includes('revert_status')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN revert_status ENUM('ACTIVE', 'PARTIAL_REVERT', 'FULLY_REVERTED') DEFAULT 'ACTIVE' AFTER is_deleted");
    }
    if (!issueColNames.includes('revert_reason')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN revert_reason TEXT AFTER revert_status");
    }
    if (!issueColNames.includes('reverted_by')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN reverted_by VARCHAR(255) AFTER revert_reason");
    }
    if (!issueColNames.includes('reverted_at')) {
      await poolConnection.query("ALTER TABLE material_issues ADD COLUMN reverted_at TIMESTAMP NULL DEFAULT NULL AFTER reverted_by");
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Material Issue Voucher Architecture (Multi-Item Governance)
    // ═══════════════════════════════════════════════════════════════

    // 1. Voucher Header Table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS material_issue_vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_no VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NOT NULL,
        issued_to VARCHAR(255) NOT NULL,
        issued_by VARCHAR(255) NOT NULL,
        issue_date DATE NOT NULL,
        purpose VARCHAR(255),
        remarks TEXT,
        total_valuation DECIMAL(15,2) DEFAULT 0.00,
        total_items INT DEFAULT 0,
        status ENUM('ACTIVE', 'PARTIALLY_REVERTED', 'FULLY_REVERTED', 'VOID') DEFAULT 'ACTIVE',
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // 2. Voucher Items Table (Line Items)
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS material_issue_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_id INT NOT NULL,
        inventory_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(50),
        total_cost DECIMAL(15,2) DEFAULT 0.00,
        batch_details JSON,
        grn_id INT DEFAULT NULL,
        grn_number VARCHAR(100),
        revert_status ENUM('ACTIVE', 'REVERTED') DEFAULT 'ACTIVE',
        reverted_at TIMESTAMP NULL DEFAULT NULL,
        reverted_by VARCHAR(255) DEFAULT NULL,
        revert_reason TEXT DEFAULT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (voucher_id) REFERENCES material_issue_vouchers(id) ON DELETE CASCADE,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id),
        FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE SET NULL
      )
    `);

    // Ensure material_issue_vouchers has is_deleted column
    console.log("=== MATERIAL ISSUE VOUCHERS TABLE SCHEMA ===");
    const [mivCols]: any = await poolConnection.query("SHOW COLUMNS FROM material_issue_vouchers");
    console.log(mivCols);
    const mivColNames = mivCols.map((c: any) => c.Field);
    if (!mivColNames.includes('is_deleted')) {
      await poolConnection.query("ALTER TABLE material_issue_vouchers ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE");
    }
    if (!mivColNames.includes('status')) {
      await poolConnection.query("ALTER TABLE material_issue_vouchers ADD COLUMN status ENUM('ACTIVE', 'PARTIALLY_REVERTED', 'FULLY_REVERTED', 'VOID') DEFAULT 'ACTIVE'");
    }

    // 🛡️ Performance Indexes for Voucher System
    await addIndexSafe("CREATE INDEX idx_miv_no ON material_issue_vouchers(voucher_no)");
    await addIndexSafe("CREATE INDEX idx_miv_date ON material_issue_vouchers(issue_date)");
    await addIndexSafe("CREATE INDEX idx_miv_proj ON material_issue_vouchers(project_id)");
    await addIndexSafe("CREATE INDEX idx_mii_voucher ON material_issue_items(voucher_id)");
    await addIndexSafe("CREATE INDEX idx_mii_inv ON material_issue_items(inventory_id)");

    // Ensure material_issue_items has is_deleted column
    console.log("=== MATERIAL ISSUE ITEMS TABLE SCHEMA ===");
    const [miiCols]: any = await poolConnection.query("SHOW COLUMNS FROM material_issue_items");
    console.log(miiCols);
    const miiColNames = miiCols.map((c: any) => c.Field);
    if (!miiColNames.includes('is_deleted')) {
      await poolConnection.query("ALTER TABLE material_issue_items ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE");
    }
    if (!miiColNames.includes('revert_status')) {
      await poolConnection.query("ALTER TABLE material_issue_items ADD COLUMN revert_status ENUM('ACTIVE', 'REVERTED') DEFAULT 'ACTIVE'");
    }

    // 🔄 Legacy Migration Block
    const [existingVouchers]: any = await poolConnection.query('SELECT COUNT(*) as count FROM material_issue_vouchers');
    if (existingVouchers[0].count === 0) {
      const [oldIssues]: any = await poolConnection.query('SELECT * FROM material_issues WHERE is_deleted = FALSE');
      if (oldIssues.length > 0) {
        console.log(`🔄 Migrating ${oldIssues.length} legacy material issues to Voucher Architecture...`);
        for (const issue of oldIssues) {
          // Create a 1:1 legacy voucher for each old issue to ensure zero data loss
          const year = new Date(issue.issue_date).getFullYear();
          const [vRows]: any = await poolConnection.query('SELECT id FROM material_issue_vouchers WHERE voucher_no LIKE ? ORDER BY id DESC LIMIT 1', [`MIV-${year}-%`]);
          let nextNum = 1;
          if (vRows.length > 0) {
            // This is a slow migration but safe for startup
            const [lastNoRow]: any = await poolConnection.query('SELECT voucher_no FROM material_issue_vouchers WHERE voucher_no LIKE ? ORDER BY id DESC LIMIT 1', [`MIV-${year}-%`]);
            nextNum = parseInt(lastNoRow[0].voucher_no.split('-')[2]) + 1;
          }
          const vNo = `MIV-${year}-${nextNum.toString().padStart(6, '0')}`;
          
          const [vResult]: any = await poolConnection.query(
            `INSERT INTO material_issue_vouchers (voucher_no, project_id, issued_to, issued_by, issue_date, remarks, total_valuation, total_items, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [vNo, issue.project_id, issue.issued_to, issue.issued_by, issue.issue_date, issue.remarks || 'Legacy Migration', issue.total_cost, issue.createdAt]
          );
          
          const voucherId = vResult.insertId;
          
          // 🛡️ Ensure batch_details is valid JSON
          let safeBatchDetails = '[]';
          try {
            if (issue.batch_details) {
              safeBatchDetails = typeof issue.batch_details === 'string' 
                ? issue.batch_details 
                : JSON.stringify(issue.batch_details);
              
              // Validate if it's a valid JSON string
              JSON.parse(safeBatchDetails);
            }
          } catch (e) {
            console.warn(`⚠️ Invalid JSON in legacy issue ${issue.id}, using empty array`);
            safeBatchDetails = '[]';
          }
          
          await poolConnection.query(
            `INSERT INTO material_issue_items (voucher_id, inventory_id, item_name, quantity, total_cost, batch_details, grn_id, grn_number, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [voucherId, issue.inventory_id, issue.item_name, issue.quantity_issued, issue.total_cost, safeBatchDetails, issue.grn_id, issue.grn_number, issue.createdAt]
          );
        }
        console.log('✅ Legacy migration complete.');
      }
    }

    // Inventory Batches table (New for FIFO)
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inventory_id INT NOT NULL,
        grn_id INT DEFAULT NULL,
        batch_number VARCHAR(100),
        quantity_received DECIMAL(10,2) NOT NULL,
        quantity_remaining DECIMAL(10,2) NOT NULL,
        total_value_received DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_value_remaining DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        unit_price DECIMAL(18,6) NOT NULL,
        received_date DATE NOT NULL,
        is_void BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      )
    `);

    const [batchCols]: any = await poolConnection.query("SHOW COLUMNS FROM inventory_batches");
    const batchColNames = batchCols.map((c: any) => c.Field);
    
    if (!batchColNames.includes('total_value_received')) {
      await poolConnection.query("ALTER TABLE inventory_batches ADD COLUMN total_value_received DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER quantity_remaining");
      await poolConnection.query("ALTER TABLE inventory_batches ADD COLUMN total_value_remaining DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER total_value_received");
      // Backfill existing batches: total = qty * unit_price
      await poolConnection.query("UPDATE inventory_batches SET total_value_received = quantity_received * unit_price, total_value_remaining = quantity_remaining * unit_price");
      console.log("✅ Backfilled total_value columns in inventory_batches");
    }
    
    // Always ensure high precision for unit_price
    await poolConnection.query("ALTER TABLE inventory_batches MODIFY COLUMN unit_price DECIMAL(18,6) NOT NULL");

    if (!batchColNames.includes('is_void')) {
      await poolConnection.query("ALTER TABLE inventory_batches ADD COLUMN is_void BOOLEAN DEFAULT FALSE AFTER received_date");
    }

    // Inventory Additions (History) table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS inventory_additions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inventory_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        quantity_added DECIMAL(10,2) NOT NULL,
        category VARCHAR(150),
        supplier VARCHAR(255),
        added_by VARCHAR(255) NOT NULL,
        addition_date DATE NOT NULL,
        remarks TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id)
      )
    `);

    // Projects table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        location VARCHAR(200) NOT NULL,
        startDate VARCHAR(50) NOT NULL,
        expectedEndDate VARCHAR(50) NOT NULL,
        actualEndDate VARCHAR(50) DEFAULT NULL,
        totalValue DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        estimatedCost DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        budget DECIMAL(15,2) DEFAULT 0.00,
        status VARCHAR(20) NOT NULL DEFAULT 'NEW',
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 🛡️ Ensure Performance Indexes

    await addIndexSafe("CREATE INDEX idx_inv_add_date ON inventory_additions(addition_date)");
    await addIndexSafe("CREATE INDEX idx_inv_add_item ON inventory_additions(item_name)");
    await addIndexSafe("CREATE INDEX idx_mat_issue_date ON material_issues(issue_date)");
    await addIndexSafe("CREATE INDEX idx_mat_issue_item ON material_issues(item_name)");
    await addIndexSafe("CREATE INDEX idx_mat_issue_proj ON material_issues(project_name)");

    const [projectCols]: any = await poolConnection.query("SHOW COLUMNS FROM projects");
    const projColNames = projectCols.map((c: any) => c.Field);
    if (!projColNames.includes('budget')) {
      await poolConnection.query("ALTER TABLE projects ADD COLUMN budget DECIMAL(15,2) DEFAULT 0");
    }
    if (!projColNames.includes('revenue')) {
      await poolConnection.query("ALTER TABLE projects ADD COLUMN revenue DECIMAL(15,2) DEFAULT 0");
    }
    if (!projColNames.includes('is_deleted')) {
      await poolConnection.query("ALTER TABLE projects ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE");
    }

    // Approvals table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        approval_code VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'PENDING',
        raised_by VARCHAR(255) NOT NULL,
        raised_by_uid VARCHAR(255) NOT NULL,
        raised_by_role VARCHAR(50) NOT NULL,
        approved_by VARCHAR(255) DEFAULT NULL,
        voidedBy VARCHAR(255) DEFAULT NULL,
        voidedAt TIMESTAMP NULL DEFAULT NULL,
        projectId INT DEFAULT NULL,
        projectName VARCHAR(255) DEFAULT NULL,
        vendorName VARCHAR(255) DEFAULT NULL,
        attachments TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    const [approvalCols]: any = await poolConnection.query("SHOW COLUMNS FROM approvals");
    const approvalColNames = approvalCols.map((c: any) => c.Field);
    if (!approvalColNames.includes('voidedBy')) {
      await poolConnection.query("ALTER TABLE approvals ADD COLUMN voidedBy VARCHAR(255) DEFAULT NULL");
    }
    if (!approvalColNames.includes('voidedAt')) {
      await poolConnection.query("ALTER TABLE approvals ADD COLUMN voidedAt TIMESTAMP NULL DEFAULT NULL");
    }

    // Customers table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        plotNumber VARCHAR(50) NOT NULL UNIQUE,
        totalPayment DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        paymentReceived DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        pendingPayment DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Ensure paymentReceived, pendingPayment, totalPayment, and is_deleted exist on existing customers tables
    console.log("=== CUSTOMERS TABLE SCHEMA ===");
    const [customerCols]: any = await poolConnection.query("SHOW COLUMNS FROM customers");
    console.log(customerCols);
    const customerColNames = customerCols.map((c: any) => c.Field);
    if (!customerColNames.includes('totalPayment')) {
      await poolConnection.query("ALTER TABLE customers ADD COLUMN totalPayment DECIMAL(15,2) NOT NULL DEFAULT 0.00");
    }
    if (!customerColNames.includes('paymentReceived')) {
      await poolConnection.query("ALTER TABLE customers ADD COLUMN paymentReceived DECIMAL(15,2) NOT NULL DEFAULT 0.00");
    }
    if (!customerColNames.includes('pendingPayment')) {
      await poolConnection.query("ALTER TABLE customers ADD COLUMN pendingPayment DECIMAL(15,2) NOT NULL DEFAULT 0.00");
    }
    if (!customerColNames.includes('is_deleted')) {
      await poolConnection.query("ALTER TABLE customers ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE");
    }

    // Ledger Entries table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customerId INT NOT NULL,
        customerName VARCHAR(255) NOT NULL,
        plotNumber VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        mode VARCHAR(50) NOT NULL,
        date VARCHAR(50) NOT NULL,
        type VARCHAR(50) DEFAULT 'Payment Received',
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
      )
    `);

    // Ensure is_deleted exists on existing ledger_entries tables
    console.log("=== LEDGER ENTRIES TABLE SCHEMA ===");
    const [ledgerCols]: any = await poolConnection.query("SHOW COLUMNS FROM ledger_entries");
    console.log(ledgerCols);
    const ledgerColNames = ledgerCols.map((c: any) => c.Field);
    if (!ledgerColNames.includes('is_deleted')) {
      await poolConnection.query("ALTER TABLE ledger_entries ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE");
    }

    // GRNs table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS grns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grn_number VARCHAR(50) NOT NULL UNIQUE,
        projectId INT DEFAULT NULL,
        vendorName VARCHAR(255) DEFAULT NULL,
        destination_type ENUM('CENTRAL_STORE', 'DIRECT_PROJECT') DEFAULT 'CENTRAL_STORE',
        grn_date DATE NOT NULL,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        remarks TEXT,
        created_by VARCHAR(255) NOT NULL,
        cancelled_by VARCHAR(255) DEFAULT NULL,
        cancellation_reason TEXT DEFAULT NULL,
        cancelled_at TIMESTAMP NULL DEFAULT NULL,
        edited_by VARCHAR(255) DEFAULT NULL,
        edit_reason TEXT DEFAULT NULL,
        edited_at TIMESTAMP NULL DEFAULT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    await poolConnection.query('ALTER TABLE grns MODIFY vendorName VARCHAR(255) NULL');

    // Ensure status, cancelled, edited fields exist (for existing tables)
    console.log("=== GRN TABLE SCHEMA ===");
    const [grnCols]: any = await poolConnection.query("SHOW COLUMNS FROM grns");
    console.log(grnCols);
    const colNames = grnCols.map((c: any) => c.Field);
    if (!colNames.includes('total_amount')) await poolConnection.query("ALTER TABLE grns ADD COLUMN total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00");
    if (!colNames.includes('status')) await poolConnection.query("ALTER TABLE grns ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE'");
    if (!colNames.includes('cancelled_by')) await poolConnection.query("ALTER TABLE grns ADD COLUMN cancelled_by VARCHAR(255) DEFAULT NULL");
    if (!colNames.includes('cancellation_reason')) await poolConnection.query("ALTER TABLE grns ADD COLUMN cancellation_reason TEXT DEFAULT NULL");
    if (!colNames.includes('cancelled_at')) await poolConnection.query("ALTER TABLE grns ADD COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL");
    if (!colNames.includes('edited_by')) await poolConnection.query("ALTER TABLE grns ADD COLUMN edited_by VARCHAR(255) DEFAULT NULL");
    if (!colNames.includes('edit_reason')) await poolConnection.query("ALTER TABLE grns ADD COLUMN edit_reason TEXT DEFAULT NULL");
    if (!colNames.includes('edited_at')) await poolConnection.query("ALTER TABLE grns ADD COLUMN edited_at TIMESTAMP NULL DEFAULT NULL");
    if (!colNames.includes('gstNumber')) await poolConnection.query("ALTER TABLE grns ADD COLUMN gstNumber VARCHAR(50) DEFAULT NULL");
    if (!colNames.includes('discountType')) await poolConnection.query("ALTER TABLE grns ADD COLUMN discountType VARCHAR(20) DEFAULT NULL");
    if (!colNames.includes('discountValue')) await poolConnection.query("ALTER TABLE grns ADD COLUMN discountValue DECIMAL(10,2) DEFAULT NULL");
    if (!colNames.includes('finalAmount')) await poolConnection.query("ALTER TABLE grns ADD COLUMN finalAmount DECIMAL(12,2) DEFAULT NULL");
    if (!colNames.includes('transportCharges')) await poolConnection.query("ALTER TABLE grns ADD COLUMN transportCharges DECIMAL(10,2) DEFAULT 0.00");
    if (!colNames.includes('otherCharges')) await poolConnection.query("ALTER TABLE grns ADD COLUMN otherCharges DECIMAL(10,2) DEFAULT 0.00");
    if (!colNames.includes('destination_type')) await poolConnection.query("ALTER TABLE grns ADD COLUMN destination_type ENUM('CENTRAL_STORE', 'DIRECT_PROJECT') DEFAULT 'CENTRAL_STORE' AFTER vendorName");
    if (!colNames.includes('po_id')) {
      await poolConnection.query("ALTER TABLE grns ADD COLUMN po_id INT DEFAULT NULL AFTER grn_number");
      try {
        await poolConnection.query("ALTER TABLE grns ADD FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL");
      } catch (e) {}
    }
    if (!colNames.includes('is_emergency')) await poolConnection.query("ALTER TABLE grns ADD COLUMN is_emergency BOOLEAN DEFAULT FALSE");
    if (!colNames.includes('emergency_reason')) await poolConnection.query("ALTER TABLE grns ADD COLUMN emergency_reason TEXT DEFAULT NULL");

    // GRN Items table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS grn_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grn_id INT NOT NULL,
        inventory_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        rate DECIMAL(18,6) NOT NULL,
        total DECIMAL(15,2) NOT NULL,
        FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE CASCADE,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id)
      )
    `);
    
    // Ensure high precision for grn_items rate
    await poolConnection.query("ALTER TABLE grn_items MODIFY COLUMN rate DECIMAL(18,6) NOT NULL");

    // Contractor Payments table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS contractor_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        contractor_name VARCHAR(255) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        reference_no VARCHAR(255) NULL,
        remarks TEXT NULL,
        approval_id INT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE SET NULL
      )
    `);

    // Contractors table (New Registry)
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS contractors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contractor_name VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(20) NOT NULL UNIQUE,
        contractor_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        linked_project_id INT DEFAULT NULL,
        notes TEXT,
        source VARCHAR(50) DEFAULT 'MANUAL',
        verification_status VARCHAR(50) DEFAULT 'VERIFIED',
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (linked_project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    const [approvalCols2]: any = await poolConnection.query("SHOW COLUMNS FROM approvals");
    const approvalColNames2 = approvalCols2.map((c: any) => c.Field);
    if (!approvalColNames2.includes('contractor_id')) {
      await poolConnection.query("ALTER TABLE approvals ADD COLUMN contractor_id INT DEFAULT NULL");
      try {
        await poolConnection.query("ALTER TABLE approvals ADD FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE SET NULL");
      } catch (e) {}
    }

    const [paymentCols]: any = await poolConnection.query("SHOW COLUMNS FROM contractor_payments");
    const paymentColNames = paymentCols.map((c: any) => c.Field);
    if (!paymentColNames.includes('contractor_id')) {
      await poolConnection.query("ALTER TABLE contractor_payments ADD COLUMN contractor_id INT DEFAULT NULL");
      try {
        await poolConnection.query("ALTER TABLE contractor_payments ADD FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE SET NULL");
      } catch (e) {}
    }

    // Vendors table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_name VARCHAR(255) NOT NULL UNIQUE,
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        gst_number VARCHAR(50),
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    const [vendorCols]: any = await poolConnection.query("SHOW COLUMNS FROM vendors");
    const vendorColNames = vendorCols.map((c: any) => c.Field);
    if (!vendorColNames.includes('phone')) {
      await poolConnection.query("ALTER TABLE vendors ADD COLUMN phone VARCHAR(50)");
    }

    // Ensure Placeholder Vendor exists for Draft POs
    console.log("PHONE SQL: SELECT * FROM vendors WHERE vendor_name = 'PLACEHOLDER VENDOR'");
    const [placeholderVendorRows]: any = await poolConnection.query(
      "SELECT * FROM vendors WHERE vendor_name = 'PLACEHOLDER VENDOR'"
    );
    if (placeholderVendorRows.length === 0) {
      console.log('🌱 Seeding Placeholder Vendor for Draft POs...');
      const placeholderVendorSQL = `
        INSERT INTO vendors (vendor_name, contact_person, phone, address, gst_number) 
        VALUES ('PLACEHOLDER VENDOR', 'TBD', 'TBD', 'TBD', 'TBD')
      `;
      console.log("PHONE SQL:", placeholderVendorSQL);
      await poolConnection.query(placeholderVendorSQL);
    }

    // Categories table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_name VARCHAR(255) NOT NULL,
        sub_category_name VARCHAR(255) DEFAULT 'MISCELLANEOUS',
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_category (category_name, sub_category_name)
      )
    `);

    const [catCols]: any = await poolConnection.query("SHOW COLUMNS FROM categories");
    const catColNames = catCols.map((c: any) => c.Field);
    if (!catColNames.includes('is_deleted')) {
      await poolConnection.query("ALTER TABLE categories ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE");
    }
    console.log('📊 Categories table schema after migration:', catColNames);

    // Units table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS units (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unit_name VARCHAR(50) NOT NULL UNIQUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [unitCols]: any = await poolConnection.query("SHOW COLUMNS FROM units");
    const unitColNames = unitCols.map((c: any) => c.Field);
    if (!unitColNames.includes('is_deleted')) {
      await poolConnection.query("ALTER TABLE units ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE");
    }
    console.log('📊 Units table schema after migration:', unitColNames);

    // Vendor Categories Mapping Table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS vendor_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id INT NOT NULL,
        category_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_vendor_category (vendor_id, category_id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);

    // Seed Default Categories
    const [catRows]: any = await poolConnection.query('SELECT COUNT(*) as count FROM categories');
    if (catRows[0].count === 0) {
      console.log('🌱 Seeding default categories...');
      await poolConnection.query(`
        INSERT INTO categories (category_name, sub_category_name) VALUES 
        ('CONSTRUCTION MATERIALS', 'CEMENT'),
        ('CONSTRUCTION MATERIALS', 'STEEL'),
        ('CONSTRUCTION MATERIALS', 'SAND'),
        ('CONSTRUCTION MATERIALS', 'BRICKS'),
        ('ELECTRICAL ITEMS', 'WIRES'),
        ('PLUMBING ITEMS', 'PIPES'),
        ('HARDWARE', 'NAILS'),
        ('TOOLS & MACHINERY', 'HAND TOOLS'),
        ('MISC', 'GENERAL')
      `);
    }

    // Seed Default Units
    const [unitRows]: any = await poolConnection.query('SELECT COUNT(*) as count FROM units');
    if (unitRows[0].count === 0) {
      console.log('🌱 Seeding default units...');
      await poolConnection.query(`
        INSERT INTO units (unit_name) VALUES 
        ('BAGS'), ('NOS'), ('KG'), ('TONS'), ('METERS'), ('FEET'), ('LTR'), ('BOX')
      `);
    }

    // System flags for tracking migrations
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key_name VARCHAR(100) PRIMARY KEY,
        key_value VARCHAR(100)
      )
    `);

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS roles_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL UNIQUE,
        role_code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_code VARCHAR(100) NOT NULL UNIQUE,
        role_name VARCHAR(100) NOT NULL,
        parent_role_code VARCHAR(100) NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [roleMasterCols]: any = await poolConnection.query("SHOW COLUMNS FROM roles_master");
    const roleMasterColNames = roleMasterCols.map((c: any) => c.Field);
    if (!roleMasterColNames.includes('role_code')) {
      await poolConnection.query("ALTER TABLE roles_master ADD COLUMN role_code VARCHAR(100) NULL AFTER role_name");
    }
    if (!roleMasterColNames.includes('description')) {
      await poolConnection.query("ALTER TABLE roles_master ADD COLUMN description TEXT NULL AFTER role_code");
    }
    if (!roleMasterColNames.includes('is_active')) {
      await poolConnection.query("ALTER TABLE roles_master ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER description");
    }
    if (!roleMasterColNames.includes('is_system')) {
      await poolConnection.query("ALTER TABLE roles_master ADD COLUMN is_system BOOLEAN DEFAULT FALSE AFTER is_active");
    }

    const systemRoles = [
      { role_name: ROLES.CEO, role_code: 'CEO', description: 'Root executive access' },
      { role_name: ROLES.CA, role_code: 'CA', description: 'Chartered Accountant finance, ledger, reporting, and procurement approval authority' },
      { role_name: ROLES.STORE_KEEPER, role_code: 'STORE_KEEPER', description: 'Inventory and GRN operations access' },
      { role_name: ROLES.GENERAL_MANAGER, role_code: 'GENERAL_MANAGER', description: 'Operational coordination, project supervision, reporting oversight, and medium approval authority' },
      { role_name: ROLES.SALES, role_code: 'SALES_MANAGER', description: 'Sales Manager access' },
      { role_name: ROLES.SITE_INCHARGE, role_code: 'SITE_INCHARGE', description: 'Site Incharge access' },
      { role_name: ROLES.SITE_ENGINEER, role_code: 'SITE_ENGINEER', description: 'Site Engineer access' },
      { role_name: ROLES.EXECUTIVE, role_code: 'EXECUTIVE', description: 'Executive access' }
    ];

    await poolConnection.query(
      'UPDATE roles_master SET is_active = FALSE WHERE role_code IN (?, ?)',
      [LEGACY_FINANCE_ROLE, 'PROCUREMENT_MANAGER']
    );

    for (const role of systemRoles) {
      await poolConnection.query(
        `INSERT INTO roles_master (role_name, role_code, description, is_active, is_system)
         VALUES (?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE
           role_name = VALUES(role_name),
           role_code = VALUES(role_code),
           description = VALUES(description),
           is_active = TRUE,
           is_system = TRUE`,
        [role.role_name, role.role_code, role.description]
      );
      await poolConnection.query(
        `INSERT INTO roles (role_code, role_name, parent_role_code, description, is_active, is_system)
         VALUES (?, ?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE
           role_name = VALUES(role_name),
           parent_role_code = VALUES(parent_role_code),
           description = VALUES(description),
           is_active = TRUE,
           is_system = TRUE`,
        [role.role_code, role.role_name, role.role_code === ROLES.CEO ? null : ROLES.CEO, role.description]
      );
    }

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS rbac_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_key VARCHAR(80) NOT NULL,
        action_key VARCHAR(80) NOT NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_rbac_permission (module_key, action_key)
      )
    `);

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_code VARCHAR(80) NOT NULL,
        permission_id INT NOT NULL,
        is_allowed BOOLEAN NOT NULL DEFAULT FALSE,
        updated_by VARCHAR(255) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role_permission (role_code, permission_id),
        FOREIGN KEY (permission_id) REFERENCES rbac_permissions(id) ON DELETE CASCADE
      )
    `);

    await poolConnection.query(`
      INSERT INTO role_permissions (role_code, permission_id, is_allowed, updated_by)
      SELECT ?, permission_id, MAX(is_allowed), 'FINANCE_ROLE_TO_CA_MIGRATION'
      FROM role_permissions
      WHERE role_code IN (?, ?)
      GROUP BY permission_id
      ON DUPLICATE KEY UPDATE
        is_allowed = GREATEST(role_permissions.is_allowed, VALUES(is_allowed)),
        updated_by = 'FINANCE_ROLE_TO_CA_MIGRATION'
    `, [ROLES.CA, LEGACY_FINANCE_ROLE, ROLES.CA]);
    await poolConnection.query('DELETE FROM role_permissions WHERE role_code = ?', [LEGACY_FINANCE_ROLE]);
    await poolConnection.query('UPDATE roles SET is_active = FALSE WHERE role_code = ?', [LEGACY_FINANCE_ROLE]);

    // User-level permission overrides (extends role-based defaults)
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        permission_id INT NOT NULL,
        is_allowed BOOLEAN NOT NULL DEFAULT FALSE,
        override_reason VARCHAR(255) NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_permission (user_id, permission_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES rbac_permissions(id) ON DELETE CASCADE
      )
    `);

    // Add index for fast lookup
    await addIndexSafe("CREATE INDEX idx_user_permissions ON user_permissions(user_id, permission_id)");

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS user_access_audit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor_uid VARCHAR(255) NULL,
        actor_email VARCHAR(255) NULL,
        actor_role VARCHAR(80) NULL,
        target_uid VARCHAR(255) NULL,
        target_user_id INT NULL,
        event_type VARCHAR(80) NOT NULL,
        module_key VARCHAR(80) NULL,
        action_key VARCHAR(80) NULL,
        old_value VARCHAR(10) NULL,
        new_value VARCHAR(10) NULL,
        override_reason VARCHAR(255) NULL,
        before_snapshot JSON NULL,
        after_snapshot JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    const [accessAuditCols]: any = await poolConnection.query("SHOW COLUMNS FROM user_access_audit");
    const accessAuditColNames = accessAuditCols.map((c: any) => c.Field);
    if (!accessAuditColNames.includes('actor_role')) {
      await poolConnection.query("ALTER TABLE user_access_audit ADD COLUMN actor_role VARCHAR(80) NULL AFTER actor_email");
    }
    if (!accessAuditColNames.includes('target_user_id')) {
      await poolConnection.query("ALTER TABLE user_access_audit ADD COLUMN target_user_id INT NULL AFTER target_uid");
      try {
        await poolConnection.query(
          "ALTER TABLE user_access_audit ADD CONSTRAINT fk_user_access_audit_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL"
        );
      } catch (e) {
        console.warn('[INIT] Could not add FK for target_user_id:', (e as any).message);
      }
    }

    const governanceRoles = [ROLES.CEO, ROLES.CA, ROLES.GENERAL_MANAGER, ROLES.STORE_KEEPER, ROLES.SITE_INCHARGE, ROLES.SITE_ENGINEER, ROLES.SALES, ROLES.EXECUTIVE];
    for (const moduleKey of RBAC_MODULES) {
      for (const actionKey of RBAC_ACTIONS) {
        await poolConnection.query(
          `INSERT INTO rbac_permissions (module_key, action_key, description)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE description = VALUES(description)`,
          [moduleKey, actionKey, `${moduleKey}.${actionKey}`]
        );
      }
    }

    const [permissionRows]: any = await poolConnection.query('SELECT id, module_key, action_key FROM rbac_permissions');
    for (const role of governanceRoles) {
      for (const permission of permissionRows) {
        const allowed = DEFAULT_ROLE_PERMISSIONS[role]?.[permission.module_key as RbacModule]?.[permission.action_key as RbacAction] === true;
        await poolConnection.query(
          `INSERT INTO role_permissions (role_code, permission_id, is_allowed, updated_by)
           VALUES (?, ?, ?, 'SYSTEM_SEED')
           ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed), updated_by = 'SYSTEM_SEED'`,
          [role, permission.id, allowed]
        );
      }
    }

    // Backfill missing finalAmount for legacy GRN records (Run only once)
    const [flagRows]: any = await poolConnection.query(
      "SELECT key_value FROM system_flags WHERE key_name = 'grn_backfill_done'"
    );

    if (flagRows.length === 0) {
      console.log('🧹 Running one-time GRN finalAmount backfill...');
      const [backfillResult]: any = await poolConnection.query(`
        UPDATE grns
        SET finalAmount = GREATEST(
          0,
          total_amount 
          - (CASE WHEN discountType = 'PERCENTAGE' THEN (total_amount * COALESCE(discountValue, 0) / 100) ELSE COALESCE(discountValue, 0) END)
          + COALESCE(transportCharges, 0)
          + COALESCE(otherCharges, 0)
        )
        WHERE finalAmount IS NULL
      `);
      
      await poolConnection.query(
        "INSERT INTO system_flags (key_name, key_value) VALUES ('grn_backfill_done', 'true')"
      );
      console.log(`✅ GRN backfill completed. ${backfillResult.affectedRows} records updated.`);
    }

    // 2. FIFO Migration: Move existing stock to batches
    const [fifoFlagRows]: any = await poolConnection.query(
      "SELECT key_value FROM system_flags WHERE key_name = 'fifo_migration_done'"
    );

    if (fifoFlagRows.length === 0) {
      console.log('📦 Running one-time FIFO migration (Inventory to Batches)...');
      
      const [invItems]: any = await poolConnection.query(
        "SELECT id, quantity, price_per_unit, createdAt FROM inventory WHERE quantity > 0 AND is_deleted = FALSE"
      );

      for (const item of invItems) {
        await poolConnection.query(
          `INSERT INTO inventory_batches (inventory_id, batch_number, quantity_received, quantity_remaining, unit_price, received_date, is_void)
           VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
          [item.id, 'INITIAL_STOCK', item.quantity, item.quantity, item.price_per_unit, new Date(item.createdAt).toISOString().split('T')[0]]
        );
      }

      await poolConnection.query(
        "INSERT INTO system_flags (key_name, key_value) VALUES ('fifo_migration_done', 'true')"
      );
      console.log(`✅ FIFO migration completed. ${invItems.length} items migrated to batches.`);
    }

    console.log('✅ Database tables and FIFO migration ready.');

    // 3. Contractor Safe Staged Migration
    const stagingConnection = await mysql.createConnection({ ...dbConfig, database: DB_NAME });
    const [contractorFlagRows]: any = await stagingConnection.query(
      "SELECT key_value FROM system_flags WHERE key_name = 'contractor_safe_migration_done'"
    );

    if (contractorFlagRows.length === 0) {
      console.log('🏗️ Running one-time Safe Staged Migration for Contractors...');
      
      const [legacyNames]: any = await stagingConnection.query(`
        SELECT DISTINCT name FROM (
          SELECT vendorName as name FROM approvals WHERE type = 'Contractor Payment' AND vendorName IS NOT NULL AND vendorName != ''
          UNION
          SELECT contractor_name as name FROM contractor_payments WHERE contractor_name IS NOT NULL AND contractor_name != ''
        ) as combined
      `);

      let mappedCount = 0;
      for (const item of legacyNames) {
        const cName = item.name.trim();
        if (!cName) continue;
        
        const dummyMobile = 'MIG-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        const [res]: any = await stagingConnection.query(
          `INSERT INTO contractors (contractor_name, mobile_number, contractor_type, source, verification_status)
           VALUES (?, ?, 'Legacy', 'SYSTEM_MIGRATED', 'UNVERIFIED')`,
          [cName, dummyMobile]
        );
        const newId = res.insertId;

        await stagingConnection.query(
          `UPDATE approvals SET contractor_id = ? WHERE type = 'Contractor Payment' AND vendorName = ?`,
          [newId, item.name]
        );

        await stagingConnection.query(
          `UPDATE contractor_payments SET contractor_id = ? WHERE contractor_name = ?`,
          [newId, item.name]
        );
        mappedCount++;
      }

      await stagingConnection.query(
        "INSERT INTO system_flags (key_name, key_value) VALUES ('contractor_safe_migration_done', 'true')"
      );
      console.log(`✅ Safe Staged Migration completed. ${mappedCount} provisional contractors created.`);
    }
    await stagingConnection.end();
    
    // 4. Project Name Normalization Migration (Approvals)
    const [approvalMigFlag]: any = await poolConnection.query(
      "SELECT key_value FROM system_flags WHERE key_name = 'approval_proj_mig_done'"
    );

    if (approvalMigFlag.length === 0) {
      console.log('🔄 Migrating approvals to use projectId source of truth...');
      const [res]: any = await poolConnection.query(`
        UPDATE approvals a
        JOIN projects p ON a.projectName = p.name
        SET a.projectId = p.id
        WHERE a.projectId IS NULL
      `);
      await poolConnection.query(
        "INSERT INTO system_flags (key_name, key_value) VALUES ('approval_proj_mig_done', 'true')"
      );
      console.log(`✅ Approvals project migration completed. ${res.affectedRows} records linked.`);
    }

    // 5. Project Rename History Table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS project_rename_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        old_name VARCHAR(255) NOT NULL,
        new_name VARCHAR(255) NOT NULL,
        renamed_by VARCHAR(255) NOT NULL,
        renamed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rename_reason TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // ═══════════════════════════════════════════════════════════════
    // PROCUREMENT GOVERNANCE TABLES
    // ═══════════════════════════════════════════════════════════════

    // 1. Purchase Requests
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pr_number VARCHAR(50) NOT NULL UNIQUE,
        project_id INT DEFAULT NULL,
        procurement_type ENUM('PROJECT', 'GENERAL_STOCK') DEFAULT 'PROJECT',
        requested_by VARCHAR(255) NOT NULL,
        requested_by_uid VARCHAR(255) NOT NULL,
        request_reason TEXT,
        priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
        status VARCHAR(50) DEFAULT 'DRAFT',
        estimated_total DECIMAL(15,2) DEFAULT 0.00,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    // Add procurement_type and make project_id nullable for purchase_requests
    const [prCols]: any = await poolConnection.query("SHOW COLUMNS FROM purchase_requests");
    const prColNames = prCols.map((c: any) => c.Field);
    if (!prColNames.includes('procurement_type')) {
      await poolConnection.query("ALTER TABLE purchase_requests ADD COLUMN procurement_type ENUM('PROJECT', 'GENERAL_STOCK') DEFAULT 'PROJECT' AFTER pr_number");
    }
    if (prColNames.includes('project_id')) {
      const [prProjCol]: any = await poolConnection.query("SHOW COLUMNS FROM purchase_requests WHERE Field = 'project_id'");
      if (prProjCol[0].Null === 'NO') {
        await poolConnection.query("ALTER TABLE purchase_requests MODIFY COLUMN project_id INT DEFAULT NULL");
        // Get foreign key name
        const [fkRows]: any = await poolConnection.query(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'purchase_requests' 
            AND COLUMN_NAME = 'project_id' 
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        if (fkRows.length > 0) {
          await poolConnection.query(`ALTER TABLE purchase_requests DROP FOREIGN KEY ${fkRows[0].CONSTRAINT_NAME}`);
        }
        await poolConnection.query("ALTER TABLE purchase_requests ADD FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL");
      }
    }

    // 2. Procurement Items (active line items for PR/PO; WO retained only for historical rows)
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS procurement_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_type ENUM('PR', 'PO', 'WO') NOT NULL,
        parent_id INT NOT NULL,
        inventory_id INT DEFAULT NULL,
        item_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(15,2) NOT NULL,
        received_quantity DECIMAL(15,2) DEFAULT 0.00,
        estimated_rate DECIMAL(18,6) DEFAULT 0.00,
        approved_rate DECIMAL(18,6) DEFAULT 0.00,
        gst_percent DECIMAL(5,2) DEFAULT 0.00,
        tax_amount DECIMAL(15,2) DEFAULT 0.00,
        total_amount DECIMAL(15,2) DEFAULT 0.00,
        remarks TEXT,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
      )
    `);
    
    // Make inventory_id in procurement_items nullable (for quick register)
    const [itemCols]: any = await poolConnection.query("SHOW COLUMNS FROM procurement_items");
    const itemColNames = itemCols.map((c: any) => c.Field);
    if (itemColNames.includes('inventory_id')) {
      const [invCol]: any = await poolConnection.query("SHOW COLUMNS FROM procurement_items WHERE Field = 'inventory_id'");
      if (invCol[0].Null === 'NO') {
        console.log('🔄 Making procurement_items.inventory_id nullable');
        try {
          // Drop foreign key first if it exists
          const [fkRows]: any = await poolConnection.query(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'procurement_items' 
              AND COLUMN_NAME = 'inventory_id' 
              AND REFERENCED_TABLE_NAME IS NOT NULL
          `);
          if (fkRows.length > 0) {
            await poolConnection.query(`ALTER TABLE procurement_items DROP FOREIGN KEY ${fkRows[0].CONSTRAINT_NAME}`);
          }
          // Modify column to nullable
          await poolConnection.query("ALTER TABLE procurement_items MODIFY COLUMN inventory_id INT DEFAULT NULL");
          // Re-add foreign key with ON DELETE SET NULL
          await poolConnection.query("ALTER TABLE procurement_items ADD FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL");
        } catch (e) {
          console.warn('⚠️ Could not modify inventory_id foreign key, continuing:', e);
        }
      }
    }
    if (!itemColNames.includes('received_quantity')) {
      await poolConnection.query("ALTER TABLE procurement_items ADD COLUMN received_quantity DECIMAL(15,2) DEFAULT 0.00");
    }
    if (!itemColNames.includes('estimated_rate')) {
      await poolConnection.query("ALTER TABLE procurement_items ADD COLUMN estimated_rate DECIMAL(18,6) DEFAULT 0.00");
    }
    if (!itemColNames.includes('approved_rate')) {
      await poolConnection.query("ALTER TABLE procurement_items ADD COLUMN approved_rate DECIMAL(18,6) DEFAULT 0.00");
    }
    if (!itemColNames.includes('gst_percent')) {
      await poolConnection.query("ALTER TABLE procurement_items ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 0.00");
    }
    if (!itemColNames.includes('tax_amount')) {
      await poolConnection.query("ALTER TABLE procurement_items ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0.00");
    }
    if (!itemColNames.includes('total_amount')) {
      await poolConnection.query("ALTER TABLE procurement_items ADD COLUMN total_amount DECIMAL(15,2) DEFAULT 0.00");
    }
    if (itemColNames.includes('unit_rate')) {
      console.log('🔧 Found legacy unit_rate column, setting default 0');
      try {
        await poolConnection.query("ALTER TABLE procurement_items MODIFY COLUMN unit_rate DECIMAL(18,6) DEFAULT 0.00");
      } catch (e) {
        console.warn('⚠️ Could not modify unit_rate column, continuing:', e);
      }
    }

    // 3. Purchase Orders
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_number VARCHAR(50) NOT NULL UNIQUE,
        vendor_id INT NOT NULL,
        project_id INT DEFAULT NULL,
        procurement_type ENUM('PROJECT', 'GENERAL_STOCK') DEFAULT 'PROJECT',
        linked_pr_id INT DEFAULT NULL,
        subtotal DECIMAL(15,2) DEFAULT 0.00,
        gst_total DECIMAL(15,2) DEFAULT 0.00,
        final_total DECIMAL(15,2) DEFAULT 0.00,
        po_status VARCHAR(50) DEFAULT 'OPEN',
        version INT DEFAULT 1,
        approved_by VARCHAR(255) DEFAULT NULL,
        created_by VARCHAR(255) NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (linked_pr_id) REFERENCES purchase_requests(id)
      )
    `);

    // Add procurement_type and make project_id nullable for purchase_orders
    const [poCols]: any = await poolConnection.query("SHOW COLUMNS FROM purchase_orders");
    const poColNames = poCols.map((c: any) => c.Field);
    if (!poColNames.includes('procurement_type')) {
      await poolConnection.query("ALTER TABLE purchase_orders ADD COLUMN procurement_type ENUM('PROJECT', 'GENERAL_STOCK') DEFAULT 'PROJECT' AFTER po_number");
    }
    if (poColNames.includes('project_id')) {
      const [poProjCol]: any = await poolConnection.query("SHOW COLUMNS FROM purchase_orders WHERE Field = 'project_id'");
      if (poProjCol[0].Null === 'NO') {
        await poolConnection.query("ALTER TABLE purchase_orders MODIFY COLUMN project_id INT DEFAULT NULL");
        // Get foreign key name
        const [fkRows]: any = await poolConnection.query(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'purchase_orders' 
            AND COLUMN_NAME = 'project_id' 
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        if (fkRows.length > 0) {
          await poolConnection.query(`ALTER TABLE purchase_orders DROP FOREIGN KEY ${fkRows[0].CONSTRAINT_NAME}`);
        }
        await poolConnection.query("ALTER TABLE purchase_orders ADD FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL");
      }
    }

    // PO Revisions Table
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_revisions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        revision_number INT NOT NULL,
        snapshot_json JSON NOT NULL,
        reason TEXT,
        created_by VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      )
    `);

    if (!poColNames.includes('version')) await poolConnection.query("ALTER TABLE purchase_orders ADD COLUMN version INT DEFAULT 1 AFTER po_status");
    
    // Fix existing procurement_items with NULL received_quantity
    await poolConnection.query("UPDATE procurement_items SET received_quantity = 0 WHERE received_quantity IS NULL");

    // 4. Retired Work Order tables retained for audit lineage and recoverability only.
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wo_number VARCHAR(50) NOT NULL UNIQUE,
        contractor_id INT NOT NULL,
        project_id INT NOT NULL,
        scope_of_work TEXT,
        work_value DECIMAL(15,2) DEFAULT 0.00,
        wo_status VARCHAR(50) DEFAULT 'OPEN',
        approved_by VARCHAR(255) DEFAULT NULL,
        created_by VARCHAR(255) NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (contractor_id) REFERENCES contractors(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // 5. Procurement Audit Logs
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS procurement_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type ENUM('PR', 'PO', 'WO') NOT NULL,
        entity_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        performed_by VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        remarks TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 🛡️ Performance Indexes for Procurement
    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS status_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type ENUM('PR','PO','GRN') NOT NULL,
        entity_id INT NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        changed_by INT NULL,
        changed_by_name VARCHAR(255),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        INDEX idx_status_entity (entity_type, entity_id)
      )
    `);

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS legacy_pr_valuation (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pr_id INT NOT NULL,
        estimated_total DECIMAL(15,2),
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_legacy_pr (pr_id)
      )
    `);

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS legacy_po_valuation (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        subtotal DECIMAL(15,2),
        gst_total DECIMAL(15,2),
        final_total DECIMAL(15,2),
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_legacy_po (po_id)
      )
    `);

    await poolConnection.query(`
      INSERT INTO legacy_pr_valuation (pr_id, estimated_total)
      SELECT pr.id, pr.estimated_total
      FROM purchase_requests pr
      LEFT JOIN legacy_pr_valuation lpv ON lpv.pr_id = pr.id
      WHERE pr.estimated_total IS NOT NULL AND pr.estimated_total > 0 AND lpv.id IS NULL
    `).catch(() => {});

    await poolConnection.query(`
      INSERT INTO legacy_po_valuation (po_id, subtotal, gst_total, final_total)
      SELECT po.id, po.subtotal, po.gst_total, po.final_total
      FROM purchase_orders po
      LEFT JOIN legacy_po_valuation lpv ON lpv.po_id = po.id
      WHERE po.final_total IS NOT NULL AND po.final_total > 0 AND lpv.id IS NULL
    `).catch(() => {});

    await poolConnection.query(`
      CREATE TABLE IF NOT EXISTS vendor_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id INT NOT NULL,
        item_id INT NOT NULL,
        quoted_rate DECIMAL(18,6) NOT NULL,
        validity_date DATE NOT NULL,
        remarks TEXT,
        uploaded_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_vendor_quotes_vendor_item (vendor_id, item_id)
      )
    `);

    await poolConnection.query(`
      INSERT INTO status_history (entity_type, entity_id, old_status, new_status, changed_by, changed_by_name, remarks)
      SELECT 'PR', pr.id, pr.status, 'APPROVED', NULL, 'System Migration', 'Normalized legacy PO_CREATED PR state back to APPROVED requirement intent'
      FROM purchase_requests pr
      LEFT JOIN status_history sh
        ON sh.entity_type = 'PR'
       AND sh.entity_id = pr.id
       AND sh.old_status = 'PO_CREATED'
       AND sh.new_status = 'APPROVED'
      WHERE UPPER(TRIM(pr.status)) = 'PO_CREATED' AND sh.id IS NULL
    `).catch(() => {});

    await poolConnection.query(`
      UPDATE purchase_requests
      SET status = 'APPROVED'
      WHERE UPPER(TRIM(status)) = 'PO_CREATED'
    `).catch(() => {});

    const addProcIndexSafe = async (q: string) => {
      try { await poolConnection.query(q); } catch (e) {}
    };
    await addProcIndexSafe("CREATE INDEX idx_pr_status ON purchase_requests(status)");
    await addProcIndexSafe("CREATE INDEX idx_po_status ON purchase_orders(po_status)");
    // await addProcIndexSafe("CREATE INDEX idx_wo_status ON work_orders(wo_status)"); // WO MODULE DECOMMISSIONED — table preserved for audit lineage only
    await addProcIndexSafe("CREATE INDEX idx_proc_items_parent ON procurement_items(parent_type, parent_id)");

    poolConnection.release();
    console.log('🚀 [INIT] Database initialization fully complete.');
  } catch (error: any) {
    console.error('❌ [INIT] Database Initialization Failed:', error.message);
    if (poolConnection) poolConnection.release();
    throw error;
  }
}


// ═══════════════════════════════════════════════════════════════
// PROJECT MASTER ROUTES
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// ROLE MASTER ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/master/roles', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM roles_master WHERE is_active = TRUE ORDER BY role_name ASC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/master/roles/all', authorizeAction('rbac', 'manage_rbac'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM roles_master ORDER BY role_name ASC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/master/roles', authorizeAction('rbac', 'manage_rbac'), async (req, res) => {
  const { role_name, role_code, description } = req.body;
  if (!role_name || !role_code) return res.status(400).json({ error: 'Missing role name or code' });

  const reserved = ['CEO', 'ROOT CEO', 'SUPER ADMIN', 'ROOT'];
  if (reserved.includes(role_name.toUpperCase()) || reserved.includes(role_code.toUpperCase())) {
    return res.status(400).json({ error: 'Reserved role name/code' });
  }

  try {
    await pool.execute(
      'INSERT INTO roles_master (role_name, role_code, description) VALUES (?, ?, ?)',
      [role_name, role_code, description || '']
    );
    res.status(201).json({ message: 'Role created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/master/roles/:id', authorizeAction('rbac', 'manage_rbac'), async (req, res) => {
  const { id } = req.params;
  const { role_name, role_code, description, is_active } = req.body;

  try {
    const [existing]: any = await pool.execute('SELECT * FROM roles_master WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Role not found' });
    
    if (existing[0].is_system) return res.status(403).json({ error: 'System roles cannot be modified' });

    await pool.execute(
      'UPDATE roles_master SET role_name = ?, role_code = ?, description = ?, is_active = ? WHERE id = ?',
      [role_name, role_code, description, is_active, id]
    );
    res.status(200).json({ message: 'Role updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.delete('/master/roles/:id', authorizeAction('rbac', 'manage_rbac'), async (req, res) => {
  const { id } = req.params;
  try {
    const [existing]: any = await pool.execute('SELECT * FROM roles_master WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Role not found' });
    if (existing[0].is_system) return res.status(403).json({ error: 'System roles cannot be deleted' });

    await pool.execute('DELETE FROM roles_master WHERE id = ?', [id]);
    res.status(200).json({ message: 'Role deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Role cannot be deleted as it may be assigned to users. Deactivate it instead.' });
  }
});


api.get('/master/projects', authorizeAction('masters', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM projects WHERE is_deleted = FALSE ORDER BY name ASC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/master/projects', authorizeAction('masters', 'create'), async (req, res) => {
  const { name, code, location, startDate, expectedEndDate, status, budget, revenue } = req.body;
  if (!name || !code || !location) return res.status(400).json({ error: 'Missing fields' });

  try {
    const [result]: any = await pool.execute(
      'INSERT INTO projects (name, code, location, startDate, expectedEndDate, status, budget, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, code, location, startDate || '', expectedEndDate || '', status || 'ACTIVE', budget || 0, revenue || 0]
    );
    res.status(201).json({ id: result.insertId, message: 'Project created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/master/projects/:id', authorizeAction('masters', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { name, code, location, startDate, expectedEndDate, status, budget, revenue, rename_reason } = req.body;
  const session = (req as any).user as Session;
  
  try {
    // 1. Get current project state
    const [current]: any = await pool.execute('SELECT name FROM projects WHERE id = ?', [id]);
    if (current.length === 0) return res.status(404).json({ error: 'Project not found' });
    
    const oldName = current[0].name;
    const newName = name.trim();

    // 2. Duplicate Name Validation (Case-insensitive)
    const [duplicates]: any = await pool.execute(
      'SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND is_deleted = FALSE',
      [newName, id]
    );
    if (duplicates.length > 0) {
      return res.status(400).json({ error: `A project with the name '${newName}' already exists.` });
    }

    // 3. Perform Update
    await pool.execute(
      'UPDATE projects SET name=?, code=?, location=?, startDate=?, expectedEndDate=?, status=?, budget=?, revenue=? WHERE id=?',
      [newName, code, location, startDate, expectedEndDate, status, budget, revenue, id]
    );

    // 4. Record Rename History if name changed
    if (oldName !== newName) {
      await pool.execute(
        'INSERT INTO project_rename_history (project_id, old_name, new_name, renamed_by, rename_reason) VALUES (?, ?, ?, ?, ?)',
        [id, oldName, newName, session.name, rename_reason || 'Manual Update']
      );
      
      // FALLBACK: Also update redundant columns to minimize breakages in un-refactored code (though display will use JOIN)
      await pool.execute('UPDATE material_issues SET project_name = ? WHERE project_id = ?', [newName, id]);
      await pool.execute('UPDATE approvals SET projectName = ? WHERE projectId = ?', [newName, id]);
    }

    res.status(200).json({ message: 'Project updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.delete('/master/projects/:id', authorizeAction('masters', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE projects SET is_deleted = TRUE WHERE id = ?', [id]);
    res.status(200).json({ message: 'Project deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// VENDOR MASTER ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/master/vendors', authorizeAction('masters', 'view'), async (req, res) => {
  try {
    const vendorSelectSQL = 'SELECT * FROM vendors WHERE is_deleted = FALSE ORDER BY vendor_name ASC';
    console.log("PHONE SQL:", vendorSelectSQL);
    const [vendors] = await pool.execute(vendorSelectSQL);
    const vendorIds = (vendors as any[]).map(v => v.id);
    let vendorCategories: any[] = [];
    if (vendorIds.length > 0) {
      const [catResult] = await pool.execute(`
        SELECT vc.vendor_id, c.* 
        FROM vendor_categories vc 
        JOIN categories c ON vc.category_id = c.id 
        WHERE vc.vendor_id IN (${vendorIds.map(() => '?').join(',')})
      `, vendorIds);
      vendorCategories = catResult as any[];
    }
    const categoryMap = new Map();
    vendorCategories.forEach(cat => {
      if (!categoryMap.has(cat.vendor_id)) categoryMap.set(cat.vendor_id, []);
      categoryMap.get(cat.vendor_id).push(cat);
    });
    const vendorsWithCategories = (vendors as any[]).map(v => ({
      ...v,
      categories: categoryMap.get(v.id) || []
    }));
    res.status(200).json(vendorsWithCategories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/master/vendors', authorizeAction('masters', 'create'), async (req, res) => {
  const { vendor_name, contact_person, phone, address, gst_number, category_ids } = req.body;
  if (!vendor_name) return res.status(400).json({ error: 'Vendor name required' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const vendorInsertSQL = 'INSERT INTO vendors (vendor_name, contact_person, phone, address, gst_number) VALUES (?, ?, ?, ?, ?)';
    console.log("PHONE SQL:", vendorInsertSQL);
    const [result]: any = await connection.execute(
      vendorInsertSQL,
      [vendor_name, contact_person, phone, address, gst_number]
    );
    const vendorId = result.insertId;
    if (category_ids && category_ids.length > 0) {
      for (const categoryId of category_ids) {
        await connection.execute(
          'INSERT IGNORE INTO vendor_categories (vendor_id, category_id) VALUES (?, ?)',
          [vendorId, categoryId]
        );
      }
    }
    await connection.commit();
    res.status(201).json({ id: vendorId, message: 'Vendor created' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.put('/master/vendors/:id', authorizeAction('masters', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { vendor_name, contact_person, phone, address, gst_number, category_ids } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const vendorUpdateSQL = 'UPDATE vendors SET vendor_name=?, contact_person=?, phone=?, address=?, gst_number=? WHERE id=?';
    console.log("PHONE SQL:", vendorUpdateSQL);
    await connection.execute(
      vendorUpdateSQL,
      [vendor_name, contact_person, phone, address, gst_number, id]
    );
    await connection.execute('DELETE FROM vendor_categories WHERE vendor_id = ?', [id]);
    if (category_ids && category_ids.length > 0) {
      for (const categoryId of category_ids) {
        await connection.execute(
          'INSERT IGNORE INTO vendor_categories (vendor_id, category_id) VALUES (?, ?)',
          [id, categoryId]
        );
      }
    }
    await connection.commit();
    res.status(200).json({ message: 'Vendor updated' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.delete('/master/vendors/:id', authorizeAction('masters', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE vendors SET is_deleted = TRUE WHERE id = ?', [id]);
    res.status(200).json({ message: 'Vendor deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CATEGORY MASTER ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/master/categories', authorizeAction('masters', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM categories WHERE is_deleted = FALSE ORDER BY category_name ASC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/master/categories', authorizeAction('masters', 'create'), async (req, res) => {
  const { category_name, sub_category_name } = req.body;
  if (!category_name) return res.status(400).json({ error: 'Category name required' });

  try {
    const [result]: any = await pool.execute(
      'INSERT INTO categories (category_name, sub_category_name) VALUES (?, ?)',
      [category_name, sub_category_name || 'MISCELLANEOUS']
    );
    res.status(201).json({ id: result.insertId, message: 'Category created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/master/categories/:id', authorizeAction('masters', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { category_name, sub_category_name } = req.body;
  try {
    await pool.execute(
      'UPDATE categories SET category_name=?, sub_category_name=? WHERE id=?',
      [category_name, sub_category_name, id]
    );
    res.status(200).json({ message: 'Category updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.delete('/master/categories/:id', authorizeAction('masters', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE categories SET is_deleted = TRUE WHERE id = ?', [id]);
    res.status(200).json({ message: 'Category deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// UNIT MASTER ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/master/units', authorizeAction('masters', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM units WHERE is_deleted = FALSE ORDER BY unit_name ASC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/master/units', authorizeAction('masters', 'create'), async (req, res) => {
  const { unit_name } = req.body;
  if (!unit_name) return res.status(400).json({ error: 'Unit name required' });

  try {
    const [result]: any = await pool.execute(
      'INSERT INTO units (unit_name) VALUES (?)',
      [unit_name]
    );
    res.status(201).json({ id: result.insertId, message: 'Unit created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/master/units/:id', authorizeAction('masters', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { unit_name } = req.body;
  try {
    await pool.execute('UPDATE units SET unit_name=? WHERE id=?', [unit_name, id]);
    res.status(200).json({ message: 'Unit updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.delete('/master/units/:id', authorizeAction('masters', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE units SET is_deleted = TRUE WHERE id = ?', [id]);
    res.status(200).json({ message: 'Unit deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
api.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 40px; text-align: center;">
      <h1 style="color: #2563eb;">BuildCore CMS API Server</h1>
      <p style="color: #4b5563;">The backend API server is running successfully on port ${PORT}.</p>
      <div style="margin-top: 20px; padding: 20px; background: #f3f4f6; border-radius: 8px; display: inline-block;">
        <p style="margin: 0; font-weight: bold;">To view the application, please open the frontend URL:</p>
        <code style="display: block; margin-top: 10px; font-size: 1.2em; color: #059669;">http://localhost:5173</code>
      </div>
    </div>
  `);
});

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════════

// Get public unique roles for Role-based login (Excludes CEO)
api.get('/auth/public-roles', async (req, res) => {
  try {
    const [rows]: any = await pool.execute(
      "SELECT role_code AS role FROM roles_master WHERE is_active = TRUE AND role_code != 'CEO' ORDER BY role_code ASC"
    );
    res.status(200).json(rows.map((r: any) => r.role));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Login (Strict Hierarchical RBAC Path)
api.post('/auth/login', async (req, res) => {
  const { email, password, role, type } = req.body;

  try {
    let user: any = null;

    if (type === 'CEO' || email) {
      // 👑 CEO Login: Must use email
      const targetEmail = email || '';
      const [rows]: any = await pool.execute(
        'SELECT * FROM users WHERE email = ? AND is_deleted = FALSE AND status = "Active"',
        [targetEmail]
      );
      if (rows.length > 0) {
        // Enforce CEO role for email login path
        if (rows[0].role === ROLES.CEO) user = rows[0];
      }
    } else if (role) {
      // 🛠️ Staff Login: Use Role + Password
      if (role === ROLES.CEO) {
        return res.status(403).json({ error: 'CEO must login via email portal.' });
      }

      // Check if role is valid in new hierarchy
      if (!Object.values(ROLES).includes(role as any)) {
        return res.status(400).json({ error: 'Invalid or legacy role specified.' });
      }

      const [rows]: any = await pool.execute(
        'SELECT * FROM users WHERE role = ? AND is_deleted = FALSE AND status = "Active"',
        [role]
      );
      
      if (rows.length > 0) {
        for (const u of rows) {
          if (verifyPassword(password, u.password_hash)) {
            user = u;
            break;
          }
        }
      }
    }

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const effectivePermissions = await getUserEffectivePermissions(user.id, user.role);

    // Create session (Standardized shape)
    const token = createSession(user.id, user.uid, user.email, user.role, user.name, !!user.mustChangePwd, user.backdate_limit || 0);
    
    return res.status(200).json({
      token,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePwd: !!user.mustChangePwd,
        backdateLimit: user.backdate_limit || 0,
        effectivePermissions
      }
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout
api.post('/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    deleteSession(token);
  }
  res.status(200).json({ message: 'Logged out successfully' });
});

// Get current user
api.get('/auth/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  try {
    const [rows]: any = await pool.execute(
      'SELECT uid, id, name, email, role, status, mustChangePwd FROM users WHERE id = ? AND is_deleted = FALSE',
      [session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dbUser = rows[0];
    const effectivePermissions = await getUserEffectivePermissions(dbUser.id, dbUser.role);

    res.status(200).json({ 
      user: {
        ...dbUser,
        effectivePermissions
      } 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change Password
api.post('/auth/change-password', requireAuth, async (req: any, res: any) => {
  const { newPassword } = req.body;
  const userId = req.user.userId;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  try {
    const passwordHash = hashPassword(newPassword);
    
    await pool.execute(
      'UPDATE users SET password_hash = ?, mustChangePwd = FALSE WHERE id = ?',
      [passwordHash, userId]
    );

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

api.post('/auth/ceo-password', requireAuth, authorizeAction('rbac', 'manage_users'), async (req: any, res: any) => {
  if (req.user.email !== ROOT_CEO_EMAIL) {
    return res.status(403).json({ error: 'This endpoint is strictly for the Root CEO.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }

  try {
    const [rows]: any = await pool.execute('SELECT password_hash FROM users WHERE email = ?', [ROOT_CEO_EMAIL]);
    if (rows.length === 0) return res.status(404).json({ error: 'Root CEO not found.' });

    const isValid = verifyPassword(currentPassword, rows[0].password_hash);
    if (!isValid) return res.status(401).json({ error: 'Incorrect current password.' });

    const newHash = hashPassword(newPassword);
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE email = ?',
      [newHash, ROOT_CEO_EMAIL]
    );

    // Secure audit log
    await pool.execute(
      'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
      ['Root CEO', 'PASSWORD_CHANGED', JSON.stringify({ session_invalidated: true })]
    );

    // Invalidate sessions
    invalidateSessionsByEmail(ROOT_CEO_EMAIL);

    res.status(200).json({ message: 'Password updated securely.' });
  } catch (error: any) {
    console.error('CEO Password reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN - USER MANAGEMENT ROUTES (CEO ONLY)
// ═══════════════════════════════════════════════════════════════

const requireCEO = authorizeAction('rbac', 'manage_users');

// Helper to check if trying to modify root CEO
const checkRootProtection = async (uid: string) => {
  const [rows]: any = await pool.execute('SELECT email FROM users WHERE uid = ?', [uid]);
  if (rows.length > 0 && rows[0].email === ROOT_CEO_EMAIL) {
    throw new Error('Root CEO account is protected and cannot be modified or deleted.');
  }
};

// Helper to prevent self-sabotage
const checkSelfProtection = (uid: string, req: any) => {
  if (req.user.uid === uid) {
    throw new Error('You cannot deactivate or delete your own account.');
  }
};

api.get('/admin/users', requireCEO, async (req, res) => {
  try {
    // Show all users including soft deleted
    const [rows] = await pool.execute(
      'SELECT uid, id, name, email, role, status, mustChangePwd, backdate_limit, is_deleted, last_login, createdAt FROM users ORDER BY createdAt DESC'
    );
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/admin/users', requireCEO, async (req, res) => {
  const { name, email, password, status } = req.body;
  const backdateLimit = parseInt(req.body.backdateLimit) || 0;
  const role = normalizeRole(req.body.role);
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 🔐 Hierarchy Enforcement: No second CEO allowed
  if (role === ROLES.CEO) {
    return res.status(403).json({ error: 'Cannot create additional CEO accounts.' });
  }

  try {
    // 🔍 Dynamic Role Validation
    const [roles]: any = await pool.execute('SELECT * FROM roles_master WHERE role_code = ? AND is_active = TRUE', [role]);
    if (roles.length === 0) {
      return res.status(400).json({ error: 'Invalid or inactive role selected.' });
    }

    const uid = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password);

    await pool.execute(
      `INSERT INTO users (uid, name, email, password_hash, role, status, mustChangePwd, backdate_limit) 
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [uid, name, email, passwordHash, role, status || 'Active', backdateLimit]
    );
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_uid, event_type, after_snapshot)
       VALUES (?, ?, ?, ?, 'USER_CREATED', ?)`,
      [(req as any).user?.uid || null, (req as any).user?.email || null, (req as any).user?.role || null, uid, JSON.stringify({ name, email, role, status: status || 'Active', backdate_limit: backdateLimit })]
    );

    res.status(201).json({ message: 'User created successfully' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: error.message });
  }
});

api.put('/admin/users/:uid', requireCEO, async (req, res) => {
  const { uid } = req.params;
  const { name, email, status } = req.body;
  const backdateLimit = req.body.backdateLimit !== undefined ? parseInt(req.body.backdateLimit) : 0;
  const role = normalizeRole(req.body.role);
  
  try {
    await checkRootProtection(uid);

    // 🔐 Hierarchy Enforcement: Cannot promote someone to CEO
    if (role === ROLES.CEO) {
      return res.status(403).json({ error: 'The CEO role is unique and cannot be reassigned.' });
    }

    // 🔍 Dynamic Role Validation
    const [roles]: any = await pool.execute('SELECT * FROM roles_master WHERE role_code = ? AND is_active = TRUE', [role]);
    if (roles.length === 0) {
      return res.status(400).json({ error: 'Invalid or inactive role selected.' });
    }

    await pool.execute(
      'UPDATE users SET name = ?, email = ?, role = ?, status = ?, backdate_limit = ? WHERE uid = ?',
      [name, email, role, status, backdateLimit, uid]
    );
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_uid, event_type, after_snapshot)
       VALUES (?, ?, ?, ?, 'USER_UPDATED', ?)`,
      [(req as any).user?.uid || null, (req as any).user?.email || null, (req as any).user?.role || null, uid, JSON.stringify({ name, email, role, status, backdate_limit: backdateLimit })]
    );
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error: any) {
    res.status(error.message.includes('protected') ? 403 : 500).json({ error: error.message });
  }
});

api.patch('/admin/users/:uid/status', requireCEO, async (req, res) => {
  const { uid } = req.params;
  const { status } = req.body;
  try {
    await checkRootProtection(uid);
    checkSelfProtection(uid, req);

    await pool.execute('UPDATE users SET status = ? WHERE uid = ?', [status, uid]);
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_uid, event_type, after_snapshot)
       VALUES (?, ?, ?, ?, 'USER_STATUS_CHANGED', ?)`,
      [(req as any).user?.uid || null, (req as any).user?.email || null, (req as any).user?.role || null, uid, JSON.stringify({ status })]
    );
    res.status(200).json({ message: 'Status updated' });
  } catch (error: any) {
    res.status(error.message.includes('protected') || error.message.includes('own account') ? 403 : 500).json({ error: error.message });
  }
});

api.patch('/admin/users/:uid/reset-password', requireCEO, async (req, res) => {
  const { uid } = req.params;
  const { newPassword } = req.body;
  
  try {
    await checkRootProtection(uid);

    const passwordHash = hashPassword(newPassword);
    await pool.execute(
      'UPDATE users SET password_hash = ?, mustChangePwd = TRUE WHERE uid = ?',
      [passwordHash, uid]
    );
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_uid, event_type, after_snapshot)
       VALUES (?, ?, ?, ?, 'USER_PASSWORD_RESET', ?)`,
      [(req as any).user?.uid || null, (req as any).user?.email || null, (req as any).user?.role || null, uid, JSON.stringify({ mustChangePwd: true })]
    );
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(error.message.includes('protected') ? 403 : 500).json({ error: error.message });
  }
});

api.delete('/admin/users/:uid', requireCEO, async (req, res) => {
  const { uid } = req.params;
  try {
    await checkRootProtection(uid);
    checkSelfProtection(uid, req);

    await pool.execute('UPDATE users SET is_deleted = TRUE, status = "Inactive" WHERE uid = ?', [uid]);
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_uid, event_type, after_snapshot)
       VALUES (?, ?, ?, ?, 'USER_SOFT_DELETED', ?)`,
      [(req as any).user?.uid || null, (req as any).user?.email || null, (req as any).user?.role || null, uid, JSON.stringify({ is_deleted: true, status: 'Inactive' })]
    );
    res.status(200).json({ message: 'User deleted' });
  } catch (error: any) {
    res.status(error.message.includes('protected') || error.message.includes('own account') ? 403 : 500).json({ error: error.message });
  }
});

api.patch('/admin/users/:uid/restore', requireCEO, async (req, res) => {
  const { uid } = req.params;
  try {
    await pool.execute('UPDATE users SET is_deleted = FALSE, status = "Active" WHERE uid = ?', [uid]);
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_uid, event_type, after_snapshot)
       VALUES (?, ?, ?, ?, 'USER_RESTORED', ?)`,
      [(req as any).user?.uid || null, (req as any).user?.email || null, (req as any).user?.role || null, uid, JSON.stringify({ is_deleted: false, status: 'Active' })]
    );
    res.status(200).json({ message: 'User restored' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/rbac/permissions', authorizeAction('rbac', 'manage_rbac'), async (_req, res) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT rp.role_code, p.module_key, p.action_key, rp.is_allowed
      FROM role_permissions rp
      JOIN rbac_permissions p ON p.id = rp.permission_id
      ORDER BY rp.role_code, p.module_key, p.action_key
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch RBAC permissions' });
  }
});

api.put('/rbac/permissions', authorizeAction('rbac', 'manage_rbac'), async (req: any, res) => {
  const { role_code, module_key, action_key, is_allowed } = req.body;
  const roleCode = normalizeRole(role_code);
  if (roleCode === ROLES.CEO && is_allowed === false) {
    return res.status(400).json({ error: 'CEO authority cannot be reduced.' });
  }

  try {
    const [permissions]: any = await pool.execute(
      'SELECT id FROM rbac_permissions WHERE module_key = ? AND action_key = ?',
      [module_key, action_key]
    );
    if (permissions.length === 0) return res.status(404).json({ error: 'Permission not found' });

    const [beforeRows]: any = await pool.execute(
      'SELECT is_allowed FROM role_permissions WHERE role_code = ? AND permission_id = ?',
      [roleCode, permissions[0].id]
    );

    await pool.execute(
      `INSERT INTO role_permissions (role_code, permission_id, is_allowed, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed), updated_by = VALUES(updated_by)`,
      [roleCode, permissions[0].id, !!is_allowed, req.user?.email || 'UNKNOWN']
    );

    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, event_type, module_key, action_key, before_snapshot, after_snapshot)
       VALUES (?, ?, ?, 'RBAC_PERMISSION_CHANGED', ?, ?, ?, ?)`,
      [
        req.user?.uid || null,
        req.user?.email || null,
        req.user?.role || null,
        module_key,
        action_key,
        JSON.stringify({ role_code: roleCode, is_allowed: beforeRows[0]?.is_allowed ?? null }),
        JSON.stringify({ role_code: roleCode, is_allowed: !!is_allowed })
      ]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update RBAC permission' });
  }
});

api.get('/rbac/summary', requireAuth, async (_req, res) => {
  try {
    const [users]: any = await pool.execute('SELECT role, status, COUNT(*) as count FROM users WHERE is_deleted = FALSE GROUP BY role, status');
    const [audit]: any = await pool.execute('SELECT COUNT(*) as count FROM user_access_audit');
    res.json({
      universalVisibility: true,
      actionAuthority: true,
      roles: users,
      auditCount: audit[0]?.count || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch RBAC summary' });
  }
});

api.get('/rbac/audit-logs', authorizeAction('rbac', 'manage_rbac'), async (_req, res) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT id, actor_uid, actor_email, actor_role, target_uid, event_type, module_key, action_key,
             before_snapshot, after_snapshot, created_at
      FROM user_access_audit
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * USER-LEVEL PERMISSION OVERRIDES ENDPOINTS
 * Supports per-user customization of role-based defaults
 */

// Get all users in a role
api.get('/rbac/users-by-role/:roleCode', authorizeAction('rbac', 'manage_rbac'), async (req: any, res) => {
  try {
    const roleCode = normalizeRole(req.params.roleCode);
    const [users]: any = await pool.execute(
      `SELECT id, uid, email, name, role, status FROM users WHERE UPPER(TRIM(role)) = ? AND is_deleted = FALSE ORDER BY name ASC`,
      [roleCode]
    );
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get effective permissions for a specific user (role defaults merged with overrides)
api.get('/rbac/user-permissions/:userId', authorizeAction('rbac', 'manage_rbac'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const [userRows]: any = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

    const userRole = userRows[0].role;
    const effective = await getUserEffectivePermissions(parseInt(userId), userRole);

    // Also load which permissions are overridden
    const [overrides]: any = await pool.execute(
      `SELECT p.module_key, p.action_key, up.is_allowed
       FROM user_permissions up
       JOIN rbac_permissions p ON p.id = up.permission_id
       WHERE up.user_id = ?`,
      [userId]
    );

    const overriddenPermissions: string[] = overrides.map((o: any) => `${o.module_key}:${o.action_key}`);

    res.json({
      userId,
      userRole,
      effectivePermissions: effective,
      overriddenPermissions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a user's permission override
api.put('/rbac/user-permissions/:userId', authorizeAction('rbac', 'manage_rbac'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { module, action, isAllowed, reason } = req.body;
    const session = getRequestSession(req);

    if (!module || !action) {
      return res.status(400).json({ error: 'Module and action are required' });
    }

    // Get permission_id for this module/action combo
    const [permissions]: any = await pool.execute(
      `SELECT id FROM rbac_permissions WHERE module_key = ? AND action_key = ?`,
      [module, action]
    );

    if (permissions.length === 0) {
      return res.status(400).json({ error: 'Invalid module or action' });
    }

    const permissionId = permissions[0].id;

    // Check if override already exists
    const [existing]: any = await pool.execute(
      `SELECT id FROM user_permissions WHERE user_id = ? AND permission_id = ?`,
      [userId, permissionId]
    );

    if (existing.length > 0) {
      // Update existing override
      await pool.execute(
        `UPDATE user_permissions SET is_allowed = ?, override_reason = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND permission_id = ?`,
        [isAllowed ? 1 : 0, reason || null, userId, permissionId]
      );
    } else {
      // Create new override
      await pool.execute(
        `INSERT INTO user_permissions (user_id, permission_id, is_allowed, override_reason, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId, permissionId, isAllowed ? 1 : 0, reason || null, session?.name || 'SYSTEM']
      );
    }

    // Log the change
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_user_id, event_type, module_key, action_key, old_value, new_value, override_reason, created_at)
       VALUES (?, ?, ?, ?, 'PERMISSION_OVERRIDE', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        session?.uid || 'SYSTEM',
        session?.email || 'SYSTEM',
        session?.role || 'CEO',
        userId,
        module,
        action,
        existing.length > 0 ? '?' : 'not-set',
        isAllowed ? 'true' : 'false',
        reason || null
      ]
    );

    res.json({ message: 'Permission override updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Batch save all user permissions (replaces all overrides atomically)
api.put('/rbac/user-permissions/:userId/batch', authorizeAction('rbac', 'manage_rbac'), async (req: any, res) => {
  const { userId } = req.params;
  const { permissions } = req.body; // { [module:action]: boolean }
  const session = getRequestSession(req);

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'permissions object is required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows]: any = await connection.execute('SELECT role FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'User not found' }); }

    const [permRows]: any = await connection.execute('SELECT id, module_key, action_key FROM rbac_permissions');
    const permMap: Record<string, number> = {};
    for (const p of permRows) permMap[`${p.module_key}:${p.action_key}`] = p.id;

    // Delete all existing overrides for this user
    await connection.execute('DELETE FROM user_permissions WHERE user_id = ?', [userId]);

    // Insert new overrides
    for (const [key, isAllowed] of Object.entries(permissions)) {
      const permId = permMap[key];
      if (!permId) continue;
      await connection.execute(
        `INSERT INTO user_permissions (user_id, permission_id, is_allowed, override_reason, created_by)
         VALUES (?, ?, ?, 'Batch save', ?)`,
        [userId, permId, isAllowed ? 1 : 0, session?.email || 'CEO']
      );
    }

    // Single audit entry for the batch
    await connection.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_user_id, event_type, after_snapshot, created_at)
       VALUES (?, ?, ?, ?, 'PERMISSION_BATCH_SAVE', ?, CURRENT_TIMESTAMP)`,
      [session?.uid || null, session?.email || null, session?.role || null, userId, JSON.stringify(permissions)]
    );

    await connection.commit();
    res.json({ message: 'User permissions saved successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Remove a user permission override (revert to role default)
api.delete('/rbac/user-permissions/:userId/:module/:action', authorizeAction('rbac', 'manage_rbac'), async (req: any, res) => {
  try {
    const { userId, module, action } = req.params;
    const session = getRequestSession(req);

    const [permissions]: any = await pool.execute(
      `SELECT id FROM rbac_permissions WHERE module_key = ? AND action_key = ?`,
      [module, action]
    );

    if (permissions.length === 0) {
      return res.status(400).json({ error: 'Invalid module or action' });
    }

    const permissionId = permissions[0].id;

    // Get current value before delete for audit
    const [current]: any = await pool.execute(
      `SELECT is_allowed FROM user_permissions WHERE user_id = ? AND permission_id = ?`,
      [userId, permissionId]
    );

    if (current.length === 0) {
      return res.status(404).json({ error: 'Override not found' });
    }

    // Delete the override
    await pool.execute(
      `DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?`,
      [userId, permissionId]
    );

    // Log the removal
    await pool.execute(
      `INSERT INTO user_access_audit (actor_uid, actor_email, actor_role, target_user_id, event_type, module_key, action_key, old_value, new_value, created_at)
       VALUES (?, ?, ?, ?, 'PERMISSION_OVERRIDE_REMOVED', ?, ?, ?, 'reverted-to-role-default', CURRENT_TIMESTAMP)`,
      [
        session?.uid || 'SYSTEM',
        session?.email || 'SYSTEM',
        session?.role || 'CEO',
        userId,
        module,
        action,
        current[0].is_allowed ? 'true' : 'false'
      ]
    );

    res.json({ message: 'Permission override removed, reverted to role default' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get permission override audit history for a user
api.get('/rbac/user-override-history/:userId', authorizeAction('rbac', 'manage_rbac'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const [history]: any = await pool.execute(
      `SELECT id, actor_uid, actor_email, event_type, module_key, action_key, old_value, new_value, override_reason, created_at
       FROM user_access_audit
       WHERE target_user_id = ? AND event_type IN ('PERMISSION_OVERRIDE', 'PERMISSION_OVERRIDE_REMOVED')
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/inventory/:id/batches', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM inventory_batches WHERE inventory_id = ? AND is_void = FALSE ORDER BY received_date ASC',
      [id]
    );
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// INVENTORY ROUTES
// ═══════════════════════════════════════════════════════════════

api.post('/inventory/quick-add', authorizeAction('inventory', 'create'), async (req, res) => {
  const { item_name, category, sub_category, unit } = req.body;
  console.log('[API] quick-add request:', { item_name, category, sub_category, unit });

  if (!item_name || !category || !unit) {
    console.warn('[API] quick-add missing fields:', { item_name, category, unit });
    return res.status(400).json({ error: 'Missing required fields (item_name, category, unit)' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Normalized duplicate detection (case-insensitive, trimmed)
    const [existing]: any = await connection.execute(
      `SELECT id, item_name, category, sub_category, unit FROM inventory
       WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
         AND LOWER(TRIM(category)) = LOWER(TRIM(?))
         AND LOWER(TRIM(IFNULL(sub_category, ''))) = LOWER(TRIM(IFNULL(?, '')))
         AND LOWER(TRIM(IFNULL(unit, ''))) = LOWER(TRIM(IFNULL(?, '')))
       LIMIT 1`,
      [item_name, category, sub_category || '', unit || '']
    );

    if (existing && existing.length > 0) {
      await connection.commit();
      const row = existing[0];
      console.log('[API] quick-add duplicate found, returning existing ID:', row.id);
      return res.status(200).json({ 
        id: row.id, 
        item_name: row.item_name, 
        category: row.category, 
        sub_category: row.sub_category,
        unit: row.unit, 
        existed: true, 
        message: 'Material already exists' 
      });
    }

    const [result]: any = await connection.execute(
      `INSERT INTO inventory (item_name, category, sub_category, unit, quantity, price_per_unit, total_value, is_deleted)
       VALUES (?, ?, ?, ?, 0, 0, 0, FALSE)`,
      [item_name.trim(), category.trim(), sub_category || '', unit.trim()]
    );

    const inventoryId = result.insertId;
    console.log('[API] quick-add created new material ID:', inventoryId);
    await connection.commit();
    res.status(201).json({ 
      id: inventoryId, 
      item_name, 
      category, 
      sub_category: sub_category || '',
      unit, 
      existed: false,
      message: 'Material registered successfully' 
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[API] quick-add error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.post('/inventory/add', authorizeAction('inventory', 'create'), async (req, res) => {
  const { item_name, category, sub_category, unit } = req.body;
  console.log('[API] add request:', { item_name, category, sub_category, unit });

  if (!item_name || !category || !unit) {
    console.warn('[API] add missing fields:', { item_name, category, unit });
    return res.status(400).json({ error: 'Missing required fields (item_name, category, unit)' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Duplicate detection and normalized insert (metadata-only)
    const [existing]: any = await connection.execute(
      `SELECT id, item_name, category, sub_category, unit FROM inventory
       WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
         AND LOWER(TRIM(category)) = LOWER(TRIM(?))
         AND LOWER(TRIM(IFNULL(sub_category, ''))) = LOWER(TRIM(IFNULL(?, '')))
         AND LOWER(TRIM(IFNULL(unit, ''))) = LOWER(TRIM(IFNULL(?, '')))
       LIMIT 1`,
      [item_name, category, sub_category || '', unit || '']
    );

    if (existing && existing.length > 0) {
      await connection.commit();
      const row = existing[0];
      console.log('[API] add duplicate found, returning existing ID:', row.id);
      return res.status(200).json({ 
        id: row.id, 
        item_name: row.item_name, 
        category: row.category, 
        sub_category: row.sub_category,
        unit: row.unit, 
        existed: true, 
        message: 'Material already exists' 
      });
    }

    const [result]: any = await connection.execute(
      `INSERT INTO inventory (item_name, category, sub_category, unit, quantity, price_per_unit, total_value, is_deleted)
       VALUES (?, ?, ?, ?, 0, 0, 0, FALSE)`,
      [item_name.trim(), category.trim(), sub_category || '', unit.trim()]
    );

    const inventoryId = result.insertId;
    console.log('[API] add created new material ID:', inventoryId);
    await connection.commit();
    res.status(201).json({ 
      id: inventoryId, 
      item_name, 
      category, 
      sub_category: sub_category || '',
      unit, 
      existed: false,
      message: 'Material created (metadata only). Use GRN for stock.' 
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[API] add error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.put('/inventory/:id', authorizeAction('inventory', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { item_name, category, sub_category, unit, supplier, remarks } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.execute('SELECT id FROM inventory WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new Error('Item not found');
    
    // Update metadata only. Quantity and pricing MUST be driven by GRN and Issues.
    await connection.execute(
      `UPDATE inventory SET item_name=?, category=?, sub_category=?, unit=? WHERE id=?`,
      [item_name, category, sub_category, unit, id]
    );

    await connection.commit();
    res.status(200).json({ message: 'Item metadata updated successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.delete('/inventory/:id', authorizeAction('inventory', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Check current quantity
    const [invRows]: any = await pool.execute('SELECT quantity, item_name FROM inventory WHERE id = ?', [id]);
    if (invRows.length === 0) return res.status(404).json({ error: 'Item not found' });
    
    const item = invRows[0];
    if (parseFloat(item.quantity) > 0) {
      return res.status(400).json({ error: `Cannot delete '${item.item_name}'. Stock is not zero (Current: ${item.quantity}).` });
    }

    // 2. Check if it has ever been issued
    const [issueRows]: any = await pool.execute('SELECT COUNT(*) as count FROM material_issues WHERE inventory_id = ? AND is_deleted = FALSE', [id]);
    if (issueRows[0].count > 0) {
      return res.status(400).json({ error: `Cannot delete '${item.item_name}'. It has existing material issue records.` });
    }

    // 3. Check if it was added via GRN
    const [grnRows]: any = await pool.execute('SELECT COUNT(*) as count FROM grn_items WHERE inventory_id = ?', [id]);
    if (grnRows[0].count > 0) {
      return res.status(400).json({ error: `Cannot delete '${item.item_name}'. Items added via GRN cannot be deleted from Inventory Master. Please cancel the GRN instead.` });
    }

    await pool.execute('UPDATE inventory SET is_deleted = TRUE WHERE id = ?', [id]);
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/inventory/issue', authorizeAction('inventory', 'create'), async (req, res) => {
  const { inventory_id, quantity_issued, project_id, project_name, issued_to, issued_by, remarks, issue_date } = req.body;

  if (!inventory_id || !quantity_issued || (!project_id && !project_name)) {
    return res.status(400).json({ error: 'Missing required fields (inventory_id, quantity, project_id/name)' });
  }

  let finalProjectName = project_name;
  if (project_id) {
    const [projRows]: any = await pool.execute('SELECT name FROM projects WHERE id = ?', [project_id]);
    if (projRows.length > 0) finalProjectName = projRows[0].name;
  }

  const totalRequestedQty = parseFloat(quantity_issued);
  if (totalRequestedQty <= 0 || isNaN(totalRequestedQty)) {
    return res.status(400).json({ error: 'Quantity issued must be greater than zero' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get Inventory Master Info
    const [invRows]: any = await connection.execute(
      'SELECT item_name, quantity, price_per_unit FROM inventory WHERE id = ? FOR UPDATE',
      [inventory_id]
    );
    if (invRows.length === 0) throw new Error('Item not found');

    const item = invRows[0];

    if (item.quantity < totalRequestedQty) {
      throw new Error(`Insufficient stock. Available: ${item.quantity}`);
    }

    // 2. FIFO Logic: Fetch and deduct from batches
    const [batches]: any = await connection.execute(
      'SELECT * FROM inventory_batches WHERE inventory_id = ? AND quantity_remaining > 0 AND is_void = FALSE ORDER BY received_date ASC, id ASC FOR UPDATE',
      [inventory_id]
    );

    const issueDate = issue_date || new Date().toISOString().split('T')[0];
    let remainingToIssue = totalRequestedQty;
    let totalCostOfIssue = 0;
    const usedBatches = [];

    for (const batch of batches) {
      if (remainingToIssue <= 0) break;

      const batchQtyRemaining = parseFloat(batch.quantity_remaining);
      const batchValueRemaining = parseFloat(batch.total_value_remaining);
      const qtyFromThisBatch = Math.min(remainingToIssue, batchQtyRemaining);
      
      let costFromThisBatch = 0;

      // 📊 ERP Value-First Issue Rule
      if (qtyFromThisBatch === batchQtyRemaining) {
        // Final Issue: Exhaust the batch completely to zero
        costFromThisBatch = batchValueRemaining;
      } else {
        // Proportional Issue: Consume value based on quantity fraction
        // We use the stored unit_price (high precision) for proportional consumption
        costFromThisBatch = qtyFromThisBatch * parseFloat(batch.unit_price);
      }

      totalCostOfIssue += costFromThisBatch;
      remainingToIssue -= qtyFromThisBatch;

      // Update the batch: Deduct both quantity AND value
      await connection.execute(
        'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ?, total_value_remaining = total_value_remaining - ? WHERE id = ?',
        [qtyFromThisBatch, costFromThisBatch, batch.id]
      );

      // 4. Record the issue layer (Normalization Reform)
      // We create ONE record per batch consumed to ensure absolute GRN traceability
      await connection.execute(
        `INSERT INTO material_issues (
          inventory_id, item_name, quantity_issued, total_cost, batch_details, 
          project_id, project_name, issued_to, issued_by, issue_date, 
          remarks, issue_source, grn_id, grn_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FIFO_ISSUE', ?, ?)`,
        [
          inventory_id, 
          item.item_name, 
          qtyFromThisBatch, 
          costFromThisBatch, 
          JSON.stringify([{ ...batch, quantity: qtyFromThisBatch, cost: costFromThisBatch }]), 
          project_id || null, 
          finalProjectName, 
          issued_to, 
          issued_by, 
          issueDate, 
          remarks,
          batch.grn_id || null,
          batch.batch_number // Using batch_number as the GRN source identifier
        ]
      );

      usedBatches.push({
        batch_id: batch.id,
        batch_number: batch.batch_number,
        quantity: qtyFromThisBatch,
        unit_price: batch.unit_price,
        cost: costFromThisBatch
      });
    }

    if (remainingToIssue > 0) {
      throw new Error('Critical Error: Failed to find enough stock in batches despite master quantity check.');
    }

    // 3. Update Inventory Master (SYNC WITH BATCHES)
    await syncInventoryFromBatches(connection, inventory_id);

    await connection.commit();
    res.status(201).json({ message: 'Material issued successfully (FIFO Applied)', total_cost: totalCostOfIssue });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * 🚀 MULTI-ITEM MATERIAL ISSUE VOUCHER (MIV)
 * Purpose: Issues multiple materials in a single atomic transaction.
 */
api.post('/inventory/voucher', authorizeAction('inventory', 'create'), async (req, res) => {
  const { project_id, issued_to, issue_date, purpose, remarks, items } = req.body;
  const session = (req as any).user as Session;

  if (!project_id || !issued_to || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or items' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Generate Voucher Number
    const voucherNo = await generateVoucherNumber(connection);
    
    // 2. Fetch Project Name
    const [projRows]: any = await connection.execute('SELECT name FROM projects WHERE id = ?', [project_id]);
    if (projRows.length === 0) throw new Error('Project not found');
    const projectName = projRows[0].name;

    // 3. Create Voucher Header
    const [vResult]: any = await connection.execute(
      `INSERT INTO material_issue_vouchers (voucher_no, project_id, issued_to, issued_by, issue_date, purpose, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [voucherNo, project_id, issued_to, session.name, issue_date || new Date().toISOString().split('T')[0], purpose, remarks]
    );
    const voucherId = vResult.insertId;

    let grandTotalValuation = 0;
    const inventoryToSync = new Set<number>();

    // 4. Process Each Item
    for (const itemRequest of items) {
      const { inventory_id, quantity_issued } = itemRequest;
      const qtyToIssue = parseFloat(quantity_issued);
      
      if (qtyToIssue <= 0) throw new Error(`Invalid quantity for item ${inventory_id}`);

      // A. Get Inventory Info
      const [invRows]: any = await connection.execute(
        'SELECT item_name, quantity, unit FROM inventory WHERE id = ? FOR UPDATE',
        [inventory_id]
      );
      if (invRows.length === 0) throw new Error(`Item ${inventory_id} not found`);
      const invItem = invRows[0];

      if (invItem.quantity < qtyToIssue) {
        throw new Error(`Insufficient stock for ${invItem.item_name}. Available: ${invItem.quantity}`);
      }

      // B. FIFO Allocation
      const [batches]: any = await connection.execute(
        'SELECT * FROM inventory_batches WHERE inventory_id = ? AND quantity_remaining > 0 AND is_void = FALSE ORDER BY received_date ASC, id ASC FOR UPDATE',
        [inventory_id]
      );

      let remaining = qtyToIssue;
      let itemTotalCost = 0;

      for (const batch of batches) {
        if (remaining <= 0) break;

        const batchQty = parseFloat(batch.quantity_remaining);
        const batchVal = parseFloat(batch.total_value_remaining);
        const take = Math.min(remaining, batchQty);
        
        let cost = 0;
        if (take === batchQty) {
          cost = batchVal; // Value-First Rule
        } else {
          cost = take * parseFloat(batch.unit_price);
        }

        itemTotalCost += cost;
        remaining -= take;

        // Update Batch
        await connection.execute(
          'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ?, total_value_remaining = total_value_remaining - ? WHERE id = ?',
          [take, cost, batch.id]
        );

        // Create Line Item entry for this batch layer (GRN Traceability)
        await connection.execute(
          `INSERT INTO material_issue_items (voucher_id, inventory_id, item_name, quantity, unit, total_cost, batch_details, grn_id, grn_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            voucherId, 
            inventory_id, 
            invItem.item_name, 
            take, 
            invItem.unit, 
            cost, 
            JSON.stringify([{ ...batch, quantity: take, cost: cost }]),
            batch.grn_id,
            batch.batch_number
          ]
        );
      }

      if (remaining > 0) throw new Error(`Critical: Failed to fulfill FIFO for ${invItem.item_name}`);

      grandTotalValuation += itemTotalCost;
      inventoryToSync.add(inventory_id);
    }

    // 5. Update Header with totals
    await connection.execute(
      'UPDATE material_issue_vouchers SET total_valuation = ?, total_items = ? WHERE id = ?',
      [grandTotalValuation, items.length, voucherId]
    );

    // 6. Sync Master Inventory
    for (const invId of inventoryToSync) {
      await syncInventoryFromBatches(connection, invId);
    }

    await connection.commit();
    res.status(200).json({ message: 'Voucher issued successfully', voucher_no: voucherNo });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * 🛡️ VOUCHER-LEVEL REVERT (FULL RESTORATION)
 */
api.post('/inventory/vouchers/revert/:id', authorizeAction('inventory', 'rollback'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const session = (req as any).user as Session;

  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A valid revert reason is mandatory.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Lock Voucher
    const [vouchers]: any = await connection.execute(
      'SELECT * FROM material_issue_vouchers WHERE id = ? AND is_deleted = FALSE FOR UPDATE',
      [id]
    );
    if (vouchers.length === 0) throw new Error('Voucher not found');
    const voucher = vouchers[0];

    if (voucher.status === 'FULLY_REVERTED' || voucher.status === 'VOID') {
      throw new Error('Voucher already reverted or voided');
    }

    // 2. Fetch all active items
    const [items]: any = await connection.execute(
      'SELECT * FROM material_issue_items WHERE voucher_id = ? AND revert_status = "ACTIVE" AND is_deleted = FALSE FOR UPDATE',
      [id]
    );

    const inventoryToSync = new Set<number>();

    // 3. Revert each item layer
    for (const item of items) {
      const batchDetails = typeof item.batch_details === 'string' 
        ? JSON.parse(item.batch_details) 
        : item.batch_details;

      for (const b of batchDetails) {
        const batchId = b.id || b.batch_id;
        // Restore Batch Stock and Value
        await connection.execute(
          'UPDATE inventory_batches SET quantity_remaining = quantity_remaining + ?, total_value_remaining = total_value_remaining + ?, is_void = FALSE WHERE id = ?',
          [b.quantity, b.cost, batchId]
        );
      }

      // Mark Item as Reverted
      await connection.execute(
        `UPDATE material_issue_items SET revert_status = "REVERTED", reverted_at = CURRENT_TIMESTAMP, reverted_by = ?, revert_reason = ? WHERE id = ?`,
        [session.name, reason, item.id]
      );
      inventoryToSync.add(item.inventory_id);
    }

    // 4. Mark Voucher as Fully Reverted
    await connection.execute(
      'UPDATE material_issue_vouchers SET status = "FULLY_REVERTED", remarks = CONCAT(COALESCE(remarks, ""), " | REVERTED: ", ?) WHERE id = ?',
      [reason, id]
    );

    // 5. Sync Master Inventory
    for (const invId of inventoryToSync) {
      await syncInventoryFromBatches(connection, invId);
    }

    await connection.commit();
    res.status(200).json({ message: 'Entire voucher reverted successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * 🛡️ ITEM-LEVEL PARTIAL REVERT
 */
api.post('/inventory/vouchers/items/revert/:itemId', authorizeAction('inventory', 'rollback'), async (req, res) => {
  const { itemId } = req.params;
  const { reason } = req.body;
  const session = (req as any).user as Session;

  if (!reason || reason.trim().length < 5) return res.status(400).json({ error: 'Reason required' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Lock Item
    const [items]: any = await connection.execute(
      'SELECT * FROM material_issue_items WHERE id = ? AND revert_status = "ACTIVE" AND is_deleted = FALSE FOR UPDATE',
      [itemId]
    );
    if (items.length === 0) throw new Error('Active item not found');
    const item = items[0];

    // 2. Restore Batch Stock
    const batchDetails = typeof item.batch_details === 'string' ? JSON.parse(item.batch_details) : item.batch_details;
    for (const b of batchDetails) {
      const batchId = b.id || b.batch_id;
      await connection.execute(
        'UPDATE inventory_batches SET quantity_remaining = quantity_remaining + ?, total_value_remaining = total_value_remaining + ?, is_void = FALSE WHERE id = ?',
        [b.quantity, b.cost, batchId]
      );
    }

    // 3. Mark Item Reverted
    await connection.execute(
      `UPDATE material_issue_items SET revert_status = "REVERTED", reverted_at = CURRENT_TIMESTAMP, reverted_by = ?, revert_reason = ? WHERE id = ?`,
      [session.name, reason, itemId]
    );

    // 4. Update Voucher Status
    const [remaining]: any = await connection.execute(
      'SELECT COUNT(*) as count FROM material_issue_items WHERE voucher_id = ? AND revert_status = "ACTIVE" AND is_deleted = FALSE',
      [item.voucher_id]
    );
    
    const newStatus = remaining[0].count === 0 ? 'FULLY_REVERTED' : 'PARTIALLY_REVERTED';
    await connection.execute(
      'UPDATE material_issue_vouchers SET status = ? WHERE id = ?',
      [newStatus, item.voucher_id]
    );

    // 5. Sync Master Inventory
    await syncInventoryFromBatches(connection, item.inventory_id);

    await connection.commit();
    res.status(200).json({ message: 'Item reverted successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * Fetch Voucher History
 */
api.get('/inventory/vouchers', authorizeAction('inventory', 'view'), async (req, res) => {
  const { search, project_id, from_date, to_date } = req.query;
  try {
    let query = `
      SELECT v.*, p.name as project_name 
      FROM material_issue_vouchers v
      JOIN projects p ON v.project_id = p.id
      WHERE v.is_deleted = FALSE
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (v.voucher_no LIKE ? OR v.issued_to LIKE ? OR v.purpose LIKE ?) `;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (project_id) { query += ` AND v.project_id = ? `; params.push(project_id); }
    if (from_date) { query += ` AND v.issue_date >= ? `; params.push(from_date); }
    if (to_date) { query += ` AND v.issue_date <= ? `; params.push(to_date); }

    query += ` ORDER BY v.issue_date DESC, v.id DESC `;
    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/inventory/vouchers/:id', authorizeAction('inventory', 'view'), async (req, res) => {
  try {
    const [vouchers]: any = await pool.execute(
      `SELECT v.*, p.name as project_name FROM material_issue_vouchers v JOIN projects p ON v.project_id = p.id WHERE v.id = ?`,
      [req.params.id]
    );
    if (vouchers.length === 0) return res.status(404).json({ error: 'Voucher not found' });

    const [items] = await pool.execute(
      `SELECT * FROM material_issue_items WHERE voucher_id = ? AND is_deleted = FALSE`,
      [req.params.id]
    );

    res.status(200).json({ ...vouchers[0], items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/inventory/issue/revert/:id', authorizeAction('inventory', 'rollback'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const session = (req as any).user as Session;

  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A valid revert reason (min 5 chars) is mandatory for governance.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock the issue row and prevent double reverting
    const [rows]: any = await connection.execute(
      'SELECT mi.* FROM material_issues mi WHERE mi.id = ? AND mi.is_deleted = FALSE FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new Error('Issue record not found or already reverted');
    const issue = rows[0];

    // 🛡️ Serialization Fix: Normalize batch_details
    const batchDetails = typeof issue.batch_details === 'string' 
      ? JSON.parse(issue.batch_details || '[]') 
      : (issue.batch_details || []);

    // 🛡️ Voided Batch Protection & Restoration
    for (const b of batchDetails) {
      const batchId = b.id || b.batch_id;
      if (!batchId) throw new Error('Invalid batch reference in issue record.');

      // Check if batch is voided
      const [batchRows]: any = await connection.execute(
        'SELECT is_void, batch_number FROM inventory_batches WHERE id = ?',
        [batchId]
      );
      
      if (batchRows.length === 0) throw new Error(`Source batch ${b.batch_number || 'Unknown'} no longer exists.`);
      if (batchRows[0].is_void) throw new Error(`Cannot revert. Source batch ${batchRows[0].batch_number} has been voided (e.g. GRN cancelled).`);

      // 📊 Proportional Reversal: Restore both quantity and the EXACT cost recorded at issue time
      const restoreValue = b.cost || (parseFloat(b.quantity) * parseFloat(b.unit_price));
      await connection.execute(
        'UPDATE inventory_batches SET quantity_remaining = quantity_remaining + ?, total_value_remaining = total_value_remaining + ? WHERE id = ?',
        [parseFloat(b.quantity), restoreValue, batchId]
      );
    }

    // Sync Master Inventory from restored batches
    await syncInventoryFromBatches(connection, issue.inventory_id);

    // ⚖️ Governance Update: Mark as Reverted with Audit Trail
    await connection.execute(
      `UPDATE material_issues SET 
        is_deleted = TRUE, 
        revert_status = 'FULLY_REVERTED',
        revert_reason = ?,
        reverted_by = ?,
        reverted_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, session.name, id]
    );

    await connection.commit();
    res.status(200).json({ message: 'Issue reverted successfully and inventory restored.' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.get('/inventory', authorizeAction('inventory', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM inventory WHERE is_deleted = FALSE ORDER BY last_updated DESC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/inventory/additions', authorizeAction('inventory', 'view'), async (req, res) => {
  const { search, from_date, to_date } = req.query;
  try {
    let query = 'SELECT * FROM inventory_additions WHERE is_deleted = FALSE';
    const params: any[] = [];

    if (search) {
      query += ` AND (item_name LIKE ? OR remarks LIKE ? OR supplier LIKE ? OR added_by LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (from_date) {
      query += ` AND DATE(addition_date) >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND DATE(addition_date) <= ?`;
      params.push(to_date);
    }

    query += ' ORDER BY addition_date DESC, createdAt DESC';

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/inventory/issues', authorizeAction('inventory', 'view'), async (req, res) => {
  const { search, from_date, to_date } = req.query;
  try {
    let query = `
      SELECT 
        mii.*, 
        miv.voucher_no, 
        miv.issue_date, 
        miv.issued_to, 
        miv.issued_by, 
        miv.project_id,
        p.name as project_name,
        miv.remarks as voucher_remarks
      FROM material_issue_items mii
      JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
      JOIN projects p ON miv.project_id = p.id
      WHERE mii.is_deleted = FALSE AND miv.is_deleted = FALSE
    `;
    const params: any[] = [];
    if (search) {
      query += ` AND (mii.item_name LIKE ? OR miv.voucher_no LIKE ? OR miv.issued_to LIKE ? OR p.name LIKE ?) `;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (from_date) { query += ` AND miv.issue_date >= ? `; params.push(from_date); }
    if (to_date) { query += ` AND miv.issue_date <= ? `; params.push(to_date); }

    query += ` ORDER BY miv.issue_date DESC, mii.id DESC LIMIT 1000`;
    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PROJECTS ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/projects', authorizeAction('projects', 'view'), async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT p.*, 
             (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0)) as total_expense
      FROM projects p
      LEFT JOIN (
          SELECT miv.project_id, SUM(mii.total_cost) as total_material
          FROM material_issue_items mii
          JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
          WHERE mii.is_deleted = FALSE AND mii.revert_status = 'ACTIVE' AND miv.is_deleted = FALSE
          GROUP BY miv.project_id
      ) mi ON p.id = mi.project_id
      LEFT JOIN (
          SELECT project_id, SUM(amount) as total_contractor
          FROM contractor_payments
          WHERE is_deleted = FALSE
          GROUP BY project_id
      ) cp ON p.id = cp.project_id
    `;
    let params: any[] = [];

    if (status === 'ALL') {
      query += ' ORDER BY p.createdAt DESC';
    } else if (status === 'DEACTIVATED') {
      query += ' WHERE p.is_deleted = 1 ORDER BY p.createdAt DESC';
    } else if (status === 'ACTIVE') {
      query += " WHERE p.status IN ('NEW', 'ONGOING') AND p.is_deleted = 0 ORDER BY p.createdAt DESC";
    } else if (status === 'COMPLETED') {
      query += " WHERE p.status = 'COMPLETED' AND p.is_deleted = 0 ORDER BY p.createdAt DESC";
    } else if (status) {
      query += ' WHERE p.status = ? AND p.is_deleted = 0 ORDER BY p.createdAt DESC';
      params.push(status);
    } else {
      query += " WHERE p.status IN ('NEW', 'ONGOING') AND p.is_deleted = 0 ORDER BY p.createdAt DESC";
    }

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/projects/:id/reactivate', authorizeAction('projects', 'rollback'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE projects SET is_deleted = 0, status = "NEW" WHERE id = ?', [id]);
    res.status(200).json({ message: 'Project reactivated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/projects', authorizeAction('projects', 'create'), async (req, res) => {
  const { code, name, location, startDate, expectedEndDate, budget, status } = req.body;

  if (!code || !name || !location || !startDate || !expectedEndDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result]: any = await pool.execute(
      `INSERT INTO projects (code, name, location, startDate, expectedEndDate, budget, status, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [code, name, location, startDate, expectedEndDate, budget || 0, status || 'NEW']
    );

    res.status(201).json({ id: result.insertId, message: 'Project created successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/projects/:id/status', authorizeAction('projects', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    await pool.execute('UPDATE projects SET status = ? WHERE id = ?', [status, id]);
    res.status(200).json({ message: 'Project status updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/projects/:id/history', authorizeAction('projects', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM project_rename_history WHERE project_id = ? ORDER BY renamed_at DESC',
      [id]
    );
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/projects/:id/usage', authorizeAction('projects', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    // Get project name first for material_issues check
    const [projectRows]: any = await pool.execute('SELECT name FROM projects WHERE id = ?', [id]);
    if (projectRows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const projectName = projectRows[0].name;

    // Check Approvals
    const [approvalRows]: any = await pool.execute(
      'SELECT COUNT(*) as count FROM approvals WHERE projectId = ? AND is_deleted = FALSE', 
      [id]
    );
    
    // Check Material Issues
    const [issueRows]: any = await pool.execute(
      'SELECT COUNT(*) as count FROM material_issues WHERE project_id = ? AND is_deleted = FALSE', 
      [id]
    );
    const [voucherRows]: any = await pool.execute(
      'SELECT COUNT(*) as count FROM material_issue_vouchers WHERE project_id = ? AND is_deleted = FALSE', 
      [id]
    );

    const usageCount = approvalRows[0].count + issueRows[0].count + voucherRows[0].count;
    res.status(200).json({ 
      usageCount,
      details: {
        approvals: approvalRows[0].count,
        materialIssues: issueRows[0].count,
        materialIssueVouchers: voucherRows[0].count
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.delete('/projects/:id', authorizeAction('projects', 'delete'), async (req, res) => {
  const { id } = req.params;
  const { mode } = req.query; // 'permanent' or 'deactivate'

  try {
    if (mode === 'permanent') {
      await pool.execute('DELETE FROM projects WHERE id = ?', [id]);
      res.status(200).json({ message: 'Project permanently deleted' });
    } else {
      await pool.execute('UPDATE projects SET is_deleted = 1, status = "DEACTIVATED" WHERE id = ?', [id]);
      res.status(200).json({ message: 'Project deactivated successfully' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// APPROVALS ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/approvals', authorizeAction('approvals', 'view'), async (req, res) => {
  const session = (req as any).user as Session;

  try {
    let query = 'SELECT * FROM approvals WHERE is_deleted = FALSE';
    const params: any[] = [];

    // Apply role-based visibility
    if (session.role === 'Executive' || session.role === 'Site Incharge') {
      query += ' AND raised_by_uid = ?';
      params.push(session.uid);
    } else {
      // General Manager, CEO, CA → return ALL approval requests (no extra filter)
    }

    query += ' ORDER BY createdAt DESC';

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/approvals', authorizeAction('approvals', 'create'), async (req, res) => {
  const {
    approval_code,
    title,
    type,
    amount,
    description,
    raised_by,
    raised_by_uid,
    raised_by_role,
    projectId,
    projectName,
    vendorName,
    contractor_id,
    attachments
  } = req.body;

  if (!title || !type || !amount || !raised_by || !raised_by_uid || !projectId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let finalProjectName = projectName;
  try {
    const [projRows]: any = await pool.execute('SELECT name FROM projects WHERE id = ?', [projectId]);
    if (projRows.length > 0) finalProjectName = projRows[0].name;
  } catch (e) {}

  try {
    const [result]: any = await pool.execute(
      `INSERT INTO approvals (approval_code, title, type, amount, description, status, raised_by, raised_by_uid, raised_by_role, projectId, projectName, vendorName, contractor_id, attachments, is_deleted)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [approval_code, title, type, amount, description || '', raised_by, raised_by_uid, raised_by_role, projectId, finalProjectName, vendorName || '', contractor_id || null, attachments || '']
    );

    res.status(201).json({ id: result.insertId, message: 'Approval request created successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/approval-requests/approved/contractor', authorizeAction('contractor_payments', 'view'), async (req, res) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT a.id, a.contractor_id, COALESCE(c.contractor_name, a.vendorName) as party_name, a.amount, a.projectId as project_id, a.title, a.approval_code
      FROM approvals a
      LEFT JOIN contractors c ON a.contractor_id = c.id
      WHERE a.type = 'Contractor Payment' 
        AND a.status = 'APPROVED' 
        AND a.is_deleted = FALSE
        AND a.id NOT IN (SELECT COALESCE(approval_id, 0) FROM contractor_payments WHERE is_deleted = FALSE)
      ORDER BY a.createdAt DESC
    `);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/approvals/:id/status', authorizeAction('approvals', 'approve'), async (req, res) => {
  const { id } = req.params;
  const { status, approved_by } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  if (status === 'VOIDED' || status === 'REJECTED') {
    return res.status(400).json({ error: 'Invalid status update. Use appropriate endpoints for voiding.' });
  }

  try {
    await pool.execute(
      'UPDATE approvals SET status = ?, approved_by = ?, voidedBy = NULL, voidedAt = NULL WHERE id = ? AND is_deleted = FALSE',
      [status, approved_by || null, id]
    );
    res.status(200).json({ message: 'Approval status updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/approval-requests/:id/void', authorizeAction('approvals', 'delete'), async (req, res) => {
  const { id } = req.params;
  const session = (req as any).user as Session;

  console.log('[Approvals] Void request received', {
    id,
    role: session?.role,
    user: session?.name,
  });

  if (!id) {
    return res.status(400).json({ error: 'Approval request id is required' });
  }

  try {
    const [rows]: any = await pool.execute(
      'SELECT id, status FROM approvals WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (rows[0].status === 'VOIDED') {
      return res.status(400).json({ error: 'Approval request is already voided' });
    }

    await pool.execute(
      'UPDATE approvals SET status = ?, voidedBy = ?, voidedAt = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = FALSE',
      ['VOIDED', session.name || session.email || 'CEO', id]
    );

    const [updatedRows]: any = await pool.execute(
      'SELECT * FROM approvals WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    res.status(200).json({
      message: 'Approval request voided successfully',
      approval: updatedRows[0]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// ═══════════════════════════════════════════════════════════════
// CONTRACTOR PAYMENTS ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/contractor-payments', authorizeAction('contractor_payments', 'view'), async (req, res) => {
  const { search, contractor_id, from_date, to_date } = req.query;
  console.log("Incoming Filters (Payments):", req.query);
  
  try {
    let query = `
      SELECT cp.*, p.name as projectName, COALESCE(c.contractor_name, cp.contractor_name) as display_contractor_name
      FROM contractor_payments cp
      LEFT JOIN projects p ON cp.project_id = p.id
      LEFT JOIN contractors c ON cp.contractor_id = c.id
      WHERE cp.is_deleted = FALSE
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (COALESCE(c.contractor_name, cp.contractor_name) LIKE ? OR p.name LIKE ? OR cp.reference_no LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (contractor_id) {
      query += ` AND cp.contractor_id = ?`;
      params.push(contractor_id);
    }

    if (from_date) {
      query += ` AND DATE(cp.payment_date) >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND DATE(cp.payment_date) <= ?`;
      params.push(to_date);
    }

    query += ` ORDER BY cp.payment_date DESC`;

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    console.error("Fetch Contractor Payments Error:", error);
    res.status(500).json({ error: error.message });
  }
});

api.get('/contractor-payments/:id', authorizeAction('contractor_payments', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [rows]: any = await pool.execute(`
      SELECT cp.*, p.name as projectName 
      FROM contractor_payments cp 
      JOIN projects p ON cp.project_id = p.id 
      WHERE cp.id = ? AND cp.is_deleted = FALSE
    `, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Payment record not found' });
    res.status(200).json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/contractor-payments', authorizeAction('contractor_payments', 'create'), async (req, res) => {
  const { project_id, contractor_name, contractor_id, amount, payment_date, payment_mode, reference_no, remarks, approval_id } = req.body;
  if (!project_id || (!contractor_name && !contractor_id) || !amount || !payment_date || !payment_mode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const [result]: any = await pool.execute(
      `INSERT INTO contractor_payments (project_id, contractor_name, contractor_id, amount, payment_date, payment_mode, reference_no, remarks, approval_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, contractor_name || '', contractor_id || null, amount, payment_date, payment_mode, reference_no || null, remarks || null, approval_id || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Payment recorded successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/contractor-payments/:id', authorizeAction('contractor_payments', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { project_id, contractor_name, contractor_id, amount, payment_date, payment_mode, reference_no, remarks, approval_id } = req.body;
  try {
    await pool.execute(
      `UPDATE contractor_payments 
       SET project_id=?, contractor_name=?, contractor_id=?, amount=?, payment_date=?, payment_mode=?, reference_no=?, remarks=?, approval_id=? 
       WHERE id=? AND is_deleted = FALSE`,
      [project_id, contractor_name || '', contractor_id || null, amount, payment_date, payment_mode, reference_no || null, remarks || null, approval_id || null, id]
    );
    res.status(200).json({ message: 'Payment updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.delete('/contractor-payments/:id', authorizeAction('contractor_payments', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE contractor_payments SET is_deleted = TRUE WHERE id = ?', [id]);
    res.status(200).json({ message: 'Payment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/contractor-ledger', authorizeAction('contractor_payments', 'view'), async (req, res) => {
    const { search, contractor_id, from_date, to_date } = req.query;
    console.log("Incoming Filters (Ledger):", req.query);

    try {
      // Build filter for approvals and payments
      let approvalFilter = ` WHERE type = 'Contractor Payment' AND status = 'APPROVED' AND is_deleted = FALSE AND contractor_id IS NOT NULL `;
      let paymentFilter = ` WHERE cp.is_deleted = FALSE AND cp.contractor_id IS NOT NULL `;
      const approvalParams: any[] = [];
      const paymentParams: any[] = [];

      if (contractor_id) {
        approvalFilter += ` AND contractor_id = ? `;
        paymentFilter += ` AND contractor_id = ? `;
        approvalParams.push(contractor_id);
        paymentParams.push(contractor_id);
      }

      if (from_date) {
        approvalFilter += ` AND DATE(updatedAt) >= ? `;
        paymentFilter += ` AND DATE(payment_date) >= ? `;
        approvalParams.push(from_date);
        paymentParams.push(from_date);
      }

      if (to_date) {
        approvalFilter += ` AND DATE(updatedAt) <= ? `;
        paymentFilter += ` AND DATE(payment_date) <= ? `;
        approvalParams.push(to_date);
        paymentParams.push(to_date);
      }

      if (search) {
        approvalFilter += ` AND (vendorName LIKE ? OR p.name LIKE ? OR a.projectName LIKE ? OR approval_code LIKE ?) `;
        paymentFilter += ` AND (cp.contractor_name LIKE ? OR cp.reference_no LIKE ? OR p.name LIKE ?) `; 
        approvalParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        paymentParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const query = `
        SELECT 
            c.contractor_name,
            COALESCE(SUM(combined.approved_amount), 0) as total_approved,
            COALESCE(SUM(combined.paid_amount), 0) as total_paid,
            (COALESCE(SUM(combined.approved_amount), 0) - COALESCE(SUM(combined.paid_amount), 0)) as balance
        FROM contractors c
        LEFT JOIN (
            SELECT contractor_id, SUM(amount) as approved_amount, 0 as paid_amount
            FROM approvals
            ${approvalFilter}
            GROUP BY contractor_id
            UNION ALL
            SELECT contractor_id, 0 as approved_amount, SUM(amount) as paid_amount
            FROM contractor_payments cp
            LEFT JOIN projects p ON cp.project_id = p.id
            ${paymentFilter}
            GROUP BY contractor_id
        ) as combined ON c.id = combined.contractor_id
        WHERE c.is_deleted = FALSE
        ${contractor_id ? ' AND c.id = ? ' : ''}
        ${search ? ' AND c.contractor_name LIKE ? ' : ''}
        GROUP BY c.id
        ORDER BY balance DESC
      `;

      const finalParams = [...approvalParams, ...paymentParams];
      if (contractor_id) finalParams.push(contractor_id);
      if (search) finalParams.push(`%${search}%`);

      const [rows]: any = await pool.execute(query, finalParams);
      res.status(200).json(rows);
    } catch (error: any) {
      console.error("Fetch Contractor Ledger Error:", error);
      res.status(500).json({ error: error.message });
    }
});

api.get('/project-financials', authorizeAction('projects', 'view'), async (req, res) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT 
          p.id as project_id,
          p.name as project_name,
          p.budget,
          p.revenue,
          COALESCE(mi.total_material, 0) as total_grn_amount,
          COALESCE(cp.total_contractor, 0) as total_contractor_payment,
          (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0)) as total_expense,
          (p.budget - (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0))) as profit,
          CASE 
            WHEN p.budget > 0 THEN ((p.budget - (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0))) / p.budget * 100)
            ELSE 0 
          END as profit_percentage
      FROM projects p
      LEFT JOIN (
          SELECT miv.project_id, SUM(mii.total_cost) as total_material
          FROM material_issue_items mii
          JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
          WHERE mii.is_deleted = FALSE AND mii.revert_status = 'ACTIVE' AND miv.is_deleted = FALSE
          GROUP BY miv.project_id
      ) mi ON p.id = mi.project_id
      LEFT JOIN (
          SELECT project_id, SUM(amount) as total_contractor
          FROM contractor_payments
          WHERE is_deleted = FALSE
          GROUP BY project_id
      ) cp ON p.id = cp.project_id
      WHERE p.is_deleted = FALSE
      ORDER BY total_expense DESC
    `);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/projects/:id/budget', authorizeAction('projects', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { budget } = req.body;
  try {
    await pool.execute('UPDATE projects SET budget = ? WHERE id = ?', [budget, id]);
    res.status(200).json({ message: 'Budget updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/projects/:id/revenue', authorizeAction('projects', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { revenue } = req.body;
  try {
    await pool.execute('UPDATE projects SET revenue = ? WHERE id = ?', [revenue, id]);
    res.status(200).json({ message: 'Revenue updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONTRACTOR MASTER ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/master/contractors', authorizeAction('masters', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM contractors WHERE is_deleted = FALSE ORDER BY contractor_name ASC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/master/contractors', authorizeAction('masters', 'create'), async (req, res) => {
  const { contractor_name, mobile_number, contractor_type, linked_project_id, notes, source } = req.body;
  if (!contractor_name || !mobile_number || !contractor_type) {
    return res.status(400).json({ error: 'Missing required fields (name, mobile, type)' });
  }
  
  // Any contractor added manually by CEO/General Manager/Executive is considered verified by default,
  // unless explicitly passed as UNVERIFIED (e.g. quick add could be UNVERIFIED, but we'll default to VERIFIED)
  const verification_status = req.body.verification_status || 'VERIFIED';

  try {
    const [result]: any = await pool.execute(
      `INSERT INTO contractors (contractor_name, mobile_number, contractor_type, status, linked_project_id, notes, source, verification_status) 
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
      [contractor_name, mobile_number, contractor_type, linked_project_id || null, notes || null, source || 'MANUAL', verification_status]
    );
    res.status(201).json({ id: result.insertId, message: 'Contractor created successfully' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A contractor with this mobile number already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

api.put('/master/contractors/:id', authorizeAction('masters', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { contractor_name, mobile_number, contractor_type, status, linked_project_id, notes, verification_status } = req.body;
  
  if (!contractor_name || !mobile_number || !contractor_type) {
    return res.status(400).json({ error: 'Missing required fields (name, mobile, type)' });
  }

  try {
    await pool.execute(
      `UPDATE contractors 
       SET contractor_name = ?, mobile_number = ?, contractor_type = ?, status = ?, linked_project_id = ?, notes = ?, verification_status = ? 
       WHERE id = ?`,
      [contractor_name, mobile_number, contractor_type, status, linked_project_id || null, notes || null, verification_status || 'VERIFIED', id]
    );
    res.status(200).json({ message: 'Contractor updated successfully' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A contractor with this mobile number already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

api.delete('/master/contractors/:id', authorizeAction('masters', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('UPDATE contractors SET is_deleted = TRUE WHERE id = ?', [id]);
    res.status(200).json({ message: 'Contractor deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// REPORT EXPORT APIs
// ═══════════════════════════════════════════════════════════════

// 1. Project Financials - PDF
api.get('/reports/project-financials/pdf', authorizeAction('reports', 'export'), async (req, res) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT 
          p.name as project_name,
          p.budget,
          (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0)) as total_expense,
          (p.budget - (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0))) as profit
      FROM projects p
      LEFT JOIN (
          SELECT miv.project_id, SUM(mii.total_cost) as total_material
          FROM material_issue_items mii
          JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
          WHERE mii.is_deleted = FALSE AND mii.revert_status = 'ACTIVE' AND miv.is_deleted = FALSE
          GROUP BY miv.project_id
      ) mi ON p.id = mi.project_id
      LEFT JOIN (
          SELECT project_id, SUM(amount) as total_contractor 
          FROM contractor_payments 
          WHERE is_deleted = FALSE 
          GROUP BY project_id
      ) cp ON p.id = cp.project_id
      WHERE p.is_deleted = FALSE
      ORDER BY total_expense DESC
    `);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Project_Financial_Report.pdf');
    doc.pipe(res);

    doc.fontSize(20).text('BuildCore CMS - Financial Report', { align: 'center' });
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Table Header
    const tableTop = 100;
    const colWidths = [180, 100, 100, 100];
    const headers = ['Project Name', 'Budget', 'Expense', 'Profit'];
    
    let currentY = tableTop;
    doc.fontSize(10).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      const x = 30 + (i === 0 ? 0 : colWidths.slice(0, i).reduce((a, b) => a + b, 0));
      doc.text(h, x, currentY);
    });
    
    doc.moveTo(30, currentY + 15).lineTo(550, currentY + 15).stroke();
    currentY += 25;
    
    doc.font('Helvetica');
    rows.forEach((row: any) => {
       if (currentY > 750) { doc.addPage(); currentY = 50; }
       doc.text(row.project_name.substring(0, 30), 30, currentY);
       doc.text(row.budget.toLocaleString(), 210, currentY);
       doc.text(row.total_expense.toLocaleString(), 310, currentY);
       doc.text(row.profit.toLocaleString(), 410, currentY);
       currentY += 20;
    });

    doc.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Project Financials - Excel
api.get('/reports/project-financials/excel', authorizeAction('reports', 'export'), async (req, res) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT 
          p.name as project_name,
          p.budget,
          (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0)) as total_expense,
          (p.budget - (COALESCE(mi.total_material, 0) + COALESCE(cp.total_contractor, 0))) as profit
      FROM projects p
      LEFT JOIN (
          SELECT miv.project_id, SUM(mii.total_cost) as total_material
          FROM material_issue_items mii
          JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
          WHERE mii.is_deleted = FALSE AND mii.revert_status = 'ACTIVE' AND miv.is_deleted = FALSE
          GROUP BY miv.project_id
      ) mi ON p.id = mi.project_id
      LEFT JOIN (
          SELECT project_id, SUM(amount) as total_contractor 
          FROM contractor_payments 
          WHERE is_deleted = FALSE 
          GROUP BY project_id
      ) cp ON p.id = cp.project_id
      WHERE p.is_deleted = FALSE
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Project Financials');
    
    worksheet.columns = [
      { header: 'Project Name', key: 'project_name', width: 35 },
      { header: 'Budget', key: 'budget', width: 20 },
      { header: 'Total Expense', key: 'total_expense', width: 20 },
      { header: 'Profit/Loss (vs Budget)', key: 'profit', width: 20 }
    ];

    rows.forEach((r: any) => worksheet.addRow(r));
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Project_Financials.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Contractor Ledger - PDF
api.get('/reports/contractor-ledger/pdf', authorizeAction('reports', 'export'), async (req, res) => {
    try {
      const [rows]: any = await pool.execute(`
        SELECT 
            c.contractor_name,
            c.mobile_number,
            c.contractor_type,
            c.verification_status,
            COALESCE(SUM(combined.approved_amount), 0) as total_approved,
            COALESCE(SUM(combined.paid_amount), 0) as total_paid,
            (COALESCE(SUM(combined.approved_amount), 0) - COALESCE(SUM(combined.paid_amount), 0)) as balance
        FROM contractors c
        LEFT JOIN (
            SELECT contractor_id, SUM(amount) as approved_amount, 0 as paid_amount
            FROM approvals
            WHERE type = 'Contractor Payment' AND status = 'APPROVED' AND is_deleted = FALSE AND contractor_id IS NOT NULL
            GROUP BY contractor_id
            UNION ALL
            SELECT contractor_id, 0 as approved_amount, SUM(amount) as paid_amount
            FROM contractor_payments
            WHERE is_deleted = FALSE AND contractor_id IS NOT NULL
            GROUP BY contractor_id
        ) as combined ON c.id = combined.contractor_id
        WHERE c.is_deleted = FALSE
        GROUP BY c.id
        ORDER BY balance DESC
      `);
  
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=Contractor_Ledger_Report.pdf');
      doc.pipe(res);
  
      doc.fontSize(20).text('BuildCore CMS - Contractor Ledger', { align: 'center' });
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();
  
      let currentY = 100;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Contractor Name', 30, currentY);
      doc.text('Total Approved', 230, currentY);
      doc.text('Total Paid', 350, currentY);
      doc.text('Balance Due', 470, currentY);
      
      doc.moveTo(30, currentY + 15).lineTo(550, currentY + 15).stroke();
      currentY += 25;
      
      doc.font('Helvetica');
      rows.forEach((row: any) => {
         if (currentY > 750) { doc.addPage(); currentY = 50; }
         doc.text(row.contractor_name.substring(0, 30), 30, currentY);
         doc.text(row.total_approved.toLocaleString(), 230, currentY);
         doc.text(row.total_paid.toLocaleString(), 350, currentY);
         doc.text(row.balance.toLocaleString(), 470, currentY);
         currentY += 20;
      });
  
      doc.end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
});

// 4. Contractor Ledger - Excel
api.get('/reports/contractor-ledger/excel', authorizeAction('reports', 'export'), async (req, res) => {
    try {
      const [rows]: any = await pool.execute(`
        SELECT 
            c.contractor_name,
            c.mobile_number,
            c.contractor_type,
            c.verification_status,
            COALESCE(SUM(combined.approved_amount), 0) as total_approved,
            COALESCE(SUM(combined.paid_amount), 0) as total_paid,
            (COALESCE(SUM(combined.approved_amount), 0) - COALESCE(SUM(combined.paid_amount), 0)) as balance
        FROM contractors c
        LEFT JOIN (
            SELECT contractor_id, SUM(amount) as approved_amount, 0 as paid_amount
            FROM approvals
            WHERE type = 'Contractor Payment' AND status = 'APPROVED' AND is_deleted = FALSE AND contractor_id IS NOT NULL
            GROUP BY contractor_id
            UNION ALL
            SELECT contractor_id, 0 as approved_amount, SUM(amount) as paid_amount
            FROM contractor_payments
            WHERE is_deleted = FALSE AND contractor_id IS NOT NULL
            GROUP BY contractor_id
        ) as combined ON c.id = combined.contractor_id
        WHERE c.is_deleted = FALSE
        GROUP BY c.id
        ORDER BY balance DESC
      `);
  
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contractor Ledger');
      
      worksheet.columns = [
        { header: 'Contractor Name', key: 'contractor_name', width: 35 },
        { header: 'Total Approved (₹)', key: 'total_approved', width: 20 },
        { header: 'Total Paid (₹)', key: 'total_paid', width: 20 },
        { header: 'Balance Due (₹)', key: 'balance', width: 20 }
      ];
  
      rows.forEach((r: any) => worksheet.addRow(r));
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Contractor_Ledger.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
});

api.get('/dashboard-summary', authorizeAction('dashboard', 'view'), async (req, res) => {
  try {
    // 1. Core Totals
    const [totalsData]: any = await pool.execute(`
      SELECT 
        (SELECT COALESCE(SUM(paymentReceived), 0) FROM customers WHERE is_deleted = FALSE) as total_payments_received,
        (SELECT 
            COALESCE((SELECT SUM(mii.total_cost) FROM material_issue_items mii JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id WHERE mii.is_deleted = FALSE AND mii.revert_status = 'ACTIVE' AND miv.is_deleted = FALSE), 0) +
            COALESCE((SELECT SUM(amount) FROM contractor_payments WHERE is_deleted = FALSE), 0)
        ) as total_expense
    `);
    const totals = totalsData?.[0] || { total_payments_received: 0, total_expense: 0 };

    // 2. Pending Approvals
    const [pendingData]: any = await pool.execute(`
      SELECT COUNT(*) as count FROM approvals WHERE status = 'PENDING' AND is_deleted = FALSE
    `);
    const pending = pendingData?.[0] || { count: 0 };

    // 2b. Pending PRs
    const [pendingPRsData]: any = await pool.execute(`
      SELECT COUNT(*) as count FROM purchase_requests WHERE status IN ('PENDING_APPROVAL', 'PENDING_GM', 'PENDING_CA', 'PENDING_CEO') AND is_deleted = FALSE
    `);
    const pendingPRs = pendingPRsData?.[0] || { count: 0 };

    // 2c. Awaiting PO Creation
    const [awaitingPOData]: any = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM purchase_requests pr 
      WHERE pr.status IN ('APPROVED', 'PO_CREATED', 'CONVERTED_TO_PO') 
        AND pr.is_deleted = FALSE 
        AND NOT EXISTS (
          SELECT 1 
          FROM purchase_orders po 
          WHERE po.linked_pr_id = pr.id 
            AND po.is_deleted = FALSE
        )
    `);
    const awaitingPOCreation = awaitingPOData?.[0] || { count: 0 };

    // 3. GRN Charges Totals (Discount, Transport, Other)
    const [grnChargesData]: any = await pool.execute(`
      SELECT
        COALESCE(SUM(
          CASE 
            WHEN discountType = 'PERCENTAGE' THEN (total_amount * COALESCE(discountValue, 0) / 100)
            ELSE COALESCE(discountValue, 0)
          END
        ), 0) as total_discount,
        COALESCE(SUM(COALESCE(transportCharges, 0)), 0) as total_transport,
        COALESCE(SUM(COALESCE(otherCharges, 0)), 0) as total_other_charges
      FROM grns
      WHERE is_deleted = FALSE AND status != 'CANCELLED'
    `);
    const grnCharges = grnChargesData?.[0] || { total_discount: 0, total_transport: 0, total_other_charges: 0 };

    // 4. Top Projects (By Expense)
    const [topProjects]: any = await pool.execute(`
      SELECT 
          p.name,
          COALESCE(g.total, 0) as materialCost,
          COALESCE(cp.total, 0) as contractorCost,
          (COALESCE(g.total, 0) + COALESCE(cp.total, 0)) as expense,
          (p.revenue - (COALESCE(g.total, 0) + COALESCE(cp.total, 0))) as profit
      FROM projects p
      LEFT JOIN (
          SELECT miv.project_id, COALESCE(SUM(mii.total_cost), 0) as total 
          FROM material_issue_items mii 
          JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
          WHERE mii.is_deleted = FALSE AND mii.revert_status = 'ACTIVE' AND miv.is_deleted = FALSE
          GROUP BY miv.project_id
      ) g ON p.id = g.project_id
      LEFT JOIN (SELECT project_id, COALESCE(SUM(amount), 0) as total FROM contractor_payments WHERE is_deleted = FALSE GROUP BY project_id) cp ON p.id = cp.project_id
      WHERE p.is_deleted = FALSE
      ORDER BY expense DESC
      LIMIT 5
    `);

    // 5. Top Contractors (By Payment)
    const [topContractors]: any = await pool.execute(`
      SELECT contractor_name, COALESCE(SUM(amount), 0) as total_paid
      FROM contractor_payments
      WHERE is_deleted = FALSE
      GROUP BY contractor_name
      ORDER BY total_paid DESC
      LIMIT 5
    `);

    // 6. Top Vendors (By GRN Amount)
    const [topVendors]: any = await pool.execute(`
      SELECT 
        vendorName as vendor_name,
        COUNT(*) as grn_count,
        COALESCE(SUM(COALESCE(finalAmount, total_amount)), 0) as total_paid
      FROM grns
      WHERE is_deleted = FALSE AND status != 'CANCELLED' AND vendorName IS NOT NULL AND vendorName != ''
      GROUP BY vendorName
      ORDER BY total_paid DESC
      LIMIT 5
    `);

    // 7. Inventory Asset Value
    const [inventoryData]: any = await pool.execute(`
      SELECT COALESCE(SUM(total_value), 0) as total_asset_value 
      FROM inventory 
      WHERE is_deleted = FALSE
    `);
    const inventory = inventoryData?.[0] || { total_asset_value: 0 };

    res.status(200).json({
      totalPaymentsReceived: totals.total_payments_received || 0,
      expense: totals.total_expense || 0,
      profit: (totals.total_payments_received || 0) - (totals.total_expense || 0),
      inventoryAssetValue: Number(inventory.total_asset_value) || 0,
      pendingCount: pending.count || 0,
      pendingPRsCount: pendingPRs.count || 0,
      awaitingPOCreation: awaitingPOCreation.count || 0,
      totalDiscount: grnCharges.total_discount || 0,
      totalTransport: grnCharges.total_transport || 0,
      totalOtherCharges: grnCharges.total_other_charges || 0,
      topProjects: topProjects || [],
      topContractors: topContractors || [],
      topVendors: topVendors || []
    });
  } catch (error: any) {
    console.error('❌ DASHBOARD SUMMARY ERROR:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

api.post('/approval-requests/:id/restore', authorizeAction('approvals', 'rollback'), async (req, res) => {
  const { id } = req.params;

  try {
    const [rows]: any = await pool.execute(
      'SELECT id, status FROM approvals WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (rows[0].status !== 'VOIDED') {
      return res.status(400).json({ error: 'Only voided approval requests can be restored' });
    }

    await pool.execute(
      'UPDATE approvals SET status = ?, voidedBy = NULL, voidedAt = NULL WHERE id = ? AND is_deleted = FALSE',
      ['PENDING', id]
    );

    const [updatedRows]: any = await pool.execute(
      'SELECT * FROM approvals WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    res.status(200).json({
      message: 'Approval request restored successfully',
      approval: updatedRows[0]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CUSTOMERS ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/customers', authorizeAction('customers', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM customers WHERE is_deleted = FALSE ORDER BY createdAt DESC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/customers', authorizeAction('customers', 'create'), async (req, res) => {
  const { name, plotNumber, totalPayment } = req.body;

  if (!name || !plotNumber || !totalPayment) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result]: any = await pool.execute(
      `INSERT INTO customers (name, plotNumber, totalPayment, paymentReceived, pendingPayment, is_deleted)
       VALUES (?, ?, ?, 0, ?, FALSE)`,
      [name, plotNumber, totalPayment, totalPayment]
    );

    res.status(201).json({ id: result.insertId, message: 'Customer created successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.put('/customers/:id/payment', authorizeAction('customers', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid payment amount required' });
  }

  try {
    await pool.execute(
      'UPDATE customers SET paymentReceived = paymentReceived + ?, pendingPayment = pendingPayment - ? WHERE id = ?',
      [amount, amount, id]
    );
    res.status(200).json({ message: 'Payment updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// LEDGER ENTRIES ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/ledger', authorizeAction('customers', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM ledger_entries WHERE is_deleted = FALSE ORDER BY createdAt DESC');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/payments', authorizeAction('customers', 'create'), async (req, res) => {
  const { customerId, customerName, plotNumber, amount, mode, date, type } = req.body;

  // DEBUG: Log incoming data
  console.log("Processing Payment Request:", {
    customerId,
    customerName,
    amount,
    mode,
    date,
    type: type || 'CREDIT'
  });

  if (!customerId || !amount || !mode || !date) {
    return res.status(400).json({ error: 'Missing required fields (customerId, amount, mode, date)' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Fix Date Format (Convert to YYYY-MM-DD)
    let formattedDate = date;
    try {
      // If it's already YYYY-MM-DD, new Date() will handle it.
      // If it's DD-MM-YYYY, we help it out.
      if (date.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const [d, m, y] = date.split('-');
        formattedDate = `${y}-${m}-${d}`;
      } else {
        formattedDate = new Date(date).toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn("⚠️ Date normalization warning:", e.message);
    }

    // Insert into ledger_entries
    const [ledgerResult]: any = await connection.execute(
      `INSERT INTO ledger_entries (customerId, customerName, plotNumber, amount, mode, date, type, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [customerId, customerName, plotNumber, amount, mode, formattedDate, type || 'CREDIT']
    );

    // Update customer payment record
    const [updateResult]: any = await connection.execute(
      'UPDATE customers SET paymentReceived = paymentReceived + ?, pendingPayment = pendingPayment - ? WHERE id = ?',
      [amount, amount, customerId]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error('Customer record not found or update failed');
    }

    await connection.commit();
    console.log("✅ Payment recorded successfully. Ledger ID:", ledgerResult.insertId);

    res.status(201).json({ 
      id: ledgerResult.insertId, 
      message: 'Payment and ledger entry recorded successfully' 
    });

  } catch (error: any) {
    await connection.rollback();
    console.error("❌ Ledger Insert Failed:", error);
    res.status(500).json({ 
      error: 'Failed to record payment transaction', 
      details: error.message 
    });
  } finally {
    connection.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// GRN ROUTES
// ═══════════════════════════════════════════════════════════════

api.get('/grns', authorizeAction('grn', 'view'), async (req, res) => {
  const { status, search, vendor, fromDate, toDate, page = '1', limit = '10' } = req.query;
  const p = parseInt(page as string) || 1;
  const l = parseInt(limit as string) || 10;
  const offset = (p - 1) * l;

  try {
    // Test if table exists
    const [testRows]: any = await pool.execute('SELECT COUNT(*) as count FROM grns WHERE is_deleted = FALSE');
    console.log('✅ GRN table accessible, count:', testRows[0].count);

    // 1. Base filter query
    let baseFilter = ` WHERE g.is_deleted = FALSE `;
    const baseParams: any[] = [];

    if (search) {
      baseFilter += ` AND (g.grn_number LIKE ? OR g.vendorName LIKE ?) `;
      baseParams.push(`%${search}%`, `%${search}%`);
    }

    if (vendor) {
      baseFilter += ` AND g.vendorName = ? `;
      baseParams.push(vendor);
    }

    if (fromDate) {
      baseFilter += ` AND g.grn_date >= ? `;
      baseParams.push(fromDate);
    }

    if (toDate) {
      baseFilter += ` AND g.grn_date <= ? `;
      baseParams.push(toDate);
    }

    // 2. Get Global Counts for Tabs (Filtered)
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN COALESCE(status, 'ACTIVE') IN ('ACTIVE', 'POSTED') THEN 1 END) as active,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
        (SELECT COUNT(*) FROM grn_edit_history) as edited
      FROM grns g ${baseFilter}
    `;
    const [statsData]: any = await pool.execute(statsQuery, baseParams);
    const stats = statsData?.[0] || { active: 0, cancelled: 0, edited: 0 };

    // 3. Build status filter
    let statusFilter = '';
    const statusParams: any[] = [];
    
    if (status) {
      if (status === 'ACTIVE') {
        statusFilter = ` AND (g.status IN (?, ?) OR g.status IS NULL) `;
        statusParams.push('ACTIVE', 'POSTED');
      } else {
        statusFilter = ` AND g.status = ? `;
        statusParams.push(status);
      }
    }

    // 4. Get total count for current view
    const countParams = [...baseParams, ...statusParams];
    const [countRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM grns g ${baseFilter}${statusFilter}`,
      countParams
    );
    const total = countRows?.[0]?.total || 0;

    // 5. Get paginated data
    const dataQuery = `
      SELECT g.*, p.name as projectName 
      FROM grns g 
      LEFT JOIN projects p ON g.projectId = p.id 
      ${baseFilter}${statusFilter}
      ORDER BY g.createdAt DESC 
      LIMIT ${parseInt(String(l), 10)} OFFSET ${parseInt(String(offset), 10)}
    `;
    const dataParams = [...baseParams, ...statusParams];
    const [rows]: any = await pool.query(dataQuery, dataParams);

    res.status(200).json({
      data: rows || [],
      total,
      stats,
      page: p,
      totalPages: Math.ceil((total || 0) / l)
    });
  } catch (error: any) {
    console.error('❌ GRN FETCH ERROR:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

api.get('/grns/:id', authorizeAction('grn', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [grnRows]: any = await pool.execute(`
      SELECT g.*, p.name as projectName 
      FROM grns g 
      LEFT JOIN projects p ON g.projectId = p.id 
      WHERE g.id = ? AND g.is_deleted = FALSE
    `, [id]);

    if (grnRows.length === 0) return res.status(404).json({ error: 'GRN not found' });

    const [itemRows]: any = await pool.execute(`
      SELECT gi.*, inv.unit, inv.category 
      FROM grn_items gi 
      JOIN inventory inv ON gi.inventory_id = inv.id 
      WHERE gi.grn_id = ?
    `, [id]);

    // Check if the GRN is used (partially issued)
    const isUsed = await isGrnUsed(pool as any, id);

    res.status(200).json({ ...grnRows[0], items: itemRows, is_used: isUsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/grns/:id/pdf', authorizeAction('grn', 'export'), async (req, res) => {
  const { id } = req.params;
  try {
    const [grnRows]: any = await pool.execute(`
      SELECT g.*, p.name as projectName 
      FROM grns g 
      LEFT JOIN projects p ON g.projectId = p.id 
      WHERE g.id = ? AND g.is_deleted = FALSE
    `, [id]);

    if (grnRows.length === 0) return res.status(404).json({ error: 'GRN not found' });

    const [itemRows]: any = await pool.execute(`
      SELECT gi.*, inv.unit, inv.category 
      FROM grn_items gi 
      JOIN inventory inv ON gi.inventory_id = inv.id 
      WHERE gi.grn_id = ?
    `, [id]);

    const grn = grnRows[0];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=GRN-${grn.grn_number}.pdf`);

    doc.pipe(res);

    // Header
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#1e40af').text('BuildCore CMS', { align: 'center' });
    doc.fontSize(10).fillColor('#64748b').text('Material Receipt Document (Goods Receipt Note)', { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(2);

    // Information Section
    const infoY = doc.y;
    doc.fillColor('#000000').fontSize(10);
    
    // Left side info
    doc.font('Helvetica-Bold').text('Vendor Name: ', 50, infoY, { continued: true }).font('Helvetica').text(grn.vendorName || 'No Vendor Selected');
    if (grn.gstNumber) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('GST Number: ', 50, doc.y, { continued: true }).font('Helvetica').text(grn.gstNumber);
    }
    if (grn.projectName) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Project: ', 50, doc.y, { continued: true }).font('Helvetica').text(grn.projectName);
    }

    // Right side info
    doc.font('Helvetica-Bold').text('GRN Number: ', 350, infoY, { continued: true }).font('Helvetica').text(grn.grn_number);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Receipt Date: ', 350, doc.y, { continued: true }).font('Helvetica').text(new Date(grn.grn_date).toLocaleDateString());
    
    doc.moveDown(3);

    // Table Setup
    const tableTop = doc.y;
    const col1 = 50;  // Item
    const col2 = 250; // Category
    const col3 = 350; // Qty
    const col4 = 420; // Rate
    const col5 = 500; // Total

    // Table Header Background
    doc.rect(50, tableTop - 5, 495, 20).fill('#f8fafc');
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(9);
    doc.text('ITEM NAME', col1, tableTop);
    doc.text('CATEGORY', col2, tableTop);
    doc.text('QTY', col3, tableTop);
    doc.text('RATE (INR)', col4, tableTop);
    doc.text('TOTAL (INR)', col5, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#cbd5e1').stroke();
    
    // Table Body
    let currentY = tableTop + 25;
    doc.fillColor('#000000').font('Helvetica').fontSize(9);

    for (const item of itemRows) {
      // Check for page break
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(item.item_name, col1, currentY, { width: 190 });
      doc.text(item.category || '-', col2, currentY);
      doc.text(`${item.quantity} ${item.unit}`, col3, currentY);
      
      // 📊 High-Precision Rate Display
      const displayRate = parseFloat(item.rate).toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 4 
      });
      doc.text(displayRate, col4, currentY);
      doc.text(parseFloat(item.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), col5, currentY);
      
      currentY += 25;
      doc.moveTo(50, currentY - 5).lineTo(545, currentY - 5).strokeColor('#f1f5f9').stroke();
    }

    // Financial Summary
    currentY += 20;
    if (currentY > 700) { doc.addPage(); currentY = 50; }
    
    const subtotal = parseFloat(grn.total_amount) || 0;
    const discVal = parseFloat(grn.discountValue) || 0;
    const discAmt = grn.discountType === 'PERCENTAGE' ? (subtotal * discVal / 100) : discVal;
    const transport = parseFloat(grn.transportCharges) || 0;
    const other = parseFloat(grn.otherCharges) || 0;
    const finalTotal = parseFloat(grn.finalAmount || (subtotal - discAmt + transport + other));

    doc.fillColor('#475569');
    
    // Subtotal Row
    doc.font('Helvetica').fontSize(10).text('Subtotal:', 350, currentY, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').text(`INR ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 450, currentY, { width: 95, align: 'right' });
    
    // Discount Row
    if (discAmt > 0) {
      currentY += 15;
      doc.font('Helvetica').fillColor('#ef4444').text(`Discount ${grn.discountType === 'PERCENTAGE' ? `(${discVal}%)` : ''}:`, 350, currentY, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').text(`- INR ${discAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 450, currentY, { width: 95, align: 'right' });
    }

    // Charges Rows
    if (transport > 0) {
      currentY += 15;
      doc.font('Helvetica').fillColor('#059669').text('Transport:', 350, currentY, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').text(`+ INR ${transport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 450, currentY, { width: 95, align: 'right' });
    }
    
    if (other > 0) {
      currentY += 15;
      doc.font('Helvetica').fillColor('#059669').text('Other Charges:', 350, currentY, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').text(`+ INR ${other.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 450, currentY, { width: 95, align: 'right' });
    }

    // Horizontal Divider
    currentY += 15;
    doc.moveTo(350, currentY).lineTo(545, currentY).strokeColor('#1e40af').lineWidth(1).stroke();
    
    // Grand Total Row
    currentY += 10;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e40af').text('FINAL TOTAL:', 300, currentY, { align: 'right', width: 150 });
    doc.text(`INR ${finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 450, currentY, { align: 'right', width: 95 });

    // Remarks
    if (grn.remarks) {
      currentY += 50;
      if (currentY > 700) { doc.addPage(); currentY = 50; }
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('REMARKS:', 50, currentY);
      doc.fillColor('#1e293b').font('Helvetica').fontSize(10).text(grn.remarks, 50, currentY + 15, { width: 495 });
    }

    // Footer / Signatures
    const sigY = 720;
    doc.moveTo(50, sigY).lineTo(200, sigY).strokeColor('#000000').lineWidth(1).stroke();
    doc.moveTo(395, sigY).lineTo(545, sigY).stroke();
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
    doc.text('AUTHORIZED SIGNATURE', 50, sigY + 10, { width: 150, align: 'center' });
    doc.text('SITE INCHARGE SIGNATURE', 395, sigY + 10, { width: 150, align: 'center' });

    doc.fontSize(7).fillColor('#0f766e').font('Helvetica-Bold').text('Official Commercial Valuation Document', 50, 768, { align: 'center', width: 495 });
    doc.fontSize(7).fillColor('#94a3b8').font('Helvetica').text(`System Generated via BuildCore CMS on ${new Date().toLocaleString()}`, 50, 780, { align: 'center', width: 495 });

    doc.end();
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// PROCUREMENT GOVERNANCE APIs
// ═══════════════════════════════════════════════════════════════

async function logProcurementAction(connection: mysql.PoolConnection | mysql.Pool, entityType: 'PR' | 'PO', entityId: number, action: string, user: any, remarks?: string) {
  await connection.execute(
    `INSERT INTO procurement_audit_logs (entity_type, entity_id, action, performed_by, role, remarks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, action, user.name || user.email, user.role, remarks || '']
  );
}

async function logStatusHistory(
  connection: mysql.PoolConnection | mysql.Pool,
  entityType: 'PR' | 'PO' | 'GRN',
  entityId: number,
  oldStatus: string | null,
  newStatus: string,
  user: any,
  remarks?: string
) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type ENUM('PR','PO','GRN') NOT NULL,
      entity_id INT NOT NULL,
      old_status VARCHAR(50),
      new_status VARCHAR(50) NOT NULL,
      changed_by INT NULL,
      changed_by_name VARCHAR(255),
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      INDEX idx_status_entity (entity_type, entity_id)
    )
  `);
  await connection.execute(
    `INSERT INTO status_history (entity_type, entity_id, old_status, new_status, changed_by, changed_by_name, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, oldStatus, newStatus, user?.userId || null, user?.name || user?.email || 'System', remarks || '']
  );
}

// 1. PURCHASE REQUESTS (PR)

api.get('/procurement/pr', authorizeAction('procurement', 'view'), async (req, res) => {
  const user = (req as any).user as Session;
  try {
    let query = `
      SELECT pr.*, p.name as project_name 
      FROM purchase_requests pr
      LEFT JOIN projects p ON pr.project_id = p.id
      WHERE pr.is_deleted = FALSE
    `;
    const params: any[] = [];

    query += ` ORDER BY pr.createdAt DESC`;
    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/procurement/pr/:id', authorizeAction('procurement', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [prRows]: any = await pool.execute(
      `SELECT pr.*, p.name as project_name FROM purchase_requests pr LEFT JOIN projects p ON pr.project_id = p.id WHERE pr.id = ?`, 
      [id]
    );
    if (prRows.length === 0) return res.status(404).json({ error: 'PR not found' });

    const [itemRows] = await pool.execute(
      `SELECT * FROM procurement_items WHERE parent_type = 'PR' AND parent_id = ?`, 
      [id]
    );

    res.status(200).json({ ...prRows[0], items: itemRows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/procurement/pr', authorizeAction('procurement', 'create'), async (req, res) => {
  const user = (req as any).user as Session;
  const { project_id, procurement_type, request_reason, priority, items } = req.body;

  console.log('📝 POST /procurement/pr - Request body:', req.body);

  const finalProcurementType = procurement_type || 'PROJECT';
  const finalProjectId = finalProcurementType === 'GENERAL_STOCK' ? null : project_id;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'Items are required' });
  }

  if (finalProcurementType === 'PROJECT' && !finalProjectId) {
    return res.status(400).json({ error: 'Project is required for Project Procurement' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const prNumber = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const prInsertSQL = `INSERT INTO purchase_requests (pr_number, project_id, procurement_type, requested_by, requested_by_uid, request_reason, priority, status, estimated_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const prInsertParams = [prNumber, finalProjectId, finalProcurementType, user.name || user.email, user.uid, request_reason || '', priority || 'MEDIUM', PR_STATUS.DRAFT, 0];
    
    console.log('🔧 PR Insert SQL:', prInsertSQL);
    console.log('🔧 PR Insert Params:', prInsertParams);
    
    const [prResult]: any = await connection.execute(prInsertSQL, prInsertParams);
    const prId = prResult.insertId;
    console.log('✅ PR created with ID:', prId);

    for (const item of items) {
      const finalInventoryId = item.inventory_id ? Number(item.inventory_id) : null;
      const itemInsertSQL = `INSERT INTO procurement_items (parent_type, parent_id, inventory_id, item_name, quantity, received_quantity, estimated_rate, approved_rate, gst_percent, tax_amount, total_amount, remarks) VALUES ('PR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const itemInsertParams = [prId, finalInventoryId, item.item_name, item.quantity, 0, 0, 0, 0, 0, 0, item.remarks || ''];
      
      console.log('🔧 Procurement Item Insert SQL:', itemInsertSQL);
      console.log('🔧 Procurement Item Insert Params:', itemInsertParams);
      
      await connection.execute(itemInsertSQL, itemInsertParams);
    }

    await logProcurementAction(connection, 'PR', prId, 'CREATED_DRAFT', user, 'PR created as draft');
    await logStatusHistory(connection, 'PR', prId, null, PR_STATUS.DRAFT, user, 'Requirement intent draft created');
    
    await connection.commit();
    res.status(201).json({ id: prId, pr_number: prNumber, message: 'PR draft created successfully' });
  } catch (error: any) {
    console.error('❌ POST /procurement/pr - Error:', error);
    console.error('❌ POST /procurement/pr - Stack:', error.stack);
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.put('/procurement/pr/:id', authorizeAction('procurement', 'edit'), async (req, res) => {
  const user = (req as any).user as Session;
  const { id } = req.params;
  const { project_id, procurement_type, request_reason, priority, items } = req.body;

  const finalProcurementType = procurement_type || 'PROJECT';
  const finalProjectId = finalProcurementType === 'GENERAL_STOCK' ? null : project_id;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'Items are required' });
  }

  if (finalProcurementType === 'PROJECT' && !finalProjectId) {
    return res.status(400).json({ error: 'Project is required for Project Procurement' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [oldPr]: any = await connection.execute('SELECT status FROM purchase_requests WHERE id = ? FOR UPDATE', [id]);
    if (oldPr.length === 0) throw new Error('PR not found');
    const currentStatus = normalizeProcurementStatus(oldPr[0].status);
    if (currentStatus !== PR_STATUS.DRAFT && currentStatus !== PR_STATUS.RETURNED) {
      throw new Error('Only DRAFT or RETURNED PRs can be edited');
    }

    await connection.execute(
      `UPDATE purchase_requests SET project_id = ?, procurement_type = ?, request_reason = ?, priority = ?, estimated_total = ? WHERE id = ?`,
      [finalProjectId, finalProcurementType, request_reason || '', priority || 'MEDIUM', 0, id]
    );

    await connection.execute(`DELETE FROM procurement_items WHERE parent_type = 'PR' AND parent_id = ?`, [id]);
    for (const item of items) {
      const finalInventoryId = item.inventory_id ? Number(item.inventory_id) : null;
      await connection.execute(
        `INSERT INTO procurement_items (parent_type, parent_id, inventory_id, item_name, quantity, received_quantity, estimated_rate, approved_rate, gst_percent, tax_amount, total_amount, remarks)
         VALUES ('PR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, finalInventoryId, item.item_name, item.quantity, 0, 0, 0, 0, 0, 0, item.remarks || '']
      );
    }

    await logProcurementAction(connection, 'PR', Number(id), 'EDITED', user, 'PR draft updated');

    await connection.commit();
    res.status(200).json({ message: 'PR updated successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.post('/procurement/pr/:id/submit', authorizeAction('procurement', 'create'), async (req, res) => {
  const user = (req as any).user as Session;
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [oldPr]: any = await connection.execute('SELECT pr_number, status FROM purchase_requests WHERE id = ? FOR UPDATE', [id]);
    if (oldPr.length === 0) throw new Error('PR not found');
    const currentStatus = normalizeProcurementStatus(oldPr[0].status);
    if (currentStatus !== PR_STATUS.DRAFT && currentStatus !== PR_STATUS.RETURNED) {
      throw new Error('Only DRAFT or RETURNED PRs can be submitted');
    }

    await connection.execute(`UPDATE purchase_requests SET status = ? WHERE id = ?`, [PR_STATUS.PENDING_APPROVAL, id]);

    await logProcurementAction(connection, 'PR', Number(id), 'SUBMITTED', user, 'Submitted for CEO Approval');
    await logStatusHistory(connection, 'PR', Number(id), oldPr[0].status, PR_STATUS.PENDING_APPROVAL, user, 'Submitted for CEO approval');
    
    // Notifications and Generic Auditing
    console.log(`[NOTIFICATION] PR SUBMITTED: PR #${oldPr[0].pr_number} submitted for CEO approval by ${user.email}`);
    await connection.execute(
      'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
      [user.email, 'PR_SUBMITTED', JSON.stringify({ pr_id: id, pr_number: oldPr[0].pr_number })]
    );

    await connection.commit();
    res.status(200).json({ message: 'PR submitted for CEO approval' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

api.put('/procurement/pr/:id/status', authorizeAction('procurement', 'approve'), async (req, res) => {
  const user = (req as any).user as Session;
  const { id } = req.params;
  const { action, remarks } = req.body; // action: 'approve' | 'reject' | 'return'

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let query = 'SELECT * FROM purchase_requests WHERE id = ? FOR UPDATE';
    let queryParam: any = id;
    if (isNaN(Number(id)) && typeof id === 'string') {
      query = 'SELECT * FROM purchase_requests WHERE pr_number = ? FOR UPDATE';
      queryParam = id;
    }
    const [prRows]: any = await connection.execute(query, [queryParam]);
    if (prRows.length === 0) throw new Error('PR not found');
    const pr = prRows[0];
    const prDbId = pr.id;

    const prStatus = normalizeProcurementStatus(pr.status);
    const isPendingApp = PR_PENDING_APPROVAL_STATUSES.has(prStatus);
    if (!isPendingApp) {
      throw new Error('PR is not in an action-eligible state');
    }

    let nextStatus = pr.status;
    const normalizedAction = (action || '').toLowerCase().trim();

    if (normalizedAction === 'reject' || normalizedAction === 'rejected') {
      nextStatus = PR_STATUS.REJECTED;
      await connection.execute(`UPDATE purchase_requests SET status = ? WHERE id = ?`, [nextStatus, prDbId]);
      await logProcurementAction(connection, 'PR', prDbId, 'REJECTED', user, remarks || 'PR rejected by CEO');
      await logStatusHistory(connection, 'PR', prDbId, pr.status, nextStatus, user, remarks || 'Requirement intent rejected by CEO');
      
      console.log(`[NOTIFICATION] PR REJECTED: PR #${pr.pr_number} has been rejected by CEO ${user.email}`);
      await connection.execute(
        'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
        [user.email, 'PR_REJECTED', JSON.stringify({ pr_id: prDbId, pr_number: pr.pr_number, remarks })]
      );
      
    } else if (normalizedAction === 'return' || normalizedAction === 'returned') {
      nextStatus = PR_STATUS.RETURNED;
      await connection.execute(`UPDATE purchase_requests SET status = ? WHERE id = ?`, [nextStatus, prDbId]);
      await logProcurementAction(connection, 'PR', prDbId, 'RETURNED', user, remarks || 'PR returned for correction');
      await logStatusHistory(connection, 'PR', prDbId, pr.status, nextStatus, user, remarks || 'Requirement intent returned for correction');
      
      console.log(`[NOTIFICATION] PR RETURNED: PR #${pr.pr_number} has been returned by CEO ${user.email}`);
      await connection.execute(
        'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
        [user.email, 'PR_RETURNED', JSON.stringify({ pr_id: prDbId, pr_number: pr.pr_number, remarks })]
      );
      
    } else if (normalizedAction === 'approve' || normalizedAction === 'approved') {
      // 1. Update PR status to APPROVED
      nextStatus = PR_STATUS.APPROVED;
      await connection.execute(`UPDATE purchase_requests SET status = ? WHERE id = ?`, [nextStatus, prDbId]);
      await logProcurementAction(connection, 'PR', prDbId, 'APPROVED', user, remarks || 'PR approved by CEO');
      await logStatusHistory(connection, 'PR', prDbId, pr.status, nextStatus, user, remarks || 'Requirement intent approved by CEO');

      console.log(`[NOTIFICATION] PR APPROVED: PR #${pr.pr_number} has been approved by CEO ${user.email}`);
      await connection.execute(
        'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
        [user.email, 'PR_APPROVED', JSON.stringify({ pr_id: prDbId, pr_number: pr.pr_number, remarks })]
      );

      // 2. Fetch Placeholder Vendor
      const [vendorRows]: any = await connection.execute(
        "SELECT id FROM vendors WHERE vendor_name = 'PLACEHOLDER VENDOR' LIMIT 1"
      );
      if (vendorRows.length === 0) {
        throw new Error('Placeholder Vendor is missing in system database.');
      }
      const placeholderVendorId = vendorRows[0].id;

      // 3. Fetch PR line items
      const [prItems]: any = await connection.execute(
        "SELECT * FROM procurement_items WHERE parent_type = 'PR' AND parent_id = ?",
        [prDbId]
      );
      if (prItems.length === 0) {
        throw new Error('Approved PR has no line items');
      }

      // 4. Generate draft PO as a vendor communication shell. No accounting values are carried from PR.
      const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 5. Save DRAFT PO header
      const [poResult]: any = await connection.execute(
        `INSERT INTO purchase_orders (po_number, vendor_id, project_id, procurement_type, linked_pr_id, subtotal, gst_total, final_total, po_status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poNumber, placeholderVendorId, pr.project_id, pr.procurement_type || 'PROJECT', prDbId, 0, 0, 0, PO_STATUS.DRAFT, user.name || user.email]
      );
      const poId = poResult.insertId;

      // 6. Save DRAFT PO line items
      for (const item of prItems) {
        const finalInventoryId = item.inventory_id ? Number(item.inventory_id) : null;
        await connection.execute(
          `INSERT INTO procurement_items (parent_type, parent_id, inventory_id, item_name, quantity, approved_rate, gst_percent, tax_amount, total_amount, remarks)
           VALUES ('PO', ?, ?, ?, ?, ?, 18.00, ?, ?, ?)`,
          [poId, finalInventoryId, item.item_name, item.quantity, 0, 0, 0, item.remarks || '']
        );
      }

      await logProcurementAction(connection, 'PO', poId, 'DRAFT_CREATED', user, 'Draft PO shell created from approved PR for Procurement Manager action');
      await logStatusHistory(connection, 'PO', poId, null, PO_STATUS.DRAFT, user, 'PR_APPROVED event created draft PO shell');

      console.log(`[NOTIFICATION] DRAFT PO SHELL GENERATED: PO #${poNumber} created in DRAFT state from PR #${pr.pr_number} for Procurement Manager finalization`);
      await connection.execute(
        'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
        [user.email, 'PR_APPROVED_DRAFT_PO_CREATED', JSON.stringify({ po_id: poId, po_number: poNumber, pr_id: prDbId, pr_number: pr.pr_number, valuation_source: 'GRN_ONLY' })]
      );
      
    } else {
      throw new Error('Invalid action');
    }

    await connection.commit();
    res.status(200).json({ message: `PR ${action}ed successfully`, nextStatus });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// 2. PURCHASE ORDERS (PO)

api.get('/procurement/po', authorizeAction('procurement', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        po.*, 
        v.vendor_name, 
        p.name as project_name,
        COALESCE(
          (SELECT SUM(COALESCE(received_quantity, 0)) / SUM(quantity) * 100 
           FROM procurement_items 
           WHERE parent_type = 'PO' AND parent_id = po.id), 
          0
        ) as fulfillment_progress,
        COALESCE(
          (SELECT SUM(quantity - COALESCE(received_quantity, 0)) 
           FROM procurement_items 
           WHERE parent_type = 'PO' AND parent_id = po.id), 
          0
        ) as total_remaining_quantity
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN projects p ON po.project_id = p.id
      WHERE po.is_deleted = FALSE
      ORDER BY po.createdAt DESC
    `);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// TEMP DEBUG ENDPOINT FOR GRN PO ELIGIBILITY AUDIT
api.get('/debug/procurement/po-audit', requireAuth, async (req, res) => {
  try {
    const [poRows]: any = await pool.execute(`
      SELECT 
        po.*, 
        v.vendor_name, 
        p.name as project_name,
        COALESCE(
          (SELECT SUM(COALESCE(received_quantity, 0)) / SUM(quantity) * 100 
           FROM procurement_items 
           WHERE parent_type = 'PO' AND parent_id = po.id), 
          0
        ) as fulfillment_progress,
        COALESCE(
          (SELECT SUM(quantity - COALESCE(received_quantity, 0)) 
           FROM procurement_items 
           WHERE parent_type = 'PO' AND parent_id = po.id), 
          0
        ) as total_remaining_quantity,
        (SELECT COUNT(*) FROM procurement_items WHERE parent_type = 'PO' AND parent_id = po.id) as item_count
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN projects p ON po.project_id = p.id
      WHERE po.is_deleted = FALSE
      ORDER BY po.createdAt DESC
    `);

    const [itemRows]: any = await pool.execute(`
      SELECT * FROM procurement_items WHERE parent_type = 'PO' ORDER BY id DESC LIMIT 50
    `);

    console.log('[DEBUG] PO Audit Data:', {
      poCount: poRows.length,
      itemCount: itemRows.length,
      firstPO: poRows[0],
      firstItems: itemRows.slice(0, 5)
    });

    res.status(200).json({
      purchase_orders: poRows,
      procurement_items: itemRows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/procurement/po/:id', authorizeAction('procurement', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [poRows]: any = await pool.execute(
      `SELECT po.*, v.vendor_name, p.name as project_name 
       FROM purchase_orders po 
       JOIN vendors v ON po.vendor_id = v.id 
       LEFT JOIN projects p ON po.project_id = p.id 
       WHERE po.id = ?`, 
      [id]
    );
    if (poRows.length === 0) return res.status(404).json({ error: 'PO not found' });

    const [itemRows]: any = await pool.execute(
      `SELECT pi.*, i.unit FROM procurement_items pi 
       LEFT JOIN inventory i ON pi.inventory_id = i.id 
       WHERE pi.parent_type = 'PO' AND pi.parent_id = ?`, 
      [id]
    );

    console.log('[DEBUG] PO Fetch:', {
      poId: id,
      fetchedItemCount: itemRows.length,
      itemParentTypes: Array.from(new Set(itemRows.map((i: any) => i.parent_type)))
    });

    res.status(200).json({ ...poRows[0], items: itemRows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/procurement/po', authorizeAction('procurement', 'create'), async (req, res) => {
  const user = (req as any).user as Session;
  const { linked_pr_id, vendor_id, project_id, procurement_type, items } = req.body;

  let finalProcurementType = procurement_type || 'PROJECT';
  let finalProjectId = finalProcurementType === 'GENERAL_STOCK' ? null : project_id;

  if (linked_pr_id) {
    const [pr]: any = await pool.execute('SELECT procurement_type, project_id FROM purchase_requests WHERE id = ?', [linked_pr_id]);
    if (pr.length > 0) {
      finalProcurementType = pr[0].procurement_type || 'PROJECT';
      finalProjectId = pr[0].project_id;
    }
  }

  if (!vendor_id || !items || !items.length) {
    return res.status(400).json({ error: 'Vendor and items are required' });
  }

  if (finalProcurementType === 'PROJECT' && !finalProjectId) {
    return res.status(400).json({ error: 'Project is required for Project Procurement' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // If linked to PR, verify PR is APPROVED
    if (linked_pr_id) {
      const [pr]: any = await connection.execute('SELECT id, status FROM purchase_requests WHERE id = ? FOR UPDATE', [linked_pr_id]);
      if (pr.length === 0) throw new Error('Linked PR not found');
      if (!isPrApprovedForPo(pr[0].status)) {
        throw new Error(`Linked PR must be APPROVED before creating PO. Current status: ${normalizeProcurementStatus(pr[0].status) || 'UNKNOWN'}`);
      }

      const [existingPoRows]: any = await connection.execute(
        `SELECT id, po_number, po_status
         FROM purchase_orders
         WHERE linked_pr_id = ? AND is_deleted = FALSE AND po_status <> ?
         ORDER BY id DESC
         LIMIT 1`,
        [linked_pr_id, PO_STATUS.CANCELLED]
      );

      if (existingPoRows.length > 0) {
        const existingPo = existingPoRows[0];
        const existingStatus = normalizeProcurementStatus(existingPo.po_status);
        if (![PO_STATUS.DRAFT, PO_STATUS.VENDOR_ASSIGNED, PO_STATUS.OPEN].includes(existingStatus as any)) {
          throw new Error(`A PO already exists for this PR (${existingPo.po_number}) with status ${existingStatus}. Duplicate PO creation is blocked.`);
        }

        await connection.execute(
          `UPDATE purchase_orders
           SET vendor_id = ?, project_id = ?, procurement_type = ?, subtotal = 0, gst_total = 0, final_total = 0, po_status = ?, last_updated = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [vendor_id, finalProjectId, finalProcurementType, PO_STATUS.VENDOR_ASSIGNED, existingPo.id]
        );

        await connection.execute("DELETE FROM procurement_items WHERE parent_type = 'PO' AND parent_id = ?", [existingPo.id]);
        for (const item of items) {
          await connection.execute(
            `INSERT INTO procurement_items (parent_type, parent_id, inventory_id, item_name, quantity, received_quantity, approved_rate, gst_percent, tax_amount, total_amount, remarks)
             VALUES ('PO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [existingPo.id, item.inventory_id, item.item_name, item.quantity, 0, item.approved_rate || item.tentative_rate || 0, 0, 0, 0, item.remarks || '']
          );
        }

        console.log('[DEBUG] PO Reused Creation:', {
          poId: existingPo.id,
          linkedPrId: linked_pr_id,
          insertedItems: items,
          itemCount: items.length,
          parentType: 'PO'
        });

        await logProcurementAction(connection, 'PO', existingPo.id, 'UPDATED_FROM_APPROVED_PR', user, 'Existing draft PO synchronized from approved PR selection');
        if (existingStatus !== PO_STATUS.VENDOR_ASSIGNED) {
          await logStatusHistory(connection, 'PO', existingPo.id, existingStatus, PO_STATUS.VENDOR_ASSIGNED, user, 'Existing draft PO synchronized from approved PR selection');
        }

        await connection.commit();
        return res.status(200).json({
          id: existingPo.id,
          po_number: existingPo.po_number,
          message: 'Existing draft PO synchronized successfully',
          reused_existing_po: true
        });
      }
    }

    const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const [poResult]: any = await connection.execute(
      `INSERT INTO purchase_orders (po_number, vendor_id, project_id, procurement_type, linked_pr_id, subtotal, gst_total, final_total, po_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [poNumber, vendor_id, finalProjectId, finalProcurementType, linked_pr_id || null, 0, 0, 0, PO_STATUS.VENDOR_ASSIGNED, user.name || user.email]
    );
    const poId = poResult.insertId;

    for (const item of items) {
      await connection.execute(
        `INSERT INTO procurement_items (parent_type, parent_id, inventory_id, item_name, quantity, received_quantity, approved_rate, gst_percent, tax_amount, total_amount, remarks)
         VALUES ('PO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poId, item.inventory_id, item.item_name, item.quantity, 0, item.approved_rate || item.tentative_rate || 0, 0, 0, 0, item.remarks || '']
      );
    }

    console.log('[DEBUG] PO New Creation:', {
      poId: poId,
      linkedPrId: linked_pr_id || null,
      insertedItems: items,
      itemCount: items.length,
      parentType: 'PO'
    });

    await logProcurementAction(connection, 'PO', poId, 'CREATED', user, `PO created ${linked_pr_id ? 'from PR' : 'manually'}`);
    await logStatusHistory(connection, 'PO', poId, null, PO_STATUS.VENDOR_ASSIGNED, user, 'Vendor assigned for procurement communication');

    await connection.commit();
    res.status(201).json({ id: poId, po_number: poNumber, message: 'PO created successfully' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

api.put('/procurement/po/:id', authorizeAction('procurement', 'edit'), async (req, res) => {
  const user = (req as any).user as Session;
  const { id } = req.params;
  const { vendor_id, items, po_status } = req.body;

  if (!vendor_id || !items || !items.length) {
    return res.status(400).json({ error: 'Vendor and items are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [poRows]: any = await connection.execute('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [id]);
    if (poRows.length === 0) throw new Error('PO not found');
    const po = poRows[0];

    if (![PO_STATUS.DRAFT, PO_STATUS.VENDOR_ASSIGNED].includes(po.po_status)) {
      throw new Error('Only DRAFT or VENDOR_ASSIGNED purchase orders can be edited or sent to vendor');
    }

    // Check vendor changes
    const [oldVendorRows]: any = await connection.execute('SELECT vendor_name FROM vendors WHERE id = ?', [po.vendor_id]);
    const oldVendorName = oldVendorRows.length > 0 ? oldVendorRows[0].vendor_name : 'Unknown';

    const [newVendorRows]: any = await connection.execute('SELECT vendor_name FROM vendors WHERE id = ?', [vendor_id]);
    if (newVendorRows.length === 0) throw new Error('Selected vendor not found');
    const newVendorName = newVendorRows[0].vendor_name;

    const vendorChanged = po.vendor_id !== Number(vendor_id);
    const wasPlaceholder = oldVendorName === 'PLACEHOLDER VENDOR';

    // Update PO Header
    const newStatus = po_status || (vendor_id ? PO_STATUS.VENDOR_ASSIGNED : po.po_status);
    await connection.execute(
      `UPDATE purchase_orders 
       SET vendor_id = ?, subtotal = ?, gst_total = ?, final_total = ?, po_status = ?
       WHERE id = ?`,
      [vendor_id, 0, 0, 0, newStatus, id]
    );

    // Update PO Items
    await connection.execute("DELETE FROM procurement_items WHERE parent_type = 'PO' AND parent_id = ?", [id]);
    for (const item of items) {
      await connection.execute(
        `INSERT INTO procurement_items (parent_type, parent_id, inventory_id, item_name, quantity, received_quantity, approved_rate, gst_percent, tax_amount, total_amount, remarks)
         VALUES ('PO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, item.inventory_id, item.item_name, item.quantity, 0, item.approved_rate || item.tentative_rate || 0, 0, 0, 0, item.remarks || '']
      );
    }

    console.log('[DEBUG] PO Update:', {
      poId: id,
      linkedPrId: po.linked_pr_id,
      insertedItems: items,
      itemCount: items.length,
      parentType: 'PO'
    });

    // Trigger Notifications & Audit Logs for vendor changes
    if (vendorChanged) {
      if (wasPlaceholder) {
        console.log(`[NOTIFICATION] VENDOR ASSIGNED: Vendor ${newVendorName} (ID: ${vendor_id}) has been assigned to PO #${po.po_number} by ${user.email}`);
        await connection.execute(
          'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
          [user.email, 'VENDOR_ASSIGNED', JSON.stringify({ po_id: id, po_number: po.po_number, vendor_id, vendor_name: newVendorName })]
        );
        await logProcurementAction(connection, 'PO', Number(id), 'VENDOR_ASSIGNED', user, `Vendor assigned: ${newVendorName}`);
      } else {
        console.log(`[NOTIFICATION] VENDOR CHANGED: Vendor on PO #${po.po_number} changed from ${oldVendorName} to ${newVendorName} by ${user.email}`);
        await connection.execute(
          'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
          [user.email, 'VENDOR_CHANGED', JSON.stringify({ po_id: id, po_number: po.po_number, old_vendor: oldVendorName, new_vendor: newVendorName })]
        );
        await logProcurementAction(connection, 'PO', Number(id), 'VENDOR_CHANGED', user, `Vendor changed from ${oldVendorName} to ${newVendorName}`);
      }
    }

    if (vendorChanged) {
      await logStatusHistory(connection, 'PO', Number(id), po.po_status, PO_STATUS.VENDOR_ASSIGNED, user, `Vendor assigned: ${newVendorName}`);
    }

    // If sending PO to vendor (vendor communication, not accounting truth)
    const isFinalizing = [PO_STATUS.DRAFT, PO_STATUS.VENDOR_ASSIGNED].includes(po.po_status) && newStatus === PO_STATUS.SENT_TO_VENDOR;
    if (isFinalizing) {
      // Update linked PR status to CLOSED
      if (po.linked_pr_id) {
        await connection.execute(`UPDATE purchase_requests SET status = ? WHERE id = ?`, [PR_STATUS.CLOSED, po.linked_pr_id]);
        await logProcurementAction(connection, 'PR', po.linked_pr_id, 'CLOSED', user, 'PR closed when PO was sent to vendor');
        await logStatusHistory(connection, 'PR', po.linked_pr_id, PR_STATUS.APPROVED, PR_STATUS.CLOSED, user, 'Requirement intent closed after vendor communication');
        
        console.log(`[NOTIFICATION] PR CLOSED: PR ID #${po.linked_pr_id} status updated to CLOSED as PO #${po.po_number} has been finalized`);
      }

      console.log(`[NOTIFICATION] PO FINALIZED: Purchase Order PO #${po.po_number} has been finalized by ${user.email}`);
      await connection.execute(
        'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
        [user.email, 'PO_FINALIZED', JSON.stringify({ po_id: id, po_number: po.po_number })]
      );
      await logProcurementAction(connection, 'PO', Number(id), 'SENT_TO_VENDOR', user, 'PO finalized as vendor communication document');
      await logStatusHistory(connection, 'PO', Number(id), po.po_status, PO_STATUS.SENT_TO_VENDOR, user, 'PO_FINALIZED event: vendor communication document issued');
    } else {
      // Just a standard edit update
      await logProcurementAction(connection, 'PO', Number(id), 'EDITED', user, 'Draft PO updated');
    }

    await connection.commit();
    res.status(200).json({ message: 'PO updated successfully', po_status: newStatus });
  } catch (error: any) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

api.post('/procurement/po/:id/revise', authorizeAction('procurement', 'edit'), async (req, res) => {
  const user = (req as any).user as Session;
  const { id } = req.params;
  const { items, reason } = req.body;

  if (!items || !items.length || !reason) {
    return res.status(400).json({ error: 'Items and revision reason are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [poRows]: any = await connection.execute('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [id]);
    if (poRows.length === 0) throw new Error('PO not found');
    const po = poRows[0];

    if (po.po_status === PO_STATUS.CANCELLED) throw new Error('Cannot revise a cancelled PO');

    const [itemRows]: any = await connection.execute('SELECT * FROM procurement_items WHERE parent_type = "PO" AND parent_id = ?', [id]);
    const currentSnapshot = { ...po, items: itemRows };

    await connection.execute(
      'INSERT INTO purchase_order_revisions (po_id, revision_number, snapshot_json, reason, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, po.version, JSON.stringify(currentSnapshot), reason, user.name || user.email]
    );

    await connection.execute(
      'UPDATE purchase_orders SET subtotal = ?, gst_total = ?, final_total = ?, version = version + 1, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
      [0, 0, 0, id]
    );

    for (const newItem of items) {
      const existingItem = itemRows.find((i: any) => i.inventory_id == newItem.inventory_id);
      if (existingItem) {
        if (parseFloat(newItem.quantity) < parseFloat(existingItem.received_quantity)) {
          throw new Error(`Cannot reduce quantity for ${newItem.item_name} below already received amount (${existingItem.received_quantity})`);
        }
        await connection.execute(
          `UPDATE procurement_items SET quantity = ?, approved_rate = ?, gst_percent = ?, tax_amount = ?, total_amount = ?, remarks = ?
           WHERE id = ?`,
          [newItem.quantity, newItem.approved_rate || newItem.tentative_rate || 0, 0, 0, 0, newItem.remarks, existingItem.id]
        );
      } else {
        await connection.execute(
          `INSERT INTO procurement_items (parent_type, parent_id, inventory_id, item_name, quantity, approved_rate, gst_percent, tax_amount, total_amount, remarks)
           VALUES ('PO', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, newItem.inventory_id, newItem.item_name, newItem.quantity, newItem.approved_rate || newItem.tentative_rate || 0, 0, 0, 0, newItem.remarks]
        );
      }
    }

    const [remainingItems]: any = await connection.execute(
      'SELECT SUM(quantity - received_quantity) as remaining FROM procurement_items WHERE parent_type = "PO" AND parent_id = ?',
      [id]
    );
    const [receivedCount]: any = await connection.execute(
      'SELECT SUM(received_quantity) as received FROM procurement_items WHERE parent_type = "PO" AND parent_id = ?',
      [id]
    );
    
    let newStatus = po.po_status;
    if (parseFloat(receivedCount[0].received) > 0) {
      newStatus = parseFloat(remainingItems[0].remaining) <= 0.01 ? PO_STATUS.CLOSED : PO_STATUS.SENT_TO_VENDOR;
    } else {
      newStatus = PO_STATUS.SENT_TO_VENDOR;
    }
    
    await connection.execute('UPDATE purchase_orders SET po_status = ? WHERE id = ?', [newStatus, id]);

    await logProcurementAction(connection, 'PO', Number(id), 'REVISED', user, `PO revised (Rev ${po.version + 1}). Reason: ${reason}`);
    if (newStatus !== po.po_status) {
      await logStatusHistory(connection, 'PO', Number(id), po.po_status, newStatus, user, `PO revised. Reason: ${reason}`);
    }

    await connection.commit();
    res.status(200).json({ message: 'PO revised successfully', version: po.version + 1 });
  } catch (error: any) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

api.get('/procurement/po/:id/revisions', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM purchase_order_revisions WHERE po_id = ? ORDER BY revision_number DESC', [id]);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/procurement/po/:id/pdf', authorizeAction('procurement', 'export'), async (req, res) => {
  const { id } = req.params;
  try {
    const [poRows]: any = await pool.execute(
      `SELECT po.*, v.vendor_name, v.contact_person, v.phone, v.address, v.gst_number, p.name as project_name
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       JOIN projects p ON po.project_id = p.id
       WHERE po.id = ? AND po.is_deleted = FALSE`,
      [id]
    );
    if (poRows.length === 0) return res.status(404).json({ error: 'PO not found' });

    const [itemRows]: any = await pool.execute(
      `SELECT pi.*, inv.unit
       FROM procurement_items pi
       JOIN inventory inv ON pi.inventory_id = inv.id
       WHERE pi.parent_type = 'PO' AND pi.parent_id = ?`,
      [id]
    );

    const po = poRows[0];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=PO-${po.po_number}.pdf`);
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#1d4ed8').text('Satpura Infracon Pvt Ltd', { align: 'center' });
    doc.fontSize(10).fillColor('#475569').text('Purchase Order - Vendor Instruction Document', { align: 'center' });
    doc.moveDown(1.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cbd5e1').stroke();
    doc.moveDown(1.5);

    const topY = doc.y;
    doc.fillColor('#111827').fontSize(9);
    doc.font('Helvetica-Bold').text('Vendor: ', 50, topY, { continued: true }).font('Helvetica').text(po.vendor_name);
    doc.text(po.contact_person || '', 50, doc.y);
    doc.text(po.phone || '', 50, doc.y);
    doc.text(po.address || '', 50, doc.y, { width: 220 });
    if (po.gst_number) doc.text(`GST: ${po.gst_number}`, 50, doc.y);

    doc.font('Helvetica-Bold').text('PO Number: ', 350, topY, { continued: true }).font('Helvetica').text(po.po_number);
    doc.font('Helvetica-Bold').text('Project: ', 350, doc.y + 5, { continued: true }).font('Helvetica').text(po.project_name || '-');
    doc.font('Helvetica-Bold').text('Status: ', 350, doc.y + 5, { continued: true }).font('Helvetica').text(po.po_status);
    doc.font('Helvetica-Bold').text('Date: ', 350, doc.y + 5, { continued: true }).font('Helvetica').text(new Date(po.createdAt).toLocaleDateString());

    doc.moveDown(4);
    const tableTop = doc.y;
    doc.rect(50, tableTop - 5, 495, 20).fill('#eff6ff');
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(8);
    doc.text('ITEM', 55, tableTop);
    doc.text('EXPECTED QTY', 255, tableTop);
    doc.text('TENTATIVE RATE', 355, tableTop);
    doc.text('REMARKS', 455, tableTop);

    let y = tableTop + 25;
    doc.fillColor('#111827').font('Helvetica').fontSize(9);
    for (const item of itemRows) {
      if (y > 710) { doc.addPage(); y = 50; }
      doc.text(item.item_name, 55, y, { width: 190 });
      doc.text(`${item.quantity} ${item.unit || ''}`, 255, y);
      doc.text(`INR ${parseFloat(item.approved_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 355, y);
      doc.text(item.remarks || '-', 455, y, { width: 90 });
      y += 24;
      doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#e5e7eb').stroke();
    }

    y += 20;
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(9).text('Delivery Terms:', 50, y);
    doc.font('Helvetica').text('Material to be supplied as per site/store instructions. Rates shown are tentative procurement expectations only.', 50, y + 14, { width: 495 });

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b')
      .text('Instruction Document - Not Final Accounting Truth', 50, 760, { align: 'center', width: 495 });

    doc.end();
  } catch (error: any) {
    console.error('PO PDF Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// WORK ORDER MODULE — DECOMMISSIONED
// Business Decision: SIPL procurement workflow finalized as PR→CEO Approval→PO→GRN→Inventory→MIV
// Historical work_orders table preserved in database for audit recoverability.
// ═══════════════════════════════════════════════════════════════

api.get('/procurement/wo', requireAuth, async (_req, res) => {
  return res.status(410).json({
    error: 'WORK_ORDER_MODULE_DECOMMISSIONED',
    message: 'The Work Order module has been formally retired from the SIPL ERP. Historical records are preserved in the database. The active procurement workflow is: PR → CEO Approval → PO → GRN → Inventory → MIV.'
  });
});

api.post('/procurement/wo', requireAuth, async (_req, res) => {
  return res.status(410).json({
    error: 'WORK_ORDER_MODULE_DECOMMISSIONED',
    message: 'Creation of new Work Orders is disabled. The SIPL procurement chain no longer requires Work Orders.'
  });
});

api.put('/procurement/wo/:id', requireAuth, async (_req, res) => {
  return res.status(410).json({
    error: 'WORK_ORDER_MODULE_DECOMMISSIONED',
    message: 'Work Order modifications are disabled. The module has been formally retired.'
  });
});

api.delete('/procurement/wo/:id', requireAuth, async (_req, res) => {
  return res.status(410).json({
    error: 'WORK_ORDER_MODULE_DECOMMISSIONED',
    message: 'Work Order operations are disabled. The module has been formally retired.'
  });
});

api.all('/procurement/wo/:id', requireAuth, async (_req, res) => {
  return res.status(410).json({ error: 'WORK_ORDER_MODULE_DECOMMISSIONED' });
});

api.put('/procurement/wo', requireAuth, async (_req, res) => {
  return res.status(410).json({ error: 'WORK_ORDER_MODULE_DECOMMISSIONED' });
});

api.all('/procurement/wo/:id/status', requireAuth, async (_req, res) => {
  return res.status(410).json({ error: 'WORK_ORDER_MODULE_DECOMMISSIONED' });
});

api.all('/procurement/wo/:id/approve', requireAuth, async (_req, res) => {
  return res.status(410).json({ error: 'WORK_ORDER_MODULE_DECOMMISSIONED' });
});

api.all('/procurement/wo/:id/approval', requireAuth, async (_req, res) => {
  return res.status(410).json({ error: 'WORK_ORDER_MODULE_DECOMMISSIONED' });
});

// 4. PROCUREMENT AUDIT

api.get('/procurement/audit', authorizeAction('procurement', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT *
      FROM procurement_audit_logs
      WHERE entity_type IN ('PR', 'PO')
      ORDER BY createdAt DESC
      LIMIT 500
    `);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

api.post('/grns', authorizeAction('grn', 'create'), async (req, res) => {
  const user = (req as any).user as Session;
  const { 
    grn_number, vendorName, projectId, destination_type, grn_date, 
    items, remarks, created_by, gstNumber, discountType, 
    discountValue, transportCharges, otherCharges, finalAmount,
    po_id, is_emergency, emergency_reason
  } = req.body;

  if (!grn_date || !items || !items.length) {
    return res.status(400).json({ error: 'Date and items are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 🛡️ PROCUREMENT GOVERNANCE VALIDATION
    let po: any = null;
    if (po_id) {
      const [poRows]: any = await connection.execute('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [po_id]);
      if (poRows.length === 0) throw new Error('Purchase Order not found');
      po = poRows[0];
      if ([PO_STATUS.DRAFT, PO_STATUS.CLOSED, PO_STATUS.FULFILLED, PO_STATUS.CANCELLED].includes(po.po_status)) {
        throw new Error(`Cannot create GRN against a ${po.po_status} PO`);
      }
      
      const [vendorRows]: any = await connection.execute('SELECT vendor_name FROM vendors WHERE id = ?', [po.vendor_id]);
      const poVendorName = vendorRows[0]?.vendor_name;
      
      if (vendorName && vendorName !== poVendorName) {
        throw new Error(`Vendor mismatch. PO ${po.po_number} is for ${poVendorName}`);
      }

      for (const item of items) {
        const [poItemRows]: any = await connection.execute(
          'SELECT * FROM procurement_items WHERE parent_type = "PO" AND parent_id = ? AND inventory_id = ?',
          [po_id, item.inventory_id]
        );
        if (poItemRows.length === 0) throw new Error(`Item ${item.item_name} is not part of PO ${po.po_number}`);
        
        const poItem = poItemRows[0];
        const pendingQty = parseFloat(poItem.quantity) - parseFloat(poItem.received_quantity || 0);
        if (parseFloat(item.quantity) > (pendingQty + 0.01)) { // Small tolerance for rounding
          throw new Error(`Quantity exceeds PO limit for ${item.item_name}. Pending: ${pendingQty}`);
        }

        // Note: Rate override approval logic is governed by GRN Create permission.
      }
    } else {
      if (!is_emergency) {
        throw new Error('Controlled Procurement Violation: PO reference is mandatory. Use Emergency Mode if required.');
      }
      if (!emergency_reason || emergency_reason.trim().length < 5) {
        throw new Error('Valid emergency justification is mandatory for manual GRN creation.');
      }
    }

    const subtotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.totalAmount) || (parseFloat(item.quantity) * parseFloat(item.rate)) || 0), 0);
    const discAmt = (discountType === 'PERCENTAGE') ? (subtotal * (parseFloat(discountValue) || 0) / 100) : (parseFloat(discountValue) || 0);
    const computedFinalAmount = finalAmount != null ? finalAmount : Math.max(0, subtotal - discAmt + (parseFloat(transportCharges) || 0) + (parseFloat(otherCharges) || 0));

    const [grnResult]: any = await connection.execute(
      `INSERT INTO grns (grn_number, po_id, is_emergency, emergency_reason, vendorName, projectId, destination_type, grn_date, total_amount, remarks, created_by, gstNumber, discountType, discountValue, finalAmount, transportCharges, otherCharges, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [grn_number, po_id || null, is_emergency ? 1 : 0, emergency_reason || null, vendorName || null, projectId || null, destination_type || 'CENTRAL_STORE', grn_date, subtotal, remarks || '', created_by, gstNumber || null, discountType || null, parseFloat(discountValue) || 0, computedFinalAmount, parseFloat(transportCharges) || 0, parseFloat(otherCharges) || 0, GRN_STATUS.POSTED]
    );
    const grnId = grnResult.insertId;

    let projectName = '';
    if (projectId) {
      const [projRows]: any = await connection.execute('SELECT name FROM projects WHERE id = ?', [projectId]);
      if (projRows.length > 0) projectName = projRows[0].name;
    }

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const rate = parseFloat(item.rate);
      const itemTotal = parseFloat(item.totalAmount) || (qty * rate) || 0;
      const highPrecisionRate = qty > 0 ? (itemTotal / qty) : rate;

      await connection.execute(
        `INSERT INTO grn_items (grn_id, inventory_id, item_name, quantity, rate, total) VALUES (?, ?, ?, ?, ?, ?)`,
        [grnId, item.inventory_id, item.item_name, qty, highPrecisionRate, itemTotal]
      );

      if (po_id) {
        await connection.execute(
          'UPDATE procurement_items SET received_quantity = received_quantity + ? WHERE parent_type = "PO" AND parent_id = ? AND inventory_id = ?',
          [qty, po_id, item.inventory_id]
        );
      }

      if (destination_type === 'DIRECT_PROJECT' || (destination_type === 'CENTRAL_STORE' && projectName)) {
        if (destination_type === 'DIRECT_PROJECT') {
          await connection.execute(
            `INSERT INTO material_issues (inventory_id, item_name, quantity_issued, total_cost, batch_details, grn_id, issue_source, project_id, project_name, issued_to, issued_by, issue_date, remarks)
             VALUES (?, ?, ?, ?, ?, ?, 'DIRECT_PURCHASE', ?, ?, ?, ?, ?, ?)`,
            [item.inventory_id, item.item_name, qty, itemTotal, '[]', grnId, projectId || null, projectName, 'Direct to Site', created_by, grn_date, `Direct Project Purchase via GRN: ${grn_number}`]
          );
        } else {
          await connection.execute(
            `INSERT INTO inventory_batches (inventory_id, grn_id, batch_number, quantity_received, quantity_remaining, total_value_received, total_value_remaining, unit_price, received_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.inventory_id, grnId, grn_number, qty, qty, itemTotal, itemTotal, highPrecisionRate, grn_date]
          );
          const [batches]: any = await connection.execute(
            'SELECT * FROM inventory_batches WHERE inventory_id = ? AND quantity_remaining > 0 AND is_void = FALSE ORDER BY received_date ASC, id ASC FOR UPDATE',
            [item.inventory_id]
          );
          let remainingToIssue = qty;
          let totalCostOfIssue = 0;
          const usedBatches = [];
          for (const batch of batches) {
            if (remainingToIssue <= 0) break;
            const batchQtyRemaining = parseFloat(batch.quantity_remaining);
            const batchValueRemaining = parseFloat(batch.total_value_remaining);
            const qtyFromThisBatch = Math.min(remainingToIssue, batchQtyRemaining);
            let costFromThisBatch = qtyFromThisBatch === batchQtyRemaining ? batchValueRemaining : (qtyFromThisBatch * parseFloat(batch.unit_price));
            totalCostOfIssue += costFromThisBatch;
            remainingToIssue -= qtyFromThisBatch;
            await connection.execute(
              'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ?, total_value_remaining = total_value_remaining - ? WHERE id = ?',
              [qtyFromThisBatch, costFromThisBatch, batch.id]
            );
            usedBatches.push({ batch_id: batch.id, batch_number: batch.batch_number, quantity: qtyFromThisBatch, unit_price: batch.unit_price });
          }
          await connection.execute(
            `INSERT INTO material_issues (inventory_id, item_name, quantity_issued, total_cost, batch_details, grn_id, issue_source, project_id, project_name, issued_to, issued_by, issue_date, remarks)
             VALUES (?, ?, ?, ?, ?, ?, 'FIFO_ISSUE', ?, ?, ?, ?, ?, ?)`,
            [item.inventory_id, item.item_name, qty, totalCostOfIssue, JSON.stringify(usedBatches), grnId, projectId || null, projectName, 'Direct to Site', created_by, grn_date, `Auto-Issued via GRN: ${grn_number}`]
          );
        }
        await syncInventoryFromBatches(connection, item.inventory_id);
      } else {
        await connection.execute(
          `INSERT INTO inventory_batches (inventory_id, grn_id, batch_number, quantity_received, quantity_remaining, total_value_received, total_value_remaining, unit_price, received_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.inventory_id, grnId, grn_number, qty, qty, itemTotal, itemTotal, highPrecisionRate, grn_date]
        );
        await syncInventoryFromBatches(connection, item.inventory_id);
      }
    }

    if (po_id) {
      const [remainingItems]: any = await connection.execute(
        'SELECT SUM(quantity - COALESCE(received_quantity, 0)) as remaining FROM procurement_items WHERE parent_type = "PO" AND parent_id = ?',
        [po_id]
      );
      const isFulfilled = parseFloat(remainingItems[0].remaining || 0) <= 0.01;
      await connection.execute(
        'UPDATE purchase_orders SET po_status = ? WHERE id = ?',
        [isFulfilled ? PO_STATUS.CLOSED : PO_STATUS.SENT_TO_VENDOR, po_id]
      );
      await logProcurementAction(connection, 'PO', po_id, 'GRN_POSTED', user, `GRN ${grn_number} posted. PO status: ${isFulfilled ? 'CLOSED' : 'SENT_TO_VENDOR'}`);
      await logStatusHistory(connection, 'PO', po_id, po.po_status, isFulfilled ? PO_STATUS.CLOSED : PO_STATUS.SENT_TO_VENDOR, user, `GRN_POSTED event reconciled PO`);
    }

    if (is_emergency) {
      await logProcurementAction(connection, 'PO', 0, 'EMERGENCY_GRN', user, `Emergency Manual GRN ${grn_number} created. Reason: ${emergency_reason}`);
    }

    await logStatusHistory(connection, 'GRN', grnId, null, GRN_STATUS.POSTED, user, 'GRN_POSTED event created inventory batches and FIFO valuation');

    await connection.commit();
    res.status(201).json({ id: grnId, grn_number, message: 'GRN created and stock updated successfully' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('GRN Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

api.post('/grns/:id/cancel', authorizeAction('grn', 'cancel'), async (req, res) => {
  const { id } = req.params;
  const { reason, cancelled_by } = req.body;

  if (!reason || !cancelled_by) {
    return res.status(400).json({ error: 'Cancellation reason and user required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify status and fetch destination_type
    const [grnRows]: any = await connection.execute(
      'SELECT status, grn_number, destination_type, po_id FROM grns WHERE id = ? FOR UPDATE', 
      [id]
    );
    if (grnRows.length === 0) throw new Error('GRN not found');
    if (![GRN_STATUS.ACTIVE, GRN_STATUS.POSTED].includes(grnRows[0].status)) throw new Error('Only POSTED GRNs can be cancelled');

    const { grn_number, destination_type, po_id } = grnRows[0];

    // 2. USAGE LOCK RULE: Only applies to CENTRAL_STORE
    if (destination_type === 'CENTRAL_STORE' && await isGrnUsed(connection, id)) {
      throw new Error('Cannot cancel GRN: Items from this warehouse receipt have already been partially or fully issued.');
    }

    // 3. REVERSAL LOGIC
    if (destination_type === 'DIRECT_PROJECT') {
      await connection.execute(
        'UPDATE material_issues SET is_deleted = TRUE WHERE grn_id = ?',
        [id]
      );
    } else {
      await connection.execute(
        'UPDATE inventory_batches SET is_void = TRUE WHERE grn_id = ?',
        [id]
      );
      await connection.execute(
        'UPDATE material_issues SET is_deleted = TRUE WHERE grn_id = ?',
        [id]
      );

      const [batches]: any = await connection.execute(
        'SELECT DISTINCT inventory_id FROM inventory_batches WHERE grn_id = ?',
        [id]
      );
      for (const batch of batches) {
        await syncInventoryFromBatches(connection, batch.inventory_id);
      }
    }

    // 4. Update GRN status
    await connection.execute(
      `UPDATE grns SET status = 'CANCELLED', cancelled_by = ?, cancellation_reason = ?, cancelled_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [cancelled_by, reason, id]
    );

    // 5. 🛡️ PROCUREMENT REVERSAL (Governance Reconciliation)
    if (po_id) {
      const [grnItems]: any = await connection.execute('SELECT inventory_id, quantity FROM grn_items WHERE grn_id = ?', [id]);
      for (const item of grnItems) {
        await connection.execute(
          'UPDATE procurement_items SET received_quantity = received_quantity - ? WHERE parent_type = "PO" AND parent_id = ? AND inventory_id = ?',
          [item.quantity, po_id, item.inventory_id]
        );
      }
      
      const [remainingItems]: any = await connection.execute(
        'SELECT SUM(quantity - received_quantity) as remaining FROM procurement_items WHERE parent_type = "PO" AND parent_id = ?',
        [po_id]
      );
      const [receivedCount]: any = await connection.execute(
        'SELECT SUM(received_quantity) as received FROM procurement_items WHERE parent_type = "PO" AND parent_id = ?',
        [po_id]
      );
      
      let newStatus: string = PO_STATUS.SENT_TO_VENDOR;
      if (parseFloat(receivedCount[0].received) > 0) {
        newStatus = parseFloat(remainingItems[0].remaining) <= 0.01 ? PO_STATUS.CLOSED : PO_STATUS.SENT_TO_VENDOR;
      }
      
      await connection.execute('UPDATE purchase_orders SET po_status = ? WHERE id = ?', [newStatus, po_id]);
      await logProcurementAction(connection, 'PO', po_id, 'GRN_CANCELLED', (req as any).user, `GRN ${grn_number} cancelled. PO status reconciled to ${newStatus}`);
      await logStatusHistory(connection, 'PO', po_id, grnRows[0].po_status || null, newStatus, (req as any).user, `GRN ${grn_number} cancelled`);
    }

    await logStatusHistory(connection, 'GRN', Number(id), grnRows[0].status, GRN_STATUS.CANCELLED, (req as any).user, reason);

    await connection.commit();
    res.status(200).json({ message: 'GRN successfully cancelled and associated records reversed.' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('GRN Cancellation Error:', error);
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// GRN Edit History API
// ═══════════════════════════════════════════════════════════════
api.get('/grn-edit-history', authorizeAction('grn', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const p = parseInt(String(page), 10);
    const l = parseInt(String(limit), 10);
    const offset = (p - 1) * l;

    let filter = '';
    const params: any[] = [];
    if (search) {
      filter = ' WHERE grn_number LIKE ? OR edited_by LIKE ? OR edit_reason LIKE ? ';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM grn_edit_history ${filter}`,
      params
    );
    const total = countRows?.[0]?.total || 0;

    const [rows]: any = await pool.execute(
      `SELECT * FROM grn_edit_history ${filter} ORDER BY edited_at DESC LIMIT ${l} OFFSET ${offset}`,
      params
    );

    res.status(200).json({
      data: rows || [],
      total,
      page: p,
      totalPages: Math.ceil(total / l)
    });
  } catch (error: any) {
    console.error('History API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

api.put('/grns/:id', authorizeAction('grn', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { 
    vendorName, projectId, destination_type, grn_date, items, remarks, 
    edited_by, edit_reason, gstNumber, discountType, 
    discountValue, transportCharges, otherCharges 
  } = req.body;

  if (!grn_date || !items || !items.length || !edit_reason) {
    return res.status(400).json({ error: 'Missing required fields or edit reason' });
  }

  // 🔒 Operational Safety Lock: Direct project assignments are permitted based on standard GRN Edit permissions.

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get original GRN state
    const [oldGrnRows]: any = await connection.execute(
      'SELECT * FROM grns WHERE id = ? FOR UPDATE', 
      [id]
    );
    if (oldGrnRows.length === 0) throw new Error('GRN not found');
    if (oldGrnRows[0].status !== 'ACTIVE') throw new Error('Only ACTIVE GRNs can be edited');

    const oldGrn = oldGrnRows[0];
    const grnNumber = oldGrn.grn_number;

    // 🕵️ AUDIT PREPARATION: Fetch original items for snapshot
    const [oldItemsForSnapshot]: any = await connection.execute('SELECT * FROM grn_items WHERE grn_id = ?', [id]);
    const oldSnapshot = { ...oldGrn, items: oldItemsForSnapshot };

    // 2. CHECK USAGE STATUS (Metadata-Only Logic)
    const isUsed = await isGrnUsed(connection, id);

    if (isUsed) {
      // 🛡️ RULE: If material is issued, block financial mutations
      const [oldItemsRows]: any = await connection.execute('SELECT inventory_id, quantity, rate FROM grn_items WHERE grn_id = ?', [id]);
      
      if (items.length !== oldItemsRows.length) {
        throw new Error('Cannot change number of items for a GRN that is already partially issued.');
      }

      const financialsChanged = 
        oldGrn.discountType !== (discountValue > 0 ? discountType : null) ||
        parseFloat(oldGrn.discountValue || 0) !== (discountValue > 0 ? parseFloat(discountValue) : 0) ||
        parseFloat(oldGrn.transportCharges || 0) !== parseFloat(transportCharges || 0) ||
        parseFloat(oldGrn.otherCharges || 0) !== parseFloat(otherCharges || 0);

      if (financialsChanged) {
        throw new Error('Cannot edit financial values (discounts, charges) for a GRN that is already partially issued.');
      }

      for (const newItem of items) {
        const oldItem = oldItemsRows.find((oi: any) => oi.inventory_id === parseInt(newItem.inventory_id));
        if (!oldItem) throw new Error(`Item ${newItem.item_name} mutation not allowed.`);
        if (parseFloat(oldItem.quantity) !== parseFloat(newItem.quantity) || parseFloat(oldItem.rate) !== parseFloat(newItem.rate)) {
          throw new Error(`Cannot change quantity or rate for item ${newItem.item_name} (Already Issued).`);
        }
      }

      await connection.execute(
        `UPDATE grns SET vendorName = ?, gstNumber = ?, grn_date = ?, remarks = ?, edited_by = ?, edit_reason = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [vendorName || null, gstNumber || null, grn_date, remarks || '', edited_by, edit_reason, id]
      );
      await connection.execute('UPDATE inventory_batches SET received_date = ? WHERE grn_id = ?', [grn_date, id]);

    } else {
      // 🚀 FULL REVERSAL MODE
      await connection.execute('UPDATE inventory_batches SET is_void = TRUE WHERE grn_id = ?', [id]);
      await connection.execute('UPDATE material_issues SET is_deleted = TRUE WHERE grn_id = ?', [id]);

      const totalAmount = items.reduce((acc: number, item: any) => acc + (parseFloat(item.totalAmount) || (parseFloat(item.quantity) * parseFloat(item.rate)) || 0), 0);
      const discAmt = (discountType === 'PERCENTAGE') ? (totalAmount * (parseFloat(discountValue) || 0) / 100) : (parseFloat(discountValue) || 0);
      const computedFinalAmount = Math.max(0, totalAmount - discAmt + (parseFloat(transportCharges) || 0) + (parseFloat(otherCharges) || 0));

      let projectName = '';
      if (projectId) {
        const [projRows]: any = await connection.execute('SELECT name FROM projects WHERE id = ?', [projectId]);
        if (projRows.length > 0) projectName = projRows[0].name;
      }

      const [oldItems]: any = await connection.execute('SELECT inventory_id FROM grn_items WHERE grn_id = ?', [id]);
      const affectedInvIds = new Set<number>();
      oldItems.forEach((i: any) => affectedInvIds.add(i.inventory_id));
      items.forEach((i: any) => affectedInvIds.add(i.inventory_id));

      await connection.execute('DELETE FROM grn_items WHERE grn_id = ?', [id]);

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const rate = parseFloat(item.rate);
        const itemTotal = parseFloat(item.totalAmount) || (qty * rate) || 0;
        const highPrecisionRate = qty > 0 ? (itemTotal / qty) : rate;

        await connection.execute(
          `INSERT INTO grn_items (grn_id, inventory_id, item_name, quantity, rate, total) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, item.inventory_id, item.item_name, qty, highPrecisionRate, itemTotal]
        );

        if (destination_type === 'DIRECT_PROJECT' || (destination_type === 'CENTRAL_STORE' && projectName)) {
          const usedBatches = [];
          if (destination_type === 'DIRECT_PROJECT') {
            await connection.execute(
              `INSERT INTO material_issues (inventory_id, item_name, quantity_issued, total_cost, batch_details, grn_id, issue_source, project_id, project_name, issued_to, issued_by, issue_date, remarks)
               VALUES (?, ?, ?, ?, ?, ?, 'DIRECT_PURCHASE', ?, ?, ?, ?, ?, ?)`,
              [item.inventory_id, item.item_name, qty, itemTotal, '[]', id, projectId || null, projectName, 'Direct to Site', edited_by, grn_date, `Direct Purchase (Edited)`]
            );
          } else {
            await connection.execute(
              `INSERT INTO inventory_batches (inventory_id, grn_id, batch_number, quantity_received, quantity_remaining, total_value_received, total_value_remaining, unit_price, received_date, is_void)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
              [item.inventory_id, id, grnNumber, qty, qty, itemTotal, itemTotal, highPrecisionRate, grn_date]
            );

            const [batches]: any = await connection.execute(
              'SELECT * FROM inventory_batches WHERE inventory_id = ? AND quantity_remaining > 0 AND is_void = FALSE ORDER BY received_date ASC, id ASC FOR UPDATE',
              [item.inventory_id]
            );

            let rem = qty;
            for (const b of batches) {
              if (rem <= 0) break;
              const q = Math.min(rem, parseFloat(b.quantity_remaining));
              const c = q === parseFloat(b.quantity_remaining) ? parseFloat(b.total_value_remaining) : (q * parseFloat(b.unit_price));
              rem -= q;
              await connection.execute('UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ?, total_value_remaining = total_value_remaining - ? WHERE id = ?', [q, c, b.id]);
              usedBatches.push({ batch_id: b.id, batch_number: b.batch_number, quantity: q, unit_price: b.unit_price });
            }

            await connection.execute(
              `INSERT INTO material_issues (inventory_id, item_name, quantity_issued, total_cost, batch_details, grn_id, issue_source, project_id, project_name, issued_to, issued_by, issue_date, remarks)
               VALUES (?, ?, ?, ?, ?, ?, 'FIFO_ISSUE', ?, ?, ?, ?, ?, ?)`,
              [item.inventory_id, item.item_name, qty, itemTotal, JSON.stringify(usedBatches), id, projectId || null, projectName, 'Direct to Site', edited_by, grn_date, `Auto-Issued (Edited)`]
            );
          }
        } else {
          await connection.execute(
            `INSERT INTO inventory_batches (inventory_id, grn_id, batch_number, quantity_received, quantity_remaining, total_value_received, total_value_remaining, unit_price, received_date, is_void)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
            [item.inventory_id, id, grnNumber, qty, qty, itemTotal, itemTotal, highPrecisionRate, grn_date]
          );
        }
      }

      for (const invId of affectedInvIds) {
        await syncInventoryFromBatches(connection, invId);
      }

      await connection.execute(
        `UPDATE grns SET vendorName = ?, gstNumber = ?, projectId = ?, destination_type = ?, grn_date = ?, total_amount = ?, remarks = ?, discountType = ?, discountValue = ?, finalAmount = ?, transportCharges = ?, otherCharges = ?, edited_by = ?, edit_reason = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [vendorName || null, gstNumber || null, projectId || null, destination_type || 'CENTRAL_STORE', grn_date, totalAmount, remarks || '', discountType || null, parseFloat(discountValue) || 0, computedFinalAmount, parseFloat(transportCharges) || 0, parseFloat(otherCharges) || 0, edited_by, edit_reason, id]
      );
    }

    // 🛡️ ERP GOVERNANCE: Mandatory Audit Trail
    console.log(`🕵️ [AUDIT_TRACE] Entering audit phase for GRN ${grnNumber} (ID: ${id})`);
    
    const subtotalSnapshot = items.reduce((acc: number, item: any) => acc + (parseFloat(item.totalAmount) || (parseFloat(item.quantity) * parseFloat(item.rate)) || 0), 0);
    const discAmtSnapshot = (discountType === 'PERCENTAGE') ? (subtotalSnapshot * (parseFloat(discountValue) || 0) / 100) : (parseFloat(discountValue) || 0);
    const finalAmtSnapshot = Math.max(0, subtotalSnapshot - discAmtSnapshot + (parseFloat(transportCharges) || 0) + (parseFloat(otherCharges) || 0));

    const newSnapshot = { 
      vendorName, projectId, destination_type, grn_date, items, remarks, 
      gstNumber, discountType, discountValue, transportCharges, otherCharges,
      total_amount: subtotalSnapshot, finalAmount: finalAmtSnapshot
    };

    console.log(`🕵️ [AUDIT_TRACE] Snapshots serialized. Sizes: Old=${JSON.stringify(oldSnapshot).length}, New=${JSON.stringify(newSnapshot).length}`);
    console.log(`🕵️ [AUDIT_TRACE] Reason Flow: edited_by="${edited_by}", edit_reason="${edit_reason}"`);

    try {
      if (!edit_reason || edit_reason.trim().length < 3) {
        throw new Error('Audit governance failure: A valid edit reason is mandatory for all GRN corrections.');
      }

      const [auditResult]: any = await connection.execute(
        `INSERT INTO grn_edit_history (grn_id, grn_number, old_snapshot, new_snapshot, edited_by, edit_reason) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, grnNumber, JSON.stringify(oldSnapshot), JSON.stringify(newSnapshot), edited_by || 'Unknown', edit_reason]
      );
      console.log(`✅ [AUDIT_TRACE] Persistence successful. History ID: ${auditResult.insertId}`);
    } catch (auditErr: any) {
      console.error(`❌ [AUDIT_TRACE] PERSISTENCE FAILURE: ${auditErr.message}`);
      // ATOMICITY: Rollback everything if audit fails
      throw new Error(`Critical Governance Error: Audit trail could not be persisted. Reason: ${auditErr.message}. The transaction has been aborted.`);
    }

    console.log('⚖️ [AUDIT_TRACE] All checks passed. Committing transaction...');
    await connection.commit();
    console.log('🏁 [AUDIT_TRACE] GRN Edit + Audit Trail persisted atomically.');
    res.status(200).json({ message: 'GRN successfully updated with mandatory audit trail.' });
  } catch (error: any) {
    if (connection) {
      console.log(`⚠️ [AUDIT_TRACE] TRANSACTION ROLLBACK: ${error.message}`);
      await connection.rollback();
    }
    console.error('❌ [AUDIT_TRACE] PUT Route Error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// ERP REPORTS MODULE APIs
// ═══════════════════════════════════════════════════════════════

/**
 * 1. INVENTORY LEDGER REPORT
 * Purpose: Complete stock movement tracking with running balance and valuation.
 */
api.get('/reports/inventory-ledger', authorizeAction('reports', 'view'), async (req, res) => {
  const { inventory_id, from_date, to_date, project_id } = req.query;
  
  if (!inventory_id) return res.status(400).json({ error: 'Item selection (inventory_id) is required for Ledger' });

  try {
    // 1. Fetch Inward Transactions (Batches)
    let inwardQuery = `
      SELECT 
        received_date as date, 
        'INWARD' as type, 
        CASE WHEN batch_number = 'MANUAL_ADD' THEN 'ADJUSTMENT' ELSE 'GRN' END as ref_type,
        batch_number as ref_no,
        quantity_received as qty_in,
        0 as qty_out,
        total_value_received as value_change,
        NULL as project_name
      FROM inventory_batches 
      WHERE inventory_id = ? AND is_void = FALSE
    `;
    const inwardParams: any[] = [inventory_id];

    // 2. Fetch Outward Transactions (Issues)
    let outwardQuery = `
      SELECT 
        issue_date as date, 
        'OUTWARD' as type, 
        'ISSUE' as ref_type,
        COALESCE(grn_number, 'MANUAL') as ref_no,
        0 as qty_in,
        quantity_issued as qty_out,
        -total_cost as value_change,
        project_name
      FROM material_issues 
      WHERE inventory_id = ? AND is_deleted = FALSE
    `;
    const outwardParams: any[] = [inventory_id];

    if (project_id) {
      outwardQuery += ` AND project_id = ? `;
      outwardParams.push(project_id);
    }

    // 3. Combine and Sort
    const combinedQuery = `
      SELECT * FROM (${inwardQuery} UNION ALL ${outwardQuery}) as movements
      ORDER BY date ASC, type DESC
    `;
    
    const [rows]: any = await pool.execute(combinedQuery, [...inwardParams, ...outwardParams]);

    // 4. Calculate Running Balances and Valuation (Done in Node.js to preserve high precision)
    let runningBalance = 0;
    let runningValue = 0;
    
    const ledger = rows.map((row: any) => {
      runningBalance += (parseFloat(row.qty_in) - parseFloat(row.qty_out));
      runningValue += parseFloat(row.value_change);
      
      return {
        ...row,
        running_balance: runningBalance,
        inventory_value: runningValue
      };
    });

    // 5. Apply Date Filters after calculation if requested (to keep running totals accurate)
    let finalLedger = ledger;
    if (from_date) {
      finalLedger = finalLedger.filter((item: any) => item.date >= from_date);
    }
    if (to_date) {
      finalLedger = finalLedger.filter((item: any) => item.date <= to_date);
    }

    res.status(200).json(finalLedger);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. GRN REGISTER REPORT
 * Purpose: Procurement and inward register.
 */
api.get('/reports/grn-register', authorizeAction('reports', 'view'), async (req, res) => {
  const { from_date, to_date, vendor, project_id, inventory_id } = req.query;

  try {
    let query = `
      SELECT 
        g.grn_number,
        g.vendorName as vendor_name,
        g.gstNumber,
        g.grn_date,
        gi.item_name,
        gi.quantity,
        gi.rate as unit_rate,
        gi.total as taxable_value,
        g.finalAmount as total_amount,
        g.created_by,
        p.name as project_name
      FROM grns g
      JOIN grn_items gi ON g.id = gi.grn_id
      LEFT JOIN projects p ON g.projectId = p.id
      WHERE g.is_deleted = FALSE AND COALESCE(g.status, 'POSTED') IN ('ACTIVE', 'POSTED')
    `;
    const params: any[] = [];

    if (from_date) { query += ` AND g.grn_date >= ? `; params.push(from_date); }
    if (to_date) { query += ` AND g.grn_date <= ? `; params.push(to_date); }
    if (vendor) { query += ` AND g.vendorName = ? `; params.push(vendor); }
    if (project_id) { query += ` AND g.projectId = ? `; params.push(project_id); }
    if (inventory_id) { query += ` AND gi.inventory_id = ? `; params.push(inventory_id); }

    query += ` ORDER BY g.grn_date DESC, g.grn_number DESC `;

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. MATERIAL CONSUMPTION REPORT
 * Purpose: Track project-wise material consumption with procurement lineage.
 */
/**
 * 5. PROCUREMENT REGISTER REPORT
 * Purpose: Full visibility into authorized vs received procurement values.
 */
api.get('/reports/procurement-register', authorizeAction('reports', 'view'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        po.po_number,
        po.createdAt as po_date,
        v.vendor_name,
        p.name as project_name,
        pi.item_name,
        pi.quantity as authorized_qty,
        pi.received_quantity,
        (pi.quantity - pi.received_quantity) as pending_qty,
        pi.approved_rate as tentative_rate,
        (pi.quantity * pi.approved_rate) as tentative_value,
        COALESCE(grn_actual.actual_value, 0) as grn_actual_value,
        po.po_status,
        po.version
      FROM purchase_orders po
      JOIN procurement_items pi ON pi.parent_type = 'PO' AND pi.parent_id = po.id
      JOIN vendors v ON po.vendor_id = v.id
      JOIN projects p ON po.project_id = p.id
      LEFT JOIN (
        SELECT g.po_id, gi.inventory_id, SUM(gi.total) as actual_value
        FROM grns g
        JOIN grn_items gi ON gi.grn_id = g.id
        WHERE g.is_deleted = FALSE AND COALESCE(g.status, 'POSTED') IN ('ACTIVE', 'POSTED')
        GROUP BY g.po_id, gi.inventory_id
      ) grn_actual ON grn_actual.po_id = po.id AND grn_actual.inventory_id = pi.inventory_id
      WHERE po.is_deleted = FALSE
      ORDER BY po.createdAt DESC, pi.id ASC
    `);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. MATERIAL CONSUMPTION REPORT
 * Purpose: Audit-ready FIFO consumption lineage.
 */
api.get('/reports/material-consumption', authorizeAction('reports', 'view'), async (req, res) => {
  const { from_date, to_date, project_id, inventory_id, grn_no } = req.query;

  try {
    let query = `
      SELECT 
        miv.issue_date,
        mii.grn_number as grn_source,
        miv.voucher_no,
        p.name as project_name,
        mii.item_name,
        mii.quantity as quantity_issued,
        mii.total_cost as fifo_cost,
        miv.issued_to,
        miv.issued_by,
        inv.category,
        inv.unit
      FROM material_issue_items mii
      JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
      JOIN projects p ON miv.project_id = p.id
      JOIN inventory inv ON mii.inventory_id = inv.id
      WHERE mii.is_deleted = FALSE AND mii.revert_status = "ACTIVE"
    `;
    const params: any[] = [];

    if (from_date) { query += ` AND miv.issue_date >= ? `; params.push(from_date); }
    if (to_date) { query += ` AND miv.issue_date <= ? `; params.push(to_date); }
    if (project_id) { query += ` AND miv.project_id = ? `; params.push(project_id); }
    if (inventory_id) { query += ` AND mii.inventory_id = ? `; params.push(inventory_id); }
    if (grn_no) { query += ` AND mii.grn_number = ? `; params.push(grn_no); }

    query += ` ORDER BY miv.issue_date DESC, mii.id DESC `;

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4. PROJECT CONSUMPTION REPORT
 * Purpose: Project-level consumption and costing visibility.
 */
api.get('/reports/project-consumption', authorizeAction('reports', 'view'), async (req, res) => {
  const { project_id, from_date, to_date } = req.query;

  try {
    let query = `
      SELECT 
        p.name as project_name,
        mii.item_name,
        SUM(mii.quantity) as total_qty,
        SUM(mii.total_cost) as total_fifo_cost,
        MAX(miv.issue_date) as last_consumption_date,
        inv.unit
      FROM material_issue_items mii
      JOIN material_issue_vouchers miv ON mii.voucher_id = miv.id
      JOIN projects p ON miv.project_id = p.id
      JOIN inventory inv ON mii.inventory_id = inv.id
      WHERE mii.is_deleted = FALSE AND mii.revert_status = "ACTIVE"
    `;
    const params: any[] = [];

    if (project_id) { query += ` AND miv.project_id = ? `; params.push(project_id); }
    if (from_date) { query += ` AND miv.issue_date >= ? `; params.push(from_date); }
    if (to_date) { query += ` AND miv.issue_date <= ? `; params.push(to_date); }

    query += ` GROUP BY miv.project_id, mii.inventory_id ORDER BY project_name ASC, total_fifo_cost DESC `;

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPORT SYSTEM - EXCEL GENERATION
// ═══════════════════════════════════════════════════════════════

api.post('/reports/export/excel', authorizeAction('reports', 'export'), async (req, res) => {
  const { title, columns, data } = req.body;

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title || 'Report');

    worksheet.columns = columns.map((col: any) => ({
      header: col.header,
      key: col.key,
      width: col.width || 20
    }));

    // Formatting Header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    data.forEach((row: any) => worksheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${title.replace(/\s+/g, '_')}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// Start Server
server.use('/api', api);

// Fallback for unmatched /api routes
api.use((req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Log asset requests
server.use((req, res, next) => {
  if (req.url.includes("/assets/")) {
    console.log("ASSET REQUEST:", req.url);
  }
  next();
});

// === Diagnostics: Check build files
console.log("=== DIST CHECK ===");
const distPathFromDirname = path.join(__dirname, 'dist');
const distPathFromCwd = path.join(process.cwd(), 'dist');
const distPath = fs.existsSync(distPathFromDirname) ? distPathFromDirname : distPathFromCwd;
console.log("DIST PATH FROM DIRNAME:", distPathFromDirname);
console.log("DIST PATH FROM CWD:", distPathFromCwd);
console.log("USING DIST PATH:", distPath);
console.log("DIST EXISTS:", fs.existsSync(distPath));
const assetsPath = path.join(distPath, 'assets');
console.log("ASSETS PATH:", assetsPath);
console.log("ASSETS EXISTS:", fs.existsSync(assetsPath));
const indexHtmlPath = path.join(distPath, 'index.html');
console.log("INDEX.HTML EXISTS:", fs.existsSync(indexHtmlPath));

// Serve static files from the React frontend build
server.use(express.static(distPath));

// Fallback for React Router
server.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

async function startServer() {
  try {
    await initDB();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 SQL Backend server running at http://localhost:${PORT}`);
      console.log(`📊 All Firebase dependencies removed - Pure SQL implementation`);
    });
  } catch (error: any) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
