/*
 * Test-only factories for the DTOs the reporting code consumes.
 *
 * Each factory returns a fully-valid DTO with sensible defaults. Tests pass
 * a `Partial<...>` to override just the fields they care about, keeping
 * fixture code small and focused on the behaviour under test.
 */

import type {
  Booking,
  BookingAmount,
} from "../../bookamat/types/booking.ts";
import type { CostAccount } from "../../bookamat/types/cost-account.ts";
import type { CostCentre } from "../../bookamat/types/cost-centre.ts";
import type {
  Inventory,
  InventoryAmount,
} from "../../bookamat/types/inventory.ts";
import type { PurchaseTaxAccount } from "../../bookamat/types/purchasetax-account.ts";
import type {
  EnrichedBooking,
  EnrichedBookingAmount,
  EnrichedInventory,
} from "../../bookamat/client.ts";

export function makeCostCentre(overrides: Partial<CostCentre> = {}): CostCentre {
  return {
    id: 1,
    name: "CC",
    position: 0,
    counter_booked_bookings: 0,
    counter_open_bookings: 0,
    counter_deleted_bookings: 0,
    counter_bookingtemplates: 0,
    ...overrides,
  };
}

export function makeCostAccount(overrides: Partial<CostAccount> = {}): CostAccount {
  return {
    id: 100,
    costaccount: 1,
    name: "Cost Account",
    section: "Betriebsausgaben",
    group: "2",
    inventory: false,
    index_incometax: ["9230"],
    deductibility_tax_percent: "100.00",
    deductibility_amount_percent: "100.00",
    description: "",
    active: true,
    purchasetaxaccounts: [],
    counter_booked_bookings: 0,
    counter_open_bookings: 0,
    counter_deleted_bookings: 0,
    counter_bookingtemplates: 0,
    ...overrides,
  };
}

export function makePurchaseTaxAccount(
  overrides: Partial<PurchaseTaxAccount> = {},
): PurchaseTaxAccount {
  return {
    id: 200,
    purchasetaxaccount: 1,
    name: "Purchase Tax",
    section: "",
    group: "2",
    reverse_charge: false,
    ic_report: false,
    ic_delivery: false,
    ic_service: false,
    ioss_report: false,
    eu_oss_report: false,
    tax_values: ["20"],
    index_purchasetax: [],
    description: "",
    active: true,
    counter_booked_bookings: 0,
    counter_open_bookings: 0,
    counter_deleted_bookings: 0,
    counter_bookingtemplates: 0,
    ...overrides,
  };
}

type BookingAmountSpec = {
  deductibility_amount_value: string;
  costaccount: CostAccount;
  purchasetaxaccount?: PurchaseTaxAccount;
  overrides?: Partial<BookingAmount>;
};

export function makeEnrichedBookingAmount(
  spec: BookingAmountSpec,
): EnrichedBookingAmount {
  const pta = spec.purchasetaxaccount ?? makePurchaseTaxAccount();
  const base: BookingAmount = {
    group: "2",
    bankaccount: { id: 1, name: "Bank" },
    costaccount: { id: spec.costaccount.id, name: spec.costaccount.name },
    purchasetaxaccount: { id: pta.id, name: pta.name },
    amount: spec.deductibility_amount_value,
    amount_after_tax: spec.deductibility_amount_value,
    tax_percent: "0.00",
    tax_value: "0.00",
    deductibility_tax_percent: "100.00",
    deductibility_tax_value: "0.00",
    deductibility_amount_percent: "100.00",
    deductibility_amount_value: spec.deductibility_amount_value,
    foreign_business_base: { id: null, vatin: "" },
    country_dep: null,
    country_rec: null,
    ...spec.overrides,
  };
  return {
    ...base,
    costaccount_full: spec.costaccount,
    purchasetaxaccount_full: pta,
  };
}

type EnrichedBookingSpec = {
  id?: number;
  costcentre?: CostCentre | null;
  amounts: BookingAmountSpec[];
  overrides?: Partial<Booking>;
};

export function makeEnrichedBooking(spec: EnrichedBookingSpec): EnrichedBooking {
  const id = spec.id ?? nextId();
  const costcentre = spec.costcentre ?? null;
  const base: Booking = {
    id,
    status: "1",
    title: "",
    document_number: String(id),
    date: "2025-01-01",
    date_invoice: null,
    date_delivery: null,
    date_order: null,
    costcentre:
      costcentre === null
        ? null
        : { id: costcentre.id, name: costcentre.name },
    amounts: [],
    tags: [],
    attachments: [],
    vatin: null,
    country: null,
    description: null,
    create_date: "2025-01-01T00:00:00Z",
    update_date: "2025-01-01T00:00:00Z",
    ...spec.overrides,
  };
  return {
    ...base,
    amounts: spec.amounts.map(makeEnrichedBookingAmount),
    costcentre_full: costcentre,
  };
}

export function makeInventoryAmount(
  overrides: Partial<InventoryAmount> & { year: number },
): InventoryAmount {
  return {
    depreciation_percent: "10.00",
    depreciation_amount: "100.00",
    cumulated_depreciation: "100.00",
    residual_value: "900.00",
    ...overrides,
  };
}

type EnrichedInventorySpec = {
  id?: number;
  title?: string;
  costaccount: CostAccount;
  amounts: InventoryAmount[];
  overrides?: Partial<Inventory>;
};

export function makeEnrichedInventory(
  spec: EnrichedInventorySpec,
): EnrichedInventory {
  const id = spec.id ?? nextId();
  const base: Inventory = {
    id,
    title: spec.title ?? `Inventory ${id}`,
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
    costaccount: { id: spec.costaccount.id, name: spec.costaccount.name },
    amounts: spec.amounts,
    attachments: [],
    description: "",
    seller: "",
    create_date: "2020-01-01T00:00:00Z",
    update_date: "2020-01-01T00:00:00Z",
    ...spec.overrides,
  };
  return { ...base, costaccount_full: spec.costaccount };
}

let autoId = 1_000_000;

function nextId(): number {
  autoId += 1;
  return autoId;
}
