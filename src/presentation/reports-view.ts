/*
 * Assembles the payload the frontend needs to render the report UI.
 *
 * - `combined`: one E1a report over every booking + every Anlage. This is the
 *   reconciliation tab — numbers here should match Bookamat's own HTML E1a.
 * - `perCostCentre`: one E1a report per cost-centre, including Anlagen that
 *   are mapped to that cost-centre via `AnlagenCostCentreMapping`.
 * - `unassigned`: same shape; only present when bookings-without-cost-centre
 *   or unmapped Anlagen exist.
 * - `anlagen`: flat list of every Anlage with the current mapping applied,
 *   for the mapping UI. Fields are the minimum the UI needs to render rows.
 */

import { BookamatClient } from "../bookamat/client.ts";
import { buildE1aReport, type E1aReport } from "../reporting/e1a-report/report.ts";
import { buildAllCostCentreReports } from "../reporting/cost-center/build-reports.ts";
import type { AnlagenCostCentreMapping } from "../reporting/cost-center/anlagen-mapping.ts";
import type { CostCentre } from "../bookamat/types/cost-centre.ts";

export type AnlagenViewEntry = {
  id: number;
  title: string;
  date_purchase: string;
  date_disposal: string | null;
  amount_after_tax: string;
  costaccount_name: string;
  /** Current-year depreciation amount (`"0.00"` if not depreciating this year). */
  depreciation_this_year: string;
  /** Cost-centre id this Anlage is mapped to, or `null` if unassigned. */
  costcentre_id: number | null;
};

export type ReportsView = {
  country: string;
  year: number;
  fetched_at: string;
  costCentres: CostCentre[];
  combined: E1aReport;
  perCostCentre: E1aReport[];
  unassigned: E1aReport | null;
  anlagen: AnlagenViewEntry[];
};

export async function buildReportsView(
  client: BookamatClient,
  snapshotFetchedAt: string,
  mapping: AnlagenCostCentreMapping,
): Promise<ReportsView> {
  const [enrichedBookings, enrichedInventories, costCentres] = await Promise.all([
    client.getEnrichedBookings(),
    client.getEnrichedInventories(),
    client.getCostCentres(),
  ]);

  const year = client.year;

  const combined = buildE1aReport(
    enrichedBookings,
    enrichedInventories,
    null,
    year,
  );

  const allReports = await buildAllCostCentreReports(client, mapping);
  const perCostCentre = allReports.filter((report) => report.costcentre !== null);
  const unassigned = allReports.find((report) => report.costcentre === null) ?? null;

  const anlagen: AnlagenViewEntry[] = enrichedInventories.map((inventory) => {
    const yearAmount = inventory.amounts.find((entry) => entry.year === year);
    return {
      id: inventory.id,
      title: inventory.title,
      date_purchase: inventory.date_purchase,
      date_disposal: inventory.date_disposal,
      amount_after_tax: inventory.amount_after_tax,
      costaccount_name: inventory.costaccount_full.name,
      depreciation_this_year: yearAmount?.depreciation_amount ?? "0.00",
      costcentre_id: mapping.get(inventory.id) ?? null,
    };
  });

  return {
    country: client.country,
    year,
    fetched_at: snapshotFetchedAt,
    costCentres,
    combined,
    perCostCentre,
    unassigned,
    anlagen,
  };
}
