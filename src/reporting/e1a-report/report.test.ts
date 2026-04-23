/*
 * Technical tests for buildE1aReport.
 *
 * These cover the mechanical properties of the function — row layout, row
 * counts, section sums, overall arithmetic, integer-cents rounding — using
 * synthetic DTOs built via the factories. Accounting-domain rules (which
 * Kennzahl an Anlage feeds, partial deductibility, etc.) live in the
 * `.accounting.test.ts` companion.
 */

import { describe, it, expect } from "bun:test";
import { buildE1aReport, type E1aReport } from "./report.ts";
import { KENNZAHLEN } from "./kennzahlen.ts";
import type {
  EnrichedBooking,
  EnrichedInventory,
} from "../../bookamat/client.ts";
import type { CostCentre } from "../../bookamat/types/cost-centre.ts";
import {
  makeCostAccount,
  makeCostCentre,
  makeEnrichedBooking,
  makeEnrichedInventory,
  makeInventoryAmount,
} from "../__tests__/factories.ts";

function setup(args: {
  bookings?: EnrichedBooking[];
  inventories?: EnrichedInventory[];
  costcentre?: CostCentre | null;
  year?: number;
} = {}) {
  const given = {
    bookings: args.bookings ?? [],
    inventories: args.inventories ?? [],
    costcentre: args.costcentre ?? null,
    year: args.year ?? 2025,
  };
  const then: { report: E1aReport } = {
    report: buildE1aReport(
      given.bookings,
      given.inventories,
      given.costcentre,
      given.year,
    ),
  };
  return { given, then };
}

describe("buildE1aReport — technical", () => {
  it("returns an all-zero report for empty inputs", () => {
    const { then } = setup();
    expect(then.report.betriebseinnahmen.sum).toBe(0);
    expect(then.report.betriebsausgaben.sum).toBe(0);
    expect(then.report.freibetraege.sum).toBe(0);
    expect(then.report.gewinn_verlust).toBe(0);
    expect(then.report.betriebsergebnis).toBe(0);
  });

  it("emits one row per Kennzahl in each section, in KENNZAHLEN order", () => {
    const { then } = setup();
    const allRows = [
      ...then.report.betriebseinnahmen.rows,
      ...then.report.betriebsausgaben.rows,
      ...then.report.freibetraege.rows,
    ];
    expect(allRows.length).toBe(KENNZAHLEN.length);
    const emittedOrder = allRows.map((r) => r.kennzahl);
    const expectedOrder = KENNZAHLEN.map((k) => k.code);
    expect(emittedOrder).toEqual(expectedOrder);
  });

  it("passes costcentre and year through unchanged", () => {
    const cc = makeCostCentre({ id: 42, name: "Test" });
    const { then } = setup({ costcentre: cc, year: 2030 });
    expect(then.report.costcentre).toBe(cc);
    expect(then.report.year).toBe(2030);
  });

  it("freibetraege amounts are always 0 regardless of inputs", () => {
    // Freibeträge are user-entered in Bookamat; the report never derives them
    // from bookings. The *counts* are not surfaced in the HTML for this
    // section, so we only assert the amount side.
    const account = makeCostAccount({ index_incometax: ["9221", "9277"] });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "999.99", costaccount: account },
          ],
        }),
      ],
    });
    for (const row of then.report.freibetraege.rows) {
      expect(row.amount).toBe(0);
    }
    expect(then.report.freibetraege.sum).toBe(0);
  });

  it("sums booking amounts into the right Kennzahl row", () => {
    const account = makeCostAccount({ index_incometax: ["9230"] });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "100.00", costaccount: account },
            { deductibility_amount_value: "50.25", costaccount: account },
          ],
        }),
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "9.99", costaccount: account },
          ],
        }),
      ],
    });
    const row = then.report.betriebsausgaben.rows.find(
      (r) => r.kennzahl === "9230",
    )!;
    expect(row.bookings_count).toBe(2);
    expect(row.amount).toBe(160.24);
    expect(then.report.betriebsausgaben.sum).toBe(160.24);
  });

  it("counts distinct bookings even when one booking has multiple matching amounts", () => {
    const account = makeCostAccount({ index_incometax: ["9230"] });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "1.00", costaccount: account },
            { deductibility_amount_value: "2.00", costaccount: account },
            { deductibility_amount_value: "3.00", costaccount: account },
          ],
        }),
      ],
    });
    const row = then.report.betriebsausgaben.rows.find(
      (r) => r.kennzahl === "9230",
    )!;
    expect(row.bookings_count).toBe(1);
    expect(row.amount).toBe(6);
  });

  it("ignores unknown kennzahlen in index_incometax (e.g. UVA codes)", () => {
    const account = makeCostAccount({ index_incometax: ["0000"] });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "100.00", costaccount: account },
          ],
        }),
      ],
    });
    expect(then.report.betriebsausgaben.sum).toBe(0);
    expect(then.report.betriebseinnahmen.sum).toBe(0);
  });

  it("does not drift on many small decimal amounts (integer-cents arithmetic)", () => {
    const account = makeCostAccount({ index_incometax: ["9230"] });
    const amounts = Array.from({ length: 1000 }, () => ({
      deductibility_amount_value: "0.10",
      costaccount: account,
    }));
    const { then } = setup({
      bookings: [makeEnrichedBooking({ amounts })],
    });
    const row = then.report.betriebsausgaben.rows.find(
      (r) => r.kennzahl === "9230",
    )!;
    // 1000 × 0.10 = 100.00 exactly, not 99.99999... or 100.00000001.
    expect(row.amount).toBe(100);
  });

  it("computes gewinn_verlust and betriebsergebnis from section sums", () => {
    const income = makeCostAccount({
      index_incometax: ["9040"],
      group: "1",
    });
    const expense = makeCostAccount({ index_incometax: ["9230"] });
    const { then } = setup({
      bookings: [
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "500.00", costaccount: income },
          ],
        }),
        makeEnrichedBooking({
          amounts: [
            { deductibility_amount_value: "120.00", costaccount: expense },
          ],
        }),
      ],
    });
    expect(then.report.betriebseinnahmen.sum).toBe(500);
    expect(then.report.betriebsausgaben.sum).toBe(120);
    expect(then.report.gewinn_verlust).toBe(380);
    // Freibeträge always 0 in v1, so betriebsergebnis === gewinn_verlust.
    expect(then.report.betriebsergebnis).toBe(380);
  });

  it("skips Anlagen without an amounts[] entry for the report year", () => {
    const account = makeCostAccount({ index_incometax: ["9130"] });
    const { then } = setup({
      inventories: [
        makeEnrichedInventory({
          costaccount: account,
          amounts: [makeInventoryAmount({ year: 2024, depreciation_amount: "100.00" })],
        }),
      ],
      year: 2025,
    });
    const row = then.report.betriebsausgaben.rows.find(
      (r) => r.kennzahl === "9130",
    )!;
    expect(row.inventory_count).toBe(0);
    expect(row.amount).toBe(0);
  });

  it("skips Anlagen whose current-year depreciation_amount is 0", () => {
    const account = makeCostAccount({ index_incometax: ["9130"] });
    const { then } = setup({
      inventories: [
        makeEnrichedInventory({
          costaccount: account,
          amounts: [makeInventoryAmount({ year: 2025, depreciation_amount: "0.00" })],
        }),
      ],
      year: 2025,
    });
    const row = then.report.betriebsausgaben.rows.find(
      (r) => r.kennzahl === "9130",
    )!;
    expect(row.inventory_count).toBe(0);
    expect(row.amount).toBe(0);
  });
});
