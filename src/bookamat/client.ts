/*
 * BookamatClient — cross-endpoint data layer.
 *
 * Sits on top of BookamatApiClient (raw HTTP). Fetches the four entities
 * needed by the report, caches them lazily, and joins the relational
 * references Bookamat returns as id+name stubs into full objects.
 *
 * Two modes: `fromApi` pulls live from the API, `fromSnapshot` replays a
 * previously saved JSON snapshot. Both modes expose the exact same methods.
 */

import type { BookamatApiClient } from "./api/api-client.ts";
import type { Snapshot } from "./snapshot.ts";
import type {
  Booking,
  BookingAmount,
} from "./types/booking.ts";
import type { CostAccount } from "./types/cost-account.ts";
import type { CostCentre } from "./types/cost-centre.ts";
import type { Inventory } from "./types/inventory.ts";
import type { PurchaseTaxAccount } from "./types/purchasetax-account.ts";

/**
 * A booking amount with its referenced cost/tax accounts resolved to the
 * full entities. The original `costaccount` / `purchasetaxaccount` stubs are
 * preserved alongside the `*_full` fields.
 */
export type EnrichedBookingAmount = BookingAmount & {
  costaccount_full: CostAccount;
  purchasetaxaccount_full: PurchaseTaxAccount;
};

/**
 * A booking with every amount enriched and the cost centre resolved to the
 * full `CostCentre` (or `null` when the booking is unassigned).
 */
export type EnrichedBooking = Omit<Booking, "amounts"> & {
  amounts: EnrichedBookingAmount[];
  costcentre_full: CostCentre | null;
};

/**
 * A cost centre bucket. `costcentre` is `null` for the catch-all bucket of
 * bookings that have no cost centre assigned.
 */
export type CostCentreGroup = {
  costcentre: CostCentre | null;
  bookings: EnrichedBooking[];
};

/**
 * An Anlage with its `costaccount` stub resolved to the full `CostAccount`.
 * The original stub is preserved alongside `costaccount_full`.
 */
export type EnrichedInventory = Inventory & {
  costaccount_full: CostAccount;
};

/**
 * Internal data source — abstracts "live HTTP" from "loaded snapshot".
 * Both sources return the exact same DTOs; the client doesn't know which.
 */
type DataSource = {
  country: string;
  year: number;
  fetchCostCentres(): Promise<CostCentre[]>;
  fetchCostAccounts(): Promise<CostAccount[]>;
  fetchPurchaseTaxAccounts(): Promise<PurchaseTaxAccount[]>;
  fetchBookings(): Promise<Booking[]>;
  fetchInventories(): Promise<Inventory[]>;
};

export class BookamatClient {
  private readonly source: DataSource;

  private costCentresPromise: Promise<CostCentre[]> | null = null;
  private costAccountsPromise: Promise<CostAccount[]> | null = null;
  private purchaseTaxAccountsPromise: Promise<PurchaseTaxAccount[]> | null = null;
  private bookingsPromise: Promise<Booking[]> | null = null;
  private enrichedBookingsPromise: Promise<EnrichedBooking[]> | null = null;
  private inventoriesPromise: Promise<Inventory[]> | null = null;
  private enrichedInventoriesPromise: Promise<EnrichedInventory[]> | null = null;

  private constructor(source: DataSource) {
    this.source = source;
  }

  static fromApi(api: BookamatApiClient): BookamatClient {
    return new BookamatClient({
      country: api.country,
      year: api.year,
      fetchCostCentres: () => api.listCostCentresAll(),
      fetchCostAccounts: () => api.listCostAccountsAll(),
      fetchPurchaseTaxAccounts: () => api.listPurchaseTaxAccountsAll(),
      // `/bookings/` only returns status "1" (booked), which is what we want.
      // Order by `id` (unique) — ordering by a non-unique field like `date`
      // makes offset pagination unstable: rows on a page boundary with the
      // same sort key can be duplicated or skipped between pages.
      fetchBookings: () => api.listBookingsAll({ ordering: "id" }),
      fetchInventories: () => api.listInventoriesAll({ ordering: "id" }),
    });
  }

