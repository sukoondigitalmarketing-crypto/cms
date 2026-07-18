/**
 * Shared material-selection contract.
 *
 * `MaterialOption` is the single shape every searchable material takes across
 * parent modules, the search utility, and the SearchableSelect component.
 * The mapper below is the ONLY place responsible for building `label` and
 * `searchText` from an inventory record — modules must not construct options
 * inline.
 */

export interface MaterialOption {
  /** Inventory record id. Persisted by parents as `inventory_id`. */
  id: string | number;
  /** Human-readable text shown in the dropdown. Never normalized. */
  label: string;
  /** Text used for matching/ranking. Normalized by the search utility. */
  searchText: string;
}

/** Minimal shape of an inventory record consumed by the mapper. */
export interface InventoryRecord {
  id: string | number;
  item_name: string;
  unit?: string;
}

/**
 * Convert a single inventory record into a MaterialOption.
 *
 * `label` preserves the existing display format (`item_name (unit)`), and
 * `searchText` currently mirrors it so the matchable surface is unchanged.
 * Future search inputs (codes, aliases, brands) are added to `searchText`
 * here — never in the component.
 */
export function toMaterialOption(item: InventoryRecord): MaterialOption {
  const label = `${item.item_name} (${item.unit})`;
  return {
    id: item.id,
    label,
    searchText: label,
  };
}

/** Convert a list of inventory records into MaterialOptions. */
export function toMaterialOptions(items: InventoryRecord[]): MaterialOption[] {
  return items.map(toMaterialOption);
}
