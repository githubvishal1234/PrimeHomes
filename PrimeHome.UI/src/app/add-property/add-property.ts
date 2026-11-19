import { NumberPipe, PricePipe } from '../shared/format';
import { apiErrorMessage } from '../services/auth';
import { ToastService } from '../services/toast';

import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import {
  Router,
  ActivatedRoute
} from '@angular/router';

import * as L from 'leaflet';

import { Property as PropertyService } from '../services/property';

@Component({
  selector: 'app-add-property',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule, PricePipe, NumberPipe],
  templateUrl: './add-property.html',
  styleUrl: './add-property.css'
})
export class AddProperty implements OnInit, AfterViewInit, OnDestroy {

  private toast = inject(ToastService);

  // ==========================================
  // Edit Mode
  // ==========================================

  isEditMode = false;
  propertyId = 0;

  // ==========================================
  // Main Property Image
  // ==========================================

  selectedFile: File | null = null;
  imagePreview: string | null = null;

  // ==========================================
  // Multiple Gallery Images
  // ==========================================

  selectedGalleryFiles: File[] = [];
  galleryPreviews: string[] = [];

  // ==========================================
  // Property Object
  // ==========================================

 property = {
  title: '',
  description: '',
  propertyType: '',
  bhk: 0,
  price: 0,
  area: 0,
  location: '',
  city: '',
  latitude: null as number | null,
  longitude: null as number | null,
  imageUrl: '',
  lifestyleFeatures: '[]',
  listingType: 'Sale' as 'Sale' | 'Rent',
  bathrooms: null as number | null,
  furnishing: null as string | null,
  floor: null as number | null,
  totalFloors: null as number | null,
  facing: null as string | null,
  constructionStatus: 'Ready to move' as string | null,
  ageYears: null as number | null,
  parking: null as number | null,
  saveAsDraft: false
};

  // ---------- wizard ----------
  readonly steps = [
    { n: 1, label: 'Basics' },
    { n: 2, label: 'Price & features' },
    { n: 3, label: 'Location & amenities' },
    { n: 4, label: 'Map pin' },
    { n: 5, label: 'Photos' }
  ];
  readonly facings = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
  step = 1;
  maxStep = 1;
  isSaving = false;
  propertyStatus = '';

  /** Required fields per step; returns a message for the first missing one. */
  private stepError(n: number): string | null {
    const p = this.property;
    if (n === 1) {
      if (p.title.trim().length < 5) return 'Add a title of at least 5 characters.';
      if (!p.propertyType) return 'Choose a property type.';
    }
    if (n === 2) {
      if (!(p.price > 0)) return 'Enter the price.';
      if (!(p.area > 0)) return 'Enter the built-up area.';
    }
    if (n === 3) {
      if (!p.location.trim()) return 'Enter the locality.';
      if (!p.city.trim()) return 'Enter the city.';
    }
    return null;
  }

  next(): void {
    const error = this.stepError(this.step);
    if (error) {
      this.toast.error(error);
      return;
    }
    this.goTo(this.step + 1);
  }

  back(): void {
    this.goTo(this.step - 1);
  }

