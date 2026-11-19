import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/** App-wide, non-blocking messages (replaces window.alert). Rendered by <app-toasts> in the shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {

  readonly toasts = signal<Toast[]>([]);

  private nextId = 1;

  success(text: string): void { this.show(text, 'success'); }

  error(text: string): void { this.show(text, 'error', 7000); }

  info(text: string): void { this.show(text, 'info'); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private show(text: string, kind: ToastKind, durationMs = 4500): void {
    const toast: Toast = { id: this.nextId++, kind, text };
    // Keep at most 4 on screen.
    this.toasts.update(list => [...list.slice(-3), toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }
}
