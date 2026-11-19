import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE = 'PrimeHomes';
const DEFAULT_DESCRIPTION = 'Verified homes for sale and rent across Andhra Pradesh, Telangana and Karnataka. Contact owners directly and book site visits online.';

/** Page title, description, Open Graph tags and canonical URL, set per page. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  set(page: { title?: string; description?: string; path?: string; image?: string | null }): void {
    const title = page.title ? `${page.title} | ${SITE}` : `${SITE}: Homes for sale and rent`;
    const description = (page.description || DEFAULT_DESCRIPTION).slice(0, 160);
    const origin = this.document.location.origin;
    const url = origin + (page.path ?? this.document.location.pathname);

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    if (page.image) {
      this.meta.updateTag({ property: 'og:image', content: page.image.startsWith('http') ? page.image : origin + page.image });
    } else {
      this.meta.removeTag("property='og:image'");
    }

    let canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = url;
  }
}
