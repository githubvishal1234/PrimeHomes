import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Inquiry } from '../models/inquiry';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InquiryService {

  private apiUrl = `${environment.apiUrl}/Inquiries`;

  constructor(private http: HttpClient) {}

  addInquiry(inquiry: Inquiry): Observable<Inquiry> {
    return this.http.post<Inquiry>(this.apiUrl, inquiry);
  }

  getMyInquiries(): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(
      `${this.apiUrl}/my-inquiries`
    );
  }

  getOwnerInquiries(): Observable<Inquiry[]> {
  return this.http.get<Inquiry[]>(
    this.apiUrl
  );
}

  reply(inquiryId: number, message: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${inquiryId}/reply`, { message });
  }

  updateInquiryStatus(
    inquiryId: number,
    status: string
  ): Observable<Inquiry> {

    return this.http.put<Inquiry>(
      `${this.apiUrl}/${inquiryId}`,
      {
        status: status
      }
    );
  }

}
