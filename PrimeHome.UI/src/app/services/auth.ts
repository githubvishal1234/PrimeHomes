import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface MessageResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {

  private apiUrl = `${environment.apiUrl}/Auth`;

  constructor(private http: HttpClient) {}

  register(user: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, user);
  }

  login(user: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, user);
  }

  /** Revokes the refresh token and clears the session cookies on the server. */
  logout(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/logout`, {});
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(email: string, token: string, newPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/reset-password`, { email, token, newPassword });
  }

  verifyEmail(email: string, token: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/verify-email`, { email, token });
  }

  resendVerification(): Observable<MessageResponse & { emailVerified: boolean }> {
    return this.http.post<MessageResponse & { emailVerified: boolean }>(`${this.apiUrl}/resend-verification`, {});
  }
}

/** First human-readable message from an API error (validation, ProblemDetails or { message }). */
export function apiErrorMessage(error: any, fallback: string): string {
  const fieldErrors = Object.values(error?.error?.errors ?? {}).flat().join(' ');
  return error?.error?.message
    || fieldErrors
    || (typeof error?.error === 'string' ? error.error : '')
    || (error?.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : '')
    || fallback;
}
