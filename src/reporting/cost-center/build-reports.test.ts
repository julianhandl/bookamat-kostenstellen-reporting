/*
 * Tests for buildAllCostCentreReports.
 *
 * Constructs a BookamatClient from a synthetic Snapshot so we get the real
 * enrichment code in the loop (costaccount/purchasetax/costcentre joining)
 * and only mock the data layer.
 */

import { describe, it, expect } from "bun:test";
import { buildAllCostCentreReports } from "./build-reports.ts";
import { BookamatClient } from "../../bookamat/client.ts";
import type { Snapshot } from "../../bookamat/snapshot.ts";
import type { Booking, BookingAmount } from "../../bookamat/types/booking.ts";
import type { CostCentre } from "../../bookamat/types/cost-centre.ts";
import type { Inventory } from "../../bookamat/types/inventory.ts";
import type { AnlagenCostCentreMapping } from "./anlagen-mapping.ts";
import {
  makeCostAccount,
  makeCostCentre,
  makeInventoryAmount,
  makePurchaseTaxAccount,
} from "../__tests__/factories.ts";

function setup(args: {
  year?: number;
  costCentres?: CostCentre[];
  bookings?: Booking[];
  inventories?: Inventory[];
  mapping?: AnlagenCostCentreMapping;
  costAccount?: ReturnType<typeof makeCostAccount>;
}) {
  const year = args.year ?? 2025;
  const costCentres = args.costCentres ?? [];
  const costAccount =
    args.costAccount ?? makeCostAccount({ index_incometax: ["9230"] });
  const purchaseTaxAccount = makePurchaseTaxAccount();

  const snapshot: Snapshot = {
    schema_version: 2,
    country: "at",
    year,
    fetched_at: "2025-01-01T00:00:00Z",
    cost_centres: costCentres,
    cost_accounts: [costAccount],
    purchasetax_accounts: [purchaseTaxAccount],
    bookings: args.bookings ?? [],
    inventories: args.inventories ?? [],
  };

  const client = BookamatClient.fromSnapshot(snapshot);
  const mapping = args.mapping ?? new Map();

  return {
    given: { snapshot, costAccount, purchaseTaxAccount, year, mapping },
    then: async () => buildAllCostCentreReports(client, mapping),
  };
}

function rawBooking(args: {
  id: number;
  costCentreId: number | null;
  amounts: { value: string; costAccountId: number; purchaseTaxAccountId: number }[];
}): Booking {
  const amounts: BookingAmount[] = args.amounts.map((a) => ({
    group: "2",
    bankaccount: { id: 1, name: "Bank" },
    costaccount: { id: a.costAccountId, name: "CA" },
    purchasetaxaccount: { id: a.purchaseTaxAccountId, name: "PTA" },
    amount: a.value,
    amount_after_tax: a.value,
    tax_percent: "0.00",
    tax_value: "0.00",
    deductibility_tax_percent: "100.00",
    deductibility_tax_value: "0.00",
    deductibility_amount_percent: "100.00",
    deductibility_amount_value: a.value,
    foreign_business_base: { id: null, vatin: "" },
    country_dep: null,
    country_rec: null,
  }));
  return {
    id: args.id,
    status: "1",
    title: "",
    document_number: String(args.id),
    date: "2025-01-01",
    date_invoice: null,
    date_delivery: null,
    date_order: null,
    costcentre:
      args.costCentreId === null ? null : { id: args.costCentreId, name: "" },
    amounts,
    tags: [],
    attachments: [],
    vatin: null,
    country: null,
    description: null,
    create_date: "2025-01-01T00:00:00Z",
    update_date: "2025-01-01T00:00:00Z",
  };
}

function rawInventory(args: {
  id: number;
  costAccountId: number;
  depreciationThisYear: string;
  year: number;
}): Inventory {
  return {
    id: args.id,
    title: `Inventory ${args.id}`,
    date_purchase: "2020-01-01",
    date_commissioning: "2020-01-01",
    date_disposal: null,
    amount_after_tax: "1000.00",
    deductibility_percent: "100.00",
    deductibility_amount: "1000.00",
    deductibility_declining_percent: null,
    deductibility_switch_year: null,
    deductibility_years: 10,
    deductibility_type: { id: 1, name: "Linear" },
    costaccount: { id: args.costAccountId, name: "CA" },
    amounts: [
      makeInventoryAmount({
        year: args.year,
        depreciation_amount: args.depreciationThisYear,
      }),
    ],
    attachments: [],
    description: "",
    seller: "",
    create_date: "2020-01-01T00:00:00Z",
    update_date: "2020-01-01T00:00:00Z",
  };
}

