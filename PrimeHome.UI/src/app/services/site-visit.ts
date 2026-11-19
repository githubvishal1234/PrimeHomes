import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type SiteVisitStatus = 'Requested' | 'Rescheduled' | 'Accepted' | 'Completed' | 'Cancelled';

export interface SiteVisit {
  siteVisitId: number;
  propertyId: number;
  propertyTitle: string;
  propertyLocation: string;
  propertyImageUrl?: string | null;
  scheduledAt: string;
  status: SiteVisitStatus;
  note?: string | null;
  counterpartName?: string | null;
  counterpartPhone?: string | null;
  createdDate: string;
}

/** Visiting hours, matching the API rule (hourly, 9:00–18:00 IST). */
export const VISIT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

/** Builds the UTC instant for a calendar date (yyyy-mm-dd) and an hour in India time. */
export function istSlotToUtc(date: string, hour: number): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+05:30`).toISOString();
}

@Injectable({ providedIn: 'root' })
export class SiteVisitService {

  private apiUrl = `${environment.apiUrl}/SiteVisits`;

  constructor(private http: HttpClient) {}

  getMine(): Observable<SiteVisit[]> {
    return this.http.get<SiteVisit[]>(this.apiUrl);
  }

  book(propertyId: number, scheduledAt: string, note?: string): Observable<unknown> {
    return this.http.post(this.apiUrl, { propertyId, scheduledAt, note });
  }

  accept(id: number): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${id}/accept`, {});
  }

  reschedule(id: number, scheduledAt: string): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${id}/reschedule`, { scheduledAt });
  }

  cancel(id: number): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${id}/cancel`, {});
  }

  complete(id: number): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${id}/complete`, {});
  }
}
