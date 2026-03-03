import type { PropertyCard } from "@/types";

/**
 * Pure search helper for property cards. Keeps filtering logic out of pages/components.
 * 
 * @param properties - Array of property cards to filter
 * @param query - Text search query (searches title, location, price)
 * @param proximity - Distance filter in miles (e.g., "5", "10", "15", "25")
 *                   When implemented with coordinate data, filters by distance from search location
 */
export function filterPropertyCards(
  properties: PropertyCard[],
  query: string,
  proximity?: string
): PropertyCard[] {
  const normalizedQuery = query.trim().toLowerCase();
  
  let filtered = properties;

  // Text search filter
  if (normalizedQuery) {
    filtered = filtered.filter((property) => {
      const haystack = `${property.title} ${property.location} ${property.price}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }

  // Proximity filter
  // TODO: Implement actual proximity filtering when property coordinate data is available
  // Current: Proximity filter structure is in place but awaiting lat/lng data on PropertyCard type
  if (proximity) {
    // Future implementation example:
    // const proximityInMiles = parseFloat(proximity);
    // filtered = filtered.filter((property) => {
    //   if (!property.coordinates) return false;
    //   const distance = calculateDistance(userCoordinates, property.coordinates);
    //   return distance <= proximityInMiles;
    // });
  }

  return filtered;
}
