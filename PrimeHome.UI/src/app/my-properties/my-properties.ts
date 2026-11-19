import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ListingStats, Property } from '../models/property';
import { Property as PropertyService } from '../services/property';
import { ToastService } from '../services/toast';
import { apiErrorMessage } from '../services/auth';
import { Icon } from '../shared/icon/icon';
import { NumberPipe, PricePipe } from '../shared/format';

type Tab = 'all' | 'live' | 'review' | 'action' | 'drafts' | 'closed';

@Component({
  selector: 'app-my-properties',
  imports: [DatePipe, RouterLink, Icon, PricePipe, NumberPipe],
  templateUrl: './my-properties.html',
  styleUrl: './my-properties.css'
})
export class MyProperties implements OnInit {
  private readonly api = inject(PropertyService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly properties = signal<Property[]>([]);
  readonly stats = signal<Map<number, ListingStats>>(new Map());
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busyId = signal<number | null>(null);
  readonly tab = signal<Tab>('all');

  readonly tabs: { id: Tab; label: string; statuses: string[] | null }[] = [
    { id: 'all', label: 'All', statuses: null },
    { id: 'live', label: 'Live', statuses: ['Approved'] },
    { id: 'review', label: 'In review', statuses: ['Pending'] },
    { id: 'action', label: 'Needs action', statuses: ['Rejected', 'Expired'] },
    { id: 'drafts', label: 'Drafts', statuses: ['Draft'] },
    { id: 'closed', label: 'Sold / rented', statuses: ['Sold', 'Rented'] }
  ];

  readonly visible = computed(() => {
    const statuses = this.tabs.find(t => t.id === this.tab())!.statuses;
    return statuses ? this.properties().filter(p => statuses.includes(p.status)) : this.properties();
  });

  count(tab: (typeof this.tabs)[number]): number {
    return tab.statuses ? this.properties().filter(p => tab.statuses!.includes(p.status)).length : this.properties().length;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      properties: this.api.getMyProperties(),
      stats: this.api.getMyStats().pipe(catchError(() => of([] as ListingStats[])))
    }).subscribe({
      next: ({ properties, stats }) => {
        this.properties.set(properties);
        this.stats.set(new Map(stats.map(s => [s.propertyId, s])));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Your properties could not be loaded. Please try again.');
      }
    });
  }

  statusLabel(status: string): string {
    return ({ Approved: 'Live', Pending: 'In review', Rejected: 'Needs changes' } as Record<string, string>)[status] ?? status;
  }

  edit(p: Property): void {
    this.router.navigate(['/add-property'], { queryParams: { id: p.propertyId } });
  }

  submit(p: Property): void {
    const verb = p.status === 'Expired' ? 'renewed and sent for review' : 'sent for review';
    this.run(p, this.api.submitProperty(p.propertyId), `"${p.title}" ${verb}.`);
  }

  close(p: Property): void {
    const outcome = p.listingType === 'Rent' ? 'Rented' : 'Sold';
    if (!confirm(`Mark "${p.title}" as ${outcome.toLowerCase()}? It will be removed from search and can't be edited afterwards.`)) return;
    this.run(p, this.api.closeProperty(p.propertyId, outcome), `Marked ${outcome.toLowerCase()}. Congratulations!`);
  }

  remove(p: Property): void {
    if (!confirm(`Delete "${p.title}" permanently? Its photos, inquiries and visits are deleted too. This cannot be undone.`)) return;
    this.run(p, this.api.deleteProperty(p.propertyId), 'Listing deleted.');
  }

  private run(p: Property, request: ReturnType<PropertyService['submitProperty']> | ReturnType<PropertyService['deleteProperty']>, success: string): void {
    this.busyId.set(p.propertyId);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(success);
        this.load();
      },
      error: err => {
        this.busyId.set(null);
        const fields = err?.error?.errors ? ' Open Edit to complete it.' : '';
        this.toast.error(apiErrorMessage(err, 'That did not work. Please try again.') + fields);
      }
    });
  }
}
