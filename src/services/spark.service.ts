import "server-only";

import type { PropertyCard } from "@/types";
import {
  getSparkAccessToken,
  getSparkActiveListingsFilter,
  getSparkApiBaseUrl,
  getSparkListingsPageSize,
  getSparkListingsPath,
  getSparkMyListingsFilter,
  getSparkMyListingsPath,
} from "@/config";

type UnknownRecord = Record<string, unknown>;
type PathSegment = string | number;
type SparkPagination = {
  currentPage?: number;
  totalPages?: number;
  totalRows?: number;
};
type SparkCollectionRequest = {
  path: string;
  filter?: string;
  page?: number;
  includePagination?: boolean;
};

const SPARK_REVALIDATE_SECONDS = 300;
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80";
const DEFAULT_LOCATION = "El Paso, TX";
const MAX_SPARK_PAGES = 400;

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

function buildSparkUrl({
  path,
  filter,
  page,
  includePagination = false,
}: SparkCollectionRequest): string {
  const baseUrl = new URL(getSparkApiBaseUrl());

  if (baseUrl.protocol !== "https:") {
    throw new Error("SPARK_API_BASE_URL must use https.");
  }

  const url = new URL(path, baseUrl);
  url.searchParams.set("_limit", String(getSparkListingsPageSize()));
  url.searchParams.set("_expand", "PrimaryPhoto");

  if (filter) {
    url.searchParams.set("_filter", filter);
  }

  if (includePagination) {
    url.searchParams.set("_pagination", "1");
  }

  if (page && page > 1) {
    url.searchParams.set("_page", String(page));
  }

  return url.toString();
}

function buildSparkListingDetailPath(id: string): string {
  const basePath = getSparkListingsPath().replace(/\/$/, "");
  return `${basePath}/${encodeURIComponent(id)}`;
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

  return [];
}

function extractPagination(payload: unknown): SparkPagination | undefined {
  const root = getRecord(payload);
  const wrapped = getRecord(root?.D);
  const pagination =
    getRecord(wrapped?.Pagination) ??
    getRecord(root?.Pagination) ??
    getRecord(root?.pagination);

  if (!pagination) {
    return undefined;
  }

  return {
    currentPage: asNumber(pagination.CurrentPage),
    totalPages: asNumber(pagination.TotalPages),
    totalRows: asNumber(pagination.TotalRows),
  };
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
    ) ?? DEFAULT_LOCATION
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

  return {
    id,
    title: buildTitle(record, id),
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
    beds: asNumber(
      pickFirst(
        record,
        ["BedroomsTotal"],
        ["BedsTotal"],
        ["StandardFields", "BedroomsTotal"],
        ["StandardFields", "BedsTotal"]
      )
    ),
    baths: asNumber(
      pickFirst(
        record,
        ["BathroomsTotalDecimal"],
        ["BathroomsTotalInteger"],
        ["BathsTotal"],
        ["StandardFields", "BathroomsTotalDecimal"],
        ["StandardFields", "BathroomsTotalInteger"],
        ["StandardFields", "BathsTotal"]
      )
    ),
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

function getSparkHeaders(accessToken: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function fetchSparkPayload(url: string): Promise<Response> {
  const accessToken = getSparkAccessToken();

  if (!accessToken) {
    throw new Error("SPARK_ACCESS_TOKEN is not set.");
  }

  return fetch(url, {
    headers: getSparkHeaders(accessToken),
    next: { revalidate: SPARK_REVALIDATE_SECONDS },
  });
}

async function fetchSparkCollectionPage(
  request: SparkCollectionRequest
): Promise<{ properties: PropertyCard[]; pagination?: SparkPagination }> {
  const response = await fetchSparkPayload(
    buildSparkUrl({ ...request, includePagination: true })
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `[Spark] Collection request failed (${response.status}): ${responseText.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as unknown;
  const results = extractResults(payload);

  return {
    properties: results.map(mapSparkListing),
    pagination: extractPagination(payload),
  };
}

async function fetchAllSparkPropertyCards(
  path: string,
  filter?: string
): Promise<PropertyCard[]> {
  const pageSize = getSparkListingsPageSize();
  const properties: PropertyCard[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  let totalPages: number | undefined;

  while (page <= (totalPages ?? MAX_SPARK_PAGES)) {
    const { properties: pageProperties, pagination } =
      await fetchSparkCollectionPage({
        path,
        filter,
        page,
      });

    for (const property of pageProperties) {
      if (seenIds.has(property.id)) {
        continue;
      }

      seenIds.add(property.id);
      properties.push(property);
    }

    totalPages = pagination?.totalPages ?? totalPages;

    const hasMorePages = totalPages
      ? page < totalPages
      : pageProperties.length === pageSize;

    if (!hasMorePages) {
      break;
    }

    page += 1;
  }

  return properties;
}

export async function fetchAllActiveSparkPropertyCards(): Promise<PropertyCard[]> {
  return fetchAllSparkPropertyCards(
    getSparkListingsPath(),
    getSparkActiveListingsFilter()
  );
}

export async function fetchMySparkPropertyCards(): Promise<PropertyCard[]> {
  return fetchAllSparkPropertyCards(
    getSparkMyListingsPath(),
    getSparkMyListingsFilter()
  );
}

export async function fetchSparkPropertyCardById(
  id: string
): Promise<PropertyCard | null> {
  const response = await fetchSparkPayload(
    buildSparkUrl({
      path: buildSparkListingDetailPath(id),
    })
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `[Spark] Listing request failed (${response.status}): ${responseText.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as unknown;
  const [listing] = extractResults(payload);

  return listing ? mapSparkListing(listing, 0) : null;
}
