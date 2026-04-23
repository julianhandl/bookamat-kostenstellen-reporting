/*
 * Resolves BookamatApiClientConfig from UI-provided overrides with
 * environment variables as fallbacks.
 *
 * Env vars (see .env.example):
 *   BOOKAMAT_USERNAME
 *   BOOKAMAT_API_KEY
 *   BOOKAMAT_COUNTRY
 *   BOOKAMAT_YEAR
 *
 * Bun auto-loads `.env`, so no dotenv call is needed.
 */

import type { BookamatApiClientConfig } from "./api-client.ts";

export type BookamatApiClientConfigOverrides = {
  country?: string;
  year?: number;
  username?: string;
  apiKey?: string;
  baseUrl?: string;
};

export function resolveBookamatApiClientConfig(
  overrides: BookamatApiClientConfigOverrides = {},
): BookamatApiClientConfig {
  const country = overrides.country ?? Bun.env.BOOKAMAT_COUNTRY;
  const yearFromEnv = parseYear(Bun.env.BOOKAMAT_YEAR);
  const year = overrides.year ?? yearFromEnv;
  const username = overrides.username ?? Bun.env.BOOKAMAT_USERNAME;
  const apiKey = overrides.apiKey ?? Bun.env.BOOKAMAT_API_KEY;

  const missing: string[] = [];
  if (country === undefined || country === "") missing.push("country (BOOKAMAT_COUNTRY)");
  if (year === undefined) missing.push("year (BOOKAMAT_YEAR)");
  if (username === undefined || username === "") missing.push("username (BOOKAMAT_USERNAME)");
  if (apiKey === undefined || apiKey === "") missing.push("apiKey (BOOKAMAT_API_KEY)");

  if (missing.length > 0) {
    throw new Error(
      `Missing Bookamat API configuration: ${missing.join(", ")}. ` +
        `Provide via UI or set the env vars (see .env.example).`,
    );
  }

  return {
    country: country as string,
    year: year as number,
    username: username as string,
    apiKey: apiKey as string,
    baseUrl: overrides.baseUrl,
  };
}

function parseYear(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 9999) {
    throw new Error(
      `Invalid BOOKAMAT_YEAR="${raw}" (expected a 4-digit year).`,
    );
  }
  return parsed;
}
