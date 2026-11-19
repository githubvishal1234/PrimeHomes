import { SeoService } from '../services/seo';
import { SavedSearchService } from '../services/saved-search';
import { ToastService } from '../services/toast';
import { apiErrorMessage } from '../services/auth';
import { goToLogin, session } from '../services/session';
import { Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type * as Leaflet from 'leaflet';

import { Property as PropertyService } from '../services/property';
import { CityCount, PagedResult, PropertySearchQuery, PropertySummary } from '../models/property';
import { ShortlistService } from '../services/shortlist';
import { PropertyCard } from '../shared/property-card/property-card';
import { Icon } from '../shared/icon/icon';
import { formatPrice } from '../shared/format';

type Sort = NonNullable<PropertySearchQuery['sort']>;

const SALE_BUDGETS = [0, 2_000_000, 4_000_000, 6_000_000, 8_000_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000];
const RENT_BUDGETS = [0, 5_000, 10_000, 15_000, 20_000, 30_000, 50_000, 75_000, 100_000];

/** Search results: filters live in the URL, so every search can be shared, bookmarked and navigated back to. */
@Component({
  selector: 'app-property-list',
  imports: [FormsModule, RouterLink, PropertyCard, Icon],
  templateUrl: './property-list.html',
  styleUrl: './property-list.css'
})
export class PropertyList implements OnInit {
  private readonly api = inject(PropertyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly shortlist = inject(ShortlistService);
  private readonly savedSearches = inject(SavedSearchService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  readonly propertyTypes = ['Apartment', 'Villa', 'House', 'Plot', 'Commercial'];
  readonly bhkOptions = [1, 2, 3, 4, 5];
  readonly furnishingOptions = ['Unfurnished', 'Semi-furnished', 'Furnished'];
  readonly amenityOptions = ['Swimming Pool', 'Fitness Centre', 'Clubhouse', 'Security', 'Parking', 'Garden', 'Power Backup', "Children's Play Area"];
  readonly sortOptions: { value: Sort; label: string }[] = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'newest', label: 'Newest first' },
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'price_per_sqft', label: 'Price per sq ft' },
    { value: 'area_desc', label: 'Largest area' }
  ];
  readonly skeletons = [1, 2, 3, 4];

  // Filter state (mirrors the query string)
  q = '';
  listingType = signal<'Sale' | 'Rent'>('Sale');
  city = '';
  types = new Set<string>();
  bhk = new Set<number>();
  furnishing = new Set<string>();
  amenities = new Set<string>();
  localities = new Set<string>();
  constructionStatus = '';
  verifiedOnly = false;
  minPrice: number | null = null;
  maxPrice: number | null = null;
  minArea: number | null = null;
  maxArea: number | null = null;
  sort: Sort = 'relevance';
  page = 1;

  readonly result = signal<PagedResult<PropertySummary> | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly cities = signal<CityCount[]>([]);
  readonly view = signal<'list' | 'map'>('list');
  readonly filtersOpen = signal(false);

  readonly budgets = computed(() => (this.listingType() === 'Rent' ? RENT_BUDGETS : SALE_BUDGETS));
  readonly pages = computed(() => {
    const total = this.result()?.totalPages ?? 0;
    const current = this.result()?.page ?? 1;
    const start = Math.max(1, Math.min(current - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });

  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('map');
  private map?: Leaflet.Map;

  constructor() {
    // Draw the map whenever map view is on and results change.
    effect(() => {
      const items = this.result()?.items ?? [];
      if (this.view() === 'map' && this.mapEl()) {
        this.renderMap(items);
      }
    });
    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  ngOnInit(): void {
    this.shortlist.ensureLoaded();
    this.api.getCities().subscribe({ next: c => this.cities.set(c), error: () => this.cities.set([]) });

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.readParams(params);
        this.search();
      });
  }

  // ---------- filters ----------


  budgetLabel(value: number): string {
    return value === 0 ? 'Any' : formatPrice(value, this.listingType()).replace('/month', '');
  }

  toggle<T>(set: Set<T>, value: T): void {
    set.has(value) ? set.delete(value) : set.add(value);
    this.apply();
  }

  setListingType(type: 'Sale' | 'Rent'): void {
    if (this.listingType() === type) return;
    this.listingType.set(type);
    this.minPrice = this.maxPrice = null; // budgets differ between buy and rent
    this.apply();
  }

  activeFilterCount(): number {
    return this.types.size + this.bhk.size + this.furnishing.size + this.amenities.size + this.localities.size
      + (this.constructionStatus ? 1 : 0) + (this.verifiedOnly ? 1 : 0)
      + (this.minPrice ? 1 : 0) + (this.maxPrice ? 1 : 0) + (this.minArea ? 1 : 0) + (this.maxArea ? 1 : 0);
  }

  clearFilters(): void {
    this.types.clear();
    this.bhk.clear();
    this.furnishing.clear();
    this.amenities.clear();
    this.localities.clear();
    this.constructionStatus = '';
    this.verifiedOnly = false;
    this.minPrice = this.maxPrice = this.minArea = this.maxArea = null;
    this.apply();
  }

  /** Push the current state into the URL; the queryParams subscription runs the search. */
  apply(page = 1): void {
    const csv = (s: Set<unknown>) => (s.size ? [...s].join(',') : null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.q.trim() || null,
        type: this.listingType() === 'Rent' ? 'rent' : null,
        city: this.city || null,
        propertyTypes: csv(this.types),
        bhk: csv(this.bhk),
        furnishing: csv(this.furnishing),
        amenities: csv(this.amenities),
        localities: csv(this.localities),
        status: this.constructionStatus || null,
        verified: this.verifiedOnly ? 1 : null,
        minPrice: this.minPrice || null,
        maxPrice: this.maxPrice || null,
        minArea: this.minArea || null,
        maxArea: this.maxArea || null,
        sort: this.sort !== 'relevance' ? this.sort : null,
        page: page > 1 ? page : null
      }
    });
  }

  /** Buyers save the current filters; new matching listings trigger an alert. */
  saveSearch(): void {
    if (!session.isLoggedIn()) {
      goToLogin(this.router);
      return;
    }
    if (session.role() !== 'Buyer') {
      this.toast.info('Saved searches are for buyer accounts.');
      return;
    }

    const params = new URLSearchParams(location.search);
    params.delete('page');
    params.delete('sort');

    this.savedSearches.save(this.describeSearch(), params.toString()).subscribe({
      next: () => this.toast.success('Search saved. We will alert you when new homes match.'),
      error: err => this.toast.error(apiErrorMessage(err, 'Could not save this search.'))
    });
  }

  /** e.g. "2, 3 BHK Apartment for sale in Hyderabad under ₹80 L" */
  describeSearch(): string {
    const parts: string[] = [];
    if (this.bhk.size) parts.push(`${[...this.bhk].sort().map(n => (n === 5 ? '5+' : n)).join(', ')} BHK`);
    parts.push(this.types.size ? [...this.types].join('/') : 'Homes');
    parts.push(this.listingType() === 'Rent' ? 'for rent' : 'for sale');
    if (this.city) parts.push(`in ${this.city}`);
    if (this.q) parts.push(`near ${this.q}`);
    if (this.maxPrice) parts.push(`under ${formatPrice(this.maxPrice, this.listingType()).replace('/month', '')}`);
    else if (this.minPrice) parts.push(`above ${formatPrice(this.minPrice, this.listingType()).replace('/month', '')}`);
    return parts.join(' ').slice(0, 120);
  }

  // ---------- 99acres-style helpers ----------

  /** Localities to pick from: the chosen city's, or the most common across all cities. */
  localityOptions(): string[] {
    const cities = this.city ? this.cities().filter(c => c.city === this.city) : this.cities();
    return [...new Set(cities.flatMap(c => c.localities))].sort().slice(0, 15);
  }

  /** "Flats for sale in Kondapur, Hyderabad" */
  resultsTitle(): string {
    const kinds: Record<string, string> = { Apartment: 'Flats', Villa: 'Villas', House: 'Independent houses', Plot: 'Plots', Commercial: 'Commercial properties' };
    const what = this.types.size === 1 ? kinds[[...this.types][0]] : 'Properties';
    const where = [this.localities.size === 1 ? [...this.localities][0] : this.q, this.city].filter(Boolean).join(', ');
    const bhk = this.bhk.size ? [...this.bhk].sort().map(n => (n === 5 ? '5+' : n)).join(', ') + ' BHK ' : '';
    return `${bhk}${what} for ${this.listingType() === 'Rent' ? 'rent' : 'sale'}${where ? ' in ' + where : ''}`;
  }

  /** Every active filter as a removable chip, like the portals' "Applied filters". */
  appliedFilters(): { label: string; remove: () => void }[] {
    const chips: { label: string; remove: () => void }[] = [];
    const fromSet = <T>(set: Set<T>, label: (v: T) => string) =>
      set.forEach(v => chips.push({ label: label(v), remove: () => this.toggle(set, v) }));

    if (this.city) chips.push({ label: this.city, remove: () => { this.city = ''; this.localities.clear(); this.apply(); } });
    if (this.q) chips.push({ label: `"${this.q}"`, remove: () => { this.q = ''; this.apply(); } });
    fromSet(this.localities, v => v);
    fromSet(this.types, v => v);
    fromSet(this.bhk, v => `${v === 5 ? '5+' : v} BHK`);
    fromSet(this.furnishing, v => v);
    fromSet(this.amenities, v => v);
    if (this.constructionStatus) chips.push({ label: this.constructionStatus, remove: () => { this.constructionStatus = ''; this.apply(); } });
    if (this.verifiedOnly) chips.push({ label: 'Verified', remove: () => { this.verifiedOnly = false; this.apply(); } });
    if (this.minPrice) chips.push({ label: `Min ${this.budgetLabel(this.minPrice)}`, remove: () => { this.minPrice = null; this.apply(); } });
    if (this.maxPrice) chips.push({ label: `Max ${this.budgetLabel(this.maxPrice)}`, remove: () => { this.maxPrice = null; this.apply(); } });
    if (this.minArea) chips.push({ label: `Min ${this.minArea} sq ft`, remove: () => { this.minArea = null; this.apply(); } });
    if (this.maxArea) chips.push({ label: `Max ${this.maxArea} sq ft`, remove: () => { this.maxArea = null; this.apply(); } });
    return chips;
  }

  clearAll(): void {
    this.city = '';
    this.q = '';
    this.clearFilters();
  }

  readonly quickFilters = [
    { id: 'verified', label: 'Verified' },
    { id: 'ready', label: 'Ready to move' },
    { id: 'uc', label: 'Under construction' },
    { id: 'furnished', label: 'Furnished' },
    { id: 'bhk2', label: '2 BHK' },
    { id: 'bhk3', label: '3 BHK' }
  ] as const;

  isQuick(id: (typeof this.quickFilters)[number]['id']): boolean {
    switch (id) {
      case 'verified': return this.verifiedOnly;
      case 'ready': return this.constructionStatus === 'Ready to move';
      case 'uc': return this.constructionStatus === 'Under construction';
      case 'furnished': return this.furnishing.has('Furnished');
      case 'bhk2': return this.bhk.has(2);
      case 'bhk3': return this.bhk.has(3);
    }
  }

  toggleQuick(id: (typeof this.quickFilters)[number]['id']): void {
    switch (id) {
      case 'verified': this.verifiedOnly = !this.verifiedOnly; break;
      case 'ready': this.constructionStatus = this.isQuick('ready') ? '' : 'Ready to move'; break;
      case 'uc': this.constructionStatus = this.isQuick('uc') ? '' : 'Under construction'; break;
      case 'furnished': return this.toggle(this.furnishing, 'Furnished');
      case 'bhk2': return this.toggle(this.bhk, 2);
      case 'bhk3': return this.toggle(this.bhk, 3);
    }
    this.apply();
  }

  readonly sortOpen = signal(false);

  goToPage(page: number): void {
    this.apply(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- data ----------

  private readParams(p: Params): void {
    const list = (v?: string) => (v ? v.split(',').filter(Boolean) : []);
    const num = (v?: string) => (v && !isNaN(+v) ? +v : null);

    this.q = p['q'] ?? '';
    this.listingType.set(p['type'] === 'rent' ? 'Rent' : 'Sale');
    this.city = p['city'] ?? '';
    this.types = new Set(list(p['propertyTypes']));
    this.bhk = new Set(list(p['bhk']).map(Number));
    this.furnishing = new Set(list(p['furnishing']));
    this.amenities = new Set(list(p['amenities']));
    this.localities = new Set(list(p['localities']));
    this.constructionStatus = p['status'] ?? '';
    this.verifiedOnly = p['verified'] === '1';
    this.minPrice = num(p['minPrice']);
    this.maxPrice = num(p['maxPrice']);
    this.minArea = num(p['minArea']);
    this.maxArea = num(p['maxArea']);
    this.sort = (p['sort'] as Sort) || 'relevance';
    this.page = num(p['page']) ?? 1;
  }

  private search(): void {
    const kind = this.listingType() === 'Rent' ? 'for rent' : 'for sale';
    this.seo.set({
      title: `${this.bhk.size ? [...this.bhk].sort().join(', ') + ' BHK ' : ''}Properties ${kind}${this.city ? ' in ' + this.city : ''}`,
      description: `Verified ${this.types.size ? [...this.types].join(', ').toLowerCase() : 'homes'} ${kind}${this.city ? ' in ' + this.city : ''}. Compare prices per sq ft, shortlist and contact owners directly.`,
      path: '/properties'
    });
    this.loading.set(true);
    this.error.set('');
    const csv = (s: Set<unknown>) => (s.size ? [...s].join(',') : undefined);

    this.api.search({
      q: this.q || undefined,
      city: this.city || undefined,
      listingType: this.listingType(),
      propertyTypes: csv(this.types),
      bhk: csv(this.bhk),
      furnishing: csv(this.furnishing),
      amenities: csv(this.amenities),
      localities: csv(this.localities),
      constructionStatus: this.constructionStatus || undefined,
      verifiedOnly: this.verifiedOnly || undefined,
      minPrice: this.minPrice ?? undefined,
      maxPrice: this.maxPrice ?? undefined,
      minArea: this.minArea ?? undefined,
      maxArea: this.maxArea ?? undefined,
      sort: this.sort,
      page: this.page,
      pageSize: 10
    }).subscribe({
      next: r => { this.result.set(r); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('We could not load properties. Please try again.'); }
    });
  }

  // ---------- map view ----------

  private async renderMap(items: PropertySummary[]): Promise<void> {
    const L = await import('leaflet');
    const el = this.mapEl()?.nativeElement;
    if (!el) return;

    if (!this.map || this.map.getContainer() !== el) {
      this.map?.remove();
      this.map = L.map(el, { scrollWheelZoom: false }).setView([17.4, 78.4], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(this.map);
    }

    this.map.eachLayer(layer => { if (!(layer instanceof L.TileLayer)) this.map!.removeLayer(layer); });

    const points = items.filter(p => p.latitude != null && p.longitude != null);
    const bounds: [number, number][] = [];

    for (const p of points) {
      const latLng: [number, number] = [p.latitude!, p.longitude!];
      bounds.push(latLng);
      const popup = document.createElement('div');
      popup.className = 'map-popup';
      const link = document.createElement('a');
      link.href = `/properties/${p.propertyId}`;
      link.textContent = p.title; // textContent: listing text is user-supplied
      link.addEventListener('click', e => { e.preventDefault(); this.router.navigate(['/properties', p.propertyId]); });
      const price = document.createElement('strong');
      price.textContent = formatPrice(p.price, p.listingType);
      popup.append(price, document.createElement('br'), link);

      L.circleMarker(latLng, { radius: 9, color: '#173c39', weight: 2, fillColor: '#bd9250', fillOpacity: .9 })
        .bindPopup(popup)
        .addTo(this.map);
    }

    if (bounds.length) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
    setTimeout(() => this.map?.invalidateSize());
  }
}
