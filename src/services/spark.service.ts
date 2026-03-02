import "server-only";

import type { PropertyCard } from "@/types";
import {
  getSparkAccessToken,
  getSparkApiBaseUrl,
  getSparkListingsFilter,
  getSparkListingsLimit,
  getSparkListingsPath,
} from "@/config";

type UnknownRecord = Record<string, unknown>;
type PathSegment = string | number;

const SPARK_REVALIDATE_SECONDS = 300;
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80";

function getRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function readPath(value: unknown, path: PathSegment[]): unknown {
  let current = value;

  for (const segment of path) {
    if (Array.isArray(current)) {
      const index =
        typeof segment === "number" ? segment : Number.parseInt(segment, 10);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    const record = getRecord(current);

    if (!record) {
      return undefined;
    }

    current = record[String(segment)];
  }

  return current;
}

function pickFirst(value: unknown, ...paths: PathSegment[][]): unknown {
  for (const path of paths) {
    const candidate = readPath(value, path);

    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }

  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();

    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function formatPrice(value: unknown): string {
  const numeric = asNumber(value);

  if (numeric == null) {
    return asString(value) ?? "$—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatSqft(value: unknown): string | undefined {
  const numeric = asNumber(value);

  if (numeric != null) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  return asString(value);
}

function normalizeSparkImageUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol === "http:" &&
      /(^|\.)spark(api|platform)\.com$/i.test(url.hostname)
    ) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

function buildSparkListingsUrl(): string {
  const baseUrl = new URL(getSparkApiBaseUrl());

  if (baseUrl.protocol !== "https:") {
    throw new Error("SPARK_API_BASE_URL must use https.");
  }

  const url = new URL(getSparkListingsPath(), baseUrl);
  url.searchParams.set("_limit", String(getSparkListingsLimit()));
  url.searchParams.set("_expand", "PrimaryPhoto");

  const filter = getSparkListingsFilter();

  if (filter) {
    url.searchParams.set("_filter", filter);
  }

  return url.toString();
}

function extractResults(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = getRecord(payload);
  const wrapped = getRecord(root?.D);
  const candidates = [wrapped?.Results, root?.Results, root?.results, root?.value];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  throw new Error("[Spark] Unexpected response shape.");
}

function buildTitle(record: UnknownRecord, id: string): string {
  const address = asString(
    pickFirst(
      record,
      ["UnparsedAddress"],
      ["StandardFields", "UnparsedAddress"],
      ["Address", "FullStreetAddress"]
    )
  );

  if (address) {
    return address;
  }

  const remarks = asString(
    pickFirst(record, ["PublicRemarks"], ["StandardFields", "PublicRemarks"])
  );

  if (remarks) {
    return remarks.slice(0, 80);
  }

  return `Listing ${id}`;
}

function buildLocation(record: UnknownRecord): string {
  const city = asString(pickFirst(record, ["City"], ["StandardFields", "City"]));
  const state = asString(
    pickFirst(record, ["StateOrProvince"], ["StandardFields", "StateOrProvince"])
  );

  const location = [city, state].filter(Boolean).join(", ");

  if (location) {
    return location;
  }

  return (
    asString(
      pickFirst(
        record,
        ["CountyOrParish"],
        ["StandardFields", "CountyOrParish"],
        ["PostalCity"]
      )
    ) ?? "El Paso, TX"
  );
}

function extractImage(record: UnknownRecord): string {
  const image = asString(
    pickFirst(
      record,
      ["PrimaryPhotoUri"],
      ["PrimaryPhoto", "Uri"],
      ["PrimaryPhoto", "Uri640"],
      ["Photos", 0, "Uri"],
      ["Photos", 0, "Uri640"],
      ["Media", 0, "MediaURL"],
      ["image", "url"],
      ["photo"]
    )
  );

  return normalizeSparkImageUrl(image) ?? FALLBACK_IMAGE;
}

function mapSparkListing(item: unknown, index: number): PropertyCard {
  const record = getRecord(item) ?? {};
  const id =
    asString(
      pickFirst(
        record,
        ["ListingId"],
        ["ListingKey"],
        ["StandardFields", "ListingId"],
        ["StandardFields", "ListingKey"],
        ["Id"],
        ["id"]
      )
    ) ?? `spark-${index}`;
  const title = buildTitle(record, id);
  const beds = asNumber(
    pickFirst(
      record,
      ["BedroomsTotal"],
      ["BedsTotal"],
      ["StandardFields", "BedroomsTotal"],
      ["StandardFields", "BedsTotal"]
    )
  );
  const baths = asNumber(
    pickFirst(
      record,
      ["BathroomsTotalDecimal"],
      ["BathroomsTotalInteger"],
      ["BathsTotal"],
      ["StandardFields", "BathroomsTotalDecimal"],
      ["StandardFields", "BathroomsTotalInteger"],
      ["StandardFields", "BathsTotal"]
    )
  );

  return {
    id,
    title,
    location: buildLocation(record),
    price: formatPrice(
      pickFirst(
        record,
        ["ListPrice"],
        ["CurrentPrice"],
        ["StandardFields", "ListPrice"],
        ["price"]
      )
    ),
    image: extractImage(record),
    beds,
    baths,
    sqft: formatSqft(
      pickFirst(
        record,
        ["BuildingAreaTotal"],
        ["LivingArea"],
        ["StandardFields", "BuildingAreaTotal"],
        ["StandardFields", "LivingArea"]
      )
    ),
    featured: index < 4,
  };
}

export async function fetchSparkPropertyCards(): Promise<PropertyCard[]> {
  const accessToken = getSparkAccessToken();

  if (!accessToken) {
    throw new Error("SPARK_ACCESS_TOKEN is not set.");
  }

  const response = await fetch(buildSparkListingsUrl(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: SPARK_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `[Spark] Listings request failed (${response.status}): ${responseText.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as unknown;
  return extractResults(payload).map(mapSparkListing);
}
