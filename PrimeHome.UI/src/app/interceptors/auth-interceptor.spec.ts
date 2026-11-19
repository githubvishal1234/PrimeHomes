import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import { session } from '../services/session';

describe('authInterceptor (cookie sessions)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session.start({ userId: 3, role: 'Buyer', name: 'Venkat', emailVerified: true });
  });

  afterEach(() => {
    backend.verify();
    session.clear();
  });

  it('refreshes once on 401 and retries the original request', () => {
    let result: unknown;
    http.get('/api/Notifications').subscribe(r => (result = r));

    backend.expectOne('/api/Notifications').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/Auth/refresh').flush({ userId: 3, role: 'Buyer', name: 'Venkat', emailVerified: true });
    backend.expectOne('/api/Notifications').flush([{ id: 1 }]);

    expect(result).toEqual([{ id: 1 }]);
    expect(session.isLoggedIn()).toBe(true);
  });

  it('ends the session and goes to login when the refresh fails', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let failed = false;
    http.get('/api/Notifications').subscribe({ error: () => (failed = true) });

    backend.expectOne('/api/Notifications').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/Auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(session.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ queryParams: expect.objectContaining({ expired: 1 }) }));
  });

  it('does not try to refresh for guests or for auth calls', () => {
    session.clear();
    http.get('/api/Notifications').subscribe({ error: () => undefined });
    backend.expectOne('/api/Notifications').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone('/api/Auth/refresh');
  });
});
