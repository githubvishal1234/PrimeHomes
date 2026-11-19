import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { ToastService } from '../services/toast';
import { session } from '../services/session';

/**
 * Hides pages from roles that can't use them. This is navigation only: the API enforces
 * every permission, so a tampered role in storage just gets 403s.
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);

  if (!session.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  const allowedRoles = (route.data['roles'] as string[] | undefined) ?? [];
  if (allowedRoles.includes(session.role())) {
    return true;
  }

  inject(ToastService).error('That page is not available for your account type.');
  return router.createUrlTree(['/']);
};