  goTo(n: number): void {
    if (n < 1 || n > this.steps.length) return;
    this.step = n;
    this.maxStep = Math.max(this.maxStep, n);
    if (n === 4) {
      setTimeout(() => this.propertyMap?.invalidateSize(), 50); // map was hidden until now
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** 0–100: how complete the listing is (required basics count for half). */
  qualityScore(): number {
    const p = this.property;
    const checks = [
      p.title.trim().length >= 5, !!p.propertyType, p.price > 0, p.area > 0, !!p.location.trim(), !!p.city.trim(),
      p.description.trim().length >= 60, p.bathrooms != null, !!p.furnishing, p.floor != null, !!p.facing,
      p.parking != null, p.latitude != null, this.selectedLifestyleFeatures.length >= 3,
      !!(this.selectedFile || p.imageUrl), this.selectedGalleryFiles.length >= 3
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  saveDraft(): void {
    this.property.saveAsDraft = true;
    this.uploadSelectedImage();
  }

  submit(): void {
    for (const st of this.steps) {
      const error = this.stepError(st.n);
      if (error) {
        this.goTo(st.n);
        this.toast.error(error);
        return;
      }
    }
    this.property.saveAsDraft = false;
    this.uploadSelectedImage();
  }


  
 availableLifestyleFeatures: string[] = [
  // Existing facilities
  'Swimming Pool',
  'Fitness Centre',
  'Clubhouse',
  "Children's Play Area",
  'Security',
  'Parking',

  // Security and safety
  'CCTV Surveillance',
  '24/7 Security',
  'Gated Community',
  'Intercom Facility',
  'Video Door Phone',
  'Fire Safety Systems',

  // Building facilities
  'Lift / Elevator',
  'Power Backup',
  '24/7 Water Supply',
  'Rainwater Harvesting',
  'Waste Management',

  // Parking and transport
  'Covered Parking',
  'Visitor Parking',
  'EV Charging',
  'Bicycle Parking',

  // Outdoor and recreation
  'Landscaped Garden',
  'Jogging Track',
  'Indoor Games',
  'Sports Court',
  'Yoga / Meditation Room',
  'Pet-Friendly Area',

  // Smart and eco-friendly
  'Solar Power',
  'Smart Home Automation',
  'Energy-Efficient Lighting',
  'Water Treatment Plant'
];

  selectedLifestyleFeatures: string[] = [];

  toggleLifestyleFeature(feature: string, event: Event): void {
  const checkbox = event.target as HTMLInputElement;

  if (checkbox.checked) {
    if (!this.selectedLifestyleFeatures.includes(feature)) {
      this.selectedLifestyleFeatures.push(feature);
    }
  } else {
    this.selectedLifestyleFeatures =
      this.selectedLifestyleFeatures.filter(item => item !== feature);
  }

  this.syncLifestyleFeatures();
}

private syncLifestyleFeatures(): void {
  this.property.lifestyleFeatures = JSON.stringify(
    this.selectedLifestyleFeatures
  );
}


  // ==========================================
  // OpenStreetMap
  // ==========================================

  private propertyMap?: L.Map;
  private propertyMarker?: L.Marker;
  private mapReady = false;

  private readonly defaultLatitude = 17.3850;
  private readonly defaultLongitude = 78.4867;

  // ==========================================
  // Constructor
  // ==========================================

  constructor(
    private propertyService: PropertyService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  // ==========================================
  // Page Load
  // ==========================================

  ngOnInit(): void {

    this.route.queryParams.subscribe(params => {

      if (params['id']) {

        this.isEditMode = true;
        this.propertyId = Number(params['id']);

        console.log(
          'Edit Property ID:',
          this.propertyId
        );

        this.loadProperty();
      }

    });

  }

  // ==========================================
  // Initialize Map After View Loads
  // ==========================================

  ngAfterViewInit(): void {

    // Wait for the map container to be available.
    setTimeout(() => {
      this.initializeOwnerMap();
    },300);

  }

  // ==========================================
  // Load Existing Property
  // ==========================================

  loadProperty(): void {

    this.propertyService
      .getPropertyById(this.propertyId)
      .subscribe({

        next: (data) => {

          console.log(
            'Property loaded:',
            JSON.stringify(data, null, 2)
          );

          this.property.title = data.title;
          this.property.description = data.description;
          this.property.propertyType = data.propertyType;
          this.property.bhk = data.bhk ?? 0;
          this.property.price = data.price;
          this.property.area = data.area;
          this.property.location = data.location;
          this.property.city = data.city;

          this.property.latitude = data.latitude ?? null;
          this.property.longitude = data.longitude ?? null;

          this.property.imageUrl = data.imageUrl || '';
          this.property.listingType = data.listingType === 'Rent' ? 'Rent' : 'Sale';
          this.property.bathrooms = data.bathrooms ?? null;
          this.property.furnishing = data.furnishing ?? null;
          this.property.floor = data.floor ?? null;
          this.property.totalFloors = data.totalFloors ?? null;
          this.property.facing = data.facing ?? null;
          this.property.constructionStatus = data.constructionStatus ?? 'Ready to move';
          this.property.ageYears = data.ageYears ?? null;
          this.property.parking = data.parking ?? null;
          this.propertyStatus = data.status;
          this.maxStep = this.steps.length; // editing: every step is reachable

         // Restore saved lifestyle features when editing.
try {
  const savedFeatures = JSON.parse(
    data.lifestyleFeatures || '[]'
  );

  this.selectedLifestyleFeatures = Array.isArray(savedFeatures)
    ? savedFeatures.filter(
        (feature: unknown): feature is string =>
          typeof feature === 'string' &&
          this.availableLifestyleFeatures.includes(feature)
      )
    : [];
} catch {
  this.selectedLifestyleFeatures = [];
}

this.syncLifestyleFeatures();



          // Show existing main image
          this.imagePreview = this.property.imageUrl || null;

          this.cdr.detectChanges();

          // If the map has loaded, show saved coordinates.
          if (this.mapReady) {
            this.showPropertyLocationOnMap();
          }

          console.log(
            'Form property after assignment:',
            this.property
          );

        },

        error: (error) => {

          console.error(
            'Error loading property:',
            error
          );

          this.toast.error('Unable to load property.');

        }

      });

  }

  // ==========================================
  // Initialize OpenStreetMap
  // ==========================================

  private initializeOwnerMap(): void {

    const mapElement = document.getElementById(
      'owner-property-map'
    );

    if (!mapElement) {
      console.error(
        'Owner property map container not found.'
      );
      return;
    }

    // Prevent duplicate initialization.
    if (this.propertyMap) {
      return;
    }

    const latitude =
      this.isValidLatitude(this.property.latitude)
        ? this.property.latitude!
        : this.defaultLatitude;

    const longitude =
      this.isValidLongitude(this.property.longitude)
        ? this.property.longitude!
        : this.defaultLongitude;

    this.propertyMap = L.map(mapElement).setView(
      [latitude, longitude],
      this.property.latitude != null &&
      this.property.longitude != null ? 15 : 12
    );

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }
    ).addTo(this.propertyMap);

    // Add a marker if saved coordinates are available.
    if (
      this.isValidLatitude(this.property.latitude) &&
      this.isValidLongitude(this.property.longitude)
    ) {
      this.updateMapMarker(
        this.property.latitude!,
        this.property.longitude!
      );
    }

    // When the owner clicks the map, update the coordinates.
    this.propertyMap.on('click', (event: L.LeafletMouseEvent) => {

      const selectedLatitude = event.latlng.lat;
      const selectedLongitude = event.latlng.lng;

      this.property.latitude = Number(
        selectedLatitude.toFixed(6)
      );

      this.property.longitude = Number(
        selectedLongitude.toFixed(6)
      );

      this.updateMapMarker(
        this.property.latitude,
        this.property.longitude
      );

      this.cdr.detectChanges();

      console.log(
        'Selected property coordinates:',
        this.property.latitude,
        this.property.longitude
      );

    });

    this.mapReady = true;

    // Correct map sizing after the container renders.
    setTimeout(() => {
      this.propertyMap?.invalidateSize();
    }, 100);

  }

  // ==========================================
  // Show Selected Location
  // ==========================================

  showPropertyLocationOnMap(): void {

    if (!this.mapReady || !this.propertyMap) {
      this.toast.error('The map is still loading. Please try again.');
      return;
    }

    if (
      !this.isValidLatitude(this.property.latitude) ||
      !this.isValidLongitude(this.property.longitude)
    ) {
      this.toast.error('Please enter a valid latitude and longitude.');
      return;
    }

    const latitude = this.property.latitude!;
    const longitude = this.property.longitude!;

    this.propertyMap.setView(
      [latitude, longitude],
      16
    );

    this.updateMapMarker(latitude, longitude);

  }

  // ==========================================
  // Update Map Marker
  // ==========================================

  private updateMapMarker(
    latitude: number,
    longitude: number
  ): void {

    if (!this.propertyMap) {
      return;
    }

    if (this.propertyMarker) {

      this.propertyMarker.setLatLng([
        latitude,
        longitude
      ]);

    } else {

      this.propertyMarker = L.marker([
        latitude,
        longitude
      ]).addTo(this.propertyMap);

    }

    this.propertyMarker.bindPopup(
      this.property.title || 'Selected Property Location'
    );

  }

  // ==========================================
  // Clear Selected Location
  // ==========================================

  clearPropertyLocation(): void {

    this.property.latitude = null;
    this.property.longitude = null;

    if (this.propertyMarker && this.propertyMap) {

      this.propertyMap.removeLayer(this.propertyMarker);
      this.propertyMarker = undefined;

    }

    this.cdr.detectChanges();

  }

  // ==========================================
  // Coordinate Validation
  // ==========================================

  private isValidLatitude(
    latitude: number | null
  ): boolean {

    return latitude !== null &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90;

  }

  private isValidLongitude(
    longitude: number | null
  ): boolean {

    return longitude !== null &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;

  }

  // ==========================================
  // Select Main Image
  // ==========================================

  onFileSelected(event: Event): void {

    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {

      this.selectedFile = input.files[0];

      console.log(
        'Selected main image:',
        this.selectedFile.name
      );

      const reader = new FileReader();

      reader.onload = () => {

        this.imagePreview = reader.result as string;

        this.cdr.detectChanges();

      };

      reader.readAsDataURL(this.selectedFile);

    }

  }

  // ==========================================
  // Select Multiple Gallery Images
  // ==========================================

  onGalleryFilesSelected(event: Event): void {

    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    // Convert FileList to array.
    const files = Array.from(input.files);

    this.selectedGalleryFiles = files;
    this.galleryPreviews = [];

    // Create a preview for each image.
    files.forEach(file => {

      const reader = new FileReader();

      reader.onload = () => {

        this.galleryPreviews.push(
          reader.result as string
        );

        this.cdr.detectChanges();

      };

      reader.readAsDataURL(file);

    });

    console.log(
      'Selected gallery images:',
      files
    );

  }

  // ==========================================
  // Upload Main Image + Gallery Images
  // ==========================================

  uploadSelectedImage(): void {

    this.isSaving = true;

    // Upload the main image first if selected.
    if (this.selectedFile) {

      this.propertyService
        .uploadImage(this.selectedFile)
        .subscribe({

          next: (response) => {

            console.log(
              'Main image uploaded:',
              response.imageUrl
            );

            this.property.imageUrl = response.imageUrl;

            // Continue with property save.
            this.addOrUpdateProperty();

          },

          error: (error) => {

            console.error(
              'Main image upload failed:',
              error
            );

            this.isSaving = false;
            this.toast.error(apiErrorMessage(error, 'Unable to upload main image.'));

          }

        });

    } else {

      // No new main image selected.
      this.addOrUpdateProperty();

    }

  }

  // ==========================================
  // Add / Update Property
  // ==========================================

  addOrUpdateProperty(): void {

    // Validate optional coordinates when provided.
    const hasLatitude = this.property.latitude !== null;
    const hasLongitude = this.property.longitude !== null;

    if (hasLatitude !== hasLongitude) {
      this.isSaving = false;
      this.toast.error('Please enter both latitude and longitude, or clear both fields.');
      return;
    }

    if (
      hasLatitude &&
      (
        !this.isValidLatitude(this.property.latitude) ||
        !this.isValidLongitude(this.property.longitude)
      )
    ) {
      this.isSaving = false;
      this.toast.error('Please enter valid property coordinates.');
      return;
    }

    console.log(
      'Sending property:',
      this.property
    );

    // ========================================
    // EDIT PROPERTY
    // ========================================

    if (this.isEditMode) {

      this.propertyService
        .updateProperty(
          this.propertyId,
          this.property
        )
        .subscribe({

          next: (response) => {

            console.log(
              'Property updated successfully:',
              response
            );

            // Upload gallery images after update.
            this.uploadGalleryImages();

            this.toast.success(this.propertyStatus === 'Draft' ? 'Draft saved.' : 'Changes saved and sent for review.');

            this.router.navigate(['/my-properties']);

          },

          error: (error) => {

            console.error(
              'Error updating property:',
              error
            );

            this.isSaving = false;
            this.toast.error(apiErrorMessage(error, 'Unable to update property.'));

          }

        });

    }

    // ========================================
    // ADD NEW PROPERTY
    // ========================================

    else {

      this.propertyService
        .addProperty(this.property)
        .subscribe({

          next: (response) => {

            console.log(
              'Property added successfully:',
              response
            );

            

            // Get newly created Property ID.
            const newPropertyId = response.propertyId;

            // Upload gallery images.
            this.uploadGalleryImages(newPropertyId);

            this.toast.success(response.status === 'Draft'
              ? 'Draft saved. Finish it any time from My Properties.'
              : 'Submitted! An admin will review your listing shortly.');

            this.router.navigate(['/my-properties']);

          },

          error: (error) => {

            console.error(
              'Error adding property:',
              error
            );

            this.isSaving = false;
            this.toast.error(apiErrorMessage(error, 'Unable to add property.'));

          }

        });

    }

  }

  // ==========================================
  // Upload Gallery Images
  // ==========================================

  uploadGalleryImages(propertyId?: number): void {

    const id = propertyId || this.propertyId;

    // No gallery images selected.
    if (
      !this.selectedGalleryFiles ||
      this.selectedGalleryFiles.length === 0
    ) {

      console.log('No gallery images selected.');
      return;

    }

    console.log(
      'Uploading gallery images for property:',
      id
    );

    this.propertyService
      .uploadPropertyImages(
        id,
        this.selectedGalleryFiles
      )
      .subscribe({

        next: (response) => {

          console.log(
            'Gallery images uploaded successfully:',
            response
          );

        },

        error: (error) => {

          console.error(
            'Gallery image upload failed:',
            error
          );

          this.toast.error('Property saved, but gallery images could not be uploaded.');

        }

      });

  }

  // ==========================================
  // Clean Up Map
  // ==========================================

  ngOnDestroy(): void {

    if (this.propertyMap) {

      this.propertyMap.remove();
      this.propertyMap = undefined;
      this.propertyMarker = undefined;

    }

    this.mapReady = false;

  }

}
