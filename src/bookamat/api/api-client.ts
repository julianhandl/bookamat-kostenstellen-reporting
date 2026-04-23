/*
 * Raw Bookamat v1 REST client.
 *
 * API root:  https://www.bookamat.com/api/v1/<country>/<year>/
 * Auth docs: https://www.bookamat.com/dokumentation/api/v1/basics.html
 *
 * This is a thin mirror of the Bookamat API — each method corresponds to one
 * HTTP endpoint. No DTO mapping, no caching, no retries. For list endpoints,
 * every `list*` method has a companion `list*All` that walks the `next` links
 * and returns the concatenated results.
 */

import type { Paginated } from "../types/paginated.ts";
import type { CostCentre } from "../types/cost-centre.ts";
import type { PurchaseTaxAccount } from "../types/purchasetax-account.ts";
import type { CostAccount } from "../types/cost-account.ts";
import type { Booking } from "../types/booking.ts";
import type { Inventory } from "../types/inventory.ts";

export type BookamatApiClientConfig = {
  /** Lowercase ISO country code, e.g. `"at"`. */
  country: string;
  /** Reporting year, e.g. `2026`. */
  year: number;
  /** Bookamat account username. */
  username: string;
  /** Bookamat API key for that username. */
  apiKey: string;
  /**
   * Override the API root. Defaults to `https://www.bookamat.com/api/v1`.
   * The country/year segments are appended automatically.
   */
  baseUrl?: string;
};

/**
 * Query parameters for the cost-centre list endpoint.
 * See https://www.bookamat.com/dokumentation/api/v1/cost_centres.html
 */
export type ListCostCentresParams = {
  has_bookings?: boolean;
  ordering?: string;
  limit?: number;
};

/**
 * Query parameters for the purchase-tax-account list endpoint.
 * See https://www.bookamat.com/dokumentation/api/v1/purchasetax_accounts.html
 */
export type ListPurchaseTaxAccountsParams = {
  group?: "1" | "2";
  active?: boolean;
  has_bookings?: boolean;
  ordering?: string;
  limit?: number;
};

/**
 * Query parameters for the cost-account list endpoint.
 * See https://www.bookamat.com/dokumentation/api/v1/cost_accounts.html
 */
export type ListCostAccountsParams = {
  costaccount?: number;
  group?: "1" | "2";
  inventory?: boolean;
  index_incometax?: string;
  active?: boolean;
  has_bookings?: boolean;
  ordering?: string;
  limit?: number;
};

/**
 * Query parameters for the inventory list endpoint.
 * See https://www.bookamat.com/dokumentation/api/v1/inventories.html
 */
export type ListInventoriesParams = {
  title?: string;
  title_contains?: string;

  date_purchase?: string;
  date_purchase_from?: string;
  date_purchase_until?: string;
  date_commissioning?: string;
  date_commissioning_from?: string;
  date_commissioning_until?: string;
  date_disposal?: string;
  date_disposal_from?: string;
  date_disposal_until?: string;

  amount_after_tax?: string;
  amount_after_tax_min?: string;
  amount_after_tax_max?: string;

  deductibility_percent?: string;
  deductibility_percent_min?: string;
  deductibility_percent_max?: string;

  deductibility_amount?: string;
  deductibility_amount_min?: string;
  deductibility_amount_max?: string;

  costaccount?: number;

  description?: string;
  description_contains?: string;
  seller?: string;
  seller_contains?: string;

  ordering?: string;
  limit?: number;
};

/**
 * Query parameters for the booking list endpoints (booked/open/deleted/imported).
 * See https://www.bookamat.com/dokumentation/api/v1/bookings.html
 */
export type ListBookingsParams = {
  title?: string;
  title_contains?: string;
  vatin?: string;
  vatin_contains?: string;
  description?: string;
  description_contains?: string;

  date?: string;
  date_from?: string;
  date_until?: string;
  date_invoice?: string;
  date_invoice_from?: string;
  date_invoice_until?: string;
  date_delivery?: string;
  date_delivery_from?: string;
  date_delivery_until?: string;
  date_order?: string;
  date_order_from?: string;
  date_order_until?: string;
  create_date?: string;
  create_date_from?: string;
  create_date_until?: string;
  update_date?: string;
  update_date_from?: string;
  update_date_until?: string;

  amount?: string;
  amount_min?: string;
  amount_max?: string;
  amount_after_tax?: string;
  amount_after_tax_min?: string;
  amount_after_tax_max?: string;

  bankaccount?: number;
  costaccount?: number;
  purchasetaxaccount?: number;
  costcentre?: number;
  foreign_business_base?: number;
  tag?: number;

  group?: "1" | "2";
  country_dep?: string;
  country_rec?: string;
  has_attachments?: boolean;

  ordering?: string;
  limit?: number;
};

/**
 * Raised when the Bookamat API returns a non-2xx response.
 * `body` holds the parsed JSON payload when available (the API returns
 * DRF-style `{ "field": ["msg"] }` or `{ "non_field_errors": [...] }`),
 * otherwise the raw text.
 */
export class BookamatApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(status: number, url: string, body: unknown) {
    super(`Bookamat API ${status} for ${url}: ${JSON.stringify(body)}`);
    this.name = "BookamatApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export class BookamatApiClient {
  private readonly apiRoot: string;
  private readonly authHeader: string;

  readonly country: string;
  readonly year: number;

  constructor(config: BookamatApiClientConfig) {
    const base = config.baseUrl ?? "https://www.bookamat.com/api/v1";
    this.apiRoot = `${base}/${config.country}/${config.year}`;
    this.authHeader = `ApiKey ${config.username}:${config.apiKey}`;
    this.country = config.country;
    this.year = config.year;
  }

