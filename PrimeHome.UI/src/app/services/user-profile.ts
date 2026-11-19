import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { compressImage } from '../shared/image-compress';

export interface UserProfile {
  userProfileId?: number;
  userId?: number;

  profileImageUrl?: string;

  city?: string;
  state?: string;

  bio?: string;

  companyName?: string;

  preferredCity?: string;
  preferredPropertyType?: string;
  preferredBHK?: number;

  minBudget?: number;
  maxBudget?: number;

  updatedDate?: string;
}

export interface MyProfileResponse {
  userId: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  profile?: UserProfile | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {

  private apiUrl = `${environment.apiUrl}/UserProfiles`;

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<MyProfileResponse> {
    return this.http.get<MyProfileResponse>(
      `${this.apiUrl}/me`
    );
  }

  createProfile(profile: UserProfile): Observable<UserProfile> {
    return this.http.post<UserProfile>(
      this.apiUrl,
      profile
    );
  }

  updateProfile(profile: UserProfile): Observable<UserProfile> {
    return this.http.put<UserProfile>(
      this.apiUrl,
      profile
    );
  }

  uploadProfileImage(file: File): Observable<any> {
    // Profile photos are shown small, so 800px is plenty.
    return from(compressImage(file, 800)).pipe(
      switchMap(small => {
        const formData = new FormData();
        formData.append('file', small);
        return this.http.post(`${this.apiUrl}/upload-image`, formData);
      })
    );
  }

}