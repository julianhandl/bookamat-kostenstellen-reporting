/*
 * Orchestration: build one E1a report per cost-centre (plus an unassigned
 * bucket if bookings or Anlagen fall outside of all cost-centres).
 *
 * Bookings are already grouped by cost-centre inside BookamatClient. Anlagen
 * don't have a cost-centre in Bookamat, so we split them here using the
 * external `AnlagenCostCentreMapping` (see ./anlagen-mapping).
 */

import type { BookamatClient } from "../../bookamat/client.ts";
import { buildE1aReport, type E1aReport } from "../e1a-report/report.ts";
import {
  partitionInventoriesByCostCentre,
  type AnlagenCostCentreMapping,
} from "./anlagen-mapping.ts";

export async function buildAllCostCentreReports(
  client: BookamatClient,
  anlagenMapping: AnlagenCostCentreMapping,
): Promise<E1aReport[]> {
  const [bookingGroups, enrichedInventories, costCentres] = await Promise.all([
    client.getBookingsGroupedByCostCentre(),
    client.getEnrichedInventories(),
    client.getCostCentres(),
  ]);

  const inventoriesPartitioned = partitionInventoriesByCostCentre(
    enrichedInventories,
    costCentres,
    anlagenMapping,
  );

  const year = client.year;
  const reports: E1aReport[] = [];

  for (const centre of costCentres) {
    const bookingsForCentre = bookingGroups.find(
      (group) => group.costcentre?.id === centre.id,
    );
    const inventoriesForCentre =
      inventoriesPartitioned.byCostCentreId.get(centre.id) ?? [];

    reports.push(
      buildE1aReport(
        bookingsForCentre?.bookings ?? [],
        inventoriesForCentre,
        centre,
        year,
      ),
    );
  }

  const unassignedBookingsGroup = bookingGroups.find(
    (group) => group.costcentre === null,
  );
  const unassignedBookings = unassignedBookingsGroup?.bookings ?? [];
  const unassignedInventories = inventoriesPartitioned.unassigned;

  if (unassignedBookings.length > 0 || unassignedInventories.length > 0) {
    reports.push(
      buildE1aReport(unassignedBookings, unassignedInventories, null, year),
    );
  }

  return reports;
}
