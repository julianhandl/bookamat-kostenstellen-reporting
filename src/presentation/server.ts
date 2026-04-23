/*
 * Hono server for the web UI.
 *
 * Static frontend at GET /  (index.html + app.js + styles.css from ./public).
 * JSON endpoints under /api:
 *   POST /api/snapshot  — fetch a fresh snapshot from Bookamat and persist.
 *   GET  /api/reports   — load the persisted snapshot + mapping and build
 *                         the ReportsView payload.
 *   PUT  /api/mapping   — persist the Anlagen → cost-centre mapping.
 *
 * Credentials (Bookamat username + API key) are never persisted server-side.
 * They flow once through POST /api/snapshot and are discarded.
 */

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { BookamatApiClient, BookamatApiError } from "../bookamat/api/api-client.ts";
import { BookamatClient } from "../bookamat/client.ts";
import { readSnapshot, writeSnapshot } from "../bookamat/snapshot.ts";
import { buildReportsView } from "./reports-view.ts";
import { readMapping, writeMapping } from "./mapping-store.ts";
import type { AnlagenCostCentreMapping } from "../reporting/cost-center/anlagen-mapping.ts";

type SnapshotRequest = {
  country: string;
  year: number;
  username: string;
  apiKey: string;
};

type MappingRequest = {
  country: string;
  year: number;
  /** `{ "<inventoryId>": <costCentreId> }` — missing keys = unassigned. */
  mapping: Record<string, number>;
};

const app = new Hono();

app.post("/api/snapshot", async (c) => {
  const body = await c.req.json<Partial<SnapshotRequest>>();
  const { country, year, username, apiKey } = body;

  if (
    typeof country !== "string" || country.length === 0 ||
    typeof year !== "number" || !Number.isInteger(year) ||
    typeof username !== "string" || username.length === 0 ||
    typeof apiKey !== "string" || apiKey.length === 0
  ) {
    return c.json(
      { error: "Missing or invalid fields: country, year, username, apiKey" },
      400,
    );
  }

  const api = new BookamatApiClient({ country, year, username, apiKey });
  const client = BookamatClient.fromApi(api);

  try {
    const snapshot = await client.toSnapshot();
    const path = `./snapshots/${country}-${year}.json`;
    await writeSnapshot(path, snapshot);
    return c.json({
      ok: true,
      path,
      counts: {
        cost_centres: snapshot.cost_centres.length,
        cost_accounts: snapshot.cost_accounts.length,
        purchasetax_accounts: snapshot.purchasetax_accounts.length,
        bookings: snapshot.bookings.length,
        inventories: snapshot.inventories.length,
      },
    });
  } catch (err) {
    if (err instanceof BookamatApiError) {
      return c.json(
        { error: `Bookamat API ${err.status}: ${JSON.stringify(err.body)}` },
        502,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

app.get("/api/reports", async (c) => {
  const country = c.req.query("country");
  const yearStr = c.req.query("year");
  if (country === undefined || country.length === 0 || yearStr === undefined) {
    return c.json({ error: "Missing query params: country, year" }, 400);
  }
  const year = parseInt(yearStr, 10);
  if (!Number.isInteger(year)) {
    return c.json({ error: "Invalid year" }, 400);
  }

  const snapshotPath = `./snapshots/${country}-${year}.json`;
  if (!(await Bun.file(snapshotPath).exists())) {
    return c.json(
      { error: `No snapshot for ${country}/${year}. Fetch one first.` },
      404,
    );
  }

  try {
    const snapshot = await readSnapshot(snapshotPath);
    const client = BookamatClient.fromSnapshot(snapshot);
    const mapping = await readMapping(country, year);
    const view = await buildReportsView(client, snapshot.fetched_at, mapping);
    return c.json(view);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

app.put("/api/mapping", async (c) => {
  const body = await c.req.json<Partial<MappingRequest>>();
  const { country, year, mapping: rawMapping } = body;

  if (
    typeof country !== "string" || country.length === 0 ||
    typeof year !== "number" || !Number.isInteger(year) ||
    rawMapping === undefined || rawMapping === null || typeof rawMapping !== "object"
  ) {
    return c.json({ error: "Missing or invalid fields: country, year, mapping" }, 400);
  }

  const mapping: AnlagenCostCentreMapping = new Map();
  for (const [inventoryIdStr, costCentreId] of Object.entries(rawMapping)) {
    const inventoryId = parseInt(inventoryIdStr, 10);
    if (!Number.isInteger(inventoryId) || typeof costCentreId !== "number") {
      continue;
    }
    mapping.set(inventoryId, costCentreId);
  }

  await writeMapping(country, year, mapping);
  return c.json({ ok: true, entries: mapping.size });
});

// Static frontend — served from src/presentation/public/.
app.use(
  "/*",
  serveStatic({
    root: "./src/presentation/public",
    rewriteRequestPath: (path) => (path === "/" ? "/index.html" : path),
  }),
);

export default app;
