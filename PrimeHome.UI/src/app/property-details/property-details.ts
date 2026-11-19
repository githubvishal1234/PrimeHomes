import { SiteVisitService, VISIT_HOURS, istSlotToUtc } from '../services/site-visit';
import { apiErrorMessage } from '../services/auth';
import { Router } from '@angular/router';
import { goToLogin, session } from '../services/session';
import { ToastService } from '../services/toast';
﻿
import * as L from 'leaflet';

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef, inject, signal, DestroyRef } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ShortlistService, recentlyViewed } from '../services/shortlist';
import { PropertyCard } from '../shared/property-card/property-card';
import { Icon } from '../shared/icon/icon';
import { NumberPipe, PricePipe, emi, formatNumber, formatPrice } from '../shared/format';
import { SeoService } from '../services/seo';
import { OwnerSummary, PriceInsights, PropertySummary, slugFor } from '../models/property';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Property,
  PropertyImage
} from '../models/property';

import { Property as PropertyService } from '../services/property';
import { InquiryService } from '../services/inquiry';

import {
  PropertyReview,
  PropertyReviewsResponse,
  PropertyReviewService
} from '../services/property-review';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

@Component({
  selector: 'app-property-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Icon, PropertyCard, PricePipe, NumberPipe],
  templateUrl: './property-details.html',
  styleUrl: './property-details.css'
})
export class PropertyDetails implements OnInit, OnDestroy {

  private toast = inject(ToastService);
  private router = inject(Router);
  private siteVisitService = inject(SiteVisitService);

  // Site visit booking
  readonly visitHours = VISIT_HOURS;
  readonly minVisitDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  visitDate = '';
  visitHour = 11;
  visitNote = '';
  isBookingVisit = false;

  property?: Property;
  propertyId = 0;
  isLoadingProperty = true;
  propertyError = '';

  private propertyMap?: L.Map;
  private propertyMarker?: L.Marker;
  private routeLayer?: L.Polyline;
  private startMarker?: L.CircleMarker;

  galleryImages: PropertyImage[] = [];
  selectedImageUrl: string | null = null;

  inquiryMessage = '';

  isLoggedIn = false;
  userRole = '';

  routeStartLocation = '';
  isRouteLoading = false;
  private routeStartLatitude?: number;
  private routeStartLongitude?: number;
  routeMessage = '';
  routeDistance = '';
  routeDuration = '';

  // Property reviews and ratings
  reviews: PropertyReview[] = [];
  averageRating = 0;
  totalReviews = 0;

  reviewRating = 5;
  reviewComment = '';
  isSubmittingReview = false;
  reviewMessage = '';

