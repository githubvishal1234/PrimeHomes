import { environment } from '../../environments/environment';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { session } from '../services/session';

/** One refresh at a time, shared by every request that hit a 401 meanwhile. */
let refreshing: Observable<unknown> | null = null;

/**
 * Sessions live in HttpOnly cookies the browser attaches itself. When the 15-minute access
 * cookie expires, swap the refresh cookie for a new pair once and retry; if that fails too,
 * the session is over: clear it and send the user to sign in, then back here.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);

  const isAuthCall = req.url.includes('/Auth/');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthCall || !session.isLoggedIn()) {
        return throwError(() => error);
      }

      refreshing ??= http.post(`${environment.apiUrl}/Auth/refresh`, {}).pipe(
        finalize(() => (refreshing = null)),
        shareReplay(1)
      );

      return refreshing.pipe(
        switchMap(user => {
          session.start(user as Parameters<typeof session.start>[0]);
          return next(req);
        }),
        catchError(refreshError => {
          session.clear();
          if (!router.url.startsWith('/login')) {
            router.navigate(['/login'], { queryParams: { returnUrl: router.url, expired: 1 } });
          }
          return throwError(() => refreshError);
        })
      );
    })
  );
};
