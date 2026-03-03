import "server-only";

import type {
  PropertyCard,
  PropertyDetail,
  PropertyMetadataItem,
  PropertyMetadataSection,
} from "@/types";
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
  expand?: string[];
};
type SparkFetchOptions = {
  fresh?: boolean;
};

const SPARK_REVALIDATE_SECONDS = 300;
const REPLICATION_SPARK_API_BASE_URL = "https://replication.sparkapi.com";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80";
const DEFAULT_LOCATION = "El Paso, TX";
const MAX_SPARK_PAGES = 400;
const COLLECTION_EXPANSIONS = ["PrimaryPhoto"];
const DETAIL_EXPANSIONS = ["PrimaryPhoto", "Photos"];
const PHOTO_URL_PATHS: PathSegment[][] = [
  ["Uri2048"],
  ["Uri1600"],
  ["Uri1280"],
  ["Uri1024"],
  ["Uri800"],
  ["Uri640"],
  ["Uri300"],
  ["UriLarge"],
  ["Uri"],
  ["MediaURL"],
  ["url"],
];

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
  expand = COLLECTION_EXPANSIONS,
}: SparkCollectionRequest): string {
  const baseUrl = new URL(getSparkApiBaseUrl());

  if (baseUrl.protocol !== "https:") {
    throw new Error("SPARK_API_BASE_URL must use https.");
  }

  const url = new URL(path, baseUrl);
  url.searchParams.set("_limit", String(getSparkListingsPageSize()));
  if (expand.length > 0) {
    url.searchParams.set("_expand", expand.join(","));
  }

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

function usesReplicationHost(url: string): boolean {
  return new URL(url).hostname === new URL(REPLICATION_SPARK_API_BASE_URL).hostname;
}

function rewriteSparkUrlBase(url: string, baseUrl: string): string {
  const current = new URL(url);
  const targetBase = new URL(baseUrl);

  current.protocol = targetBase.protocol;
  current.hostname = targetBase.hostname;
  current.port = targetBase.port;

  return current.toString();
}

function shouldRetryWithReplication(response: Response, bodyText: string, url: string): boolean {
  if (response.status !== 403 || usesReplicationHost(url)) {
    return false;
  }

  return bodyText.includes("\"Code\":1021") || bodyText.includes("replication.sparkapi.com");
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return false;
    }
  }

  return undefined;
}

function formatDate(value: unknown): string | undefined {
  const raw = asString(value);

  if (!raw) {
    return undefined;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMetadataValue(value: unknown): string | undefined {
  const stringValue = asString(value);

  if (stringValue) {
    return stringValue;
  }

  const numeric = asNumber(value);

  if (numeric != null) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(numeric);
  }

  const booleanValue = asBoolean(value);

  if (booleanValue != null) {
    return booleanValue ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatMetadataValue(item))
      .filter((item): item is string => Boolean(item));

    if (items.length > 0) {
      return items.join(", ");
    }

    return undefined;
  }

  const record = getRecord(value);

  if (!record) {
    return undefined;
  }

  const truthyKeys = Object.entries(record)
    .filter(([, item]) => asBoolean(item) === true)
    .map(([key]) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));

  if (truthyKeys.length > 0) {
    return truthyKeys.join(", ");
  }

  const pairs = Object.entries(record)
    .map(([key, item]) => {
      const formatted = formatMetadataValue(item);
      return formatted ? `${key}: ${formatted}` : undefined;
    })
    .filter((item): item is string => Boolean(item));

  return pairs.length > 0 ? pairs.join(", ") : undefined;
}

function titleizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => getRecord(item))
      .filter((item): item is UnknownRecord => Boolean(item));
  }

  const record = getRecord(value);

  if (!record) {
    return [];
  }

  if (Array.isArray(record.Results)) {
    return record.Results
      .map((item) => getRecord(item))
      .filter((item): item is UnknownRecord => Boolean(item));
  }

  return [record];
}

