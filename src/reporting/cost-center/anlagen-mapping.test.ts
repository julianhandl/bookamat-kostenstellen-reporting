/*
 * Tests for partitionInventoriesByCostCentre.
 *
 * Two facets:
 *  - Technical: bucketing, unassigned fallback, empty inputs.
 *  - Accounting: "unmapped Anlagen land in the unassigned bucket" is the rule
 *    we need so a half-configured mapping degrades cleanly instead of
 *    silently assigning Anlagen to the wrong cost-centre.
 */

import { describe, it, expect } from "bun:test";
import {
  partitionInventoriesByCostCentre,
  type AnlagenCostCentreMapping,
} from "./anlagen-mapping.ts";
import type { EnrichedInventory } from "../../bookamat/client.ts";
import type { CostCentre } from "../../bookamat/types/cost-centre.ts";
import {
  makeCostAccount,
  makeCostCentre,
  makeEnrichedInventory,
  makeInventoryAmount,
} from "../__tests__/factories.ts";

function setup(args: {
  inventories: EnrichedInventory[];
  costCentres: CostCentre[];
  mapping: AnlagenCostCentreMapping;
}) {
  const given = args;
  const result = partitionInventoriesByCostCentre(
    given.inventories,
    given.costCentres,
    given.mapping,
  );
  return { given, then: result };
}

function anInventory(id: number): EnrichedInventory {
  return makeEnrichedInventory({
    id,
    costaccount: makeCostAccount({ index_incometax: ["9130"] }),
    amounts: [makeInventoryAmount({ year: 2025, depreciation_amount: "100.00" })],
  });
}

describe("partitionInventoriesByCostCentre — technical", () => {
  it("creates an empty bucket for every cost-centre even without matches", () => {
    const cc1 = makeCostCentre({ id: 1, name: "A" });
    const cc2 = makeCostCentre({ id: 2, name: "B" });
    const { then } = setup({
      inventories: [],
      costCentres: [cc1, cc2],
      mapping: new Map(),
    });
    expect(then.byCostCentreId.get(1)).toEqual([]);
    expect(then.byCostCentreId.get(2)).toEqual([]);
    expect(then.unassigned).toEqual([]);
  });

  it("routes mapped Anlagen to the correct bucket", () => {
    const cc1 = makeCostCentre({ id: 1, name: "A" });
    const cc2 = makeCostCentre({ id: 2, name: "B" });
    const invA = anInventory(10);
    const invB = anInventory(20);
    const { then } = setup({
      inventories: [invA, invB],
      costCentres: [cc1, cc2],
      mapping: new Map([
        [10, 1],
        [20, 2],
      ]),
    });
    expect(then.byCostCentreId.get(1)).toEqual([invA]);
    expect(then.byCostCentreId.get(2)).toEqual([invB]);
    expect(then.unassigned).toEqual([]);
  });

  it("throws when the mapping references an unknown cost-centre id", () => {
    const cc1 = makeCostCentre({ id: 1, name: "A" });
    const inv = anInventory(10);
    expect(() =>
      partitionInventoriesByCostCentre(
        [inv],
        [cc1],
        new Map([[10, 999]]),
      ),
    ).toThrow(/unknown cost centre/);
  });
});

describe("partitionInventoriesByCostCentre — accounting rules", () => {
  it("unmapped Anlagen land in the unassigned bucket", () => {
    // Rule: a half-configured mapping must not silently drop Anlagen. Unmapped
    // entries go to unassigned so the UI can surface them for the user.
    const cc1 = makeCostCentre({ id: 1, name: "A" });
    const invMapped = anInventory(10);
    const invUnmapped = anInventory(11);
    const { then } = setup({
      inventories: [invMapped, invUnmapped],
      costCentres: [cc1],
      mapping: new Map([[10, 1]]),
    });
    expect(then.byCostCentreId.get(1)).toEqual([invMapped]);
    expect(then.unassigned).toEqual([invUnmapped]);
  });

  it("an empty mapping sends every Anlage to the unassigned bucket", () => {
    const cc1 = makeCostCentre({ id: 1, name: "A" });
    const inventories = [anInventory(10), anInventory(11), anInventory(12)];
    const { then } = setup({
      inventories,
      costCentres: [cc1],
      mapping: new Map(),
    });
    expect(then.byCostCentreId.get(1)).toEqual([]);
    expect(then.unassigned).toEqual(inventories);
  });
});
