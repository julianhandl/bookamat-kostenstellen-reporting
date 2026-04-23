/*
 * JSON snapshot of all Bookamat data needed to regenerate the report offline.
 *
 * Stores the raw DTOs (no mapping, per CLAUDE.md). Enrichment and grouping
 * are reapplied at load time by BookamatClient.
 */

import type { Booking } from "./types/booking.ts";
import type { CostAccount } from "./types/cost-account.ts";
import type { CostCentre } from "./types/cost-centre.ts";
import type { Inventory } from "./types/inventory.ts";
import type { PurchaseTaxAccount } from "./types/purchasetax-account.ts";

export type Snapshot = {
  schema_version: 2;
  /** Lowercase ISO country code used to fetch the data, e.g. `"at"`. */
  country: string;
  /** Reporting year the data belongs to. */
  year: number;
  /** ISO datetime when the snapshot was taken. */
  fetched_at: string;
  cost_centres: CostCentre[];
  cost_accounts: CostAccount[];
  purchasetax_accounts: PurchaseTaxAccount[];
  /** Raw booked bookings — only `status === "1"`, pre-enrichment. */
  bookings: Booking[];
  /** Raw Anlagen (fixed assets). Added in schema_version 2. */
  inventories: Inventory[];
};

export async function writeSnapshot(
  path: string,
  snapshot: Snapshot,
): Promise<void> {
  await Bun.write(path, JSON.stringify(snapshot, null, 2));
}

export async function readSnapshot(path: string): Promise<Snapshot> {
  const parsed = (await Bun.file(path).json()) as Snapshot;
  if (parsed.schema_version !== 2) {
    throw new Error(
      `Unsupported snapshot schema_version ${parsed.schema_version} at ${path} ` +
        `(expected 2). Regenerate via \`bun run snapshot\`.`,
    );
  }
  return parsed;
}
