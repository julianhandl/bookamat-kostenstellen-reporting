/*
 * CLI: fetch a full Bookamat snapshot for the configured year and write it
 * to disk as JSON. Invoked via `bun run snapshot`.
 *
 * Config comes from env vars (see .env.example). Optional CLI arg overrides
 * the output path; defaults to `./snapshots/<country>-<year>.json`.
 *
 * Usage:
 *   bun run snapshot
 *   bun run snapshot ./tmp/my-snapshot.json
 */

import { BookamatApiClient } from "../api/api-client.ts";
import { resolveBookamatApiClientConfig } from "../api/config.ts";
import { BookamatClient } from "../client.ts";
import { writeSnapshot } from "../snapshot.ts";

const config = resolveBookamatApiClientConfig();
const api = new BookamatApiClient(config);
const client = BookamatClient.fromApi(api);

const defaultPath = `./snapshots/${config.country}-${config.year}.json`;
const outputPath = process.argv[2] ?? defaultPath;

console.log(
  `Fetching Bookamat snapshot for ${config.country}/${config.year} as ${config.username}...`,
);

const snapshot = await client.toSnapshot();
await writeSnapshot(outputPath, snapshot);

console.log(
  `Wrote snapshot to ${outputPath}:\n` +
    `  cost centres:          ${snapshot.cost_centres.length}\n` +
    `  cost accounts:         ${snapshot.cost_accounts.length}\n` +
    `  purchase-tax accounts: ${snapshot.purchasetax_accounts.length}\n` +
    `  bookings:              ${snapshot.bookings.length}\n` +
    `  inventories:           ${snapshot.inventories.length}`,
);
