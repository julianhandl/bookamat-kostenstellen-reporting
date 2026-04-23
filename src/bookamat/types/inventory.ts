/*
 * Schema source: https://www.bookamat.com/dokumentation/api/v1/inventories.html
 *
 * Anlagen (fixed assets). Bookamat computes the yearly AfA (depreciation) from
 * these entries and adds it to the E1a Kennzahlen 9130/9134/9135/9210 — so any
 * report that excludes Anlagen will understate those lines.
 *
 * Anlagen have no cost-centre in the Bookamat model; per-cost-centre allocation
 * happens via an external mapping (see reporting/cost-center/anlagen-mapping).
 */

export type InventoryCostAccountRef = {
  id: number;
  name: string;
};

export type InventoryDeductibilityTypeRef = {
  id: number;
  name: string;
};

/**
 * One row in the yearly depreciation schedule of an Anlage.
 *
 * All monetary and percentage fields are serialised as decimal strings
 * (e.g. `"123.45"`) to preserve precision.
 */
export type InventoryAmount = {
  /** Calendar year this depreciation row belongs to. */
  year: number;
  /** Depreciation percent applied for this year. */
  depreciation_percent: string;
  /** Depreciation amount booked for this year (this year's AfA). */
  depreciation_amount: string;
  /** Cumulated depreciation up to and including this year. */
  cumulated_depreciation: string;
  /** Residual book value at year end. */
  residual_value: string;
};

export type InventoryAttachment = {
  id: number;
  name: string;
  /** File size in bytes. */
  size: number;
};

/**
 * A fixed asset (Anlage).
 */
export type Inventory = {
  id: number;
  title: string;
  /** Purchase date (ISO `YYYY-MM-DD`). */
  date_purchase: string;
  /** Commissioning date (ISO `YYYY-MM-DD`). */
  date_commissioning: string;
  /** Disposal date (ISO `YYYY-MM-DD`), `null` if still in service. */
  date_disposal: string | null;
  /** Net purchase amount (after tax). */
  amount_after_tax: string;
  /** Share of the cost that is deductible, 0–100 as decimal string. */
  deductibility_percent: string;
  /** Absolute deductible amount. */
  deductibility_amount: string;
  /** Declining-balance depreciation percent, `null` for linear depreciation. */
  deductibility_declining_percent: string | null;
  /** Year when switching from declining to linear depreciation, `null` otherwise. */
  deductibility_switch_year: number | null;
  /** Useful life in years. */
  deductibility_years: number;
  deductibility_type: InventoryDeductibilityTypeRef;
  costaccount: InventoryCostAccountRef;
  /** Depreciation schedule, one row per year. */
  amounts: InventoryAmount[];
  attachments: InventoryAttachment[];
  description: string;
  seller: string;
  /** ISO datetime of record creation. */
  create_date: string;
  /** ISO datetime of last update. */
  update_date: string;
};
