/*
 * Anlagen → cost-centre mapping.
 *
 * Bookamat itself has no cost-centre on the Anlage schema. For per-cost-centre
 * E1a reports we maintain an external mapping from Anlage id to cost-centre id.
 * The UI that lets a user edit this mapping will come in a later part — for
 * now this module only exposes the type and a partitioning helper that uses it.
 */

import type { EnrichedInventory } from "../../bookamat/client.ts";
import type { CostCentre } from "../../bookamat/types/cost-centre.ts";

/**
 * Maps an Anlage id to the cost-centre id it belongs to. Anlagen whose id is
 * not in the map land in the "unassigned" bucket (same pattern as bookings
 * without a cost-centre).
 */
export type AnlagenCostCentreMapping = Map<number, number>;

export type PartitionedInventories = {
  byCostCentreId: Map<number, EnrichedInventory[]>;
  unassigned: EnrichedInventory[];
};

export function partitionInventoriesByCostCentre(
  inventories: EnrichedInventory[],
  costCentres: CostCentre[],
  mapping: AnlagenCostCentreMapping,
): PartitionedInventories {
  const byCostCentreId = new Map<number, EnrichedInventory[]>();
  for (const centre of costCentres) {
    byCostCentreId.set(centre.id, []);
  }
  const unassigned: EnrichedInventory[] = [];

  for (const inventory of inventories) {
    const costCentreId = mapping.get(inventory.id);
    if (costCentreId === undefined) {
      unassigned.push(inventory);
      continue;
    }
    const bucket = byCostCentreId.get(costCentreId);
    if (bucket === undefined) {
      throw new Error(
        `Anlagen mapping for inventory ${inventory.id} references unknown cost centre ${costCentreId}. ` +
          `Cost-centres cache may be stale or mapping is invalid.`,
      );
    }
    bucket.push(inventory);
  }

  return { byCostCentreId, unassigned };
}