  static fromSnapshot(snapshot: Snapshot): BookamatClient {
    return new BookamatClient({
      country: snapshot.country,
      year: snapshot.year,
      fetchCostCentres: () => Promise.resolve(snapshot.cost_centres),
      fetchCostAccounts: () => Promise.resolve(snapshot.cost_accounts),
      fetchPurchaseTaxAccounts: () =>
        Promise.resolve(snapshot.purchasetax_accounts),
      fetchBookings: () => Promise.resolve(snapshot.bookings),
      fetchInventories: () => Promise.resolve(snapshot.inventories),
    });
  }

  get country(): string {
    return this.source.country;
  }

  get year(): number {
    return this.source.year;
  }

  // ---------------------------------------------------------------------------
  // Raw cached reads
  // ---------------------------------------------------------------------------

  getCostCentres(): Promise<CostCentre[]> {
    if (this.costCentresPromise === null) {
      this.costCentresPromise = this.source.fetchCostCentres();
    }
    return this.costCentresPromise;
  }

  getCostAccounts(): Promise<CostAccount[]> {
    if (this.costAccountsPromise === null) {
      this.costAccountsPromise = this.source.fetchCostAccounts();
    }
    return this.costAccountsPromise;
  }

  getPurchaseTaxAccounts(): Promise<PurchaseTaxAccount[]> {
    if (this.purchaseTaxAccountsPromise === null) {
      this.purchaseTaxAccountsPromise =
        this.source.fetchPurchaseTaxAccounts();
    }
    return this.purchaseTaxAccountsPromise;
  }

  getBookings(): Promise<Booking[]> {
    if (this.bookingsPromise === null) {
      this.bookingsPromise = this.source.fetchBookings();
    }
    return this.bookingsPromise;
  }

  getInventories(): Promise<Inventory[]> {
    if (this.inventoriesPromise === null) {
      this.inventoriesPromise = this.source.fetchInventories();
    }
    return this.inventoriesPromise;
  }

  // ---------------------------------------------------------------------------
  // Id lookups
  // ---------------------------------------------------------------------------

  async getCostCentre(id: number): Promise<CostCentre | undefined> {
    const all = await this.getCostCentres();
    return all.find((entry) => entry.id === id);
  }

  async getCostAccount(id: number): Promise<CostAccount | undefined> {
    const all = await this.getCostAccounts();
    return all.find((entry) => entry.id === id);
  }

  async getPurchaseTaxAccount(
    id: number,
  ): Promise<PurchaseTaxAccount | undefined> {
    const all = await this.getPurchaseTaxAccounts();
    return all.find((entry) => entry.id === id);
  }

  async getInventory(id: number): Promise<Inventory | undefined> {
    const all = await this.getInventories();
    return all.find((entry) => entry.id === id);
  }

  // ---------------------------------------------------------------------------
  // Enriched reads
  // ---------------------------------------------------------------------------

  getEnrichedBookings(): Promise<EnrichedBooking[]> {
    if (this.enrichedBookingsPromise === null) {
      this.enrichedBookingsPromise = this.buildEnrichedBookings();
    }
    return this.enrichedBookingsPromise;
  }

  getEnrichedInventories(): Promise<EnrichedInventory[]> {
    if (this.enrichedInventoriesPromise === null) {
      this.enrichedInventoriesPromise = this.buildEnrichedInventories();
    }
    return this.enrichedInventoriesPromise;
  }

  async getBookingsGroupedByCostCentre(): Promise<CostCentreGroup[]> {
    const [costCentres, enriched] = await Promise.all([
      this.getCostCentres(),
      this.getEnrichedBookings(),
    ]);

    const bucketsById = new Map<number, EnrichedBooking[]>();
    for (const centre of costCentres) {
      bucketsById.set(centre.id, []);
    }
    const unassigned: EnrichedBooking[] = [];

    for (const booking of enriched) {
      const id = booking.costcentre?.id ?? null;
      if (id === null) {
        unassigned.push(booking);
        continue;
      }
      const bucket = bucketsById.get(id);
      if (bucket === undefined) {
        throw new Error(
          `Booking ${booking.id} references unknown cost centre ${id}. ` +
            `Cost-centres cache may be stale.`,
        );
      }
      bucket.push(booking);
    }

    const groups: CostCentreGroup[] = costCentres.map((centre) => ({
      costcentre: centre,
      bookings: bucketsById.get(centre.id) ?? [],
    }));

    if (unassigned.length > 0) {
      groups.push({ costcentre: null, bookings: unassigned });
    }

    return groups;
  }

