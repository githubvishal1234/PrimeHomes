import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PropertyBadgeService {

  private apiUrl = `${environment.apiUrl}/Properties`;

  constructor(private http: HttpClient) {}

  updateBadge(
  propertyId: number,
  badge: string | null
): Observable<any> {

  return this.http.put(
    `${this.apiUrl}/${propertyId}/badge`,
    {
      badge: badge
    }
  );
}
}
