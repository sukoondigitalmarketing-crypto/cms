/**
 * Data Validation Utilities
 * Strict validation for all forms to prevent invalid data submission
 */

import { Project, ApprovalRequest, Customer, InventoryItem, ProjectStatus } from '../types';

// ─────────────────────────────────────────────────────────────────
// Approval Validation
// ─────────────────────────────────────────────────────────────────

export interface ApprovalValidation {
  isValid: boolean;
  errors: string[];
}

export function validateApprovalForm(data: {
  title?: string;
  type?: string;
  projectId?: string;
  amount?: string | number;
  description?: string;
}): ApprovalValidation {
  const errors: string[] = [];

  // Title validation
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Title is required and must be a non-empty string');
  } else if (data.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters');
  } else if (data.title.trim().length > 200) {
    errors.push('Title must not exceed 200 characters');
  }

  // Type validation
  if (!data.type || !['Vendor Payment', 'Contractor Payment', 'Other'].includes(data.type)) {
    errors.push('Type must be selected (Vendor Payment, Contractor Payment, or Other)');
  }

  // Project ID validation (CRITICAL FIX - project must be selected)
  if (!data.projectId || typeof data.projectId !== 'string' || data.projectId.trim().length === 0) {
    errors.push('Project selection is mandatory - please select a project before submitting');
  }

  // Amount validation
  const amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
  if (isNaN(amount) || amount < 0) {
    errors.push('Amount must be a valid number');
  } else if (amount === 0) {
    errors.push('Amount must be greater than 0');
  } else if (amount > 999999999) {
    errors.push('Amount exceeds maximum allowed value');
  }

  // Description validation
  if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
    errors.push('Description is required');
  } else if (data.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  } else if (data.description.trim().length > 1000) {
    errors.push('Description must not exceed 1000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────
// Project Validation
// ─────────────────────────────────────────────────────────────────

export interface ProjectValidation {
  isValid: boolean;
  errors: string[];
}

export function validateProjectForm(data: {
  code?: string;
  name?: string;
  location?: string;
  startDate?: string;
  expectedEndDate?: string;
  totalValue?: string | number;
  estimatedCost?: string | number;
}): ProjectValidation {
  const errors: string[] = [];

  // Code validation
  if (!data.code || typeof data.code !== 'string' || data.code.trim().length === 0) {
    errors.push('Project Code is required');
  } else if (!/^[A-Z0-9\-]+$/.test(data.code)) {
    errors.push('Project Code must contain only uppercase letters, numbers, and hyphens');
  }

  // Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Project Name is required');
  } else if (data.name.trim().length < 3) {
    errors.push('Project Name must be at least 3 characters');
  }

  // Location validation
  if (!data.location || typeof data.location !== 'string' || data.location.trim().length === 0) {
    errors.push('Location is required');
  }

  // Date validation
  if (!data.startDate || typeof data.startDate !== 'string') {
    errors.push('Start Date is required');
  }

  if (!data.expectedEndDate || typeof data.expectedEndDate !== 'string') {
    errors.push('Expected End Date is required');
  }

  if (data.startDate && data.expectedEndDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.expectedEndDate);
    if (start >= end) {
      errors.push('Start Date must be before Expected End Date');
    }
  }

  // Financial validation (Made optional per user request)
  const total = data.totalValue !== undefined && data.totalValue !== '' ? (typeof data.totalValue === 'string' ? parseFloat(data.totalValue) : data.totalValue) : 0;
  if (isNaN(total) || total < 0) {
    errors.push('Total Value must be a valid positive number');
  }

  const estimated = data.estimatedCost !== undefined && data.estimatedCost !== '' ? (typeof data.estimatedCost === 'string' ? parseFloat(data.estimatedCost) : data.estimatedCost) : 0;
  if (isNaN(estimated) || estimated < 0) {
    errors.push('Estimated Cost must be a valid positive number');
  }

  if (!isNaN(estimated) && !isNaN(total) && estimated > total && total > 0) {
    errors.push('Estimated Cost cannot exceed Total Value');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────
// Customer Validation
// ─────────────────────────────────────────────────────────────────

export interface CustomerValidation {
  isValid: boolean;
  errors: string[];
}

export function validateCustomerForm(data: {
  name?: string;
  plotNumber?: string;
  totalPayment?: string | number;
}): CustomerValidation {
  const errors: string[] = [];

  // Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Customer Name is required');
  } else if (data.name.trim().length < 2) {
    errors.push('Customer Name must be at least 2 characters');
  }

  // Plot number validation
  if (!data.plotNumber || typeof data.plotNumber !== 'string' || data.plotNumber.trim().length === 0) {
    errors.push('Plot Number is required');
  } else if (!/^[A-Z0-9\-]+$/.test(data.plotNumber)) {
    errors.push('Plot Number must contain only uppercase letters, numbers, and hyphens');
  }

  // Payment validation
  const payment = typeof data.totalPayment === 'string' ? parseFloat(data.totalPayment) : data.totalPayment;
  if (isNaN(payment) || payment < 0) {
    errors.push('Total Payment must be a valid number');
  } else if (payment === 0) {
    errors.push('Total Payment must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────
// Payment Recording Validation
// ─────────────────────────────────────────────────────────────────

export interface PaymentValidation {
  isValid: boolean;
  errors: string[];
}

export function validatePaymentForm(data: {
  customerId?: string;
  amount?: string | number;
  mode?: string;
  date?: string;
}, pendingPayment?: number): PaymentValidation {
  const errors: string[] = [];

  // Customer validation
  if (!data.customerId || typeof data.customerId !== 'string' || data.customerId.trim().length === 0) {
    errors.push('Please select a customer');
  }

  // Amount validation
  const amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
  if (isNaN(amount) || amount <= 0) {
    errors.push('Payment Amount must be a valid positive number');
  }

  if (pendingPayment !== undefined && !isNaN(amount) && amount > pendingPayment) {
    errors.push(`Payment amount cannot exceed pending payment of ₹${pendingPayment.toLocaleString()}`);
  }

  // Mode validation
  if (!data.mode || !['Bank Transfer', 'Cash', 'Cheque'].includes(data.mode)) {
    errors.push('Payment Mode must be selected');
  }

  // Date validation
  if (!data.date || typeof data.date !== 'string' || data.date.trim().length === 0) {
    errors.push('Payment Date is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────
// Inventory Item Validation
// ─────────────────────────────────────────────────────────────────

export interface InventoryValidation {
  isValid: boolean;
  errors: string[];
}

export function validateInventoryForm(data: {
  itemName?: string;
  category?: string;
  subCategory?: string;
  unit?: string;
  quantity?: string | number;
  pricePerUnit?: string | number;
}): InventoryValidation {
  const errors: string[] = [];

  // Item name validation
  if (!data.itemName || typeof data.itemName !== 'string' || data.itemName.trim().length === 0) {
    errors.push('Item Name is required');
  } else if (data.itemName.trim().length < 2) {
    errors.push('Item Name must be at least 2 characters');
  }

  // Category validation
  if (!data.category || typeof data.category !== 'string' || data.category.trim().length === 0) {
    errors.push('Category is required');
  }

  // Unit validation
  if (!data.unit || typeof data.unit !== 'string' || data.unit.trim().length === 0) {
    errors.push('Unit is required');
  }

  // Quantity validation
  const qty = typeof data.quantity === 'string' ? parseFloat(data.quantity) : data.quantity;
  if (isNaN(qty) || qty < 0) {
    errors.push('Quantity must be a valid positive number');
  }

  // Price validation
  const price = typeof data.pricePerUnit === 'string' ? parseFloat(data.pricePerUnit) : data.pricePerUnit;
  if (isNaN(price) || price < 0) {
    errors.push('Price Per Unit must be a valid positive number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────
// Material Issue Validation
// ─────────────────────────────────────────────────────────────────

export interface MaterialIssueValidation {
  isValid: boolean;
  errors: string[];
}

export function validateMaterialIssueForm(
  data: {
    itemId?: string | number;
    quantity?: string | number;
    projectName?: string;
    issuedTo?: string;
  },
  availableQuantity?: number
): MaterialIssueValidation {
  const errors: string[] = [];

  // Item validation
  if (!data.itemId) {
    errors.push('Please select an item to issue');
  }

  // Quantity validation
  const qty = typeof data.quantity === 'string' ? parseFloat(data.quantity) : data.quantity;
  if (isNaN(qty) || qty <= 0) {
    errors.push('Issue Quantity must be a valid positive number');
  }

  if (availableQuantity !== undefined && !isNaN(qty) && qty > availableQuantity) {
    errors.push(`Issue quantity cannot exceed available stock of ${availableQuantity}`);
  }

  // Project validation
  if (!data.projectName || typeof data.projectName !== 'string' || data.projectName.trim().length === 0) {
    errors.push('Project Name is required');
  }

  // Issued to validation
  if (!data.issuedTo || typeof data.issuedTo !== 'string' || data.issuedTo.trim().length === 0) {
    errors.push('Issued To is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────
// Batch Validation Status Helper
// ─────────────────────────────────────────────────────────────────

export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  return '• ' + errors.join('\n• ');
}
