import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ContactRequest } from '../contact-request/contact-request';
import { Chatbot } from '../chatbot/chatbot';
import { Property as PropertyService } from '../services/property';
import { CityCount, PropertySearchQuery, PropertySummary } from '../models/property';
import { ShortlistService, recentlyViewed } from '../services/shortlist';
import { session } from '../services/session';
import { SeoService } from '../services/seo';
import { PropertyCard } from '../shared/property-card/property-card';
import { Icon } from '../shared/icon/icon';
import { NumberPipe, PricePipe, emi, loanForEmi } from '../shared/format';

type SearchTab = 'buy' | 'rent' | 'plots' | 'commercial';

/** Landing page laid out like the big Indian portals: tabbed search, intent tiles, themed bands, cities, tools, quick links. */
@Component({
  selector: 'app-home',
  imports: [FormsModule, NgTemplateOutlet, RouterLink, ContactRequest, Chatbot, PropertyCard, Icon, PricePipe, NumberPipe],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  private readonly api = inject(PropertyService);
  private readonly router = inject(Router);
  private readonly shortlist = inject(ShortlistService);
  private readonly seo = inject(SeoService);

  // ---------- search ----------
  readonly tabs: { id: SearchTab; label: string }[] = [
    { id: 'buy', label: 'Buy' },
    { id: 'rent', label: 'Rent' },
    { id: 'plots', label: 'Plots/Land' },
    { id: 'commercial', label: 'Commercial' }
  ];
  readonly tab = signal<SearchTab>('buy');
  residentialType = '';
  text = '';

  readonly cities = signal<CityCount[]>([]);
  /** Suggestions for the search box: cities first, then localities. */
  readonly suggestions = computed(() => {
    const cities = this.cities().map(c => c.city);
    const localities = this.cities().flatMap(c => c.localities.map(l => `${l}, ${c.city}`));
    return [...cities, ...localities];
  });

  // ---------- listings ----------
  readonly featured = signal<PropertySummary[]>([]);
  readonly rentals = signal<PropertySummary[]>([]);
  readonly newest = signal<PropertySummary[]>([]);
  readonly recent = signal<PropertySummary[]>([]);
  readonly cityCovers = signal<Map<string, string>>(new Map());
  readonly typeCounts = signal<Map<string, number>>(new Map());
  readonly liveTotal = signal(0);
  readonly loading = signal(true);
  readonly skeletons = [1, 2, 3];

  readonly isOwner = session.role() === 'Owner';

  /** Hand-picked city photos; other cities fall back to one of their listings. */
  private readonly cityPhotos: Record<string, string> = {
    Hyderabad: '/images/city-hyderabad.webp',
    Bengaluru: '/images/city-bengaluru.webp',
    Visakhapatnam: '/images/city-visakhapatnam.webp',
    Vijayawada: '/images/city-vijayawada.webp',
    Amaravati: '/images/city-amaravati.webp'
  };

  cityImage(city: string): string | undefined {
    return this.cityPhotos[city] ?? this.cityCovers().get(city);
  }

  readonly verifiedShare = signal(0);

  readonly intents = [
    { label: 'Buying a home', image: '/images/tile-buy.webp', link: ['/properties'], params: {} },
    { label: 'Renting a home', image: '/images/tile-rent.webp', link: ['/properties'], params: { type: 'rent' } },
    { label: 'Sell / rent your property', image: '/images/tile-sell.webp', link: ['/add-property'], params: {} },
    { label: 'Plots / land', image: '/images/tile-plots.webp', link: ['/properties'], params: { propertyTypes: 'Plot' } },
    { label: 'Commercial', image: '/images/tile-commercial.webp', link: ['/properties'], params: { propertyTypes: 'Commercial' } },
    { label: 'Plan your budget', image: '/images/tile-budget.webp', link: ['/'], params: {}, fragment: 'tools' }
  ];

  readonly propertyTypes = [
    { type: 'Apartment', label: 'Residential apartments', image: '/images/type-apartment.webp' },
    { type: 'Villa', label: 'Villas', image: '/images/type-villa.webp' },
    { type: 'House', label: 'Independent houses', image: '/images/type-house.webp' },
    { type: 'Plot', label: 'Plots & land', image: '/images/type-plot.webp' }
  ];

  readonly reasons = [
    { icon: 'verified', title: 'Every listing reviewed', text: 'An admin checks each listing before buyers see it, and verified homes are marked.' },
    { icon: 'phone', title: 'Talk to owners directly', text: 'Send inquiries and get replies from owners, with no brokerage in between.' },
    { icon: 'calendar', title: 'Book site visits online', text: 'Pick a slot; the owner confirms or suggests another time. Reminders included.' },
    { icon: 'sparkle', title: 'Know the fair price', text: 'Price per sq ft compared with the locality, plus EMI and budget calculators.' }
  ];

  // ---------- tools ----------
  readonly toolTab = signal<'emi' | 'budget'>('emi');
  loanAmount = 5_000_000;
  rate = 8.5;
  years = 20;
  income = 100_000;
  existingEmis = 0;

  monthlyEmi(): number {
    return Math.round(emi(this.loanAmount, this.rate, this.years));
  }

  totalInterest(): number {
    return Math.max(0, this.monthlyEmi() * this.years * 12 - this.loanAmount);
  }

  /** Banks typically allow EMIs up to ~50% of take-home pay and lend ~80% of the price. */
  affordableEmi(): number {
    return Math.max(0, this.income * 0.5 - this.existingEmis);
  }

  affordablePrice(): number {
    return Math.round(loanForEmi(this.affordableEmi(), this.rate, this.years) / 0.8 / 1_00_000) * 1_00_000;
  }

  searchWithinBudget(): void {
    this.router.navigate(['/properties'], { queryParams: { maxPrice: this.affordablePrice() || null } });
  }

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.seo.set({ path: '/' });
    this.shortlist.ensureLoaded();

    const take = (query: PropertySearchQuery) =>
      this.api.search(query).pipe(catchError(() => of(null)));

    forkJoin({
      cities: this.api.getCities().pipe(catchError(() => of([] as CityCount[]))),
      featured: take({ sort: 'relevance', listingType: 'Sale', pageSize: 8 }),
      rentals: take({ sort: 'newest', listingType: 'Rent', pageSize: 8 }),
      // ponytail: one page of 50 live listings feeds city covers, type counts and recently viewed;
      // add aggregate endpoints when listings grow past that.
      all: take({ sort: 'newest', pageSize: 50 })
    }).subscribe(r => {
      this.cities.set(r.cities);
      this.featured.set(r.featured?.items ?? []);
      this.rentals.set(r.rentals?.items ?? []);

      const all = r.all?.items ?? [];
      this.liveTotal.set(r.all?.total ?? 0);
      const shown = new Set((r.featured?.items ?? []).map(p => p.propertyId));
      this.newest.set(all.filter(p => !shown.has(p.propertyId)).slice(0, 8));

      const covers = new Map<string, string>();
      const types = new Map<string, number>();
      for (const p of all) {
        if (p.imageUrl && !covers.has(p.city)) covers.set(p.city, p.imageUrl);
        types.set(p.propertyType, (types.get(p.propertyType) ?? 0) + 1);
      }
      this.cityCovers.set(covers);
      this.verifiedShare.set(all.length ? Math.round((all.filter(p => p.isVerified).length / all.length) * 100) : 0);
      this.typeCounts.set(types);

      const ids = recentlyViewed.list();
      this.recent.set(ids.map(id => all.find(p => p.propertyId === id)).filter((p): p is PropertySummary => !!p).slice(0, 4));

      this.loading.set(false);
    });
  }

  // ---------- actions ----------
  setTab(tab: SearchTab): void {
    this.tab.set(tab);
  }

  search(): void {
    const text = this.text.trim();
    const tab = this.tab();

    // "Kondapur, Hyderabad" → locality + city; "Hyderabad" → city; anything else → keyword.
    const [first, second] = text.split(',').map(s => s.trim());
    const cityNames = this.cities().map(c => c.city.toLowerCase());
    let city: string | null = null;
    let q: string | null = text || null;
    if (second && cityNames.includes(second.toLowerCase())) {
      city = this.cities().find(c => c.city.toLowerCase() === second.toLowerCase())!.city;
      q = first || null;
    } else if (first && cityNames.includes(first.toLowerCase())) {
      city = this.cities().find(c => c.city.toLowerCase() === first.toLowerCase())!.city;
      q = null;
    }

    const propertyTypes =
      tab === 'plots' ? 'Plot'
      : tab === 'commercial' ? 'Commercial'
      : this.residentialType || null;

    this.router.navigate(['/properties'], {
      queryParams: { type: tab === 'rent' ? 'rent' : null, city, q, propertyTypes }
    });
  }

  quickLinks(): { label: string; params: Record<string, string> }[] {
    return this.cities().flatMap((c): { label: string; params: Record<string, string> }[] => [
      { label: `Flats for sale in ${c.city}`, params: { city: c.city, propertyTypes: 'Apartment' } },
      { label: `Flats for rent in ${c.city}`, params: { city: c.city, type: 'rent', propertyTypes: 'Apartment' } },
      { label: `Villas in ${c.city}`, params: { city: c.city, propertyTypes: 'Villa' } },
      { label: `Independent houses in ${c.city}`, params: { city: c.city, propertyTypes: 'House' } },
      { label: `2 BHK in ${c.city}`, params: { city: c.city, bhk: '2' } },
      { label: `3 BHK in ${c.city}`, params: { city: c.city, bhk: '3' } }
    ]);
  }

  scrollRail(rail: HTMLElement, direction: 1 | -1): void {
    rail.scrollBy({ left: direction * rail.clientWidth * 0.9, behavior: 'smooth' });
  }
}
