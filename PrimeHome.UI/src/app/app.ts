import { session } from './services/session';
import { Icon } from './shared/icon/icon';
import { Footer } from './shared/footer/footer';
import { Toasts } from './shared/toasts/toasts';
import { Auth, apiErrorMessage } from './services/auth';
import { ToastService } from './services/toast';
import { filter } from 'rxjs';
import { Component, inject, signal } from '@angular/core';

import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
  NavigationEnd
} from '@angular/router';

import { CommonModule } from '@angular/common';

import { NotificationService } from './services/notification';


@Component({
  selector: 'app-root',

  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    Footer,
    Toasts,
    Icon
  ],

  templateUrl: './app.html',

  styleUrl: './app.css'
})


export class App {

  menuOpen = false;

  // Signal so the badge redraws as soon as the count arrives (the app runs without zone.js).
  readonly unreadNotificationCount = signal(0);

  private readonly auth = inject(Auth);
  private readonly toast = inject(ToastService);


 constructor(
  private router: Router,
  private notificationService: NotificationService
) {

  this.loadUnreadNotificationCount();

  // Refresh the bell after login, logout and every page change.
  this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe(() => this.loadUnreadNotificationCount());

  // Refresh navbar notification count whenever
  // a notification is marked as read
  this.notificationService
    .unreadCountChanged$
    .subscribe(() => {

      this.loadUnreadNotificationCount();

    });

}


  // ==========================================
  // Check Login
  // ==========================================

  isLoggedIn(): boolean {

    return session.isLoggedIn();

  }

  
isDashboardPage(): boolean {
  const dashboardRoutes = [
    '/buyer-dashboard',
    '/owner-dashboard',
    '/admin-dashboard'
  ];

  return dashboardRoutes.some(route =>
    this.router.url === route ||
    this.router.url.startsWith(route + '/')
  );
}



  // ==========================================
  // Get User Role
  // ==========================================

  getUserRole(): string {

    return localStorage.getItem('role') || '';

  }


  // ==========================================
  // Load Unread Notification Count
  // ==========================================

  loadUnreadNotificationCount(): void {

    if (!this.isLoggedIn()) {

      this.unreadNotificationCount.set(0);

      return;

    }


    this.notificationService
      .getUnreadCount()
      .subscribe({

        next: (response) => {

          this.unreadNotificationCount.set(response.count);

        },

        error: (error) => {

          console.error(
            'Notification count error:',
            error
          );

          this.unreadNotificationCount.set(0);

        }

      });

  }


  // ==========================================
  // Open Notifications
  // ==========================================

  openNotifications(): void {

    this.router.navigate(['/notifications']);

  }


  // ==========================================
  // Email verification banner
  // ==========================================

  needsEmailVerification(): boolean {
    return this.isLoggedIn() && localStorage.getItem('emailVerified') === 'false';
  }

  resendVerification(): void {
    this.auth.resendVerification().subscribe({
      next: res => {
        if (res.emailVerified) {
          localStorage.setItem('emailVerified', 'true');
        }
        this.toast.success(res.message);
      },
      error: err => this.toast.error(apiErrorMessage(err, 'Unable to send the verification email.'))
    });
  }


  // ==========================================
  // Logout
  // ==========================================

  logout(): void {

    // Clear locally even if the server is unreachable; the cookies expire on their own.
    const finish = () => {
      session.clear();
      this.unreadNotificationCount.set(0);
      this.menuOpen = false;
      this.router.navigate(['/login']);
    };

    this.auth.logout().subscribe({ next: finish, error: finish });

  }


  // ==========================================
  // Mobile Menu
  // ==========================================

  toggleMenu(): void {

    this.menuOpen = !this.menuOpen;

  }

  closeMenu(): void {

    this.menuOpen = false;

  }

}