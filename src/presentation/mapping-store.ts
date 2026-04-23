/*
 * Persistence for the Anlagen → cost-centre mapping.
 *
 * Stored as a flat JSON object next to the snapshot it belongs to:
 *   snapshots/at-2025.json          (the Bookamat snapshot)
 *   snapshots/at-2025.mapping.json  (the mapping, this module)
 *
 * The on-disk format is `{ "<inventoryId>": <costCentreId> }` — keys are
 * strings because JSON object keys are always strings. `readMapping` rebuilds
 * the in-memory `AnlagenCostCentreMapping` (Map<number, number>).
 */

import type { AnlagenCostCentreMapping } from "../reporting/cost-center/anlagen-mapping.ts";

export function mappingPath(country: string, year: number): string {
  return `./snapshots/${country}-${year}.mapping.json`;
}

export async function readMapping(
  country: string,
  year: number,
): Promise<AnlagenCostCentreMapping> {
  const path = mappingPath(country, year);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return new Map();
  }
  const raw = (await file.json()) as Record<string, number>;
  const mapping: AnlagenCostCentreMapping = new Map();
  for (const [inventoryIdStr, costCentreId] of Object.entries(raw)) {
    const inventoryId = parseInt(inventoryIdStr, 10);
    if (!Number.isInteger(inventoryId)) {
      continue;
    }
    mapping.set(inventoryId, costCentreId);
  }
  return mapping;
}

export async function writeMapping(
  country: string,
  year: number,
  mapping: AnlagenCostCentreMapping,
): Promise<void> {
  const raw: Record<string, number> = {};
  for (const [inventoryId, costCentreId] of mapping) {
    raw[String(inventoryId)] = costCentreId;
  }
  await Bun.write(mappingPath(country, year), JSON.stringify(raw, null, 2));
}
