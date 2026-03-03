/**
 * Domain model for a property listing card (UI + listing feed).
 * Single responsibility: define the property display contract.
 */
export interface PropertyCard {
  id: string;
  title: string;
  location: string;
  price: string;
  image: string;
  listingNumber?: string;
  beds?: number;
  baths?: number;
  sqft?: string;
  featured?: boolean;
}

export interface PropertyMetadataItem {
  label: string;
  value: string;
}

export interface PropertyMetadataSection {
  title: string;
  items: PropertyMetadataItem[];
}

export interface PropertyDetail extends PropertyCard {
  description?: string;
  images: string[];
  metadataSections: PropertyMetadataSection[];
}