describe("buildAllCostCentreReports — technical", () => {
  it("returns an empty list when there are no cost-centres, bookings or Anlagen", async () => {
    const { then } = setup({});
    expect(await then()).toEqual([]);
  });

  it("produces exactly one report per cost-centre (no unassigned when empty)", async () => {
    const ccA = makeCostCentre({ id: 1, name: "A" });
    const ccB = makeCostCentre({ id: 2, name: "B" });
    const costAccount = makeCostAccount({ index_incometax: ["9230"] });
    const { given, then } = setup({
      costCentres: [ccA, ccB],
      costAccount,
      bookings: [
        rawBooking({
          id: 1,
          costCentreId: 1,
          amounts: [{ value: "10.00", costAccountId: costAccount.id, purchaseTaxAccountId: 200 }],
        }),
      ],
    });
    const reports = await then();
    expect(reports.length).toBe(2);
    expect(reports.map((r) => r.costcentre?.name)).toEqual(["A", "B"]);
    expect(given.mapping.size).toBe(0);
  });

  it("adds an unassigned bucket only when bookings or Anlagen need it", async () => {
    const ccA = makeCostCentre({ id: 1, name: "A" });
    const costAccount = makeCostAccount({ index_incometax: ["9230"] });
    const { then } = setup({
      costCentres: [ccA],
      costAccount,
      bookings: [
        rawBooking({
          id: 1,
          costCentreId: null,
          amounts: [{ value: "5.00", costAccountId: costAccount.id, purchaseTaxAccountId: 200 }],
        }),
      ],
    });
    const reports = await then();
    expect(reports.length).toBe(2);
    expect(reports[1]!.costcentre).toBeNull();
    expect(reports[1]!.betriebsausgaben.sum).toBe(5);
  });
});

describe("buildAllCostCentreReports — accounting rules", () => {
  it("routes Anlagen to cost-centres via the mapping", async () => {
    const ccA = makeCostCentre({ id: 1, name: "A" });
    const ccB = makeCostCentre({ id: 2, name: "B" });
    const costAccount = makeCostAccount({ index_incometax: ["9130"] });
    const { then } = setup({
      costCentres: [ccA, ccB],
      costAccount,
      inventories: [
        rawInventory({
          id: 10,
          costAccountId: costAccount.id,
          depreciationThisYear: "197.80",
          year: 2025,
        }),
        rawInventory({
          id: 11,
          costAccountId: costAccount.id,
          depreciationThisYear: "187.50",
          year: 2025,
        }),
      ],
      mapping: new Map([
        [10, 1],
        [11, 2],
      ]),
    });
    const reports = await then();
    const reportA = reports.find((r) => r.costcentre?.id === 1)!;
    const reportB = reports.find((r) => r.costcentre?.id === 2)!;
    expect(
      reportA.betriebsausgaben.rows.find((r) => r.kennzahl === "9130")!.amount,
    ).toBe(197.8);
    expect(
      reportB.betriebsausgaben.rows.find((r) => r.kennzahl === "9130")!.amount,
    ).toBe(187.5);
  });

  it("sends unmapped Anlagen to the unassigned bucket", async () => {
    const ccA = makeCostCentre({ id: 1, name: "A" });
    const costAccount = makeCostAccount({ index_incometax: ["9130"] });
    const { then } = setup({
      costCentres: [ccA],
      costAccount,
      inventories: [
        rawInventory({
          id: 10,
          costAccountId: costAccount.id,
          depreciationThisYear: "200.00",
          year: 2025,
        }),
      ],
      mapping: new Map(),
    });
    const reports = await then();
    expect(reports.length).toBe(2);
    const unassigned = reports[1]!;
    expect(unassigned.costcentre).toBeNull();
    expect(
      unassigned.betriebsausgaben.rows.find((r) => r.kennzahl === "9130")!.amount,
    ).toBe(200);
  });

  it("splits bookings by cost-centre without Anlagen bleed (booking-side lossless)", async () => {
    // Same cost-account on two bookings, one per cost-centre. The per-cost-centre
    // sums must add up to the single-combined-report sum exactly.
    const ccA = makeCostCentre({ id: 1, name: "A" });
    const ccB = makeCostCentre({ id: 2, name: "B" });
    const costAccount = makeCostAccount({ index_incometax: ["9230"] });
    const { then } = setup({
      costCentres: [ccA, ccB],
      costAccount,
      bookings: [
        rawBooking({
          id: 1,
          costCentreId: 1,
          amounts: [{ value: "30.00", costAccountId: costAccount.id, purchaseTaxAccountId: 200 }],
        }),
        rawBooking({
          id: 2,
          costCentreId: 2,
          amounts: [{ value: "70.00", costAccountId: costAccount.id, purchaseTaxAccountId: 200 }],
        }),
      ],
    });
    const reports = await then();
    const totalPerCC = reports.reduce(
      (acc, r) =>
        acc + (r.betriebsausgaben.rows.find((row) => row.kennzahl === "9230")!.amount),
      0,
    );
    expect(totalPerCC).toBe(100);
  });
});
