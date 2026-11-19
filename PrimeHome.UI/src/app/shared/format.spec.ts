import { emi, formatPrice, loanForEmi, parseAmenities } from './format';

describe('formatPrice', () => {
  it('uses crore and lakh for sale prices', () => {
    expect(formatPrice(12_500_000, 'Sale')).toBe('₹1.25 Cr');
    expect(formatPrice(9_800_000, 'Sale')).toBe('₹98 L');
    expect(formatPrice(4_850_000, 'Sale')).toBe('₹48.5 L');
    expect(formatPrice(95_000, 'Sale')).toBe('₹95,000');
  });

  it('shows full monthly rent with Indian grouping', () => {
    expect(formatPrice(32_000, 'Rent')).toBe('₹32,000/month');
    expect(formatPrice(150_000, 'Rent')).toBe('₹1,50,000/month');
  });

  it('handles missing values', () => {
    expect(formatPrice(null)).toBe('—');
  });
});

describe('emi', () => {
  it('matches the standard formula (₹50L, 8.5%, 20y ≈ ₹43,391)', () => {
    expect(Math.round(emi(5_000_000, 8.5, 20))).toBe(43391);
  });

  it('handles zero interest and empty input', () => {
    expect(emi(1_200_000, 0, 10)).toBe(10_000);
    expect(emi(0, 8.5, 20)).toBe(0);
  });
});

describe('parseAmenities', () => {
  it('parses JSON arrays and tolerates bad data', () => {
    expect(parseAmenities('["Pool","Gym"]')).toEqual(['Pool', 'Gym']);
    expect(parseAmenities('not json')).toEqual([]);
    expect(parseAmenities(null)).toEqual([]);
  });
});

describe('loanForEmi', () => {
  it('is the inverse of emi', () => {
    expect(Math.round(loanForEmi(emi(5_000_000, 8.5, 20), 8.5, 20))).toBe(5_000_000);
    expect(loanForEmi(10_000, 0, 10)).toBe(1_200_000);
    expect(loanForEmi(0, 8.5, 20)).toBe(0);
  });
});