function addUniqueString(target: string[], value: string | undefined): void {
  if (!value || target.includes(value)) {
    return;
  }

  target.push(value);
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

function buildListingRouteId(record: UnknownRecord, index: number): string {
  return (
    asString(
      pickFirst(
        record,
        ["ListingKey"],
        ["StandardFields", "ListingKey"],
        ["Id"],
        ["StandardFields", "Id"],
        ["ListingId"],
        ["StandardFields", "ListingId"],
        ["id"]
      )
    ) ?? `spark-${index}`
  );
}

function buildListingNumber(record: UnknownRecord, fallbackId: string): string {
  return (
    asString(
      pickFirst(
        record,
        ["ListingId"],
        ["StandardFields", "ListingId"],
        ["ListingKey"],
        ["StandardFields", "ListingKey"],
        ["Id"]
      )
    ) ?? fallbackId
  );
}

function extractImageUrls(record: UnknownRecord): string[] {
  const images: string[] = [];

  for (const directPath of [
    ["PrimaryPhotoUri"],
    ["PrimaryPhoto", "Uri1600"],
    ["PrimaryPhoto", "Uri1280"],
    ["PrimaryPhoto", "Uri1024"],
    ["PrimaryPhoto", "Uri800"],
    ["PrimaryPhoto", "Uri640"],
    ["PrimaryPhoto", "UriLarge"],
    ["PrimaryPhoto", "Uri"],
    ["PrimaryPhoto", "Results", 0, "Uri1600"],
    ["PrimaryPhoto", "Results", 0, "Uri1280"],
    ["PrimaryPhoto", "Results", 0, "Uri1024"],
    ["PrimaryPhoto", "Results", 0, "Uri800"],
    ["PrimaryPhoto", "Results", 0, "Uri640"],
    ["PrimaryPhoto", "Results", 0, "UriLarge"],
    ["PrimaryPhoto", "Results", 0, "Uri"],
    ["Photos", 0, "Uri1600"],
    ["Photos", 0, "Uri1280"],
    ["Photos", 0, "Uri1024"],
    ["Photos", 0, "Uri800"],
    ["Photos", 0, "Uri640"],
    ["Photos", 0, "UriLarge"],
    ["Photos", 0, "Uri"],
    ["Photos", "Results", 0, "Uri1600"],
    ["Photos", "Results", 0, "Uri1280"],
    ["Photos", "Results", 0, "Uri1024"],
    ["Photos", "Results", 0, "Uri800"],
    ["Photos", "Results", 0, "Uri640"],
    ["Photos", "Results", 0, "UriLarge"],
    ["Photos", "Results", 0, "Uri"],
    ["Media", 0, "MediaURL"],
    ["image", "url"],
    ["photo"],
  ] as PathSegment[][]) {
    addUniqueString(
      images,
      normalizeSparkImageUrl(asString(readPath(record, directPath)))
    );
  }

  for (const collection of [
    pickFirst(record, ["Photos"]),
    pickFirst(record, ["Photos", "Results"]),
    pickFirst(record, ["PrimaryPhoto"]),
    pickFirst(record, ["PrimaryPhoto", "Results"]),
    pickFirst(record, ["StandardFields", "Photos"]),
    pickFirst(record, ["Media"]),
  ]) {
    for (const item of extractRecords(collection)) {
      for (const path of PHOTO_URL_PATHS) {
        addUniqueString(
          images,
          normalizeSparkImageUrl(asString(readPath(item, path)))
        );
      }
    }
  }

  return images;
}

function extractImage(record: UnknownRecord): string {
  return extractImageUrls(record)[0] ?? FALLBACK_IMAGE;
}

function mapSparkListing(item: unknown, index: number): PropertyCard {
  const record = getRecord(item) ?? {};
  const id = buildListingRouteId(record, index);
  const listingNumber = buildListingNumber(record, id);

  return {
    id,
    listingNumber,
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

type MetadataFieldSpec = {
  label: string;
  paths: PathSegment[][];
  format?: (value: unknown) => string | undefined;
};

function buildMetadataItem(
  record: UnknownRecord,
  spec: MetadataFieldSpec
): PropertyMetadataItem | null {
  const value = pickFirst(record, ...spec.paths);
  const formatted = spec.format ? spec.format(value) : formatMetadataValue(value);

  if (!formatted) {
    return null;
  }

  return {
    label: spec.label,
    value: formatted,
  };
}

function buildMetadataSection(
  title: string,
  specs: MetadataFieldSpec[],
  record: UnknownRecord
): PropertyMetadataSection | null {
  const items = specs
    .map((spec) => buildMetadataItem(record, spec))
    .filter((item): item is PropertyMetadataItem => Boolean(item));

  if (items.length === 0) {
    return null;
  }

  return { title, items };
}

function buildAdditionalMetadataSection(record: UnknownRecord): PropertyMetadataSection | null {
  const excludedKeys = new Set([
    "Photos",
    "PrimaryPhoto",
    "Media",
    "Videos",
    "VirtualTours",
    "OpenHouses",
    "Documents",
    "Rooms",
    "Units",
    "CustomFields",
    "D",
    "image",
    "photo",
    "PrimaryPhotoUri",
    "PublicRemarks",
  ]);
  const items: PropertyMetadataItem[] = [];
  const seenLabels = new Set<string>();

  for (const source of [record, getRecord(record.StandardFields)]) {
    if (!source) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      if (excludedKeys.has(key)) {
        continue;
      }

      const formatted = formatMetadataValue(value);

      if (!formatted) {
        continue;
      }

      const label = titleizeKey(key);

      if (seenLabels.has(label)) {
        continue;
      }

      seenLabels.add(label);
      items.push({ label, value: formatted });
    }
  }

  if (items.length === 0) {
    return null;
  }

  items.sort((left, right) => left.label.localeCompare(right.label));

  return {
    title: "Additional MLS Data",
    items,
  };
}

function mapSparkPropertyDetail(item: unknown): PropertyDetail | null {
  const record = getRecord(item);

  if (!record) {
    return null;
  }

  const card = mapSparkListing(record, 0);
  const description = asString(
    pickFirst(record, ["PublicRemarks"], ["StandardFields", "PublicRemarks"])
  );

  const sections = [
    buildMetadataSection(
      "Overview",
      [
        {
          label: "MLS Number",
          paths: [["ListingId"], ["StandardFields", "ListingId"]],
        },
        {
          label: "Status",
          paths: [["MlsStatus"], ["StandardFields", "MlsStatus"]],
        },
        {
          label: "Property Type",
          paths: [["PropertyType"], ["StandardFields", "PropertyType"]],
        },
        {
          label: "Property Subtype",
          paths: [["PropertySubType"], ["StandardFields", "PropertySubType"]],
        },
        {
          label: "Year Built",
          paths: [["YearBuilt"], ["StandardFields", "YearBuilt"]],
        },
        {
          label: "Stories",
          paths: [["StoriesTotal"], ["Stories"], ["StandardFields", "StoriesTotal"]],
        },
        {
          label: "Days on Market",
          paths: [["DaysOnMarket"], ["StandardFields", "DaysOnMarket"]],
        },
        {
          label: "List Date",
          paths: [["ListDate"], ["ListingContractDate"], ["StandardFields", "ListDate"]],
          format: formatDate,
        },
      ],
      record
    ),
    buildMetadataSection(
      "Interior",
      [
        {
          label: "Bedrooms",
          paths: [["BedroomsTotal"], ["BedsTotal"], ["StandardFields", "BedroomsTotal"]],
        },
        {
          label: "Bathrooms",
          paths: [
            ["BathroomsTotalDecimal"],
            ["BathroomsTotalInteger"],
            ["BathsTotal"],
            ["StandardFields", "BathroomsTotalDecimal"],
          ],
        },
        {
          label: "Half Bathrooms",
          paths: [["BathroomsHalf"], ["StandardFields", "BathroomsHalf"]],
        },
        {
          label: "Living Area",
          paths: [["LivingArea"], ["BuildingAreaTotal"], ["StandardFields", "LivingArea"]],
          format: formatSqft,
        },
        {
          label: "Interior Features",
          paths: [["InteriorFeatures"], ["StandardFields", "InteriorFeatures"]],
        },
        {
          label: "Appliances",
          paths: [["Appliances"], ["StandardFields", "Appliances"]],
        },
        {
          label: "Fireplace",
          paths: [["FireplaceYN"], ["StandardFields", "FireplaceYN"]],
          format: formatMetadataValue,
        },
      ],
      record
    ),
    buildMetadataSection(
      "Exterior & Lot",
      [
        {
          label: "Lot Size (sq ft)",
          paths: [
            ["LotSizeSquareFeet"],
            ["StandardFields", "LotSizeSquareFeet"],
            ["LotSizeArea"],
          ],
          format: formatSqft,
        },
        {
          label: "Lot Size (acres)",
          paths: [["LotSizeAcres"], ["StandardFields", "LotSizeAcres"]],
        },
        {
          label: "Garage Spaces",
          paths: [["GarageSpaces"], ["StandardFields", "GarageSpaces"]],
        },
        {
          label: "Parking",
          paths: [["ParkingTotal"], ["ParkingFeatures"], ["StandardFields", "ParkingTotal"]],
        },
        {
          label: "Exterior Features",
          paths: [["ExteriorFeatures"], ["StandardFields", "ExteriorFeatures"]],
        },
        {
          label: "Pool",
          paths: [["PoolFeatures"], ["PoolPrivateYN"], ["StandardFields", "PoolFeatures"]],
          format: formatMetadataValue,
        },
        {
          label: "Construction",
          paths: [["ConstructionMaterials"], ["StandardFields", "ConstructionMaterials"]],
        },
        {
          label: "Roof",
          paths: [["Roof"], ["StandardFields", "Roof"]],
        },
      ],
      record
    ),
    buildMetadataSection(
      "Utilities",
      [
        {
          label: "Heating",
          paths: [["Heating"], ["HeatingYN"], ["StandardFields", "Heating"]],
          format: formatMetadataValue,
        },
        {
          label: "Cooling",
          paths: [["Cooling"], ["CoolingYN"], ["StandardFields", "Cooling"]],
          format: formatMetadataValue,
        },
        {
          label: "Utilities",
          paths: [["Utilities"], ["StandardFields", "Utilities"]],
        },
        {
          label: "Water",
          paths: [["WaterSource"], ["StandardFields", "WaterSource"]],
        },
        {
          label: "Sewer",
          paths: [["Sewer"], ["StandardFields", "Sewer"]],
        },
      ],
      record
    ),
    buildMetadataSection(
      "Listing Info",
      [
        {
          label: "List Office",
          paths: [["ListOfficeName"], ["StandardFields", "ListOfficeName"]],
        },
        {
          label: "List Agent",
          paths: [["ListAgentFullName"], ["StandardFields", "ListAgentFullName"]],
        },
        {
          label: "Subdivision",
          paths: [["SubdivisionName"], ["StandardFields", "SubdivisionName"]],
        },
        {
          label: "Elementary School",
          paths: [["ElementarySchool"], ["StandardFields", "ElementarySchool"]],
        },
        {
          label: "Middle School",
          paths: [["MiddleOrJuniorSchool"], ["StandardFields", "MiddleOrJuniorSchool"]],
        },
        {
          label: "High School",
          paths: [["HighSchool"], ["StandardFields", "HighSchool"]],
        },
      ],
      record
    ),
    buildAdditionalMetadataSection(record),
  ].filter((section): section is PropertyMetadataSection => Boolean(section));

  const images = extractImageUrls(record);

  return {
    ...card,
    description,
    images: images.length > 0 ? images : [card.image],
    metadataSections: sections,
  };
}

function getSparkHeaders(accessToken: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function fetchSparkPayload(
  url: string,
  options?: SparkFetchOptions
): Promise<Response> {
  const accessToken = getSparkAccessToken();

  if (!accessToken) {
    throw new Error("SPARK_ACCESS_TOKEN is not set.");
  }

  const request: RequestInit & { next?: { revalidate: number } } = {
    headers: getSparkHeaders(accessToken),
  };

  if (options?.fresh) {
    request.cache = "no-store";
  } else {
    request.next = { revalidate: SPARK_REVALIDATE_SECONDS };
  }

  const response = await fetch(url, request);
  const responseText = response.status === 403 ? await response.clone().text() : "";

  if (shouldRetryWithReplication(response, responseText, url)) {
    const replicationUrl = rewriteSparkUrlBase(url, REPLICATION_SPARK_API_BASE_URL);
    return fetch(replicationUrl, request);
  }

  return response;
}

async function fetchSparkCollectionPage(
  request: SparkCollectionRequest,
  options?: SparkFetchOptions
): Promise<{ properties: PropertyCard[]; pagination?: SparkPagination }> {
  const { results, pagination } = await fetchSparkResults(request, options);

  return {
    properties: results.map(mapSparkListing),
    pagination,
  };
}

async function fetchSparkResults(
  request: SparkCollectionRequest,
  options?: SparkFetchOptions
): Promise<{ results: unknown[]; pagination?: SparkPagination }> {
  const response = await fetchSparkPayload(
    buildSparkUrl({ ...request, includePagination: true }),
    options
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `[Spark] Collection request failed (${response.status}): ${responseText.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as unknown;
  return {
    results: extractResults(payload),
    pagination: extractPagination(payload),
  };
}

async function fetchAllSparkPropertyCards(
  path: string,
  filter?: string,
  options?: SparkFetchOptions
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
      }, options);

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

function buildIdentifierFilters(id: string): string[] {
  const trimmed = id.trim();

  if (!trimmed) {
    return [];
  }

  const escaped = trimmed.replace(/'/g, "''");
  const filters = [
    `ListingKey Eq '${escaped}'`,
    `Id Eq '${escaped}'`,
    `ListingId Eq '${escaped}'`,
  ];

  if (/^\d+$/.test(trimmed)) {
    filters.push(`ListingId Eq ${trimmed}`);
  }

  return filters;
}

async function fetchSparkListingRecord(
  request: SparkCollectionRequest,
  options?: SparkFetchOptions
): Promise<UnknownRecord | null> {
  const { results } = await fetchSparkResults(request, options);
  return getRecord(results[0]) ?? null;
}

async function fetchSparkListingRecordByRouteId(
  id: string,
  options?: SparkFetchOptions
): Promise<UnknownRecord | null> {
  const response = await fetchSparkPayload(
    buildSparkUrl({
      path: buildSparkListingDetailPath(id),
      expand: DETAIL_EXPANSIONS,
    }),
    options
  );

  if (response.ok) {
    const payload = (await response.json()) as unknown;
    const [listing] = extractResults(payload);
    return getRecord(listing) ?? null;
  }

  if (response.status !== 404) {
    const responseText = await response.text();
    throw new Error(
      `[Spark] Listing request failed (${response.status}): ${responseText.slice(0, 400)}`
    );
  }

  for (const filter of buildIdentifierFilters(id)) {
    const record = await fetchSparkListingRecord(
      {
        path: getSparkListingsPath(),
        filter,
        expand: DETAIL_EXPANSIONS,
      },
      options
    );

    if (record) {
      return record;
    }
  }

  return null;
}

export async function fetchAllActiveSparkPropertyCards(
  options?: SparkFetchOptions
): Promise<PropertyCard[]> {
  return fetchAllSparkPropertyCards(
    getSparkListingsPath(),
    getSparkActiveListingsFilter(),
    options
  );
}

export async function fetchMySparkPropertyCards(
  options?: SparkFetchOptions
): Promise<PropertyCard[]> {
  return fetchAllSparkPropertyCards(
    getSparkMyListingsPath(),
    getSparkMyListingsFilter(),
    options
  );
}

export async function fetchSparkPropertyCardById(
  id: string,
  options?: SparkFetchOptions
): Promise<PropertyCard | null> {
  const listing = await fetchSparkListingRecordByRouteId(id, options);
  return listing ? mapSparkListing(listing, 0) : null;
}

export async function fetchSparkPropertyDetailById(
  id: string,
  options?: SparkFetchOptions
): Promise<PropertyDetail | null> {
  const listing = await fetchSparkListingRecordByRouteId(id, options);
  return listing ? mapSparkPropertyDetail(listing) : null;
}
