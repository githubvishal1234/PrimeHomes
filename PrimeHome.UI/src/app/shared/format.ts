import { Pipe, PipeTransform } from '@angular/core';

const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * Indian property pricing, as buyers read it on portals:
 * ₹1.25 Cr, ₹48.5 L, ₹32,000/month for rentals.
 */
export function formatPrice(value: number | null | undefined, listingType?: string | null): string {
  if (value == null || !isFinite(value)) {
    return '—';
  }

  const rent = listingType === 'Rent';
  let text: string;

  if (!rent && value >= 1_00_00_000) {
    text = `₹${trim(value / 1_00_00_000)} Cr`;
  } else if (!rent && value >= 1_00_000) {
    text = `₹${trim(value / 1_00_000)} L`;
  } else {
    text = `₹${plain.format(value)}`;
  }

  return rent ? `${text}/month` : text;
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : plain.format(value);
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

@Pipe({ name: 'price' })
export class PricePipe implements PipeTransform {
  transform(value: number | null | undefined, listingType?: string | null): string {
    return formatPrice(value, listingType);
  }
}

@Pipe({ name: 'num' })
export class NumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatNumber(value);
  }
}

/** Parse a stored JSON array of amenities, tolerating bad data. */
export function parseAmenities(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Standard reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1), r = monthly rate. */
export function emi(principal: number, annualRatePercent: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

/** Inverse of emi(): the loan a given monthly EMI can repay. */
export function loanForEmi(monthlyEmi: number, annualRatePercent: number, years: number): number {
  const n = Math.round(years * 12);
  if (monthlyEmi <= 0 || n <= 0) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return monthlyEmi * n;
  const f = Math.pow(1 + r, n);
  return (monthlyEmi * (f - 1)) / (r * f);
}