  // ---------------------------------------------------------------------------
  // Snapshot export
  // ---------------------------------------------------------------------------

  async toSnapshot(): Promise<Snapshot> {
    const [costCentres, costAccounts, purchaseTaxAccounts, bookings, inventories] =
      await Promise.all([
        this.getCostCentres(),
        this.getCostAccounts(),
        this.getPurchaseTaxAccounts(),
        this.getBookings(),
        this.getInventories(),
      ]);

    return {
      schema_version: 2,
      country: this.source.country,
      year: this.source.year,
      fetched_at: new Date().toISOString(),
      cost_centres: costCentres,
      cost_accounts: costAccounts,
      purchasetax_accounts: purchaseTaxAccounts,
      bookings,
      inventories,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async buildEnrichedBookings(): Promise<EnrichedBooking[]> {
    const [bookings, costAccounts, purchaseTaxAccounts, costCentres] =
      await Promise.all([
        this.getBookings(),
        this.getCostAccounts(),
        this.getPurchaseTaxAccounts(),
        this.getCostCentres(),
      ]);

    const costAccountById = new Map<number, CostAccount>();
    for (const account of costAccounts) {
      costAccountById.set(account.id, account);
    }
    const purchaseTaxAccountById = new Map<number, PurchaseTaxAccount>();
    for (const account of purchaseTaxAccounts) {
      purchaseTaxAccountById.set(account.id, account);
    }
    const costCentreById = new Map<number, CostCentre>();
    for (const centre of costCentres) {
      costCentreById.set(centre.id, centre);
    }

    return bookings.map((booking) => {
      const enrichedAmounts = booking.amounts.map((amount) => {
        const costAccountFull = costAccountById.get(amount.costaccount.id);
        if (costAccountFull === undefined) {
          throw new Error(
            `Booking ${booking.id} amount references unknown cost account ${amount.costaccount.id} ("${amount.costaccount.name}")`,
          );
        }
        const purchaseTaxAccountFull = purchaseTaxAccountById.get(
          amount.purchasetaxaccount.id,
        );
        if (purchaseTaxAccountFull === undefined) {
          throw new Error(
            `Booking ${booking.id} amount references unknown purchase-tax account ${amount.purchasetaxaccount.id} ("${amount.purchasetaxaccount.name}")`,
          );
        }
        const enriched: EnrichedBookingAmount = {
          ...amount,
          costaccount_full: costAccountFull,
          purchasetaxaccount_full: purchaseTaxAccountFull,
        };
        return enriched;
      });

      const costCentreId = booking.costcentre?.id ?? null;
      let costCentreFull: CostCentre | null = null;
      if (costCentreId !== null) {
        const resolved = costCentreById.get(costCentreId);
        if (resolved === undefined) {
          throw new Error(
            `Booking ${booking.id} references unknown cost centre ${costCentreId} ("${booking.costcentre?.name ?? ""}")`,
          );
        }
        costCentreFull = resolved;
      }

      const enrichedBooking: EnrichedBooking = {
        ...booking,
        amounts: enrichedAmounts,
        costcentre_full: costCentreFull,
      };
      return enrichedBooking;
    });
  }

  private async buildEnrichedInventories(): Promise<EnrichedInventory[]> {
    const [inventories, costAccounts] = await Promise.all([
      this.getInventories(),
      this.getCostAccounts(),
    ]);

    const costAccountById = new Map<number, CostAccount>();
    for (const account of costAccounts) {
      costAccountById.set(account.id, account);
    }

    return inventories.map((inventory) => {
      const costAccountFull = costAccountById.get(inventory.costaccount.id);
      if (costAccountFull === undefined) {
        throw new Error(
          `Inventory ${inventory.id} references unknown cost account ${inventory.costaccount.id} ("${inventory.costaccount.name}")`,
        );
      }
      const enriched: EnrichedInventory = {
        ...inventory,
        costaccount_full: costAccountFull,
      };
      return enriched;
    });
  }
}
