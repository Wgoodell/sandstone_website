import "server-only";

import { cache } from "react";
import type { PropertyCard, PropertyDetail } from "@/types";
import { getMslFeedUrl, hasSparkAccessToken } from "@/config";
import { fetchLegacyFeedPropertyCards } from "@/services/msl.service";
import {
  fetchAllActiveSparkPropertyCards,
  fetchMySparkPropertyCards,
  fetchSparkPropertyCardById,
  fetchSparkPropertyDetailById,
} from "@/services/spark.service";

type ListingsTarget = "active" | "my";
type ListingsSource = "spark" | "legacy-feed" | "demo-fallback";
type ListingsFetchOptions = {
  fresh?: boolean;
};
type ListingsResolution = {
  source: ListingsSource;
  properties: PropertyCard[];
  sparkError?: string;
  legacyError?: string;
};

export interface ListingsDiagnostics {
  target: ListingsTarget;
  source: ListingsSource;
  count: number;
  sample: Array<
    Pick<PropertyCard, "id" | "title" | "location" | "price" | "image" | "listingNumber">
  >;
  sparkConfigured: boolean;
  legacyFeedConfigured: boolean;
  sparkError?: string;
  legacyError?: string;
}

const FALLBACK_PROPERTIES: PropertyCard[] = [
  {
    id: "demo-1",
    title: "Sunset Ridge Estate",
    location: "West El Paso · Franklin Mountains view",
    price: "$845,000",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
    beds: 4,
    baths: 3.5,
    sqft: "3,950",
    featured: true,
  },
  {
    id: "demo-2",
    title: "Cimarron Canyon Modern",
    location: "Cimarron Canyon · El Paso",
    price: "$629,900",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    beds: 3,
    baths: 2.5,
    sqft: "2,780",
  },
  {
    id: "demo-3",
    title: "Mission Hills Haven",
    location: "Mission Hills · Downtown access",
    price: "$712,000",
    image:
      "https://images.unsplash.com/photo-1502005097973-6a7082348e28?auto=format&fit=crop&w=1200&q=80",
    beds: 4,
    baths: 3,
    sqft: "3,120",
  },
];

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function mapFallbackCardToDetail(property: PropertyCard): PropertyDetail {
  return {
    ...property,
    images: [property.image],
    metadataSections: [
      {
        title: "Overview",
        items: [
          { label: "Price", value: property.price },
          { label: "Location", value: property.location },
          ...(property.beds != null
            ? [{ label: "Bedrooms", value: String(property.beds) }]
            : []),
          ...(property.baths != null
            ? [{ label: "Bathrooms", value: String(property.baths) }]
            : []),
          ...(property.sqft ? [{ label: "Living Area", value: property.sqft }] : []),
        ],
      },
    ],
  };
}

async function fetchLegacyPropertyCardsOrFallback(
  options?: ListingsFetchOptions
): Promise<ListingsResolution> {
  if (getMslFeedUrl()) {
    try {
      return {
        source: "legacy-feed",
        properties: await fetchLegacyFeedPropertyCards(options),
      };
    } catch (error) {
      const legacyError = formatError(error);
      console.error("[Listings] Legacy feed failed, falling back.", error);

      return {
        source: "demo-fallback",
        properties: FALLBACK_PROPERTIES,
        legacyError,
      };
    }
  }

  return {
    source: "demo-fallback",
    properties: FALLBACK_PROPERTIES,
  };
}

async function resolvePropertyCards(
  target: ListingsTarget,
  options?: ListingsFetchOptions
): Promise<ListingsResolution> {
  if (hasSparkAccessToken()) {
    try {
      const properties =
        target === "active"
          ? await fetchAllActiveSparkPropertyCards(options)
          : await fetchMySparkPropertyCards(options);

      return {
        source: "spark",
        properties,
      };
    } catch (error) {
      const sparkError = formatError(error);
      console.error(
        `[Listings] ${target === "active" ? "Active" : "My"} Spark listings failed, falling back.`,
        error
      );

      const fallback = await fetchLegacyPropertyCardsOrFallback(options);

      return {
        ...fallback,
        sparkError,
      };
    }
  }

  return fetchLegacyPropertyCardsOrFallback(options);
}

function buildListingsDiagnostics(
  target: ListingsTarget,
  resolution: ListingsResolution
): ListingsDiagnostics {
  return {
    target,
    source: resolution.source,
    count: resolution.properties.length,
    sample: resolution.properties.slice(0, 3).map((property) => ({
      id: property.id,
      listingNumber: property.listingNumber,
      title: property.title,
      location: property.location,
      price: property.price,
      image: property.image,
    })),
    sparkConfigured: hasSparkAccessToken(),
    legacyFeedConfigured: Boolean(getMslFeedUrl()),
    sparkError: resolution.sparkError,
    legacyError: resolution.legacyError,
  };
}

async function fetchActivePropertyCardsUncached(): Promise<PropertyCard[]> {
  const resolution = await resolvePropertyCards("active");
  return resolution.properties;
}

async function fetchMyPropertyCardsUncached(): Promise<PropertyCard[]> {
  const resolution = await resolvePropertyCards("my");
  return resolution.properties;
}

export async function inspectListingsTarget(
  target: ListingsTarget,
  options?: ListingsFetchOptions
): Promise<ListingsDiagnostics> {
  const resolution = await resolvePropertyCards(target, options);
  return buildListingsDiagnostics(target, resolution);
}

async function fetchPropertyCardByIdUncached(
  id: string
): Promise<PropertyCard | null> {
  if (hasSparkAccessToken()) {
    try {
      const property = await fetchSparkPropertyCardById(id);

      if (property) {
        return property;
      }
    } catch (error) {
      console.error("[Listings] Spark property lookup failed, falling back.", error);
    }
  }

  const fallback = await fetchLegacyPropertyCardsOrFallback();
  return fallback.properties.find((property) => property.id === id) ?? null;
}

async function fetchPropertyDetailByIdUncached(
  id: string
): Promise<PropertyDetail | null> {
  if (hasSparkAccessToken()) {
    try {
      const property = await fetchSparkPropertyDetailById(id);

      if (property) {
        return property;
      }
    } catch (error) {
      console.error("[Listings] Spark property detail lookup failed, falling back.", error);
    }
  }

  const fallback = await fetchLegacyPropertyCardsOrFallback();
  const property = fallback.properties.find((item) => item.id === id);
  return property ? mapFallbackCardToDetail(property) : null;
}

export const fetchActivePropertyCards = cache(fetchActivePropertyCardsUncached);
export const fetchMyPropertyCards = cache(fetchMyPropertyCardsUncached);
export const fetchPropertyCardById = cache(fetchPropertyCardByIdUncached);
export const fetchPropertyDetailById = cache(fetchPropertyDetailByIdUncached);
