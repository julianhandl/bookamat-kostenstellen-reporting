/*
 * Schema source: https://www.bookamat.com/dokumentation/api/v1/cost_accounts.html
 */

/**
 * Direction of a cost account.
 * - `"1"` — income (Ertrag)
 * - `"2"` — expense (Aufwand)
 */
export type CostAccountGroup = "1" | "2";

export type CostAccountPurchaseTaxAccountRef = {
  id: number;
  name: string;
};

/**
 * An activated cost account. Every booking amount references one of these;
 * it determines which E1a line the amount contributes to via
 * {@link CostAccount.index_incometax}.
 */
export type CostAccount = {
  id: number;
  /** ID of the underlying predefined cost-account definition. */
  costaccount: number;
  /** Display name, max 40 characters. */
  name: string;
  section: string;
  /** Income (`"1"`) or expense (`"2"`). See {@link CostAccountGroup}. */
  group: CostAccountGroup;
  /** True if the account represents an inventory/fixed-asset position. */
  inventory: boolean;
  /** Austrian income-tax form line codes (E1a Kennzahlen) this account feeds. */
  index_incometax: string[];
  /** Deductibility of VAT, 0–100 as decimal string. `null` if not restricted. */
  deductibility_tax_percent: string | null;
  /** Deductibility of the cost itself, 0–100 as decimal string. `null` if not restricted. */
  deductibility_amount_percent: string | null;
  description: string;
  active: boolean;
  /** Purchase-tax accounts that may be combined with this cost account. */
  purchasetaxaccounts: CostAccountPurchaseTaxAccountRef[];
  counter_booked_bookings: number;
  counter_open_bookings: number;
  counter_deleted_bookings: number;
  counter_bookingtemplates: number;
};
