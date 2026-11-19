import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SavedSearch {
  savedSearchId: number;
  name: string;
  /** The search page's query string, e.g. "city=Hyderabad&bhk=2,3". */
  query: string;
  alertsEnabled: boolean;
  createdDate: string;
  lastAlertDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SavedSearchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/SavedSearches`;

  getMine(): Observable<SavedSearch[]> {
    return this.http.get<SavedSearch[]>(this.apiUrl);
  }

  save(name: string, query: string): Observable<SavedSearch> {
    return this.http.post<SavedSearch>(this.apiUrl, { name, query });
  }

  setAlerts(id: number, enabled: boolean): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${id}/alerts`, { enabled });
  }

  delete(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}

/** Turns a stored query string back into router query params. */
export function queryParamsOf(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}
