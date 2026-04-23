/*
 * Temporary verification script for the 2025 E1a report.
 *
 * Loads the local snapshot (schema_version 2) via BookamatClient.fromSnapshot
 * and checks two properties:
 *
 *   1. A combined report (all bookings + all Anlagen in one bucket) matches
 *      the numbers Bookamat produces for the full accounting year, as seen
 *      in example_report_2025.html. This verifies that the booking-side sum
 *      (deductibility_amount_value) and the Anlagen-side sum (this year's
 *      depreciation_amount) combine correctly.
 *
 *   2. Per-cost-centre reports (Programmierung + Brauerei, empty Anlagen
 *      mapping) preserve every booking-side amount — i.e. summing the row
 *      amounts across all per-cost-centre reports equals the combined
 *      report's booking-only amount for each Kennzahl. Anlagen reconciliation
 *      cannot be verified yet because the per-Anlage cost-centre mapping UI
 *      doesn't exist.
 *
 * Run: `bun run src/reporting/scripts/verify-2025.ts`.
 */

import { BookamatClient } from "../../bookamat/client.ts";
import { readSnapshot } from "../../bookamat/snapshot.ts";
import { buildE1aReport, type E1aReport } from "../e1a-report/report.ts";

const SNAPSHOT_PATH = "./snapshots/at-2025.json";

type ExpectedRow = {
  kennzahl: string;
  bookings_count: number;
  /**
   * Only checked when non-null. The Bookamat HTML shows an "inventory counter"
   * that is cosmetic (all Anlagen whose cost account references the Kennzahl,
   * including fully-depreciated ones) and doesn't match the amount side, so
   * we skip it unless we specifically want to assert it.
   */
  inventory_count: number | null;
  amount: number;
};

/** Acceptance criteria copied from example_report_2025.html. */
const EXPECTED_COMBINED_ROWS: ExpectedRow[] = [
  { kennzahl: "9040", bookings_count: 35, inventory_count: 0, amount: 4189.58 },
  { kennzahl: "9100", bookings_count: 13, inventory_count: 0, amount: 941.09 },
  { kennzahl: "9110", bookings_count: 1, inventory_count: 0, amount: 120.00 },
  // 9130: 6 bookings (711.24) + 2 active Anlagen (197.80 + 187.50)
  { kennzahl: "9130", bookings_count: 6, inventory_count: null, amount: 1096.54 },
  { kennzahl: "9190", bookings_count: 11, inventory_count: 0, amount: 382.88 },
  { kennzahl: "9225", bookings_count: 4, inventory_count: 0, amount: 172.92 },
  { kennzahl: "9230", bookings_count: 48, inventory_count: 0, amount: 1719.31 },
];

const EXPECTED_EINNAHMEN_SUM = 4189.58;
const EXPECTED_AUSGABEN_SUM = 4432.74;
const EXPECTED_GEWINN_VERLUST = -243.16;

const failures: string[] = [];

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertClose(label: string, actual: number, expected: number): void {
  if (Math.abs(actual - expected) > 0.005) {
    failures.push(`${label}: expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`);
  }
}

const snapshot = await readSnapshot(SNAPSHOT_PATH);
const client = BookamatClient.fromSnapshot(snapshot);

// -- 1. Combined report (all bookings + all Anlagen) against the HTML --------

const [allBookings, allInventories, costCentres] = await Promise.all([
  client.getEnrichedBookings(),
  client.getEnrichedInventories(),
  client.getCostCentres(),
]);

const combined: E1aReport = buildE1aReport(
  allBookings,
  allInventories,
  null,
  snapshot.year,
);

const combinedRowsByCode = new Map(
  [...combined.betriebseinnahmen.rows, ...combined.betriebsausgaben.rows]
    .map((row) => [row.kennzahl, row] as const),
);

