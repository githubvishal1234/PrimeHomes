import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Stroke icons (24×24, currentColor). Add a path here instead of pulling in an icon library. */
const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  bed: 'M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1M7 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  bath: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM6 12V6a2 2 0 0 1 3.5-1.3M7 19l-1 2M17 19l1 2',
  area: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  heart: 'M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20z',
  compare: 'M8 3v18M16 3v18M3 8h5M16 16h5M3 8l2-2M3 8l2 2M21 16l-2-2M21 16l-2 2',
  verified: 'M12 3l2.2 1.6 2.7-.2.8 2.6 2.3 1.5-.9 2.5.9 2.5-2.3 1.5-.8 2.6-2.7-.2L12 21l-2.2-1.6-2.7.2-.8-2.6L4 15.5l.9-2.5L4 10.5 6.3 9l.8-2.6 2.7.2L12 3zM8.8 12l2.2 2.2 4.2-4.4',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4V8zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  filter: 'M4 6h16M7 12h10M10 18h4',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  building: 'M4 21V5l8-2v18M12 21h8V9l-8-2M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  sofa: 'M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11a2 2 0 0 1 2 2v2h14v-2a2 2 0 1 1 2 2v3H3v-3a2 2 0 0 1 0-4zM5 18v2M19 18v2',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  car: 'M5 16h14M6 16l1.5-5h9L18 16M5 16v3h2v-1h10v1h2v-3M8 13.5h.01M16 13.5h.01',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  check: 'M5 12.5l4.5 4.5L19 7',
  calculator: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h3',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  send: 'M4 12l16-8-6 16-2.5-6.5L4 12z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zM9 12l2 2 4-4',
  tree: 'M12 3l5 7h-3l4 6H6l4-6H7l5-7zM12 16v5',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6l1-8z',
  dumbbell: 'M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12',
  waves: 'M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2-1.5 4.5-1.5S19 9 21 9M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2-1.5 4.5-1.5S19 15 21 15',
  play: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 8.5v7l6-3.5-6-3.5z',
  share: 'M16 6l-4-3-4 3M12 3v12M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.9L12 3.5z',
};

@Component({
  selector: 'ph-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none"
         [attr.fill]="filled() ? 'currentColor' : 'none'"
         stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; flex: none; }`
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly filled = input(false);
  protected readonly path = computed(() => PATHS[this.name()] ?? '');
}
