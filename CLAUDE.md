## Project setup

This project uses hono as it's backend and a simple static html with javascript to show the data from hono.

Follow the existing file and folderstructure. Avoide barrel files.
Create simple and readable code. Early returns. Strictly typed in and output of each method. Avoid atomic functions and group code logically. No one of function that are not reused anywhere. Prefer longer function (max 100 lines) for readability and easy mental model, but keep the complexity low.

Don't map datastructures. I want to keep working with the dtos from the bookamat api.

## Project Context

This project is a reporting tool that gets data from the api of an accounting software, processes it and generates an html report from it.

### Accounting software

Bookamat is an austrian accounting software. It provides full api access.
https://www.bookamat.com/dokumentation/api/v1/index.html
The software provides full accounting management for austria.
It is very feature rich and can generate the austrian E1a report (Einkommenssteuererklärung).

If you run multiple businesses in austria as one person, you have to provide the Einkommenssteuererklärung (E1a) for every business indivitually. This is not supported in bookamat.

### Feature of this webapp

Providing E1a reports for every cost center (isolated)

- getting all the data from the bookamat api
- processing the report
- showing the report for every cost center

## Package Manager and Runtime: Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Bookamat data quirks

Things learned while implementing the E1a calculation that the API docs do not say.

- **List pagination is unstable with non-unique `ordering`.** The list endpoints use offset pagination; ordering by a non-unique field (e.g. `date`) silently drops and/or duplicates rows on page boundaries when multiple entries share the sort key. Always order `list*All` calls by `id` (unique). Seen in the wild: `ordering=date` dropped one booking and returned another twice while the server's `count` matched the total.
- **`Booking.costcentre` can be `null`**, not only `{ id: null, name: "" }`. Treat both shapes as "unassigned".
- **Anlagen have no cost-centre field.** Per-cost-centre allocation requires an external mapping (`AnlagenCostCentreMapping`).
- **`CostAccount.index_incometax` is a candidate list, not an assignment.** For Anlagen the same account lists `["9130","9134","9210"]`. The actual Kennzahl depends on the Anlage state, not the list:
  - `date_disposal` in the report year → 9210 (Restbuchwert)
  - `deductibility_declining_percent !== null` → 9134 (degressiv)
  - otherwise → 9130 (linear AfA / GWG)
  Applying the amount to every entry in the list triple-counts. For **bookings** the same field behaves as expected (sum into every Kennzahl listed).
- **"BA Betrag" is `BookingAmount.deductibility_amount_value`**, not `amount_after_tax`. Partial-deductibility amounts (e.g. 50% private) only come out right with `deductibility_amount_value`.
- **AfA is per-year.** Use the `Inventory.amounts[]` entry with `year === reportYear`. Missing entry or `depreciation_amount === "0.00"` means no contribution that year (fully depreciated or disposed).
- **HTML "inventory counter" in the E1a report is cosmetic** and does not match the amount side. Bookamat lists all active Anlagen on the relevant cost account even when their current-year depreciation is 0. Do not try to reconcile it.
- **Half-year rule.** First-year depreciation percents like 16.67 / 33.33 / 33.33 / 16.67 (linear, 3 years) are the half-year rule (purchase in H2 → half-year AfA in year 1). Nothing to do in code; just don't be confused.
- **Decimal strings throughout.** Parse monetary/percent fields with `Math.round(parseFloat(x) * 100)` and sum in integer cents; the snapshot totals fit comfortably in `number`.
- **Snapshot schema is versioned.** Bump `schema_version` when adding fields and reject older versions in `readSnapshot` with a message pointing at `bun run snapshot`.

## Data flow

Three layers, each consuming the one below and adding nothing else:

1. **`BookamatApiClient`** ([src/bookamat/api/api-client.ts](src/bookamat/api/api-client.ts)) — thin HTTP mirror. One method per endpoint, plus `list*All` helpers that walk `next` links. No caching, no mapping. Used directly only by `fetch-snapshot`.
2. **`BookamatClient`** ([src/bookamat/client.ts](src/bookamat/client.ts)) — cross-endpoint data layer. Lazy-caches each entity, joins `id+name` stubs into full DTOs (`EnrichedBooking`, `EnrichedInventory`), groups bookings by cost-centre. Two constructors: `fromApi(api)` (live) and `fromSnapshot(snapshot)` (replay). Both expose the same methods.
3. **Reporting** ([src/reporting/](src/reporting/)) — pure functions over enriched DTOs.
   - `buildE1aReport(bookings, inventories, costcentre, year)` computes one E1a report from pre-filtered inputs.
   - `buildAllCostCentreReports(client, anlagenMapping)` orchestrates: grouped bookings × partitioned Anlagen → one report per cost-centre, plus an unassigned bucket when non-empty.
   - `KENNZAHLEN` ([src/reporting/e1a-report/kennzahlen.ts](src/reporting/e1a-report/kennzahlen.ts)) is the static order + labels. Sections: `betriebseinnahmen`, `betriebsausgaben`, `freibetraege`. Freibeträge are always 0 (user-entered in Bookamat).

### Report calculation in one paragraph

Sum `BookingAmount.deductibility_amount_value` into every Kennzahl listed in `costaccount_full.index_incometax`; sum the current year's `Inventory.amounts[year=N].depreciation_amount` into **exactly one** Kennzahl per Anlage (picked by state — see quirks above). Arithmetic in integer cents. Sums: `gewinn_verlust = einnahmen.sum − ausgaben.sum`; `betriebsergebnis = gewinn_verlust − freibetraege.sum`.

### Anlagen → cost-centre mapping

Bookamat has no cost-centre on Anlagen. Callers pass an `AnlagenCostCentreMapping` (`Map<inventoryId, costcentreId>`) to `buildAllCostCentreReports`. Unmapped Anlagen land in the unassigned bucket. Empty map = all Anlagen unassigned. A UI for editing this mapping is planned for a later part; for now the mapping is provided in-code by callers.

## How to use

- **`bun run snapshot`** — fetches a full snapshot from Bookamat (needs env vars; see [.env.example](.env.example)) and writes `snapshots/<country>-<year>.json`. Do this whenever the data changes. Snapshots are the primary dev input — no live API calls needed at report time.
- **`bun run src/reporting/scripts/verify-2025.ts`** — hermetic acceptance test. Loads the 2025 snapshot, builds a combined report + per-cost-centre split, asserts totals. Exits 0 on success. Run after changing anything in `src/reporting/` or the enrichment code.
- **`bun run dev`** — starts the Hono app with hot reload. Currently just a placeholder route; the HTML report UI comes in a later part.
- **Building a report programmatically:** construct `BookamatClient.fromSnapshot(await readSnapshot(path))` (or `fromApi(...)` for live), then call `buildAllCostCentreReports(client, mapping)`.