for (const expected of EXPECTED_COMBINED_ROWS) {
  const row = combinedRowsByCode.get(expected.kennzahl);
  if (row === undefined) {
    failures.push(`combined row ${expected.kennzahl}: missing from report`);
    continue;
  }
  assertEqual(
    `combined row ${expected.kennzahl} bookings_count`,
    row.bookings_count,
    expected.bookings_count,
  );
  if (expected.inventory_count !== null) {
    assertEqual(
      `combined row ${expected.kennzahl} inventory_count`,
      row.inventory_count,
      expected.inventory_count,
    );
  }
  assertClose(
    `combined row ${expected.kennzahl} amount`,
    row.amount,
    expected.amount,
  );
}

assertClose(
  "combined Summe Betriebseinnahmen",
  combined.betriebseinnahmen.sum,
  EXPECTED_EINNAHMEN_SUM,
);
assertClose(
  "combined Summe Betriebsausgaben",
  combined.betriebsausgaben.sum,
  EXPECTED_AUSGABEN_SUM,
);
assertClose(
  "combined Verlust vor Freibeträgen",
  combined.gewinn_verlust,
  EXPECTED_GEWINN_VERLUST,
);
assertClose(
  "combined Betriebsergebnis",
  combined.betriebsergebnis,
  EXPECTED_GEWINN_VERLUST,
);

// -- 2. Booking split is lossless across cost-centres ------------------------
//
// Build one report per cost-centre using ONLY that cost-centre's bookings and
// no Anlagen, plus one report for the unassigned bucket. Summing row amounts
// and bookings_count per Kennzahl across those reports must equal the
// booking-only combined report (same bookings, no Anlagen). Anlagen are not
// partitioned here because the per-Anlage cost-centre mapping UI doesn't
// exist yet.

const bookingGroups = await client.getBookingsGroupedByCostCentre();
const perCentreReports: E1aReport[] = bookingGroups.map((group) =>
  buildE1aReport(group.bookings, [], group.costcentre, snapshot.year),
);

const bookingOnlyCombined = buildE1aReport(
  allBookings,
  [],
  null,
  snapshot.year,
);
const bookingOnlyByCode = new Map(
  [
    ...bookingOnlyCombined.betriebseinnahmen.rows,
    ...bookingOnlyCombined.betriebsausgaben.rows,
  ].map((row) => [row.kennzahl, row] as const),
);

const summedByCode = new Map<string, number>();
const bookingCountsByCode = new Map<string, number>();
for (const report of perCentreReports) {
  for (const row of [
    ...report.betriebseinnahmen.rows,
    ...report.betriebsausgaben.rows,
  ]) {
    summedByCode.set(
      row.kennzahl,
      (summedByCode.get(row.kennzahl) ?? 0) + row.amount,
    );
    bookingCountsByCode.set(
      row.kennzahl,
      (bookingCountsByCode.get(row.kennzahl) ?? 0) + row.bookings_count,
    );
  }
}

for (const [code, expectedRow] of bookingOnlyByCode) {
  const summed = summedByCode.get(code) ?? 0;
  assertClose(`per-cost-centre split amount for ${code}`, summed, expectedRow.amount);
  const summedCount = bookingCountsByCode.get(code) ?? 0;
  assertEqual(
    `per-cost-centre split bookings_count for ${code}`,
    summedCount,
    expectedRow.bookings_count,
  );
}

// -- Output ------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`verify-2025: ${failures.length} failure(s):`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `verify-2025: OK\n` +
    `  combined report:         ` +
    `Einnahmen ${combined.betriebseinnahmen.sum.toFixed(2)}, ` +
    `Ausgaben ${combined.betriebsausgaben.sum.toFixed(2)}, ` +
    `Verlust ${combined.gewinn_verlust.toFixed(2)}\n` +
    `  per-cost-centre reports: ${perCentreReports.length} ` +
    `(${perCentreReports
      .map((r) => r.costcentre?.name ?? "unassigned")
      .join(", ")})\n` +
    `  cost centres checked:    ${costCentres.length}`,
);
