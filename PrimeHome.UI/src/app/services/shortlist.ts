import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FavoriteService } from './favorite.service';
import { ToastService } from './toast';
import { goToLogin, session } from './session';
import { apiErrorMessage } from './auth';

/**
 * Shortlisted (favourite) property ids for the signed-in buyer, shared by every card on screen.
 * Guests who tap the heart are sent to sign in and brought back.
 */
@Injectable({ providedIn: 'root' })
export class ShortlistService {
  private readonly favorites = inject(FavoriteService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly ids = signal<ReadonlySet<number>>(new Set());
  private loadedFor = 0;

  /** Loads once per signed-in buyer; safe to call from every page. */
  ensureLoaded(): void {
    const userId = session.userId();
    if (session.role() !== 'Buyer' || this.loadedFor === userId) {
      if (session.role() !== 'Buyer') this.ids.set(new Set());
      return;
    }
    this.loadedFor = userId;
    this.favorites.getMyFavorites().subscribe({
      next: list => this.ids.set(new Set(list.map(f => f.propertyId))),
      error: () => (this.loadedFor = 0)
    });
  }

  has(id: number): boolean {
    return this.ids().has(id);
  }

  toggle(id: number): void {
    if (!session.isLoggedIn()) {
      goToLogin(this.router);
      return;
    }
    if (session.role() !== 'Buyer') {
      this.toast.info('Shortlisting is for buyer accounts.');
      return;
    }

    const adding = !this.has(id);
    this.setId(id, adding); // optimistic

    const request = adding ? this.favorites.addFavorite(id) : this.favorites.removeFavorite(id);
    request.subscribe({
      next: () => this.toast.success(adding ? 'Added to your shortlist.' : 'Removed from your shortlist.'),
      error: err => {
        this.setId(id, !adding);
        this.toast.error(apiErrorMessage(err, 'Could not update your shortlist.'));
      }
    });
  }

  private setId(id: number, present: boolean): void {
    const next = new Set(this.ids());
    present ? next.add(id) : next.delete(id);
    this.ids.set(next);
  }
}

/** Last 12 viewed property ids per user (or guest), newest first. Browser-only convenience. */
export const recentlyViewed = {
  key: () => `ph_recent_${session.userId() || 'guest'}`,

  list(): number[] {
    try {
      return JSON.parse(localStorage.getItem(this.key()) || '[]');
    } catch {
      return [];
    }
  },

  add(id: number): void {
    try {
      const next = [id, ...this.list().filter(x => x !== id)].slice(0, 12);
      localStorage.setItem(this.key(), JSON.stringify(next));
    } catch {
      /* storage unavailable: nothing to remember */
    }
  }
};
