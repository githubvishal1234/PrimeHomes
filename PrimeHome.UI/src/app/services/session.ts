import { Router } from '@angular/router';

/**
 * Who is signed in, for showing the right UI. The real credential is an HttpOnly cookie the
 * browser sends automatically; scripts can't read it. These values are display hints only:
 * every permission is enforced by the API.
 */
export const session = {
  isLoggedIn: (): boolean => !!localStorage.getItem('role'),
  role: (): string => localStorage.getItem('role') || '',
  userId: (): number => Number(localStorage.getItem('userId')) || 0,
  emailVerified: (): boolean => localStorage.getItem('emailVerified') !== 'false',

  /** Store the profile returned by login/refresh. */
  start(user: { userId: number; role: string; name: string; emailVerified: boolean }): void {
    localStorage.removeItem('token'); // from versions that kept the JWT in storage
    localStorage.setItem('userId', String(user.userId));
    localStorage.setItem('role', user.role);
    localStorage.setItem('name', user.name);
    localStorage.setItem('emailVerified', String(user.emailVerified));
  },

  clear(): void {
    for (const key of ['token', 'userId', 'role', 'name', 'emailVerified']) {
      localStorage.removeItem(key);
    }
  }
};

/** Send a guest to login and bring them back to the page they were on. */
export function goToLogin(router: Router): void {
  router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
}
