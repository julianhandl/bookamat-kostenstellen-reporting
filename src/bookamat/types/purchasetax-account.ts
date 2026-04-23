/*
 * Schema source: https://www.bookamat.com/dokumentation/api/v1/purchasetax_accounts.html
 */

/**
 * Direction of a purchase-tax account.
 * - `"1"` — revenue (Umsatz)
 * - `"2"` — expense (Aufwand)
 */
export type PurchaseTaxAccountGroup = "1" | "2";

/**
 * An activated purchase-tax account (Umsatzsteuerkonto / Steuerkonto).
 * Each booking amount references one of these to describe which VAT bucket
 * the transaction belongs to in the Austrian VAT return (UVA).
 */
export type PurchaseTaxAccount = {
  id: number;
  /** ID of the underlying predefined tax-account definition. */
  purchasetaxaccount: number;
  /** Display name, max 40 characters. */
  name: string;
  /** Category/area grouping. */
  section: string;
  /** Revenue (`"1"`) or expense (`"2"`). See {@link PurchaseTaxAccountGroup}. */
  group: PurchaseTaxAccountGroup;
  /** Reverse-charge mechanism applies. */
  reverse_charge: boolean;
  /** Reported in the Intra-Community (ZM) summary report. */
  ic_report: boolean;
  /** Intra-community delivery of goods. */
  ic_delivery: boolean;
  /** Intra-community supply of services. */
  ic_service: boolean;
  /** Reported via Import One-Stop Shop. */
  ioss_report: boolean;
  /** Reported via EU One-Stop Shop. */
  eu_oss_report: boolean;
  /** Permitted VAT rates (decimal strings, e.g. `"20"`, `"10"`). */
  tax_values: string[];
  /** Austrian VAT-return line codes (UVA Kennzahlen) this account feeds. */
  index_purchasetax: string[];
  description: string;
  active: boolean;
  counter_booked_bookings: number;
  counter_open_bookings: number;
  counter_deleted_bookings: number;
  counter_bookingtemplates: number;
};