  constructor(
    private route: ActivatedRoute,
    private propertyService: PropertyService,
    private inquiryService: InquiryService,
    private propertyReviewService: PropertyReviewService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = session.isLoggedIn();
    this.userRole = localStorage.getItem('role') || '';

    this.shortlist.ensureLoaded();

    // Follow id changes too: "similar properties" links reuse this component.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = Number(params.get('id'));

      if (!Number.isInteger(id) || id <= 0) {
        this.isLoadingProperty = false;
        this.propertyError = 'This property link is invalid.';
        return;
      }

      this.propertyId = id;
      this.property = undefined;
      this.similar.set([]);
      this.loadProperty();
      this.loadGalleryImages(id);
      this.loadPropertyReviews(id);
      window.scrollTo({ top: 0 });
    });
  }

  // ---------- price, overview, EMI, similar ----------

  readonly similar = signal<PropertySummary[]>([]);
  readonly insights = signal<PriceInsights | null>(null);
  private readonly seo = inject(SeoService);
  protected readonly shortlist = inject(ShortlistService);
  private readonly destroyRef = inject(DestroyRef);

  loanPercent = 80;
  interestRate = 8.5;
  tenureYears = 20;

  // ---------- 99acres-style page helpers ----------

  readonly owner = signal<OwnerSummary | null>(null);

  readonly sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'about', label: 'About' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'price', label: 'Price insights' },
    { id: 'locality', label: 'Explore locality' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'similar', label: 'Similar' }
  ];

  scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Shares the page with the device's share sheet, or copies the link. */
  async share(p: Property): Promise<void> {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.toast.success('Link copied. Paste it to share this property.');
    } catch {
      /* user closed the share sheet */
    }
  }

  photoCount(p: Property): number {
    return (p.imageUrl ? 1 : 0) + (this.galleryImages?.filter(i => i.imageUrl).length ?? 0);
  }

  /** Short headline for the page, e.g. "3 BHK Flat for sale". */
  headline(p: Property): string {
    const kind = ({ Apartment: 'Flat', House: 'Independent House', Villa: 'Villa', Plot: 'Plot', Commercial: 'Commercial Property' } as Record<string, string>)[p.propertyType] ?? 'Property';
    return `${p.bhk ? p.bhk + ' BHK ' : ''}${kind} for ${p.listingType === 'Rent' ? 'rent' : 'sale'}`;
  }

  /** Key highlights strip: the most decision-relevant facts first. */
  highlights(p: Property): string[] {
    const items = [
      p.isVerified ? 'Verified listing' : null,
      p.constructionStatus,
      p.furnishing,
      p.facing ? `${p.facing} facing` : null,
      p.parking ? `${p.parking} covered parking` : null,
      ...this.getLifestyleFeatures(p.lifestyleFeatures).slice(0, 3)
    ];
    return items.filter((x): x is string => !!x).slice(0, 7);
  }

  amenityIcon(feature: string): string {
    const f = feature.toLowerCase();
    if (f.includes('pool')) return 'waves';
    if (f.includes('fitness') || f.includes('gym')) return 'dumbbell';
    if (f.includes('security')) return 'shield';
    if (f.includes('parking')) return 'car';
    if (f.includes('garden') || f.includes('park')) return 'tree';
    if (f.includes('power')) return 'bolt';
    if (f.includes('play') || f.includes('children')) return 'play';
    if (f.includes('club')) return 'building';
    return 'check';
  }

  relatedSearches(p: Property): { label: string; params: Record<string, string> }[] {
    const type: Record<string, string> = p.listingType === 'Rent' ? { type: 'rent' } : {};
    const verb = p.listingType === 'Rent' ? 'for rent' : 'for sale';
    const links: { label: string; params: Record<string, string> }[] = [
      { label: `Properties ${verb} in ${p.location}`, params: { ...type, city: p.city, q: p.location } },
      { label: `Properties ${verb} in ${p.city}`, params: { ...type, city: p.city } },
      { label: `${p.propertyType}s ${verb} in ${p.city}`, params: { ...type, city: p.city, propertyTypes: p.propertyType } }
    ];
    if (p.bhk) links.push({ label: `${p.bhk} BHK ${verb} in ${p.city}`, params: { ...type, city: p.city, bhk: String(p.bhk) } });
    return links;
  }

  pricePerSqft(p: Property): number {
    return p.area > 0 ? Math.round(p.price / p.area) : 0;
  }

  loanAmount(p: Property): number {
    return Math.round((p.price * this.loanPercent) / 100);
  }

  monthlyEmi(p: Property): number {
    return Math.round(emi(this.loanAmount(p), this.interestRate, this.tenureYears));
  }

  totalInterest(p: Property): number {
    return Math.max(0, this.monthlyEmi(p) * this.tenureYears * 12 - this.loanAmount(p));
  }

  /** Overview rows shown only when the owner filled them in. */
  overview(p: Property): { icon: string; label: string; value: string }[] {
    const floor = p.floor != null
      ? (p.floor === 0 ? 'Ground' : `${p.floor}`) + (p.totalFloors ? ` of ${p.totalFloors}` : '')
      : null;
    const rows: [string, string, string | number | null | undefined][] = [
      ['layers', 'Configuration', p.bhk ? `${p.bhk} BHK${p.bathrooms ? `, ${p.bathrooms} bath` : ''}` : p.propertyType],
      ['area', 'Built-up area', p.area ? `${formatNumber(p.area)} sq ft` : null],
      ['building', 'Floor', floor],
      ['compass', 'Facing', p.facing],
      ['sofa', 'Furnishing', p.furnishing],
      ['clock', 'Possession', p.constructionStatus],
      ['calendar', 'Property age', p.ageYears != null ? (p.ageYears === 0 ? 'New' : `${p.ageYears} year${p.ageYears === 1 ? '' : 's'}`) : null],
      ['car', 'Parking', p.parking != null ? (p.parking === 0 ? 'None' : `${p.parking} covered`) : null],
      ['eye', 'Views', p.viewCount ? formatNumber(p.viewCount) : null]
    ];
    return rows.filter(r => r[2] != null && r[2] !== '').map(([icon, label, value]) => ({ icon, label, value: String(value) }));
  }

  statusNote(p: Property): string | null {
    if (!this.isPropertyOwner() && this.userRole !== 'Admin') return null;
    switch (p.status) {
      case 'Draft': return 'This is a draft. Submit it from My Properties to send it for review.';
      case 'Pending': return 'Waiting for admin review. Buyers will see it once it is approved.';
      case 'Rejected': return `Not approved: ${p.rejectReason || 'see notifications'}. Edit and resubmit from My Properties.`;
      case 'Expired': return 'Expired after 90 days without updates. Renew it from My Properties.';
      case 'Sold': case 'Rented': return `Marked ${p.status.toLowerCase()}. It no longer appears in search.`;
      default: return null;
    }
  }

  loadProperty(): void {
    this.isLoadingProperty = true;
    this.propertyError = '';

    this.propertyService.getPropertyById(this.propertyId).subscribe({
      next: (data: Property) => {
        this.isLoadingProperty = false;
        this.property = data;
        this.selectedImageUrl = data.imageUrl || null;
        recentlyViewed.add(data.propertyId);
        if (this.route.snapshot.fragment === 'contact') {
          setTimeout(() => this.scrollToSection('contact'), 400); // "Contact owner" from a results card
        }
        this.seo.set({
          title: [data.title, data.location, data.city]
            .filter((part, i) => i === 0 || !data.title.toLowerCase().includes(part.toLowerCase()))
            .join(', '),
          description: `${formatPrice(data.price, data.listingType)}${data.bhk ? ` · ${data.bhk} BHK` : ''} · ${formatNumber(data.area)} sq ft ${data.propertyType?.toLowerCase() ?? 'property'} for ${data.listingType === 'Rent' ? 'rent' : 'sale'} in ${data.location}, ${data.city}. ${data.description ?? ''}`,
          path: `/properties/${data.propertyId}/${slugFor(data.title, data.city)}`,
          image: data.imageUrl
        });
        this.insights.set(null);
        this.owner.set(null);
        if (data.status === 'Approved') {
          this.propertyService.getOwnerSummary(data.propertyId).subscribe({
            next: o => this.owner.set(o),
            error: () => this.owner.set(null)
          });
          this.propertyService.getInsights(data.propertyId).subscribe({
            next: i => this.insights.set(i),
            error: () => this.insights.set(null)
          });
        }
        this.propertyService.getSimilar(data.propertyId, 3).subscribe({
          next: list => this.similar.set(list),
          error: () => this.similar.set([])
        });
        this.cdr.detectChanges();

        if (this.hasValidCoordinates()) {
          setTimeout(() => this.initializePropertyMap(), 300);
        }
      },
      error: (error) => {
        console.error('Error loading property:', error);
        this.isLoadingProperty = false;
        this.propertyError = 'This property could not be loaded. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeLayer && this.propertyMap) {
      this.propertyMap.removeLayer(this.routeLayer);
      this.routeLayer = undefined;
    }

    if (this.startMarker && this.propertyMap) {
      this.propertyMap.removeLayer(this.startMarker);
      this.startMarker = undefined;
    }

    if (this.propertyMap) {
      this.propertyMap.remove();
      this.propertyMap = undefined;
    }
  }

  private hasValidCoordinates(): boolean {
    if (!this.property) {
      return false;
    }

    const latitude = this.property.latitude;
    const longitude = this.property.longitude;

    return (
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  isPropertyOwner(): boolean {
    if (!this.property) {
      return false;
    }

    const loggedInUserId = Number(localStorage.getItem('userId'));

    return loggedInUserId > 0 &&
      loggedInUserId === this.property.ownerId;
  }

  
loadGalleryImages(propertyId: number): void {
  this.propertyService.getPropertyImages(propertyId).subscribe({
    next: (images: PropertyImage[]) => {
      this.galleryImages = (images || []).filter(
        image => !!image.imageUrl?.trim()
      );

      this.cdr.detectChanges();
    },
    error: (error) => {
      console.error('Error loading gallery images:', error);
      this.galleryImages = [];
      this.cdr.detectChanges();
    }
  });
}


  // Load reviews and ratings for a property
  loadPropertyReviews(propertyId: number): void {
    this.propertyReviewService.getPropertyReviews(propertyId).subscribe({
      next: (response: PropertyReviewsResponse) => {
        this.reviews = response.reviews || [];
        this.averageRating = response.averageRating || 0;
        this.totalReviews = response.totalReviews || 0;
        this.reviewMessage = '';

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading property reviews:', error);
        this.reviewMessage = 'Unable to load property reviews.';
        this.cdr.detectChanges();
      }
    });
  }

  // Return a five-star display string for a rating
  getStarDisplay(rating: number): string {
    const safeRating = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
  }

  // Submit a review as a logged-in Buyer
  submitReview(): void {
    if (!this.property) {
      return;
    }

    if (!this.isLoggedIn || this.userRole !== 'Buyer') {
      this.reviewMessage = 'Please login as a Buyer to submit a review.';
      return;
    }

    if (
      !Number.isInteger(this.reviewRating) ||
      this.reviewRating < 1 ||
      this.reviewRating > 5
    ) {
      this.reviewMessage = 'Please select a rating between 1 and 5.';
      return;
    }

    const comment = this.reviewComment.trim();

    if (!comment) {
      this.reviewMessage = 'Please enter a review comment.';
      return;
    }

    if (comment.length > 1000) {
      this.reviewMessage = 'Your review cannot exceed 1000 characters.';
      return;
    }

    this.isSubmittingReview = true;
    this.reviewMessage = '';

    this.propertyReviewService.addReview({
      propertyId: this.property.propertyId,
      rating: this.reviewRating,
      comment
    }).subscribe({
      next: () => {
        this.reviewComment = '';
        this.reviewRating = 5;
        this.reviewMessage = 'Review submitted successfully.';

        this.loadPropertyReviews(this.property!.propertyId);
        this.isSubmittingReview = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error submitting review:', error);

        if (error.status === 409) {
          this.reviewMessage =
            error.error?.message ||
            'You have already reviewed this property.';
        } else if (error.status === 401) {
          this.reviewMessage =
            'Your session may have expired. Please login again.';
        } else if (error.status === 403) {
          this.reviewMessage =
            'Only Buyers can submit property reviews.';
        } else {
          this.reviewMessage =
            error.error?.message ||
            'Unable to submit your review. Please try again.';
        }

        this.isSubmittingReview = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectGalleryImage(imageUrl: string): void {
    this.selectedImageUrl = imageUrl;
  }

  deleteGalleryImage(image: PropertyImage): void {
    if (!this.isPropertyOwner()) {
      this.toast.error('Only the property owner can delete gallery images.');
      return;
    }

    const confirmed = confirm(
      'Are you sure you want to delete this image?'
    );

    if (!confirmed) {
      return;
    }

    this.propertyService
      .deletePropertyImage(image.propertyImageId)
      .subscribe({
        next: () => {
          this.toast.success('Gallery image deleted successfully.');

          this.galleryImages = this.galleryImages.filter(
            x => x.propertyImageId !== image.propertyImageId
          );

          if (this.selectedImageUrl === image.imageUrl) {
            this.selectedImageUrl = this.property?.imageUrl || null;
          }

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error deleting gallery image:', error);
          this.toast.error('Unable to delete gallery image.');
        }
      });
  }

  signIn(): void {
    goToLogin(this.router);
  }

  bookVisit(): void {
    if (!this.property || !this.visitDate) {
      return;
    }

    this.isBookingVisit = true;

    this.siteVisitService
      .book(this.property.propertyId, istSlotToUtc(this.visitDate, this.visitHour), this.visitNote.trim() || undefined)
      .subscribe({
        next: () => {
          this.isBookingVisit = false;
          this.visitDate = '';
          this.visitNote = '';
          this.toast.success('Visit requested. You will be notified when the owner confirms.');
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isBookingVisit = false;
          this.toast.error(apiErrorMessage(error, 'Unable to request a visit.'));
          this.cdr.detectChanges();
        }
      });
  }

  sendInquiry(): void {
    if (!this.property) {
      return;
    }

    if (!this.isLoggedIn || this.userRole !== 'Buyer') {
      if (!this.isLoggedIn) {
        goToLogin(this.router);
      } else {
        this.toast.info('Contacting owners is for buyer accounts.');
      }
      return;
    }

    if (!this.inquiryMessage.trim()) {
      this.toast.error('Please enter a message.');
      return;
    }

    const inquiry = {
      propertyId: this.property.propertyId,
      message: this.inquiryMessage.trim()
    };

    this.inquiryService.addInquiry(inquiry).subscribe({
      next: () => {
        this.toast.success('Inquiry sent successfully!');
        this.inquiryMessage = '';
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error sending inquiry:', error);
        this.toast.error(error.error?.message || error.error?.errors?.Message?.[0] || 'Unable to send inquiry.');
      }
    });
  }

  async showRouteToProperty(): Promise<void> {
    if (!this.property || !this.hasValidCoordinates()) {
      this.routeMessage = 'The property location is not available.';
      return;
    }

    const startLocation = this.routeStartLocation.trim();

    if (!startLocation) {
      this.routeMessage = 'Please enter your starting location.';
      return;
    }

    this.isRouteLoading = true;
    this.routeMessage = 'Searching for your starting location...';
    this.routeDistance = '';
    this.routeDuration = '';

    this.cdr.detectChanges();

    try {
      // STEP 1: Find the starting location
      const geocodingUrl =
        'https://nominatim.openstreetmap.org/search' +
        '?format=jsonv2&limit=1&q=' +
        encodeURIComponent(startLocation);

      const geocodingResponse = await fetch(geocodingUrl);

      if (!geocodingResponse.ok) {
        throw new Error(
          'Unable to search for the starting location.'
        );
      }

      const locations = await geocodingResponse.json();

      if (!Array.isArray(locations) || locations.length === 0) {
        this.routeMessage =
          'Starting location not found. Try a more specific address or landmark.';
        return;
      }

      const startLatitude = Number(locations[0].lat);
      const startLongitude = Number(locations[0].lon);

      this.routeStartLatitude = startLatitude;
      this.routeStartLongitude = startLongitude;

      if (
        !Number.isFinite(startLatitude) ||
        !Number.isFinite(startLongitude) ||
        startLatitude < -90 ||
        startLatitude > 90 ||
        startLongitude < -180 ||
        startLongitude > 180
      ) {
        this.routeMessage =
          'The starting location has invalid coordinates.';
        return;
      }

      // STEP 2: Get the property destination
      const destinationLatitude = this.property.latitude!;
      const destinationLongitude = this.property.longitude!;

      this.routeMessage = 'Calculating the driving route...';
      this.cdr.detectChanges();

      // STEP 3: Request a driving route from OSRM
      const routingUrl =
        'https://router.project-osrm.org/route/v1/driving/' +
        `${startLongitude},${startLatitude};` +
        `${destinationLongitude},${destinationLatitude}` +
        '?overview=full&geometries=geojson';

      const routingResponse = await fetch(routingUrl);

      if (!routingResponse.ok) {
        throw new Error('Unable to calculate the route.');
      }

      const routingData = await routingResponse.json();

      // OSRM returns route geometry under geometry.coordinates
      const route = routingData?.routes?.[0];
      const coordinates = route?.geometry?.coordinates;

      if (
        routingData?.code !== 'Ok' ||
        !route ||
        !Array.isArray(coordinates) ||
        coordinates.length === 0
      ) {
        this.routeMessage =
          'No driving route could be calculated for this trip.';
        return;
      }

      // Convert [longitude, latitude] to Leaflet [latitude, longitude]
      const routeCoordinates: [number, number][] =
        coordinates.map((coordinate: number[]) => [
          Number(coordinate[1]),
          Number(coordinate[0])
        ]);

      // STEP 4: Display distance and estimated driving time
      const distanceKm = route.distance / 1000;
      const durationMinutes = Math.round(route.duration / 60);

      this.routeDistance = `${distanceKm.toFixed(1)} km`;

      this.routeDuration =
        durationMinutes >= 60
          ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
          : `${durationMinutes} min`;

      // STEP 5: Make sure the map exists
      if (!this.propertyMap) {
        this.initializePropertyMap();
      }

      if (!this.propertyMap) {
        throw new Error('Property map could not be initialized.');
      }

      // Remove the previous route
      if (this.routeLayer) {
        this.propertyMap.removeLayer(this.routeLayer);
        this.routeLayer = undefined;
      }

      // Remove the previous starting marker
      if (this.startMarker) {
        this.propertyMap.removeLayer(this.startMarker);
        this.startMarker = undefined;
      }

      // STEP 6: Draw the driving route
      this.routeLayer = L.polyline(routeCoordinates, {
        color: '#0d6efd',
        weight: 5,
        opacity: 0.85
      }).addTo(this.propertyMap);

      // Mark the starting location
      this.startMarker = L.circleMarker(
        [startLatitude, startLongitude],
        {
          radius: 8,
          color: '#198754',
          fillColor: '#198754',
          fillOpacity: 1
        }
      ).addTo(this.propertyMap);

      this.startMarker.bindPopup(`Start: ${startLocation}`);

      // Keep the property marker visible
      if (this.propertyMarker) {
        this.propertyMarker.bindPopup(
          this.property.title || 'Property Location'
        );
      }

      // Fit the map around the complete route
      this.propertyMap.fitBounds(
        this.routeLayer.getBounds(),
        { padding: [24, 24] }
      );

      this.routeMessage = 'Driving route calculated successfully.';

    } catch (error) {
      console.error('Route calculation error:', error);

      this.routeMessage =
        'Unable to calculate the route. Please try again.';
    } finally {
      this.isRouteLoading = false;
      this.cdr.detectChanges();
    }
  }

  private initializePropertyMap(): void {
    if (!this.property || !this.hasValidCoordinates()) {
      return;
    }

    const latitude = this.property.latitude!;
    const longitude = this.property.longitude!;
    const title = this.property.title || 'Property Location';

    const mapElement = document.getElementById('property-map');

    if (!mapElement) {
      console.error('Property map container was not found.');
      return;
    }

    if (this.propertyMap) {
      this.propertyMap.remove();
      this.propertyMap = undefined;
    }

    this.propertyMap = L.map(mapElement).setView(
      [latitude, longitude],
      15
    );

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }
    ).addTo(this.propertyMap);

    this.propertyMarker = L.marker([latitude, longitude])
      .addTo(this.propertyMap)
      .bindPopup(title);

    this.propertyMarker.openPopup();

    setTimeout(() => {
      this.propertyMap?.invalidateSize();
    }, 200);
  }

  getOpenStreetMapDirectionsUrl(): string {
    if (!this.property || !this.hasValidCoordinates()) {
      return 'https://www.openstreetmap.org/';
    }

    const destinationLatitude = this.property.latitude!;
    const destinationLongitude = this.property.longitude!;

    if (
      this.routeStartLatitude != null &&
      this.routeStartLongitude != null
    ) {
      return (
        'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=' +
        `${this.routeStartLatitude},${this.routeStartLongitude};` +
        `${destinationLatitude},${destinationLongitude}`
      );
    }

    return (
      'https://www.openstreetmap.org/?mlat=' +
      destinationLatitude +
      '&mlon=' +
      destinationLongitude +
      '#map=16/' +
      destinationLatitude +
      '/' +
      destinationLongitude
    );
  }

  getGoogleMapsDirectionsUrl(): string {
    if (!this.property || !this.hasValidCoordinates()) {
      return 'https://maps.google.com/';
    }

    const destination =
      `${this.property.latitude},${this.property.longitude}`;

    const startLocation = this.routeStartLocation.trim();

    if (
      this.routeStartLatitude != null &&
      this.routeStartLongitude != null
    ) {
      const origin =
        `${this.routeStartLatitude},${this.routeStartLongitude}`;

      return (
        'https://www.google.com/maps/dir/?api=1' +
        `&origin=${encodeURIComponent(origin)}` +
        `&destination=${encodeURIComponent(destination)}` +
        '&travelmode=driving'
      );
    }

    if (startLocation) {
      return (
        'https://www.google.com/maps/dir/?api=1' +
        `&origin=${encodeURIComponent(startLocation)}` +
        `&destination=${encodeURIComponent(destination)}` +
        '&travelmode=driving'
      );
    }

    return (
      'https://www.google.com/maps/dir/?api=1' +
      `&destination=${encodeURIComponent(destination)}` +
      '&travelmode=driving'
    );
  }

  getNearbySearchUrl(category: string): string {
    const location = this.property?.location?.trim() || '';
    const title = this.property?.title?.trim() || '';

    const query = `${category} near ${title} ${location}`.trim();

    return (
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(query)
    );
  }

  getLifestyleFeatures(features: string | null | undefined): string[] {
  if (!features) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(features);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const allowedFeatures = [
      'Swimming Pool',
      'Fitness Centre',
      'Clubhouse',
      "Children's Play Area",
      'Security',
      'Parking',
      'CCTV Surveillance',
      '24/7 Security',
      'Gated Community',
      'Intercom Facility',
      'Video Door Phone',
      'Fire Safety Systems',
      'Lift / Elevator',
      'Power Backup',
      '24/7 Water Supply',
      'Rainwater Harvesting',
      'Waste Management',
      'Covered Parking',
      'Visitor Parking',
      'EV Charging',
      'Bicycle Parking',
      'Landscaped Garden',
      'Jogging Track',
      'Indoor Games',
      'Sports Court',
      'Yoga / Meditation Room',
      'Pet-Friendly Area',
      'Solar Power',
      'Smart Home Automation',
      'Energy-Efficient Lighting',
      'Water Treatment Plant'
    ];

    return parsed.filter(
      (feature: unknown): feature is string =>
        typeof feature === 'string' &&
        allowedFeatures.includes(feature)
    );
  } catch {
    return [];
  }
}

getLifestyleIcon(feature: string): string {
  const icons: Record<string, string> = {
    'Swimming Pool': 'bi bi-water',
    'Fitness Centre': 'bi bi-heart-pulse-fill',
    'Clubhouse': 'bi bi-people-fill',
    "Children's Play Area": 'bi bi-balloon-fill',
    'Security': 'bi bi-shield-check',
    'Parking': 'bi bi-car-front-fill',
    'CCTV Surveillance': 'bi bi-camera-video-fill',
    '24/7 Security': 'bi bi-shield-lock-fill',
    'Gated Community': 'bi bi-house-lock-fill',
    'Intercom Facility': 'bi bi-telephone-fill',
    'Video Door Phone': 'bi bi-camera-fill',
    'Fire Safety Systems': 'bi bi-fire',
    'Lift / Elevator': 'bi bi-building',
    'Power Backup': 'bi bi-lightning-charge-fill',
    '24/7 Water Supply': 'bi bi-droplet-fill',
    'Rainwater Harvesting': 'bi bi-cloud-rain-fill',
    'Waste Management': 'bi bi-recycle',
    'Covered Parking': 'bi bi-p-square-fill',
    'Visitor Parking': 'bi bi-car-front',
    'EV Charging': 'bi bi-ev-station',
    'Bicycle Parking': 'bi bi-bicycle',
    'Landscaped Garden': 'bi bi-flower1',
    'Jogging Track': 'bi bi-person-walking',
    'Indoor Games': 'bi bi-controller',
    'Sports Court': 'bi bi-trophy-fill',
    'Yoga / Meditation Room': 'bi bi-flower2',
    'Pet-Friendly Area': 'bi bi-heart-fill',
    'Solar Power': 'bi bi-sun-fill',
    'Smart Home Automation': 'bi bi-house-gear-fill',
    'Energy-Efficient Lighting': 'bi bi-lightbulb-fill',
    'Water Treatment Plant': 'bi bi-water'
  };

  return icons[feature] || 'bi bi-check-circle';
}

getLifestyleDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    'Swimming Pool': 'Relaxation & recreation',
    'Fitness Centre': 'Health & wellness',
    'Clubhouse': 'Community activities',
    "Children's Play Area": 'Family-friendly recreation',
    'Security': 'Community safety facilities',
    'Parking': 'Resident parking facilities',
    'CCTV Surveillance': 'Video monitoring',
    '24/7 Security': 'Round-the-clock security',
    'Gated Community': 'Controlled community access',
    'Intercom Facility': 'Internal communication',
    'Video Door Phone': 'Visual visitor verification',
    'Fire Safety Systems': 'Fire prevention and response',
    'Lift / Elevator': 'Convenient floor access',
    'Power Backup': 'Backup electricity supply',
    '24/7 Water Supply': 'Continuous water availability',
    'Rainwater Harvesting': 'Rainwater collection system',
    'Waste Management': 'Waste collection and disposal',
    'Covered Parking': 'Sheltered vehicle parking',
    'Visitor Parking': 'Parking for guests',
    'EV Charging': 'Electric vehicle charging',
    'Bicycle Parking': 'Dedicated bicycle parking',
    'Landscaped Garden': 'Green outdoor spaces',
    'Jogging Track': 'Walking and running',
    'Indoor Games': 'Indoor recreation',
    'Sports Court': 'Sports and fitness',
    'Yoga / Meditation Room': 'Mindfulness and relaxation',
    'Pet-Friendly Area': 'Space for pets',
    'Solar Power': 'Solar energy system',
    'Smart Home Automation': 'Connected home controls',
    'Energy-Efficient Lighting': 'Efficient lighting systems',
    'Water Treatment Plant': 'Water treatment facilities'
  };

  return descriptions[feature] || 'Community facility';
}
}
