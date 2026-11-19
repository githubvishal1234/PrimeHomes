import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PropertySummary, slugFor } from '../../models/property';
import { ShortlistService } from '../../services/shortlist';
import { CompareService } from '../../services/compare.service';
import { ToastService } from '../../services/toast';
import { Icon } from '../icon/icon';
import { NumberPipe, PricePipe, parseAmenities } from '../format';

/** Listing card. 'grid': photo on top (home rails, similar). 'row': the search-results layout. */
@Component({
  selector: 'ph-property-card',
  imports: [RouterLink, Icon, PricePipe, NumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = property();
    @if (layout() === 'row') {
      <!-- Search-results card, laid out like the big portals: photo | headline, 3 key numbers, chips, owner + actions -->
      <article class="srp">
        <a class="srp-media" [routerLink]="link()" [attr.aria-label]="p.title">
          <img [src]="p.imageUrl || '/images/house.jpg'" alt="" loading="lazy" decoding="async">
          @if (p.isVerified) { <span class="srp-verified"><ph-icon name="verified" [size]="13" /> Verified</span> }
          @if (photoCount() > 0) { <span class="srp-photos"><ph-icon name="camera" [size]="13" /> {{ photoCount() }}</span> }
        </a>

        <div class="srp-body">
          <div class="srp-top">
            <div class="srp-titles">
              <h3><a [routerLink]="link()">{{ headline() }}</a></h3>
              <p class="srp-sub">{{ p.title }}</p>
              <p class="srp-loc"><ph-icon name="pin" [size]="13" /> {{ p.location }}, {{ p.city }}</p>
            </div>
            @if (p.badge) { <span class="srp-badge">{{ p.badge }}</span> }
          </div>

          <dl class="srp-stats">
            <div>
              <dd class="srp-price">{{ p.price | price: p.listingType }}</dd>
              <dt>{{ p.listingType === 'Sale' && p.pricePerSqft ? '₹' + (p.pricePerSqft | num) + ' /sq ft' : 'Monthly rent' }}</dt>
            </div>
            <div>
              <dd>{{ p.area | num }} sq ft</dd>
              <dt>Built-up area</dt>
            </div>
            <div>
              <dd>{{ p.bhk ? p.bhk + ' BHK' : p.propertyType }}{{ p.bathrooms ? ' · ' + p.bathrooms + ' Bath' : '' }}</dd>
              <dt>{{ statusLine() }}</dt>
            </div>
          </dl>

          @if (chips().length) {
            <ul class="srp-chips">
              @for (c of chips(); track c) { <li>{{ c }}</li> }
              @if (moreChips() > 0) { <li class="srp-more">+{{ moreChips() }}</li> }
            </ul>
          }

          @if (p.snippet) { <p class="srp-snippet">{{ p.snippet }}</p> }

          <div class="srp-foot">
            <span class="srp-owner"><span class="srp-owner-dot"><ph-icon name="user" [size]="14" /></span> Owner · {{ posted() }}</span>
            <div class="srp-actions">
              <button type="button" class="pc-icon-btn" [class.on]="compared()" (click)="toggleCompare()"
                      [attr.aria-pressed]="compared()" [attr.aria-label]="(compared() ? 'Remove from' : 'Add to') + ' compare: ' + p.title">
                <ph-icon name="compare" />
              </button>
              <button type="button" class="pc-icon-btn pc-heart" [class.on]="shortlisted()" (click)="shortlist.toggle(p.propertyId)"
                      [attr.aria-pressed]="shortlisted()" [attr.aria-label]="(shortlisted() ? 'Remove from' : 'Add to') + ' shortlist: ' + p.title">
                <ph-icon name="heart" [filled]="shortlisted()" />
              </button>
              <a class="btn btn-sm srp-btn-outline" [routerLink]="link()">View details</a>
              <a class="btn btn-sm srp-btn" [routerLink]="link()" fragment="contact">Contact owner</a>
            </div>
          </div>
        </div>
      </article>
    } @else {
    <article class="pc">
      <a class="pc-media" [routerLink]="link()" [attr.aria-label]="p.title">
        <img [src]="p.imageUrl || '/images/house.jpg'" [alt]="''" loading="lazy" decoding="async">
        <span class="pc-tag">{{ p.listingType === 'Rent' ? 'For rent' : 'For sale' }}</span>
        @if (p.imageCount + (p.imageUrl ? 1 : 0) > 1) {
          <span class="pc-photos"><ph-icon name="camera" [size]="14" /> {{ p.imageCount + (p.imageUrl ? 1 : 0) }}</span>
        }
      </a>

      <div class="pc-body">
        <div class="pc-badges">
          @if (p.isVerified) { <span class="pc-verified"><ph-icon name="verified" [size]="14" /> Verified</span> }
          @if (p.badge) { <span class="pc-badge">{{ p.badge }}</span> }
        </div>

        <div class="pc-price-row">
          <p class="pc-price">{{ p.price | price: p.listingType }}</p>
          @if (p.listingType === 'Sale' && p.pricePerSqft) {
            <p class="pc-psf">₹{{ p.pricePerSqft | num }}/sq ft</p>
          }
        </div>

        <h3 class="pc-title"><a [routerLink]="link()">{{ p.title }}</a></h3>
        <p class="pc-loc"><ph-icon name="pin" [size]="14" /> {{ p.location }}, {{ p.city }}</p>

        <ul class="pc-facts">
          @if (p.bhk > 0) { <li><ph-icon name="bed" [size]="15" /> {{ p.bhk }} BHK</li> }
          @if (p.bathrooms) { <li><ph-icon name="bath" [size]="15" /> {{ p.bathrooms }} Bath</li> }
          <li><ph-icon name="area" [size]="15" /> {{ p.area | num }} sq ft</li>
          @if (p.furnishing) { <li><ph-icon name="sofa" [size]="15" /> {{ p.furnishing }}</li> }
        </ul>

        <div class="pc-foot">
          <span class="pc-status">{{ p.constructionStatus || p.propertyType }}</span>
          <div class="pc-actions">
            <button type="button" class="pc-icon-btn" [class.on]="compared()" (click)="toggleCompare()"
                    [attr.aria-pressed]="compared()" [attr.aria-label]="(compared() ? 'Remove from' : 'Add to') + ' compare: ' + p.title">
              <ph-icon name="compare" />
            </button>
            <button type="button" class="pc-icon-btn pc-heart" [class.on]="shortlisted()" (click)="shortlist.toggle(p.propertyId)"
                    [attr.aria-pressed]="shortlisted()" [attr.aria-label]="(shortlisted() ? 'Remove from' : 'Add to') + ' shortlist: ' + p.title">
              <ph-icon name="heart" [filled]="shortlisted()" />
            </button>
            <a class="btn btn-sm ph-btn-primary" [routerLink]="link()">View details</a>
          </div>
        </div>
      </div>
    </article>
    }
  `,
  styleUrl: './property-card.css'
})
export class PropertyCard {
  readonly property = input.required<PropertySummary>();
  readonly layout = input<'grid' | 'row'>('grid');

  protected readonly shortlist = inject(ShortlistService);
  private readonly compare = inject(CompareService);
  private readonly toast = inject(ToastService);

  protected readonly link = computed(() => ['/properties', this.property().propertyId, slugFor(this.property().title, this.property().city)]);
  protected readonly photoCount = computed(() => this.property().imageCount + (this.property().imageUrl ? 1 : 0));

  /** "3 BHK Flat", "Independent House", "Plot" … */
  protected readonly headline = computed(() => {
    const p = this.property();
    const kind = ({ Apartment: 'Flat', House: 'Independent House', Villa: 'Villa', Plot: 'Plot', Commercial: 'Commercial Space' } as Record<string, string>)[p.propertyType] ?? p.propertyType;
    return `${p.bhk ? p.bhk + ' BHK ' : ''}${kind}`;
  });

  /** "Ready to move · 9th of 18 floors" */
  protected readonly statusLine = computed(() => {
    const p = this.property();
    const floor = p.floor != null
      ? (p.floor === 0 ? 'Ground floor' : `${ordinal(p.floor)}${p.totalFloors ? ` of ${p.totalFloors}` : ''} floor`)
      : null;
    return [p.constructionStatus, floor].filter(Boolean).join(' · ') || p.propertyType;
  });

  private readonly allChips = computed(() => {
    const p = this.property();
    return [p.furnishing, ...parseAmenities(p.lifestyleFeatures)].filter((x): x is string => !!x);
  });
  protected readonly chips = computed(() => this.allChips().slice(0, 3));
  protected readonly moreChips = computed(() => Math.max(0, this.allChips().length - 3));

  /** "Posted today", "Posted 3 days ago", "Posted 12 Nov" */
  protected readonly posted = computed(() => {
    const p = this.property();
    const when = new Date(p.approvedDate || p.createdDate);
    const days = Math.floor((Date.now() - when.getTime()) / 86_400_000);
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    if (days < 30) return `Posted ${days} days ago`;
    return 'Posted ' + when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });

  protected readonly shortlisted = computed(() => this.shortlist.ids().has(this.property().propertyId));
  // Compare state lives in a plain service; re-read on each check (cheap: ≤3 items).
  protected compared(): boolean {
    return this.compare.isInCompare(this.property().propertyId);
  }

  protected toggleCompare(): void {
    const p = this.property();
    if (this.compare.isInCompare(p.propertyId)) {
      this.compare.removeFromCompare(p.propertyId);
      this.toast.info('Removed from compare.');
      return;
    }
    // The compare page reads the same core fields a summary carries.
    const added = this.compare.addToCompare({ ...p, description: '', ownerId: 0, status: 'Approved' } as any);
    added
      ? this.toast.success('Added to compare. Open Compare from your buyer space.')
      : this.toast.error('You can compare up to 3 properties.');
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
