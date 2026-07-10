export interface ActiveBatch {
  id: number;
  inventory_id: number;
  batch_number: string;
  quantity_remaining: number | string;
  total_value_remaining: number | string;
  unit_price: number | string;
  confirmed_unit_price: number | string | null;
  grn_id: number | null;
  received_date: string | Date;
}

export interface FifoAllocationItem {
  batchId: number;
  batchNumber: string;
  quantityAllocated: number;
  grnId: number | null;
  originalQuantityRemaining: number;
  originalValueRemaining: number;
  unitPrice: number;
  confirmedUnitPrice: number | null;
}

export interface FifoValuedItem {
  batchId: number;
  batchNumber: string;
  quantityAllocated: number;
  grnId: number | null;
  unitRate: number;
  allocatedCost: number;
  isConfirmed: boolean;
}

export interface FifoCostingSummary {
  totalCost: number;
  expectedIssueRate: number;
  remainingUnfulfilled: number;
  allocations: FifoValuedItem[];
}

/**
 * Responsibility 1: FIFO Physical Allocation
 * Determines which batches are consumed and the quantities taken from each layer.
 */
export function allocateFifoBatches(batches: ActiveBatch[], quantityToIssue: number): FifoAllocationItem[] {
  let remaining = quantityToIssue;
  const allocations: FifoAllocationItem[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    const batchQty = parseFloat(batch.quantity_remaining as string);
    const take = Math.min(remaining, batchQty);

    if (take > 0) {
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        quantityAllocated: take,
        grnId: batch.grn_id,
        originalQuantityRemaining: batchQty,
        originalValueRemaining: parseFloat(batch.total_value_remaining as string),
        unitPrice: parseFloat(batch.unit_price as string),
        confirmedUnitPrice: batch.confirmed_unit_price !== null && batch.confirmed_unit_price !== undefined
          ? parseFloat(batch.confirmed_unit_price as string)
          : null
      });
      remaining -= take;
    }
  }

  return allocations;
}

/**
 * Responsibility 2: FIFO Financial Valuation
 * Computes costs and rates from allocated batches, implementing confirmed rate precedence
 * and the ERP Value-First batch exhaustion rule.
 */
export function valueFifoAllocations(allocations: FifoAllocationItem[], quantityToIssue: number): FifoCostingSummary {
  let totalCost = 0;
  const valuedItems: FifoValuedItem[] = [];
  let totalAllocatedQuantity = 0;

  for (const alloc of allocations) {
    const qty = alloc.quantityAllocated;
    totalAllocatedQuantity += qty;

    const isConfirmed = alloc.confirmedUnitPrice !== null && alloc.confirmedUnitPrice > 0;
    const rate = isConfirmed ? alloc.confirmedUnitPrice! : alloc.unitPrice;

    let cost = 0;
    if (qty === alloc.originalQuantityRemaining) {
      cost = alloc.originalValueRemaining; // Value-First Rule
    } else {
      cost = qty * rate;
    }

    totalCost += cost;

    valuedItems.push({
      batchId: alloc.batchId,
      batchNumber: alloc.batchNumber,
      quantityAllocated: qty,
      grnId: alloc.grnId,
      unitRate: rate,
      allocatedCost: cost,
      isConfirmed
    });
  }

  const remainingUnfulfilled = quantityToIssue - totalAllocatedQuantity;
  const expectedIssueRate = quantityToIssue > 0 ? (totalCost / quantityToIssue) : 0;

  return {
    totalCost,
    expectedIssueRate,
    remainingUnfulfilled,
    allocations: valuedItems
  };
}
