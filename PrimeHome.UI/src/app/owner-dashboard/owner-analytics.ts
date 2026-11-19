import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Property as PropertyService } from '../services/property';
import { OwnerAnalytics as Analytics } from '../models/property';

/**
 * Owner engagement, last 7/30/90 days: three stat tiles plus a single-series bar chart of daily views.
 * Inquiries and visits are on a much smaller scale than views, so they are shown in the tooltip and
 * table rather than on a second axis.
 */
@Component({
  selector: 'app-owner-analytics',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="oa" aria-labelledby="oa-title">
      <div class="oa-head">
        <h2 id="oa-title">Listing performance</h2>
        <div class="oa-range" role="group" aria-label="Date range">
          @for (d of ranges; track d) {
            <button type="button" [class.on]="days() === d" [attr.aria-pressed]="days() === d" (click)="load(d)">{{ d }} days</button>
          }
        </div>
      </div>

      <div class="oa-tiles">
        <div class="oa-tile"><span>Views</span><strong>{{ data()?.totals?.views ?? '—' }}</strong></div>
        <div class="oa-tile"><span>Inquiries</span><strong>{{ data()?.totals?.inquiries ?? '—' }}</strong></div>
        <div class="oa-tile"><span>Visit requests</span><strong>{{ data()?.totals?.visits ?? '—' }}</strong></div>
      </div>

      <div class="oa-chart">
        <p class="oa-chart-title">Daily views</p>
        @if (loading()) {
          <div class="ph-skeleton" style="height: 180px"></div>
        } @else if (!data()?.totals?.views) {
          <p class="oa-empty">No views yet in this period. Complete listings with photos get seen more.</p>
        } @else {
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="oa-svg" role="img"
               [attr.aria-label]="'Daily views over the last ' + days() + ' days, peak ' + max() + ' in a day'"
               (mouseleave)="hover.set(null)">
            @for (t of ticks(); track t) {
              <line class="oa-grid" x1="32" [attr.x2]="W" [attr.y1]="y(t)" [attr.y2]="y(t)" />
              <text class="oa-axis" x="26" [attr.y]="y(t) + 4" text-anchor="end">{{ t }}</text>
            }
            @for (d of data()!.series; track d.date; let i = $index) {
              @if (d.views > 0) {
                <path class="oa-bar" [class.dim]="hover() !== null && hover() !== i" [attr.d]="bar(i, d.views)" />
              }
              <!-- full-height hit target, wider than the bar -->
              <rect class="oa-hit" [attr.x]="x(i)" y="0" [attr.width]="step()" [attr.height]="H - 20"
                    (mouseenter)="hover.set(i)" (focus)="hover.set(i)" tabindex="0"
                    [attr.aria-label]="(d.date | date: 'd MMM') + ': ' + d.views + ' views, ' + d.inquiries + ' inquiries, ' + d.visits + ' visit requests'" />
            }
            <text class="oa-axis" [attr.x]="x(0)" [attr.y]="H - 4">{{ data()!.series[0].date | date: 'd MMM' }}</text>
            <text class="oa-axis" [attr.x]="W" [attr.y]="H - 4" text-anchor="end">Today</text>
          </svg>

          @if (hover() !== null) {
            @let d = data()!.series[hover()!];
            <div class="oa-tip" [style.left.%]="tipLeft()" role="status">
              <strong>{{ d.date | date: 'EEE d MMM' }}</strong>
              <span>{{ d.views }} views</span>
              <span>{{ d.inquiries }} inquiries · {{ d.visits }} visits</span>
            </div>
          }
        }
      </div>

      @if (data()?.totals?.views) {
        <details class="oa-table">
          <summary>View as table</summary>
          <table class="table table-sm">
            <thead><tr><th scope="col">Date</th><th scope="col">Views</th><th scope="col">Inquiries</th><th scope="col">Visit requests</th></tr></thead>
            <tbody>
              @for (d of activeDays(); track d.date) {
                <tr><td>{{ d.date | date: 'd MMM y' }}</td><td>{{ d.views }}</td><td>{{ d.inquiries }}</td><td>{{ d.visits }}</td></tr>
              }
            </tbody>
          </table>
        </details>
      }
    </section>
  `,
  styles: `
    .oa { background: #fff; border: 1px solid var(--ph-border); border-radius: var(--ph-radius); padding: 1.25rem 1.5rem; margin: 1.5rem 0; }
    .oa-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .oa-head h2 { margin: 0; font-size: 1.15rem; color: var(--ph-navy); }
    .oa-range { display: flex; border: 1px solid var(--ph-border); border-radius: 8px; overflow: hidden; }
    .oa-range button { border: 0; background: #fff; padding: .3rem .7rem; font-size: .85rem; color: var(--ph-text-light); }
    .oa-range button.on { background: var(--ph-navy); color: #fff; }
    .oa-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; margin: 1rem 0; }
    .oa-tile { background: var(--ph-background); border-radius: var(--ph-radius-sm); padding: .75rem 1rem; display: grid; }
    .oa-tile span { font-size: .8rem; color: var(--ph-muted); font-weight: 600; }
    .oa-tile strong { font-size: 1.6rem; color: var(--ph-text); font-variant-numeric: tabular-nums; }
    .oa-chart { position: relative; }
    .oa-chart-title { margin: 0 0 .35rem; font-size: .85rem; font-weight: 700; color: var(--ph-text-light); }
    .oa-svg { width: 100%; height: auto; display: block; overflow: visible; }
    .oa-grid { stroke: var(--ph-border); stroke-width: 1; }
    .oa-axis { fill: var(--ph-muted); font-size: 10px; }
    .oa-bar { fill: var(--ph-navy); transition: opacity 120ms; }
    .oa-bar.dim { opacity: .35; }
    .oa-hit { fill: transparent; outline: none; cursor: crosshair; }
    .oa-hit:focus-visible { stroke: var(--ph-gold); stroke-width: 1.5; }
    .oa-tip { position: absolute; top: 1.6rem; transform: translateX(-50%); background: var(--ph-text); color: #fff; border-radius: 8px; padding: .45rem .65rem; font-size: .8rem; display: grid; gap: .1rem; pointer-events: none; white-space: nowrap; box-shadow: var(--ph-shadow); }
    .oa-empty { color: var(--ph-muted); margin: .5rem 0 0; }
    .oa-table { margin-top: .75rem; font-size: .9rem; }
    .oa-table summary { cursor: pointer; color: var(--ph-navy); font-weight: 600; }
    @media (max-width: 575.98px) { .oa-tiles { grid-template-columns: 1fr; } .oa { padding: 1rem; } }
  `
})
export class OwnerAnalytics implements OnInit {
  private readonly api = inject(PropertyService);

  readonly W = 640;
  readonly H = 200;
  private readonly plotTop = 8;
  private readonly plotBottom = this.H - 20;
  readonly ranges = [7, 30, 90];

  readonly days = signal(30);
  readonly data = signal<Analytics | null>(null);
  readonly loading = signal(true);
  readonly hover = signal<number | null>(null);

  readonly max = computed(() => Math.max(1, ...(this.data()?.series.map(d => d.views) ?? [1])));
  /** Round axis top: 1, 2, 5 × 10ⁿ above the peak. */
  private readonly axisMax = computed(() => {
    const m = this.max();
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    return [1, 2, 5, 10].map(f => f * p).find(v => v >= m)!;
  });
  readonly ticks = computed(() => [0, this.axisMax() / 2, this.axisMax()].map(v => Math.round(v)).filter((v, i, a) => a.indexOf(v) === i));
  readonly step = computed(() => (this.W - 32) / (this.data()?.series.length || 1));
  readonly activeDays = computed(() => (this.data()?.series ?? []).filter(d => d.views || d.inquiries || d.visits).reverse());
  readonly tipLeft = computed(() => {
    const i = this.hover() ?? 0;
    return Math.min(85, Math.max(15, ((this.x(i) + this.step() / 2) / this.W) * 100));
  });

  ngOnInit(): void {
    this.load(30);
  }

  load(days: number): void {
    this.days.set(days);
    this.loading.set(true);
    this.hover.set(null);
    this.api.getMyAnalytics(days).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => { this.data.set(null); this.loading.set(false); }
    });
  }

  x(i: number): number {
    return 32 + i * this.step();
  }

  y(value: number): number {
    return this.plotBottom - (value / this.axisMax()) * (this.plotBottom - this.plotTop);
  }

  /** Bar anchored to the baseline with a 4px rounded top and a 2px gap to its neighbours. */
  bar(i: number, value: number): string {
    const gap = 2;
    const w = Math.max(2, this.step() - gap);
    const x0 = this.x(i) + gap / 2;
    const top = this.y(value);
    const r = Math.min(4, w / 2, this.plotBottom - top);
    return `M${x0},${this.plotBottom}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + w - r}Q${x0 + w},${top} ${x0 + w},${top + r}V${this.plotBottom}Z`;
  }
}


