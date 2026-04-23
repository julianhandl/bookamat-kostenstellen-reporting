/*
 * Accounting-rule tests for buildE1aReport.
 *
 * Each test encodes a rule we discovered while reconciling against the actual
 * Bookamat E1a HTML. When one of these fails, the report is wrong for real
 * accounting data — not just mechanically off. The rules themselves are
 * documented in CLAUDE.md ("Bookamat data quirks").
 */

import { describe, it, expect } from "bun:test";
import { buildE1aReport, type E1aReport } from "./report.ts";
import type {
  EnrichedBooking,
  EnrichedInventory,
} from "../../bookamat/client.ts";
import {
  makeCostAccount,
  makeEnrichedBooking,
  makeEnrichedInventory,
  makeInventoryAmount,
} from "../__tests__/factories.ts";

function setup(args: {
  bookings?: EnrichedBooking[];
  inventories?: EnrichedInventory[];
  year?: number;
}) {
  const year = args.year ?? 2025;
  const given = {
    bookings: args.bookings ?? [],
    inventories: args.inventories ?? [],
    year,
  };
  const report: E1aReport = buildE1aReport(
    given.bookings,
    given.inventories,
    null,
    year,
  );
  const rowByCode = new Map(
    [
      ...report.betriebseinnahmen.rows,
      ...report.betriebsausgaben.rows,
      ...report.freibetraege.rows,
    ].map((row) => [row.kennzahl, row]),
  );
  return { given, then: { report, rowByCode } };
}

