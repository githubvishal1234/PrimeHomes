import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="ph-toasts" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="ph-toast" [class]="'ph-toast ph-toast-' + toast.kind" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <span class="ph-toast-icon" aria-hidden="true">{{ toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i' }}</span>
          <span class="ph-toast-text">{{ toast.text }}</span>
          <button type="button" class="ph-toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss message">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .ph-toasts {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 2000;
      display: grid;
      gap: .6rem;
      width: min(380px, calc(100vw - 2rem));
    }
    .ph-toast {
      display: flex;
      align-items: flex-start;
      gap: .7rem;
      padding: .85rem 1rem;
      border-radius: var(--ph-radius-sm);
      background: var(--ph-white);
      color: var(--ph-text);
      box-shadow: var(--ph-shadow-lg);
      border-left: 4px solid var(--ph-blue);
      animation: ph-toast-in 180ms ease-out;
    }
    .ph-toast-success { border-left-color: var(--ph-success); }
    .ph-toast-error { border-left-color: var(--ph-danger); }
    .ph-toast-icon {
      flex: none;
      display: grid;
      place-items: center;
      width: 1.4rem;
      height: 1.4rem;
      border-radius: 50%;
      font-size: .8rem;
      font-weight: 700;
      color: var(--ph-white);
      background: var(--ph-blue);
    }
    .ph-toast-success .ph-toast-icon { background: var(--ph-success); }
    .ph-toast-error .ph-toast-icon { background: var(--ph-danger); }
    .ph-toast-text { flex: 1; line-height: 1.4; }
    .ph-toast-close {
      flex: none;
      border: 0;
      background: none;
      font-size: 1.2rem;
      line-height: 1;
      color: var(--ph-muted);
      cursor: pointer;
    }
    @keyframes ph-toast-in { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .ph-toast { animation: none; } }
  `
})
export class Toasts {
  protected readonly toastService = inject(ToastService);
}
