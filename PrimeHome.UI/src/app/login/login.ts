import { session } from '../services/session';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  email: string = '';
  password: string = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {
    if (this.route.snapshot.queryParamMap.get('expired')) {
      this.errorMessage = 'Your session has expired. Please sign in again.';
    }
  }

  login(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    if (this.isLoading) {
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    const loginData = {
      email: this.email,
      password: this.password
    };

    this.http.post<any>(
      `${environment.apiUrl}/Auth/login`,
      loginData
    ).subscribe({

      next: (response) => {

        // The session itself is an HttpOnly cookie set by the API; keep only display info here.
        session.start(response);

        const destinations: Record<string, string> = {
          Owner: '/owner-dashboard',
          Buyer: '/buyer-dashboard',
          Admin: '/admin-dashboard'
        };
        const destination = destinations[response.role];

        // Only same-app paths are accepted as a return target.
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const safeReturnUrl = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.startsWith('/login')
          ? returnUrl
          : null;

        this.isLoading = false;
        if (safeReturnUrl) {
          this.router.navigateByUrl(safeReturnUrl);
        } else if (destination) {
          this.router.navigate([destination]);
        } else {
          this.errorMessage = 'Your account role could not be recognized. Please contact support.';
        }
      },

      error: (error) => {
        console.error('Login error:', error);
        this.isLoading = false;
        this.errorMessage = error.error?.message
          || error.error?.title
          || (typeof error.error === 'string' ? error.error : '')
          || 'Unable to sign in. Check your email and password, then try again.';
      }

    });
  }
}
