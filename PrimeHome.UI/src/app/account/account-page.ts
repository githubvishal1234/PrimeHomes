import { session } from '../services/session';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth, apiErrorMessage } from '../services/auth';

type Mode = 'forgot' | 'reset' | 'verify';

/** Forgot password, reset password (from email link) and verify email (from email link). */
@Component({
  selector: 'app-account-page',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="ph-page ph-page-narrow">
      <div class="ph-panel">
        @switch (mode) {
          @case ('forgot') {
            <p class="ph-eyebrow">Account help</p>
            <h1>Forgot your password?</h1>
            <p class="ph-lead">Enter your account email and we'll send a link to choose a new password.</p>

            @if (done()) {
              <p class="ph-note ph-note-success" role="status">{{ message() }}</p>
              <a routerLink="/login" class="btn ph-btn-primary w-100">Back to sign in</a>
            } @else {
              <form (ngSubmit)="sendReset()" #f="ngForm" novalidate>
                <label for="acct-email" class="form-label">Email address</label>
                <input id="acct-email" name="email" type="email" class="form-control" [(ngModel)]="email" required email autocomplete="email">
                @if (error()) { <p class="ph-note ph-note-error" role="alert">{{ error() }}</p> }
                <button type="submit" class="btn ph-btn-primary w-100 mt-3" [disabled]="busy() || f.invalid">
                  {{ busy() ? 'Sending…' : 'Send reset link' }}
                </button>
              </form>
              <p class="ph-foot"><a routerLink="/login">Back to sign in</a></p>
            }
          }

          @case ('reset') {
            <p class="ph-eyebrow">Account help</p>
            <h1>Choose a new password</h1>
            <p class="ph-lead">For {{ email }}</p>

            @if (done()) {
              <p class="ph-note ph-note-success" role="status">{{ message() }}</p>
              <a routerLink="/login" class="btn ph-btn-primary w-100">Sign in</a>
            } @else {
              <form (ngSubmit)="reset()" #f="ngForm" novalidate>
                <label for="acct-pass" class="form-label">New password</label>
                <input id="acct-pass" name="password" type="password" class="form-control" [(ngModel)]="password" required minlength="8" autocomplete="new-password">
                <label for="acct-pass2" class="form-label mt-3">Confirm new password</label>
                <input id="acct-pass2" name="confirm" type="password" class="form-control" [(ngModel)]="confirm" required autocomplete="new-password">
                <p class="ph-hint">At least 8 characters.</p>
                @if (error()) { <p class="ph-note ph-note-error" role="alert">{{ error() }}</p> }
                <button type="submit" class="btn ph-btn-primary w-100 mt-2" [disabled]="busy() || f.invalid">
                  {{ busy() ? 'Saving…' : 'Update password' }}
                </button>
              </form>
              <p class="ph-foot"><a routerLink="/forgot-password">Request a new link</a></p>
            }
          }

          @case ('verify') {
            <p class="ph-eyebrow">Email verification</p>
            @if (busy()) {
              <h1>Verifying…</h1>
            } @else if (done()) {
              <h1>You're verified</h1>
              <p class="ph-note ph-note-success" role="status">{{ message() }}</p>
              <a [routerLink]="isLoggedIn ? '/' : '/login'" class="btn ph-btn-primary w-100">{{ isLoggedIn ? 'Continue' : 'Sign in' }}</a>
            } @else {
              <h1>Link not valid</h1>
              <p class="ph-note ph-note-error" role="alert">{{ error() }}</p>
              <a routerLink="/profile" class="btn ph-btn-outline w-100">Resend from your profile</a>
            }
          }
        }
      </div>
    </section>
  `
})
export class AccountPage implements OnInit {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  mode: Mode = 'forgot';
  email = '';
  token = '';
  password = '';
  confirm = '';
  readonly isLoggedIn = session.isLoggedIn();

  readonly busy = signal(false);
  readonly done = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  ngOnInit(): void {
    this.mode = this.route.snapshot.data['mode'];
    const query = this.route.snapshot.queryParamMap;
    this.email = query.get('email') ?? '';
    this.token = query.get('token') ?? '';

    if (this.mode !== 'forgot' && (!this.email || !this.token)) {
      this.error.set('This link is incomplete. Please use the full link from your email.');
      if (this.mode === 'reset') this.router.navigate(['/forgot-password']);
      return;
    }

    if (this.mode === 'verify') {
      this.run(this.auth.verifyEmail(this.email, this.token), () => localStorage.setItem('emailVerified', 'true'));
    }
  }

  sendReset(): void {
    this.run(this.auth.forgotPassword(this.email.trim()));
  }

  reset(): void {
    if (this.password !== this.confirm) {
      this.error.set('The two passwords do not match.');
      return;
    }
    this.run(this.auth.resetPassword(this.email, this.token, this.password));
  }

  private run(request: ReturnType<Auth['forgotPassword']>, onSuccess?: () => void): void {
    this.busy.set(true);
    this.error.set('');
    request.subscribe({
      next: res => {
        this.busy.set(false);
        this.done.set(true);
        this.message.set(res.message);
        onSuccess?.();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err, 'Something went wrong. Please try again.'));
      }
    });
  }
}
