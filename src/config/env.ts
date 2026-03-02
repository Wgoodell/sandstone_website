import type { LeadFormType } from "@/types";

/**
 * Centralized environment configuration.
 * Single place for env contract; avoids scattering process.env across the app.
 */
function getEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export function getRoluWebhookUrl(): string | undefined {
  return getEnv("ROLU_WEBHOOK_URL");
}

export function getLeadWebhookUrl(formType: LeadFormType): string | undefined {
  const formWebhookEnvKey: Record<LeadFormType, string> = {
    contact: "ROLU_WEBHOOK_CONTACT_URL",
    sell: "ROLU_WEBHOOK_SELL_URL",
    rent: "ROLU_WEBHOOK_RENT_URL",
    join: "ROLU_WEBHOOK_JOIN_URL",
  };

  const resolved = getEnv(formWebhookEnvKey[formType]);

  if (resolved) {
    return resolved;
  }

  // Backward compatibility with the original single-form setup.
  if (formType === "contact") {
    return getRoluWebhookUrl();
  }

  return undefined;
}

export function getTurnstileSecretKey(): string | undefined {
  return getEnv("TURNSTILE_SECRET_KEY");
}

export function getTurnstileSiteKey(): string | undefined {
  return getEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
}

/**
 * Legacy MSL real estate feed (delivered via Rolu webhook).
 * Retained as a fallback while Spark API is rolled out.
 */
export function getMslFeedUrl(): string | undefined {
  return getEnv("MSL_FEED_URL");
}

/**
 * Server-only Spark access token. Keep this secret and never expose it to the client.
 */
export function getSparkAccessToken(): string | undefined {
  return getEnv("SPARK_ACCESS_TOKEN") ?? getEnv("SPARK_API_TOKEN");
}

export function hasSparkAccessToken(): boolean {
  return Boolean(getSparkAccessToken());
}

export function getSparkApiBaseUrl(): string {
  return getEnv("SPARK_API_BASE_URL") ?? "https://sparkapi.com";
}

export function getSparkListingsPath(): string {
  return getEnv("SPARK_API_LISTINGS_PATH") ?? "/v1/listings";
}

export function getSparkListingsFilter(): string | undefined {
  return getEnv("SPARK_LISTINGS_FILTER");
}

export function getSparkListingsLimit(): number {
  const raw = getEnv("SPARK_LISTINGS_LIMIT");

  if (!raw) {
    return 24;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}
