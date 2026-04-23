/*
 * Schema source: https://www.bookamat.com/dokumentation/api/v1/bookings.html
 */

/**
 * Status of a booking.
 * - `"1"` — booked (finalised, has a booking date)
 * - `"2"` — open (no booking date yet)
 * - `"3"` — deleted (soft-deleted, can be restored)
 * - `"4"` — imported (pending review after bank/CSV import)
 */
export type BookingStatus = "1" | "2" | "3" | "4";

/**
 * Direction of a booking amount.
 * - `"1"` — income (Einnahme)
 * - `"2"` — expense (Ausgabe)
 */
export type BookingAmountGroup = "1" | "2";

export type BookingBankAccountRef = {
  id: number;
  name: string;
};

export type BookingCostAccountRef = {
  id: number;
  name: string;
};

export type BookingPurchaseTaxAccountRef = {
  id: number;
  name: string;
};

/**
 * Cost-centre reference on a booking. `id` is `null` when the booking is not
 * assigned to any cost centre; `name` is an empty string in that case.
 */
export type BookingCostCentreRef = {
  id: number | null;
  name: string;
};

/**
 * Reference to a foreign business base (used for cross-border transactions).
 * `id` is `null` when no foreign base is attached.
 */
export type BookingForeignBusinessBaseRef = {
  id: number | null;
  vatin: string;
};

/**
 * A single line-item amount on a booking. A booking has at least one amount;
 * split bookings have several.
 *
 * All monetary and percentage fields are serialised as decimal strings
 * (e.g. `"123.45"`) to preserve precision — do not parse as `number` without
 * a decimal library.
 */
export type BookingAmount = {
  /** Income (`"1"`) or expense (`"2"`). See {@link BookingAmountGroup}. */
  group: BookingAmountGroup;
  bankaccount: BookingBankAccountRef;
  costaccount: BookingCostAccountRef;
  purchasetaxaccount: BookingPurchaseTaxAccountRef;
  /** Gross amount (includes tax). */
  amount: string;
  /** Net amount (after tax is removed). */
  amount_after_tax: string;
  /** VAT rate applied, 0–100. */
  tax_percent: string;
  /** Absolute VAT value derived from `amount` and `tax_percent`. */
  tax_value: string;
  /** Share of input VAT that is deductible, 0–100. */
  deductibility_tax_percent: string;
  deductibility_tax_value: string;
  /** Share of the gross amount that is tax-deductible as cost, 0–100. */
  deductibility_amount_percent: string;
  deductibility_amount_value: string;
  foreign_business_base: BookingForeignBusinessBaseRef;
  /** ISO country code of the departure country (for goods/services). */
  country_dep: string | null;
  /** ISO country code of the receiving country. */
  country_rec: string | null;
};

export type BookingTag = {
  id: number;
  /** ID of the referenced tag definition. */
  tag: number;
  name: string;
};

export type BookingAttachment = {
  id: number;
  name: string;
  /** File size in bytes. */
  size: number;
};

export type Booking = {
  id: number;
  status: BookingStatus;
  title: string;
  document_number: string;
  /** Booking date (ISO `YYYY-MM-DD`). `null` for open bookings. */
  date: string | null;
  /** Invoice date. */
  date_invoice: string | null;
  /** Delivery date. */
  date_delivery: string | null;
  /** Order date. */
  date_order: string | null;
  /**
   * Cost-centre reference, or `null` when the booking has none. Bookamat has
   * been observed to emit either `null` directly or `{ id: null, name: "" }`
   * for unassigned bookings.
   */
  costcentre: BookingCostCentreRef | null;
  /** Line items. Always contains at least one entry for a valid booking. */
  amounts: BookingAmount[];
  tags: BookingTag[];
  attachments: BookingAttachment[];
  /** VAT identification number of the counterparty. */
  vatin: string | null;
  /** ISO country code of the counterparty. */
  country: string | null;
  description: string | null;
  /** ISO datetime of record creation. */
  create_date: string;
  /** ISO datetime of last update. */
  update_date: string;
};
