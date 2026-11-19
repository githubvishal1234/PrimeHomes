
export interface Property {
  propertyId: number;
  id?: number;

  title: string;
  description: string;
  propertyType: string;
  listingType?: 'Sale' | 'Rent';

  bhk?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;

  price: number;
  area: number;
  location: string;
  city: string;

  // Lifestyle and community facilities saved as a JSON string
  lifestyleFeatures?: string;

  // Property map coordinates
  latitude?: number | null;
  longitude?: number | null;

  // Main property image
  imageUrl?: string;

  furnishing?: string | null;
  floor?: number | null;
  totalFloors?: number | null;
  facing?: string | null;
  constructionStatus?: string | null;
  ageYears?: number | null;
  parking?: number | null;

  ownerId: number;
  status: PropertyStatus | string;
  rejectReason?: string | null;
  badge?: string;
  isVerified?: boolean;
  viewCount?: number;
  createdDate: string;
  updatedDate?: string | null;
  approvedDate?: string | null;

  // Multiple property images
  images?: PropertyImage[];
}

export interface PropertyImage {
  propertyImageId: number;
  propertyId: number;
  imageUrl: string;
  createdDate: string;
}

/** Lifecycle states. 'Approved' is the live state. */
export type PropertyStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Sold' | 'Rented' | 'Expired';

/** Card-sized live listing returned by /Properties/search and /similar. */
export interface PropertySummary {
  propertyId: number;
  title: string;
  propertyType: string;
  listingType: 'Sale' | 'Rent';
  bhk: number;
  bathrooms?: number | null;
  price: number;
  area: number;
  pricePerSqft: number;
  furnishing?: string | null;
  constructionStatus?: string | null;
  location: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  imageCount: number;
  badge?: string | null;
  isVerified: boolean;
  lifestyleFeatures: string;
  createdDate: string;
  floor?: number | null;
  totalFloors?: number | null;
  ageYears?: number | null;
  /** First ~160 characters of the description. */
  snippet?: string;
  approvedDate?: string | null;
}

export interface PropertySearchQuery {
  q?: string;
  city?: string;
  /** Comma-separated localities. */
  localities?: string;
  listingType?: 'Sale' | 'Rent';
  propertyTypes?: string;
  bhk?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  furnishing?: string;
  constructionStatus?: string;
  verifiedOnly?: boolean;
  amenities?: string;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'price_per_sqft' | 'area_desc';
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CityCount {
  city: string;
  count: number;
  localities: string[];
}

export interface ListingStats {
  propertyId: number;
  viewCount: number;
  inquiries: number;
  newInquiries: number;
  visits: number;
  shortlists: number;
}

export interface AnalyticsDay {
  date: string;
  views: number;
  inquiries: number;
  visits: number;
}

export interface OwnerAnalytics {
  days: number;
  series: AnalyticsDay[];
  totals: { views: number; inquiries: number; visits: number };
}

export interface PriceInsights {
  listingType: 'Sale' | 'Rent';
  pricePerSqft: number;
  localityAvg: number | null;
  localityCount: number;
  cityAvg: number | null;
  cityCount: number;
  comparedWith: 'locality' | 'city' | null;
  verdict: 'Below market' | 'Fair price' | 'Above market' | null;
}

/** Readable URL part; must match the API's Slug.For (used in the sitemap). */
export function slugFor(title: string, city: string): string {
  const text = title.toLowerCase().includes(city.toLowerCase()) ? title : `${title} ${city}`;
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 80 ? slug.slice(0, 80).replace(/-+$/, '') : slug;
}

/** Public "posted by" info for a live listing (no contact details). */
export interface OwnerSummary {
  displayName: string;
  memberSince: string;
  liveListings: number;
}