  // ---------------------------------------------------------------------------
  // Cost centres
  // ---------------------------------------------------------------------------

  listCostCentres(
    params?: ListCostCentresParams,
  ): Promise<Paginated<CostCentre>> {
    return this.get<Paginated<CostCentre>>(
      "/preferences/costcentres/",
      params,
    );
  }

  listCostCentresAll(params?: ListCostCentresParams): Promise<CostCentre[]> {
    return this.fetchAllPages(() => this.listCostCentres(params));
  }

  getCostCentre(id: number): Promise<CostCentre> {
    return this.get<CostCentre>(`/preferences/costcentres/${id}/`);
  }

  // ---------------------------------------------------------------------------
  // Purchase-tax accounts (Steuerkonten)
  // ---------------------------------------------------------------------------

  listPurchaseTaxAccounts(
    params?: ListPurchaseTaxAccountsParams,
  ): Promise<Paginated<PurchaseTaxAccount>> {
    return this.get<Paginated<PurchaseTaxAccount>>(
      "/preferences/purchasetaxaccounts/",
      params,
    );
  }

  listPurchaseTaxAccountsAll(
    params?: ListPurchaseTaxAccountsParams,
  ): Promise<PurchaseTaxAccount[]> {
    return this.fetchAllPages(() => this.listPurchaseTaxAccounts(params));
  }

  getPurchaseTaxAccount(id: number): Promise<PurchaseTaxAccount> {
    return this.get<PurchaseTaxAccount>(
      `/preferences/purchasetaxaccounts/${id}/`,
    );
  }

  // ---------------------------------------------------------------------------
  // Cost accounts
  // ---------------------------------------------------------------------------

  listCostAccounts(
    params?: ListCostAccountsParams,
  ): Promise<Paginated<CostAccount>> {
    return this.get<Paginated<CostAccount>>(
      "/preferences/costaccounts/",
      params,
    );
  }

  listCostAccountsAll(
    params?: ListCostAccountsParams,
  ): Promise<CostAccount[]> {
    return this.fetchAllPages(() => this.listCostAccounts(params));
  }

  getCostAccount(id: number): Promise<CostAccount> {
    return this.get<CostAccount>(`/preferences/costaccounts/${id}/`);
  }

  // ---------------------------------------------------------------------------
  // Bookings (Buchungen)
  // ---------------------------------------------------------------------------

  listBookings(params?: ListBookingsParams): Promise<Paginated<Booking>> {
    return this.get<Paginated<Booking>>("/bookings/", params);
  }

  listBookingsAll(params?: ListBookingsParams): Promise<Booking[]> {
    return this.fetchAllPages(() => this.listBookings(params));
  }

  listOpenBookings(params?: ListBookingsParams): Promise<Paginated<Booking>> {
    return this.get<Paginated<Booking>>("/bookings/open/", params);
  }

  listOpenBookingsAll(params?: ListBookingsParams): Promise<Booking[]> {
    return this.fetchAllPages(() => this.listOpenBookings(params));
  }

  listDeletedBookings(
    params?: ListBookingsParams,
  ): Promise<Paginated<Booking>> {
    return this.get<Paginated<Booking>>("/bookings/deleted/", params);
  }

  listDeletedBookingsAll(params?: ListBookingsParams): Promise<Booking[]> {
    return this.fetchAllPages(() => this.listDeletedBookings(params));
  }

  listImportedBookings(
    params?: ListBookingsParams,
  ): Promise<Paginated<Booking>> {
    return this.get<Paginated<Booking>>("/bookings/imported/", params);
  }

  listImportedBookingsAll(params?: ListBookingsParams): Promise<Booking[]> {
    return this.fetchAllPages(() => this.listImportedBookings(params));
  }

  getBooking(id: number): Promise<Booking> {
    return this.get<Booking>(`/bookings/${id}/`);
  }

  // ---------------------------------------------------------------------------
  // Inventories (Anlagen)
  // ---------------------------------------------------------------------------

  listInventories(
    params?: ListInventoriesParams,
  ): Promise<Paginated<Inventory>> {
    return this.get<Paginated<Inventory>>("/inventories/", params);
  }

  listInventoriesAll(
    params?: ListInventoriesParams,
  ): Promise<Inventory[]> {
    return this.fetchAllPages(() => this.listInventories(params));
  }

  getInventory(id: number): Promise<Inventory> {
    return this.get<Inventory>(`/inventory/${id}/`);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Repeatedly fetches paginated pages until `next` is `null`, concatenating
   * all results. `firstPage` is called once to obtain the first page; the
   * `next` URLs returned by Bookamat are absolute and fetched directly.
   */
  private async fetchAllPages<T>(
    firstPage: () => Promise<Paginated<T>>,
  ): Promise<T[]> {
    const all: T[] = [];
    let page = await firstPage();
    all.push(...page.results);

    while (page.next !== null) {
      page = await this.getAbsolute<Paginated<T>>(page.next);
      all.push(...page.results);
    }

    return all;
  }

  /**
   * GET a path relative to the configured api root, optionally adding a
   * query string built from `params` (undefined values are skipped,
   * booleans become `"true"`/`"false"`).
   */
  private get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.getAbsolute<T>(url);
  }

  private async getAbsolute<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await this.readErrorBody(response);
      throw new BookamatApiError(response.status, url, body);
    }

    return (await response.json()) as T;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${this.apiRoot}${path}`);
    if (params === undefined) {
      return url.toString();
    }
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async readErrorBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.length === 0) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
