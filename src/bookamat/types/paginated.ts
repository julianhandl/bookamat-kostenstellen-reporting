/*
 * Schema source: https://www.bookamat.com/dokumentation/api/v1/general.html
 */

/**
 * Standard pagination envelope used by every list endpoint.
 *
 * - `count` is the total number of objects across all pages.
 * - `next` / `previous` are absolute URLs to neighbouring pages,
 *   or `null` when there is no such page.
 * - Default page size is server-defined, max 100 per page.
 */
export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
