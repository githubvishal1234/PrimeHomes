import { SavedSearch, SavedSearchService, queryParamsOf } from '../services/saved-search';
import { PropertyCard } from '../shared/property-card/property-card';
import { ShortlistService, recentlyViewed } from '../services/shortlist';
import { Property as PropertyService } from '../services/property';
import { PropertySummary } from '../models/property';
import { ToastService } from '../services/toast';
import { Component, OnInit, ChangeDetectorRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  Favorite,
  FavoriteService
} from '../services/favorite.service';

import {
  Inquiry
} from '../models/inquiry';

import {
  InquiryService
} from '../services/inquiry';


@Component({
  selector: 'app-buyer-dashboard',

  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    PropertyCard
  ],

  templateUrl: './buyer-dashboard.html',

  styleUrl: './buyer-dashboard.css'
})


export class BuyerDashboard implements OnInit {

  private toast = inject(ToastService);


  // =====================================================
  // BUYER INFORMATION
  // =====================================================

  buyerName: string =
    localStorage.getItem('name') || 'Buyer';


  // =====================================================
  // FAVORITES
  // =====================================================

  favorites: Favorite[] = [];

  totalFavorites = 0;
  isLoadingFavorites = true;
  favoritesError = '';


  // =====================================================
  // INQUIRIES
  // =====================================================

  inquiries: Inquiry[] = [];

  totalInquiries = 0;
  isLoadingInquiries = true;
  inquiriesError = '';


  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    private favoriteService: FavoriteService,

    private inquiryService: InquiryService,

