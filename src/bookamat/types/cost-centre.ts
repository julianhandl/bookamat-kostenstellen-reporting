/*
 * Schema source: https://www.bookamat.com/dokumentation/api/v1/cost_centres.html
 */

/**
 * A cost centre (Kostenstelle). Bookings can be tagged with one cost centre;
 * the reporting tool groups bookings by this value to produce a separate
 * E1a report per cost centre.
 */
export type CostCentre = {
  id: number;
  /** Display name, max 40 characters. */
  name: string;
  /** Sort position among cost centres. */
  position: number;
  /** Read-only count of bookings in status "booked". */
  counter_booked_bookings: number;
  /** Read-only count of bookings in status "open". */
  counter_open_bookings: number;
  /** Read-only count of bookings in status "deleted". */
  counter_deleted_bookings: number;
  /** Read-only count of booking templates referencing this cost centre. */
  counter_bookingtemplates: number;
};