describe("buildE1aReport — accounting rules", () => {
  it("sums deductibility_amount_value (BA Betrag), not amount_after_tax", () => {
    // BA Betrag for a 50%-private / 50%-business booking is half the net amount.
    // Using amount_after_tax would double-count the private share.
    const account = makeCostAccount({ index_incometax: ["9230"] });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            {
              deductibility_amount_value: "50.00",
              costaccount: account,
              overrides: {
                amount: "100.00",
                amount_after_tax: "100.00",
                deductibility_amount_percent: "50.00",
              },
            },
          ],
        }),
      ],
    });
    expect(then.rowByCode.get("9230")!.amount).toBe(50);
  });

  it("excludes inventory-purchase bookings (inventory=true, deductibility_amount_percent=0)", () => {
    // Real-world case: "Betriebs- und Geschäftsgebäude" on a booking. The cost
    // account has `inventory: true` and `deductibility_amount_percent: "0.00"`,
    // so the deductibility_amount_value is 0 and the booking must not appear
    // on 9130 (Anlagen depreciation is already counted via the Inventory).
    const inventoryAccount = makeCostAccount({
      index_incometax: ["9130"],
      inventory: true,
      deductibility_amount_percent: "0.00",
    });
    const gwgAccount = makeCostAccount({
      id: 101,
      name: "GWG",
      index_incometax: ["9130"],
    });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            {
              deductibility_amount_value: "0.00",
              costaccount: inventoryAccount,
              overrides: {
                amount: "18.19",
                amount_after_tax: "15.16",
                deductibility_amount_percent: "0.00",
              },
            },
          ],
        }),
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "110.00", costaccount: gwgAccount },
          ],
        }),
      ],
    });
    const row = then.rowByCode.get("9130")!;
    // The inventory-purchase booking contributes 0 to the amount (its BA
    // Betrag is 0) but still appears in the bookings_count — matching how
    // Bookamat's HTML lists it as one of the N bookings on 9130.
    expect(row.amount).toBe(110);
    expect(row.bookings_count).toBe(2);
  });

  it("feeds ALL Kennzahlen listed in a booking's cost-account index_incometax", () => {
    // For bookings (unlike Anlagen), every entry in index_incometax is a real
    // target — the same amount is counted into each listed Kennzahl.
    const account = makeCostAccount({ index_incometax: ["9100", "9230"] });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "30.00", costaccount: account },
          ],
        }),
      ],
    });
    expect(then.rowByCode.get("9100")!.amount).toBe(30);
    expect(then.rowByCode.get("9230")!.amount).toBe(30);
  });

  it("feeds EXACTLY ONE Kennzahl per Anlage — linear, active → 9130", () => {
    // Cost account lists ["9130","9134","9210"]. Applying the amount to all
    // three triples the AfA. Linear + not disposed → 9130 only.
    const account = makeCostAccount({
      index_incometax: ["9130", "9134", "9210"],
    });
    const { then } = setup({
      inventories: [
        makeEnrichedInventory({
          costaccount: account,
          amounts: [
            makeInventoryAmount({ year: 2025, depreciation_amount: "197.80" }),
          ],
        }),
      ],
    });
    expect(then.rowByCode.get("9130")!.amount).toBe(197.8);
    expect(then.rowByCode.get("9130")!.inventory_count).toBe(1);
    expect(then.rowByCode.get("9134")!.amount).toBe(0);
    expect(then.rowByCode.get("9210")!.amount).toBe(0);
  });

  it("feeds 9134 when deductibility_declining_percent is set (degressiv)", () => {
    const account = makeCostAccount({
      index_incometax: ["9130", "9134", "9210"],
    });
    const { then } = setup({
      inventories: [
        makeEnrichedInventory({
          costaccount: account,
          amounts: [
            makeInventoryAmount({ year: 2025, depreciation_amount: "200.00" }),
          ],
          overrides: { deductibility_declining_percent: "30.00" },
        }),
      ],
    });
    expect(then.rowByCode.get("9134")!.amount).toBe(200);
    expect(then.rowByCode.get("9130")!.amount).toBe(0);
    expect(then.rowByCode.get("9210")!.amount).toBe(0);
  });

  it("feeds 9210 when the Anlage is disposed in the report year (Restbuchwert)", () => {
    const account = makeCostAccount({
      index_incometax: ["9130", "9134", "9210"],
    });
    const { then } = setup({
      inventories: [
        makeEnrichedInventory({
          costaccount: account,
          amounts: [
            makeInventoryAmount({ year: 2025, depreciation_amount: "482.50" }),
          ],
          overrides: { date_disposal: "2025-04-03" },
        }),
      ],
    });
    expect(then.rowByCode.get("9210")!.amount).toBe(482.5);
    expect(then.rowByCode.get("9130")!.amount).toBe(0);
  });

  it("does not feed 9210 for Anlagen disposed in a prior year", () => {
    // Disposed in 2023, looking at report year 2025 → not a current disposal,
    // so the (presumably zero) amount must not land on 9210.
    const account = makeCostAccount({
      index_incometax: ["9130", "9134", "9210"],
    });
    const { then } = setup({
      inventories: [
        makeEnrichedInventory({
          costaccount: account,
          amounts: [
            makeInventoryAmount({ year: 2025, depreciation_amount: "0.00" }),
          ],
          overrides: { date_disposal: "2023-04-03" },
        }),
      ],
      year: 2025,
    });
    expect(then.rowByCode.get("9210")!.amount).toBe(0);
    expect(then.rowByCode.get("9210")!.inventory_count).toBe(0);
  });

  it("skips Anlagen whose cost-account index_incometax has no AfA Kennzahl", () => {
    // Cost account only lists some unrelated code (not 9130/9134/9210) — the
    // Anlage shouldn't silently leak into any of them.
    const account = makeCostAccount({ index_incometax: ["9230"] });
    const { then } = setup({
      inventories: [
        makeEnrichedInventory({
          costaccount: account,
          amounts: [
            makeInventoryAmount({ year: 2025, depreciation_amount: "100.00" }),
          ],
        }),
      ],
    });
    expect(then.rowByCode.get("9130")!.amount).toBe(0);
    expect(then.rowByCode.get("9134")!.amount).toBe(0);
    expect(then.rowByCode.get("9210")!.amount).toBe(0);
    expect(then.rowByCode.get("9230")!.amount).toBe(0);
  });

  it("combines booking and Anlagen contributions on the same Kennzahl", () => {
    // The real 2025 case: bookings + Anlagen both contribute to 9130.
    const bookingAccount = makeCostAccount({
      id: 100,
      name: "GWG",
      index_incometax: ["9130"],
    });
    const inventoryAccount = makeCostAccount({
      id: 101,
      name: "Betriebs- und Geschäftsausstattung",
      index_incometax: ["9130", "9134", "9210"],
    });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "550.00", costaccount: bookingAccount },
          ],
        }),
      ],
      inventories: [
        makeEnrichedInventory({
          costaccount: inventoryAccount,
          amounts: [
            makeInventoryAmount({ year: 2025, depreciation_amount: "197.80" }),
          ],
        }),
        makeEnrichedInventory({
          costaccount: inventoryAccount,
          amounts: [
            makeInventoryAmount({ year: 2025, depreciation_amount: "187.50" }),
          ],
        }),
      ],
    });
    const row = then.rowByCode.get("9130")!;
    expect(row.bookings_count).toBe(1);
    expect(row.inventory_count).toBe(2);
    expect(row.amount).toBe(935.3);
  });
});
