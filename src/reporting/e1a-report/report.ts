/*
 * E1a report calculation for a single cost-centre scope.
 *
 * Given already-filtered enriched bookings + Anlagen of the cost-centre, this
 * builds the full E1a report: rows per Kennzahl, section sums, profit/loss,
 * and the final Betriebsergebnis.
 *
 * Two data sources feed each Kennzahl's amount:
 *  - bookings: sum of `BookingAmount.deductibility_amount_value` for every
 *    amount whose `costaccount_full.index_incometax` contains the Kennzahl.
 *    `deductibility_amount_value` is what Bookamat reports as "BA Betrag" —
 *    it already applies partial deductibility (e.g. 50% private/business).
 *  - Anlagen: sum of the current year's `depreciation_amount` (this year's
 *    AfA) from each Anlage whose cost-account has the Kennzahl in its
 *    `index_incometax`. Bookamat itself computes 9130/9134/9135/9210 this way.
 *
 * All arithmetic happens in integer cents (Math.round(x * 100)) to avoid
 * floating-point drift across many small amounts. The final sums stay well
 * within Number.MAX_SAFE_INTEGER for realistic monetary data.
 */

import type {
  EnrichedBooking,
  EnrichedInventory,
} from "../../bookamat/client.ts";
import type { CostCentre } from "../../bookamat/types/cost-centre.ts";
import { KENNZAHLEN, type KennzahlDefinition } from "./kennzahlen.ts";

export type E1aReportRow = {
  kennzahl: string;
  label: string;
  bookings_count: number;
  inventory_count: number;
  /** Rounded to 2 decimals. */
  amount: number;
};

export type E1aReportSection = {
  rows: E1aReportRow[];
  sum: number;
};

export type E1aReport = {
  /** `null` for the unassigned bucket (bookings / Anlagen with no cost-centre). */
  costcentre: CostCentre | null;
  year: number;
  betriebseinnahmen: E1aReportSection;
  betriebsausgaben: E1aReportSection;
  /** User-entered in Bookamat; always all-zero in this version. */
  freibetraege: E1aReportSection;
  /** `betriebseinnahmen.sum - betriebsausgaben.sum`. */
  gewinn_verlust: number;
  /** `gewinn_verlust - freibetraege.sum`. */
  betriebsergebnis: number;
};

type RowAccumulator = {
  bookingIds: Set<number>;
  inventoryIds: Set<number>;
  cents: number;
};

export function buildE1aReport(
  bookings: EnrichedBooking[],
  inventories: EnrichedInventory[],
  costcentre: CostCentre | null,
  year: number,
): E1aReport {
  const accumulators = new Map<string, RowAccumulator>();
  for (const kz of KENNZAHLEN) {
    accumulators.set(kz.code, {
      bookingIds: new Set(),
      inventoryIds: new Set(),
      cents: 0,
    });
  }

  for (const booking of bookings) {
    for (const amount of booking.amounts) {
      const cents = toCents(amount.deductibility_amount_value);
      for (const kennzahl of amount.costaccount_full.index_incometax) {
        const acc = accumulators.get(kennzahl);
        if (acc === undefined) {
          continue;
        }
        acc.bookingIds.add(booking.id);
        acc.cents += cents;
      }
    }
  }

  for (const inventory of inventories) {
    const yearAmount = inventory.amounts.find((entry) => entry.year === year);
    if (yearAmount === undefined) {
      continue;
    }
    const cents = toCents(yearAmount.depreciation_amount);
    if (cents === 0) {
      continue;
    }
    const kennzahl = pickInventoryKennzahl(inventory, year);
    if (kennzahl === null) {
      continue;
    }
    const acc = accumulators.get(kennzahl);
    if (acc === undefined) {
      continue;
    }
    acc.inventoryIds.add(inventory.id);
    acc.cents += cents;
  }

  const einnahmen = buildSection("betriebseinnahmen", accumulators);
  const ausgaben = buildSection("betriebsausgaben", accumulators);
  const freibetraege = buildSection("freibetraege", accumulators);

  const gewinnVerlustCents = Math.round(einnahmen.sum * 100) -
    Math.round(ausgaben.sum * 100);
  const betriebsergebnisCents =
    gewinnVerlustCents - Math.round(freibetraege.sum * 100);

  return {
    costcentre,
    year,
    betriebseinnahmen: einnahmen,
    betriebsausgaben: ausgaben,
    freibetraege,
    gewinn_verlust: gewinnVerlustCents / 100,
    betriebsergebnis: betriebsergebnisCents / 100,
  };
}

function buildSection(
  section: KennzahlDefinition["section"],
  accumulators: Map<string, RowAccumulator>,
): E1aReportSection {
  const rows: E1aReportRow[] = [];
  let sumCents = 0;
  for (const kz of KENNZAHLEN) {
    if (kz.section !== section) {
      continue;
    }
    const acc = accumulators.get(kz.code);
    // Freibeträge are not fed by bookings/Anlagen; always emit them at zero.
    const cents = section === "freibetraege" ? 0 : (acc?.cents ?? 0);
    sumCents += cents;
    rows.push({
      kennzahl: kz.code,
      label: kz.label,
      bookings_count: acc?.bookingIds.size ?? 0,
      inventory_count: acc?.inventoryIds.size ?? 0,
      amount: cents / 100,
    });
  }
  return { rows, sum: sumCents / 100 };
}

/**
 * Picks the single E1a Kennzahl an Anlage feeds for the given year.
 *
 * Bookamat's `CostAccount.index_incometax` on an Anlage's cost account lists
 * the *candidate* Kennzahlen (e.g. `["9130", "9134", "9210"]`). The actual
 * Kennzahl depends on the Anlage itself:
 *   - disposed in this year → 9210 (Restbuchwert abgegangener/verkaufter Anlagen)
 *   - declining-balance (§ 7 Abs. 1a) → 9134
 *   - linear, standard → 9130 (normal AfA, geringwertige Wirtschaftsgüter)
 *
 * Returns `null` when the cost account's candidate list contains none of the
 * recognised AfA codes — in that case the Anlage doesn't contribute and gets
 * skipped (keeps future cost-account categories from silently double-counting).
 */
function pickInventoryKennzahl(
  inventory: EnrichedInventory,
  year: number,
): string | null {
  const candidates = new Set(inventory.costaccount_full.index_incometax);

  if (
    inventory.date_disposal !== null &&
    parseInt(inventory.date_disposal.slice(0, 4), 10) === year &&
    candidates.has("9210")
  ) {
    return "9210";
  }
  if (
    inventory.deductibility_declining_percent !== null &&
    candidates.has("9134")
  ) {
    return "9134";
  }
  if (candidates.has("9130")) {
    return "9130";
  }
  return null;
}

function toCents(decimalString: string): number {
  return Math.round(parseFloat(decimalString) * 100);
}
