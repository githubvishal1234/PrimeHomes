import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { compressImage } from '../shared/image-compress';
import {
  PagedResult,
  Property as PropertyModel,
  PropertyImage,
  PropertySearchQuery,
  PropertySummary,
  CityCount,
  ListingStats,
  OwnerAnalytics,
  PriceInsights,
  OwnerSummary
} from '../models/property';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Property {

  private apiUrl = `${environment.apiUrl}/Properties`;

  constructor(private http: HttpClient) {}

  // ==========================================
  // Upload Single Main Property Image
  // ==========================================
  uploadImage(file: File) {

    return from(compressImage(file)).pipe(
      switchMap(small => {
        const formData = new FormData();
        formData.append('file', small);
        return this.http.post<{ imageUrl: string }>(`${environment.apiUrl}/ImageUpload`, formData);
      })
    );
  }


  // ==========================================
  // Upload Multiple Property Gallery Images
  // ==========================================
  uploadPropertyImages(
    propertyId: number,
    files: File[]
  ) {

    return from(Promise.all(files.map(f => compressImage(f)))).pipe(
      switchMap(small => {
        const formData = new FormData();
        small.forEach(file => formData.append('files', file));
        return this.http.post(`${environment.apiUrl}/PropertyImages/upload/${propertyId}`, formData);
      })
    );
  }


  // ==========================================
  // Get All Live Properties
  // ==========================================
  getProperties(): Observable<PropertyModel[]> {

    return this.http.get<PropertyModel[]>(
      this.apiUrl
    );
  }


  // ==========================================
  // Get All Properties For Admin
  // ==========================================
  getAllPropertiesForAdmin(): Observable<PropertyModel[]> {

    return this.http.get<PropertyModel[]>(
      `${this.apiUrl}/all`
    );
  }


  // ==========================================
  // Get Property By ID
  // ==========================================
  getPropertyById(
    id: number
  ): Observable<PropertyModel> {

    return this.http.get<PropertyModel>(
      `${this.apiUrl}/${id}`
    );
  }


  // ==========================================
  // Get My Properties
  // ==========================================
  getMyProperties(): Observable<PropertyModel[]> {

    return this.http.get<PropertyModel[]>(
      `${this.apiUrl}/my-properties`
    );
  }


  // ==========================================
  // Add Property
  // ==========================================
  addProperty(
    property: any
  ): Observable<PropertyModel> {

    return this.http.post<PropertyModel>(
      this.apiUrl,
      property
    );
  }


  // ==========================================
  // Update Property
  // ==========================================
  updateProperty(
    id: number,
    property: any
  ): Observable<PropertyModel> {

    return this.http.put<PropertyModel>(
      `${this.apiUrl}/${id}`,
      property
    );
  }


  // ==========================================
  // Delete Property
  // ==========================================
  deleteProperty(
    id: number
  ): Observable<any> {

    return this.http.delete(
      `${this.apiUrl}/${id}`
    );
  }


  // ==========================================
  // Approve Property
  // ==========================================
  approveProperty(
    id: number
  ): Observable<any> {

    return this.http.put(
      `${this.apiUrl}/${id}/approve`,
      {}
    );
  }


  // ==========================================
  // Reject Property (reason is shown to the owner)
  // ==========================================
  rejectProperty(
    id: number,
    reason: string
  ): Observable<any> {

    return this.http.put(
      `${this.apiUrl}/${id}/reject`,
      { reason }
    );
  }


  // ==========================================
  // Lifecycle (owner / admin)
  // ==========================================

  /** Draft, Rejected or Expired: send for review (becomes Pending). */
  submitProperty(id: number): Observable<PropertyModel> {
    return this.http.post<PropertyModel>(`${this.apiUrl}/${id}/submit`, {});
  }

  /** Live listing: mark Sold (sale) or Rented (rent). */
  closeProperty(id: number, status: 'Sold' | 'Rented'): Observable<PropertyModel> {
    return this.http.put<PropertyModel>(`${this.apiUrl}/${id}/close`, { status });
  }

  setVerified(id: number, isVerified: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/verify`, { isVerified });
  }


  // ==========================================
  // Search (server-side filters, sort, paging)
  // ==========================================

  search(query: PropertySearchQuery): Observable<PagedResult<PropertySummary>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PagedResult<PropertySummary>>(`${this.apiUrl}/search`, { params });
  }

  getMyAnalytics(days = 30): Observable<OwnerAnalytics> {
    return this.http.get<OwnerAnalytics>(`${this.apiUrl}/my-analytics`, { params: { days } });
  }

  getOwnerSummary(id: number): Observable<OwnerSummary> {
    return this.http.get<OwnerSummary>(`${this.apiUrl}/${id}/owner`);
  }

  getInsights(id: number): Observable<PriceInsights> {
    return this.http.get<PriceInsights>(`${this.apiUrl}/${id}/insights`);
  }

  getMyStats(): Observable<ListingStats[]> {
    return this.http.get<ListingStats[]>(`${this.apiUrl}/my-stats`);
  }

  getCities(): Observable<CityCount[]> {
    return this.http.get<CityCount[]>(`${this.apiUrl}/cities`);
  }

  getSimilar(id: number, take = 6): Observable<PropertySummary[]> {
    return this.http.get<PropertySummary[]>(`${this.apiUrl}/${id}/similar`, { params: { take } });
  }


  // ==========================================
  // Get All Gallery Images For A Property
  // ==========================================
  getPropertyImages(
    propertyId: number
  ): Observable<PropertyImage[]> {

    return this.http.get<PropertyImage[]>(
      `${environment.apiUrl}/PropertyImages/${propertyId}`
    );
  }


  // ==========================================
  // Delete Property Gallery Image
  // ==========================================
  deletePropertyImage(
    imageId: number
  ): Observable<any> {

    return this.http.delete(
      `${environment.apiUrl}/PropertyImages/${imageId}`
    );
  }

}
