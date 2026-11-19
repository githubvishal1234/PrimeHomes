
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PropertyReview {
  reviewId: number;
  propertyId: number;
  userId: number;
  rating: number;
  comment: string;
  createdDate: string;
}

export interface PropertyReviewsResponse {
  propertyId: number;
  totalReviews: number;
  averageRating: number;
  reviews: PropertyReview[];
}

@Injectable({
  providedIn: 'root'
})
export class PropertyReviewService {
  private apiUrl = `${environment.apiUrl}/PropertyReviews`;

  constructor(private http: HttpClient) {}

  getPropertyReviews(
    propertyId: number
  ): Observable<PropertyReviewsResponse> {
    return this.http.get<PropertyReviewsResponse>(
      `${this.apiUrl}/property/${propertyId}`
    );
  }

  addReview(review: {
    propertyId: number;
    rating: number;
    comment: string;
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, review);
  }
}
