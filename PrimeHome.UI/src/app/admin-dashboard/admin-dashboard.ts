import { Icon } from '../shared/icon/icon';
import { apiErrorMessage } from '../services/auth';
import { ToastService } from '../services/toast';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Component, OnInit, ChangeDetectorRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Property } from '../models/property';
import { Property as PropertyService } from '../services/property';
import { PropertyBadgeService } from '../services/property-badge';

import {
  ContactRequestService,
  ContactRequestAdmin
} from '../services/contact-request.service';


@Component({
  selector: 'app-admin-dashboard',
  imports: [Icon, CommonModule,FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {

  private toast = inject(ToastService);

  // ==========================================
  // PROPERTIES
  // ==========================================

  properties: Property[] = [];


  // ==========================================
  // CALLBACK REQUESTS
  // ==========================================

  contactRequests: ContactRequestAdmin[] = [];


  // ==========================================
  // CALLBACK SEARCH & FILTERS
  // ==========================================

  filteredContactRequests: ContactRequestAdmin[] = [];

  callbackSearchText: string = '';

  callbackStatusFilter: string = '';

  callbackInterestFilter: string = '';

  callbackDateFilter: string = '';


  // ==========================================
  // CONSTRUCTOR
  // ==========================================

  constructor(
    private propertyService: PropertyService,
    private propertyBadgeService: PropertyBadgeService,
    private contactRequestService: ContactRequestService,
    private cdr: ChangeDetectorRef
  ) {
  }


  // ==========================================
  // INITIALIZE
  // ==========================================

  ngOnInit(): void {

    this.loadProperties();

    this.loadContactRequests();

  }


  // ==========================================
  // CALLBACK REQUEST COUNTS
  // ==========================================

  get totalContactRequests(): number {

    return this.contactRequests.length;

  }


  get newContactRequests(): number {

    return this.contactRequests.filter(
      request => request.status === 'New'
    ).length;

  }


  get contactedContactRequests(): number {

    return this.contactRequests.filter(
      request => request.status === 'Contacted'
    ).length;

  }


  get closedContactRequests(): number {

    return this.contactRequests.filter(
      request => request.status === 'Closed'
    ).length;

  }


  // ==========================================
  // LOAD ALL PROPERTIES
  // ==========================================

  // Platform stats and duplicate flags (signals: they arrive asynchronously)
  readonly stats = signal<AdminStats | null>(null);
  readonly duplicateFlags = signal<Map<number, DuplicateMatch[]>>(new Map());
  private readonly http = inject(HttpClient);

  count(rows: { role?: string; status?: string; count: number }[], key: string): number {
    return rows.find(r => r.role === key || r.status === key)?.count ?? 0;
  }

  private loadAdminInsights(): void {
    this.http.get<AdminStats>(`${environment.apiUrl}/Admin/stats`).subscribe({ next: s => this.stats.set(s), error: () => this.stats.set(null) });
    this.http.get<{ propertyId: number; matches: DuplicateMatch[] }[]>(`${environment.apiUrl}/Admin/duplicate-flags`).subscribe({
      next: flags => this.duplicateFlags.set(new Map(flags.map(f => [f.propertyId, f.matches]))),
      error: () => this.duplicateFlags.set(new Map())
    });
  }

  loadProperties(): void {

    this.loadAdminInsights();

    this.propertyService
      .getAllPropertiesForAdmin()
      .subscribe({

        next: (data) => {

          this.properties = data;

          console.log(
            'All Properties:',
            data
          );

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Error loading properties:',
            error
          );

        }

      });

  }


  // ==========================================
  // APPROVE PROPERTY
  // ==========================================

  approveProperty(
    property: Property
  ): void {

    this.propertyService
      .approveProperty(
        property.propertyId
      )
      .subscribe({

        next: () => {

          this.toast.success('Property approved successfully.');

          this.loadProperties();

        },

        error: (error) => {

          console.error(
            'Error approving property:',
            error
          );

          this.toast.error(apiErrorMessage(error, 'Unable to approve property.'));

        }

      });

  }


  // ==========================================
  // REJECT PROPERTY
  // ==========================================

  // Reject dialog state: the owner sees the reason, so it is required.
  rejecting: Property | null = null;
  rejectReason = '';
  isRejecting = false;
  readonly quickReasons = [
    'Please add clear photos of every room, including kitchen and bathrooms.',
    'The price or area looks incorrect. Please check and update.',
    'The address or map pin does not match the locality.',
    'The description is too short. Add details buyers ask about.'
  ];

  rejectProperty(property: Property): void {
    this.rejecting = property;
    this.rejectReason = '';
  }

  cancelReject(): void {
    this.rejecting = null;
  }

  confirmReject(): void {
    const property = this.rejecting;
    const reason = this.rejectReason.trim();
    if (!property || reason.length < 5) {
      this.toast.error('Give the owner a reason (at least 5 characters).');
      return;
    }

    this.isRejecting = true;
    this.propertyService.rejectProperty(property.propertyId, reason).subscribe({
      next: () => {
        this.isRejecting = false;
        this.rejecting = null;
        this.toast.success(`"${property.title}" sent back to the owner with your reason.`);
        this.loadProperties();
      },
      error: (error) => {
        this.isRejecting = false;
        this.toast.error(apiErrorMessage(error, 'Unable to reject property.'));
        this.cdr.detectChanges();
      }
    });
  }

  toggleVerified(property: Property): void {
    const next = !property.isVerified;
    this.propertyService.setVerified(property.propertyId, next).subscribe({
      next: () => {
        property.isVerified = next;
        this.toast.success(next ? 'Marked as verified.' : 'Verification removed.');
        this.cdr.detectChanges();
      },
      error: (error) => this.toast.error(apiErrorMessage(error, 'Unable to update verification.'))
    });
  }


  // ==========================================
  // UPDATE PROPERTY BADGE
  // ==========================================

  updateBadge(
    property: Property,
    badge: string | null
  ): void {

    this.propertyBadgeService
      .updateBadge(
        property.propertyId,
        badge
      )
      .subscribe({

        next: (response) => {

          console.log(
            'Badge updated:',
            response
          );

          property.badge =
            response.badge;

          this.toast.success(response.badge
              ? `Property badge updated to ${response.badge}.`
              : 'Property badge removed.');

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Error updating property badge:',
            error
          );

          this.toast.error(error.error?.message ||
            'Unable to update property badge.');

        }

      });

  }


  // ==========================================
  // LOAD CALLBACK REQUESTS
  // ==========================================

  loadContactRequests(): void {

    this.contactRequestService
      .getContactRequests()
      .subscribe({

        next: (data) => {

          this.contactRequests = data;

          this.filteredContactRequests = [...data];

          console.log(
            'Contact Requests:',
            data
          );

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Error loading contact requests:',
            error
          );

        }

      });

  }


  // ==========================================
  // FILTER CALLBACK REQUESTS
  // ==========================================

  filterContactRequests(): void {

    const searchText =
      this.callbackSearchText
        .trim()
        .toLowerCase();


    this.filteredContactRequests =
      this.contactRequests.filter(request => {


        // ------------------------------
        // SEARCH
        // ------------------------------

        const matchesSearch =
          !searchText ||
          request.fullName
            ?.toLowerCase()
            .includes(searchText) ||
          request.email
            ?.toLowerCase()
            .includes(searchText) ||
          request.phoneNumber
            ?.toLowerCase()
            .includes(searchText);


        // ------------------------------
        // STATUS FILTER
        // ------------------------------

        const matchesStatus =
          !this.callbackStatusFilter ||
          request.status === this.callbackStatusFilter;


        // ------------------------------
        // INTEREST FILTER
        // ------------------------------

        const matchesInterest =
          !this.callbackInterestFilter ||
          request.interestedIn === this.callbackInterestFilter;


        // ------------------------------
        // DATE FILTER
        // ------------------------------

        let matchesDate = true;


        if (this.callbackDateFilter) {

          const requestDate =
            new Date(request.createdDate)
              .toISOString()
              .split('T')[0];

          matchesDate =
            requestDate === this.callbackDateFilter;

        }


        // ------------------------------
        // FINAL RESULT
        // ------------------------------

        return (
          matchesSearch &&
          matchesStatus &&
          matchesInterest &&
          matchesDate
        );

      });


    this.cdr.detectChanges();

  }


  // ==========================================
  // CLEAR CALLBACK FILTERS
  // ==========================================

  clearContactRequestFilters(): void {

    this.callbackSearchText = '';

    this.callbackStatusFilter = '';

    this.callbackInterestFilter = '';

    this.callbackDateFilter = '';


    this.filteredContactRequests =
      [...this.contactRequests];


    this.cdr.detectChanges();

  }


  // ==========================================
  // UPDATE CALLBACK REQUEST STATUS
  // ==========================================

  updateContactRequestStatus(
    request: ContactRequestAdmin,
    status: string
  ): void {

    this.contactRequestService
      .updateStatus(
        request.contactRequestId,
        status
      )
      .subscribe({

        next: (response) => {

          console.log(
            'Contact request status updated:',
            response
          );

          request.status = status;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Error updating contact request status:',
            error
          );

          this.toast.error(error.error?.message ||
            'Unable to update callback request status.');

        }

      });

  }

}

interface DuplicateMatch {
  propertyId: number;
  title: string;
  reason: string;
}

interface AdminStats {
  users: { role: string; count: number }[];
  newUsers30d: number;
  listings: { status: string; count: number }[];
  approved30d: number;
  inquiries30d: number;
  visits30d: number;
  savedSearches: number;
  openContactRequests: number;
  topCities: { city: string; count: number }[];
}
