import "server-only";

import { cache } from "react";
import type { PropertyCard } from "@/types";
import { getMslFeedUrl, hasSparkAccessToken } from "@/config";
import { fetchLegacyFeedPropertyCards } from "@/services/msl.service";
import {
  fetchAllActiveSparkPropertyCards,
  fetchMySparkPropertyCards,
  fetchSparkPropertyCardById,
} from "@/services/spark.service";

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

async function fetchLegacyPropertyCardsOrFallback(): Promise<PropertyCard[]> {
  if (getMslFeedUrl()) {
    try {
      return await fetchLegacyFeedPropertyCards();
    } catch (error) {
      console.error("[Listings] Legacy feed failed, falling back.", error);
    }
  }

  return FALLBACK_PROPERTIES;
}

async function fetchActivePropertyCardsUncached(): Promise<PropertyCard[]> {
  if (hasSparkAccessToken()) {
    try {
      return await fetchAllActiveSparkPropertyCards();
    } catch (error) {
      console.error("[Listings] Active Spark listings failed, falling back.", error);
    }
  }

  return fetchLegacyPropertyCardsOrFallback();
}

async function fetchMyPropertyCardsUncached(): Promise<PropertyCard[]> {
  if (hasSparkAccessToken()) {
    try {
      return await fetchMySparkPropertyCards();
    } catch (error) {
      console.error("[Listings] My Spark listings failed, falling back.", error);
    }
  }

  return fetchLegacyPropertyCardsOrFallback();
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

  const properties = await fetchLegacyPropertyCardsOrFallback();
  return properties.find((property) => property.id === id) ?? null;
}

export const fetchActivePropertyCards = cache(fetchActivePropertyCardsUncached);
export const fetchMyPropertyCards = cache(fetchMyPropertyCardsUncached);
export const fetchPropertyCardById = cache(fetchPropertyCardByIdUncached);