    private cdr: ChangeDetectorRef
  ) {}


  // =====================================================
  // PAGE LOAD
  // =====================================================

  ngOnInit(): void {

    this.loadFavorites();

    this.loadInquiries();

    this.shortlist.ensureLoaded();

    this.loadActivity();

    this.loadSavedSearches();

  }

  // =====================================================
  // SAVED SEARCHES
  // =====================================================

  private readonly savedSearchApi = inject(SavedSearchService);
  readonly savedSearches = signal<SavedSearch[]>([]);
  readonly queryParamsOf = queryParamsOf;

  private loadSavedSearches(): void {
    this.savedSearchApi.getMine().subscribe({
      next: list => this.savedSearches.set(list),
      error: () => this.savedSearches.set([])
    });
  }

  toggleAlerts(search: SavedSearch): void {
    const enabled = !search.alertsEnabled;
    this.savedSearchApi.setAlerts(search.savedSearchId, enabled).subscribe({
      next: () => {
        this.savedSearches.update(list => list.map(s => s.savedSearchId === search.savedSearchId ? { ...s, alertsEnabled: enabled } : s));
        this.toast.success(enabled ? 'Alerts on for this search.' : 'Alerts paused for this search.');
      },
      error: () => this.toast.error('Could not update alerts.')
    });
  }

  deleteSavedSearch(search: SavedSearch): void {
    this.savedSearchApi.delete(search.savedSearchId).subscribe({
      next: () => {
        this.savedSearches.update(list => list.filter(s => s.savedSearchId !== search.savedSearchId));
        this.toast.success('Saved search deleted.');
      },
      error: () => this.toast.error('Could not delete the saved search.')
    });
  }

  // =====================================================
  // RECENTLY VIEWED + RECOMMENDED
  // =====================================================

  private readonly propertyApi = inject(PropertyService);
  protected readonly shortlist = inject(ShortlistService);
  readonly recentlyViewedHomes = signal<PropertySummary[]>([]);
  readonly recommended = signal<PropertySummary[]>([]);
  readonly recommendedReason = signal('');

  /**
   * Recommendations follow what the buyer has been looking at: the most viewed city,
   * listing type and BHK, excluding homes already seen.
   */
  private loadActivity(): void {
    const viewedIds = recentlyViewed.list();

    // ponytail: one page of 50 live listings, matched client-side; add an ids= filter when listings grow.
    this.propertyApi.search({ pageSize: 50 }).subscribe({
      next: page => {
        const viewed = viewedIds
          .map(id => page.items.find(p => p.propertyId === id))
          .filter((p): p is PropertySummary => !!p);
        this.recentlyViewedHomes.set(viewed.slice(0, 3));

        const mostCommon = <T>(values: T[]): T | undefined => {
          const counts = new Map<T, number>();
          values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
          return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        };

        const city = mostCommon(viewed.map(p => p.city));
        const listingType = mostCommon(viewed.map(p => p.listingType)) ?? 'Sale';
        const bhk = mostCommon(viewed.map(p => p.bhk));
        const seen = new Set(viewedIds);

        const candidates = page.items
          .filter(p => !seen.has(p.propertyId) && p.listingType === listingType)
          .sort((a, b) =>
            (Number(b.city === city) * 2 + Number(b.bhk === bhk)) - (Number(a.city === city) * 2 + Number(a.bhk === bhk)));

        this.recommended.set(candidates.slice(0, 3));
        this.recommendedReason.set(city
          ? `Based on homes you viewed in ${city}`
          : 'Popular verified homes to get you started');
      },
      error: () => this.recommended.set([])
    });
  }


  // =====================================================
  // LOAD FAVORITES
  // =====================================================

  loadFavorites(): void {

    this.isLoadingFavorites = true;
    this.favoritesError = '';

    this.favoriteService
      .getMyFavorites()
      .subscribe({



        next: (data) => {

          console.log(
            'Buyer Favorites:',
            data
          );

          this.favorites = data;


          

          this.totalFavorites =
            data.length;

          this.isLoadingFavorites = false;
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Error loading buyer favorites:',
            error
          );

          this.isLoadingFavorites = false;
          this.favoritesError = 'Unable to load your saved homes. Please try again.';
          this.cdr.detectChanges();

        }

      });

  }


  // =====================================================
  // LOAD INQUIRIES
  // =====================================================

  loadInquiries(): void {

    this.isLoadingInquiries = true;
    this.inquiriesError = '';

    this.inquiryService
      .getMyInquiries()
      .subscribe({

        next: (data) => {

          console.log(
            'Buyer Inquiries:',
            data
          );

          this.inquiries = data;

          this.totalInquiries =
            data.length;

          this.isLoadingInquiries = false;
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Error loading buyer inquiries:',
            error
          );

          this.isLoadingInquiries = false;
          this.inquiriesError = 'Unable to load your inquiries. Please try again.';
          this.cdr.detectChanges();

        }

      });

  }


  // =====================================================
  // GET INQUIRY STATUS
  // =====================================================

  getInquiryStatus(status?: string): string {

    if (!status || status.trim() === '') {

      return 'New';

    }


    const normalizedStatus =
      status.trim().toLowerCase();


    switch (normalizedStatus) {

      case 'new':

        return 'New';


      case 'pending':

        return 'Pending';


      case 'responded':

        return 'Responded';


      case 'rejected':

        return 'Rejected';


      default:

        return status;

    }

  }


  // =====================================================
  // GET INQUIRY STATUS CSS CLASS
  // =====================================================

  getInquiryStatusClass(status?: string): string {

    const normalizedStatus =
      this.getInquiryStatus(status).toLowerCase();


    switch (normalizedStatus) {

      case 'new':

        return 'status-new';


      case 'pending':

        return 'status-pending';


      case 'responded':

        return 'status-responded';


      case 'rejected':

        return 'status-rejected';


      default:

        return 'status-new';

    }

  }


  // =====================================================
  // REMOVE FAVORITE
  // =====================================================

  removeFavorite(propertyId: number): void {

    const confirmed = confirm(
      'Are you sure you want to remove this property from favorites?'
    );


    if (!confirmed) {

      return;

    }


    this.favoriteService
      .removeFavorite(propertyId)
      .subscribe({

        next: (response) => {

          console.log(
            'Favorite removed:',
            response
          );


          this.favorites =
            this.favorites.filter(
              favorite =>
                favorite.propertyId !== propertyId
            );


          this.totalFavorites =
            this.favorites.length;


          this.toast.success('Property removed from favorites.');


          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'Error removing favorite:',
            error
          );


          this.toast.error('Unable to remove favorite.');

        }

      });

  }

}