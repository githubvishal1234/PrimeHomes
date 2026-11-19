import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SiteVisit, SiteVisitService, VISIT_HOURS, istSlotToUtc } from '../services/site-visit';
import { ToastService } from '../services/toast';
import { apiErrorMessage } from '../services/auth';
import { session } from '../services/session';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-site-visits',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <section class="ph-page">
      <header class="ph-banner ph-page-head" style="--ph-banner-img: url('/images/tile-sell.webp')">
        <p class="ph-eyebrow">{{ isOwner ? 'Owner space' : 'Buyer space' }}</p>
        <h1>{{ isOwner ? 'Visit requests' : 'My site visits' }}</h1>
        <p class="ph-lead">
          {{ isOwner
            ? 'Confirm buyer visits, suggest another time, and mark visits completed.'
            : 'Track the homes you plan to see. Phone numbers are shared once a visit is confirmed.' }}
        </p>
      </header>

      @if (loading()) {
        <div class="ph-panel ph-empty" role="status">Loading visits…</div>
      } @else if (visits().length === 0) {
        <div class="ph-panel ph-empty">
          <h2>No visits yet</h2>
          <p>{{ isOwner ? 'Requests from buyers will appear here.' : 'Open a property and choose "Schedule a visit".' }}</p>
          @if (!isOwner) { <a routerLink="/properties" class="btn ph-btn-primary">Browse properties</a> }
        </div>
      } @else {
        @for (group of groups(); track group.title) {
          @if (group.items.length) {
            <h2 class="ph-section-title">{{ group.title }}</h2>
            <div class="ph-visit-list">
              @for (v of group.items; track v.siteVisitId) {
                <article class="ph-panel ph-visit">
                  <img class="ph-visit-img" [src]="v.propertyImageUrl || '/images/house.jpg'" [alt]="v.propertyTitle" loading="lazy">
                  <div class="ph-visit-body">
                    <div class="ph-visit-top">
                      <a [routerLink]="['/properties', v.propertyId]" class="ph-visit-title">{{ v.propertyTitle }}</a>
                      <span class="ph-status" [attr.data-status]="v.status">{{ label(v.status) }}</span>
                    </div>
                    <p class="ph-visit-meta">{{ v.propertyLocation }}</p>
                    <p class="ph-visit-when"><strong>{{ v.scheduledAt | date:'EEE d MMM y, h:mm a' }}</strong></p>
                    <p class="ph-visit-meta">
                      {{ isOwner ? 'Buyer' : 'Owner' }}: {{ v.counterpartName || '—' }}
                      @if (v.counterpartPhone) { · <a [href]="'tel:' + v.counterpartPhone">{{ v.counterpartPhone }}</a> }
                    </p>
                    @if (v.note) { <p class="ph-visit-note">"{{ v.note }}"</p> }

                    @if (rescheduling() === v.siteVisitId) {
                      <form class="ph-inline-form" (ngSubmit)="reschedule(v)">
                        <label class="visually-hidden" [for]="'rd-' + v.siteVisitId">New date</label>
                        <input [id]="'rd-' + v.siteVisitId" type="date" class="form-control" name="date" [(ngModel)]="newDate" [min]="minDate" required>
                        <label class="visually-hidden" [for]="'rh-' + v.siteVisitId">New time</label>
                        <select [id]="'rh-' + v.siteVisitId" class="form-select" name="hour" [(ngModel)]="newHour">
                          @for (h of hours; track h) { <option [ngValue]="h">{{ hourLabel(h) }}</option> }
                        </select>
                        <button type="submit" class="btn btn-sm ph-btn-primary" [disabled]="!newDate || busy()">Send</button>
                        <button type="button" class="btn btn-sm ph-btn-outline" (click)="rescheduling.set(null)">Back</button>
                      </form>
                    } @else {
                      <div class="ph-actions">
                        @if (canAccept(v)) {
                          <button type="button" class="btn btn-sm ph-btn-primary" [disabled]="busy()" (click)="act(v, 'accept')">
                            {{ isOwner ? 'Confirm visit' : 'Accept new time' }}
                          </button>
                        }
                        @if (isOwner && (v.status === 'Requested' || v.status === 'Accepted' || v.status === 'Rescheduled')) {
                          <button type="button" class="btn btn-sm ph-btn-outline" (click)="startReschedule(v)">Suggest another time</button>
                        }
                        @if (isOwner && v.status === 'Accepted' && isPast(v)) {
                          <button type="button" class="btn btn-sm ph-btn-primary" [disabled]="busy()" (click)="act(v, 'complete')">Mark completed</button>
                        }
                        @if (v.status === 'Requested' || v.status === 'Rescheduled' || v.status === 'Accepted') {
                          <button type="button" class="btn btn-sm ph-btn-danger-ghost" [disabled]="busy()" (click)="act(v, 'cancel')">Cancel visit</button>
                        }
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
          }
        }
      }
    </section>
  `
})
export class SiteVisits implements OnInit {
  private readonly api = inject(SiteVisitService);
  private readonly toast = inject(ToastService);

  readonly isOwner = session.role() === 'Owner';
  readonly hours = VISIT_HOURS;
  readonly minDate = new Date().toISOString().slice(0, 10);

  readonly visits = signal<SiteVisit[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly rescheduling = signal<number | null>(null);
  newDate = '';
  newHour = 11;

  readonly groups = computed(() => {
    const active = this.visits().filter(v => ['Requested', 'Rescheduled', 'Accepted'].includes(v.status));
    const closed = this.visits().filter(v => !active.includes(v));
    return [
      { title: 'Upcoming & pending', items: active },
      { title: 'Past & cancelled', items: closed }
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getMine().subscribe({
      next: list => { this.visits.set(list); this.loading.set(false); },
      error: err => { this.loading.set(false); this.toast.error(apiErrorMessage(err, 'Unable to load visits.')); }
    });
  }

  label(status: string): string {
    return {
      Requested: this.isOwner ? 'Awaiting your reply' : 'Awaiting owner',
      Rescheduled: this.isOwner ? 'New time sent' : 'New time proposed',
      Accepted: 'Confirmed',
      Completed: 'Completed',
      Cancelled: 'Cancelled'
    }[status] ?? status;
  }

  canAccept(v: SiteVisit): boolean {
    return this.isOwner ? v.status === 'Requested' : v.status === 'Rescheduled';
  }

  isPast(v: SiteVisit): boolean {
    return new Date(v.scheduledAt).getTime() < Date.now();
  }

  hourLabel(h: number): string {
    return `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
  }

  startReschedule(v: SiteVisit): void {
    this.newDate = '';
    this.newHour = 11;
    this.rescheduling.set(v.siteVisitId);
  }

  reschedule(v: SiteVisit): void {
    this.run(this.api.reschedule(v.siteVisitId, istSlotToUtc(this.newDate, this.newHour)), 'New time sent to the buyer.');
  }

  act(v: SiteVisit, action: 'accept' | 'cancel' | 'complete'): void {
    if (action === 'cancel' && !confirm('Cancel this visit? The other person will be notified.')) {
      return;
    }
    const messages = { accept: 'Visit confirmed.', cancel: 'Visit cancelled.', complete: 'Visit marked completed.' };
    this.run(this.api[action](v.siteVisitId), messages[action]);
  }

  private run(request: Observable<unknown>, successMessage: string): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.rescheduling.set(null);
        this.toast.success(successMessage);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.toast.error(apiErrorMessage(err, 'That did not work. Please try again.'));
      }
    });
  }
}
